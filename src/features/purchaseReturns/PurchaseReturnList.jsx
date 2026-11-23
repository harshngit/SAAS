import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Truck, CheckCircle2, PackageX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import PaginationFooter from '../../components/ui/PaginationFooter'
import { useSortState } from '../../hooks/useSortState'
import { ListOverview, ListSummary, ListTableToolbar, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { usePermission } from '../../auth/usePermission'
import { PURCHASE_RETURNS_DEMO_ENABLED, getDemoPurchaseReturns } from './purchaseReturnDemoData'
import { listPurchaseReturns } from '../../api/purchaseReturns'
import { listSuppliers } from '../../api/suppliers'
import { PR_STATUS_FILTERS, prStatusMeta, totalReturnQty } from './purchaseReturnHelpers'
import { resolveDateRange } from '../../utils/dateRange'

const basePath = '/admin/purchase-returns'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}


export default function PurchaseReturnList() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('purchases', 'create')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')

  const [realReturns, setRealReturns] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(!PURCHASE_RETURNS_DEMO_ENABLED)
  const [loadError, setLoadError] = useState('')
  const [realStats, setRealStats] = useState(null)
  const [supplierOptions, setSupplierOptions] = useState([{ value: 'all', label: 'All suppliers' }])
  const { sortBy, sortOrder, toggleSort, sortParams } = useSortState()

  const handleSort = (field) => {
    toggleSort(field)
    setPage(1)
  }

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const appliedFilters = { statusFilter, supplierFilter, datePreset, customFrom, customTo }
  const defaultFilters = { statusFilter: 'all', supplierFilter: 'all', datePreset: 'all', customFrom: '', customTo: '' }
  const applyFilters = (next) => {
    setStatusFilter(next.statusFilter)
    setSupplierFilter(next.supplierFilter)
    setDatePreset(next.datePreset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
    setPage(1)
  }

  // Supplier dropdown options - one lookup call for the whole list, not per row.
  useEffect(() => {
    if (PURCHASE_RETURNS_DEMO_ENABLED) return
    listSuppliers().then((result) => {
      if (!result.success) return
      setSupplierOptions([
        { value: 'all', label: 'All suppliers' },
        ...result.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
      ])
    })
  }, [])

  // Debounce free-text search before it drives a server request - avoids one request per keystroke.
  // Page resets to 1 in the same tick the debounce fires, so loadReal never runs once for a stale
  // page and again for page 1.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(handle)
  }, [searchTerm])

  const loadReal = useCallback(async () => {
    if (PURCHASE_RETURNS_DEMO_ENABLED) return
    setIsLoading(true)
    setLoadError('')

    const result = await listPurchaseReturns({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: debouncedSearch || undefined,
      page,
      pageSize: Number(pageSize),
      ...sortParams,
    })

    if (!result.success) {
      setRealReturns([])
      setTotal(0)
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setRealReturns(result.purchaseReturns)
    setTotal(result.total ?? result.purchaseReturns.length)
    setIsLoading(false)
  }, [statusFilter, supplierFilter, dateFrom, dateTo, debouncedSearch, page, pageSize, sortParams])

  useEffect(() => {
    loadReal()
  }, [loadReal])

  // Status-bucket counts for the stat cards, independent of the current page/filter - a handful of
  // page_size=1 requests read each bucket's backend `total`, not derived from whatever page is loaded.
  const loadRealStats = useCallback(async () => {
    if (PURCHASE_RETURNS_DEMO_ENABLED) return
    const [all, draft, confirmed, dispatched, completed] = await Promise.all([
      listPurchaseReturns({ pageSize: 1 }),
      listPurchaseReturns({ status: 'draft', pageSize: 1 }),
      listPurchaseReturns({ status: 'confirmed', pageSize: 1 }),
      listPurchaseReturns({ status: 'dispatched', pageSize: 1 }),
      listPurchaseReturns({ status: 'completed', pageSize: 1 }),
    ])
    setRealStats({
      total: all.success ? all.total ?? 0 : 0,
      draft: draft.success ? draft.total ?? 0 : 0,
      inProgress: (confirmed.success ? confirmed.total ?? 0 : 0) + (dispatched.success ? dispatched.total ?? 0 : 0),
      completed: completed.success ? completed.total ?? 0 : 0,
    })
  }, [])

  useEffect(() => {
    loadRealStats()
  }, [loadRealStats])

  const demoReturns = useMemo(() => (PURCHASE_RETURNS_DEMO_ENABLED ? getDemoPurchaseReturns() : []), [])
  const returns = PURCHASE_RETURNS_DEMO_ENABLED ? demoReturns : realReturns

  const stats = useMemo(() => {
    if (!PURCHASE_RETURNS_DEMO_ENABLED) {
      return realStats || { total: '—', draft: '—', inProgress: '—', completed: '—' }
    }
    const by = (key) => returns.filter((pr) => prStatusMeta(pr.status).key === key).length
    return {
      total: returns.length,
      draft: by('draft'),
      inProgress: by('confirmed') + by('dispatched'),
      completed: by('completed'),
    }
  }, [returns, realStats])

  const filtered = useMemo(() => {
    if (!PURCHASE_RETURNS_DEMO_ENABLED) return returns // already filtered + paginated server-side
    const search = searchTerm.trim().toLowerCase()
    return returns.filter((pr) => {
      const matchesStatus = statusFilter === 'all' || prStatusMeta(pr.status).key === statusFilter
      const matchesSearch =
        !search ||
        [pr.returnNumber, pr.supplierName, pr.purchaseNumber, pr.grnNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      return matchesStatus && matchesSearch
    })
  }, [returns, searchTerm, statusFilter])

  const effectiveTotal = PURCHASE_RETURNS_DEMO_ENABLED ? filtered.length : total

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Purchase Returns</h1>
      </div>

      <ListOverview>
        <ListSummary loading={isLoading} className="grid-cols-2 lg:grid-cols-4">
          <StatCard icon={RotateCcw} label="Total Returns" value={String(stats.total)} />
          <StatCard icon={PackageX} label="Draft" value={String(stats.draft)} />
          <StatCard icon={Truck} label="In Progress" value={String(stats.inProgress)} />
          <StatCard icon={CheckCircle2} label="Completed" value={String(stats.completed)} />
        </ListSummary>
      </ListOverview>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100">
          <ListTableToolbar
            title="Purchase Returns"
            subtitle="Goods sent back to suppliers"
            search={searchTerm}
            onSearchChange={(event) => setSearchTerm(event.target.value)}
            searchPlaceholder="Search return #, supplier, purchase # or GRN #"
            resultCount={effectiveTotal}
            actions={(
              <>
                <ListFilterPanel title="Filter Purchase Returns" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters}>
                  {({ draft, set, errors }) => (
                    <>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                        <Select options={PR_STATUS_FILTERS} value={draft.statusFilter} onChange={(event) => set('statusFilter', event.target.value)} />
                      </label>
                      {!PURCHASE_RETURNS_DEMO_ENABLED && (
                        <>
                          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Supplier
                            <Select options={supplierOptions} value={draft.supplierFilter} onChange={(event) => set('supplierFilter', event.target.value)} />
                          </label>
                          <FilterDateRange label="Return Date" draft={draft} set={set} errors={errors} />
                        </>
                      )}
                    </>
                  )}
                </ListFilterPanel>
                {canCreate && (
                  <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
                    <Plus className="size-4" aria-hidden="true" />
                    New Return
                  </Button>
                )}
              </>
            )}
          />
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          {isLoading ? (
            <div className="py-10">
              <LoadingSpinner variant="table" columns={["Return", "Supplier", "Purchase / GRN", "Items", "Return Qty", "Return Date", "Status"]} label="Loading purchase returns..." />
            </div>
          ) : loadError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadReal}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">
                {returns.length === 0 ? 'No purchase returns yet.' : 'No returns match these filters.'}
              </p>
              {returns.length === 0 && canCreate && (
                <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                  <Plus className="size-4" aria-hidden="true" />
                  New Return
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold text-neutral-400">
                  <SortableHeaderCell label="Return" sortKey="return_number" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                  <SortableHeaderCell label="Supplier" sortKey="supplier" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                  <th className="whitespace-nowrap px-4 py-3">Purchase / GRN</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Items</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Return Qty</th>
                  <SortableHeaderCell label="Return Date" sortKey="return_date" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                  <SortableHeaderCell label="Status" sortKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pr) => {
                  const meta = prStatusMeta(pr.status)
                  return (
                    <tr
                      key={pr.id}
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(pr.id)}`)}
                      className="cursor-pointer bg-surface shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5 font-semibold text-neutral-900">{pr.returnNumber}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{pr.supplierName || '—'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">
                        {pr.purchaseNumber || '—'}
                        {pr.grnNumber ? <span className="text-neutral-400"> · {pr.grnNumber}</span> : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600">{pr.items.length}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-neutral-900">{pr.totalReturnQty ?? totalReturnQty(pr)}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{formatDate(pr.returnDate)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {PURCHASE_RETURNS_DEMO_ENABLED ? (
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
            <span>{filtered.length === 0 ? '0' : `1 to ${filtered.length}`} of {returns.length}</span>
            <span>Purchase Returns · demo</span>
          </div>
        ) : (
          <PaginationFooter page={page} pageSize={Number(pageSize)} total={total} onPageChange={setPage} onPageSizeChange={(next) => { setPageSize(String(next)); setPage(1) }} />
        )}
      </Card>
    </div>
  )
}
