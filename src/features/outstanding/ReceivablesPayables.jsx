import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { getReport } from '../../api/reports'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Overdue: 'danger',
  'No Overdue': 'success',
}

function normalizeRow(row, kind) {
  return {
    id: row.id || row.customer_id || row.supplier_id || row[`${kind}_id`],
    name: row.name || row.customer_name || row.supplier_name || '—',
    totalOutstanding: row.outstanding_amount ?? row.outstanding ?? row.total_outstanding ?? 0,
    overdue: row.overdue_amount ?? row.overdue ?? 0,
  }
}

function OutstandingPanel({ reportType, kind, emptyLabel }) {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    getReport(reportType).then((result) => {
      if (!isMounted) return
      if (!result.success) {
        setError(result.error)
      } else {
        setRows((result.report?.rows || []).map((row) => normalizeRow(row, kind)))
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [reportType, kind])

  return (
    <Card title={emptyLabel}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <DataTable
        loading={isLoading}
        columns={[
          { key: 'id', header: `${kind === 'customer' ? 'Customer' : 'Supplier'} ID`, sortable: true },
          { key: 'name', header: `${kind === 'customer' ? 'Customer' : 'Supplier'} Name`, sortable: true },
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
        data={rows}
        searchKeys={['id', 'name']}
        searchPlaceholder={`Search ${kind === 'customer' ? 'customers' : 'suppliers'}...`}
      />
    </Card>
  )
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
          <OutstandingPanel reportType="customer-outstanding" kind="customer" emptyLabel="Customer Receivables" />
        </TabsContent>

        <TabsContent value="payables">
          <OutstandingPanel reportType="supplier-outstanding" kind="supplier" emptyLabel="Supplier Payables" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
