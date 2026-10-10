import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileSpreadsheet, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { exportReport, getReport } from '../../api/reports'
import { listCustomers } from '../../api/customers'
import { listSuppliers } from '../../api/suppliers'
import { listProducts } from '../../api/products'
import { listWarehouses } from '../../api/warehouses'
import { listUsers } from '../../api/users'
import { getExpenseCategories } from '../../api/expenses'
import { listCategories } from '../../api/categories'
import { listBrands } from '../../api/brands'
import { normalizeApiUser } from '../users/userRoleUtils'
import { ROLES } from '../../auth/roles'
import { usePermission } from '../../auth/usePermission'
import { useEntitlements } from '../../entitlements/EntitlementsContext'
import { REPORT_TYPE_TO_ENTITLEMENT_KEY } from '../../entitlements/entitlementKeys'
import PlanRestricted from '../../entitlements/PlanRestricted'
import { DEMO_MODE } from '../../config/demoMode'
import { PERIOD_OPTIONS, getDateRangeForPeriod } from './reportConstants'
import { getReportConfig, resolveValidGroupBy } from './reportConfig'
import { resolveColumns } from './reportDataUtils'
import ReportSelector from './components/ReportSelector'
import ReportSummaryCards from './components/ReportSummaryCards'
import ReportChart from './components/ReportChart'
import ReportTable from './components/ReportTable'
import ProfitLossStatement from './components/ProfitLossStatement'
import EntitySearchSelect from './components/EntitySearchSelect'

const DEFAULT_REPORT = 'sales'
const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
]

// Catalogs that can genuinely be too large to preload in full (listCustomers/listProducts expose
// no page-size override, so a one-shot load silently stops at the backend's own default page for
// any organization bigger than that) - these search the real API live instead.
const SEARCHED_ENTITY_TYPES = new Set(['customer', 'supplier', 'product'])

export default function FinancialReports({
  title = 'Reports',
  description = 'Access, review and export every business report for your organization',
}) {
  const { can } = usePermission()
  const canExport = can('reports', 'export')
  const { hasFeature } = useEntitlements()
  // A report type with no listed entitlement key (none today - every REPORT_CONFIG key has one,
  // see entitlementKeys.js) is treated as entitled rather than guessed-blocked.
  const isReportEntitled = useCallback(
    (type) => {
      const key = REPORT_TYPE_TO_ENTITLEMENT_KEY[type]
      return !key || hasFeature(key)
    },
    [hasFeature],
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const initialType = getReportConfig(searchParams.get('report')) ? searchParams.get('report') : DEFAULT_REPORT
  const [reportType, setReportType] = useState(initialType)
  const config = getReportConfig(reportType)

  const [period, setPeriod] = useState(searchParams.get('period') || 'monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filterLabels, setFilterLabels] = useState({})
  const [groupBy, setGroupBy] = useState(() => resolveValidGroupBy(getReportConfig(initialType), searchParams.get('group_by')))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isExporting, setIsExporting] = useState('')
  const [exportError, setExportError] = useState('')

  const [entityOptions, setEntityOptions] = useState({
    warehouse: [], salesperson: [], category: [], brand: [], expenseCategory: [],
  })

  // Small, bounded catalogs only - loaded once, shared across every report's filters.
  // Customer/supplier/product are deliberately NOT preloaded here (see SEARCHED_ENTITY_TYPES).
  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [warehouses, users, categories, brands, expenseCategories] = await Promise.all([
        listWarehouses(), listUsers(), listCategories(), listBrands(), getExpenseCategories(),
      ])
      if (!isMounted) return

      const mapOption = (item) => ({ value: item.id, label: item.name })

      setEntityOptions({
        warehouse: warehouses.success ? warehouses.warehouses.map(mapOption) : [],
        salesperson: users.success
          ? users.users.map(normalizeApiUser).filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN).map((user) => ({ value: user.id, label: user.name }))
          : [],
        category: categories.success ? categories.categories.map(mapOption) : [],
        brand: brands.success ? brands.brands.map(mapOption) : [],
        expenseCategory: expenseCategories.success
          ? expenseCategories.categories.map((entry) => (typeof entry === 'string' ? { value: entry, label: entry } : { value: entry.id || entry.name, label: entry.name || String(entry) }))
          : [],
      })
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const searchEntity = useCallback(async (entity, query) => {
    const fetcher = entity === 'customer' ? listCustomers : entity === 'supplier' ? listSuppliers : listProducts
    const key = entity === 'customer' ? 'customers' : entity === 'supplier' ? 'suppliers' : 'products'
    const result = await fetcher({ search: query })
    if (!result.success) return []
    return (result[key] || []).slice(0, 50).map((item) => ({ value: item.id, label: item.name }))
  }, [])

  // Debounce the search box only - every other filter applies immediately.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const { dateFrom, dateTo } = useMemo(
    () => getDateRangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  // Resets everything report-scoped (filters/search/page/groupBy/stale rows) in one place, so
  // both the click handler and the browser-navigation sync effect below apply EXACTLY the same
  // reset - no second, slightly different code path to drift out of sync with it.
  const applyReportSwitch = useCallback((nextType, urlGroupBy) => {
    const nextConfig = getReportConfig(nextType)
    const nextGroupBy = resolveValidGroupBy(nextConfig, urlGroupBy)
    setReportType(nextType)
    setFilters({})
    setFilterLabels({})
    setSearchInput('')
    setSearch('')
    setGroupBy(nextGroupBy)
    setPage(1)
    setMoreFiltersOpen(false)
    setReport(null)
    return nextGroupBy
  }, [])

  const handleReportTypeChange = (nextType) => {
    // Always the new report's own default - never carries the previous report's group_by over.
    const nextGroupBy = applyReportSwitch(nextType, null)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('report', nextType)
    if (nextGroupBy) nextParams.set('group_by', nextGroupBy)
    else nextParams.delete('group_by')
    setSearchParams(nextParams, { replace: true })
  }

  const handlePeriodChange = (value) => {
    setPeriod(value)
    setPage(1)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('period', value)
    setSearchParams(nextParams, { replace: true })
  }

  const handleFilterChange = (key, value, label) => {
    setFilters((current) => ({ ...current, [key]: value }))
    if (label !== undefined) setFilterLabels((current) => ({ ...current, [key]: label }))
    setPage(1)
  }

  const handleGroupByChange = (value) => {
    setGroupBy(value)
    setPage(1)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('group_by', value)
    setSearchParams(nextParams, { replace: true })
  }

  const handleClearFilters = () => {
    setFilters({})
    setFilterLabels({})
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  // Keeps local state in sync with the URL for navigation this component didn't itself trigger
  // (browser back/forward, a pasted link, a direct refresh on e.g. ?report=sales&group_by=junk) -
  // the handlers above already apply the same reset synchronously, so when THEY are the cause of
  // a searchParams change, reportType/groupBy already match by the time this runs and it's a no-op.
  useEffect(() => {
    const urlReport = searchParams.get('report')
    const nextType = getReportConfig(urlReport) ? urlReport : DEFAULT_REPORT
    const urlGroupBy = searchParams.get('group_by')

    if (nextType !== reportType) {
      applyReportSwitch(nextType, urlGroupBy)
      return
    }

    const validGroupBy = resolveValidGroupBy(config, urlGroupBy)
    if (validGroupBy !== groupBy) {
      setGroupBy(validGroupBy)
      setPage(1)
    }

    const urlPeriod = searchParams.get('period')
    if (urlPeriod && urlPeriod !== period) {
      setPeriod(urlPeriod)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '' && value !== false).length

  const requestParams = useMemo(() => {
    const params = { ...filters, search: search || undefined, page, page_size: Number(pageSize) }
    if (groupBy) params.group_by = groupBy
    if (!config?.noAsOfDate) {
      params.date_from = dateFrom
      params.date_to = dateTo
    }
    return params
  }, [filters, search, page, pageSize, groupBy, config, dateFrom, dateTo])

  // Guards against out-of-order responses: if the user switches report/filters again before an
  // in-flight request resolves, only the LATEST request's result is ever applied - an older,
  // slower response arriving after a newer one can never overwrite the current report. No
  // AbortController/cancellation - the stale response is just silently ignored, never surfaced
  // as an error.
  const requestIdRef = useRef(0)

  const loadReport = useCallback(async () => {
    // Never call the API for a report this organization's plan doesn't entitle - a direct/typed
    // ?report= query must not even attempt the request, let alone silently fall back to another
    // report (§5).
    if (!isReportEntitled(reportType)) {
      setIsLoading(false)
      setReport(null)
      return
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setLoadError('')
    setReport(null)

    const result = await getReport(reportType, requestParams)
    if (requestIdRef.current !== requestId) return

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return
    }

    if (result.report?.demoUnavailable) {
      setLoadError('demo-unavailable')
      return
    }

    setReport(result.report)
  }, [reportType, requestParams, isReportEntitled])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExport = async (format) => {
    setIsExporting(format)
    setExportError('')

    const { page: _page, page_size: _pageSize, ...exportParams } = requestParams
    const result = await exportReport(reportType, exportParams, format)

    setIsExporting('')

    if (!result.success) {
      setExportError(result.error)
    }
  }

  const rows = Array.isArray(report?.rows) ? report.rows : []
  const columns = useMemo(() => resolveColumns(report, config?.columns || []), [report, config])
  const pagination = report?.pagination
  const total = pagination?.total ?? rows.length
  const totalPages = pagination?.total_pages ?? 1
  const currentPage = pagination?.page ?? page
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * Number(pageSize), total)

  const isDemoUnavailable = loadError === 'demo-unavailable'
  const hasData = config?.isSpecialView === 'pnl'
    ? Object.keys(report?.summary || {}).length > 0
    : rows.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>

      <Card className="p-0">
        <div className="space-y-3 border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ReportSelector value={reportType} onChange={handleReportTypeChange} className="lg:w-72" isVisible={isReportEntitled} />

            <div className="flex flex-wrap items-center gap-2">
              {!config?.noAsOfDate && (
                <>
                  <Select
                    options={PERIOD_OPTIONS}
                    value={period}
                    onChange={(event) => handlePeriodChange(event.target.value)}
                    className="w-44"
                  />
                  {period === 'custom' && (
                    <>
                      <DatePicker value={customFrom} onChange={(value) => { setCustomFrom(value); setPage(1) }} placeholder="From date" className="w-36" />
                      <DatePicker value={customTo} onChange={(value) => { setCustomTo(value); setPage(1) }} placeholder="To date" className="w-36" />
                    </>
                  )}
                </>
              )}

              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search…"
                className="h-10 w-40 rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />

              {config?.groupBy && (
                <Select
                  options={config.groupBy.options}
                  value={groupBy}
                  onChange={(event) => handleGroupByChange(event.target.value)}
                  className="w-40"
                />
              )}

              <Button type="button" variant="outline" size="sm" onClick={loadReport} disabled={isLoading}>
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </Button>

              {config?.filters?.length > 0 && (
                <Button type="button" variant={moreFiltersOpen ? 'secondary' : 'outline'} size="sm" onClick={() => setMoreFiltersOpen((prev) => !prev)}>
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
              )}

              {canExport && !DEMO_MODE && isReportEntitled(reportType) && (
                <>
                  <Button type="button" variant="secondary" size="sm" loading={isExporting === 'pdf'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('pdf')}>
                    <Download className="size-4" aria-hidden="true" />
                    Export PDF
                  </Button>
                  <Button type="button" variant="secondary" size="sm" loading={isExporting === 'excel'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('excel')}>
                    <Download className="size-4" aria-hidden="true" />
                    Export Excel
                  </Button>
                </>
              )}
            </div>
          </div>

          {config?.noAsOfDate && (
            <p className="text-xs font-medium text-neutral-400">Current ageing position - this report reflects balances as of right now, not a historical date range.</p>
          )}
          {config?.valuationNote && (
            <p className="text-xs font-medium text-neutral-400">{config.valuationNote}</p>
          )}

          {moreFiltersOpen && config?.filters?.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
              {config.filters.map((filter) => (
                <ReportFilterControl
                  key={filter.key}
                  filter={filter}
                  value={filters[filter.key]}
                  selectedLabel={filterLabels[filter.key]}
                  onChange={(value, label) => handleFilterChange(filter.key, value, label)}
                  entityOptions={entityOptions}
                  searchEntity={searchEntity}
                />
              ))}
              <button type="button" onClick={handleClearFilters} className="flex h-10 items-center gap-1 px-2 text-sm font-medium text-neutral-500 hover:text-neutral-900">
                <X className="size-3.5" aria-hidden="true" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {exportError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{exportError}</div>
          )}
          {DEMO_MODE && (
            <p className="mb-4 text-xs text-neutral-400">Report export (PDF / Excel) is disabled in demo mode.</p>
          )}

          {!isReportEntitled(reportType) ? (
            <PlanRestricted description={`${config?.label || 'This report'} is not included in your current plan.`} />
          ) : isLoading ? (
            <LoadingSpinner label={`Loading ${config?.label || 'report'}…`} />
          ) : loadError && !isDemoUnavailable ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Couldn't load this report"
              description={loadError}
              action={{ label: 'Try again', onClick: loadReport }}
            />
          ) : isDemoUnavailable ? (
            <EmptyState icon={FileSpreadsheet} title="Not available in demo mode" description="This report isn't simulated in demo mode. Connect the real backend to view it." />
          ) : !hasData ? (
            <EmptyState icon={FileSpreadsheet} title="No report data found" description="No records match the selected filters." />
          ) : (
            <div className="space-y-5">
              <ReportSummaryCards summary={report?.summary} cards={config?.summaryCards || []} />

              {config?.isSpecialView === 'pnl' ? (
                <>
                  <ProfitLossStatement summary={report?.summary} />
                  <ReportChart chart={report?.chart} fallbackTitle={config?.chartTitle} chartKeys={config?.chartKeys} />
                </>
              ) : (
                <>
                  <ReportChart chart={report?.chart} fallbackTitle={config?.chartTitle} chartKeys={config?.chartKeys} />
                  <ReportTable columns={columns} rows={rows} />

                  <div className="flex flex-col items-center justify-between gap-3 pt-1 text-sm text-neutral-500 sm:flex-row">
                    <div className="flex items-center gap-3">
                      <span>Showing <span className="font-semibold text-neutral-900">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-neutral-900">{total}</span></span>
                      <Select
                        options={PAGE_SIZE_OPTIONS}
                        value={pageSize}
                        onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                        triggerClassName="h-8 bg-surface py-1 text-xs"
                        className="w-28"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Previous</button>
                      <span className="min-w-16 text-center font-medium text-neutral-700">{currentPage} / {totalPages || 1}</span>
                      <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ReportFilterControl({ filter, value, selectedLabel, onChange, entityOptions, searchEntity }) {
  if (filter.type === 'toggle') {
    return (
      <label className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
        {filter.label}
      </label>
    )
  }

  if (filter.type === 'text') {
    return (
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={filter.label}
        className="h-10 w-48 rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
      />
    )
  }

  if (filter.type === 'entity') {
    if (SEARCHED_ENTITY_TYPES.has(filter.entity)) {
      return (
        <EntitySearchSelect
          value={value || ''}
          selectedLabel={selectedLabel}
          onChange={onChange}
          fetchOptions={(query) => searchEntity(filter.entity, query)}
          placeholder={filter.label}
          className="w-48"
        />
      )
    }
    const options = [{ value: '', label: `All ${filter.label}s` }, ...(entityOptions[filter.entity] || [])]
    return (
      <Select
        searchable
        options={options}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={filter.label}
        className="w-48"
      />
    )
  }

  // 'select'
  const options = [{ value: '', label: `All ${filter.label}` }, ...filter.options]
  return (
    <Select
      options={options}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className="w-48"
    />
  )
}
