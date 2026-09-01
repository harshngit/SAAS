import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, CreditCard, Banknote, Receipt, FileWarning, Eye, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import CategoryPieChart from '../../components/charts/CategoryPieChart'
import { useAuthStore } from '../../store/authStore'
import { getReport } from '../../api/reports'
import { listInvoices } from '../../api/invoices'
import { listPaymentReceipts } from '../../api/paymentReceipts'
import { formatCurrency } from '../../utils/format'

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

export default function AccountantDashboard() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [outstandingReceivables, setOutstandingReceivables] = useState(0)
  const [outstandingPayables, setOutstandingPayables] = useState(0)
  const [expensesThisMonth, setExpensesThisMonth] = useState(0)
  const [gstSummary, setGstSummary] = useState({ outputGst: 0, inputGst: 0, netGst: 0 })
  const [invoices, setInvoices] = useState([])
  const [cashCollectedToday, setCashCollectedToday] = useState(0)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    const [
      receivablesResult,
      payablesResult,
      expenseResult,
      gstResult,
      invoicesResult,
      receiptsResult,
    ] = await Promise.all([
      getReport('customer-outstanding'),
      getReport('supplier-outstanding'),
      getReport('expense', { date_from: firstOfMonthIso(), date_to: todayIso() }),
      getReport('gst-summary'),
      listInvoices(),
      listPaymentReceipts(),
    ])

    setIsLoading(false)

    if (!receivablesResult.success) {
      setLoadError(receivablesResult.error)
      return
    }
    if (!payablesResult.success) {
      setLoadError(payablesResult.error)
      return
    }
    if (!expenseResult.success) {
      setLoadError(expenseResult.error)
      return
    }
    if (!gstResult.success) {
      setLoadError(gstResult.error)
      return
    }
    if (!invoicesResult.success) {
      setLoadError(invoicesResult.error)
      return
    }
    if (!receiptsResult.success) {
      setLoadError(receiptsResult.error)
      return
    }

    // Report shapes are backend-defined and only loosely documented - read defensively and
    // fall back to summing the row-level outstanding figures when there's no clean summary total.
    const receivablesSummary = receivablesResult.report?.summary || {}
    const receivablesTotal =
      receivablesSummary.total_outstanding ??
      receivablesSummary.outstanding ??
      (Array.isArray(receivablesResult.report?.rows)
        ? receivablesResult.report.rows.reduce((sum, row) => sum + (row.outstanding_amount ?? row.outstanding ?? 0), 0)
        : 0)

    const payablesSummary = payablesResult.report?.summary || {}
    const payablesTotal =
      payablesSummary.total_outstanding ??
      payablesSummary.outstanding ??
      (Array.isArray(payablesResult.report?.rows)
        ? payablesResult.report.rows.reduce((sum, row) => sum + (row.outstanding_amount ?? row.outstanding ?? 0), 0)
        : 0)

    const expenseSummary = expenseResult.report?.summary || {}

    // gst-summary is documented as a flat {output_gst, input_gst, net_gst} response, but adapt
    // in case it turns out nested under .summary like the other report types.
    const gstReport = gstResult.report || {}
    const gstFlat = gstReport.summary || gstReport

    setOutstandingReceivables(receivablesTotal || 0)
    setOutstandingPayables(payablesTotal || 0)
    setExpensesThisMonth(expenseSummary.total_expense ?? 0)
    setGstSummary({
      outputGst: gstFlat.output_gst ?? 0,
      inputGst: gstFlat.input_gst ?? 0,
      netGst: gstFlat.net_gst ?? 0,
    })
    setInvoices(invoicesResult.invoices)

    const today = todayIso()
    const cashToday = receiptsResult.receipts
      .filter((receipt) => receipt.paymentMethod === 'cash' && (receipt.receiptDate || '').slice(0, 10) === today)
      .reduce((sum, receipt) => sum + (receipt.amountReceived || 0), 0)
    setCashCollectedToday(cashToday)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (isLoading) {
    return <LoadingSpinner label="Loading accounts overview..." />
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={loadDashboard}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  const overdueInvoices = invoices.filter(
    (invoice) => invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.outstandingAmount > 0,
  )

  const paymentStatusCounts = invoices.reduce((acc, invoice) => {
    const status = invoice.paymentStatus || 'Unpaid'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
  const paymentStatusChartData = Object.entries(paymentStatusCounts).map(([name, value]) => ({ name, value }))

  const isGstCredit = gstSummary.netGst < 0

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-2xl border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">Accounts Overview</h1>
        <p className="mt-1.5 text-sm text-neutral-500">{currentUser?.name || 'Accountant'} · Accountant · as of {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Wallet} iconVariant="success" label="Outstanding Receivables" value={formatCurrency(outstandingReceivables)} />
        <StatCard icon={CreditCard} iconVariant="danger" label="Outstanding Payables" value={formatCurrency(outstandingPayables)} />
        <StatCard icon={Banknote} iconVariant="info" label="Cash Collected Today" value={formatCurrency(cashCollectedToday)} />
        <StatCard icon={Receipt} iconVariant="neutral" label="Expenses This Month" value={formatCurrency(expensesThisMonth)} />
        <StatCard icon={FileWarning} iconVariant="warning" label="Overdue Invoices" value={overdueInvoices.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="GST Summary" subtitle="This financial year, computed from sales & purchase invoices" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-neutral-500">Output GST (Sales)</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{formatCurrency(gstSummary.outputGst)}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Input GST (Purchases)</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{formatCurrency(gstSummary.inputGst)}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">{isGstCredit ? 'Net GST Refundable' : 'Net GST Payable'}</p>
              <p className={`mt-1 text-xl font-semibold ${isGstCredit ? 'text-green-600' : 'text-neutral-900'}`}>
                {formatCurrency(Math.abs(gstSummary.netGst))}
              </p>
            </div>
          </div>
        </Card>
        <Card title="Payment Status" subtitle="Across invoices">
          {paymentStatusChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No invoices yet.</p>
          ) : (
            <CategoryPieChart data={paymentStatusChartData} />
          )}
        </Card>
      </div>

      <Card title="Overdue Customer Invoices" subtitle="Invoices past their due date with an outstanding balance">
        <DataTable
          columns={[
            { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
            { key: 'customerName', header: 'Customer', sortable: true },
            { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
            { key: 'outstandingAmount', header: 'Balance Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.outstandingAmount) },
            {
              key: 'paymentStatus',
              header: 'Payment',
              sortable: true,
              render: (row) => <Badge variant={paymentVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
            },
          ]}
          data={overdueInvoices}
          searchKeys={['invoiceNumber', 'customerName']}
          searchPlaceholder="Search invoices…"
          emptyTitle="No overdue invoices"
          emptyDescription="Every invoice has been fully paid."
          actions={(row) => [
            { label: 'View invoice', icon: Eye, onClick: () => navigate(`/admin/invoices/${row.id}`) },
          ]}
        />
      </Card>
    </div>
  )
}
