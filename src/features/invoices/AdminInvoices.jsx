import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { ListOverview, ListHeader, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import ActionMenu from '../../components/ui/ActionMenu'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listInvoices } from '../../api/invoices'
import { listOrders } from '../../api/orders'
import { usePermission } from '../../auth/usePermission'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { INVOICE_DEMO_ENABLED } from './invoiceDemoData'
import { formatCurrency } from '../../utils/format'
import {
  FINANCIAL_STATUS_VARIANT,
  INVOICE_STATUS_FILTERS,
  financialStatus,
  isInvoiceDueSoon,
  isInvoiceOverdue,
} from './invoiceHelpers'

const invoiceStatusVariant = { Issued: 'success', Draft: 'neutral', Cancelled: 'danger' }

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SalesInvoicesPanel({ header }) {
  const navigate = useNavigate()
  const { can } = usePermission()
  // Recording a customer payment is a financial transaction - gate it on payments:create only.
  const canRecordPayment = can('payments', 'create')
  const [invoices, setInvoices] = useState([])
  const [orderNumbersById, setOrderNumbersById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const pageSize = 10

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Demo mode: demo invoices already carry their order number - no real /orders call.
    const [result, ordersResult] = await Promise.all([
      listInvoices(),
      INVOICE_DEMO_ENABLED ? Promise.resolve({ success: false }) : listOrders(),
    ])

    if (!result.success) {
      setInvoices([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setInvoices(result.invoices)
    if (ordersResult.success) {
      setOrderNumbersById(Object.fromEntries(ordersResult.orders.map((order) => [order.id, order.orderNumber])))
    } else if (INVOICE_DEMO_ENABLED) {
      setOrderNumbersById(
        Object.fromEntries(result.invoices.filter((invoice) => invoice.orderId).map((invoice) => [invoice.orderId, invoice.orderNumber])),
      )
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const stats = useMemo(() => {
    const open = invoices.filter((invoice) => !invoice.isCreditNote)
    const totalReceivable = open.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
    const paidThisMonth = open
      .filter((invoice) => {
        const date = new Date(invoice.invoiceDate)
        const now = new Date()
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      })
      .reduce((sum, invoice) => sum + invoice.amountPaid, 0)
    const overdueAmount = open.filter(isInvoiceOverdue).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
    const dueSoonAmount = open.filter(isInvoiceDueSoon).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)

    return { totalReceivable, paidThisMonth, overdueAmount, dueSoonAmount }
  }, [invoices])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return invoices.filter((invoice) => {
      if (paymentStatus !== 'all' && financialStatus(invoice) !== paymentStatus) return false
      if (!term) return true
      const orderNumber = orderNumbersById[invoice.orderId] || ''
      return (
        invoice.invoiceNumber.toLowerCase().includes(term) ||
        (invoice.customerName || '').toLowerCase().includes(term) ||
        orderNumber.toLowerCase().includes(term)
      )
    })
  }, [invoices, search, paymentStatus, orderNumbersById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(filtered.length, currentPage * pageSize)

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const pages = new Set([1, 2, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages])
    return Array.from(pages).filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  }, [totalPages, currentPage])

  const updateFilter = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const filterControls = (
    <>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={updateFilter(setSearch)}
              placeholder="Search invoices..."
              className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <ListFilterPanel title="Filter Sales Invoices">
          <Select label="Payment status" options={INVOICE_STATUS_FILTERS} value={paymentStatus} onChange={updateFilter(setPaymentStatus)} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          <button
            type="button"
            onClick={() => { setSearch(''); setPaymentStatus('all'); setPage(1) }}
            aria-label="Reset filters"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            <RefreshCw className="size-4" />
          </button>
          </ListFilterPanel>
    </>
  )

  return (
    <div className="listing-page space-y-4">
      <ListOverview>
        {header(filterControls)}

        <ListSummary className="grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="success" label="Total Receivables" value={formatCurrency(stats.totalReceivable)} />
        <StatCard icon={RefreshCw} iconVariant="danger" label="Overdue" value={formatCurrency(stats.overdueAmount)} />
        <StatCard icon={FileText} iconVariant="warning" label="Due Soon" value={formatCurrency(stats.dueSoonAmount)} />
        <StatCard icon={Receipt} iconVariant="info" label="Paid This Month" value={formatCurrency(stats.paidThisMonth)} />
      </ListSummary>
      </ListOverview>

      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
        {listError ? (
          <div className="p-10 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadInvoices}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-10">
            <LoadingSpinner label="Loading invoices..." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="listing-table w-full min-w-5xl text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Invoice No.</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Order #</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Customer</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Invoice Date</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Due Date</th>
                    <th className="whitespace-nowrap px-6 py-6 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Total</th>
                    <th className="whitespace-nowrap px-6 py-6 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Paid</th>
                    <th className="whitespace-nowrap px-6 py-6 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Due</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Payment Status</th>
                    <th className="whitespace-nowrap px-6 py-6 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Invoice Status</th>
                    <th className="whitespace-nowrap px-6 py-6 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginated.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => navigate(`/admin/invoices/${invoice.id}`)}
                      className="cursor-pointer transition-colors hover:bg-primary-50/30"
                    >
                      <td className="whitespace-nowrap px-6 py-5 font-medium text-primary-700">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">
                        {invoice.orderId ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/admin/orders/${invoice.orderId}`)
                            }}
                            className="font-medium text-neutral-700 hover:text-primary-700 hover:underline"
                          >
                            {orderNumbersById[invoice.orderId] || 'View Order'}
                          </button>
                        ) : (
                          <span className="text-neutral-400">Direct</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-800">{invoice.customerName || invoice.walkInName || '—'}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDateLabel(invoice.invoiceDate)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDateLabel(invoice.dueDate)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right font-medium text-neutral-900">{formatCurrency(invoice.total)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-600">{formatCurrency(invoice.amountPaid)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-600">{formatCurrency(invoice.outstandingAmount)}</td>
                      <td className="whitespace-nowrap px-6 py-5">
                        <Badge variant={FINANCIAL_STATUS_VARIANT[financialStatus(invoice)] || 'neutral'} dot>{financialStatus(invoice)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-5">
                        <Badge variant={invoiceStatusVariant[invoice.invoiceStatus] || 'neutral'}>{invoice.invoiceStatus}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-5" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu items={[
                          ...(canRecordPayment && invoice.outstandingAmount > 0 ? [{ label: 'Record Payment', onClick: () => setPaymentInvoice(invoice) }] : []),
                          { label: 'View invoice', icon: Eye, onClick: () => navigate(`/admin/invoices/${invoice.id}`) },
                        ]} />
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-sm text-neutral-400">No invoices match your filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3.5">
              <p className="text-sm text-neutral-400">
                Showing {rangeStart} to {rangeEnd} of {filtered.length} results
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700">
                  10 per page <ChevronDown className="size-3.5" />
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  {pageNumbers.map((pageNumber, index) => {
                    const previous = pageNumbers[index - 1]
                    const showEllipsis = previous != null && pageNumber - previous > 1

                    return (
                      <span key={pageNumber} className="flex items-center gap-1.5">
                        {showEllipsis && <span className="px-1 text-neutral-300">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(pageNumber)}
                          className={`flex size-8 items-center justify-center rounded-full text-sm ${
                            pageNumber === currentPage ? 'bg-primary-700 text-white' : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <RecordPaymentDrawer
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSave={() => {
          setPaymentInvoice(null)
          loadInvoices()
        }}
      />
    </div>
  )
}

export default function AdminInvoices() {
  const navigate = useNavigate()
  const [showNewInvoiceChoice, setShowNewInvoiceChoice] = useState(false)

  return (
    <div className="listing-page space-y-4">
      <SalesInvoicesPanel header={(controls) => (
        <ListHeader>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Sales Invoices</h1>
          <p className="mt-1 text-xs text-neutral-400">Customer invoices and receivables. Supplier bills live under Supplier Invoices.</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {controls}
          <Button type="button" onClick={() => setShowNewInvoiceChoice(true)}>
            <Plus className="size-4" />
            New Invoice
          </Button>
          <button
            type="button"
            onClick={() => navigate('/admin/invoices/settings')}
            aria-label="Invoice settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </ListHeader>
      )} />

      <Modal
        isOpen={showNewInvoiceChoice}
        onClose={() => setShowNewInvoiceChoice(false)}
        title="New Invoice"
        size="sm"
      >
        <p className="text-sm text-neutral-500">How would you like to create this invoice?</p>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => { setShowNewInvoiceChoice(false); navigate('/admin/invoices/new?mode=from-order') }}
            className="flex w-full items-start gap-3 rounded-2xl border border-neutral-100 p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40"
          >
            <FileText className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-neutral-900">From Sales Order</span>
              <span className="block text-xs text-neutral-500">Generate from an existing customer&apos;s delivered sales order.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setShowNewInvoiceChoice(false); navigate('/admin/invoices/new?mode=direct') }}
            className="flex w-full items-start gap-3 rounded-2xl border border-neutral-100 p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40"
          >
            <Receipt className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-neutral-900">Direct / Walk-in</span>
              <span className="block text-xs text-neutral-500">Create a quick manual invoice without a sales order.</span>
            </span>
          </button>
        </div>
      </Modal>
    </div>
  )
}
