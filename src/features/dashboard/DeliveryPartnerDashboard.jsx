import { Truck, CheckCircle2, Clock, Wallet, PackageX, Phone, MessageSquareWarning } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { deliveries } from '../../mockData/deliveries'
import { dashboardStats } from '../../mockData/dashboardStats'
import { formatCurrency } from '../../utils/format'

const TODAY = '2026-07-17'

const statusVariant = {
  Delivered: 'success',
  'Out for Delivery': 'warning',
  Scheduled: 'info',
  Failed: 'danger',
}

const deliveriesToday = deliveries.filter((delivery) => delivery.scheduledDate === TODAY).length
const completedCount = deliveries.filter((delivery) => delivery.status === 'Delivered').length
const expectedCollectionsToday = deliveries
  .filter((delivery) => delivery.scheduledDate === TODAY && delivery.status !== 'Delivered')
  .reduce((sum, delivery) => sum + delivery.amountDue, 0)

const sortedDeliveries = [...deliveries].sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))

export default function DeliveryPartnerDashboard() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">My Deliveries</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Suresh Kumar · Delivery Partner · as of {TODAY}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} iconVariant="primary" label="Deliveries Today" value={deliveriesToday} />
        <StatCard icon={CheckCircle2} iconVariant="success" label="Completed" value={completedCount} />
        <StatCard icon={Clock} iconVariant="warning" label="Pending" value={dashboardStats.pendingDeliveries} />
        <StatCard
          icon={Wallet}
          iconVariant="info"
          label="Expected Collections Today"
          value={formatCurrency(expectedCollectionsToday)}
        />
      </div>

      <Card title="Vehicle Stock — Restock Needed" subtitle="Warehouse items running low before your next load">
        {dashboardStats.lowStockProducts.length === 0 ? (
          <p className="text-sm text-neutral-400">All stocked up — nothing needs restocking right now.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dashboardStats.lowStockProducts.map((name) => (
              <Badge key={name} variant="warning" dot>
                <PackageX className="size-3" aria-hidden="true" />
                {name}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card title="All Deliveries" subtitle="Scheduled, out for delivery, and completed">
        <DataTable
          columns={[
            { key: 'orderNumber', header: 'Order #', sortable: true },
            { key: 'customerName', header: 'Customer', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
            { key: 'scheduledDate', header: 'Scheduled', sortable: true },
            { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
          ]}
          data={sortedDeliveries}
          searchKeys={['orderNumber', 'customerName', 'status']}
          searchPlaceholder="Search deliveries…"
          actions={(row) => [
            ...(row.status !== 'Delivered' ? [{ label: 'Mark delivered', icon: CheckCircle2, onClick: () => {} }] : []),
            { label: 'Call customer', icon: Phone, onClick: () => {} },
            { label: 'Report issue', icon: MessageSquareWarning, danger: true, onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
