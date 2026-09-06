import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, RotateCw, Search, PackageCheck, Clock, CheckCircle2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={RotateCcw} iconVariant="primary" label="Total Returns" value={String(stats.total)} />
        <StatCard icon={Clock} iconVariant="info" label="Pending" value={String(stats.pending)} />
        <StatCard icon={PackageCheck} iconVariant="warning" label="Received" value={String(stats.received)} />
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
                  placeholder="Search return #, customer or order #"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={SR_STATUS_FILTERS}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
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
                  <p className="mt-1 text-sm text-neutral-500">Raise a return against a delivered order or its invoice.</p>
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Return</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Order / Invoice</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Items</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Return Qty</th>
                  <th className="whitespace-nowrap px-4 py-3">Created</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesReturns.map((salesReturn) => {
                  const meta = srStatusMeta(salesReturn.status)
                  return (
                    <tr
                      key={salesReturn.id}
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(salesReturn.id)}`)}
                      className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-neutral-900">{salesReturn.returnNumber}</p>
                        {salesReturn.creditAmount > 0 && (
                          <p className="mt-0.5 text-xs text-neutral-400">Credit {formatCurrency(salesReturn.creditAmount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{salesReturn.customerName || '—'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">
                        {salesReturn.orderNumber || salesReturn.invoiceNumber || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600">{salesReturn.items.length}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-neutral-900">{totalReturnQty(salesReturn)}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{formatDate(salesReturn.createdAt || salesReturn.returnDate)}</td>
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

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
          <span>
            {filteredSalesReturns.length === 0 ? '0' : `1 to ${filteredSalesReturns.length}`} of {salesReturns.length}
          </span>
          <span>Sales Returns</span>
        </div>
      </Card>
    </div>
  )
}
