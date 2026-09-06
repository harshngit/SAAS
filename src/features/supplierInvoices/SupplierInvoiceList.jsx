import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ClipboardList, Eye, FileText, IndianRupee, Pencil, Plus, Search } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { safeNumber } from '../purchases/purchaseHelpers'
import {
  invoiceStatusMeta,
  INVOICE_STATUS_OPTIONS,
  paymentStatusMeta,
  PAYMENT_STATUS_OPTIONS,
  resolveSupplierInvoice,
} from './supplierInvoiceHelpers'
import {
  SUPPLIER_INVOICES_DEMO_ENABLED,
  demoSupplierInvoicesResolved,
  isDemoSupplierInvoice,
} from './supplierInvoiceDemoData'

const REAL_MODE_NOTE =
  'Supplier invoice recording will be available once the supplier invoicing backend is enabled.'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

// The list only needs money + statuses. Purchase / GRN / three-way match live in the detail
// page, so no linked-record lookup is done here.
function resolveInvoice(invoice) {
  return resolveSupplierInvoice(invoice)
}

const sortOptions = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'dueDate', label: 'Due Date' },
]

export default function SupplierInvoiceList() {
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const demoOn = SUPPLIER_INVOICES_DEMO_ENABLED

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')

  const invoices = useMemo(
    () => (demoOn ? demoSupplierInvoicesResolved().map(resolveInvoice) : []),
    [demoOn],
  )

  const supplierOptions = useMemo(() => {
    const names = [...new Set(invoices.map((invoice) => invoice.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [invoices])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = invoices.filter((invoice) => {
      const matchesSearch =
        !query ||
        [invoice.supplierInvoiceNumber, invoice.supplierName, invoice.purchaseNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || invoice.supplierName === supplierFilter
      const matchesInvoiceStatus = invoiceStatusFilter === 'all' || invoice.invoiceStatus === invoiceStatusFilter
      const matchesPayment = paymentStatusFilter === 'all' || invoice.paymentStatus === paymentStatusFilter
      return matchesSearch && matchesSupplier && matchesInvoiceStatus && matchesPayment
    })

    return rows.sort((left, right) => {
      if (sortFilter === 'dueDate') {
        return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      }
      const leftTime = new Date(left.invoiceDate || left.createdAt || 0).getTime()
      const rightTime = new Date(right.invoiceDate || right.createdAt || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [invoices, search, supplierFilter, invoiceStatusFilter, paymentStatusFilter, sortFilter])

  const stats = useMemo(() => {
    const now = Date.now()
    const totalValue = invoices.reduce((sum, invoice) => sum + safeNumber(invoice.invoiceTotal), 0)
    const outstanding = invoices.reduce((sum, invoice) => sum + safeNumber(invoice.outstanding), 0)
    const overdue = invoices.filter(
      (invoice) =>
        invoice.invoiceStatus !== 'cancelled' &&
        safeNumber(invoice.outstanding) > 0 &&
        invoice.dueDate &&
        new Date(invoice.dueDate).getTime() < now,
    ).length
    return { total: invoices.length, totalValue, outstanding, overdue }
  }, [invoices])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Supplier Invoices</h1>
          <p className="mt-1 text-sm text-neutral-500">What your suppliers billed you — distinct from Purchases and Goods Receipts.</p>
        </div>
        <Button
          type="button"
          disabled={!demoOn}
          title={demoOn ? undefined : REAL_MODE_NOTE}
          onClick={() => navigate(`${basePath}/new`)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Supplier Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} iconVariant="primary" label="Total Supplier Invoices" value={stats.total} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Total Invoice Value" value={formatCurrency(stats.totalValue)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(stats.outstanding)} />
        <StatCard icon={CalendarClock} iconVariant="danger" label="Overdue Invoices" value={stats.overdue} />
      </div>

      {!demoOn ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Supplier invoicing not enabled"
            description={REAL_MODE_NOTE}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Invoice # / Supplier / Purchase #"
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
            <Select
              options={[{ value: 'all', label: 'All Invoice Statuses' }, ...INVOICE_STATUS_OPTIONS]}
              value={invoiceStatusFilter}
              onChange={(event) => setInvoiceStatusFilter(event.target.value)}
              className="w-44"
              triggerClassName="bg-white"
            />
            <Select
              options={[{ value: 'all', label: 'All Payment Statuses' }, ...PAYMENT_STATUS_OPTIONS]}
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
              className="w-44"
              triggerClassName="bg-white"
            />
            <Select options={sortOptions} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
          </div>

          <div className="overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-neutral-900">No supplier invoices yet</p>
                <p className="mt-1 text-sm text-neutral-500">Record your first supplier invoice to start tracking payables.</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No supplier invoices match the selected filters.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 p-4 md:hidden">
                  {filtered.map((invoice) => {
                    const status = invoiceStatusMeta(invoice.invoiceStatus)
                    const payment = paymentStatusMeta(invoice.paymentStatus)
                    return (
                      <div
                        key={invoice.id}
                        className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)"
                        onClick={() => navigate(`${basePath}/${invoice.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary-700">
                              {invoice.supplierInvoiceNumber}
                              {isDemoSupplierInvoice(invoice.id) && (
                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-neutral-500">{invoice.supplierName || '—'}</p>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div><p className="text-xs text-neutral-400">Invoice Total</p><p className="font-medium text-neutral-800">{formatCurrency(invoice.invoiceTotal)}</p></div>
                          <div><p className="text-xs text-neutral-400">Outstanding</p><p className="text-neutral-700">{formatCurrency(invoice.outstanding)}</p></div>
                        </div>
                        <div className="mt-3">
                          <Badge variant={payment.variant} dot>{payment.label}</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <table className="hidden w-full min-w-4xl text-left text-sm md:table">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      <th className="whitespace-nowrap px-4 py-3.5">Supplier Invoice #</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Supplier</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Invoice Date</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Invoice Total</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Paid</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Outstanding</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Payment Status</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filtered.map((invoice) => {
                      const status = invoiceStatusMeta(invoice.invoiceStatus)
                      const payment = paymentStatusMeta(invoice.paymentStatus)
                      const editable = invoice.invoiceStatus !== 'cancelled'
                      return (
                        <tr key={invoice.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`${basePath}/${invoice.id}`)}>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">
                            {invoice.supplierInvoiceNumber}
                            {isDemoSupplierInvoice(invoice.id) && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{invoice.supplierName || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(invoice.invoiceDate)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(invoice.invoiceTotal)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(invoice.amountPaid)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(invoice.outstanding)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={payment.variant} dot>{payment.label}</Badge></td>
                          <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                          <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                            <ActionMenu
                              items={[
                                { label: 'View', icon: Eye, onClick: () => navigate(`${basePath}/${invoice.id}`) },
                                ...(editable
                                  ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`${basePath}/${invoice.id}/edit`) }]
                                  : []),
                              ]}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
