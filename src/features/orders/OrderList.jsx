import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus, RotateCw, Search, ShoppingCart, Truck, Wallet } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { RequirePermission } from '../../auth/RequirePermission'
import { ROLES } from '../../auth/roles'
import { ORDER_STATUS_OPTIONS, listOrders } from '../../api/orders'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { formatCurrency } from '../../utils/format'

const statusTabs = [{ value: 'all', label: 'All' }, ...ORDER_STATUS_OPTIONS]

const statusBadgeVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const pageSize = 10

export default function OrderList() {
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [deliveryPartners, setDeliveryPartners] = useState([])

  const [statusFilter, setStatusFilter] = useState('all')
  const [deliveryPartnerFilter, setDeliveryPartnerFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const params = {}
    if (statusFilter !== 'all') params.status = statusFilter
    if (deliveryPartnerFilter !== 'all') params.assigned_delivery_partner_id = deliveryPartnerFilter
    if (searchTerm.trim()) params.search = searchTerm.trim()

    const result = await listOrders(params)

    if (!result.success) {
      setOrders([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setOrders(result.orders)
    setIsLoading(false)
  }, [statusFilter, deliveryPartnerFilter, searchTerm])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    let isMounted = true

    listUsers().then((result) => {
      if (!isMounted || !result.success) return
      setDeliveryPartners(result.users.map(normalizeApiUser).filter((user) => user.role === ROLES.DELIVERY_PARTNER))
    })

    return () => {
      isMounted = false
    }
  }, [])

  const deliveryPartnerOptions = useMemo(
    () => [{ value: 'all', label: 'All delivery partners' }, ...deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))],
    [deliveryPartners],
  )

  const stats = useMemo(
    () => ({
      totalOrders: orders.length,
      awaitingApproval: orders.filter((order) => order.status === 'awaiting_approval').length,
      processing: orders.filter((order) => order.status === 'processing').length,
      outstandingValue: orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0),
    }),
    [orders],
  )

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = orders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(orders.length, currentPage * pageSize)

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const pages = new Set([1, 2, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages])
    return Array.from(pages).filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  }, [totalPages, currentPage])

  const updateFilter = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">Track, manage, and fulfill customer orders</p>
        </div>
        <RequirePermission module="sales_orders" action="create">
          <Button size="sm" onClick={() => navigate(`${basePath}/create`)} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            New Order
          </Button>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} iconVariant="primary" label="Total Orders" value={stats.totalOrders} />
        <StatCard icon={Clock3} iconVariant="warning" label="Awaiting Approval" value={stats.awaitingApproval} />
        <StatCard icon={Truck} iconVariant="info" label="Processing" value={stats.processing} />
        <StatCard icon={Wallet} iconVariant="danger" label="Order Value" value={formatCurrency(stats.outstandingValue)} />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-wrap gap-5">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => { setStatusFilter(tab.value); setPage(1) }}
                  className={`relative py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {tab.label}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={updateFilter(setSearchTerm)}
                placeholder="Search order #"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select options={deliveryPartnerOptions} value={deliveryPartnerFilter} onChange={updateFilter(setDeliveryPartnerFilter)} className="sm:w-52" />
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadOrders}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading orders..." />
          ) : paginatedOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders match these filters"
              description="Try adjusting the status or delivery partner filters."
            />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Order #</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Items</th>
                  <th className="whitespace-nowrap px-4 py-3">Total</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Fulfilment</th>
                  <th className="whitespace-nowrap px-4 py-3">Delivery Partner</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`${basePath}/${order.id}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5 font-medium text-neutral-900">{order.orderNumber}</td>
                    <td className="px-4 py-3.5 text-neutral-700">{order.customerName}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(order.orderDate)}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{order.items.length}</td>
                    <td className="px-4 py-3.5 font-medium text-neutral-700">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusBadgeVariant[order.status] || 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{order.fulfilmentStatus.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5">
                      {order.assignedDeliveryPartnerName ? (
                        <span className="text-neutral-700">{order.assignedDeliveryPartnerName}</span>
                      ) : (
                        <span className="text-neutral-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[{ label: 'View', icon: ShoppingCart, onClick: () => navigate(`${basePath}/${order.id}`) }]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3.5">
          <p className="text-xs text-neutral-400">
            Showing {rangeStart} to {rangeEnd} of {orders.length} orders
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700">
              10 / page <ChevronDown className="size-3.5" />
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              {pageNumbers.map((pageNumber, index) => {
                const previous = pageNumbers[index - 1]
                const showEllipsis = previous != null && pageNumber - previous > 1

                return (
                  <span key={pageNumber} className="flex items-center gap-1.5">
                    {showEllipsis && <span className="px-1 text-neutral-300">…</span>}
                    <button
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`flex size-8 items-center justify-center rounded-full text-sm ${
                        pageNumber === currentPage ? 'bg-primary-700 text-white' : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  </span>
                )
              })}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
