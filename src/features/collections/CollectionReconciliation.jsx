import { SkeletonValue } from '../../components/ui/Skeleton'
import useSubmitLock from '../../hooks/useSubmitLock'
import PaginationFooter from '../../components/ui/PaginationFooter'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { ListDataTable as DataTable, ListTableToolbar } from '../../components/ui/ListPresentation'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import ActionMenu from '../../components/ui/ActionMenu'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, Ban, Eye, HandCoins, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EntitySearchSelect from '../reports/components/EntitySearchSelect'
import { resolveDateRange } from '../../utils/dateRange'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { listCollections, listAllCollections, getCollectionsSummary, reconcileCollection, voidCollection } from '../../api/deliveryCollections'
import { getFileUrl } from '../../api/files'
import { listCustomers } from '../../api/customers'
import { listOrders } from '../../api/orders'
import { formatCurrency } from '../../utils/format'
import CollectionDetailDrawer from './CollectionDetailDrawer'
import useCollectorOptions from './useCollectorOptions'
import {
  COLLECTION_STATUS_VARIANT,
  COLLECTION_TABS,
  PAYMENT_MODE_FILTER_KEYS,
  formatBusinessDate,
  formatPaymentMode,
  formatStatus,
  isReconcilable,
  isVoidable,
  linkedValue,
  nameOrNotAvailable,
  paymentModeKey,
} from './collectionHelpers'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const DEFAULT_PAGE_SIZE = 25
const NO_FILTERS = { tab: 'all', partnerId: 'all', mode: 'all', customerId: '', customerLabel: '', orderId: '', orderLabel: '', datePreset: 'all', customFrom: '', customTo: '' }
const emptyStat = () => ({ count: 0, amount: 0 })
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100
const addTo = (stat, amount) => ({ count: stat.count + 1, amount: toMoney(stat.amount + (Number(amount) || 0)) })

// Tile figures from a complete list of records (used only when the payment-mode filter is on).
function totalsFromRows(rows) {
  const byStatus = { recorded: emptyStat(), reconciled: emptyStat(), voided: emptyStat() }
  const modes = {}
  rows.forEach((row) => {
    byStatus[row.status] = addTo(byStatus[row.status], row.amount)
    if (row.status !== 'voided') {
      const key = paymentModeKey(row.paymentMode)
      modes[key] = toMoney((modes[key] || 0) + row.amount)
    }
  })
  return { collected: byStatus.recorded, completed: byStatus.reconciled, voided: byStatus.voided, modes }
}

export default function CollectionReconciliation() {
  const { showToast } = useToast()
  const { can } = usePermission()
  // There is no delivery_collections permission in the backend. Confirm Payment (the reconcile endpoint) and Void (same
  // gate in the backend, build 78ba5a0) need the Deliveries > Approve permission AND finance read access (Payments or
  // Invoices view) - without Approve the backend answers 403 "this needs the Deliveries > Approve permission on your
  // role", without finance access 403 "Only Accountants or Admins ...".
  const canReconcile = can('deliveries', 'approve') && (can('payments', 'view') || can('invoices', 'view'))

  // One applied-filter object: the tabs and the Filter drawer's Status field change the same `tab`.
  const [filters, setFilters] = useState(NO_FILTERS)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const tab = COLLECTION_TABS.find((item) => item.value === filters.tab) || COLLECTION_TABS[0]
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(filters.datePreset, filters.customFrom, filters.customTo), [filters.datePreset, filters.customFrom, filters.customTo])
  // Only the custom preset lets the two ends be picked independently - every built-in preset
  // already resolves to a valid from <= to pair.
  const dateRangeInvalid = filters.datePreset === 'custom' && Boolean(dateFrom) && Boolean(dateTo) && dateFrom > dateTo
  // The filters GET /deliveries/collections (and its summary) supports. Status comes from the tab.
  const query = useMemo(() => ({
    search: search || undefined,
    customer_id: filters.customerId || undefined,
    order_id: filters.orderId || undefined,
    // The backend treats "delivery partner" and "collected by" as the same field.
    delivery_partner_id: filters.partnerId !== 'all' ? filters.partnerId : undefined,
    // An invalid custom range (from > to) is never sent.
    date_from: !dateRangeInvalid && dateFrom ? dateFrom : undefined,
    date_to: !dateRangeInvalid && dateTo ? dateTo : undefined,
  }), [search, filters.customerId, filters.orderId, filters.partnerId, dateFrom, dateTo, dateRangeInvalid])
  // The endpoint has no payment-mode filter: with one applied, every matching record is loaded and then filtered,
  // totalled and paged here - so the tiles, tabs and page numbers still describe the whole filtered set.
  const isModeFiltered = filters.mode !== 'all'

  const [serverRows, setServerRows] = useState([])
  const [serverTotal, setServerTotal] = useState(0)
  const [allRows, setAllRows] = useState([])
  const [serverTotals, setServerTotals] = useState(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingTotals, setIsLoadingTotals] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  // Only the answer to the newest request is shown (a slow earlier tab must not overwrite the current one).
  const listRequest = useRef(0)
  const totalsRequest = useRef(0)

  const [detail, setDetail] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const { begin, end } = useSubmitLock(setIsActing)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = searchInput.trim()
      if (next !== search) {
        setSearch(next)
        setPage(1)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput, search])

  const showListFailure = useCallback((message) => {
    setLoadError(message)
    setUnavailable(/did not respond \(404\)/i.test(message || ''))
  }, [])

  const loadPage = useCallback(async () => {
    const request = ++listRequest.current
    setIsLoadingList(true)
    setLoadError('')
    const result = await listCollections({ ...query, view: tab.named ? 'collected' : undefined, status: tab.status, page, page_size: pageSize })
    if (request !== listRequest.current) return
    if (!result.success) {
      setServerRows([])
      setServerTotal(0)
      showListFailure(result.error)
    } else {
      setUnavailable(false)
      const total = result.total ?? result.collections.length
      // The last record of the last page was just confirmed or voided: step back to the new last page.
      if (result.collections.length === 0 && total > 0 && page > 1) {
        setPage(Math.max(1, Math.ceil(total / pageSize)))
        return
      }
      setServerRows(result.collections)
      setServerTotal(total)
    }
    setIsLoadingList(false)
  }, [query, tab, page, pageSize, showListFailure])

  const loadEverything = useCallback(async () => {
    const request = ++listRequest.current
    setIsLoadingList(true)
    setLoadError('')
    const [history, named] = await Promise.all([listAllCollections(query), listAllCollections({ ...query, view: 'collected' })])
    if (request !== listRequest.current) return
    if (!history.success) {
      setAllRows([])
      showListFailure(history.error)
    } else {
      setUnavailable(false)
      const names = new Map(named.success ? named.collections.map((row) => [row.id, row]) : [])
      setAllRows(history.collections.map((row) => names.get(row.id) || row))
    }
    setIsLoadingList(false)
  }, [query, showListFailure])

  // Tiles: every lifecycle state for the current filters, whichever tab is open.
  const loadTotals = useCallback(async () => {
    const request = ++totalsRequest.current
    setIsLoadingTotals(true)
    const [summary, named] = await Promise.all([
      getCollectionsSummary(query),
      // Only for the payment-mode breakdown: this view's totals leave voided money out.
      listCollections({ ...query, view: 'collected', page: 1, page_size: 1 }),
    ])
    if (request !== totalsRequest.current) return
    setServerTotals(summary.success
      ? {
        collected: summary.byStatus.awaiting_reconciliation || emptyStat(),
        completed: summary.byStatus.reconciled || emptyStat(),
        voided: summary.byStatus.voided || emptyStat(),
        modes: (named.success && named.summary?.by_payment_mode) || {},
      }
      : null)
    setIsLoadingTotals(false)
  }, [query])

  useEffect(() => {
    if (!isModeFiltered) loadPage()
  }, [isModeFiltered, loadPage])

  useEffect(() => {
    if (isModeFiltered) loadEverything()
  }, [isModeFiltered, loadEverything])

  useEffect(() => {
    if (!isModeFiltered) loadTotals()
  }, [isModeFiltered, loadTotals])

  const refresh = useCallback(() => {
    if (isModeFiltered) loadEverything()
    else {
      loadPage()
      loadTotals()
    }
  }, [isModeFiltered, loadEverything, loadPage, loadTotals])

  const modeRows = useMemo(() => allRows.filter((row) => paymentModeKey(row.paymentMode) === filters.mode), [allRows, filters.mode])
  const modeTabRows = useMemo(() => (tab.status ? modeRows.filter((row) => row.status === tab.status) : modeRows), [modeRows, tab])
  const total = isModeFiltered ? modeTabRows.length : serverTotal
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, lastPage)
  const pageRows = useMemo(
    () => (isModeFiltered ? modeTabRows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : serverRows),
    [isModeFiltered, modeTabRows, currentPage, pageSize, serverRows],
  )

  const collectorOptions = useCollectorOptions(pageRows)
  // Names and numbers come straight from the collection API - no per-row lookups.
  const rows = useMemo(() => pageRows.map((row) => ({
    ...row,
    _amount: Number(row.amount) || 0,
    _collectedAtLabel: formatDateTime(row.recordedAt),
    _paymentDateLabel: formatBusinessDate(row.paymentDate),
    _modeLabel: formatPaymentMode(row.paymentMode),
  })), [pageRows])

  const totals = useMemo(() => (isModeFiltered ? totalsFromRows(modeRows) : serverTotals), [isModeFiltered, modeRows, serverTotals])
  const totalsLoading = isModeFiltered ? isLoadingList : isLoadingTotals
  // Total Collections = Collected + Completed. Voided money is never part of it.
  const tiles = [
    { label: 'Total Collections', stat: totals && { count: totals.collected.count + totals.completed.count, amount: toMoney(totals.collected.amount + totals.completed.amount) }, caption: 'Collected + Completed', icon: HandCoins },
    { label: 'Collected', stat: totals?.collected, caption: 'Received, not completed yet', icon: Wallet },
    { label: 'Completed', stat: totals?.completed, caption: 'Posted to accounts', icon: BadgeCheck },
    { label: 'Voided', stat: totals?.voided, caption: 'Cancelled or reversed', icon: Ban },
  ]
  const modeTotals = Object.entries(totals?.modes || {}).filter(([, amount]) => Number(amount) > 0)

  const modeOptions = useMemo(() => {
    const keys = new Set([...PAYMENT_MODE_FILTER_KEYS, ...Object.keys(serverTotals?.modes || {})])
    return [{ value: 'all', label: 'All payment modes' }, ...[...keys].map((key) => ({ value: key, label: formatPaymentMode(key) }))]
  }, [serverTotals])
  const partnerOptions = useMemo(() => [{ value: 'all', label: 'Everyone' }, ...collectorOptions], [collectorOptions])

  const fetchCustomerOptions = useCallback(async (term) => {
    const result = await listCustomers({ search: term })
    if (!result.success) return []
    return (result.customers || []).slice(0, 50).map((c) => ({ value: c.id, label: c.name || c.businessName || c.business_name || 'Customer' }))
  }, [])

  const fetchOrderOptions = useCallback(async (term) => {
    const result = await listOrders({ search: term, customer_id: filters.customerId || undefined, page_size: 20 })
    if (!result.success) return []
    return (result.orders || []).map((o) => ({ value: o.id, label: o.orderNumber || 'Order' }))
  }, [filters.customerId])

  const changeTab = (value) => {
    if (value === filters.tab) return
    setFilters((current) => ({ ...current, tab: value }))
    setPage(1)
  }
  const applyFilters = (next) => {
    setFilters({ ...next })
    setPage(1)
  }
  const changePageSize = (next) => {
    setPageSize(next)
    setPage(1)
  }

  const openConfirm = (row) => { setActionError(''); setConfirmTarget(row) }
  const openVoid = (row) => { setActionError(''); setVoidReason(''); setVoidTarget(row) }
  const describe = (row) => `${formatCurrency(row.amount)} from ${nameOrNotAvailable(row.customerName)}`

  const handleActionFailure = (result, action) => {
    setActionError(result.error)
    if (result.code === 'FORBIDDEN') showToast({ title: "You don't have permission", message: `${action} needs the Deliveries > Approve permission on your role.`, variant: 'error' })
    // The record did not change, but the day-end that now blocks it did (or someone else changed it) -
    // re-read the list so a stale action does not linger.
    if (result.code === 'DAY_END_CLOSED' || result.code === 'CONFLICT') refresh()
  }

  const runConfirm = async (collection) => {
    if (isActing) return
    if (!begin()) return
    setActionError('')
    const result = await reconcileCollection(collection.id)
    end()
    if (!result.success) {
      handleActionFailure(result, 'Confirm Payment')
      return
    }
    showToast({
      title: 'Payment confirmed',
      message: result.collection?.customerPaymentNumber
        ? `Customer payment ${result.collection.customerPaymentNumber} created.`
        : `${describe(collection)} is now Completed.`,
    })
    setConfirmTarget(null)
    setDetail(null)
    refresh()
  }

  const runVoid = async () => {
    if (isActing) return
    if (!begin()) return
    setActionError('')
    const result = await voidCollection(voidTarget.id, voidReason.trim() || undefined)
    end()
    if (!result.success) {
      handleActionFailure(result, 'Void')
      return
    }
    showToast({ title: 'Collection voided', message: `${describe(voidTarget)} was voided.` })
    setVoidTarget(null)
    setVoidReason('')
    setDetail(null)
    refresh()
  }

  // Completed and Voided records are read-only: only View Details.
  const rowActions = (row) => [
    ...(canReconcile && isReconcilable(row) ? [{ label: 'Confirm Payment', icon: BadgeCheck, onClick: () => openConfirm(row) }] : []),
    { label: 'View Details', icon: Eye, onClick: () => setDetail(row) },
    ...(canReconcile && isVoidable(row) ? [{ label: 'Void', icon: Ban, danger: true, onClick: () => openVoid(row) }] : []),
  ]

  const hasFilters = Boolean(search) || Boolean(filters.customerId || filters.orderId) || filters.partnerId !== 'all' || filters.mode !== 'all' || filters.datePreset !== 'all'
  const emptyTitle = hasFilters ? 'No collections match these filters.' : tab.empty

  const filterPanel = (
    <ListFilterPanel title="Filter Collections" applied={filters} defaults={NO_FILTERS} onApply={applyFilters} ignoreKeys={['tab', 'customerLabel', 'orderLabel']}>
      {({ draft, set, errors }) => (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
            <Select options={COLLECTION_TABS.map(({ value, label }) => ({ value, label }))} value={draft.tab} onChange={(event) => set('tab', event.target.value)} />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Customer
            <EntitySearchSelect value={draft.customerId} selectedLabel={draft.customerLabel} onChange={(value, label) => set({ customerId: value, customerLabel: label })} fetchOptions={fetchCustomerOptions} placeholder="Any customer" className="w-full" />
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery Partner / Collected By
            <Select options={partnerOptions} value={draft.partnerId} onChange={(event) => set('partnerId', event.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Payment Mode
            <Select options={modeOptions} value={draft.mode} onChange={(event) => set('mode', event.target.value)} />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Order
            <EntitySearchSelect value={draft.orderId} selectedLabel={draft.orderLabel} onChange={(value, label) => set({ orderId: value, orderLabel: label })} fetchOptions={fetchOrderOptions} placeholder="Any order" className="w-full" />
          </div>
          <FilterDateRange label="Collection Date" draft={draft} set={set} errors={errors} />
        </>
      )}
    </ListFilterPanel>
  )

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Collections</h1>
      </div>

      {/* The whole flow in one line: staff records money received, accounts checks it, only then it counts as paid.
          A block of its own - the app hides the h1 and the paragraph right after it (the top bar already shows the title). */}
      <div data-testid="collection-flow-note" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-neutral-100 bg-surface px-5 py-3 text-sm text-fg-muted">
        <span className="font-semibold text-fg">Collected</span>
        <span aria-hidden="true">→</span>
        <span>check amount, proof and handover</span>
        <span aria-hidden="true">→</span>
        <span className="font-semibold text-fg">Confirm Payment</span>
        <span aria-hidden="true">→</span>
        <span className="font-semibold text-fg">Completed</span>
        <span className="text-neutral-400">· Money counts as paid only after you confirm it.</span>
      </div>

      {!unavailable && (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {tiles.map(({ label, stat, caption, icon: Icon }, index) => (
              <div key={label} data-testid={`collection-tile-${index}`} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-fg-muted">{label}</p>
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted"><Icon className="size-4" aria-hidden="true" /></span>
                </div>
                <p className="mt-4 break-words font-(--font-display) text-[clamp(1.25rem,2.2vw,2rem)] font-semibold leading-none tracking-tight text-fg"><SkeletonValue loading={totalsLoading} className="h-8 w-20 rounded-lg">{stat ? formatCurrency(stat.amount) : '—'}</SkeletonValue></p>
                <p className="mt-2 text-xs font-medium text-neutral-500"><SkeletonValue loading={totalsLoading} className="h-3 w-28">{stat ? `${stat.count} ${stat.count === 1 ? 'record' : 'records'} · ${caption}` : caption}</SkeletonValue></p>
              </div>
            ))}
          </div>
          {!totalsLoading && modeTotals.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-5 py-3">
              <span className="text-xs font-medium text-neutral-400">Total Collections by payment mode:</span>
              {modeTotals.map(([mode, amount]) => (
                <span key={mode} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                  {formatPaymentMode(mode)}: {formatCurrency(amount)}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {unavailable ? (
        <Card>
          <div className="flex items-start gap-3 p-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Couldn&apos;t load collections</p>
              <p className="mt-1 text-xs text-neutral-400">
                The delivery collections service didn&apos;t respond. Please retry in a moment.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={refresh}>Retry</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ListTableToolbar
            title="Collections"
            resultCount={isLoadingList ? null : total}
            search={searchInput}
            onSearchChange={(event) => setSearchInput(event.target.value)}
            searchPlaceholder="Search collections..."
            actions={filterPanel}
          />
          <div className="overflow-x-auto px-5 pb-3">
            <Tabs value={filters.tab} onValueChange={changeTab}>
              <TabsList className="" role="tablist" aria-label="Collection status">
                {COLLECTION_TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="" role="tab" aria-selected={filters.tab === item.value}>{item.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          {loadError && (
            <div className="mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={refresh}>Retry</Button>
            </div>
          )}

          {/* Desktop / tablet: compact table */}
          <div className="hidden md:block">
            <DataTable
              renderToolbar={() => null}
              searchable={false}
              loading={isLoadingList}
              serverPagination
              page={currentPage}
              totalPages={lastPage}
              totalCount={total}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              columns={[
                { key: 'customerName', header: 'Customer', sortable: true, render: (r) => nameOrNotAvailable(r.customerName) },
                { key: 'recordedByName', header: 'Collected By', sortable: true, render: (r) => nameOrNotAvailable(r.recordedByName) },
                { key: 'deliveryPartnerName', header: 'Delivery Partner', sortable: true, render: (r) => r.deliveryPartnerName || '—' },
                { key: 'deliveryNumber', header: 'Delivery #', sortable: true, render: (r) => linkedValue(r.deliveryNumber, r.deliveryId) },
                { key: 'orderNumber', header: 'Order #', sortable: true, render: (r) => linkedValue(r.orderNumber, r.orderId) },
                { key: '_amount', header: 'Amount', sortable: true, align: 'right', render: (r) => formatCurrency(r._amount) },
                { key: '_modeLabel', header: 'Payment Mode', sortable: true },
                { key: 'paymentDate', header: 'Payment Date', sortable: true, render: (r) => r._paymentDateLabel },
                { key: 'recordedAt', header: 'Collected At', sortable: true, render: (r) => r._collectedAtLabel },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (r) => (
                    <Badge variant={COLLECTION_STATUS_VARIANT[r.status] || 'neutral'} dot>{formatStatus(r)}</Badge>
                  ),
                },
              ]}
              data={rows}
              onRowClick={(row) => setDetail(row)}
              emptyTitle={emptyTitle}
              actions={rowActions}
            />
          </div>

          {/* Mobile: cards, same actions */}
          <div className="space-y-3 px-5 pb-4 md:hidden">
            {isLoadingList ? (
              <LoadingSpinner variant="table" columns={['Customer', 'Amount', 'Status']} label="Loading collections…" />
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">{emptyTitle}</p>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-xs)">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{nameOrNotAvailable(row.customerName)}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{nameOrNotAvailable(row.recordedByName)}{row.deliveryPartnerName ? ` · Partner ${row.deliveryPartnerName}` : ''} · {row._collectedAtLabel}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        Delivery {linkedValue(row.deliveryNumber, row.deliveryId)} · Order {linkedValue(row.orderNumber, row.orderId)}
                      </p>
                    </div>
                    <Badge variant={COLLECTION_STATUS_VARIANT[row.status] || 'neutral'} dot>{formatStatus(row)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-neutral-900">{formatCurrency(row._amount)}</span>
                    <span className="text-neutral-500">{row._modeLabel}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <ActionMenu items={rowActions(row)} />
                  </div>
                </div>
              ))
            )}
            {!isLoadingList && total > 0 && (
              <PaginationFooter page={currentPage} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={changePageSize} className="-mx-5 -mb-4 mt-2" />
            )}
          </div>
        </Card>
      )}

      <CollectionDetailDrawer
        collection={detail}
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        canReconcile={canReconcile}
        busy={isActing}
        onReconcile={openConfirm}
        onVoid={openVoid}
      />

      <Modal
        isOpen={Boolean(confirmTarget)}
        onClose={() => !isActing && setConfirmTarget(null)}
        title="Confirm Payment"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={() => runConfirm(confirmTarget)}>Confirm Payment</Button>
          </>
        }
      >
        {confirmTarget && (
          <div className="space-y-3 text-sm text-neutral-600">
            <p>
              Confirm this collection as received? This will create the payment and update the customer balance.
            </p>
            <p>
              <span className="font-semibold text-neutral-900">{formatCurrency(confirmTarget.amount)}</span> ({formatPaymentMode(confirmTarget.paymentMode)}) from{' '}
              <span className="font-semibold text-neutral-900">{nameOrNotAvailable(confirmTarget.customerName)}</span>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-neutral-50 px-4 py-3 text-xs">
              <dt className="text-neutral-400">Collected By</dt>
              <dd className="text-right font-medium text-neutral-700">{nameOrNotAvailable(confirmTarget.recordedByName)}</dd>
              <dt className="text-neutral-400">Reference</dt>
              <dd className="text-right font-medium text-neutral-700">{confirmTarget.reference || '—'}</dd>
              <dt className="text-neutral-400">Payment Proof</dt>
              <dd className="text-right font-medium text-neutral-700">
                {confirmTarget.paymentProofUrl ? (
                  <a href={getFileUrl(confirmTarget.paymentProofUrl)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">View proof</a>
                ) : '—'}
              </dd>
            </dl>
            <p className="text-neutral-500">
              Once confirmed, the collection is Completed. This can&apos;t be undone here.
            </p>
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(voidTarget)}
        onClose={() => !isActing && setVoidTarget(null)}
        title="Void collection"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={runVoid}>Void Collection</Button>
          </>
        }
      >
        {voidTarget && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Void <span className="font-semibold text-neutral-900">{formatCurrency(voidTarget.amount)}</span> from{' '}
              <span className="font-semibold text-neutral-900">{nameOrNotAvailable(voidTarget.customerName)}</span>?
              Use this for a wrong or invalid collection.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Reason</label>
              <textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                maxLength={300}
                className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                placeholder="Why is this collection being voided?"
              />
            </div>
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
