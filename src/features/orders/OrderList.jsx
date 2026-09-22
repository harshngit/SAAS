import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Copy, Download, Eye, MoreHorizontal, Pencil, Plus, RotateCw, Search, ShoppingCart, SlidersHorizontal, Trash2, UploadCloud, X } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import BulkImportModal from '../../components/ui/BulkImportModal'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { RequirePermission } from '../../auth/RequirePermission'
import { deleteOrder, listOrders } from '../../api/orders'
import { listDeliveryPartners } from '../../api/deliveries'
import { formatCurrency } from '../../utils/format'
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#6b86ad]">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]" aria-hidden="true"><MoreHorizontal className="size-4" /></span>
      </div>
      <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
      <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
    </div>
  )
}

export default function OrderList() {
  const navigate = useNavigate()
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'
  const quotationsBasePath = isSalesPath ? '/sales/quotations' : '/admin/quotations'

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [deliveryPartners, setDeliveryPartners] = useState([])

  const [statusTab, setStatusTab] = useState('all')
  const [deliveryPartnerFilter, setDeliveryPartnerFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listOrders({})
    const demoRows = DEMO_ORDERS_ENABLED ? demoOrdersResolved() : []

    if (!result.success) {
      setOrders(demoRows)
      setListError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    setOrders([...result.orders, ...demoRows])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    let isMounted = true
    listDeliveryPartners().then((result) => {
      if (!isMounted || !result.success) return
      setDeliveryPartners(result.partners)
    })
    return () => { isMounted = false }
  }, [])

  const deliveryPartnerOptions = useMemo(
    () => [{ value: 'all', label: 'All delivery partners' }, ...deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))],
    [deliveryPartners],
  )

  const filteredOrders = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const tab = ORDER_TABS.find((t) => t.value === statusTab)
    return orders.filter((order) => {
      if (tab?.apiStatus && order.status !== tab.apiStatus) return false
      if (deliveryPartnerFilter !== 'all' && order.assignedDeliveryPartnerId !== deliveryPartnerFilter) return false
      if (sourceFilter === 'direct' && order.quotationId) return false
      if (sourceFilter === 'quotation' && !order.quotationId) return false
      if (search && ![order.orderNumber, order.customerName].filter(Boolean).some((v) => String(v).toLowerCase().includes(search))) return false
      return true
    })
  }, [orders, statusTab, deliveryPartnerFilter, sourceFilter, searchTerm])

  const stats = useMemo(
    () => ({
      total: orders.length,
      draft: orders.filter((o) => o.status === 'draft').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      value: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0),
    }),
    [orders],
  )

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredOrders.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredOrders.length, currentPage * Number(pageSize))
  const allVisibleSelected = paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedIds.includes(order.id))

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !paginatedOrders.some((order) => order.id === id))
      : [...new Set([...current, ...paginatedOrders.map((order) => order.id)])])
  }

  const exportOrdersCsv = (onlySelected = false) => {
    const ordersToExport = onlySelected ? filteredOrders.filter((order) => selectedIds.includes(order.id)) : filteredOrders
    const rows = [
      ['Order Number', 'Customer', 'Order Date', 'Items', 'Total', 'Order Status', 'Payment Status', 'Fulfilment', 'Delivery Partner', 'Source'],
      ...ordersToExport.map((order) => [
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
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'orders.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
    setOrders((current) => current.filter((item) => item.id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Orders</h1><p className="mt-1 text-xs text-neutral-400">{filteredOrders.length} orders in view</p></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search orders..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" aria-hidden="true" />Filter</Button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportOrdersCsv()}><Download className="size-4" aria-hidden="true" />Export</Button>
                <RequirePermission module="sales_orders" action="create"><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsBulkImportOpen(true)}><UploadCloud className="size-4" aria-hidden="true" />Bulk Import</Button></RequirePermission>
                <RequirePermission module="sales_orders" action="create"><Button size="sm" onClick={() => navigate(`${basePath}/create`)} className="h-9 rounded-2xl px-3.5"><Plus className="size-4" aria-hidden="true" />New Order</Button></RequirePermission>
              </div>
            </div>
          </div>
          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            <OrderSummaryCard index={0} label="Total Orders" value={stats.total} detail={`${stats.confirmed} confirmed`} />
            <OrderSummaryCard index={1} label="Draft Orders" value={stats.draft} detail="needs attention" />
            <OrderSummaryCard index={2} label="Confirmed Orders" value={stats.confirmed} detail={`${stats.cancelled} cancelled`} />
            <OrderSummaryCard index={3} label="Order Value" value={formatCurrency(stats.value)} detail="current total" />
          </div>
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="text-sm font-medium text-primary-900">{selectedIds.length} order{selectedIds.length === 1 ? '' : 's'} selected</p>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportOrdersCsv(true)}>
            <Download className="size-4" aria-hidden="true" />
            Download
          </Button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadOrders}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading orders..." />
          ) : paginatedOrders.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No orders match these filters" description="Try a different tab, source, or delivery partner." />
          ) : (
            <table className="listing-table w-full min-w-7xl text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all orders" /></th>
                  <th className="whitespace-nowrap px-6 py-6">Order #</th>
                  <th className="whitespace-nowrap px-6 py-6">Customer</th>
                  <th className="whitespace-nowrap px-6 py-6">Order Date</th>
                  <th className="whitespace-nowrap px-6 py-6">Items</th>
                  <th className="whitespace-nowrap px-6 py-6">Total</th>
                  <th className="whitespace-nowrap px-6 py-6">Order Status</th>
                  <th className="whitespace-nowrap px-6 py-6">Payment</th>
                  <th className="whitespace-nowrap px-6 py-6">Fulfilment</th>
                  <th className="whitespace-nowrap px-6 py-6">Delivery Status</th>
                  <th className="whitespace-nowrap px-6 py-6">Delivery Partner</th>
                  <th className="whitespace-nowrap px-6 py-6">Source</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  const delivery = getDeliveryStatus(order)
                  const takeaway = isTakeawayOrder(order)
                  const actions = getOrderActions(order, { invoices: order.invoiceId ? [{ id: order.invoiceId }] : [] })
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`${basePath}/${order.id}`)}
                      className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
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
          <div className="flex items-center gap-3 text-xs text-[#6f89b0]">
            <span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredOrders.length}</span></span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page
              <Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" />
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
            <span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span>
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

      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Order filters">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div><h2 className="text-lg font-semibold text-neutral-900">Filter Orders</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the orders shown in the table.</p></div>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery partner<Select options={deliveryPartnerOptions} value={deliveryPartnerFilter} onChange={(event) => { setDeliveryPartnerFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Source<Select options={ORDER_SOURCE_OPTIONS} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                <Select options={ORDER_TABS.map((tab) => ({ value: tab.value, label: tab.label }))} value={statusTab} onChange={(event) => { setStatusTab(event.target.value); setPage(1) }} />
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setDeliveryPartnerFilter('all'); setSourceFilter('all'); setStatusTab('all'); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div>
          </aside>
        </div>
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
