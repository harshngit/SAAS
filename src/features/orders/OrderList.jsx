import { loadSummaryRows } from '../../utils/listSummary'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Copy, Download, Eye, Pencil, Plus, RotateCw, Search, ShoppingCart, SlidersHorizontal, Trash2, UploadCloud, X } from 'lucide-react'
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

const PAGE_SIZE_OPTIONS = [{ value: '20', label: '20' }, { value: '25', label: '25' }, { value: '50', label: '50' }]

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
      formatDate(order.orderDate),
      order.items.length,
      formatCurrency(order.total),
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
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebouncedValue(searchTerm, 350)
  const [pageSize, setPageSize] = useState('20')
  const [page, setPage] = useState(1)
  const { sortBy, sortOrder, toggleSort, sortParams } = useSortState()
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
      ...sortParams,
    }
  }, [statusTab, deliveryPartnerFilter, customerFilter, sourceFilter, dateFrom, dateTo, debouncedSearch, sortParams])

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
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(total, currentPage * Number(pageSize))
  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedIds.includes(order.id))

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !orders.some((order) => order.id === id))
      : [...new Set([...current, ...orders.map((order) => order.id)])])
  }

  const exportOrders = async (onlySelected = false) => {
    if (onlySelected) {
      exportRowsToExcel('orders', buildExportRows(orders.filter((order) => selectedIds.includes(order.id))))
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
    exportRowsToExcel('orders', buildExportRows(result.orders))
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
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" aria-hidden="true" />Filter</Button>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <span>Showing <span className="font-semibold text-fg">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-fg">{total}</span></span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page
              <Select options={PAGE_SIZE_OPTIONS} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-surface py-1 text-xs" />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-14 text-center font-medium text-fg">{currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Order filters">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-(--modal-bg) shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div><h2 className="text-lg font-semibold text-neutral-900">Filter Orders</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the orders shown in the table.</p></div>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery partner<Select options={deliveryPartnerOptions} value={deliveryPartnerFilter} onChange={(event) => { setDeliveryPartnerFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                <Select options={ORDER_TABS.map((tab) => ({ value: tab.value, label: tab.label }))} value={statusTab} onChange={(event) => { setStatusTab(event.target.value); setPage(1) }} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Customer<Select options={customerOptions} value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                Source
                <Select options={ORDER_SOURCE_OPTIONS} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                Order Date
                <DateRangeFilter preset={datePreset} onPresetChange={(value) => { setDatePreset(value); setPage(1) }} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to); setPage(1) }} />
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setDeliveryPartnerFilter('all'); setSourceFilter('all'); setStatusTab('all'); setCustomerFilter('all'); setDatePreset('all'); setCustomFrom(''); setCustomTo(''); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div>
          </aside>
        </div>,
        document.body,
      )}

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
