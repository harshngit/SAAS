import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { ListOverview, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ClipboardList, Eye, IndianRupee, Pencil, Plus, Search } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { useSummaryRows } from '../../hooks/useSummaryRows'
import { fetchAllPages, useFullListWhen } from '../../hooks/useFullListWhen'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
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
import { listSuppliers } from '../../api/suppliers'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const PAGE_SIZE = 25

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
      supplierId: invoice.supplierId,
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
    supplierId: resolved.supplierId,
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
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  // Column-header sorting (backend sort_by/sort_order, GET /supplier-invoices supports it) takes
  // priority over the existing Recent/Oldest/Due Date toolbar control, which only ever re-sorts
  // the already-fetched current page - see `rows` below for how the two compose.
  const { sortBy: headerSortBy, sortOrder: headerSortOrder, toggleSort, sortParams } = useSortState()

  const handleSort = (field) => {
    toggleSort(field)
    if (!DEMO_MODE) setPage(1)
  }

  const [serverInvoices, setServerInvoices] = useState([])
  const [realSupplierOptions, setRealSupplierOptions] = useState([{ value: 'all', label: 'All Suppliers' }])
  const [serverTotal, setServerTotal] = useState(0)
  const [serverLoading, setServerLoading] = useState(!DEMO_MODE)
  const [serverError, setServerError] = useState('')
  const { rows: summaryInvoices, error: summaryError } = useSummaryRows(listSupplierInvoices, 'invoices', !DEMO_MODE)

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  // GET /supplier-invoices has no date parameter. While a date range is applied the page loads the
  // complete list and filters + paginates it here; otherwise it pages on the server as before.
  const dateActive = !DEMO_MODE && datePreset !== 'all'

  const load = useCallback(async () => {
    if (DEMO_MODE || dateActive) return
    setServerLoading(true)
    setServerError('')
    const result = await listSupplierInvoices({
      supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
      status: lifecycleFilter,
      verification_status: verificationFilter,
      payment_status: paymentStatusFilter,
      search: search.trim() || undefined,
      page,
      page_size: PAGE_SIZE,
      ...sortParams,
    })
    setServerLoading(false)
    if (!result.success) {
      setServerInvoices([])
      setServerTotal(0)
      setServerError(result.error)
      return
    }
    setServerInvoices(result.invoices)
    setServerTotal(result.total)
  }, [dateActive, lifecycleFilter, page, paymentStatusFilter, search, supplierFilter, verificationFilter, sortParams])

  useEffect(() => {
    load()
  }, [load])

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
      const result = await listSupplierInvoices({
        supplier_id: supplierFilter !== 'all' ? supplierFilter : undefined,
        status: lifecycleFilter,
        verification_status: verificationFilter,
        payment_status: paymentStatusFilter,
        search: search.trim() || undefined,
        page: pageNumber,
        page_size: size,
        ...sortParams,
      })
      return result.success ? { success: true, rows: result.invoices, total: result.total } : result
    }),
    [supplierFilter, lifecycleFilter, verificationFilter, paymentStatusFilter, search, sortParams],
  )
  const dateMatches = useMemo(
    () => (dateActive ? fullList.rows.filter((invoice) => isWithinDateRange(invoice.invoiceDate, dateFrom, dateTo)) : []),
    [dateActive, fullList.rows, dateFrom, dateTo],
  )
  const realInvoices = dateActive ? dateMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : serverInvoices
  const realTotal = dateActive ? dateMatches.length : serverTotal
  const isLoading = dateActive ? fullList.loading : serverLoading
  const loadError = dateActive ? fullList.error : serverError

  const rows = useMemo(() => {
    const source = DEMO_MODE
      ? SUPPLIER_INVOICES_DEMO_ENABLED
        ? demoSupplierInvoicesResolved()
        : []
      : realInvoices
    return source.map((invoice) => toRow(invoice, DEMO_MODE))
  }, [realInvoices])

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
      // keep that order rather than re-sorting it by date here.
      if (headerSortBy) return rows

      return [...rows].sort((left, right) => {
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
        [row.supplierInvoiceNumber, row.supplierName, row.purchaseNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || row.supplierId === supplierFilter
      const matchesLifecycle = lifecycleFilter === 'all' || row.lifecycle?.key === lifecycleFilter
      const matchesVerification =
        verificationFilter === 'all' || (row.verification?.key || 'pending') === verificationFilter
      const matchesPayment = paymentStatusFilter === 'all' || row.payment?.key === paymentStatusFilter
      const matchesDate = isWithinDateRange(row.invoiceDate, dateFrom, dateTo)
      return matchesSearch && matchesSupplier && matchesLifecycle && matchesVerification && matchesPayment && matchesDate
    })

    return out.sort((left, right) => {
      if (sortFilter === 'dueDate') {
        return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
      }
      const leftTime = new Date(left.invoiceDate || 0).getTime()
      const rightTime = new Date(right.invoiceDate || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [rows, search, supplierFilter, lifecycleFilter, verificationFilter, paymentStatusFilter, sortFilter, dateFrom, dateTo, headerSortBy])

  const stats = useMemo(() => {
    if (!DEMO_MODE && !summaryInvoices) return null
    const source = DEMO_MODE ? rows : summaryInvoices.map((invoice) => toRow(invoice, false))
    const totalValue = source.reduce((sum, row) => sum + safeNumber(row.grandTotal), 0)
    const outstanding = source.reduce((sum, row) => sum + safeNumber(row.outstanding), 0)
    const now = Date.now()
    const overdue = source.filter(
      (row) =>
        row.lifecycle?.key !== 'cancelled' &&
        safeNumber(row.outstanding) > 0 &&
        row.dueDate &&
        new Date(row.dueDate).getTime() < now,
    ).length
    return { total: source.length, totalValue, outstanding, overdue }
  }, [rows, summaryInvoices])

  const appliedFilters = { supplierFilter, lifecycleFilter, verificationFilter, paymentStatusFilter, sortFilter, datePreset, customFrom, customTo }
  const defaultFilters = { supplierFilter: 'all', lifecycleFilter: 'all', verificationFilter: 'all', paymentStatusFilter: 'all', sortFilter: 'recent', datePreset: 'all', customFrom: '', customTo: '' }
  const applyFilters = (next) => {
    setSupplierFilter(next.supplierFilter)
    setLifecycleFilter(next.lifecycleFilter)
    setVerificationFilter(next.verificationFilter)
    setPaymentStatusFilter(next.paymentStatusFilter)
    setSortFilter(next.sortFilter)
    setDatePreset(next.datePreset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
    setPage(1)
  }

  const lifecycleFilterOptions = DEMO_MODE ? INVOICE_STATUS_OPTIONS : LIFECYCLE_FILTER_OPTIONS

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Supplier Invoices</h1>
      </div>

      <ListOverview>
      <ListSummary loading={isLoading} className="grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} iconVariant="primary" label="Total Supplier Invoices" value={stats?.total ?? '—'} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Total Invoice Value" value={stats ? formatCurrency(stats.totalValue) : '—'} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={stats ? formatCurrency(stats.outstanding) : '—'} />
        <StatCard icon={CalendarClock} iconVariant="danger" label="Overdue Invoices" value={stats?.overdue ?? '—'} />
      </ListSummary>
      </ListOverview>
      {summaryError && <p role="status" className="text-sm text-red-600">Summary: {summaryError}</p>}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Supplier Invoices</h2>
              <p className="mt-1 text-xs text-neutral-400">What your suppliers billed you — distinct from Purchases and Goods Receipts.</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); if (!DEMO_MODE) setPage(1) }}
                  placeholder="Search Invoice # / Supplier / Purchase #"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <ListFilterPanel title="Filter Supplier Invoices" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters} ignoreKeys={['sortFilter']}>
                {({ draft, set, errors }) => (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Supplier
                      <Select options={supplierOptions} value={draft.supplierFilter} onChange={(event) => set('supplierFilter', event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Invoice Status
                      <Select options={[{ value: 'all', label: 'All Statuses' }, ...lifecycleFilterOptions]} value={draft.lifecycleFilter} onChange={(event) => set('lifecycleFilter', event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Verification
                      <Select options={[{ value: 'all', label: 'All Verification' }, ...VERIFICATION_FILTER_OPTIONS]} value={draft.verificationFilter} onChange={(event) => set('verificationFilter', event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Payment Status
                      <Select options={[{ value: 'all', label: 'All Payment Statuses' }, ...PAYMENT_STATUS_OPTIONS]} value={draft.paymentStatusFilter} onChange={(event) => set('paymentStatusFilter', event.target.value)} />
                    </label>
                    <FilterDateRange label="Invoice Date" draft={draft} set={set} errors={errors} />
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort By
                      <Select options={sortOptions} value={draft.sortFilter} onChange={(event) => set('sortFilter', event.target.value)} />
                    </label>
                  </>
                )}
              </ListFilterPanel>
              {canCreate && (
              <Button type="button" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                Add Supplier Invoice
              </Button>
            )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-4xl" columns={["Supplier Invoice #", "Supplier", "Purchase", "Invoice Date", "Due Date", "Total", "Outstanding", "Status", "Verification", "Payment", ""]} label="Loading supplier invoices..." />
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No supplier invoices yet</p>
              <p className="mt-1 text-xs text-neutral-400">Record your first supplier invoice to start tracking payables.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No supplier invoices match the selected filters.</p>
          ) : (
            <table className="listing-table w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <SortableHeaderCell label="Supplier Invoice #" sortKey="supplier_invoice_number" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Supplier" sortKey="supplier" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Purchase</th>
                  <SortableHeaderCell label="Invoice Date" sortKey="invoice_date" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Due Date" sortKey="due_date" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Total" sortKey="grand_total" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} align="right" className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Outstanding" sortKey="outstanding_amount" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} align="right" className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Status" sortKey="status" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Verification" sortKey="verification_status" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Payment" sortKey="payment_status" sortBy={headerSortBy} sortOrder={headerSortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="w-12 px-6 py-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`${basePath}/${row.id}`)}>
                    <td className="whitespace-nowrap px-6 py-5 font-medium text-primary-700">
                      {row.supplierInvoiceNumber || '—'}
                      {row.isDemo && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 text-neutral-800">{row.supplierName || '—'}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{row.purchaseNumber || '—'}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDate(row.invoiceDate)}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-neutral-500">{formatDate(row.dueDate)}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-right font-medium text-neutral-900">{formatCurrency(row.grandTotal)}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-right text-neutral-700">{formatCurrency(row.outstanding)}</td>
                    <td className="whitespace-nowrap px-6 py-5"><Badge variant={row.lifecycle.variant}>{row.lifecycle.label}</Badge></td>
                    <td className="whitespace-nowrap px-6 py-5">
                      {row.verification ? <Badge variant={row.verification.variant}>{row.verification.label}</Badge> : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-5"><Badge variant={row.payment.variant} dot>{row.payment.label}</Badge></td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
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
        {!DEMO_MODE && !isLoading && !loadError && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
            <span>Page {page} of {Math.max(1, Math.ceil(realTotal / PAGE_SIZE))} · {realTotal} invoices</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= Math.max(1, Math.ceil(realTotal / PAGE_SIZE))} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
