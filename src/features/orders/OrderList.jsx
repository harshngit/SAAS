import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock3, Copy, Eye, Pencil, Plus, RotateCw, Search, ShoppingCart, Truck, Wallet } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { RequirePermission } from '../../auth/RequirePermission'
import { listOrders } from '../../api/orders'
import { listDeliveryPartners } from '../../api/deliveries'
import { formatCurrency } from '../../utils/format'
import {
  ORDER_SOURCE_OPTIONS,
  ORDER_STATUS_VARIANT,
  ORDER_TABS,
  formatOrderStatus,
  getDeliveryStatus,
  getOrderActions,
} from './orderHelpers'
import { DEMO_ORDERS_ENABLED, demoOrdersResolved, duplicateDemoOrder, isDemoOrder } from './orderDemoData'

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
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'
  const quotationsBasePath = isSalesPath ? '/sales/quotations' : '/admin/quotations'

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [deliveryPartners, setDeliveryPartners] = useState([])

  const [statusTab, setStatusTab] = useState('all')
  const [deliveryPartnerFilter, setDeliveryPartnerFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listOrders({})
    const demoRows = DEMO_ORDERS_ENABLED ? demoOrdersResolved() : []

    if (!result.success) {
      setOrders(demoRows)
      setListError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    setOrders([...result.orders, ...demoRows])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    let isMounted = true
    listDeliveryPartners().then((result) => {
      if (!isMounted || !result.success) return
      setDeliveryPartners(result.partners)
    })
    return () => { isMounted = false }
  }, [])

  const deliveryPartnerOptions = useMemo(
    () => [{ value: 'all', label: 'All delivery partners' }, ...deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))],
    [deliveryPartners],
  )

  const filteredOrders = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const tab = ORDER_TABS.find((t) => t.value === statusTab)
    return orders.filter((order) => {
      if (tab?.apiStatus && order.status !== tab.apiStatus) return false
      if (deliveryPartnerFilter !== 'all' && order.assignedDeliveryPartnerId !== deliveryPartnerFilter) return false
      if (sourceFilter === 'direct' && order.quotationId) return false
      if (sourceFilter === 'quotation' && !order.quotationId) return false
      if (search && ![order.orderNumber, order.customerName].filter(Boolean).some((v) => String(v).toLowerCase().includes(search))) return false
      return true
    })
  }, [orders, statusTab, deliveryPartnerFilter, sourceFilter, searchTerm])

  const stats = useMemo(
    () => ({
      total: orders.length,
      draft: orders.filter((o) => o.status === 'placed').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      value: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0),
    }),
    [orders],
  )

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(filteredOrders.length, currentPage * pageSize)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">Track order status and delivery separately, end to end.</p>
        </div>
        <RequirePermission module="sales_orders" action="create">
          <Button size="sm" onClick={() => navigate(`${basePath}/create`)} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            New Order
          </Button>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} iconVariant="primary" label="Total Orders" value={stats.total} />
        <StatCard icon={Clock3} iconVariant="warning" label="Draft" value={stats.draft} />
        <StatCard icon={Truck} iconVariant="info" label="Confirmed" value={stats.confirmed} />
        <StatCard icon={Wallet} iconVariant="danger" label="Order Value" value={formatCurrency(stats.value)} />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-wrap gap-5">
            {ORDER_TABS.map((tab) => {
              const isActive = statusTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => { setStatusTab(tab.value); setPage(1) }}
                  className={`relative py-2 text-sm font-medium transition-colors ${isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                  {tab.label}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }}
                placeholder="Search order # or customer"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select options={deliveryPartnerOptions} value={deliveryPartnerFilter} onChange={(event) => { setDeliveryPartnerFilter(event.target.value); setPage(1) }} className="sm:w-52" />
            <Select options={ORDER_SOURCE_OPTIONS} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }} className="sm:w-40" />
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
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
            <EmptyState icon={ShoppingCart} title="No orders match these filters" description="Try a different tab, source, or delivery partner." />
          ) : (
            <table className="w-full min-w-280 text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Order #</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Order Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Items</th>
                  <th className="whitespace-nowrap px-4 py-3">Total</th>
                  <th className="whitespace-nowrap px-4 py-3">Order Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Delivery Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Delivery Partner</th>
                  <th className="whitespace-nowrap px-4 py-3">Source</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  const delivery = getDeliveryStatus(order)
                  const actions = getOrderActions(order, { invoices: order.invoiceId ? [{ id: order.invoiceId }] : [] })
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`${basePath}/${order.id}`)}
                      className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5 font-medium text-neutral-900">
                        {order.orderNumber}
                        {isDemoOrder(order.id) && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-700">{order.customerName || '—'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{formatDate(order.orderDate)}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{order.items.length}</td>
                      <td className="px-4 py-3.5 font-medium text-neutral-700">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'neutral'}>{formatOrderStatus(order.status)}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={delivery.variant}>{delivery.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {order.assignedDeliveryPartnerName ? (
                          <span className="text-neutral-700">{order.assignedDeliveryPartnerName}</span>
                        ) : order.fulfilmentMethod === 'pickup' ? (
                          <span className="text-neutral-400">Self pickup</span>
                        ) : (
                          <span className="text-neutral-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                        {order.quotationId ? (
                          <button
                            type="button"
                            onClick={() => !isDemoOrder(order.id) && navigate(`${quotationsBasePath}/${order.quotationId}`)}
                            className="text-left text-xs font-medium text-primary-600 hover:underline"
                          >
                            Quotation
                            {order.quotationNumber ? <span className="block text-[0.7rem] text-neutral-400">{order.quotationNumber}</span> : null}
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">Direct</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'View', icon: Eye, onClick: () => navigate(`${basePath}/${order.id}`) },
                            ...(actions.includes('edit') ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`${basePath}/${order.id}/edit`) }] : []),
                            ...(actions.includes('duplicate')
                              ? [{
                                  label: 'Duplicate Order',
                                  icon: Copy,
                                  onClick: () =>
                                    isDemoOrder(order.id)
                                      ? navigate(`${basePath}/${duplicateDemoOrder(order)}`)
                                      : navigate(`${basePath}/create?from=${order.id}`),
                                }]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3.5">
          <p className="text-xs text-neutral-400">Showing {rangeStart} to {rangeEnd} of {filteredOrders.length} orders</p>
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
            <span className="px-2 text-sm text-neutral-600">{currentPage} / {totalPages}</span>
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
      </Card>
    </div>
  )
}
