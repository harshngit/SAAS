import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { orders } from '../../mockData/orders'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
}

export default function SalesInvoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Sales Invoices</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all customer sales invoices</p>
      </div>

      <Card title="Sales Invoices">
        <DataTable
          columns={[
            { key: 'orderNumber', header: 'Invoice #', sortable: true },
            { key: 'customerName', header: 'Customer', sortable: true },
            { key: 'date', header: 'Date', sortable: true },
            {
              key: 'paymentStatus',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
            },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
          ]}
          data={orders}
          searchKeys={['orderNumber', 'customerName', 'paymentStatus']}
          searchPlaceholder="Search sales invoices..."
        />
      </Card>
    </div>
  )
}
