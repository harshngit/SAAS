import { CheckCircle2, Clock, FileText, PackageCheck, ShoppingCart, Sparkles, Truck, XCircle } from 'lucide-react'

// =============================================================================
// Order module helpers
// -----------------------------------------------------------------------------
// The two things the UI must keep SEPARATE:
//   Order status   - business state: Draft / Confirmed / Completed / Cancelled
//   Delivery status - operational step: Not Planned / Assigned / Loaded / ...
// Backend `order.status` is already collapsed to placed|confirmed|completed|
// cancelled (+ rejected). "placed" == the unconfirmed state == shown as "Draft".
// =============================================================================

export const ORDER_STATUS_LABEL = {
  placed: 'Draft',
  draft: 'Draft',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export const ORDER_STATUS_VARIANT = {
  placed: 'neutral',
  draft: 'neutral',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
}

export function formatOrderStatus(status) {
  return ORDER_STATUS_LABEL[status] || String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// List/filter tabs - Draft maps to the backend `placed` value.
export const ORDER_TABS = [
  { value: 'all', label: 'All', apiStatus: null },
  { value: 'draft', label: 'Draft', apiStatus: 'placed' },
  { value: 'confirmed', label: 'Confirmed', apiStatus: 'confirmed' },
  { value: 'completed', label: 'Completed', apiStatus: 'completed' },
  { value: 'cancelled', label: 'Cancelled', apiStatus: 'cancelled' },
]

export const ORDER_SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'direct', label: 'Direct' },
  { value: 'quotation', label: 'From Quotation' },
]

// -----------------------------------------------------------------------------
// Delivery status - derived from method + fulfilment/pickup status + partner.
// This is NEVER an order status.
// -----------------------------------------------------------------------------
const DELIVERY_VARIANT = {
  not_planned: 'neutral',
  picking: 'warning',
  assigned: 'info',
  ready_for_pickup: 'warning',
  loaded: 'primary',
  in_transit: 'warning',
  delivered: 'success',
  picked_up: 'success',
  partially_delivered: 'warning',
}

export function getDeliveryStatus(order) {
  if (!order) return { key: 'not_planned', label: '—', variant: 'neutral' }
  const method = order.fulfilmentMethod
  const fs = order.fulfilmentStatus || 'not_started'
  const ps = order.pickupStatus || 'not_started'

  if (method === 'pickup') {
    if (ps === 'collected') return { key: 'picked_up', label: 'Picked Up', variant: DELIVERY_VARIANT.picked_up }
    if (ps === 'ready') return { key: 'ready_for_pickup', label: 'Ready for Pickup', variant: DELIVERY_VARIANT.ready_for_pickup }
    if (ps === 'picking') return { key: 'picking', label: 'Picking', variant: DELIVERY_VARIANT.picking }
    return { key: 'not_planned', label: 'Not Planned', variant: DELIVERY_VARIANT.not_planned }
  }

  if (!method) return { key: 'not_planned', label: '—', variant: 'neutral' }

  if (fs === 'delivered') return { key: 'delivered', label: 'Delivered', variant: DELIVERY_VARIANT.delivered }
  if (fs === 'partially_delivered') return { key: 'partially_delivered', label: 'Partially Delivered', variant: DELIVERY_VARIANT.partially_delivered }
  if (fs === 'in_transit') return { key: 'in_transit', label: 'In Transit', variant: DELIVERY_VARIANT.in_transit }
  if (fs === 'loaded') return { key: 'loaded', label: 'Loaded', variant: DELIVERY_VARIANT.loaded }
  if (order.assignedDeliveryPartnerId || fs === 'planned') return { key: 'assigned', label: 'Assigned', variant: DELIVERY_VARIANT.assigned }
  return { key: 'not_planned', label: 'Not Planned', variant: DELIVERY_VARIANT.not_planned }
}

// -----------------------------------------------------------------------------
// Fulfilment progress
// -----------------------------------------------------------------------------
const RESERVED_STATES = ['reserved', 'planned', 'loaded', 'in_transit', 'partially_delivered', 'delivered']

export function isStockReserved(order) {
  return RESERVED_STATES.includes(order?.fulfilmentStatus) || ['picking', 'ready', 'collected'].includes(order?.pickupStatus)
}

// Method-aware stepper. First step is "Order Confirmed" (confirmation is required,
// so "Order Placed" is not an operational milestone).
export function getOrderProgress(order) {
  if (!order) return []
  const isConfirmed = ['confirmed', 'completed'].includes(order.status)
  const reserved = isStockReserved(order)
  const fs = order.fulfilmentStatus
  const ps = order.pickupStatus

  const node = (label, done, current) => ({ label, status: done ? 'done' : current ? 'current' : 'pending' })

  if (order.fulfilmentMethod === 'pickup') {
    return [
      node('Order Confirmed', isConfirmed, !isConfirmed),
      node('Stock Reserved', reserved, isConfirmed && !reserved),
      node('Ready for Pickup', ['ready', 'collected'].includes(ps), ps === 'picking'),
      node('Picked Up', ps === 'collected', ps === 'ready'),
    ]
  }

  const loaded = ['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(fs)
  const inTransit = ['in_transit', 'partially_delivered', 'delivered'].includes(fs)
  const delivered = ['delivered', 'partially_delivered'].includes(fs)
  const assigned = Boolean(order.assignedDeliveryPartnerId) || ['planned', ...RESERVED_STATES.slice(1)].includes(fs)

  return [
    node('Order Confirmed', isConfirmed, !isConfirmed),
    node('Stock Reserved', reserved, isConfirmed && !reserved),
    node('Delivery Assigned', assigned, reserved && !assigned),
    node('Loaded', loaded, assigned && !loaded),
    node('In Transit', inTransit, loaded && !inTransit),
    node('Delivered', delivered, inTransit && !delivered),
  ]
}

// -----------------------------------------------------------------------------
// State-driven actions - the single source for Detail buttons + List row menu.
// `invoices` lets us pick createInvoice vs viewInvoice. Keys:
//   edit confirm cancel planDelivery viewDelivery
//   createInvoice viewInvoice pickupReady confirmPickup duplicate
// (no approve/reject - the finalized flow is Draft -> Confirm -> Confirmed;
//  delivery reassignment lives on the delivery page, not here.)
// -----------------------------------------------------------------------------
export function getOrderActions(order, { invoices = [] } = {}) {
  if (!order) return []
  const status = order.status
  const hasInvoice = invoices.length > 0
  const invoiceAction = hasInvoice ? 'viewInvoice' : 'createInvoice'
  const isPickup = order.fulfilmentMethod === 'pickup'
  const fs = order.fulfilmentStatus
  const loadedOrBeyond = ['loaded', 'in_transit', 'delivered', 'partially_delivered'].includes(fs)

  // Draft: the finalized flow is Draft -> Confirm -> Confirmed (no approve/reject step).
  if (status === 'placed' || status === 'draft') return ['edit', 'confirm', 'cancel']

  if (status === 'cancelled' || status === 'rejected') return ['duplicate']

  // Confirmed but stock never reserved (e.g. shortage at confirm time). There is no
  // "reserve stock" endpoint - the only sensible action left is to cancel.
  if (status === 'confirmed' && !isStockReserved(order)) return ['cancel']

  if (status === 'completed') {
    return [hasInvoice ? 'viewInvoice' : null, order.deliveryId ? 'viewDelivery' : null, 'duplicate'].filter(Boolean)
  }

  // confirmed
  if (isPickup) {
    const acts = []
    if (order.pickupStatus === 'picking') acts.push('pickupReady')
    else if (order.pickupStatus === 'ready') acts.push('confirmPickup')
    acts.push(invoiceAction)
    if (order.pickupStatus !== 'collected') acts.push('cancel')
    return acts
  }

  if (!order.assignedDeliveryPartnerId && !loadedOrBeyond) {
    return ['planDelivery', invoiceAction, 'cancel']
  }

  if (loadedOrBeyond) {
    return ['viewDelivery', invoiceAction]
  }

  // partner assigned, not yet loaded - reassignment happens on the delivery page itself
  return ['viewDelivery', invoiceAction, 'cancel']
}

// -----------------------------------------------------------------------------
// Cancel reasons (spec §25)
// -----------------------------------------------------------------------------
export const CANCEL_REASONS = [
  { value: 'Customer Cancelled', label: 'Customer Cancelled' },
  { value: 'Stock Unavailable', label: 'Stock Unavailable' },
  { value: 'Duplicate Order', label: 'Duplicate Order' },
  { value: 'Pricing Issue', label: 'Pricing Issue' },
  { value: 'Delivery Issue', label: 'Delivery Issue' },
  { value: 'Other', label: 'Other' },
]

// -----------------------------------------------------------------------------
// Order source
// -----------------------------------------------------------------------------
export function orderSourceLabel(order) {
  if (order?.quotationId) {
    return { text: 'Created from Quotation', quotationId: order.quotationId, quotationNumber: order.quotationNumber || null, isQuotation: true }
  }
  return { text: 'Direct Order', quotationId: null, isQuotation: false }
}

// -----------------------------------------------------------------------------
// Compact activity timeline (derived - backend has no order-event feed)
// -----------------------------------------------------------------------------
export function buildOrderTimeline(order, { invoices = [] } = {}) {
  if (!order) return []
  const events = []
  const stamp = order.updatedAt || order.createdAt

  events.push({
    id: 'created',
    icon: ShoppingCart,
    iconClass: 'bg-primary-50 text-primary-700',
    title: order.quotationId ? `Created from Quotation ${order.quotationNumber || ''}`.trim() : 'Order created',
    subtitle: order.orderNumber,
    timestamp: order.createdAt,
  })

  const confirmed = ['confirmed', 'completed'].includes(order.status)
  if (confirmed) {
    events.push({ id: 'confirmed', icon: CheckCircle2, iconClass: 'bg-green-50 text-green-600', title: 'Order confirmed', subtitle: 'Ready for fulfilment', timestamp: order.approvedAt || stamp })
  }
  if (isStockReserved(order)) {
    events.push({ id: 'reserved', icon: PackageCheck, iconClass: 'bg-blue-50 text-blue-600', title: 'Stock reserved', subtitle: 'Inventory held for this order', timestamp: stamp })
  }
  if (order.fulfilmentMethod !== 'pickup') {
    if (order.assignedDeliveryPartnerId) {
      events.push({ id: 'assigned', icon: Truck, iconClass: 'bg-indigo-50 text-indigo-600', title: `Delivery assigned${order.assignedDeliveryPartnerName ? ` to ${order.assignedDeliveryPartnerName}` : ''}`, subtitle: order.deliveryNumber || 'Delivery planned', timestamp: stamp })
    }
    if (['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)) {
      events.push({ id: 'loaded', icon: PackageCheck, iconClass: 'bg-amber-50 text-amber-600', title: 'Vehicle loaded', subtitle: 'Stock loaded for dispatch', timestamp: stamp })
    }
    if (['in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)) {
      events.push({ id: 'transit', icon: Truck, iconClass: 'bg-amber-50 text-amber-600', title: 'In transit', subtitle: 'Out for delivery', timestamp: stamp })
    }
    if (['delivered', 'partially_delivered'].includes(order.fulfilmentStatus)) {
      events.push({ id: 'delivered', icon: CheckCircle2, iconClass: 'bg-green-50 text-green-600', title: order.fulfilmentStatus === 'partially_delivered' ? 'Partially delivered' : 'Delivered', subtitle: 'Goods reached the customer', timestamp: stamp })
    }
  } else if (order.pickupStatus === 'ready') {
    events.push({ id: 'ready', icon: PackageCheck, iconClass: 'bg-amber-50 text-amber-600', title: 'Ready for pickup', subtitle: 'Awaiting collection', timestamp: stamp })
  } else if (order.pickupStatus === 'collected') {
    events.push({ id: 'picked', icon: CheckCircle2, iconClass: 'bg-green-50 text-green-600', title: 'Picked up', subtitle: order.collectedBy ? `Collected by ${order.collectedBy}` : 'Order collected', timestamp: order.collectedAt || stamp })
  }

  if (invoices.length > 0) {
    events.push({ id: 'invoice', icon: FileText, iconClass: 'bg-green-50 text-green-600', title: 'Invoice created', subtitle: invoices[0].invoiceNumber || 'Receivable raised', timestamp: stamp })
  }
  if (order.status === 'completed') {
    events.push({ id: 'completed', icon: Sparkles, iconClass: 'bg-green-50 text-green-600', title: 'Order completed', subtitle: 'Fulfilment and billing done', timestamp: stamp })
  }
  if (order.status === 'cancelled' || order.status === 'rejected') {
    events.push({
      id: 'cancelled',
      icon: XCircle,
      iconClass: 'bg-red-50 text-red-600',
      title: order.status === 'rejected' ? 'Order rejected' : 'Order cancelled',
      subtitle: order.rejectReason || 'No reason recorded',
      timestamp: stamp,
    })
  }

  return events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
}

export { Clock }
