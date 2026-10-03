import { ListHeader, ListDataTable as DataTable } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { listPurchases, PURCHASE_PAYMENT_STATUS_OPTIONS, PURCHASE_STATUS_OPTIONS, updatePurchasePaymentStatus } from '../../api/purchases'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'

const statusVariant = { pending: 'warning', approved: 'success', cancelled: 'danger' }
const paymentStatusVariant = { unpaid: 'danger', partial: 'warning', paid: 'success' }

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const hasActiveFilters = statusFilter !== 'all' || paymentStatusFilter !== 'all' || supplierFilter !== 'all' || datePreset !== 'all'
  const clearFilters = () => {
    setStatusFilter('all')
    setPaymentStatusFilter('all')
    setSupplierFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
  }

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listPurchases()

    if (!result.success) {
      setInvoices([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setInvoices(result.purchases)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const openPaymentModal = (invoice) => {
    setPaymentError('')
    setPaymentStatus(invoice.paymentStatus || 'unpaid')
    setPaymentAmount(String(invoice.amountPaid ?? 0))
    setPaymentTarget(invoice)
  }

  const handleUpdatePayment = async () => {
    if (!paymentTarget) return

    setIsUpdatingPayment(true)
    setPaymentError('')

    const result = await updatePurchasePaymentStatus(paymentTarget.id, {
      paymentStatus,
      amountPaid: paymentAmount === '' ? undefined : paymentAmount,
    })

    if (!result.success) {
      setPaymentError(result.error)
      setIsUpdatingPayment(false)
      return
    }

    setIsUpdatingPayment(false)
    setPaymentTarget(null)
    loadInvoices()
  }

  const supplierOptions = useMemo(() => uniqueOptions(invoices, 'supplierName', 'All suppliers'), [invoices])
  const filteredInvoices = useMemo(() => {
    return invoices.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (paymentStatusFilter !== 'all' && row.paymentStatus !== paymentStatusFilter) return false
      if (supplierFilter !== 'all' && row.supplierName !== supplierFilter) return false
      if (!isWithinDateRange(row.invoiceDate, dateFrom, dateTo)) return false
      return true
    })
  }, [invoices, statusFilter, paymentStatusFilter, supplierFilter, dateFrom, dateTo])

  const columns = useMemo(
    () => [
      { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
      { key: 'supplierName', header: 'Supplier', sortable: true },
      {
        key: 'invoiceDate',
        header: 'Date',
        sortable: true,
        render: (row) => {
          if (!row.invoiceDate) return '—'
          const date = new Date(row.invoiceDate)
          return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'}>{row.status}</Badge>,
      },
      {
        key: 'paymentStatus',
        header: 'Payment',
        sortable: true,
        render: (row) => <Badge variant={paymentStatusVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
      },
      { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
      { key: 'outstandingAmount', header: 'Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.outstandingAmount) },
    ],
    [],
  )

  return (
    <div className="listing-page space-y-4">
      <ListHeader>
        <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Purchase Invoices</h1>
        <p className="mt-1 text-xs text-neutral-400">Manage all supplier purchase invoices</p>
        </div>
      </ListHeader>

      {listError ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadInvoices}>Retry</Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card>
          <LoadingSpinner label="Loading purchase invoices..." />
        </Card>
      ) : (
        <Card title="Purchase Invoices" className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:mx-5 [&>p]:mx-5 [&>p]:mb-5">
          <DataTable
            key={`${statusFilter}-${paymentStatusFilter}-${supplierFilter}-${datePreset}-${customFrom}-${customTo}`}
            renderToolbar={({ search, onSearchChange, resultCount, searchable }) => (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {searchable && (
                  <div className="relative w-full max-w-xs">
                    <input
                      type="text"
                      value={search}
                      onChange={onSearchChange}
                      placeholder="Search purchase invoices..."
                      className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-4 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <ListFilterPanel title="Filter Purchase Invoices">
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                      <Select options={[{ value: 'all', label: 'All status' }, ...PURCHASE_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Payment Status
                      <Select options={[{ value: 'all', label: 'All payment status' }, ...PURCHASE_PAYMENT_STATUS_OPTIONS]} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Supplier
                      <Select options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} />
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
            emptyTitle={hasActiveFilters ? 'No purchase invoices match these filters' : 'No purchase invoices found'}
            emptyDescription={hasActiveFilters ? 'Try widening the date range or clearing filters.' : undefined}
            columns={columns}
            data={filteredInvoices}
            searchKeys={['invoiceNumber', 'supplierName', 'status', 'paymentStatus']}
            searchPlaceholder="Search purchase invoices..."
            actions={(row) => [
              { label: 'Update Payment Status', icon: IndianRupee, onClick: () => openPaymentModal(row) },
            ]}
          />
        </Card>
      )}

      <Modal isOpen={Boolean(paymentTarget)} onClose={() => !isUpdatingPayment && setPaymentTarget(null)} title="Update Payment Status">
        <div className="space-y-4">
          {paymentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</div>
          )}
          <p className="text-sm text-neutral-500">{paymentTarget?.invoiceNumber}</p>
          <Select
            label="Payment Status"
            options={PURCHASE_PAYMENT_STATUS_OPTIONS}
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          />
          <Input
            label="Amount Paid"
            type="number"
            min="0"
            step="1"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isUpdatingPayment} onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button type="button" loading={isUpdatingPayment} onClick={handleUpdatePayment}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
