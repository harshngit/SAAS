import { loadSummaryRows } from '../../utils/listSummary'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Copy, Download, Eye, Pencil, Plus, RotateCw, Search, ShoppingCart, SlidersHorizontal, Trash2, UploadCloud, X } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import BulkImportModal from '../../components/ui/BulkImportModal'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import PaginationFooter from '../../components/ui/PaginationFooter'
import { useSortState } from '../../hooks/useSortState'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import { RequirePermission } from '../../auth/RequirePermission'
import { useToast } from '../../components/ui/toastContext'
import { deleteOrder, getOrdersSummary, listOrders } from '../../api/orders'
import { listCustomers } from '../../api/customers'
import { exportRowsToExcel } from '../../utils/exportToExcel'
import { listDeliveryPartners } from '../../api/deliveries'
import { formatCurrency } from '../../utils/format'
import { resolveDateRange } from '../../utils/dateRange'
import {
  ORDER_SOURCE_OPTIONS,
  ORDER_STATUS_VARIANT,
  ORDER_TABS,
  PAYMENT_STATUS_VARIANT,
  formatOrderStatus,
  formatPaymentStatus,
  getDeliveryStatus,
  getFulfilmentLabel,
  getOrderActions,
  isTakeawayOrder,
} from './orderHelpers'
import { DEMO_ORDERS_ENABLED, demoOrdersResolved, duplicateDemoOrder, isDemoOrder } from './orderDemoData'

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}


function OrderSummaryCard({ label, value, detail, index }) {
  return (
    <div className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-fg">{value}</p>
      <p className="mt-2 text-xs font-medium text-neutral-400">{detail}</p>
    </div>
  )
}

function buildExportRows(list) {
  return [
    ['Order Number', 'Customer', 'Order Date', 'Items', 'Total', 'Order Status', 'Payment Status', 'Fulfilment', 'Delivery Partner', 'Source'],
    ...list.map((order) => [
      order.orderNumber,
      order.customerName,
      order.orderDate,
      order.items.length,
      Number(order.total) || 0,
      formatOrderStatus(order.status),
      formatPaymentStatus(order.paymentStatus),
      getFulfilmentLabel(order),
      order.assignedDeliveryPartnerName || 'Unassigned',
      order.quotationId ? 'Quotation' : 'Direct',
    ]),
  ]
}

export default function OrderList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'
  const quotationsBasePath = isSalesPath ? '/sales/quotations' : '/admin/quotations'

  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)

  const [statusTab, setStatusTab] = useState('all')
  const [deliveryPartnerFilter, setDeliveryPartnerFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  // `?period=today` (Dashboard "Today's Sales" → View Sales) opens the list on Today; otherwise All.
  const [datePreset, setDatePreset] = useState(() => (new URLSearchParams(window.location.search).get('period') === 'today' ? 'today' : 'all'))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebouncedValue(searchTerm, 350)
  const [pageSize, setPageSize] = useState('25')
  const [page, setPage] = useState(1)
  const { sortBy, sortOrder, toggleSort, sortParams } = useSortState()
  // Optional newest/oldest-created ordering chosen in the filter drawer (sort_by=created_at). 'default' sends nothing, so
  // every tab keeps its own default (the Confirmed tab sorts by updated_at desc, see serverParams). A clicked column
  // header still wins over this.
  const [activitySort, setActivitySort] = useState('default')
  const listAbortRef = useRef(null)
  const summaryAbortRef = useRef(null)

  const handleSort = (field) => {
    toggleSort(field)
    setPage(1)
  }
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  // Source and Order Date are now real GET /orders filters (crm_changes17) - sent server-side
  // just like every other filter here, not applied on top of whichever page happens to load.
  const serverParams = useMemo(() => {
    const tab = ORDER_TABS.find((t) => t.value === statusTab)
    return {
      ...(tab?.apiStatus ? { status: tab.apiStatus } : {}),
      ...(deliveryPartnerFilter !== 'all' ? { assigned_delivery_partner_id: deliveryPartnerFilter } : {}),
      ...(customerFilter !== 'all' ? { customer_id: customerFilter } : {}),
      ...(sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      // Accepted (= the Confirmed tab, status=confirmed) lists the most recently updated orders first. Only that
      // tab; every other tab keeps the backend's default order. Precedence: a clicked column header (sortParams)
      // beats an explicit "Sort By" choice in the filter drawer, which beats this default.
      ...(statusTab === 'confirmed' ? { sort_by: 'updated_at', sort_order: 'desc' } : {}),
      ...(activitySort !== 'default' ? { sort_by: 'created_at', sort_order: activitySort === 'created_asc' ? 'asc' : 'desc' } : {}),
      ...sortParams,
    }
  }, [statusTab, deliveryPartnerFilter, customerFilter, sourceFilter, dateFrom, dateTo, debouncedSearch, sortParams, activitySort])

  // GET /orders/summary takes the same filters as the list MINUS delivery-partner/sort - those
  // two don't affect the org-wide totals the cards show.
  const summaryParams = useMemo(() => {
    const tab = ORDER_TABS.find((t) => t.value === statusTab)
    return {
      ...(tab?.apiStatus ? { status: tab.apiStatus } : {}),
      ...(customerFilter !== 'all' ? { customer_id: customerFilter } : {}),
      ...(sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }
  }, [statusTab, customerFilter, sourceFilter, dateFrom, dateTo, debouncedSearch])

  // One list call per page load. A new call (route/filter/search change, or leaving the page)
  // aborts whichever previous one is still in flight so a slow, superseded response can never
  // overwrite newer state - and a cancelled request never surfaces as an error.
  const loadOrders = useCallback(async () => {
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller

    setIsLoading(true)
    setListError('')

    const result = await listOrders({ page, page_size: Number(pageSize), ...serverParams, signal: controller.signal })
    if (result.cancelled) return

    const demoRows = DEMO_ORDERS_ENABLED && page === 1 ? demoOrdersResolved() : []

    if (!result.success) {
      setOrders(demoRows)
      setTotal(demoRows.length)
      setListError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    setOrders([...demoRows, ...result.orders])
    setTotal(result.total)
    setIsLoading(false)
  }, [page, pageSize, serverParams])

  useEffect(() => {
    loadOrders()
    return () => listAbortRef.current?.abort()
  }, [loadOrders])

  const loadSummary = useCallback(async () => {
    summaryAbortRef.current?.abort()
    const controller = new AbortController()
    summaryAbortRef.current = controller

    setIsSummaryLoading(true)
    const result = await getOrdersSummary({ ...summaryParams, signal: controller.signal })
    if (result.cancelled) return

    setSummary(result.success ? result.summary : null)
    setIsSummaryLoading(false)
  }, [summaryParams])

  useEffect(() => {
    loadSummary()
    return () => summaryAbortRef.current?.abort()
  }, [loadSummary])

  // A debounced search change resets to page 1 the same way every other filter's onChange
  // already does inline below - this one can't do it inline since it only "settles" after the
  // debounce, not on every keystroke.
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // Selections are tied to currently-visible rows - once the page or any filter changes those
  // exact rows are no longer loaded, so a stale selected id would have no way to be shown or
  // exported.
  useEffect(() => {
    setSelectedIds([])
  }, [page, pageSize, statusTab, deliveryPartnerFilter, customerFilter, sourceFilter, dateFrom, dateTo, debouncedSearch])

  useEffect(() => {
    let isMounted = true
    listDeliveryPartners().then((result) => {
      if (!isMounted || !result.success) return
      setDeliveryPartners(result.partners)
    })
    return () => { isMounted = false }
  }, [])

  // Capped at the backend's own page_size max (same tradeoff already accepted for the Admin
  // Dashboard's scope filters) - an org with more than 100 customers only sees the first 100
  // here, not a search-as-you-type picker.
  useEffect(() => {
    let isMounted = true
    listCustomers({ page_size: 100 }).then((result) => {
      if (!isMounted || !result.success) return
      setCustomers(result.customers)
    })
    return () => { isMounted = false }
  }, [])

  const deliveryPartnerOptions = useMemo(
    () => [{ value: 'all', label: 'All delivery partners' }, ...deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))],
    [deliveryPartners],
  )
  const customerOptions = useMemo(
    () => [{ value: 'all', label: 'All customers' }, ...customers.map((customer) => ({ value: customer.id, label: customer.name || customer.businessName || 'Customer' }))],
    [customers],
  )

  const totalPages = Math.max(1, Math.ceil(total / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedIds.includes(order.id))

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !orders.some((order) => order.id === id))
      : [...new Set([...current, ...orders.map((order) => order.id)])])
  }

  const exportOrders = async (onlySelected = false) => {
    if (onlySelected) {
      exportRowsToExcel('orders', buildExportRows(orders.filter((order) => selectedIds.includes(order.id))), 'Orders')
      return
    }

    // Explicit, user-triggered action - not something that runs on page load. Walks every page
    // matching the current server-side filters (status/delivery partner/customer/source/date/search).
    setIsExporting(true)
    const result = await loadSummaryRows(listOrders, 'orders', serverParams)
    setIsExporting(false)
    if (!result.success) {
      showToast({ title: 'Export failed', message: result.error, variant: 'error' })
      return
    }
    exportRowsToExcel('orders', buildExportRows(result.orders), 'Orders')
  }

  const handleDeleteOrder = async (order) => {
    setDeleteError('')
    setDeleteTarget(order)
  }

  const confirmDeleteOrder = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')
    if (isDemoOrder(deleteTarget.id)) {
      setOrders((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      setIsDeleting(false)
      return
    }
    const result = await deleteOrder(deleteTarget.id)
    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }
    setDeleteTarget(null)
    setIsDeleting(false)
    // Reload rather than splice locally - `orders` is exactly one server page now, so deleting a
    // row needs the next row (if any) pulled in from the server, not just a shorter local array.
    loadOrders()
  }

  const filterPanel = (
    <ListFilterPanel
      title="Filter Orders"
      applied={{ deliveryPartnerFilter, statusTab, customerFilter, sourceFilter, activitySort, datePreset, customFrom, customTo }}
      defaults={{ deliveryPartnerFilter: 'all', statusTab: 'all', customerFilter: 'all', sourceFilter: 'all', activitySort: 'default', datePreset: 'all', customFrom: '', customTo: '' }}
      onApply={(next) => {
        setDeliveryPartnerFilter(next.deliveryPartnerFilter)
        setStatusTab(next.statusTab)
        setCustomerFilter(next.customerFilter)
        setSourceFilter(next.sourceFilter)
        setActivitySort(next.activitySort)
        setDatePreset(next.datePreset)
        setCustomFrom(next.customFrom)
        setCustomTo(next.customTo)
        setPage(1)
      }}
    >
      {({ draft, set, errors }) => (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
            <Select options={ORDER_TABS.map((tab) => ({ value: tab.value, label: tab.label }))} value={draft.statusTab} onChange={(event) => set('statusTab', event.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery partner<Select options={deliveryPartnerOptions} value={draft.deliveryPartnerFilter} onChange={(event) => set('deliveryPartnerFilter', event.target.value)} /></label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Customer<Select options={customerOptions} value={draft.customerFilter} onChange={(event) => set('customerFilter', event.target.value)} /></label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Source
            <Select options={ORDER_SOURCE_OPTIONS} value={draft.sourceFilter} onChange={(event) => set('sourceFilter', event.target.value)} />
          </label>
          <FilterDateRange label="Order Date" draft={draft} set={set} errors={errors} />
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort By
            <Select options={[{ value: 'default', label: 'Default order' }, { value: 'created_desc', label: 'Newest created first' }, { value: 'created_asc', label: 'Oldest created first' }]} value={draft.activitySort} onChange={(event) => set('activitySort', event.target.value)} />
          </label>
        </>
      )}
    </ListFilterPanel>
  )

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Orders</h1>
      </div>

      {/* Backed by GET /orders/summary (crm_changes17) - an org-wide aggregate over the current
          filters, independent of whichever page is loaded. Never derived from the loaded page. */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <OrderSummaryCard index={0} label="Total Orders" value={isSummaryLoading ? '—' : summary ? summary.total : '—'} detail={!isSummaryLoading && !summary ? 'Summary unavailable' : 'All matching orders'} />
          <OrderSummaryCard index={1} label="Draft Orders" value={isSummaryLoading ? '—' : summary ? summary.draft : '—'} detail={!isSummaryLoading && !summary ? 'Summary unavailable' : 'Not yet confirmed'} />
          <OrderSummaryCard index={2} label="Confirmed Orders" value={isSummaryLoading ? '—' : summary ? summary.confirmed : '—'} detail={!isSummaryLoading && !summary ? 'Summary unavailable' : 'Awaiting fulfilment'} />
          <OrderSummaryCard index={3} label="Order Value" value={isSummaryLoading ? '—' : summary ? formatCurrency(summary.totalValue) : '—'} detail={!isSummaryLoading && !summary ? 'Summary unavailable' : 'Excludes drafts & cancelled'} />
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="text-sm font-medium text-primary-900">{selectedIds.length} order{selectedIds.length === 1 ? '' : 's'} selected</p>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-surface px-3" onClick={() => exportOrders(true)}>
            <Download className="size-4" aria-hidden="true" />
            Download
          </Button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 className="text-xl font-semibold tracking-tight text-neutral-900">Orders</h2><p className="mt-1 text-xs text-neutral-400">{total} orders</p></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search orders..." className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div>
                {filterPanel}
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" loading={isExporting} onClick={() => exportOrders()}><Download className="size-4" aria-hidden="true" />Export</Button>
                <RequirePermission module="sales_orders" action="create"><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsBulkImportOpen(true)}><UploadCloud className="size-4" aria-hidden="true" />Bulk Import</Button></RequirePermission>
                <RequirePermission module="sales_orders" action="create"><Button size="sm" onClick={() => navigate(`${basePath}/create`)} className="h-9 rounded-2xl px-3.5"><Plus className="size-4" aria-hidden="true" />New Order</Button></RequirePermission>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto bg-surface px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadOrders}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-7xl" columns={["", "Order #", "Customer", "Order Date", "Items", "Total", "Order Status", "Payment", "Fulfilment", "Delivery Status", "Delivery Partner", "Source", "Actions"]} checkboxColumn={0} label="Loading orders..." />
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No orders match these filters" description="Try a different tab, source, or delivery partner." />
          ) : (
            <table className="listing-table w-full min-w-7xl text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all orders" /></th>
                  <SortableHeaderCell label="Order #" sortKey="order_number" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Customer" sortKey="customer" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Order Date" sortKey="order_date" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Items</th>
                  <SortableHeaderCell label="Total" sortKey="total" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Order Status" sortKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  {/* Not server-sortable - GET /orders has no payment-status sort_by field */}
                  <SortableHeaderCell label="Payment" sortable={false} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Fulfilment</th>
                  <th className="whitespace-nowrap px-6 py-6">Delivery Status</th>
                  <th className="whitespace-nowrap px-6 py-6">Delivery Partner</th>
                  <th className="whitespace-nowrap px-6 py-6">Source</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const delivery = getDeliveryStatus(order)
                  const takeaway = isTakeawayOrder(order)
                  const actions = getOrderActions(order, { invoices: order.invoiceId ? [{ id: order.invoiceId }] : [] })
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`${basePath}/${order.id}`)}
                      className="cursor-pointer bg-surface transition-colors hover:bg-primary-50/30"
                    >
                      <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => setSelectedIds((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${order.orderNumber}`} /></td>
                      <td className="px-6 py-5 font-medium text-neutral-900">
                        {order.orderNumber}
                        {isDemoOrder(order.id) && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-neutral-700">{order.customerName || '—'}</td>
                      <td className="px-6 py-5 text-neutral-600">{formatDate(order.orderDate)}</td>
                      <td className="px-6 py-5 text-neutral-600">{order.items.length}</td>
                      <td className="px-6 py-5 font-medium text-neutral-700">{formatCurrency(order.total)}</td>
                      <td className="px-6 py-5">
                        <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'neutral'}>{formatOrderStatus(order.status)}</Badge>
                      </td>
                      <td className="px-6 py-5">
                        {order.paymentStatus ? (
                          <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus] || 'neutral'}>
                            {formatPaymentStatus(order.paymentStatus)}
                          </Badge>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={takeaway ? 'neutral' : 'info'}>{getFulfilmentLabel(order)}</Badge>
                      </td>
                      <td className="px-6 py-5">
                        {takeaway ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <Badge variant={delivery.variant}>{delivery.label}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {takeaway ? (
                          <span className="text-neutral-400">—</span>
                        ) : order.assignedDeliveryPartnerName ? (
                          <span className="text-neutral-700">{order.assignedDeliveryPartnerName}</span>
                        ) : (
                          <span className="text-neutral-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-5" onClick={(event) => event.stopPropagation()}>
                        {order.quotationId ? (
                          <button
                            type="button"
                            onClick={() => !isDemoOrder(order.id) && navigate(`${quotationsBasePath}/${order.quotationId}`)}
                            className="text-left text-xs font-medium text-primary-600 hover:underline"
                          >
                            Quotation
                            {order.quotationNumber ? <span className="block text-[0.7rem] text-neutral-400">{order.quotationNumber}</span> : null}
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">Direct</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'View', icon: Eye, onClick: () => navigate(`${basePath}/${order.id}`) },
                            ...(actions.includes('edit') ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`${basePath}/${order.id}/edit`) }] : []),
                            ...(actions.includes('duplicate')
                              ? [{
                                  label: 'Duplicate Order',
                                  icon: Copy,
                                  onClick: () =>
                                    isDemoOrder(order.id)
                                      ? navigate(`${basePath}/${duplicateDemoOrder(order)}`)
                                      : navigate(`${basePath}/create?from=${order.id}`),
                                }]
                              : []),
                            { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDeleteOrder(order) },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <PaginationFooter page={currentPage} pageSize={Number(pageSize)} total={total} onPageChange={setPage} onPageSizeChange={(next) => { setPageSize(String(next)); setPage(1) }} />
      </Card>


      <Modal isOpen={Boolean(deleteTarget)} onClose={() => { if (!isDeleting) { setDeleteTarget(null); setDeleteError('') } }} title="Delete Order">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {deleteTarget?.orderNumber || 'this order'}? This cannot be undone.</p>
          {deleteError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button type="button" variant="danger" loading={isDeleting} onClick={confirmDeleteOrder}>Delete</Button></div>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        moduleKey="salesOrders"
        onImported={loadOrders}
      />
    </div>
  )
}
