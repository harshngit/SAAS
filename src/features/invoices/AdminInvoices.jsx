import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { orders } from '../../mockData/orders'
import { purchases } from '../../mockData/purchases'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

export default function AdminInvoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Invoices</h1>
        <p className="mt-1 text-sm text-neutral-500">All sales and purchase invoices across your organization</p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Invoices</TabsTrigger>
          <TabsTrigger value="purchase">Purchase Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-6">
          <Card title="Sales Invoices" subtitle="Invoices raised against customer orders">
            <DataTable
              columns={[
                { key: 'orderNumber', header: 'Invoice #', sortable: true },
                { key: 'customerName', header: 'Customer', sortable: true },
                { key: 'orderDate', header: 'Date', sortable: true },
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
              searchPlaceholder="Search sales invoices…"
            />
          </Card>
        </TabsContent>

        <TabsContent value="purchase" className="mt-6">
          <Card title="Purchase Invoices" subtitle="Invoices received from suppliers">
            <DataTable
              columns={[
                { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
                { key: 'supplierName', header: 'Supplier', sortable: true },
                { key: 'purchaseDate', header: 'Date', sortable: true },
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
              searchPlaceholder="Search purchase invoices…"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
