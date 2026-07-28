import { Users, MapPin, BellRing, ShoppingCart, CheckCircle2, CalendarClock, Phone } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { customers } from '../../mockData/customers'
import { orders } from '../../mockData/orders'
import { visits } from '../../mockData/visits'
import { dashboardStats } from '../../mockData/dashboardStats'
import { formatCurrency } from '../../utils/format'

const TODAY = '2026-07-17'
const CURRENT_USER_ID = 'usr-3'
const MONTHLY_TARGET = 80000

const statusVariant = {
  Completed: 'success',
  Scheduled: 'info',
  'Follow-up Required': 'warning',
  Missed: 'danger',
}

const assignedCustomers = customers.filter((customer) => customer.assignedSalesOfficerId === CURRENT_USER_ID)
const visitsToday = visits.filter((visit) => visit.date === TODAY).length
const pendingFollowUps = visits.filter((visit) => visit.status === 'Follow-up Required').length
const ordersCreated = orders.filter((order) => order.salesOfficerId === CURRENT_USER_ID).length
const targetProgress = Math.min(100, Math.round((dashboardStats.monthlySales / MONTHLY_TARGET) * 100))

const upcomingVisits = [...visits].sort((a, b) => (a.date < b.date ? -1 : 1))

export default function SalesOfficerDashboard() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">My Dashboard</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Vikram Singh · Sales Officer · as of {TODAY}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} iconVariant="primary" label="Assigned Customers" value={assignedCustomers.length} />
        <StatCard icon={MapPin} iconVariant="info" label="Visits Today" value={visitsToday} />
        <StatCard icon={BellRing} iconVariant="warning" label="Pending Follow-ups" value={pendingFollowUps} />
        <StatCard icon={ShoppingCart} iconVariant="success" label="Orders Created" value={ordersCreated} />
      </div>

      <Card title="Monthly Sales Target" subtitle={`${formatCurrency(dashboardStats.monthlySales)} of ${formatCurrency(MONTHLY_TARGET)} target`}>
        <div className="flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-semibold text-neutral-900">{targetProgress}%</span>
        </div>
      </Card>

      <Card title="My Visits" subtitle="Scheduled, completed, and follow-ups">
        <DataTable
          columns={[
            { key: 'customerName', header: 'Customer', sortable: true },
            { key: 'purpose', header: 'Purpose' },
            { key: 'date', header: 'Date', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
          ]}
          data={upcomingVisits}
          rowKey="id"
          searchKeys={['customerName', 'purpose', 'status']}
          searchPlaceholder="Search visits…"
          actions={() => [
            { label: 'Mark completed', icon: CheckCircle2, onClick: () => {} },
            { label: 'Reschedule', icon: CalendarClock, onClick: () => {} },
            { label: 'Call customer', icon: Phone, onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
