import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { purchases } from '../../mockData/purchases'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
}

export default function PurchaseInvoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Purchase Invoices</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all supplier purchase invoices</p>
      </div>

      <Card title="Purchase Invoices">
        <DataTable
          columns={[
            { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
            { key: 'supplierName', header: 'Supplier', sortable: true },
            { key: 'date', header: 'Date', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
          ]}
          data={purchases}
          searchKeys={['invoiceNumber', 'supplierName', 'status']}
          searchPlaceholder="Search purchase invoices..."
        />
      </Card>
    </div>
  )
}
