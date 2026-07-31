import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, Clock3, IndianRupee, Plus, Search, ShoppingCart, Wallet } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { ORDER_STATUSES, orderStatusBadgeVariant, orders as seedOrders } from '../../mockData/orders'
import { users } from '../../mockData/users'
import { formatCurrency } from '../../utils/format'

const statusTabs = [{ value: 'all', label: 'All' }, ...ORDER_STATUSES.map((status) => ({ value: status.value, label: status.label }))]

const paymentStatusOptions = [
  { value: 'all', label: 'All payments' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Unpaid', label: 'Unpaid' },
]

const paymentBadgeVariant = { Paid: 'success', Partial: 'warning', Unpaid: 'danger' }

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const salesOfficers = users.filter((user) => user.role === 'sales_officer')
const salesOfficerOptions = [
  { value: 'all', label: 'All sales officers' },
  ...salesOfficers.map((officer) => ({ value: officer.id, label: officer.name })),
]

export default function OrderList() {
  const navigate = useNavigate()
  const [orders] = useState(seedOrders)
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [officerFilter, setOfficerFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        [order.orderNumber, order.customerName].some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesPayment = paymentFilter === 'all' || order.paymentStatus === paymentFilter
      const matchesOfficer = officerFilter === 'all' || order.salesOfficerId === officerFilter
      const matchesFrom = !dateFrom || order.orderDate >= dateFrom
      const matchesTo = !dateTo || order.orderDate <= dateTo

      return matchesSearch && matchesStatus && matchesPayment && matchesOfficer && matchesFrom && matchesTo
    })
  }, [orders, searchTerm, statusFilter, paymentFilter, officerFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    const pendingStatuses = ['Draft', 'Confirmed', 'Processing']
    return {
      totalOrders: filteredOrders.length,
      pendingOrders: filteredOrders.filter((order) => pendingStatuses.includes(order.status)).length,
      totalValue: filteredOrders.reduce((sum, order) => sum + order.total, 0),
      outstanding: filteredOrders.reduce((sum, order) => sum + order.balanceDue, 0),
    }
  }, [filteredOrders])

  const getDeliveryPartnerName = (order) =>
    order.deliveryPartnerId ? users.find((user) => user.id === order.deliveryPartnerId)?.name : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Sales Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">Monitor, filter, and approve orders across the organization</p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/orders/create')} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" />
          New Order
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} iconVariant="primary" label="Total Orders" value={stats.totalOrders} />
        <StatCard icon={Clock3} iconVariant="warning" label="Pending Orders" value={stats.pendingOrders} />
        <StatCard icon={IndianRupee} iconVariant="success" label="Total Value" value={formatCurrency(stats.totalValue)} />
        <StatCard icon={Wallet} iconVariant="danger" label="Outstanding" value={formatCurrency(stats.outstanding)} />
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
                  onClick={() => setStatusFilter(tab.value)}
                  className={`relative py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />
                  )}
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
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order # or customer"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select
              options={paymentStatusOptions}
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              className="sm:w-44"
            />
            <Select
              options={salesOfficerOptions}
              value={officerFilter}
              onChange={(event) => setOfficerFilter(event.target.value)}
              className="sm:w-52"
            />
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" className="sm:w-44" />
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" className="sm:w-44" />
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders match these filters"
              description="Try adjusting the status, payment, or date filters."
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
                  <th className="whitespace-nowrap px-4 py-3">Payment</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Delivery Partner</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const deliveryPartnerName = getDeliveryPartnerName(order)
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                      className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5 font-medium text-neutral-900">{order.orderNumber}</td>
                      <td className="px-4 py-3.5 text-neutral-700">{order.customerName}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{formatDate(order.orderDate)}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{order.items.length}</td>
                      <td className="px-4 py-3.5 font-medium text-neutral-700">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={paymentBadgeVariant[order.paymentStatus]}>{order.paymentStatus}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={orderStatusBadgeVariant(order.status)}>{order.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {deliveryPartnerName ? (
                          <span className="text-neutral-700">{deliveryPartnerName}</span>
                        ) : (
                          <span className="text-neutral-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'View', icon: CheckCircle2, onClick: () => navigate(`/admin/orders/${order.id}`) },
                            ...(order.requiresApproval && order.status === 'Confirmed'
                              ? [
                                  {
                                    label: 'Approve',
                                    icon: CheckCircle2,
                                    onClick: () => navigate(`/admin/orders/${order.id}`),
                                  },
                                ]
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

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredOrders.length === 0 ? '0' : `1 to ${filteredOrders.length}`} of {orders.length}
          </span>
          <span>Orders</span>
        </div>
      </Card>
    </div>
  )
}
