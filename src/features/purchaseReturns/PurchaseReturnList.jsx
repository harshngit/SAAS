import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Search, Truck, CheckCircle2, PackageX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
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

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
]

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

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const hasExtraFilters = supplierFilter !== 'all' || datePreset !== 'all'
  const clearExtraFilters = () => {
    setSupplierFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
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
  }, [statusFilter, supplierFilter, dateFrom, dateTo, debouncedSearch, page, pageSize])

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
    if (!PURCHASE_RETURNS_DEMO_ENABLED && realStats) return realStats
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
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / Number(pageSize)))
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * Number(pageSize) + 1
  const rangeEnd = PURCHASE_RETURNS_DEMO_ENABLED ? filtered.length : Math.min(effectiveTotal, (page - 1) * Number(pageSize) + filtered.length)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={RotateCcw} iconVariant="primary" label="Total Returns" value={String(stats.total)} />
        <StatCard icon={PackageX} iconVariant="neutral" label="Draft" value={String(stats.draft)} />
        <StatCard icon={Truck} iconVariant="warning" label="In Progress" value={String(stats.inProgress)} />
        <StatCard icon={CheckCircle2} iconVariant="success" label="Completed" value={String(stats.completed)} />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search return #, supplier, purchase # or GRN #"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={PR_STATUS_FILTERS}
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
              {!PURCHASE_RETURNS_DEMO_ENABLED && (
                <ListFilterPanel title="Filter Purchase Returns">
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Supplier
                    <Select options={supplierOptions} value={supplierFilter} onChange={(event) => { setSupplierFilter(event.target.value); setPage(1) }} />
                  </label>
                  <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Return Date
                    <DateRangeFilter preset={datePreset} onPresetChange={(value) => { setDatePreset(value); setPage(1) }} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to); setPage(1) }} />
                  </div>
                  {hasExtraFilters && (
                    <button type="button" onClick={clearExtraFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
                  )}
                </ListFilterPanel>
              )}
            </div>
            {canCreate && (
              <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                New Return
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          {isLoading ? (
            <div className="py-10">
              <LoadingSpinner label="Loading purchase returns..." />
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
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Return</th>
                  <th className="whitespace-nowrap px-4 py-3">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3">Purchase / GRN</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Items</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Return Qty</th>
                  <th className="whitespace-nowrap px-4 py-3">Return Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span>
                Showing <span className="font-semibold text-neutral-700">{rangeStart}-{rangeEnd}</span> of{' '}
                <span className="font-semibold text-neutral-700">{total}</span>
              </span>
              <span className="hidden text-neutral-300 sm:inline">|</span>
              <label className="flex items-center gap-2">Rows per page
                <Select
                  options={PAGE_SIZE_OPTIONS}
                  value={pageSize}
                  onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                  className="w-20"
                  triggerClassName="h-8 bg-surface py-1 text-xs"
                />
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-14 text-center text-xs font-medium text-neutral-700">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
