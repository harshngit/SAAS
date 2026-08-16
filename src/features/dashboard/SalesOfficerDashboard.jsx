import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellRing,
  Box,
  CalendarPlus,
  CheckCircle2,
  FileClock,
  FileText,
  MapPin,
  MoreVertical,
  RotateCw,
  ShoppingCart,
  Sun,
  Truck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthStore } from '../../store/authStore'
import { listCustomers } from '../../api/customers'
import { listOrders } from '../../api/orders'
import { listQuotations } from '../../api/quotations'
import { getMyAttendance } from '../../api/attendance'
import { visits } from '../../mockData/visits'
import { formatCurrency } from '../../utils/format'

// The visits mock file only models a single hardcoded sales officer ("usr-3") - Visits/Follow-ups
// have no backend endpoint yet (see src/auth/roles.js roleMenus comment), so this stays mocked.
const MOCK_VISITS_OFFICER_ID = 'usr-3'
const MONTHLY_TARGET = 80000

const visitStatusVariant = {
  Completed: 'success',
  Scheduled: 'info',
  'Follow-up Required': 'warning',
  Missed: 'danger',
}

const orderStatusVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

const myVisits = visits.filter((visit) => visit.salesOfficerId === MOCK_VISITS_OFFICER_ID)

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatStatusLabel(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCheckInTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  // Fall back to a bare "HH:MM" string as some records store just a time-of-day.
  const [hourString, minute] = String(value).split(':')
  const hour = Number(hourString)
  if (Number.isNaN(hour) || minute === undefined) return String(value)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minute} ${period}`
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-neutral-100 bg-white px-2 text-center shadow-(--shadow-xs) transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-(--shadow-card)"
    >
      <Icon className="size-5 text-primary-700" aria-hidden="true" />
      <span className="text-xs font-medium leading-tight text-neutral-700">{label}</span>
    </button>
  )
}

function StatCard({ icon: Icon, iconClassName, label, value, sublabel }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white ${iconClassName}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-1.5 text-xs text-neutral-400">{sublabel}</p>
    </div>
  )
}

function PriorityRow({ icon: Icon, iconClassName, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-neutral-50"
    >
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <span className="flex-1 truncate text-sm text-neutral-700">{label}</span>
      <span className="text-sm font-semibold text-neutral-900">{count}</span>
    </button>
  )
}

function OrderStatusTile({ icon: Icon, iconClassName, label, count }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-4 text-center">
      <div className={`flex size-9 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-4.5" aria-hidden="true" />
      </div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-neutral-900">{count}</p>
    </div>
  )
}

function SectionCard({ icon: Icon, title, action, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4.5 text-primary-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function SalesOfficerDashboard() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const firstName = (currentUser?.name || 'there').split(' ')[0]

  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [todaysAttendance, setTodaysAttendance] = useState(null)

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    const [customersResult, ordersResult, quotationsResult] = await Promise.all([
      listCustomers(),
      listOrders(),
      listQuotations(),
    ])

    setIsLoading(false)

    if (!customersResult.success) {
      setLoadError(customersResult.error)
      return
    }
    if (!ordersResult.success) {
      setLoadError(ordersResult.error)
      return
    }
    if (!quotationsResult.success) {
      setLoadError(quotationsResult.error)
      return
    }

    setCustomers(customersResult.customers)
    setOrders(ordersResult.orders)
    setQuotations(quotationsResult.quotations)
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      const result = await getMyAttendance()
      if (!isMounted || !result.success) return

      const today = new Date().toISOString().slice(0, 10)
      const record = result.records.find((entry) => entry.date === today)
      setTodaysAttendance(record || null)
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner label="Loading your dashboard..." />
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={loadDashboardData}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)

  const assignedCustomers = customers
  const visitsToday = myVisits.filter((visit) => visit.date === today).length
  const pendingFollowUps = myVisits.filter((visit) => visit.status === 'Follow-up Required').length
  const ordersThisMonth = orders.filter(
    (order) => order.status !== 'cancelled' && (order.orderDate || '').slice(0, 7) === currentMonth,
  )
  const monthlySales = ordersThisMonth.reduce((sum, order) => sum + (order.total || 0), 0)
  const targetProgress = Math.min(100, Math.round((monthlySales / MONTHLY_TARGET) * 100))
  const quotationsAwaitingResponse = quotations.filter((quotation) => quotation.status === 'sent').length
  const deliveriesToday = orders.filter(
    (order) => (order.deliveryDate || '').slice(0, 10) === today && order.status !== 'cancelled',
  ).length

  const orderStatusCounts = {
    draft: orders.filter((order) => order.status === 'draft').length,
    placed: orders.filter((order) => order.status === 'placed').length,
    processing: orders.filter((order) => order.status === 'processing' || order.status === 'awaiting_approval').length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }

  const upcomingVisits = [...myVisits].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 3)
  const recentOrders = [...orders]
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1))
    .slice(0, 3)

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-5 rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card) lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Sun className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-neutral-500">Stay focused and close more deals today!</p>
            {todaysAttendance?.checkIn && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-100">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Checked In · {formatCheckInTime(todaysAttendance.checkIn)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Quick Actions</p>
          <div className="flex flex-wrap gap-2 lg:flex-nowrap">
            <QuickAction icon={ShoppingCart} label="Create Order" onClick={() => navigate('/sales/orders/create')} />
            <QuickAction icon={FileText} label="Create Quotation" onClick={() => navigate('/sales/quotations/new')} />
            <QuickAction icon={UserPlus} label="Add Customer" onClick={() => navigate('/sales/customers')} />
            <QuickAction icon={UsersRound} label="Add Lead" onClick={() => navigate('/sales/leads')} />
            <QuickAction icon={CalendarPlus} label="Schedule Visit" onClick={() => navigate('/sales/visits')} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} iconClassName="bg-primary-800" label="Assigned Customers" value={assignedCustomers.length} sublabel="Active customer accounts" />
        <StatCard icon={MapPin} iconClassName="bg-blue-500" label="Visits Today" value={visitsToday} sublabel="Planned visits" />
        <StatCard icon={BellRing} iconClassName="bg-amber-500" label="Pending Follow-ups" value={pendingFollowUps} sublabel="Require your attention" />
        <StatCard icon={ShoppingCart} iconClassName="bg-emerald-500" label="Orders This Month" value={ordersThisMonth.length} sublabel="Total orders created" />
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <h2 className="text-base font-semibold text-neutral-900">Monthly Sales Target</h2>
        <p className="mt-1 text-sm text-neutral-500">{formatCurrency(monthlySales)} of {formatCurrency(MONTHLY_TARGET)} target</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${targetProgress}%` }} />
          </div>
          <span className="shrink-0 text-sm font-semibold text-neutral-900">{targetProgress}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard icon={BellRing} title="Today's Priorities">
          <div className="space-y-1">
            <PriorityRow
              icon={BellRing}
              iconClassName="bg-red-50 text-red-600"
              label="Overdue follow-ups"
              count={pendingFollowUps}
              onClick={() => navigate('/sales/followups')}
            />
            <PriorityRow
              icon={MapPin}
              iconClassName="bg-blue-50 text-blue-600"
              label="Visits today"
              count={visitsToday}
              onClick={() => navigate('/sales/visits')}
            />
            <PriorityRow
              icon={FileClock}
              iconClassName="bg-amber-50 text-amber-600"
              label="Quotations awaiting response"
              count={quotationsAwaitingResponse}
              onClick={() => navigate('/sales/quotations')}
            />
            <PriorityRow
              icon={Truck}
              iconClassName="bg-teal-50 text-teal-600"
              label="Deliveries today"
              count={deliveriesToday}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate('/sales/followups')}
            className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline"
          >
            View all priorities →
          </button>
        </SectionCard>

        <SectionCard icon={ShoppingCart} title="Order Status">
          <div className="flex gap-3">
            <OrderStatusTile icon={FileText} iconClassName="bg-neutral-100 text-neutral-500" label="Draft" count={orderStatusCounts.draft} />
            <OrderStatusTile icon={CheckCircle2} iconClassName="bg-green-50 text-green-600" label="Placed" count={orderStatusCounts.placed} />
            <OrderStatusTile icon={Truck} iconClassName="bg-blue-50 text-blue-600" label="Processing" count={orderStatusCounts.processing} />
            <OrderStatusTile icon={Box} iconClassName="bg-emerald-50 text-emerald-600" label="Completed" count={orderStatusCounts.completed} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/sales/orders/create')}
            className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline"
          >
            View all orders →
          </button>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          icon={MapPin}
          title="My Visits"
          action={<button type="button" onClick={() => navigate('/sales/visits')} className="text-sm font-medium text-primary-700 hover:underline">View all visits →</button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap py-2 pr-3">Customer</th>
                  <th className="whitespace-nowrap py-2 pr-3">Purpose</th>
                  <th className="whitespace-nowrap py-2 pr-3">Date</th>
                  <th className="whitespace-nowrap py-2 pr-3">Status</th>
                  <th className="whitespace-nowrap py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {upcomingVisits.map((visit) => (
                  <tr key={visit.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap py-3 pr-3 font-medium text-neutral-800">{visit.customerName}</td>
                    <td className="py-3 pr-3 text-neutral-500">{visit.purpose}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-neutral-500">{visit.date}</td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      <Badge variant={visitStatusVariant[visit.status] || 'neutral'} dot>{visit.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="More actions">
                        <MoreVertical className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
                {upcomingVisits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-neutral-400">No visits scheduled.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          icon={ShoppingCart}
          title="Recent Orders"
          action={<button type="button" onClick={() => navigate('/sales/orders/create')} className="text-sm font-medium text-primary-700 hover:underline">View all orders →</button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap py-2 pr-3">Order ID</th>
                  <th className="whitespace-nowrap py-2 pr-3">Customer</th>
                  <th className="whitespace-nowrap py-2 pr-3 text-right">Amount</th>
                  <th className="whitespace-nowrap py-2 pr-3">Status</th>
                  <th className="whitespace-nowrap py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap py-3 pr-3 font-medium text-neutral-800">{order.orderNumber}</td>
                    <td className="py-3 pr-3 text-neutral-500">{order.customerName}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-right font-medium text-neutral-900">{formatCurrency(order.total)}</td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      <Badge variant={orderStatusVariant[order.status] || 'neutral'} dot>{formatStatusLabel(order.status)}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="More actions">
                        <MoreVertical className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-neutral-400">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
