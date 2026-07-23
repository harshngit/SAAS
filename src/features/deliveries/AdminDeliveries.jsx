import { Truck, CheckCircle2, Clock, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import { deliveries } from '../../mockData/deliveries'
import { users } from '../../mockData/users'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Delivered: 'success',
  'Out for Delivery': 'warning',
  Scheduled: 'info',
  Failed: 'danger',
  Partial: 'info',
  Rescheduled: 'info',
}

const userName = (id) => users.find((user) => user.id === id)?.name || 'Unassigned'

export default function AdminDeliveries() {
  const rows = [...deliveries]
    .map((delivery) => ({ ...delivery, partnerName: userName(delivery.deliveryPartnerId) }))
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))

  const delivered = rows.filter((row) => row.status === 'Delivered').length
  const inProgress = rows.filter((row) => row.status === 'Out for Delivery' || row.status === 'Scheduled').length
  const failed = rows.filter((row) => row.status === 'Failed').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">Track every delivery across your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Truck} label="Total Deliveries" value={rows.length} iconVariant="primary" />
        <StatCard icon={CheckCircle2} label="Delivered" value={delivered} iconVariant="success" />
        <StatCard icon={Clock} label="In Progress" value={inProgress} iconVariant="warning" />
        <StatCard icon={XCircle} label="Failed" value={failed} iconVariant="danger" />
      </div>

      <Card title="All Deliveries" subtitle="Scheduled, out for delivery, and completed">
        <DataTable
          columns={[
            { key: 'orderNumber', header: 'Order #', sortable: true },
            { key: 'customerName', header: 'Customer', sortable: true },
            { key: 'partnerName', header: 'Delivery Partner', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
            { key: 'scheduledDate', header: 'Scheduled Date', sortable: true },
            { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
          ]}
          data={rows}
          searchKeys={['orderNumber', 'customerName', 'partnerName', 'status']}
          searchPlaceholder="Search deliveries…"
        />
      </Card>
    </div>
  )
}
