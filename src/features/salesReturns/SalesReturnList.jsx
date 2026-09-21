import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X, Plus, RotateCcw, RotateCw, Search, PackageCheck, Clock, CheckCircle2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { usePermission } from '../../auth/usePermission'
import { listSalesReturns } from '../../api/salesReturns'
import { SALES_RETURNS_DEMO_ENABLED, getDemoSalesReturns } from './salesReturnDemoData'
import { SR_STATUS_FILTERS, rawStatusForFilter, srStatusMeta, totalReturnQty } from './salesReturnHelpers'
import { formatCurrency } from '../../utils/format'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function SalesReturnList() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { can } = usePermission()
  const canCreate = can('sales_returns', 'create')
  const basePath = pathname.startsWith('/sales') ? '/sales/sales-returns' : '/admin/sales-returns'

  const [salesReturns, setSalesReturns] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterTriggerRef = useRef(null)
  const filterCloseRef = useRef(null)

  useEffect(() => {
    if (!isFilterOpen) return
    const trigger = filterTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    filterCloseRef.current?.focus()
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsFilterOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      trigger?.focus()
    }
  }, [isFilterOpen])


  const loadSalesReturns = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Explicit demo mode: demo returns only, no real API call.
    if (SALES_RETURNS_DEMO_ENABLED) {
      setSalesReturns(getDemoSalesReturns())
      setIsLoading(false)
      return
    }

    const rawStatus = statusFilter === 'all' ? null : rawStatusForFilter(statusFilter)
    const result = await listSalesReturns(rawStatus ? { status: rawStatus } : {})

    if (!result.success) {
      setSalesReturns([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setSalesReturns(result.salesReturns)
    setIsLoading(false)
  }, [statusFilter])

  useEffect(() => {
    loadSalesReturns()
  }, [loadSalesReturns])

  const stats = useMemo(() => {
    const by = (key) => salesReturns.filter((sr) => srStatusMeta(sr.status).key === key).length
    return { total: salesReturns.length, pending: by('pending'), received: by('received'), completed: by('completed') }
  }, [salesReturns])

  const filteredSalesReturns = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return salesReturns.filter((salesReturn) => {
      const matchesStatus =
        statusFilter === 'all' || srStatusMeta(salesReturn.status).key === statusFilter
      const matchesSearch =
        !search ||
        [salesReturn.returnNumber, salesReturn.customerName, salesReturn.invoiceNumber, salesReturn.orderNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      return matchesStatus && matchesSearch
    })
  }, [salesReturns, searchTerm, statusFilter])

  return (
    <div className="listing-page space-y-4">

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Sales Returns</h1>
              <p className="mt-1 text-xs text-neutral-400">{filteredSalesReturns.length} returns in view</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search return #, customer or order #"
                  aria-label="Search return number, customer or order number"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Button ref={filterTriggerRef} type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)} aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="sales-return-filter-panel">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filter
              </Button>
              {canCreate && (
                <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
                  <Plus className="size-4" aria-hidden="true" />
                  New Return
                </Button>
              )}
            </div>
          </div>
          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Returns', value: stats.total, detail: 'recorded returns', icon: RotateCcw },
              { label: 'Pending', value: stats.pending, detail: 'pending returns', icon: Clock },
              { label: 'Received', value: stats.received, detail: 'received returns', icon: PackageCheck },
              { label: 'Completed', value: stats.completed, detail: 'completed returns', icon: CheckCircle2 },
            ].map(({ label, value, detail, icon: Icon }, index) => (
              <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-[#6b86ad]">{label}</p>
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
                <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadSalesReturns}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading sales returns..." />
          ) : filteredSalesReturns.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">
                {salesReturns.length === 0 ? 'No sales returns yet.' : 'No returns match these filters.'}
              </p>
              {salesReturns.length === 0 && (
                <>
                  <p className="mt-1 text-xs text-neutral-400">Raise a return against a delivered order or its invoice.</p>
                  {canCreate && (
                    <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                      <Plus className="size-4" aria-hidden="true" />
                      New Return
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <table className="listing-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="whitespace-nowrap px-6 py-6">Return</th>
                  <th className="whitespace-nowrap px-6 py-6">Customer</th>
                  <th className="whitespace-nowrap px-6 py-6">Order / Invoice</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Items</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Return Qty</th>
                  <th className="whitespace-nowrap px-6 py-6">Created</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSalesReturns.map((salesReturn) => {
                  const meta = srStatusMeta(salesReturn.status)
                  return (
                    <tr
                      key={salesReturn.id}
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(salesReturn.id)}`)}
                      className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                    >
                      <td className="px-6 py-5">
                        <p className="font-semibold text-neutral-900">{salesReturn.returnNumber}</p>
                        {salesReturn.creditAmount > 0 && (
                          <p className="mt-0.5 text-xs text-neutral-400">Credit {formatCurrency(salesReturn.creditAmount)}</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-neutral-600">{salesReturn.customerName || '—'}</td>
                      <td className="px-6 py-5 text-neutral-600">
                        {salesReturn.orderNumber || salesReturn.invoiceNumber || '—'}
                      </td>
                      <td className="px-6 py-5 text-right text-neutral-600">{salesReturn.items.length}</td>
                      <td className="px-6 py-5 text-right font-medium text-neutral-900">{totalReturnQty(salesReturn)}</td>
                      <td className="px-6 py-5 text-neutral-600">{formatDate(salesReturn.createdAt || salesReturn.returnDate)}</td>
                      <td className="px-6 py-5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
          <span>
            {filteredSalesReturns.length === 0 ? '0' : `1 to ${filteredSalesReturns.length}`} of {salesReturns.length}
          </span>
          <span>Sales Returns</span>
        </div>
      </Card>
      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="sales-return-filter-title" id="sales-return-filter-panel">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" tabIndex={-1} />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 id="sales-return-filter-title" className="text-lg font-semibold text-neutral-900">Filter Sales Returns</h2>
                <p className="mt-0.5 text-xs text-neutral-400">Refine the returns shown in the table.</p>
              </div>
              <button ref={filterCloseRef} type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close filters">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <Select label="Status" options={SR_STATUS_FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <button type="button" onClick={() => { setStatusFilter('all'); setSearchTerm('') }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
              <Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
