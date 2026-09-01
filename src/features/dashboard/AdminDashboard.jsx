import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCompactCurrency, formatCurrency } from '../../utils/format'
import { getAdminDashboard } from '../../api/dashboard'
import { listOrders } from '../../api/orders'
import {
  Ban,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  IndianRupee,
  MoreHorizontal,
  PackagePlus,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'

const paymentVariant = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'danger',
}

const statusVariant = {
  draft: 'neutral',
  confirmed: 'info',
  processing: 'primary',
  out_for_delivery: 'warning',
  delivered: 'success',
  partially_delivered: 'warning',
  cancelled: 'danger',
  returned: 'danger',
}

const dateRangePresets = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function resolveDateRange(preset, customRange) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (preset) {
    case 'last_month': {
      const from = new Date(year, month - 1, 1)
      const to = new Date(year, month, 0)
      return { date_from: toIsoDate(from), date_to: toIsoDate(to) }
    }
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(month / 3) * 3
      const from = new Date(year, quarterStartMonth, 1)
      return { date_from: toIsoDate(from), date_to: toIsoDate(now) }
    }
    case 'this_year': {
      const from = new Date(year, 0, 1)
      return { date_from: toIsoDate(from), date_to: toIsoDate(now) }
    }
    case 'custom': {
      // Fall back to This Month if one end hasn't been picked yet.
      if (!customRange?.from || !customRange?.to) {
        const from = new Date(year, month, 1)
        return { date_from: toIsoDate(from), date_to: toIsoDate(now) }
      }
      // Guard against a reversed range.
      const [from, to] = customRange.from <= customRange.to
        ? [customRange.from, customRange.to]
        : [customRange.to, customRange.from]
      return { date_from: from, date_to: to }
    }
    case 'this_month':
    default: {
      const from = new Date(year, month, 1)
      return { date_from: toIsoDate(from), date_to: toIsoDate(now) }
    }
  }
}

function formatRangeLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatChartDateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function formatCashflowDateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit' })
}

function formatOrderDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB')
}

function formatStatusLabel(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function FilterBox({ label, value }) {
  return (
    <button
      type="button"
      className="flex h-12 min-w-0 items-center justify-between gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors hover:border-primary-200 hover:bg-primary-50/30"
    >
      <span className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[0.54rem] font-semibold uppercase tracking-[0.09em] text-neutral-400">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[0.73rem] font-medium leading-4 text-neutral-900">{value}</span>
      </span>
      <ChevronDown className="size-3 shrink-0 text-neutral-400" aria-hidden="true" />
    </button>
  )
}

function KpiCard({ title, value, delta, footer, icon: Icon, tone = 'green' }) {
  const toneClasses = {
    green: 'bg-[linear-gradient(135deg,#0f3d10,#14532d)] text-white',
    mint: 'bg-[linear-gradient(135deg,#047857,#10b981)] text-white',
    amber: 'bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-white',
    violet: 'bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)] text-white',
    cyan: 'bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-white',
    blue: 'bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] text-white',
    pink: 'bg-[linear-gradient(135deg,#be123c,#ec4899)] text-white',
    sky: 'bg-[linear-gradient(135deg,#4338ca,#6366f1)] text-white',
  }

  const footerParts = footer ? footer.split(' ') : []
  const footerFirstLine = footerParts.length === 3 ? footerParts.slice(0, 2).join(' ') : footerParts.slice(0, 1).join(' ')
  const footerSecondLine = footerParts.length === 3 ? footerParts.slice(2).join(' ') : footerParts.slice(1).join(' ')

  return (
    <div
      className={`group relative flex min-h-42 flex-col overflow-hidden rounded-2xl p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_rgb(15_23_42/0.28)] sm:p-3.5 ${toneClasses[tone]}`}
    >
      <div className="min-w-0">
        <p className="mx-auto min-h-[2.35rem] max-w-[8rem] whitespace-normal break-normal text-center text-[0.68rem] font-semibold uppercase leading-[1.2] tracking-[0.11em] text-current/72 sm:text-[0.72rem]">
          {title}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-(--font-display) text-[1.05rem] font-semibold leading-none tracking-tight">
            {value}
          </p>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105">
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
        </div>
        {delta && <p className="mt-1 break-words text-[0.65rem] leading-4 text-current/78">{delta}</p>}
      </div>
      {footer && (
        <div
          className="mt-auto flex w-full items-end justify-between gap-4 border-t border-white/40 pt-2.5 text-[0.72rem] font-semibold leading-4 text-current/86 transition-transform duration-300 group-hover:translate-x-0.5"
        >
          <span className="min-w-0 flex-1 leading-[1.05]">
            <span className="block whitespace-nowrap">{footerFirstLine}</span>
            {footerSecondLine && <span className="block whitespace-nowrap">{footerSecondLine}</span>}
          </span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function ProfitSummaryCard({ grossProfit, netProfit }) {
  const footer = 'View Profit & Loss'
  const footerParts = footer.split(' ')
  const footerFirstLine = footerParts.length === 3 ? footerParts.slice(0, 2).join(' ') : footerParts.slice(0, 1).join(' ')
  const footerSecondLine = footerParts.length === 3 ? footerParts.slice(2).join(' ') : footerParts.slice(1).join(' ')
 
  return (
    <div className="group relative flex min-h-42 flex-col overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#1687a8_0%,#2670db_100%)] p-4 text-white shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_rgb(15_23_42/0.28)] sm:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_36%)] opacity-90" />
      <div className="relative min-w-0">
        <p className="-ml-1 w-full whitespace-nowrap text-center text-[0.70rem] font-semibold uppercase leading-[1.2] tracking-[0.11em] text-white/82 sm:text-[0.72rem]">
          Profit Summary
        </p>
        <div className="mt-3 space-y-2.5">
          <div>
            <p className="text-[0.62rem] font-medium leading-none text-white/72">Gross Profit</p>
            <p className="mt-1 pr-2 text-right font-(--font-display) text-[1.05rem] font-semibold leading-none tracking-tight text-white">
              {formatCompactCurrency(grossProfit)}
            </p>
          </div>
          <div>
            <p className="text-[0.62rem] font-medium leading-none text-white/72">Net Profit</p>
            <p className="mt-1 pr-2 text-right font-(--font-display) text-[1.05rem] font-semibold leading-none tracking-tight text-white">
              {formatCompactCurrency(netProfit)}
            </p>
          </div>
        </div>
      </div>
      <div className="relative z-10 mt-auto flex items-end justify-between gap-4 border-t border-white/40 pt-2.5 text-[0.72rem] font-semibold leading-4 text-white/92 transition-transform duration-300 group-hover:translate-x-0.5">
        <span className="min-w-0 leading-[1.02]">
          <span className="block whitespace-nowrap">{footerFirstLine}</span>
          {footerSecondLine && <span className="block whitespace-nowrap">{footerSecondLine}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
      </div>
    </div>
  )
}

function getOrderAmountSplit(order) {
  const total = Number(order?.total) || 0
  const items = Array.isArray(order?.items) ? order.items : []

  let deliveredAmount = 0
  let pendingAmount = 0
  let hasDeliveryData = false

  items.forEach((item) => {
    const lineTotal = Number(item?.lineTotal ?? item?.line_total) || 0
    const orderedQuantity = Number(item?.orderedQuantity ?? item?.ordered_quantity ?? item?.quantity) || 0
    const deliveredQuantity = Number(item?.deliveredQuantity ?? item?.delivered_quantity)

    if (orderedQuantity > 0 && Number.isFinite(deliveredQuantity) && deliveredQuantity >= 0 && deliveredQuantity <= orderedQuantity) {
      const deliveredShare = lineTotal * (deliveredQuantity / orderedQuantity)
      deliveredAmount += deliveredShare
      pendingAmount += lineTotal - deliveredShare
      hasDeliveryData = true
    }
  })

  if (!hasDeliveryData) {
    const status = String(order?.status || '').toLowerCase()
    const fulfilmentStatus = String(order?.fulfilmentStatus || order?.fulfilment_status || '').toLowerCase()
    const isDelivered = status === 'completed' || fulfilmentStatus === 'delivered' || fulfilmentStatus === 'partially_delivered'

    return {
      deliveredAmount: isDelivered ? total : 0,
      pendingAmount: isDelivered ? 0 : total,
    }
  }

  return {
    deliveredAmount: Math.min(total, deliveredAmount),
    pendingAmount: Math.max(total - deliveredAmount, 0),
  }
}

function FeaturedSalesCard({
  salesAmount,
  receivedAmount = 0,
  pendingAmount = 0,
  ordersCount = 0,
  deliveredCount = 0,
  pendingOrdersCount = 0,
}) {
  const navigate = useNavigate()
  const formatCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value) || 0)

  return (
    <button
      type="button"
      onClick={() => navigate('/admin/orders')}
      aria-label="View sales orders"
      className="group relative flex h-[320px] w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#175e17_0%,#0c4608_100%)] p-4 text-left text-white shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_rgb(15_23_42/0.28)] sm:p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_28%)] opacity-85 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute right-4 top-4 flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105">
        <IndianRupee className="size-5.5" aria-hidden="true" />
      </div>

      <div className="min-w-0 pr-16">
        <p className="max-w-full whitespace-nowrap text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/78">
          TODAY&apos;S SALES
        </p>
        <p className="mt-1 font-(--font-display) text-[2.1rem] font-semibold leading-none tracking-tight text-white">
          {formatCurrency(salesAmount)}
        </p>
      </div>

      <div className="relative mt-8 grid grid-cols-2 gap-x-8 gap-y-2">
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold leading-none text-white/90">Received</p>
          <p className="mt-1 truncate text-[1.50rem] font-semibold leading-none tracking-tight text-white">
            {formatCurrency(receivedAmount)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold leading-none text-white/90">Pending</p>
          <p className="mt-1 truncate text-[1.50rem] font-semibold leading-none tracking-tight text-white">
            {formatCurrency(pendingAmount)}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="mb-5 grid grid-cols-3 divide-x divide-white/25 text-left">
        <div className="pr-3">
          <p className="text-[0.78rem] font-semibold leading-none text-white/88">Orders</p>
          <p className="mt-1 text-[1.35rem] font-semibold leading-none tracking-tight text-white">{formatCount(ordersCount)}</p>
        </div>
        <div className="px-3">
          <p className="text-[0.78rem] font-semibold leading-none text-white/88">Delivered</p>
          <p className="mt-1 text-[1.35rem] font-semibold leading-none tracking-tight text-white">{formatCount(deliveredCount)}</p>
        </div>
        <div className="pl-3">
          <p className="text-[0.78rem] font-semibold leading-none text-white/88">Pending</p>
          <p className="mt-1 text-[1.35rem] font-semibold leading-none tracking-tight text-white">{formatCount(pendingOrdersCount)}</p>
        </div>
      </div>

      <div className="mt-auto flex items-end justify-end pt-3 text-[0.92rem] font-semibold leading-4 text-white/90">
        <span className="inline-flex items-center gap-1.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white">
          View Sales
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </span>
      </div>
    </button>
  )
}
function StatMini({ label, sublabel, value, pct, tone = 'green' }) {
  const colors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    red: 'bg-rose-500',
  }

  return (
    <div className="rounded-2xl bg-neutral-50 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold leading-4 text-neutral-700">{label}</p>
          <p className="mt-0.5 text-[0.65rem] leading-3.5 text-neutral-400">{sublabel}</p>
        </div>
        <span className="text-[0.7rem] font-semibold text-neutral-500">{value}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function SignalRow({ label, value, positive }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-[0.74rem] text-neutral-600">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {value != null && (
          <span className={`text-[0.72rem] font-semibold tabular-nums ${positive ? 'text-neutral-700' : 'text-amber-600'}`}>
            {value}
          </span>
        )}
        <span className={`size-2 rounded-full ${positive ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
      </span>
    </div>
  )
}

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-(--shadow-popover) ring-1 ring-black/5">
      <p className="font-semibold text-neutral-900">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="mt-1 text-neutral-500">
          {item.name}: <span className="font-semibold text-neutral-900">{formatCurrency(item.value)}</span>
        </p>
      ))}
    </div>
  )
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-(--shadow-popover) ring-1 ring-black/5">
      <p className="font-semibold text-neutral-900">{item.name}</p>
      <p className="mt-1 text-neutral-500">{formatCurrency(item.value)}</p>
    </div>
  )
}

function DashboardCard({ className = '', ...props }) {
  return (
    <Card
      {...props}
      className={`p-4 [&>div:first-child]:mb-3 [&>div:first-child_h3]:text-[0.95rem] [&>div:first-child_h3]:leading-5 [&>div:first-child_p]:text-[0.76rem] [&>div:first-child_p]:leading-4 ${className}`}
    />
  )
}

const stockToneByStatus = { out_of_stock: 'red', low_stock: 'amber' }

const MONTHLY_SALES_TARGET = 80000

const EXPENSE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#94a3b8', '#ec4899', '#14b8a6']

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [datePreset, setDatePreset] = useState('this_month')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const [recentOrdersSearch, setRecentOrdersSearch] = useState('')
  const [topProductsMetric, setTopProductsMetric] = useState('amount')
  const [dashboard, setDashboard] = useState(null)
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('saas-sidebar-expanded') !== 'false'
  })

  const loadDashboard = useCallback(async (preset, range) => {
    setIsLoading(true)
    setError('')

    const [dashboardResult, ordersResult] = await Promise.all([
      getAdminDashboard(resolveDateRange(preset, range)),
      listOrders(),
    ])

    setIsLoading(false)

    if (!dashboardResult.success) {
      setError(dashboardResult.error)
      return
    }

    setDashboard(dashboardResult.dashboard)
    setOrders(ordersResult.success ? ordersResult.orders : [])
  }, [])

  useEffect(() => {
    loadDashboard(datePreset, customRange)
    // Only refetch when the user explicitly applies a new preset (Apply button) - not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleSidebarStateChange = (event) => {
      if (typeof event?.detail === 'boolean') {
        setIsSidebarExpanded(event.detail)
        return
      }

      if (typeof window !== 'undefined') {
        setIsSidebarExpanded(window.localStorage.getItem('saas-sidebar-expanded') !== 'false')
      }
    }

    window.addEventListener('saas-sidebar-expanded-change', handleSidebarStateChange)
    window.addEventListener('storage', handleSidebarStateChange)

    return () => {
      window.removeEventListener('saas-sidebar-expanded-change', handleSidebarStateChange)
      window.removeEventListener('storage', handleSidebarStateChange)
    }
  }, [])

  if (isLoading && !dashboard) {
    return <LoadingSpinner label="Loading dashboard..." />
  }

  if (error && !dashboard) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => loadDashboard(datePreset, customRange)}
          className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const summary = dashboard?.summary || {}
  const ordersSummary = dashboard?.orders || {}
  const cashflowRows = Array.isArray(dashboard?.cashflow) ? dashboard.cashflow : []
  const receivablesPayables = dashboard?.receivables_payables || {}
  const topCustomersRows = Array.isArray(dashboard?.top_customers) ? dashboard.top_customers : []
  const topProductsRows = Array.isArray(dashboard?.top_products) ? dashboard.top_products : []
  const expenseBreakdownRows = Array.isArray(dashboard?.expense_breakdown) ? dashboard.expense_breakdown : []
  const salesTrendRows = Array.isArray(dashboard?.sales_trend) ? dashboard.sales_trend : []
  const stockWatchRows = Array.isArray(dashboard?.stock_watch) ? dashboard.stock_watch : []
  const recentOrdersRows = Array.isArray(dashboard?.recent_orders) ? dashboard.recent_orders : []

  const grossProfit = summary.gross_profit ?? 0
  const netProfit = summary.net_profit ?? 0
  const salesGrowth = summary.sales_growth_percentage ?? 0
  const totalReceivables = receivablesPayables.receivables ?? 0
  const totalPayables = receivablesPayables.payables ?? 0
  const overdueReceivables = receivablesPayables.overdue_receivables ?? 0
  const overduePayables = receivablesPayables.overdue_payables ?? 0
  const currentReceivables = Math.max(totalReceivables - overdueReceivables, 0)
  const currentPayables = Math.max(totalPayables - overduePayables, 0)
  const netOutstanding = totalReceivables - totalPayables
  const arBuckets = [
    { name: 'Receivables', value: currentReceivables, color: '#22c55e' },
    { name: 'Payables', value: currentPayables, color: '#3b82f6' },
    { name: 'Overdue Receivables', value: overdueReceivables, color: '#f59e0b' },
    { name: 'Overdue Payables', value: overduePayables, color: '#ef4444' },
  ]
  const arTotal = arBuckets.reduce((sum, bucket) => sum + bucket.value, 0)
  const arHasData = arTotal >= 1
  const arSegments = arBuckets.map((bucket) => ({
    ...bucket,
    pct: arHasData ? Math.round((bucket.value / arTotal) * 100) : 0,
  }))
  const arPieData = arHasData
    ? arSegments.filter((segment) => segment.value >= 1)
    : [{ name: 'No data', value: 1, color: '#e5e7eb' }]

  // Business Health Score - a composite of five operational signals.
  const periodExpenses = summary.expenses ?? 0
  const cashflowNet = cashflowRows.reduce((sum, row) => sum + (row.inflow || 0) - (row.outflow || 0), 0)
  const healthSignals = [
    { label: 'Sales Growth', positive: salesGrowth >= 0 },
    { label: 'Cash Flow', positive: cashflowNet >= 0 },
    { label: 'Inventory Health', positive: stockWatchRows.length === 0 },
    { label: 'Receivables', positive: (receivablesPayables.overdue_receivables || 0) === 0 },
    { label: 'Expenses', positive: grossProfit > 0 ? periodExpenses <= grossProfit : periodExpenses === 0 },
  ]
  const healthScore = Math.round((healthSignals.filter((signal) => signal.positive).length / healthSignals.length) * 100)
  const healthLabel = healthScore >= 90 ? 'Excellent' : healthScore >= 75 ? 'Healthy' : healthScore >= 55 ? 'Fair' : 'Needs Attention'
  const healthColor = healthScore >= 75 ? 'text-emerald-600' : healthScore >= 55 ? 'text-amber-600' : 'text-red-600'
  const healthStroke = healthScore >= 75 ? '#10b981' : healthScore >= 55 ? '#f59e0b' : '#ef4444'

  const periodSales = summary.period_sales ?? summary.month_sales ?? 0
  const targetProgress = MONTHLY_SALES_TARGET > 0 ? Math.min(100, Math.round((periodSales / MONTHLY_SALES_TARGET) * 100)) : 0

  const cashflowData = cashflowRows.map((row) => ({
    label: formatCashflowDateLabel(row.date),
    value: row.inflow || 0,
    outflow: row.outflow || 0,
  }))
  const salesTrendData = salesTrendRows.map((row) => ({
    label: formatChartDateLabel(row.date),
    value: row.sales || 0,
  }))
  const healthTrendData = salesTrendData.length >= 2 ? salesTrendData : cashflowData
  const topCustomers = topCustomersRows.map((row) => ({ name: row.customer_name, value: row.sales || 0 }))
  const topCustomerPeak = topCustomers[0]?.value || 1
  const topProducts = topProductsRows.map((row) => ({
    name: row.product_name,
    amount: row.sales_amount || 0,
    quantity: row.quantity || 0,
  }))
  const topProductsValueKey = topProductsMetric === 'quantity' ? 'quantity' : 'amount'
  const topProductsSorted = [...topProducts].sort((a, b) => (b[topProductsValueKey] || 0) - (a[topProductsValueKey] || 0))
  const topProductsPeak = topProductsSorted[0]?.[topProductsValueKey] || 1
  const expenseBreakdownRaw = expenseBreakdownRows.map((row) => ({ name: row.category, value: row.amount || 0 }))
  const expenseTotal = expenseBreakdownRaw.reduce((sum, entry) => sum + entry.value, 0)
  const expenseHasData = expenseTotal >= 1
  const expenseBreakdown = expenseBreakdownRaw
    .filter((entry) => entry.value >= 1)
    .sort((a, b) => b.value - a.value)
    .map((entry, index) => ({
      ...entry,
      color: EXPENSE_COLORS[index % EXPENSE_COLORS.length],
      pct: expenseHasData ? Math.round((entry.value / expenseTotal) * 100) : 0,
    }))
  const expensePieData = expenseHasData ? expenseBreakdown : [{ name: 'No data', value: 1, color: '#e5e7eb' }]
  const recentOrders = recentOrdersRows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    status: row.status,
    paymentStatus: row.payment_status,
    total: row.total,
    orderDate: formatOrderDate(row.date),
  }))
  // "TODAY'S SALES" card is strictly today's orders - amount, received (delivered value),
  // pending (undelivered value), and the 3 order counts all derive from the same
  // todaysOrders list below, not from all-time/period summaries (ordersSummary/recentOrders
  // are separate, period-scoped data used elsewhere on this dashboard, e.g. Order
  // Cancellations and the Recent Orders table).
  const today = new Date().toISOString().slice(0, 10)
  const todaysOrders = orders.filter(
    (order) => (order.orderDate || order.createdAt || '').slice(0, 10) === today && order.status !== 'cancelled',
  )
  const todaysSalesAmount = todaysOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  const isOrderFullyDelivered = (order) => {
    const status = String(order?.status || '').toLowerCase()
    const fulfilmentStatus = String(order?.fulfilmentStatus || order?.fulfilment_status || '').toLowerCase()
    return status === 'completed' || fulfilmentStatus === 'delivered'
  }
  const featuredOrdersCount = todaysOrders.length
  const featuredDeliveredCount = todaysOrders.filter(isOrderFullyDelivered).length
  const featuredPendingCount = Math.max(featuredOrdersCount - featuredDeliveredCount, 0)
  const orderAmounts = todaysOrders.reduce(
    (totals, order) => {
      const { deliveredAmount, pendingAmount } = getOrderAmountSplit(order)
      return {
        deliveredAmount: totals.deliveredAmount + deliveredAmount,
        pendingAmount: totals.pendingAmount + pendingAmount,
      }
    },
    { deliveredAmount: 0, pendingAmount: 0 },
  )
  const rangeLabel = datePreset === 'custom' && customRange.from && customRange.to
    ? `${formatRangeLabel(customRange.from)} – ${formatRangeLabel(customRange.to)}`
    : dateRangePresets.find((preset) => preset.value === datePreset)?.label

  const recentOrdersSearchTerm = recentOrdersSearch.trim().toLowerCase()
  const filteredRecentOrders = !recentOrdersSearchTerm
    ? recentOrders
    : recentOrders.filter((order) =>
        [order.orderNumber, order.customerName, order.status, order.paymentStatus, order.total, order.orderDate].some((value) =>
          String(value ?? '').toLowerCase().includes(recentOrdersSearchTerm),
        ),
      )

  return (
    <div className="space-y-3 rounded-2xl bg-transparent">
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white p-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="grid w-full grid-cols-[1fr_repeat(5,minmax(0,1fr))_88px] gap-1.5">
          <Select
            options={dateRangePresets}
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value)}
            triggerClassName="h-12"
          />
          <FilterBox label="Company" value="All Companies" />
          <FilterBox label="Branch" value="All Branches" />
          <FilterBox label="Warehouse" value="All Warehouses" />
          <FilterBox label="Customer" value="All Customers" />
          <FilterBox label="Supplier" value="All Suppliers" />
          <button
            type="button"
            onClick={() => loadDashboard(datePreset, customRange)}
            className="inline-flex h-12 min-w-0 items-center justify-center rounded-xl bg-primary-600 px-3 py-1.5 text-[0.73rem] font-semibold text-white shadow-[0_12px_24px_-14px_rgb(6_59_0/0.45)] transition-colors hover:bg-primary-700"
          >
            Apply
          </button>
        </div>

        {datePreset === 'custom' && (
          <div className="mt-1.5 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="whitespace-nowrap text-[0.54rem] font-semibold uppercase tracking-[0.09em] text-neutral-400">From date</span>
              <input
                type="date"
                value={customRange.from}
                max={customRange.to || undefined}
                onChange={(event) => setCustomRange((current) => ({ ...current, from: event.target.value }))}
                className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-[0.78rem] text-neutral-900 shadow-[0_1px_2px_rgb(15_23_42/0.03)] focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="whitespace-nowrap text-[0.54rem] font-semibold uppercase tracking-[0.09em] text-neutral-400">To date</span>
              <input
                type="date"
                value={customRange.to}
                min={customRange.from || undefined}
                onChange={(event) => setCustomRange((current) => ({ ...current, to: event.target.value }))}
                className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-[0.78rem] text-neutral-900 shadow-[0_1px_2px_rgb(15_23_42/0.03)] focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </label>
            <p className="pb-1.5 text-[0.68rem] text-neutral-400">
              {customRange.from && customRange.to
                ? 'Press Apply to load this range.'
                : 'Pick both dates, then press Apply.'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0 self-start">
          <FeaturedSalesCard
            salesAmount={todaysSalesAmount}
            receivedAmount={orderAmounts.deliveredAmount}
            pendingAmount={orderAmounts.pendingAmount}
            ordersCount={featuredOrdersCount}
            deliveredCount={featuredDeliveredCount}
            pendingOrdersCount={featuredPendingCount}
          />
        </div>
        <div
          className={`grid min-w-0 w-full self-start content-start grid-cols-1 gap-2.5 transition-[padding] duration-300 md:grid-cols-2 xl:grid-cols-6 ${
            isSidebarExpanded ? 'pl-0' : 'pl-2'
          }`}
        >
          <KpiCard
            title="This Month Sales"
            value={formatCurrency(summary.period_sales ?? summary.month_sales)}
            delta={`${salesGrowth >= 0 ? '+' : ''}${salesGrowth}% vs last month`}
            footer="View Sales Report"
            icon={Wallet}
            tone="mint"
          />
          <KpiCard
            title="Purchases"
            value={formatCurrency(summary.purchases)}
            footer="View Purchase Report"
            icon={ShoppingCart}
            tone="amber"
          />
          <KpiCard
            title="Expenses"
            value={formatCurrency(summary.expenses)}
            footer="View Expense Report"
            icon={CreditCard}
            tone="violet"
          />
          <ProfitSummaryCard grossProfit={grossProfit} netProfit={netProfit} />
          <KpiCard
            title="New Customers"
            value={summary.new_customers ?? 0}
            footer="View Customers"
            icon={Users}
            tone="sky"
          />
          <KpiCard
            title="Sales Growth"
            value={`${salesGrowth >= 0 ? '+' : ''}${salesGrowth}%`}
            delta="vs last month"
            footer="View Growth Report"
            icon={Sparkles}
            tone="pink"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3 ">
          <div className="border-0 bg-transparent p-0 shadow-none hover:shadow-none">
            <div className="grid grid-cols-5 gap-1.5">
              <button className="flex min-h-[76px] min-w-0 bg-white flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-100 px-1 py-3 text-center text-primary-700 shadow-none">
                <ShoppingCart className="size-3.5 shrink-0  " />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap ">New</span>
                  <span className="block whitespace-nowrap">Sale</span>
                </span>
              </button>
              <button className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-100 bg-white px-1 py-3 text-center text-primary-700 shadow-none">
                <PackagePlus className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">New</span>
                  <span className="block whitespace-nowrap">Purchase</span>
                </span>
              </button>
              <button className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-100 bg-white px-1 py-3 text-center text-primary-700 shadow-none">
                <Wallet className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">Collect</span>
                  <span className="block whitespace-nowrap">Payment</span>
                </span>
              </button>
              <button className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-100 bg-white px-1 py-3 text-center text-primary-700 shadow-none">
                <Clock className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">Pending</span>
                  <span className="block whitespace-nowrap">Orders</span>
                </span>
              </button>
              <button className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-100 bg-white px-1 py-3 text-center text-primary-700 shadow-none">
                <MoreHorizontal className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">More</span>
                  <span className="block whitespace-nowrap">Actions</span>
                </span>
              </button>
            </div>
          </div>

          <DashboardCard title="Business Health Score">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className={`font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight ${healthColor}`}>
                  {healthScore}%
                </p>
                <p className={`mt-1 text-[0.74rem] font-semibold ${healthColor}`}>{healthLabel}</p>
              </div>
            </div>

            {healthTrendData.length >= 2 && (
              <div className="-mx-1 mt-2 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={healthTrendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="healthArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={healthStroke} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={healthStroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={healthStroke} strokeWidth={2} fill="url(#healthArea)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-2 divide-y divide-neutral-100">
              {healthSignals.map((signal) => (
                <SignalRow key={signal.label} label={signal.label} positive={signal.positive} />
              ))}
            </div>

            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="flex items-center justify-between text-[0.7rem] font-medium text-neutral-500">
                <span>Monthly Target</span>
                <span className="font-semibold text-neutral-800">{formatCompactCurrency(MONTHLY_SALES_TARGET)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-500"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
              <p className="mt-1 text-[0.64rem] text-neutral-400">
                {formatCompactCurrency(periodSales)} this month · {targetProgress}%
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/reports')}
              className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-primary-600 hover:text-primary-700"
            >
              View Health Report
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </DashboardCard>

          <DashboardCard
            title="Stock Watch"
            actions={<span className="text-[0.7rem] font-semibold text-primary-600">View all</span>}
            className="min-h-[350px] [&>div:first-child]:mb-3"
          >
            {stockWatchRows.length === 0 ? (
              <p className="text-[0.72rem] text-neutral-400">Nothing running low right now.</p>
            ) : (
              <div className="space-y-2.5">
                {stockWatchRows.slice(0, 3).map((item) => (
                  <StatMini
                    key={item.product_id}
                    label={item.product_name}
                    sublabel={item.status === 'out_of_stock' ? 'Out of stock' : 'Low stock'}
                    value={`${item.stock_percentage}%`}
                    pct={item.stock_percentage}
                    tone={stockToneByStatus[item.status] || 'amber'}
                  />
                ))}
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            title="Recent Activity"
            actions={<span className="text-[0.7rem] font-semibold text-primary-600">View all</span>}
            className=" mt-5 min-h-[350px]"
          >
            <div className="flex min-h-[220px] flex-col justify-between">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    {order.customerName?.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.78rem] font-medium leading-4 text-neutral-800">{order.customerName}</p>
                    <p className="mt-0.5 text-[0.68rem] leading-3.5 text-neutral-400">
                      {order.orderNumber} · {formatStatusLabel(order.status)}
                    </p>
                  </div>
                  <span className="text-[0.65rem] text-neutral-400">{order.orderDate}</span>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <p className="text-[0.72rem] text-neutral-400">No recent orders yet.</p>
              )}
            </div>
          </DashboardCard>

        </div>

        <div className="space-y-3.5 xl:-mt-37">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <DashboardCard
              title="Cashflow"
              subtitle={`Net for period ${formatCurrency(summary.period_sales ?? summary.month_sales)}`}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">{rangeLabel}</span>}
              className="h-full min-h-[280px]"
            >
              <div className="-mr-2">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={cashflowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#edf1f5" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9aa1ac' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactCurrency}
                      width={40}
                    />
                    <Tooltip content={<CashflowTooltip />} cursor={{ fill: '#f8f9fa' }} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={28}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-[0.7rem] text-neutral-500">{value}</span>}
                    />
                    <Bar name="Inflow" dataKey="value" fill="#14532d" radius={[6, 6, 0, 0]} barSize={16} />
                    <Bar name="Outflow" dataKey="outflow" fill="#c9ced6" radius={[6, 6, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Receivables vs Payables"
              subtitle={rangeLabel}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">{rangeLabel}</span>}
              className="h-full min-h-[280px] [&>div:first-child]:mb-3"
            >
              <div className="flex h-full flex-col">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative h-[160px] w-full max-w-[188px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={arPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="64%"
                          outerRadius="94%"
                          paddingAngle={arHasData ? 2 : 0}
                          stroke="none"
                        >
                          {arPieData.map((segment) => (
                            <Cell key={segment.name} fill={segment.color} />
                          ))}
                        </Pie>
                        {arHasData && <Tooltip content={<DonutTooltip />} />}
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="font-(--font-display) text-[1.35rem] font-semibold leading-none tracking-tight text-neutral-900">
                        {formatCompactCurrency(netOutstanding)}
                      </p>
                      <p className="mt-1 text-[0.66rem] text-neutral-400">Net Outstanding</p>
                    </div>
                  </div>

                  <div className="w-full space-y-2.5">
                    {arSegments.map((segment) => (
                      <div key={segment.name} className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-[0.74rem] text-neutral-600">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                          <span className="truncate">{segment.name}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-right text-[0.74rem]">
                          <span className="font-semibold text-neutral-900">{formatCompactCurrency(segment.value)}</span>
                          {arHasData && <span className="ml-1 text-[0.66rem] text-neutral-400">({segment.pct}%)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-center pt-4 text-[0.72rem]">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/reports')}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View A/R Report
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <DashboardCard
              title="Sales Trend"
              subtitle={rangeLabel}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">{rangeLabel}</span>}
              className="h-full min-h-[264px]"
            >
              <div className="flex h-full flex-col">
                <div className="-mr-2">
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={salesTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#edf1f5" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9aa1ac' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatCompactCurrency}
                        width={44}
                      />
                      <Tooltip content={<CashflowTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Sales"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-auto flex items-center justify-center pt-3 text-[0.72rem]">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/reports')}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View Sales Report
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Expense Breakdown"
              subtitle={rangeLabel}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">{rangeLabel}</span>}
              className="h-full min-h-[264px] [&>div:first-child]:mb-3"
            >
              <div className="flex h-full flex-col">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative h-[150px] w-full max-w-[172px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="64%"
                          outerRadius="94%"
                          paddingAngle={expenseHasData ? 2 : 0}
                          stroke="none"
                        >
                          {expensePieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        {expenseHasData && <Tooltip content={<DonutTooltip />} />}
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="font-(--font-display) text-[1.35rem] font-semibold leading-none tracking-tight text-neutral-900">
                        {formatCompactCurrency(expenseTotal)}
                      </p>
                      <p className="mt-1 text-[0.66rem] text-neutral-400">Total Expenses</p>
                    </div>
                  </div>

                  <div className="w-full space-y-2">
                    {expenseBreakdown.slice(0, 6).map((entry) => (
                      <div key={entry.name} className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-[0.74rem] text-neutral-600">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-right text-[0.74rem]">
                          <span className="font-semibold text-neutral-900">{formatCompactCurrency(entry.value)}</span>
                          <span className="ml-1 text-[0.66rem] text-neutral-400">({entry.pct}%)</span>
                        </span>
                      </div>
                    ))}
                    {expenseBreakdown.length === 0 && (
                      <p className="text-[0.72rem] text-neutral-400">No expenses recorded in this period.</p>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-center pt-4 text-[0.72rem]">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/reports')}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View Expense Report
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <DashboardCard
              title="Top Selling Products"
              subtitle={topProductsMetric === 'amount' ? 'Amount' : 'Quantity'}
              actions={
                <div className="inline-flex rounded-full bg-neutral-50 p-0.5 text-[0.68rem] font-semibold">
                  <button
                    type="button"
                    onClick={() => setTopProductsMetric('amount')}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      topProductsMetric === 'amount' ? 'bg-blue-50 text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                    aria-pressed={topProductsMetric === 'amount'}
                  >
                    Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopProductsMetric('quantity')}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      topProductsMetric === 'quantity' ? 'bg-blue-50 text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                    aria-pressed={topProductsMetric === 'quantity'}
                  >
                    Quantity
                  </button>
                </div>
              }
              className="h-full min-h-[330px] [&>div:first-child]:mb-4"
            >
              <div className="flex h-full flex-col">
                {topProductsSorted.length === 0 ? (
                  <p className="text-[0.72rem] text-neutral-400">No product sales in this period yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topProductsSorted.slice(0, 10).map((product, index) => {
                      const value = product[topProductsValueKey] || 0
                      const width = Math.max(8, Math.round((value / topProductsPeak) * 100))
                      return (
                        <div key={product.name} className="space-y-1">
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                            <span className="w-4 text-center text-[0.72rem] font-semibold text-neutral-400">{index + 1}</span>
                            <span className="truncate text-[0.74rem] font-medium text-neutral-700">{product.name}</span>
                            <span className="font-semibold text-neutral-900">
                              {topProductsValueKey === 'amount' ? formatCurrency(value) : value.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="pl-7">
                            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-20 flex items-center justify-center pt-3 text-[0.7rem]">
                  <button className="inline-flex items-center gap-1.5 font-semibold text-primary-600">
                    View Product Report
                    <ChevronRight className="size-4 text-primary-600" />
                  </button>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Top Selling Customers"
              subtitle={rangeLabel}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">{rangeLabel}</span>}
              className="min-h-[300px] [&>div:first-child_h3]:text-[0.78rem]"
            >
              <div className="flex h-full flex-col">
                {topCustomers.length === 0 ? (
                  <p className="text-[0.72rem] text-neutral-400">No sales in this period yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topCustomers.map((customer, index) => {
                      const width = Math.max(8, Math.round((customer.value / topCustomerPeak) * 100))
                      return (
                        <div key={customer.name} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-[0.78rem]">
                            <span className="truncate font-medium text-neutral-700">{customer.name}</span>
                            <span className="shrink-0 font-semibold text-neutral-900">{formatCurrency(customer.value)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                            <div className={`h-full rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-blue-400'}`} style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-44 flex items-center justify-center pt-3 text-[0.7rem]">
                  <button className="inline-flex items-center gap-1.5 font-semibold text-primary-600">
                    View Customer Report
                    <ChevronRight className="size-4 text-primary-600" />
                  </button>
                </div>
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <DashboardCard
              title="Recent Orders"
              subtitle="Latest sales orders across the organization"
              actions={
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={recentOrdersSearch}
                    onChange={(event) => setRecentOrdersSearch(event.target.value)}
                    placeholder="Search orders..."
                    className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
              }
            >
              <DataTable
                columns={[
                  { key: 'orderNumber', header: 'Order #', sortable: true },
                  { key: 'customerName', header: 'Customer', sortable: true },
                  {
                    key: 'status',
                    header: 'Status',
                    sortable: true,
                    render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'}>{formatStatusLabel(row.status)}</Badge>,
                  },
                  {
                    key: 'paymentStatus',
                    header: 'Payment',
                    sortable: true,
                    render: (row) => <Badge variant={paymentVariant[row.paymentStatus] || 'neutral'} dot>{formatStatusLabel(row.paymentStatus)}</Badge>,
                  },
                  { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
                  { key: 'orderDate', header: 'Date', sortable: true },
                ]}
                data={filteredRecentOrders}
                searchable={false}
                pageSize={5}
                actions={(row) => [
                  { label: 'View order', icon: MoreHorizontal, onClick: () => {} },
                  ...(row.status !== 'cancelled' && row.status !== 'delivered'
                    ? [{ label: 'Cancel order', icon: Ban, danger: true, onClick: () => {} }]
                    : []),
                ]}
              />
            </DashboardCard>

            <DashboardCard
              title="Important Reports"
              subtitle="Quick links"
              actions={
                <button className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-primary-600">
                  All Reports
                  <ChevronRight className="size-4" />
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {[
                  'Sales Report',
                  'Purchase Report',
                  'Profit & Loss',
                  'Cash Flow Report',
                  'Inventory Report',
                  'Tax Report',
                  'AR Aging Report',
                  'AP Aging Report',
                  'Stock Valuation',
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="flex items-center gap-2.5 rounded-2xl border border-neutral-100 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-100 text-neutral-600">
                      <BarChart3 className="size-3.5" />
                    </div>
                    <span className="min-w-0 truncate text-[0.78rem] font-medium text-neutral-700">{label}</span>
                  </button>
                ))}
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  )
}
