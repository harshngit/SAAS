import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { ListOverview, ListHeader, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, IndianRupee, Plus, Search, Users, Wallet } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { formatCurrency } from '../../utils/format'
import { usePermission } from '../../auth/usePermission'
import { DEMO_MODE } from '../../config/demoMode'
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
} from './supplierPaymentHelpers'
import {
  getSupplierPayments,
  paidThisMonth,
  recentPaymentsCount,
  suppliersPaidCount,
  totalPaid,
} from './supplierPaymentDemoData'
import RecordSupplierPaymentDrawer from './RecordSupplierPaymentDrawer'
import SupplierPaymentQuickView from './SupplierPaymentQuickView'
import { listSupplierPayments } from '../../api/supplierPayments'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const PAGE_SIZE = 25

// Fold demo + real into one row shape.
function toRow(payment, isDemo) {
  if (!isDemo) {
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      supplierName: payment.supplierName,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      allocatedAmount: payment.allocatedAmount,
      unallocatedAmount: payment.unallocatedAmount,
      paymentMode: payment.paymentMethod,
      reference: payment.reference,
      status: payment.status,
      allocations: payment.allocations,
      isDemo: false,
    }
  }
  const allocated = (payment.allocations || []).reduce((sum, line) => sum + safeNumber(line.amount), 0)
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    supplierName: payment.supplierName,
    paymentDate: payment.paymentDate,
    amount: payment.amount,
    allocatedAmount: payment.status === 'voided' ? 0 : allocated,
    unallocatedAmount: payment.status === 'voided' ? 0 : Math.max(safeNumber(payment.amount) - allocated, 0),
    paymentMode: payment.paymentMode,
    reference: payment.reference,
    status: payment.status,
    allocations: payment.allocations,
    isDemo: true,
  }
}

export default function SupplierPaymentsList() {
  const { can } = usePermission()
  const onAccounts = window.location.pathname.startsWith('/accounts')
  const invoiceBasePath = onAccounts ? '/accounts/supplier-invoices' : '/admin/supplier-invoices'
  const canCreate = DEMO_MODE || can('supplier_payments', 'create')

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [recordOpen, setRecordOpen] = useState(false)
  const [quickViewId, setQuickViewId] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)

  const [realPayments, setRealPayments] = useState([])
  const [realTotal, setRealTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(!DEMO_MODE)
  const [loadError, setLoadError] = useState('')

  const loadReal = useCallback(async () => {
    if (DEMO_MODE) return
    setIsLoading(true)
    setLoadError('')
    const result = await listSupplierPayments({
      page,
      page_size: PAGE_SIZE,
      status: statusFilter,
      payment_method: modeFilter,
      search: search.trim() || undefined,
    })
    setIsLoading(false)
    if (!result.success) {
      setRealPayments([])
      setRealTotal(0)
      setLoadError(result.error)
      return
    }
    setRealPayments(result.payments)
    setRealTotal(result.total)
  }, [page, statusFilter, modeFilter, search])

  useEffect(() => {
    loadReal()
  }, [loadReal, refresh])

  /* eslint-disable react-hooks/exhaustive-deps */
  const demoPayments = useMemo(() => (DEMO_MODE ? getSupplierPayments() : []), [refresh])
  const demoStats = useMemo(
    () =>
      DEMO_MODE
        ? { total: totalPaid(), month: paidThisMonth(), suppliers: suppliersPaidCount(), recent: recentPaymentsCount() }
        : { total: 0, month: 0, suppliers: 0, recent: 0 },
    [refresh],
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  const rows = useMemo(() => {
    const source = DEMO_MODE ? demoPayments : realPayments
    return source.map((payment) => toRow(payment, DEMO_MODE))
  }, [demoPayments, realPayments])

  const supplierOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [rows])

  // Real mode: status / method / search are server-side; supplier / date / sort are client-side
  // over the current page. Demo mode: everything client-side.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const now = Date.now()
    const out = rows.filter((payment) => {
      const matchesSearch =
        !DEMO_MODE ||
        !query ||
        [payment.paymentNumber, payment.supplierName, payment.reference]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || payment.supplierName === supplierFilter
      const matchesMode = !DEMO_MODE || modeFilter === 'all' || payment.paymentMode === modeFilter
      const matchesStatus = !DEMO_MODE || statusFilter === 'all' || payment.status === statusFilter
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'this_month' && isSameMonth(payment.paymentDate)) ||
        (dateFilter === 'recent' && isWithinDays(payment.paymentDate, 30, now))
      return matchesSearch && matchesSupplier && matchesMode && matchesStatus && matchesDate
    })

    return out.sort((left, right) => {
      if (sortFilter === 'amount') return safeNumber(right.amount) - safeNumber(left.amount)
      const leftTime = new Date(left.paymentDate || 0).getTime()
      const rightTime = new Date(right.paymentDate || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [rows, search, supplierFilter, modeFilter, statusFilter, dateFilter, sortFilter])

  // Header stats: demo -> demo ledger; real -> aggregate of the RECORDED payments on this page
  // (the backend has no supplier-payment summary endpoint, so this is page-scoped and labelled).
  const stats = useMemo(() => {
    if (DEMO_MODE) return demoStats
    const recorded = realPayments.filter((p) => p.status === 'recorded')
    return {
      total: recorded.reduce((sum, p) => sum + safeNumber(p.amount), 0),
      month: recorded.filter((p) => isSameMonth(p.paymentDate)).reduce((sum, p) => sum + safeNumber(p.amount), 0),
      suppliers: new Set(recorded.map((p) => p.supplierId)).size,
      recent: recorded.filter((p) => isWithinDays(p.paymentDate, 30)).length,
    }
  }, [demoStats, realPayments])

  const bump = () => setRefresh((value) => value + 1)
  const totalPages = DEMO_MODE ? 1 : Math.max(1, Math.ceil(realTotal / PAGE_SIZE))

  return (
    <div className="listing-page space-y-4">
      <ListOverview>
      <ListHeader>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Supplier Payments</h1>
          <p className="mt-1 text-xs text-neutral-400">When, how much, and against which invoices each supplier was paid.</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                if (!DEMO_MODE) setPage(1)
              }}
              placeholder="Search Payment # / Supplier / Reference"
              className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <ListFilterPanel title="Filter Supplier Payments">
            <Select label="Supplier" options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          <Select label="Payment mode" options={[{ value: 'all', label: 'All Modes' }, ...PAYMENT_MODE_OPTIONS]} value={modeFilter} onChange={(event) => { setModeFilter(event.target.value); if (!DEMO_MODE) setPage(1) }} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          <Select label="Status" options={PAYMENT_STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); if (!DEMO_MODE) setPage(1) }} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          <Select label="Date" options={PAYMENT_DATE_FILTER_OPTIONS} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          <Select label="Sort by" options={PAYMENT_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
          </ListFilterPanel>
          {canCreate && (
          <Button type="button" onClick={() => setRecordOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Create Payment
          </Button>
        )}
        </div>
      </ListHeader>

      <ListSummary className="grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label={DEMO_MODE ? 'Total Paid' : 'Paid (this page)'} value={formatCurrency(stats.total)} />
        <StatCard icon={Wallet} iconVariant="success" label="Payments This Month" value={formatCurrency(stats.month)} />
        <StatCard icon={Users} iconVariant="info" label="Suppliers Paid" value={stats.suppliers} />
        <StatCard icon={CalendarClock} iconVariant="warning" label="Recent Payments" value={stats.recent} />
      </ListSummary>
      </ListOverview>

      <Card className="overflow-hidden p-0">

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8"><LoadingSpinner label="Loading supplier payments..." /></div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadReal}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No supplier payments recorded yet.</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No payments match the selected filters.</p>
          ) : (
            <table className="listing-table w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="whitespace-nowrap px-6 py-6">Payment #</th>
                  <th className="whitespace-nowrap px-6 py-6">Supplier</th>
                  <th className="whitespace-nowrap px-6 py-6">Payment Date</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Amount</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Allocated</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Unallocated</th>
                  <th className="whitespace-nowrap px-6 py-6">Method</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="w-12 px-6 py-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((payment) => {
                  const status = paymentStatusMeta(payment.status)
                  return (
                    <tr key={payment.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => setQuickViewId(payment.id)}>
                      <td className="whitespace-nowrap px-6 py-5 font-medium text-primary-700">
                        {payment.paymentNumber}
                        {payment.isDemo && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-800">{payment.supplierName}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDate(payment.paymentDate)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right font-medium text-neutral-900">{formatCurrency(payment.amount)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-700">{formatCurrency(payment.allocatedAmount)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-700">{formatCurrency(payment.unallocatedAmount)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-600">{paymentModeLabel(payment.paymentMode)}</td>
                      <td className="whitespace-nowrap px-6 py-5"><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu items={[{ label: 'View', onClick: () => setQuickViewId(payment.id) }]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!DEMO_MODE && !isLoading && !loadError && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
            <span>Page {page} of {totalPages} · {realTotal} payments</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

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
