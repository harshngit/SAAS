import { Wallet, CreditCard, HandCoins, Receipt, FileWarning, Send, CircleCheck, Eye } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import CategoryPieChart from '../../components/charts/CategoryPieChart'
import { dashboardStats } from '../../mockData/dashboardStats'
import { orders } from '../../mockData/orders'
import { formatCurrency } from '../../utils/format'

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

const overdueInvoices = orders.filter((order) => order.status === 'Delivered' && order.balanceDue > 0)
const isGstCredit = dashboardStats.gstSummary.netPayable < 0

export default function AccountantDashboard() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">Accounts Overview</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Priya Nair · Accountant · as of {dashboardStats.asOf}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Wallet} iconVariant="success" label="Outstanding Receivables" value={formatCurrency(dashboardStats.outstandingReceivables)} />
        <StatCard icon={CreditCard} iconVariant="danger" label="Outstanding Payables" value={formatCurrency(dashboardStats.outstandingPayables)} />
        <StatCard icon={HandCoins} iconVariant="info" label="Pending Cash Handover" value={formatCurrency(dashboardStats.cashPendingHandover)} />
        <StatCard icon={Receipt} iconVariant="neutral" label="Expenses This Month" value={formatCurrency(dashboardStats.expensesThisMonthTotal)} />
        <StatCard icon={FileWarning} iconVariant="warning" label="Overdue Invoices" value={dashboardStats.overdueInvoicesCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="GST Summary" subtitle="This financial year, computed from sales & purchase invoices" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-neutral-500">Output GST (Sales)</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{formatCurrency(dashboardStats.gstSummary.outputGst)}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Input GST (Purchases)</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{formatCurrency(dashboardStats.gstSummary.inputGst)}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">{isGstCredit ? 'Net GST Refundable' : 'Net GST Payable'}</p>
              <p className={`mt-1 text-xl font-semibold ${isGstCredit ? 'text-green-600' : 'text-neutral-900'}`}>
                {formatCurrency(Math.abs(dashboardStats.gstSummary.netPayable))}
              </p>
            </div>
          </div>
        </Card>
        <Card title="Payment Status" subtitle="Across active sales orders">
          <CategoryPieChart data={dashboardStats.paymentStatusChartData} />
        </Card>
      </div>

      <Card title="Overdue Customer Invoices" subtitle="Delivered orders with an outstanding balance">
        <DataTable
          columns={[
            { key: 'orderNumber', header: 'Order #', sortable: true },
            { key: 'customerName', header: 'Customer', sortable: true },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
            { key: 'balanceDue', header: 'Balance Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.balanceDue) },
            {
              key: 'paymentStatus',
              header: 'Payment',
              sortable: true,
              render: (row) => <Badge variant={paymentVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
            },
          ]}
          data={overdueInvoices}
          searchKeys={['orderNumber', 'customerName']}
          searchPlaceholder="Search invoices…"
          emptyTitle="No overdue invoices"
          emptyDescription="Every delivered order has been fully paid."
          actions={() => [
            { label: 'View invoice', icon: Eye, onClick: () => {} },
            { label: 'Send reminder', icon: Send, onClick: () => {} },
            { label: 'Mark as paid', icon: CircleCheck, onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
