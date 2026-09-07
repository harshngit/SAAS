import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Wallet } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { usePermission } from '../../auth/usePermission'
import { listInvoices } from '../../api/invoices'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { isOpenReceivable } from './invoiceHelpers'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

export default function SalesInvoices() {
  const navigate = useNavigate()
  const { can } = usePermission()
  // Recording a customer payment is a financial transaction - gate it on payments:create only.
  const canRecordPayment = can('payments', 'create')
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    listInvoices().then((result) => {
      if (!result.success) {
        setError(result.error)
      } else {
        setError('')
        setInvoices(result.invoices)
      }
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Sales Invoices</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all customer sales invoices</p>
      </div>

      <Card title="Sales Invoices">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            {
              key: 'invoiceNumber',
              header: 'Invoice #',
              sortable: true,
              render: (row) => (
                <button type="button" onClick={() => navigate(`/accounts/invoices/sales/${row.id}`)} className="font-medium text-primary-700 hover:underline">
                  {row.invoiceNumber}
                </button>
              ),
            },
            { key: 'customerName', header: 'Customer', sortable: true, render: (row) => row.customerName || row.walkInName || '—' },
            { key: 'invoiceDate', header: 'Date', sortable: true },
            {
              key: 'paymentStatus',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
            },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
            { key: 'outstandingAmount', header: 'Outstanding', sortable: true, align: 'right', render: (row) => formatCurrency(row.outstandingAmount) },
          ]}
          data={invoices}
          searchKeys={['invoiceNumber', 'customerName', 'paymentStatus']}
          searchPlaceholder="Search sales invoices..."
          onRowClick={(row) => navigate(`/accounts/invoices/sales/${row.id}`)}
          actions={(row) => [
            ...(canRecordPayment && isOpenReceivable(row)
              ? [{ label: 'Record Payment', icon: Wallet, onClick: () => setPaymentInvoice(row) }]
              : []),
            { label: 'View Invoice', icon: Eye, onClick: () => navigate(`/accounts/invoices/sales/${row.id}`) },
          ]}
        />
      </Card>

      <RecordPaymentDrawer
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSave={() => {
          setPaymentInvoice(null)
          load()
        }}
      />
    </div>
  )
}
