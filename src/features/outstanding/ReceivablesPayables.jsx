import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Eye, IndianRupee, Users, Wallet } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import { usePermission } from '../../auth/usePermission'
import { listInvoices } from '../../api/invoices'
import RecordPaymentDrawer from '../invoices/RecordPaymentDrawer'
import { formatCurrency } from '../../utils/format'
import {
  FINANCIAL_STATUS_VARIANT,
  agingBucket,
  daysOverdue,
  financialStatus,
  isInvoiceDueSoon,
  isInvoiceOverdue,
  isOpenReceivable,
} from '../invoices/invoiceHelpers'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Customer receivables only. Supplier outstanding lives under Accounts Payable.
export default function ReceivablesPayables() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const invoiceBase = pathname.startsWith('/accounts') ? '/accounts/invoices/sales' : '/admin/invoices'
  const { can } = usePermission()
  // Recording a customer payment is a financial transaction - gate it on payments:create only.
  const canRecordPayment = can('payments', 'create')

  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState(null)

  const load = () => {
    setIsLoading(true)
    setError('')
    listInvoices().then((result) => {
      if (!result.success) setError(result.error)
      else setInvoices(result.invoices.filter(isOpenReceivable))
      setIsLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const totalOutstanding = invoices.reduce((sum, invoice) => sum + (Number(invoice.outstandingAmount) || 0), 0)
    const overdueAmount = invoices.filter(isInvoiceOverdue).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
    const dueSoonAmount = invoices.filter(isInvoiceDueSoon).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
    const customersWithBalance = new Set(
      invoices.map((invoice) => invoice.customerId || invoice.customerName).filter(Boolean),
    ).size
    return { totalOutstanding, overdueAmount, dueSoonAmount, customersWithBalance }
  }, [invoices])

  const rows = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
        .map((invoice) => ({
          ...invoice,
          _age: agingBucket(invoice),
          _daysOverdue: daysOverdue(invoice),
          _status: financialStatus(invoice),
        })),
    [invoices],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Receivables</h1>
        <p className="mt-1 text-sm text-neutral-500">Track outstanding customer invoices and overdue balances.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Total Outstanding" value={formatCurrency(stats.totalOutstanding)} />
        <StatCard icon={AlertTriangle} iconVariant="danger" label="Overdue" value={formatCurrency(stats.overdueAmount)} />
        <StatCard icon={CalendarClock} iconVariant="warning" label="Due Soon" value={formatCurrency(stats.dueSoonAmount)} />
        <StatCard icon={Users} iconVariant="info" label="Customers with Balance" value={String(stats.customersWithBalance)} />
      </div>

      <Card title="Open Receivables" subtitle="One row per unpaid invoice, soonest due first">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'customerName', header: 'Customer', sortable: true, render: (row) => row.customerName || row.walkInName || '—' },
            {
              key: 'invoiceNumber',
              header: 'Invoice #',
              sortable: true,
              render: (row) => (
                <button type="button" onClick={() => navigate(`${invoiceBase}/${row.id}`)} className="font-medium text-primary-700 hover:underline">
                  {row.invoiceNumber}
                </button>
              ),
            },
            { key: 'dueDate', header: 'Due Date', sortable: true, render: (row) => formatDate(row.dueDate) },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
            { key: 'amountPaid', header: 'Paid', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountPaid) },
            {
              key: 'outstandingAmount',
              header: 'Outstanding',
              sortable: true,
              align: 'right',
              render: (row) => <span className="font-medium text-amber-700">{formatCurrency(row.outstandingAmount)}</span>,
            },
            {
              key: '_age',
              header: 'Age',
              sortable: true,
              render: (row) => (row._daysOverdue > 0 ? `${row._age} (${row._daysOverdue}d)` : row._age),
            },
            {
              key: '_status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={FINANCIAL_STATUS_VARIANT[row._status] || 'neutral'} dot>{row._status}</Badge>,
            },
          ]}
          data={rows}
          searchKeys={['customerName', 'invoiceNumber']}
          searchPlaceholder="Search customer or invoice #..."
          emptyTitle="No outstanding receivables."
          onRowClick={(row) => navigate(`${invoiceBase}/${row.id}`)}
          actions={(row) => [
            ...(canRecordPayment
              ? [{ label: 'Record Payment', icon: Wallet, onClick: () => setPaymentInvoice(row) }]
              : []),
            { label: 'View Invoice', icon: Eye, onClick: () => navigate(`${invoiceBase}/${row.id}`) },
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
