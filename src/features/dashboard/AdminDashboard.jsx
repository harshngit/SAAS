import { formatCompactCurrency, formatCurrency } from '../../utils/format'
import { dashboardStats } from '../../mockData/dashboardStats'
import { orders } from '../../mockData/orders'
import { expenses } from '../../mockData/expenses'
import {
  Ban,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Filter,
  IndianRupee,
  MoreHorizontal,
  PackagePlus,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import TopProductsBarChart from '../../components/charts/TopProductsBarChart'

const recentOrders = [...orders].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1)).slice(0, 8)
const recentActivity = [...orders].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1)).slice(0, 5)
const salesTrendData = dashboardStats.dailySalesTrend.map((item) => ({
  ...item,
  outflow: Math.round(item.value * 0.42),
}))
const topCustomersData = [...orders]
  .filter((order) => order.status !== 'Cancelled')
  .reduce((map, order) => {
    map.set(order.customerName, (map.get(order.customerName) || 0) + order.total)
    return map
  }, new Map())

const topCustomers = [...topCustomersData.entries()]
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 5)

const expenseGroups = expenses
  .filter((expense) => expense.status !== 'Rejected')
  .reduce((map, expense) => {
    map.set(expense.category, (map.get(expense.category) || 0) + expense.amount)
    return map
  }, new Map())

const expenseBreakdown = [...expenseGroups.entries()]
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

const statusVariant = {
  Draft: 'neutral',
  Confirmed: 'info',
  'Out for Delivery': 'warning',
  Delivered: 'success',
  Cancelled: 'danger',
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
    mint: 'bg-[linear-gradient(135deg,#e2f7df,#c7f0c2)] text-emerald-950 border border-emerald-100',
    amber: 'bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-white',
    violet: 'bg-[linear-gradient(135deg,#7c3aed,#8b5cf6)] text-white',
    cyan: 'bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-white',
    blue: 'bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] text-white',
    pink: 'bg-[linear-gradient(135deg,#be123c,#ec4899)] text-white',
    sky: 'bg-[linear-gradient(135deg,#dbeafe,#bfdbfe)] text-blue-950 border border-blue-100',
  }

  return (
    <div
      className={`relative flex min-h-[132px] flex-col overflow-hidden rounded-[1rem] p-3 shadow-[0_1px_2px_rgb(15_23_42/0.03)] ${toneClasses[tone]}`}
    >
      <div className="pointer-events-none absolute right-3 top-3 flex size-7 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 pr-8">
        <p className="max-w-full break-words text-[0.58rem] font-semibold uppercase leading-3.5 tracking-[0.1em] text-current/72">
          {title}
        </p>
        <p className="mt-1.5 break-words font-(--font-display) text-[1.08rem] font-semibold leading-tight tracking-tight">
          {value}
        </p>
        <p className="mt-1 break-words text-[0.65rem] leading-3.5 text-current/78">{delta}</p>
      </div>
      <p className="mt-auto pt-2.5 break-words text-[0.65rem] font-medium leading-3.5 text-current/82">{footer}</p>
    </div>
  )
}

function StatMini({ label, value, pct, tone = 'green' }) {
  const colors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    red: 'bg-rose-500',
  }

  return (
    <div className="rounded-[0.9rem] bg-neutral-50 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold leading-4 text-neutral-700">{label}</p>
          <p className="mt-0.5 text-[0.65rem] leading-3.5 text-neutral-400">Low stock</p>
        </div>
        <span className="text-[0.7rem] font-semibold text-neutral-500">{value}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${pct}%` }} />
      </div>
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
      className={`p-4 [&>div:first-child]:mb-3 [&>div:first-child_h3]:text-[0.86rem] [&>div:first-child_h3]:leading-[1.15rem] [&>div:first-child_p]:text-[0.76rem] [&>div:first-child_p]:leading-4 ${className}`}
    />
  )
}

export default function AdminDashboard() {
  const todaysSales = dashboardStats.todaysSales
  const monthlySales = dashboardStats.monthlySales
  const purchasesThisMonth = dashboardStats.purchasesThisMonth
  const expensesThisMonth = dashboardStats.expensesThisMonthTotal
  const grossProfit = monthlySales - purchasesThisMonth
  const netProfit = grossProfit - expensesThisMonth
  const inventoryHealth = 92
  const totalReceivables = dashboardStats.outstandingReceivables
  const totalPayables = dashboardStats.outstandingPayables
  const totalOutstanding = totalReceivables + totalPayables
  const topCustomerPeak = topCustomers[0]?.value || 1

  return (
    <div className="space-y-3 rounded-[2rem] bg-[#f5f7fb] p-3 sm:p-4 lg:p-5">
      {/* <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
          aria-label="Open menu"
        >
          <LayoutGrid className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
        </div>
        <div className="relative mx-auto hidden min-w-0 max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search anything..."
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-14 text-sm text-neutral-700 placeholder:text-neutral-400 shadow-[0_1px_2px_rgb(15_23_42/0.03)] focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[0.68rem] font-semibold text-neutral-400">
            ⌘K
          </kbd>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="hidden size-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 sm:inline-flex">
            <Bell className="size-4.5" />
          </button>
          <button type="button" className="flex items-center gap-2 rounded-full bg-transparent px-1 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-700 text-xs font-semibold text-white ring-2 ring-white">
              A
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-neutral-900">Admin User</p>
              <span className="text-xs font-medium text-neutral-500">Administrator</span>
            </div>
            <ChevronDown className="size-4 text-neutral-400" />
          </button>
        </div>
      </div> */}

      <div className="overflow-hidden rounded-[1.15rem] border border-white/70 bg-white p-1.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="grid w-full grid-cols-[108px_214px_repeat(5,minmax(0,1fr))_106px_88px] gap-1.5">
        <FilterBox label="Date Range" value="This Month" />
        <FilterBox label="Range" value="01 May 2025 - 31 May 2025" />
        <FilterBox label="Company" value="All Companies" />
        <FilterBox label="Branch" value="All Branches" />
        <FilterBox label="Warehouse" value="All Warehouses" />
        <FilterBox label="Customer" value="All Customers" />
        <FilterBox label="Supplier" value="All Suppliers" />
        <button
          type="button"
          className="inline-flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-white px-2.5 py-1.5 text-[0.73rem] font-semibold text-primary-700 shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors hover:bg-primary-50"
        >
          <Filter className="size-3 shrink-0" />
          More Filters
        </button>
        <button
          type="button"
          className="inline-flex h-12 min-w-0 items-center justify-center rounded-xl bg-primary-600 px-3 py-1.5 text-[0.73rem] font-semibold text-white shadow-[0_12px_24px_-14px_rgb(6_59_0/0.45)] transition-colors hover:bg-primary-700"
        >
          Apply
        </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiCard
          title="Today's Sales"
          value={formatCurrency(todaysSales)}
          delta="Orders 12 • Pending 6 • To Deliver 4"
          footer="View Sales"
          icon={IndianRupee}
          tone="green"
        />
        <KpiCard
          title="This Month Sales"
          value={formatCurrency(monthlySales)}
          delta="+8.4% vs last month"
          footer="View Sales Report"
          icon={Wallet}
          tone="mint"
        />
        <KpiCard
          title="Purchases"
          value={formatCurrency(purchasesThisMonth)}
          delta="+6.3% vs last month"
          footer="View Purchase Report"
          icon={ShoppingCart}
          tone="amber"
        />
        <KpiCard
          title="Expenses"
          value={formatCurrency(expensesThisMonth)}
          delta="+3.6% vs last month"
          footer="View Expense Report"
          icon={CreditCard}
          tone="violet"
        />
        <KpiCard
          title="Gross Profit"
          value={formatCurrency(grossProfit)}
          delta="+15.8% vs last month"
          footer="View Profit & Loss"
          icon={TrendingUp}
          tone="cyan"
        />
        <KpiCard
          title="Net Profit"
          value={formatCurrency(netProfit)}
          delta="+18.7% vs last month"
          footer="View Profit & Loss"
          icon={CircleDollarSign}
          tone="blue"
        />
        <KpiCard
          title="New Customers"
          value={dashboardStats.totalCustomers}
          delta="+9.2% vs last month"
          footer="View Customers"
          icon={Users}
          tone="sky"
        />
        <KpiCard
          title="Sales Growth"
          value="+12%"
          delta="vs last month"
          footer="View Growth Report"
          icon={Sparkles}
          tone="pink"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <DashboardCard className="border-neutral-100 p-2.5">
            <div className="grid grid-cols-5 gap-1.5">
              <button className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.8rem] bg-white px-1 py-1 text-center text-primary-700 ring-1 ring-neutral-100">
                <ShoppingCart className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">New</span>
                  <span className="block whitespace-nowrap">Sale</span>
                </span>
              </button>
              <button className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.8rem] bg-white px-1 py-1 text-center text-primary-700 ring-1 ring-neutral-100">
                <PackagePlus className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">New</span>
                  <span className="block whitespace-nowrap">Purchase</span>
                </span>
              </button>
              <button className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.8rem] bg-white px-1 py-1 text-center text-primary-700 ring-1 ring-neutral-100">
                <Wallet className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">Collect</span>
                  <span className="block whitespace-nowrap">Payment</span>
                </span>
              </button>
              <button className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.8rem] bg-white px-1 py-1 text-center text-primary-700 ring-1 ring-neutral-100">
                <Clock className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">Pending</span>
                  <span className="block whitespace-nowrap">Orders</span>
                </span>
              </button>
              <button className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[0.8rem] bg-white px-1 py-1 text-center text-primary-700 ring-1 ring-neutral-100">
                <MoreHorizontal className="size-3.5 shrink-0" />
                <span className="max-w-full text-[0.58rem] font-semibold leading-[0.72rem]">
                  <span className="block whitespace-nowrap">More</span>
                  <span className="block whitespace-nowrap">Actions</span>
                </span>
              </button>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Business Health Score"
            actions={<MoreHorizontal className="size-4 text-neutral-300" />}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-(--font-display) text-2xl font-semibold tracking-tight text-emerald-700">{inventoryHealth}%</p>
                <p className="mt-0.5 text-[0.72rem] font-medium text-emerald-600">Excellent</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[0.72rem] text-neutral-600">
                <span>Sales Growth</span>
                <span className="size-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="flex items-center justify-between text-[0.72rem] text-neutral-600">
                <span>Inventory Health</span>
                <span className="size-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="flex items-center justify-between text-[0.72rem] text-neutral-600">
                <span>Cash Flow</span>
                <span className="size-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="flex items-center justify-between text-[0.72rem] text-neutral-600">
                <span>Receivables</span>
                <span className="size-2.5 rounded-full bg-amber-500" />
              </div>
              <div className="flex items-center justify-between text-[0.72rem] text-neutral-600">
                <span>Expenses</span>
                <span className="size-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>
            <div className="mt-3 h-16 overflow-hidden rounded-[1rem] bg-linear-to-r from-white to-emerald-50/80 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrendData}>
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between text-[0.7rem]">
              <button className="font-semibold text-primary-600">View Health Report</button>
              <ChevronRight className="size-4 text-primary-600" />
            </div>
          </DashboardCard>

          <DashboardCard
            title="Stock Watch"
            actions={<span className="text-[0.7rem] font-semibold text-primary-600">View all</span>}
            className="[&>div:first-child]:mb-3"
          >
            <div className="space-y-2.5">
              <StatMini label="Sparkling Water (750ml)" value="36%" pct={36} tone="green" />
              <StatMini label="Flavored Water - Orange (500ml)" value="52%" pct={52} tone="amber" />
              <StatMini label="Alkaline Water (1L)" value="72%" pct={72} tone="blue" />
            </div>
          </DashboardCard>

          <DashboardCard
            title="Recent Activity"
            actions={<span className="text-[0.7rem] font-semibold text-primary-600">View all</span>}
            className=" mt-5 min-h-[310px]"
          >
            <div className="flex min-h-[220px] flex-col justify-between">
              {recentActivity.slice(0, 5).map((order, index) => (
                <div key={order.id} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    {order.customerName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.78rem] font-medium leading-4 text-neutral-800">{order.customerName}</p>
                    <p className="mt-0.5 text-[0.68rem] leading-3.5 text-neutral-400">
                      {order.orderNumber} · {order.status}
                    </p>
                  </div>
                  <span className="text-[0.65rem] text-neutral-400">{index === 0 ? '2m' : `${index * 7}m`}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
            <DashboardCard
              title="Cashflow"
              subtitle={`Total balance ${formatCurrency(dashboardStats.yearlySales)}`}
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">This Month</span>}
            >
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={salesTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#edf1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={44} />
                  <Tooltip content={<CashflowTooltip />} cursor={{ fill: '#f8f9fa' }} />
                  <Bar name="Inflow" dataKey="value" fill="#14532d" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar name="Outflow" dataKey="outflow" fill="#d1d5db" radius={[6, 6, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </DashboardCard>

            <DashboardCard
              title="Receivables vs Payables"
              subtitle="This Month"
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">This Month</span>}
            >
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Receivables', value: totalReceivables },
                        { name: 'Payables', value: totalPayables },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={4}
                      stroke="none"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[0.7rem] text-neutral-400">Net Outstanding</p>
                  <p className="font-(--font-display) text-xl font-semibold text-neutral-900">{formatCurrency(totalOutstanding)}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1.5 text-[0.78rem]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    Receivables
                  </span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(totalReceivables)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="size-2.5 rounded-full bg-blue-500" />
                    Payables
                  </span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(totalPayables)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end text-[0.7rem]">
                <button className="font-semibold text-primary-600">View A/R Report</button>
                <ChevronRight className="size-4 text-primary-600" />
              </div>
            </DashboardCard>

            <DashboardCard
              title={
                <>
                  <span className="whitespace-nowrap">Top 5 Customers</span>
                  <br />
                  <span className="whitespace-nowrap">by Sales</span>
                </>
              }
              subtitle="This Month"
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">This Month</span>}
              className="[&>div:first-child_h3]:text-[0.78rem]"
            >
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
              <div className="mt-3 flex items-center justify-end text-[0.7rem]">
                <button className="font-semibold text-primary-600">View Customer Report</button>
                <ChevronRight className="size-4 text-primary-600" />
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <DashboardCard title="Top Selling Products" subtitle="Amount" className="h-full [&>div:first-child]:mb-4">
              <TopProductsBarChart data={dashboardStats.topProducts} height={320} />
            </DashboardCard>

            <DashboardCard
              title="Expense Breakdown"
              subtitle="This Month"
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">This Month</span>}
              className="h-full [&>div:first-child]:mb-4"
            >
              <div className="relative">
                <ResponsiveContainer width="100%" height={175}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#94a3b8'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[0.7rem] text-neutral-400">Total Expenses</p>
                  <p className="font-(--font-display) text-lg font-semibold text-neutral-900">{formatCurrency(expensesThisMonth)}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[0.78rem]">
                {expenseBreakdown.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#94a3b8'][index % 5] }} />
                      {entry.name}
                    </span>
                    <span className="font-semibold text-neutral-900">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end text-[0.7rem]">
                <button className="font-semibold text-primary-600">View Expense Report</button>
                <ChevronRight className="size-4 text-primary-600" />
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <DashboardCard
              title="Sales Trend"
              subtitle="This Month"
              actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-[0.68rem] font-semibold text-neutral-500">This Month</span>}
              className="self-start"
            >
              <ResponsiveContainer width="100%" height={185}>
                <LineChart data={salesTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#edf1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={40} />
                  <Tooltip content={<CashflowTooltip />} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center justify-end text-[0.7rem]">
                <button className="font-semibold text-primary-600">View Sales Report</button>
                <ChevronRight className="size-4 text-primary-600" />
              </div>
            </DashboardCard>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:col-span-2 lg:grid-cols-[320px_minmax(0,1fr)]">
          <DashboardCard title="Important Reports" subtitle="Quick links">
            <div className="grid grid-cols-1 gap-1.5">
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
                  className="flex items-center gap-2.5 rounded-[0.85rem] border border-neutral-100 bg-white px-3 py-2 text-left shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <div className="flex size-7 items-center justify-center rounded-lg bg-neutral-50 text-neutral-700 ring-1 ring-neutral-100">
                    <BarChart3 className="size-3.5" />
                  </div>
                  <span className="text-[0.76rem] font-medium text-neutral-700">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end text-[0.7rem]">
              <button className="font-semibold text-primary-600">All Reports</button>
              <ChevronRight className="size-4 text-primary-600" />
            </div>
          </DashboardCard>

          <DashboardCard
            title="Recent Orders"
            subtitle="Latest sales orders across the organization"
            actions={<div className="flex items-center gap-2 text-[0.7rem] text-neutral-400"><Search className="size-3.5" />Search orders...</div>}
          >
            <DataTable
              columns={[
                { key: 'orderNumber', header: 'Order #', sortable: true },
                { key: 'customerName', header: 'Customer', sortable: true },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'}>{row.status}</Badge>,
                },
                {
                  key: 'paymentStatus',
                  header: 'Payment',
                  sortable: true,
                  render: (row) => <Badge variant={paymentVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
                },
                { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
                { key: 'orderDate', header: 'Date', sortable: true },
              ]}
              data={recentOrders}
              searchKeys={['orderNumber', 'customerName', 'status']}
              searchPlaceholder="Search orders..."
              pageSize={5}
              actions={(row) => [
                { label: 'View order', icon: MoreHorizontal, onClick: () => {} },
                ...(row.status !== 'Cancelled' && row.status !== 'Delivered'
                  ? [{ label: 'Cancel order', icon: Ban, danger: true, onClick: () => {} }]
                  : []),
              ]}
            />
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
