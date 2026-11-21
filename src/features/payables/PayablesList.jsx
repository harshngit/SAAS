import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import PaginationFooter from '../../components/ui/PaginationFooter'
import { ListOverview, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import ListActionMenu from '../../components/ui/ListActionMenu'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, IndianRupee, Search, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { fetchAllPages, useFullListWhen } from '../../hooks/useFullListWhen'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
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
import { listSuppliers } from '../../api/suppliers'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const DEFAULT_PAGE_SIZE = 25

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
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [quickViewId, setQuickViewId] = useState(null)
  const [recordPreset, setRecordPreset] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  // Column-header sorting (backend sort_by/sort_order, GET /accounts-payable supports it) takes
  // priority over the existing Recent/Oldest/Outstanding/Due Date toolbar control, which only
  // ever re-sorts the already-fetched current page - see `filtered` below for how they compose.
  const { sortBy: headerSortBy, sortOrder: headerSortOrder, toggleSort, sortParams } = useSortState()

  // The drawer's Sort By (Recent / Oldest / Due date / Outstanding) goes to the backend like a header sort, so the whole list is
  // ordered before it is cut into pages. A clicked column header still wins.
  const effectiveSort = useMemo(() => {
    if (sortParams.sort_by) return sortParams
    if (sortFilter === 'outstanding') return { sort_by: 'outstanding_amount', sort_order: 'desc' }
    if (sortFilter === 'dueDate') return { sort_by: 'due_date', sort_order: 'asc' }
    return { sort_by: 'invoice_date', sort_order: sortFilter === 'oldest' ? 'asc' : 'desc' }
  }, [sortParams, sortFilter])

  const handleSort = (field) => {
    toggleSort(field)
    if (!DEMO_MODE) setPage(1)
  }

  // ---- real data ------------------------------------------------------
  const [serverPayables, setServerPayables] = useState([])
  const [realSupplierOptions, setRealSupplierOptions] = useState([{ value: 'all', label: 'All Suppliers' }])
  const [serverTotal, setServerTotal] = useState(0)
  const [realSummary, setRealSummary] = useState(null)
  const [serverLoading, setServerLoading] = useState(!DEMO_MODE)
  const [serverError, setServerError] = useState('')

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  // GET /accounts-payable has no date parameter. While a date range is applied the page loads the
  // complete list and filters + paginates it here; otherwise it pages on the server as before.
  // GET /accounts-payable returns no `total` (a page of 10 reads as "10 of 10"), so the page always loads the complete list
  // (100 per request, until a short page) and paginates it here. The server still applies supplier / payment status /
  // ageing / search; the date range is applied locally as before.
  const dateActive = !DEMO_MODE

  const loadReal = useCallback(async () => {
    if (DEMO_MODE || dateActive) return
    setServerLoading(true)
    setServerError('')
    const listResult = await listAccountsPayable({
        supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
        payment_status: paymentStatusFilter,
        ageing_bucket: ageingFilter,
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
        ...sortParams,
      })
    setServerLoading(false)
    if (!listResult.success) {
      setServerPayables([])
      setServerTotal(0)
      setServerError(listResult.error)
      return
    }
    setServerPayables(listResult.payables)
    setServerTotal(listResult.total)
  }, [dateActive, ageingFilter, page, pageSize, paymentStatusFilter, search, supplierFilter, sortParams])

  useEffect(() => {
    loadReal()
  }, [loadReal, refresh])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let active = true
    getAccountsPayableSummary().then((result) => {
      if (active && result.success) setRealSummary(result.summary)
    })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    let active = true
    listSuppliers().then((result) => {
      if (!active || !result.success) return
      setRealSupplierOptions([
        { value: 'all', label: 'All Suppliers' },
        ...result.suppliers
          .filter((supplier) => supplier?.id && (supplier.name || supplier.supplier_name))
          .map((supplier) => ({ value: String(supplier.id), label: supplier.name || supplier.supplier_name })),
      ])
    })
    return () => {
      active = false
    }
  }, [])

  const fullList = useFullListWhen(
    dateActive,
    () => fetchAllPages(async (pageNumber, size) => {
      const result = await listAccountsPayable({
        supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
        payment_status: paymentStatusFilter,
        ageing_bucket: ageingFilter,
        search: search.trim() || undefined,
        page: pageNumber,
        page_size: size,
        ...effectiveSort,
      })
      // No total from the backend: a full page means "there may be more", a short page is the last one.
      return result.success ? { success: true, rows: result.payables, total: result.payables.length >= size ? Number.POSITIVE_INFINITY : (pageNumber - 1) * size + result.payables.length } : result
    }),
    [supplierFilter, paymentStatusFilter, ageingFilter, search, effectiveSort, refresh],
  )
  const dateMatches = useMemo(
    () => (dateActive ? fullList.rows.filter((row) => isWithinDateRange(row.invoiceDate, dateFrom, dateTo)) : []),
    [dateActive, fullList.rows, dateFrom, dateTo],
  )
  const realPayables = dateActive ? dateMatches.slice((page - 1) * pageSize, page * pageSize) : serverPayables
  const realTotal = dateActive ? dateMatches.length : serverTotal
  const isLoading = dateActive ? fullList.loading : serverLoading
  const loadError = dateActive ? fullList.error : serverError

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
    if (!DEMO_MODE) return realSupplierOptions
    const suppliers = new Map()
    rows.forEach((row) => {
      const value = row.supplierId || row.supplierName
      if (value && !suppliers.has(value)) suppliers.set(value, row.supplierName || value)
    })
    return [{ value: 'all', label: 'All Suppliers' }, ...Array.from(suppliers, ([value, label]) => ({ value, label }))]
  }, [realSupplierOptions, rows])


  const filtered = useMemo(() => {
    if (!DEMO_MODE) {
      // A clicked column header already sorted `rows` via the backend's sort_by/sort_order -
      // keep that order rather than re-sorting it by date/outstanding here.
      if (headerSortBy) return rows

      return [...rows].sort((left, right) => {
        if (sortFilter === 'outstanding') return safeNumber(right.outstanding) - safeNumber(left.outstanding)
        if (sortFilter === 'dueDate') return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
        const leftTime = new Date(left.invoiceDate || 0).getTime()
        const rightTime = new Date(right.invoiceDate || 0).getTime()
        return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
      })
    }
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
      const matchesDate = isWithinDateRange(row.invoiceDate, dateFrom, dateTo)
      return matchesSearch && matchesSupplier && matchesPayment && matchesDue && matchesAgeing && matchesDate
    })

    return out.sort((left, right) => {
      if (sortFilter === 'outstanding') return safeNumber(right.outstanding) - safeNumber(left.outstanding)
      if (sortFilter === 'dueDate') return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      const leftTime = new Date(left.invoiceDate || 0).getTime()
      const rightTime = new Date(right.invoiceDate || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [rows, search, supplierFilter, paymentStatusFilter, dueFilter, ageingFilter, sortFilter, dateFrom, dateTo, headerSortBy])

  // Header metrics: real -> ALWAYS the unfiltered backend summary (all payables, not the
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

  const appliedFilters = { supplierFilter, paymentStatusFilter, dueFilter, ageingFilter, sortFilter, datePreset, customFrom, customTo }
  const defaultFilters = { supplierFilter: 'all', paymentStatusFilter: 'all', dueFilter: 'all', ageingFilter: 'all', sortFilter: 'recent', datePreset: 'all', customFrom: '', customTo: '' }
  const applyFilters = (next) => {
    setSupplierFilter(next.supplierFilter)
    setPaymentStatusFilter(next.paymentStatusFilter)
    setDueFilter(next.dueFilter)
    setAgeingFilter(next.ageingFilter)
    setSortFilter(next.sortFilter)
    setDatePreset(next.datePreset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
    setPage(1)
  }

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Accounts Payable</h1>
      </div>

      <ListOverview>
      <ListSummary loading={isLoading} className={DEMO_MODE ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-5'}>
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
            <StatCard icon={Wallet} iconVariant="primary" label="Open Invoices" value={stats.openCount} />
            <StatCard icon={Wallet} iconVariant="primary" label="Open Suppliers" value={stats.supplierCount} />
          </>
        )}
      </ListSummary>
      </ListOverview>

      {!DEMO_MODE && stats.ageing && (
        <Card title="Ageing" subtitle="Invoices without a due date remain in Total Payable and open counts, but are excluded from overdue amounts and ageing buckets.">
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

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Accounts Payable</h2>
              <p className="mt-1 text-xs text-neutral-400">What you still owe each supplier, derived from recorded supplier invoices. Read-only.</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); if (!DEMO_MODE) setPage(1) }}
                  placeholder="Search Supplier / Supplier Invoice #"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <ListFilterPanel title="Filter Accounts Payable" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters} ignoreKeys={['sortFilter']}>
                {({ draft, set, errors }) => (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Supplier
                      <Select options={supplierOptions} value={draft.supplierFilter} onChange={(event) => set('supplierFilter', event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Payment Status
                      <Select options={[{ value: 'all', label: 'All Payment Statuses' }, ...PAYMENT_STATUS_OPTIONS]} value={draft.paymentStatusFilter} onChange={(event) => set('paymentStatusFilter', event.target.value)} />
                    </label>
                    {DEMO_MODE && (
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Due Date
                        <Select options={DUE_FILTER_OPTIONS} value={draft.dueFilter} onChange={(event) => set('dueFilter', event.target.value)} />
                      </label>
                    )}
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Ageing
                      <Select options={ageingFilterOptions} value={draft.ageingFilter} onChange={(event) => set('ageingFilter', event.target.value)} />
                    </label>
                    <FilterDateRange label="Invoice Date" draft={draft} set={set} errors={errors} />
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort By
                      <Select options={PAYABLE_SORT_OPTIONS} value={draft.sortFilter} onChange={(event) => set('sortFilter', event.target.value)} />
                    </label>
                  </>
                )}
              </ListFilterPanel>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-4xl" columns={["Supplier", "Supplier Invoice #", "Invoice Date", "Due Date", "Total", "Paid", "Outstanding", "Payment", "Ageing", "Action"]} label="Loading accounts payable..." />
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
            <table className="listing-table w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <SortableHeaderCell label="Supplier" sortKey="supplier" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Supplier Invoice #" sortKey="supplier_invoice_number" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Invoice Date" sortKey="invoice_date" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Due Date" sortKey="due_date" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Total" sortKey="grand_total" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} align="right" className="whitespace-nowrap px-6 py-6" />
                  {/* Not server-sortable - GET /accounts-payable has no amount_paid sort_by field */}
                  <SortableHeaderCell label="Paid" sortable={false} align="right" className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Outstanding" sortKey="outstanding_amount" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} align="right" className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Payment" sortKey="payment_status" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Ageing</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((row) => {
                  const payment = paymentStatusMeta(row.paymentStatus)
                  return (
                    <tr key={row.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => openRow(row)}>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-800">{row.supplierName}</td>
                      <td className="whitespace-nowrap px-6 py-5 font-medium text-primary-700">
                        {row.supplierInvoiceNumber}
                        {row.verification && <span className="ml-2 align-middle"><Badge variant={row.verification.variant}>{row.verification.label}</Badge></span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDate(row.invoiceDate)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-neutral-500">
                        {formatDate(row.dueDate)}
                        {row.due && <span className="ml-2 align-middle"><Badge variant={row.due.variant}>{row.due.label}</Badge></span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-700">{formatCurrency(row.invoiceTotal)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-700">{formatCurrency(row.amountPaid)}</td>
                      <td className="whitespace-nowrap px-6 py-5 text-right font-medium text-neutral-900">{formatCurrency(row.outstanding)}</td>
                      <td className="whitespace-nowrap px-6 py-5"><Badge variant={payment.variant} dot>{payment.label}</Badge></td>
                      <td className="whitespace-nowrap px-6 py-5">
                        {row.ageingLabel ? <Badge variant={row.ageingVariant}>{row.ageingLabel}</Badge> : <span className="text-neutral-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ListActionMenu items={[
                          ...(DEMO_MODE ? [{ label: 'Record Payment', disabled: row.outstanding <= 0, onClick: () => openRecordPayment(row) }] : []),
                          { label: 'View Invoice', onClick: () => navigate(`${invoiceBasePath}/${row.id}`) },
                        ]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!DEMO_MODE && !isLoading && !loadError && (
          <PaginationFooter page={page} pageSize={pageSize} total={realTotal} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
        )}
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
