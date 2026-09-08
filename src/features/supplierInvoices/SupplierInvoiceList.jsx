import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ClipboardList, Eye, IndianRupee, Pencil, Plus, Search } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { usePermission } from '../../auth/usePermission'
import { DEMO_MODE } from '../../config/demoMode'
import { safeNumber } from '../purchases/purchaseHelpers'
import {
  invoiceStatusMeta,
  INVOICE_STATUS_OPTIONS,
  LIFECYCLE_FILTER_OPTIONS,
  lifecycleMeta,
  paymentStatusMeta,
  PAYMENT_STATUS_OPTIONS,
  resolveSupplierInvoice,
  VERIFICATION_FILTER_OPTIONS,
  verificationMeta,
} from './supplierInvoiceHelpers'
import { SUPPLIER_INVOICES_DEMO_ENABLED, demoSupplierInvoicesResolved } from './supplierInvoiceDemoData'
import { listSupplierInvoices } from '../../api/supplierInvoices'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const sortOptions = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'dueDate', label: 'Due Date' },
]

// Fold a demo record into the same shape the real normalizer returns, so one render path works.
function toRow(invoice, isDemo) {
  if (!isDemo) {
    return {
      id: invoice.id,
      supplierInvoiceNumber: invoice.supplierInvoiceNumber,
      supplierName: invoice.supplierName,
      purchaseNumber: invoice.purchaseNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid,
      outstanding: invoice.outstandingAmount,
      lifecycle: lifecycleMeta(invoice.status),
      verification: verificationMeta(invoice.verificationStatus),
      payment: paymentStatusMeta(invoice.paymentStatus),
      isDemo: false,
      editable: invoice.status === 'draft',
    }
  }
  const resolved = resolveSupplierInvoice(invoice)
  return {
    id: resolved.id,
    supplierInvoiceNumber: resolved.supplierInvoiceNumber,
    supplierName: resolved.supplierName,
    purchaseNumber: resolved.purchaseNumber,
    invoiceDate: resolved.invoiceDate,
    dueDate: resolved.dueDate,
    grandTotal: resolved.invoiceTotal,
    amountPaid: resolved.amountPaid,
    outstanding: resolved.outstanding,
    lifecycle: invoiceStatusMeta(resolved.invoiceStatus),
    verification: resolved.match || null,
    payment: paymentStatusMeta(resolved.paymentStatus),
    isDemo: true,
    editable: resolved.invoiceStatus !== 'cancelled',
  }
}

export default function SupplierInvoiceList() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const basePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const isDemo = SUPPLIER_INVOICES_DEMO_ENABLED
  const canCreate = isDemo || can('supplier_invoices', 'create')

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [lifecycleFilter, setLifecycleFilter] = useState('all')
  const [verificationFilter, setVerificationFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')

  const [realInvoices, setRealInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(!DEMO_MODE)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (DEMO_MODE) return
    setIsLoading(true)
    setLoadError('')
    const result = await listSupplierInvoices({})
    setIsLoading(false)
    if (!result.success) {
      setRealInvoices([])
      setLoadError(result.error)
      return
    }
    setRealInvoices(result.invoices)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const source = DEMO_MODE
      ? SUPPLIER_INVOICES_DEMO_ENABLED
        ? demoSupplierInvoicesResolved()
        : []
      : realInvoices
    return source.map((invoice) => toRow(invoice, DEMO_MODE))
  }, [realInvoices])

  const supplierOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [rows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const out = rows.filter((row) => {
      const matchesSearch =
        !query ||
        [row.supplierInvoiceNumber, row.supplierName, row.purchaseNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || row.supplierName === supplierFilter
      const matchesLifecycle = lifecycleFilter === 'all' || row.lifecycle?.key === lifecycleFilter
      const matchesVerification =
        verificationFilter === 'all' || (row.verification?.key || 'pending') === verificationFilter
      const matchesPayment = paymentStatusFilter === 'all' || row.payment?.key === paymentStatusFilter
      return matchesSearch && matchesSupplier && matchesLifecycle && matchesVerification && matchesPayment
    })

    return out.sort((left, right) => {
      if (sortFilter === 'dueDate') {
        return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      }
      const leftTime = new Date(left.invoiceDate || 0).getTime()
      const rightTime = new Date(right.invoiceDate || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [rows, search, supplierFilter, lifecycleFilter, verificationFilter, paymentStatusFilter, sortFilter])

  const stats = useMemo(() => {
    const totalValue = rows.reduce((sum, row) => sum + safeNumber(row.grandTotal), 0)
    const outstanding = rows.reduce((sum, row) => sum + safeNumber(row.outstanding), 0)
    const now = Date.now()
    const overdue = rows.filter(
      (row) =>
        row.lifecycle?.key !== 'cancelled' &&
        safeNumber(row.outstanding) > 0 &&
        row.dueDate &&
        new Date(row.dueDate).getTime() < now,
    ).length
    return { total: rows.length, totalValue, outstanding, overdue }
  }, [rows])

  const lifecycleFilterOptions = DEMO_MODE ? INVOICE_STATUS_OPTIONS : LIFECYCLE_FILTER_OPTIONS

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Supplier Invoices</h1>
          <p className="mt-1 text-sm text-neutral-500">What your suppliers billed you — distinct from Purchases and Goods Receipts.</p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => navigate(`${basePath}/new`)}>
            <Plus className="size-4" aria-hidden="true" />
            Add Supplier Invoice
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} iconVariant="primary" label="Total Supplier Invoices" value={stats.total} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Total Invoice Value" value={formatCurrency(stats.totalValue)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(stats.outstanding)} />
        <StatCard icon={CalendarClock} iconVariant="danger" label="Overdue Invoices" value={stats.overdue} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
          <div className="relative min-w-56 flex-1">
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
            options={[{ value: 'all', label: 'All Statuses' }, ...lifecycleFilterOptions]}
            value={lifecycleFilter}
            onChange={(event) => setLifecycleFilter(event.target.value)}
            className="w-40"
            triggerClassName="bg-white"
          />
          <Select
            options={[{ value: 'all', label: 'All Verification' }, ...VERIFICATION_FILTER_OPTIONS]}
            value={verificationFilter}
            onChange={(event) => setVerificationFilter(event.target.value)}
            className="w-48"
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
          {isLoading ? (
            <div className="p-8"><LoadingSpinner label="Loading supplier invoices..." /></div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No supplier invoices yet</p>
              <p className="mt-1 text-sm text-neutral-500">Record your first supplier invoice to start tracking payables.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No supplier invoices match the selected filters.</p>
          ) : (
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3.5">Supplier Invoice #</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Purchase</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Invoice Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Due Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Total</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Outstanding</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Verification</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Payment</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((row) => (
                  <tr key={row.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`${basePath}/${row.id}`)}>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">
                      {row.supplierInvoiceNumber || '—'}
                      {row.isDemo && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{row.supplierName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{row.purchaseNumber || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(row.invoiceDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(row.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(row.grandTotal)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(row.outstanding)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={row.lifecycle.variant}>{row.lifecycle.label}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {row.verification ? <Badge variant={row.verification.variant}>{row.verification.label}</Badge> : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={row.payment.variant} dot>{row.payment.label}</Badge></td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View', icon: Eye, onClick: () => navigate(`${basePath}/${row.id}`) },
                          ...(row.editable
                            ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`${basePath}/${row.id}/edit`) }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
