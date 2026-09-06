import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, IndianRupee, Search, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { safeNumber } from '../purchases/purchaseHelpers'
import { paymentStatusMeta, PAYMENT_STATUS_OPTIONS } from '../supplierInvoices/supplierInvoiceHelpers'
import {
  ageingBucket,
  AGEING_FILTER_OPTIONS,
  dueCondition,
  DUE_FILTER_OPTIONS,
  PAYABLE_SORT_OPTIONS,
  REAL_MODE_NOTE,
} from './payableHelpers'
import { PAYABLES_DEMO_ENABLED, demoPayables, paidThisMonth } from './payableDemoData'
import PayableQuickView from './PayableQuickView'
import RecordSupplierPaymentDrawer from '../supplierPayments/RecordSupplierPaymentDrawer'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function PayablesList() {
  const navigate = useNavigate()
  const invoiceBasePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const demoOn = PAYABLES_DEMO_ENABLED

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [ageingFilter, setAgeingFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [quickViewId, setQuickViewId] = useState(null)
  const [recordPreset, setRecordPreset] = useState(null)
  const [refresh, setRefresh] = useState(0)

  // refresh is bumped after a payment so these re-read the patched demo store.
  /* eslint-disable react-hooks/exhaustive-deps */
  const payables = useMemo(() => (demoOn ? demoPayables() : []), [demoOn, refresh])
  const monthPaid = useMemo(() => (demoOn ? paidThisMonth() : 0), [demoOn, refresh])
  /* eslint-enable react-hooks/exhaustive-deps */

  const supplierOptions = useMemo(() => {
    const names = [...new Set(payables.map((row) => row.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [payables])

  const rows = useMemo(() => {
    const now = Date.now()
    const query = search.trim().toLowerCase()
    const filtered = payables.filter((row) => {
      const matchesSearch =
        !query ||
        [row.supplierName, row.supplierInvoiceNumber].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || row.supplierName === supplierFilter
      const matchesPayment = paymentStatusFilter === 'all' || row.paymentStatus === paymentStatusFilter
      const due = dueCondition(row.dueDate, row.outstanding, now)
      const matchesDue = dueFilter === 'all' || due?.key === dueFilter
      const ageing = ageingBucket(row.dueDate, row.outstanding, now)
      const matchesAgeing = ageingFilter === 'all' || ageing?.key === ageingFilter
      return matchesSearch && matchesSupplier && matchesPayment && matchesDue && matchesAgeing
    })

    return filtered.sort((left, right) => {
      if (sortFilter === 'outstanding') return safeNumber(right.outstanding) - safeNumber(left.outstanding)
      if (sortFilter === 'dueDate') return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      const leftTime = new Date(left.invoiceDate || left.createdAt || 0).getTime()
      const rightTime = new Date(right.invoiceDate || right.createdAt || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [payables, search, supplierFilter, paymentStatusFilter, dueFilter, ageingFilter, sortFilter])

  const stats = useMemo(() => {
    const now = Date.now()
    const open = payables.filter((row) => row.paymentStatus !== 'paid')
    const totalOutstanding = open.reduce((sum, row) => sum + safeNumber(row.outstanding), 0)
    const dueSoon = open.filter((row) => dueCondition(row.dueDate, row.outstanding, now)?.key === 'due_soon').length
    const overdue = open.filter((row) => dueCondition(row.dueDate, row.outstanding, now)?.key === 'overdue').length
    return { totalOutstanding, dueSoon, overdue }
  }, [payables])

  const bump = () => setRefresh((value) => value + 1)
  const openRecordPayment = (row) =>
    setRecordPreset({ supplierId: row.supplierId, invoiceId: row.id, amount: row.outstanding })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Accounts Payable</h1>
          <p className="mt-1 text-sm text-neutral-500">What you still owe each supplier, from their invoices.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="warning" label="Total Outstanding" value={formatCurrency(stats.totalOutstanding)} />
        <StatCard icon={CalendarClock} iconVariant="info" label="Due Soon" value={stats.dueSoon} />
        <StatCard icon={AlertTriangle} iconVariant="danger" label="Overdue" value={stats.overdue} />
        <StatCard icon={Wallet} iconVariant="success" label="Paid This Month" value={formatCurrency(monthPaid)} />
      </div>

      {!demoOn ? (
        <Card>
          <EmptyState icon={Wallet} title="Supplier payments not enabled" description={REAL_MODE_NOTE} />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Supplier / Supplier Invoice #"
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
            <Select options={[{ value: 'all', label: 'All Payment Statuses' }, ...PAYMENT_STATUS_OPTIONS]} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
            <Select options={DUE_FILTER_OPTIONS} value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
            <Select options={AGEING_FILTER_OPTIONS} value={ageingFilter} onChange={(event) => setAgeingFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
            <Select options={PAYABLE_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
          </div>

          <div className="overflow-x-auto">
            {payables.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No supplier invoices to pay.</p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No payables match the selected filters.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 p-4 md:hidden">
                  {rows.map((row) => {
                    const payment = paymentStatusMeta(row.paymentStatus)
                    const ageing = ageingBucket(row.dueDate, row.outstanding)
                    return (
                      <div key={row.id} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)" onClick={() => setQuickViewId(row.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{row.supplierName}</p>
                            <p className="truncate text-xs text-primary-700">{row.supplierInvoiceNumber}</p>
                          </div>
                          <Badge variant={payment.variant} dot>{payment.label}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div><p className="text-xs text-neutral-400">Outstanding</p><p className="font-medium text-neutral-800">{formatCurrency(row.outstanding)}</p></div>
                          <div><p className="text-xs text-neutral-400">Due Date</p><p className="text-neutral-700">{formatDate(row.dueDate)}</p></div>
                          <div><p className="text-xs text-neutral-400">Ageing</p><p className="text-neutral-700">{ageing ? ageing.label : '—'}</p></div>
                        </div>
                        <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                          <Button type="button" size="sm" disabled={!demoOn || row.outstanding <= 0} onClick={() => openRecordPayment(row)}>
                            <IndianRupee className="size-4" aria-hidden="true" />
                            Record Payment
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <table className="hidden w-full min-w-4xl text-left text-sm md:table">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      <th className="whitespace-nowrap px-4 py-3.5">Supplier</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Supplier Invoice #</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Due Date</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Invoice Total</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Paid</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Outstanding</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Payment Status</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Ageing</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rows.map((row) => {
                      const payment = paymentStatusMeta(row.paymentStatus)
                      const ageing = ageingBucket(row.dueDate, row.outstanding)
                      const due = dueCondition(row.dueDate, row.outstanding)
                      return (
                        <tr key={row.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => setQuickViewId(row.id)}>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{row.supplierName}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">{row.supplierInvoiceNumber}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">
                            {formatDate(row.dueDate)}
                            {due && <span className="ml-2 align-middle"><Badge variant={due.variant}>{due.label}</Badge></span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(row.invoiceTotal)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(row.amountPaid)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(row.outstanding)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={payment.variant} dot>{payment.label}</Badge></td>
                          <td className="whitespace-nowrap px-4 py-3.5">{ageing ? <Badge variant={ageing.variant}>{ageing.label}</Badge> : <span className="text-neutral-400">—</span>}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Button type="button" size="sm" disabled={!demoOn || row.outstanding <= 0} onClick={() => openRecordPayment(row)}>Record Payment</Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`${invoiceBasePath}/${row.id}`)}>View Invoice</Button>
                            </div>
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

      <PayableQuickView
        invoiceId={quickViewId}
        isOpen={Boolean(quickViewId)}
        refreshKey={refresh}
        onClose={() => setQuickViewId(null)}
        onRecordPayment={(payable) => {
          setQuickViewId(null)
          openRecordPayment(payable)
        }}
        onOpenInvoice={() => navigate(`${invoiceBasePath}/${quickViewId}`)}
      />

      <RecordSupplierPaymentDrawer
        isOpen={Boolean(recordPreset)}
        preset={recordPreset}
        onClose={() => setRecordPreset(null)}
        onRecorded={() => {
          setRecordPreset(null)
          bump()
        }}
      />
    </div>
  )
}
