import NumericInput from '../../components/ui/NumericInput'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { exportReport, exportReportRow, getReport } from '../../api/reports'
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
import ReportKpiRow from './components/ReportKpiRow'
import GstSplitSummary from './components/GstSplitSummary'
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
  defaultReport = DEFAULT_REPORT,
  // Pins this page to exactly `defaultReport` - no Report Type switcher, and a crafted
  // ?report=... in the URL is ignored. Needed wherever this component is reached through a
  // permission gate NARROWER than the generic Reports page's own `module="reports"` (e.g.
  // /accounts/gst's module="gst") - without this, the in-page switcher would let a role with
  // only that narrower permission view every OTHER report too, which "reports" alone gates.
  lockReportType = false,
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
  const initialType = lockReportType
    ? (getReportConfig(defaultReport) ? defaultReport : DEFAULT_REPORT)
    : getReportConfig(searchParams.get('report'))
      ? searchParams.get('report')
      : getReportConfig(defaultReport)
        ? defaultReport
        : DEFAULT_REPORT
  const [reportType, setReportType] = useState(initialType)
  const config = getReportConfig(reportType)

  const [period, setPeriod] = useState(searchParams.get('period') || 'monthly')
  // dateFrom/dateTo/filters are the APPLIED values (what the request actually uses). The Filter
  // drawer edits a private draft and only commits here when Apply Filters is pressed.
  const initialRange = getDateRangeForPeriod(searchParams.get('period') || 'monthly', '', '')
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filterLabels, setFilterLabels] = useState({})
  // Lets the toolbar's Period dropdown open the Filter drawer (on Custom Range) without owning it.
  const [openRequest, setOpenRequest] = useState(null)
  const [groupBy, setGroupBy] = useState(() => resolveValidGroupBy(getReportConfig(initialType), searchParams.get('group_by')))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')

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

  const writePeriodParam = (value) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('period', value)
    setSearchParams(nextParams, { replace: true })
  }

  // The toolbar's quick-select period applies immediately for the fixed presets (Today, Last 7 Days,
  // This Month...). Custom Range needs two dates, so it opens the Filter drawer with Custom selected
  // instead - nothing changes until From/To are chosen and Apply Filters is pressed.
  const handlePeriodChange = (value) => {
    if (value === 'custom') {
      setOpenRequest({ id: Date.now(), patch: { period: 'custom' } })
      return
    }
    setPeriod(value)
    const range = getDateRangeForPeriod(value, '', '')
    setDateFrom(range.dateFrom)
    setDateTo(range.dateTo)
    setPage(1)
    writePeriodParam(value)
  }

  const handleGroupByChange = (value) => {
    setGroupBy(value)
    setPage(1)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('group_by', value)
    setSearchParams(nextParams, { replace: true })
  }

  const filterDefinitions = config?.filters || []
  const showPeriod = !config?.noAsOfDate
  const periodKeys = { preset: 'period', from: 'customFrom', to: 'customTo' }
  const defaultFilters = {
    ...(showPeriod ? { period: 'monthly', customFrom: '', customTo: '' } : {}),
    labels: {},
    ...Object.fromEntries(filterDefinitions.map((filter) => [filter.key, filter.type === 'toggle' ? false : ''])),
  }
  const appliedFilters = {
    ...(showPeriod ? { period, customFrom: period === 'custom' ? dateFrom : '', customTo: period === 'custom' ? dateTo : '' } : {}),
    labels: filterLabels,
    ...Object.fromEntries(filterDefinitions.map((filter) => [filter.key, filters[filter.key] ?? (filter.type === 'toggle' ? false : '')])),
  }

  // Apply Filters (and Clear Filters, which passes the defaults): commit the draft in one go and go
  // back to page 1. The request only ever sees a complete, validated date range.
  const applyFilters = (next) => {
    if (showPeriod) {
      setPeriod(next.period)
      if (next.period === 'custom') {
        setDateFrom(next.customFrom)
        setDateTo(next.customTo)
      } else {
        const range = getDateRangeForPeriod(next.period, '', '')
        setDateFrom(range.dateFrom)
        setDateTo(range.dateTo)
      }
      writePeriodParam(next.period)
    }
    const nextFilters = {}
    filterDefinitions.forEach((filter) => {
      const value = next[filter.key]
      if (value !== undefined && value !== '' && value !== false) nextFilters[filter.key] = value
    })
    setFilters(nextFilters)
    setFilterLabels(next.labels || {})
    setPage(1)
  }

  // Keeps local state in sync with the URL for navigation this component didn't itself trigger
  // (browser back/forward, a pasted link, a direct refresh on e.g. ?report=sales&group_by=junk) -
  // the handlers above already apply the same reset synchronously, so when THEY are the cause of
  // a searchParams change, reportType/groupBy already match by the time this runs and it's a no-op.
  useEffect(() => {
    const urlReport = searchParams.get('report')
    const nextType = lockReportType ? defaultReport : getReportConfig(urlReport) ? urlReport : DEFAULT_REPORT
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
      if (urlPeriod !== 'custom') {
        const range = getDateRangeForPeriod(urlPeriod, '', '')
        setDateFrom(range.dateFrom)
        setDateTo(range.dateTo)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Every param here is scoped to what THIS report actually supports - never one giant object
  // blindly spread onto every report type. `filters` itself can only ever hold keys from the
  // current report's own config.filters (set via handleDraftFilterChange, cleared on report
  // switch), `search` is only included when the report's own config opts in, and `group_by` is
  // either the user-selectable dropdown value (Sales/Purchase) or a report's own fixed value
  // (e.g. GST's permanent `group_by=transaction` for its transaction-level table) - never both
  // at once since a report config never defines both mechanisms.
  const requestParams = useMemo(() => {
    const params = { ...filters, page, page_size: Number(pageSize) }
    if (config?.supportsSearch !== false && search) params.search = search
    if (groupBy) params.group_by = groupBy
    if (!config?.noAsOfDate) {
      params.date_from = dateFrom
      params.date_to = dateTo
    }
    if (config?.fixedParams) Object.assign(params, config.fixedParams)
    return params
  }, [filters, search, page, pageSize, groupBy, config, dateFrom, dateTo])

  // Guards against out-of-order responses: if the user switches report/filters again before an
  // in-flight request resolves, only the LATEST request's result is ever applied - an older,
  // slower response arriving after a newer one can never overwrite the current report. No
  // AbortController/cancellation - the stale response is just silently ignored, never surfaced
  // as an error.
  const requestIdRef = useRef(0)

  // Some reports (notes-to-pl's line_item, notes-to-balance-sheet's schedule) 400 without a
  // required selector value - never guessed/defaulted here, only ever the value the user picked
  // in the (always-visible) filter panel.
  const missingRequiredFilter = Boolean(config?.requiredFilterKey) && !filters[config.requiredFilterKey]

  const loadReport = useCallback(async () => {
    // Never call the API for a report this organization's plan doesn't entitle - a direct/typed
    // ?report= query must not even attempt the request, let alone silently fall back to another
    // report (§5).
    if (!isReportEntitled(reportType)) {
      setIsLoading(false)
      setReport(null)
      return
    }

    if (config?.requiredFilterKey && !filters[config.requiredFilterKey]) {
      setIsLoading(false)
      setLoadError('')
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
      // A 400 here means the request sent a filter this report doesn't support - should be
      // prevented by reportConfig's own per-report filter scoping, but if it ever happens, this
      // reads as an honest, actionable message rather than raw backend JSON.
      setLoadError(result.status === 400 ? 'One or more selected filters are not supported for this report.' : result.error)
      return
    }

    if (result.report?.demoUnavailable) {
      setLoadError('demo-unavailable')
      return
    }

    setReport(result.report)
  }, [reportType, requestParams, isReportEntitled, config, filters])

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
      setExportError(result.status === 400 ? 'One or more selected filters are not supported for this report.' : result.error)
    }
  }

  const rawRows = Array.isArray(report?.rows) ? report.rows : []
  // A report can add row fields the API does not send (GST: unsplit_tax_amount) through its config.normalizeRow.
  const rows = useMemo(() => (config?.normalizeRow ? rawRows.map(config.normalizeRow) : rawRows), [rawRows, config])
  const columns = useMemo(() => resolveColumns(report, config?.columns || [], config?.extraColumns || []), [report, config])

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

  // Statement-style reports (balance-sheet, notes-to-balance-sheet) explicitly opt out - their
  // rows are line items, not individually-exportable documents, and have no confirmed id field.
  const rowExportEnabled = config?.supportsRowExport !== false

  const resolveRowId = useCallback(
    (row) => {
      if (!rowExportEnabled) return null
      if (typeof config?.resolveRowId === 'function') return config.resolveRowId(row)
      if (config?.rowIdKey) return row[config.rowIdKey] ?? null
      return row.id ?? null
    },
    [config, rowExportEnabled],
  )

  const handleExportRow = async (row, format) => {
    const rowId = resolveRowId(row)
    if (!rowId) {
      setExportError('This row cannot be exported individually.')
      return
    }
    const { page: _page, page_size: _pageSize, ...exportParams } = requestParams
    const result = await exportReportRow(reportType, rowId, exportParams, format)
    if (!result.success) {
      setExportError(
        result.status === 404
          ? "Couldn't export this row — please refresh the report and try again."
          : result.error,
      )
    }
  }

  // The backend's own honesty signal for Balance Sheet (and, generically, any other report that
  // sends it) - never hidden/suppressed, shown exactly as the backend worded it.
  const completenessStatus = report?.summary?.completeness_status ?? report?.meta?.completeness?.status
  const completenessMessage = report?.summary?.completeness_message ?? report?.meta?.completeness?.message

  const exportButtons = canExport && !DEMO_MODE && isReportEntitled(reportType) && (
    <>
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" loading={isExporting === 'pdf'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('pdf')}>
        <Download className="size-4" aria-hidden="true" />
        Export PDF
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" loading={isExporting === 'excel'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('excel')}>
        <Download className="size-4" aria-hidden="true" />
        Export Excel
      </Button>
    </>
  )

  const filterPanel = (showPeriod || filterDefinitions.length > 0) && (
    <ListFilterPanel
      title="Filter Report"
      applied={appliedFilters}
      defaults={defaultFilters}
      onApply={applyFilters}
      dateKeys={showPeriod ? periodKeys : []}
      ignoreKeys={['labels']}
      openRequest={openRequest}
    >
      {({ draft, set, errors }) => (
        <>
          {showPeriod && <FilterDateRange label="Period" draft={draft} set={set} errors={errors} keys={periodKeys} options={PERIOD_OPTIONS} />}
          {filterDefinitions.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              {filter.type !== 'toggle' && <span>{filter.label}</span>}
              <ReportFilterControl
                filter={filter}
                value={draft[filter.key]}
                selectedLabel={draft.labels?.[filter.key]}
                onChange={(value, label) => set({ [filter.key]: value, ...(label !== undefined ? { labels: { ...(draft.labels || {}), [filter.key]: label } } : {}) })}
                entityOptions={entityOptions}
                searchEntity={searchEntity}
              />
            </div>
          ))}
        </>
      )}
    </ListFilterPanel>
  )

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        <p className="mt-1 text-xs text-neutral-400">{description}</p>
      </div>

      {isReportEntitled(reportType) && config?.isSpecialView !== 'pnl' && (config?.summaryCards?.length || 0) > 0 && (
        <ReportKpiRow summary={report?.summary} cards={config?.summaryCards || []} loading={isLoading && !report} />
      )}

      <Card className="overflow-hidden p-0">
        <div className="space-y-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              {lockReportType ? (
                <h2 className="font-(--font-display) text-base font-semibold tracking-tight text-neutral-900">{config?.label || title}</h2>
              ) : (
                <ReportSelector value={reportType} onChange={handleReportTypeChange} className="lg:w-64" isVisible={isReportEntitled} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {showPeriod && (
                <Select
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={(event) => handlePeriodChange(event.target.value)}
                  className="w-36"
                  triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs"
                />
              )}

              {config?.supportsSearch !== false && (
                <div className="relative w-full sm:w-48">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search report..."
                    aria-label="Search report"
                    className="h-9 w-full rounded-xl border border-neutral-200 bg-surface py-1.5 pl-9 pr-3 text-xs text-neutral-700 shadow-(--shadow-xs) transition-colors placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
              )}

              {config?.groupBy && (
                <Select
                  options={config.groupBy.options}
                  value={groupBy}
                  onChange={(event) => handleGroupByChange(event.target.value)}
                  className="w-40"
                  triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs"
                />
              )}

              {filterPanel}

              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={loadReport} disabled={isLoading}>
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </Button>

              {exportButtons}
            </div>
          </div>

          {config?.noAsOfDate && (
            <p className="text-xs font-medium text-neutral-400">Current ageing position - this report reflects balances as of right now, not a historical date range.</p>
          )}
          {config?.valuationNote && (
            <p className="text-xs font-medium text-neutral-400">{config.valuationNote}</p>
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
            <LoadingSpinner variant="report" columns={columns} stats={config?.summaryCards?.length || 0} chart label={`Loading ${config?.label || 'report'}…`} />
          ) : loadError && !isDemoUnavailable ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Couldn't load this report"
              description={loadError}
              action={{ label: 'Try again', onClick: loadReport }}
            />
          ) : isDemoUnavailable ? (
            <EmptyState icon={FileSpreadsheet} title="Not available in demo mode" description="This report isn't simulated in demo mode. Connect the real backend to view it." />
          ) : missingRequiredFilter ? (
            <EmptyState icon={FileSpreadsheet} title="Select a filter to continue" description={config?.requiredFilterPrompt || 'This report needs one more selection before it can load.'} />
          ) : !hasData ? (
            <EmptyState icon={FileSpreadsheet} title="No report data found" description="No records match the selected filters." />
          ) : (
            <div className="space-y-5">
              {completenessStatus && completenessStatus !== 'complete' && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{completenessMessage || 'This statement is not yet based on complete operational records.'}</span>
                </div>
              )}

              {reportType === 'gst-summary' && <GstSplitSummary summary={report?.summary} />}

              {config?.isSpecialView === 'pnl' ? (
                <>
                  <ProfitLossStatement summary={report?.summary} reportType={reportType} requestParams={requestParams} />
                  <ReportChart chart={report?.chart} fallbackTitle={config?.chartTitle} chartKeys={config?.chartKeys} />
                </>
              ) : (
                <>
                  <ReportChart chart={report?.chart} fallbackTitle={config?.chartTitle} chartKeys={config?.chartKeys} />

                  <ReportTable
                    columns={columns}
                    rows={rows}
                    sortable
                    resolveRowId={rowExportEnabled ? resolveRowId : undefined}
                    onExportRow={rowExportEnabled ? handleExportRow : undefined}
                  />

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
        className="h-10 w-full rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
      />
    )
  }

  if (filter.type === 'date') {
    return <DatePicker label={filter.label} value={value || ''} onChange={onChange} placeholder={filter.label} className="w-full" />
  }

  if (filter.type === 'number') {
    return (
      <NumericInput
        type="number"
        min="0"
        step="any"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={filter.label}
        aria-label={filter.label}
        className="h-10 w-full rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
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
          className="w-full"
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
        className="w-full"
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
      className="w-full"
    />
  )
}
