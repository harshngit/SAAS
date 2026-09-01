import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RotateCw, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { SALES_RETURN_STATUS_OPTIONS, listSalesReturns } from '../../api/salesReturns'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  requested: 'info',
  received: 'warning',
  approved: 'success',
  rejected: 'danger',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const basePath = '/admin/sales-returns'

export default function SalesReturnList() {
  const navigate = useNavigate()
  const [salesReturns, setSalesReturns] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadSalesReturns = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listSalesReturns(statusFilter === 'all' ? {} : { status: statusFilter })

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

  const filteredSalesReturns = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return salesReturns.filter((salesReturn) => {
      const matchesSearch =
        !search ||
        [salesReturn.returnNumber, salesReturn.customerName, salesReturn.invoiceNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))

      return matchesSearch
    })
  }, [salesReturns, searchTerm])

  return (
    <div className="space-y-5">
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
                  placeholder="Search sales returns"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={[{ value: 'all', label: 'All status' }, ...SALES_RETURN_STATUS_OPTIONS]}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
            </div>
            <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
              <Plus className="size-4" aria-hidden="true" />
              New Return
            </Button>
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
              <p className="text-sm font-medium text-neutral-900">No sales returns found</p>
              <p className="mt-1 text-sm text-neutral-500">Raise a return request against an existing invoice.</p>
              <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                New Return
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Return</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Invoice</th>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Credit Amount</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesReturns.map((salesReturn) => (
                  <tr
                    key={salesReturn.id}
                    onClick={() => navigate(`${basePath}/${encodeURIComponent(salesReturn.id)}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-neutral-900">{salesReturn.returnNumber}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{salesReturn.items.length} item(s)</p>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{salesReturn.customerName || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{salesReturn.invoiceNumber || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(salesReturn.returnDate)}</td>
                    <td className="px-4 py-3.5 font-medium text-neutral-900">{formatCurrency(salesReturn.creditAmount)}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusVariant[salesReturn.status] || 'neutral'}>{salesReturn.status}</Badge>
                    </td>
                  </tr>
                ))}
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
