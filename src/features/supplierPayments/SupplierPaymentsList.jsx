import { useMemo, useState } from 'react'
import { CalendarClock, IndianRupee, Plus, Search, Users, Wallet } from 'lucide-react'
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
  isSameMonth,
  isWithinDays,
  PAYMENT_DATE_FILTER_OPTIONS,
  PAYMENT_MODE_OPTIONS,
  paymentModeLabel,
  PAYMENT_SORT_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
  paymentStatusMeta,
  REAL_MODE_NOTE,
} from './supplierPaymentHelpers'
import {
  getSupplierPayments,
  paidThisMonth,
  recentPaymentsCount,
  suppliersPaidCount,
  SUPPLIER_PAYMENTS_DEMO_ENABLED,
  totalPaid,
} from './supplierPaymentDemoData'
import RecordSupplierPaymentDrawer from './RecordSupplierPaymentDrawer'
import SupplierPaymentQuickView from './SupplierPaymentQuickView'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function allocatedToLabel(payment) {
  const lines = payment.allocations || []
  if (lines.length === 0) return '—'
  if (lines.length === 1) return lines[0].supplierInvoiceNumber || '—'
  return `${lines[0].supplierInvoiceNumber} +${lines.length - 1}`
}

export default function SupplierPaymentsList() {
  const onAccounts = window.location.pathname.startsWith('/accounts')
  const invoiceBasePath = onAccounts ? '/accounts/supplier-invoices' : '/admin/supplier-invoices'
  const demoOn = SUPPLIER_PAYMENTS_DEMO_ENABLED

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [recordOpen, setRecordOpen] = useState(false)
  const [quickViewId, setQuickViewId] = useState(null)
  const [refresh, setRefresh] = useState(0)

  /* eslint-disable react-hooks/exhaustive-deps */
  // refresh is bumped after record / void so these re-read the demo ledger.
  const payments = useMemo(() => (demoOn ? getSupplierPayments() : []), [demoOn, refresh])
  const stats = useMemo(
    () =>
      demoOn
        ? { total: totalPaid(), month: paidThisMonth(), suppliers: suppliersPaidCount(), recent: recentPaymentsCount() }
        : { total: 0, month: 0, suppliers: 0, recent: 0 },
    [demoOn, refresh],
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  const supplierOptions = useMemo(() => {
    const names = [...new Set(payments.map((payment) => payment.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [payments])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const now = Date.now()
    const filtered = payments.filter((payment) => {
      const matchesSearch =
        !query ||
        [payment.paymentNumber, payment.supplierName, payment.reference]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || payment.supplierName === supplierFilter
      const matchesMode = modeFilter === 'all' || payment.paymentMode === modeFilter
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'this_month' && isSameMonth(payment.paymentDate)) ||
        (dateFilter === 'recent' && isWithinDays(payment.paymentDate, 30, now))
      return matchesSearch && matchesSupplier && matchesMode && matchesStatus && matchesDate
    })

    return filtered.sort((left, right) => {
      if (sortFilter === 'amount') return safeNumber(right.amount) - safeNumber(left.amount)
      const leftTime = new Date(left.paymentDate || left.recordedAt || 0).getTime()
      const rightTime = new Date(right.paymentDate || right.recordedAt || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [payments, search, supplierFilter, modeFilter, statusFilter, dateFilter, sortFilter])

  const bump = () => setRefresh((value) => value + 1)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Supplier Payments</h1>
          <p className="mt-1 text-sm text-neutral-500">When, how much, and against which invoices each supplier was paid.</p>
        </div>
        <Button type="button" disabled={!demoOn} title={demoOn ? undefined : REAL_MODE_NOTE} onClick={() => setRecordOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Total Paid" value={formatCurrency(stats.total)} />
        <StatCard icon={Wallet} iconVariant="success" label="Payments This Month" value={formatCurrency(stats.month)} />
        <StatCard icon={Users} iconVariant="info" label="Suppliers Paid" value={stats.suppliers} />
        <StatCard icon={CalendarClock} iconVariant="warning" label="Recent Payments" value={stats.recent} />
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
                placeholder="Search Payment # / Supplier / Reference"
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
            <Select options={[{ value: 'all', label: 'All Modes' }, ...PAYMENT_MODE_OPTIONS]} value={modeFilter} onChange={(event) => setModeFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
            <Select options={PAYMENT_STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
            <Select options={PAYMENT_DATE_FILTER_OPTIONS} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
            <Select options={PAYMENT_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
          </div>

          <div className="overflow-x-auto">
            {payments.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No supplier payments recorded yet.</p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No payments match the selected filters.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 p-4 md:hidden">
                  {rows.map((payment) => {
                    const status = paymentStatusMeta(payment.status)
                    return (
                      <div key={payment.id} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)" onClick={() => setQuickViewId(payment.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary-700">{payment.paymentNumber}</p>
                            <p className="truncate text-xs text-neutral-500">{payment.supplierName}</p>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div><p className="text-xs text-neutral-400">Amount</p><p className="font-medium text-neutral-800">{formatCurrency(payment.amount)}</p></div>
                          <div><p className="text-xs text-neutral-400">Date</p><p className="text-neutral-700">{formatDate(payment.paymentDate)}</p></div>
                          <div><p className="text-xs text-neutral-400">Payment Mode</p><p className="text-neutral-700">{paymentModeLabel(payment.paymentMode)}</p></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <table className="hidden w-full min-w-4xl text-left text-sm md:table">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      <th className="whitespace-nowrap px-4 py-3.5">Payment #</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Supplier</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Payment Date</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right">Amount</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Payment Mode</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Reference</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Allocated To</th>
                      <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rows.map((payment) => {
                      const status = paymentStatusMeta(payment.status)
                      return (
                        <tr key={payment.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => setQuickViewId(payment.id)}>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">{payment.paymentNumber}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{payment.supplierName}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(payment.paymentDate)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(payment.amount)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{paymentModeLabel(payment.paymentMode)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{payment.reference || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{allocatedToLabel(payment)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                          <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                            <ActionMenu items={[{ label: 'Quick View', onClick: () => setQuickViewId(payment.id) }]} />
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

      <RecordSupplierPaymentDrawer isOpen={recordOpen} onClose={() => setRecordOpen(false)} onRecorded={bump} preset={null} />

      <SupplierPaymentQuickView
        paymentId={quickViewId}
        isOpen={Boolean(quickViewId)}
        onClose={() => setQuickViewId(null)}
        onVoided={bump}
        invoiceBasePath={invoiceBasePath}
        supplierBasePath={onAccounts ? null : '/admin/suppliers'}
      />
    </div>
  )
}
