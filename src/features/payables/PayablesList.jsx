import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, IndianRupee, Search, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { DEMO_MODE } from '../../config/demoMode'
import { safeNumber } from '../purchases/purchaseHelpers'
import { paymentStatusMeta, PAYMENT_STATUS_OPTIONS, verificationMeta } from '../supplierInvoices/supplierInvoiceHelpers'
import {
  ageingBucket,
  AGEING_FILTER_OPTIONS,
  dueCondition,
  DUE_FILTER_OPTIONS,
  PAYABLE_SORT_OPTIONS,
} from './payableHelpers'
import { PAYABLES_DEMO_ENABLED, demoPayables, paidThisMonth } from './payableDemoData'
import PayableQuickView from './PayableQuickView'
import RecordSupplierPaymentDrawer from '../supplierPayments/RecordSupplierPaymentDrawer'
import {
  AP_AGEING_FILTER_OPTIONS,
  apAgeingLabel,
  apAgeingVariant,
  getAccountsPayableSummary,
  listAccountsPayable,
} from '../../api/accountsPayable'

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

  // ---- real data ------------------------------------------------------
  const [realPayables, setRealPayables] = useState([])
  const [realSummary, setRealSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(!DEMO_MODE)
  const [loadError, setLoadError] = useState('')

  const loadReal = useCallback(async () => {
    if (DEMO_MODE) return
    setIsLoading(true)
    setLoadError('')
    const [listResult, summaryResult] = await Promise.all([
      listAccountsPayable({ page: 1, page_size: 100 }),
      getAccountsPayableSummary(),
    ])
    setIsLoading(false)
    if (!listResult.success) {
      setRealPayables([])
      setRealSummary(null)
      setLoadError(listResult.error)
      return
    }
    setRealPayables(listResult.payables)
    setRealSummary(summaryResult.success ? summaryResult.summary : null)
  }, [])

  useEffect(() => {
    loadReal()
  }, [loadReal])

  // refresh is bumped after a demo payment so the demo store is re-read.
  /* eslint-disable react-hooks/exhaustive-deps */
  const demoRows = useMemo(() => (DEMO_MODE ? (demoOn ? demoPayables() : []) : []), [demoOn, refresh])
  const demoMonthPaid = useMemo(() => (DEMO_MODE && demoOn ? paidThisMonth() : 0), [demoOn, refresh])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Unified row shape.
  const rows = useMemo(() => {
    if (DEMO_MODE) {
      return demoRows.map((row) => ({
        ...row,
        ageingLabel: ageingBucket(row.dueDate, row.outstanding)?.label || null,
        ageingVariant: ageingBucket(row.dueDate, row.outstanding)?.variant || 'neutral',
        due: dueCondition(row.dueDate, row.outstanding),
        verification: null,
        isDemo: true,
      }))
    }
    return realPayables.map((row) => ({
      id: row.supplierInvoiceId,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      supplierInvoiceNumber: row.supplierInvoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      invoiceTotal: row.grandTotal,
      amountPaid: row.amountPaid,
      outstanding: row.outstandingAmount,
      paymentStatus: row.paymentStatus,
      ageingLabel: row.ageingBucket ? apAgeingLabel(row.ageingBucket) : null,
      ageingVariant: apAgeingVariant(row.ageingBucket),
      due: row.isOverdue ? { key: 'overdue', label: `Overdue ${row.daysOverdue}d`, variant: 'danger' } : null,
      verification: row.verificationStatus === 'mismatched' ? verificationMeta('mismatched') : null,
      isDemo: false,
    }))
  }, [demoRows, realPayables])

  const supplierOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [rows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const out = rows.filter((row) => {
      const matchesSearch =
        !query ||
        [row.supplierName, row.supplierInvoiceNumber].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || row.supplierName === supplierFilter
      const matchesPayment = paymentStatusFilter === 'all' || row.paymentStatus === paymentStatusFilter
      const matchesDue = dueFilter === 'all' || row.due?.key === dueFilter
      const matchesAgeing =
        ageingFilter === 'all' ||
        (DEMO_MODE ? ageingBucket(row.dueDate, row.outstanding)?.key === ageingFilter : row.ageingLabel === apAgeingLabel(ageingFilter))
      return matchesSearch && matchesSupplier && matchesPayment && matchesDue && matchesAgeing
    })

    return out.sort((left, right) => {
      if (sortFilter === 'outstanding') return safeNumber(right.outstanding) - safeNumber(left.outstanding)
      if (sortFilter === 'dueDate') return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      const leftTime = new Date(left.invoiceDate || 0).getTime()
      const rightTime = new Date(right.invoiceDate || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [rows, search, supplierFilter, paymentStatusFilter, dueFilter, ageingFilter, sortFilter])

  // Header metrics: real -> ALWAYS the backend summary (reflects all matching payables, not the
  // visible page). Demo -> derived from the demo store.
  const stats = useMemo(() => {
    if (!DEMO_MODE) {
      return {
        totalOutstanding: realSummary?.totalPayable ?? 0,
        totalOverdue: realSummary?.totalOverdue ?? 0,
        dueToday: realSummary?.dueToday ?? 0,
        openCount: realSummary?.openInvoiceCount ?? 0,
        supplierCount: realSummary?.supplierCount ?? 0,
        monthPaid: null,
        ageing: realSummary?.ageing || null,
      }
    }
    const now = Date.now()
    const open = demoRows.filter((row) => row.paymentStatus !== 'paid')
    return {
      totalOutstanding: open.reduce((sum, row) => sum + safeNumber(row.outstanding), 0),
      totalOverdue: null,
      dueToday: null,
      openCount: open.length,
      supplierCount: new Set(open.map((row) => row.supplierId)).size,
      dueSoon: open.filter((row) => dueCondition(row.dueDate, row.outstanding, now)?.key === 'due_soon').length,
      overdue: open.filter((row) => dueCondition(row.dueDate, row.outstanding, now)?.key === 'overdue').length,
      monthPaid: demoMonthPaid,
      ageing: null,
    }
  }, [realSummary, demoRows, demoMonthPaid])

  const bump = () => setRefresh((value) => value + 1)
  const openRecordPayment = (row) => setRecordPreset({ supplierId: row.supplierId, invoiceId: row.id, amount: row.outstanding })
  const openRow = (row) => {
    if (DEMO_MODE) setQuickViewId(row.id)
    else navigate(`${invoiceBasePath}/${row.id}`)
  }

  const ageingFilterOptions = DEMO_MODE ? AGEING_FILTER_OPTIONS : AP_AGEING_FILTER_OPTIONS

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Accounts Payable</h1>
        <p className="mt-1 text-sm text-neutral-500">What you still owe each supplier, derived from recorded supplier invoices. Read-only.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="warning" label="Total Payable" value={formatCurrency(stats.totalOutstanding)} />
        {DEMO_MODE ? (
          <>
            <StatCard icon={CalendarClock} iconVariant="info" label="Due Soon" value={stats.dueSoon ?? 0} />
            <StatCard icon={AlertTriangle} iconVariant="danger" label="Overdue" value={stats.overdue ?? 0} />
            <StatCard icon={Wallet} iconVariant="success" label="Paid This Month" value={formatCurrency(stats.monthPaid)} />
          </>
        ) : (
          <>
            <StatCard icon={AlertTriangle} iconVariant="danger" label="Total Overdue" value={formatCurrency(stats.totalOverdue)} />
            <StatCard icon={CalendarClock} iconVariant="info" label="Due Today" value={formatCurrency(stats.dueToday)} />
            <StatCard icon={Wallet} iconVariant="primary" label="Open Invoices" value={`${stats.openCount} · ${stats.supplierCount} suppliers`} />
          </>
        )}
      </div>

      {!DEMO_MODE && stats.ageing && (
        <Card title="Ageing" subtitle="From the backend summary — reflects all matching payables, not the current page.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['0_30', '1–30 Days'],
              ['31_60', '31–60 Days'],
              ['61_90', '61–90 Days'],
              ['90_plus', '90+ Days'],
            ].map(([key, label]) => (
              <div key={key} className="rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(stats.ageing[key])}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
          {DEMO_MODE && <Select options={DUE_FILTER_OPTIONS} value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />}
          <Select options={ageingFilterOptions} value={ageingFilter} onChange={(event) => setAgeingFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
          <Select options={PAYABLE_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8"><LoadingSpinner label="Loading accounts payable..." /></div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadReal}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No open payables. Recorded supplier invoices with a balance appear here.</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No payables match the selected filters.</p>
          ) : (
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3.5">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Supplier Invoice #</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Invoice Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Due Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Total</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Paid</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Outstanding</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Payment</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Ageing</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((row) => {
                  const payment = paymentStatusMeta(row.paymentStatus)
                  return (
                    <tr key={row.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => openRow(row)}>
                      <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{row.supplierName}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">
                        {row.supplierInvoiceNumber}
                        {row.verification && <span className="ml-2 align-middle"><Badge variant={row.verification.variant}>{row.verification.label}</Badge></span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(row.invoiceDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">
                        {formatDate(row.dueDate)}
                        {row.due && <span className="ml-2 align-middle"><Badge variant={row.due.variant}>{row.due.label}</Badge></span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(row.invoiceTotal)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{formatCurrency(row.amountPaid)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(row.outstanding)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={payment.variant} dot>{payment.label}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {row.ageingLabel ? <Badge variant={row.ageingVariant}>{row.ageingLabel}</Badge> : <span className="text-neutral-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {DEMO_MODE && (
                            <Button type="button" size="sm" disabled={row.outstanding <= 0} onClick={() => openRecordPayment(row)}>Record Payment</Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`${invoiceBasePath}/${row.id}`)}>View Invoice</Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {DEMO_MODE && (
        <>
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
        </>
      )}
    </div>
  )
}
