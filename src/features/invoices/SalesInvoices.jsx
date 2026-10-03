import { ListHeader, ListDataTable as DataTable } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Wallet } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { usePermission } from '../../auth/usePermission'
import { listInvoices } from '../../api/invoices'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { isOpenReceivable } from './invoiceHelpers'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Unpaid', label: 'Unpaid' },
]

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
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const hasActiveFilters = statusFilter !== 'all' || customerFilter !== 'all' || datePreset !== 'all'
  const clearFilters = () => {
    setStatusFilter('all')
    setCustomerFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
  }

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

  const customerOptions = useMemo(() => uniqueOptions(invoices, 'customerName', 'All customers'), [invoices])
  const filteredInvoices = useMemo(() => {
    return invoices.filter((row) => {
      if (statusFilter !== 'all' && row.paymentStatus !== statusFilter) return false
      if (customerFilter !== 'all' && row.customerName !== customerFilter) return false
      if (!isWithinDateRange(row.invoiceDate, dateFrom, dateTo)) return false
      return true
    })
  }, [invoices, statusFilter, customerFilter, dateFrom, dateTo])

  return (
    <div className="listing-page space-y-4">
      <ListHeader>
        <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Sales Invoices</h1>
        <p className="mt-1 text-xs text-neutral-400">Manage all customer sales invoices</p>
        </div>
      </ListHeader>

      <Card title="Sales Invoices" className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:mx-5 [&>p]:mx-5 [&>p]:mb-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          key={`${statusFilter}-${customerFilter}-${datePreset}-${customFrom}-${customTo}`}
          renderToolbar={({ search, onSearchChange, resultCount, searchable }) => (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {searchable && (
                <div className="relative w-full max-w-xs">
                  <input
                    type="text"
                    value={search}
                    onChange={onSearchChange}
                    placeholder="Search sales invoices..."
                    className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-4 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <ListFilterPanel title="Filter Sales Invoices">
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Payment Status
                    <Select options={PAYMENT_STATUS_OPTIONS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Customer
                    <Select options={customerOptions} value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} />
                  </label>
                  <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Invoice Date
                    <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} />
                  </div>
                  {hasActiveFilters && (
                    <button type="button" onClick={clearFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
                  )}
                </ListFilterPanel>
                <p className="shrink-0 text-xs font-medium text-neutral-400">{resultCount} {resultCount === 1 ? 'result' : 'results'}</p>
              </div>
            </div>
          )}
          emptyTitle={hasActiveFilters ? 'No invoices match these filters' : 'No sales invoices found'}
          emptyDescription={hasActiveFilters ? 'Try widening the date range or clearing filters.' : undefined}
          loading={isLoading}
          columns={[
            {
              key: 'invoiceNumber',
              header: 'Invoice #',
              sortable: true,
              render: (row) => (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => navigate(`/accounts/invoices/sales/${row.id}`)} className="font-medium text-primary-700 hover:underline">
                    {row.invoiceNumber}
                  </button>
                  {row.paymentLinkStatus === 'paid' && <Badge variant="success">Paid online</Badge>}
                  {row.hasActivePaymentLink && row.paymentLinkStatus !== 'paid' && <Badge variant="warning">Link sent</Badge>}
                </div>
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
          data={filteredInvoices}
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
