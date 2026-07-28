import {
  Ban,
  CalendarDays,
  Clock,
  CreditCard,
  Eye,
  IndianRupee,
  MoreVertical,
  PackagePlus,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import TopProductsBarChart from '../../components/charts/TopProductsBarChart'
import { dashboardStats } from '../../mockData/dashboardStats'
import { orders } from '../../mockData/orders'
import { formatCompactCurrency, formatCurrency } from '../../utils/format'

const statusVariant = {
  Draft: 'neutral',
  Confirmed: 'info',
  'Out for Delivery': 'warning',
  Delivered: 'success',
  Cancelled: 'danger',
}

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

const paymentColors = {
  Paid: '#063b00',
  Partial: '#111827',
  Unpaid: '#9aa1ac',
}

const recentOrders = [...orders].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1)).slice(0, 10)
const chartData = dashboardStats.dailySalesTrend.map((item) => ({
  ...item,
  expense: Math.round(item.value * 0.42),
}))
const lowStockTotal = dashboardStats.lowStockProducts.length
const inventoryHealth = Math.max(0, Math.min(100, Math.round(((18 - lowStockTotal) / 18) * 100)))

function MiniAction({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[0.9rem] bg-white p-3 text-primary-700 ring-1 ring-neutral-100">
      <Icon className="size-4" aria-hidden="true" />
      <span className="text-[0.68rem] font-semibold">{label}</span>
    </div>
  )
}

function ProgressRow({ label, value, helper, progress }) {
  return (
    <div className="rounded-[1rem] bg-neutral-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-neutral-700">{label}</p>
          <p className="mt-1 text-xs text-neutral-400">{helper}</p>
        </div>
        <MoreVertical className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.68rem]">
        <span className="font-semibold text-neutral-900">{value}</span>
        <span className="text-neutral-400">{progress}%</span>
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

function PaymentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-(--shadow-popover) ring-1 ring-black/5">
      <p className="font-semibold text-neutral-900">{item.name}</p>
      <p className="mt-1 text-neutral-500">{item.value} orders</p>
    </div>
  )
}

export default function AdminDashboard() {
  const totalPaymentOrders = dashboardStats.paymentStatusChartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 px-1 py-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="mt-1.5 text-sm text-neutral-500">SAAS Distributors · as of {dashboardStats.asOf}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[270px_minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[1.25rem] bg-linear-to-br from-primary-500 to-primary-800 p-5 text-white shadow-(--shadow-glow-primary)">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-[0.9rem] bg-white/18 ring-1 ring-white/20">
                <IndianRupee className="size-4.5" aria-hidden="true" />
              </div>
              <TrendingUp className="size-5 text-white/75" aria-hidden="true" />
            </div>
            <p className="mt-6 text-sm font-semibold text-white/75">Today's Sales</p>
            <p className="mt-1 font-(--font-display) text-3xl font-semibold tracking-tight">
              {formatCurrency(dashboardStats.todaysSales)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-white/75">
              <div>
                <p className="font-medium">Pending</p>
                <p className="mt-1 font-semibold text-white">{dashboardStats.pendingOrdersCount}</p>
              </div>
              <div>
                <p className="font-medium">Delivery</p>
                <p className="mt-1 font-semibold text-white">{dashboardStats.pendingDeliveries}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MiniAction icon={PackagePlus} label="Purchase" />
            <MiniAction icon={Truck} label="Deliver" />
            <MiniAction icon={Wallet} label="Collect" />
            <MiniAction icon={Clock} label="Pending" />
          </div>

          <Card title="Inventory Health" actions={<MoreVertical className="size-4 text-neutral-300" aria-hidden="true" />}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">{dashboardStats.lowStockCount} low stock items</span>
              <span className="font-semibold text-neutral-900">{inventoryHealth}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-primary-600" style={{ width: `${inventoryHealth}%` }} />
            </div>
          </Card>

          <Card title="Stock Watch" actions={<span className="text-xs font-semibold text-primary-600">View all</span>}>
            <div className="space-y-2">
              {dashboardStats.lowStockProducts.slice(0, 3).map((productName, index) => (
                <ProgressRow
                  key={productName}
                  label={productName}
                  value="Low stock"
                  helper="Restock recommended"
                  progress={[36, 52, 72][index] || 48}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard icon={CalendarDays} iconVariant="primary" label="Monthly Sales" value={formatCurrency(dashboardStats.monthlySales)} />
            <StatCard icon={CreditCard} iconVariant="danger" label="Outstanding Payables" value={formatCurrency(dashboardStats.outstandingPayables)} />
            <StatCard icon={Wallet} iconVariant="success" label="Outstanding Receivables" value={formatCurrency(dashboardStats.outstandingReceivables)} />
          </div>

          <Card
            title="Cashflow"
            subtitle={`Total balance ${formatCurrency(dashboardStats.yearlySales)}`}
            actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-500">This month</span>}
          >
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f2f4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#9aa1ac' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={44} />
                <Tooltip content={<CashflowTooltip />} cursor={{ fill: '#f8f9fa' }} />
                <Bar name="Sales" dataKey="value" fill="#063b00" radius={[6, 6, 0, 0]} barSize={18} />
                <Bar name="Purchases" dataKey="expense" fill="#d1d5db" radius={[6, 6, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Recent Orders" subtitle="Latest sales orders across the organization">
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
                { label: 'View order', icon: Eye, onClick: () => {} },
                ...(row.status !== 'Cancelled' && row.status !== 'Delivered'
                  ? [{ label: 'Cancel order', icon: Ban, danger: true, onClick: () => {} }]
                  : []),
              ]}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Payment Status"
            actions={<span className="rounded-full bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-500">This month</span>}
          >
            <div className="relative">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={dashboardStats.paymentStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={3}
                    cornerRadius={5}
                    stroke="none"
                  >
                    {dashboardStats.paymentStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={paymentColors[entry.name] || '#4b5563'} />
                    ))}
                  </Pie>
                  <Tooltip content={<PaymentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs text-neutral-400">Orders</p>
                <p className="font-(--font-display) text-2xl font-semibold text-neutral-900">{totalPaymentOrders}</p>
              </div>
            </div>
            <div className="space-y-2">
              {dashboardStats.paymentStatusChartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: paymentColors[item.name] || '#4b5563' }} />
                    <span className="text-neutral-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-neutral-900">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Top Products" subtitle="By revenue this month">
            <TopProductsBarChart data={dashboardStats.topProducts} height={250} />
          </Card>

          <Card title="Recent Activity" actions={<MoreVertical className="size-4 text-neutral-300" aria-hidden="true" />}>
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary-700 ring-1 ring-neutral-100">
                    {order.customerName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{order.customerName}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {order.orderNumber} · {order.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
