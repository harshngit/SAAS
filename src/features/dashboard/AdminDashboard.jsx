import {
  IndianRupee,
  CalendarDays,
  CalendarRange,
  PackagePlus,
  AlertTriangle,
  Clock,
  Truck,
  Wallet,
  CreditCard,
  Eye,
  Ban,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import SalesLineChart from '../../components/charts/SalesLineChart'
import TopProductsBarChart from '../../components/charts/TopProductsBarChart'
import { dashboardStats } from '../../mockData/dashboardStats'
import { orders } from '../../mockData/orders'
import { formatCurrency } from '../../utils/format'

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

const recentOrders = [...orders].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1)).slice(0, 10)

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">SAAS Distributors · as of {dashboardStats.asOf}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="success" label="Today's Sales" value={formatCurrency(dashboardStats.todaysSales)} />
        <StatCard icon={CalendarDays} iconVariant="primary" label="Monthly Sales" value={formatCurrency(dashboardStats.monthlySales)} />
        <StatCard icon={CalendarRange} iconVariant="info" label="Yearly Sales" value={formatCurrency(dashboardStats.yearlySales)} />
        <StatCard icon={PackagePlus} iconVariant="neutral" label="Purchases This Month" value={formatCurrency(dashboardStats.purchasesThisMonth)} />
        <StatCard icon={AlertTriangle} iconVariant="warning" label="Low Stock Items" value={dashboardStats.lowStockCount} />
        <StatCard icon={Clock} iconVariant="info" label="Pending Orders" value={dashboardStats.pendingOrdersCount} />
        <StatCard icon={Truck} iconVariant="warning" label="Pending Deliveries" value={dashboardStats.pendingDeliveries} />
        <StatCard icon={Wallet} iconVariant="success" label="Outstanding Receivables" value={formatCurrency(dashboardStats.outstandingReceivables)} />
        <StatCard icon={CreditCard} iconVariant="danger" label="Outstanding Payables" value={formatCurrency(dashboardStats.outstandingPayables)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Sales Trend" subtitle="Daily sales this month" className="lg:col-span-2">
          <SalesLineChart data={dashboardStats.dailySalesTrend} />
        </Card>
        <Card title="Top Products" subtitle="By revenue this month">
          <TopProductsBarChart data={dashboardStats.topProducts} />
        </Card>
      </div>

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
          searchPlaceholder="Search orders…"
          actions={(row) => [
            { label: 'View order', icon: Eye, onClick: () => {} },
            ...(row.status !== 'Cancelled' && row.status !== 'Delivered'
              ? [{ label: 'Cancel order', icon: Ban, danger: true, onClick: () => {} }]
              : []),
          ]}
        />
      </Card>
    </div>
  )
}
