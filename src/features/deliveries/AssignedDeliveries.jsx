import { Link } from 'react-router-dom'
import { Truck, CheckCircle2, Clock, XCircle, Calendar, Phone } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { deliveries } from '../../mockData/deliveries'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Delivered: 'success',
  'Out for Delivery': 'warning',
  Scheduled: 'info',
  Failed: 'danger',
  Partial: 'info',
  Rescheduled: 'info',
}

export default function AssignedDeliveries() {
  const sortedDeliveries = [...deliveries].sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Assigned Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">View and manage your assigned deliveries</p>
      </div>

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
            { key: 'scheduledDate', header: 'Scheduled Date', sortable: true },
            { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
          ]}
          data={sortedDeliveries}
          searchKeys={['orderNumber', 'customerName', 'status']}
          searchPlaceholder="Search deliveries…"
          actions={(row) => [
            { label: 'View Details', icon: CheckCircle2, onClick: () => {}, to: `/delivery/deliveries/${row.id}` },
            { label: 'Call Customer', icon: Phone, onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
