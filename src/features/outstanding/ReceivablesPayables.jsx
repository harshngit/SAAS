import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { customers } from '../../mockData/customers'
import { formatCurrency } from '../../utils/format'

// Mock payables data
const suppliers = [
  { id: 'SUP-001', name: 'Prime Suppliers', totalOutstanding: 45000, overdue: 15000 },
  { id: 'SUP-002', name: 'Packaging Co.', totalOutstanding: 32000, overdue: 0 },
  { id: 'SUP-003', name: 'Logistics Partners', totalOutstanding: 28000, overdue: 8000 },
]

const statusVariant = {
  Overdue: 'danger',
  'No Overdue': 'success',
}

export default function ReceivablesPayables() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Receivables & Payables</h1>
        <p className="mt-1 text-sm text-neutral-500">Track customer receivables and supplier payables</p>
      </div>

      <Tabs defaultValue="receivables" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receivables">Receivables (Customers)</TabsTrigger>
          <TabsTrigger value="payables">Payables (Suppliers)</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables">
          <Card title="Customer Receivables">
            <DataTable
              columns={[
                { key: 'id', header: 'Customer ID', sortable: true },
                { key: 'name', header: 'Customer Name', sortable: true },
                { key: 'totalOutstanding', header: 'Total Outstanding', sortable: true, align: 'right', render: (row) => formatCurrency(row.totalOutstanding) },
                { key: 'overdue', header: 'Overdue Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.overdue) },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (row) => (
                    <Badge variant={row.overdue > 0 ? statusVariant.Overdue : statusVariant['No Overdue']} dot>
                      {row.overdue > 0 ? 'Overdue' : 'No Overdue'}
                    </Badge>
                  ),
                },
              ]}
              data={customers}
              searchKeys={['id', 'name']}
              searchPlaceholder="Search customers..."
            />
          </Card>
        </TabsContent>

        <TabsContent value="payables">
          <Card title="Supplier Payables">
            <DataTable
              columns={[
                { key: 'id', header: 'Supplier ID', sortable: true },
                { key: 'name', header: 'Supplier Name', sortable: true },
                { key: 'totalOutstanding', header: 'Total Outstanding', sortable: true, align: 'right', render: (row) => formatCurrency(row.totalOutstanding) },
                { key: 'overdue', header: 'Overdue Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.overdue) },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (row) => (
                    <Badge variant={row.overdue > 0 ? statusVariant.Overdue : statusVariant['No Overdue']} dot>
                      {row.overdue > 0 ? 'Overdue' : 'No Overdue'}
                    </Badge>
                  ),
                },
              ]}
              data={suppliers}
              searchKeys={['id', 'name']}
              searchPlaceholder="Search suppliers..."
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
