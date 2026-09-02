// =============================================================================
// FRONTEND DEMO / MOCK ORDERS - UI TESTING ONLY
// -----------------------------------------------------------------------------
// One row per Order state so every state-driven action + the Order-status vs
// Delivery-status separation can be seen without hand-creating each scenario.
// Appended after the real listOrders(); never sent to any backend endpoint
// (no call carries a `demo-so-` id).
//
// The demo rows are also INTERACTIVE: Confirm / Cancel / Plan Delivery /
// Create Invoice / Duplicate / Edit all run through local simulation helpers
// here + localStorage, exactly like the Leads and Quotations demo data. Real
// orders (any id NOT starting with `demo-so-`) always use the real API.
//
// TODO: remove order demo simulation when backend provides test fixtures.
// =============================================================================

export const DEMO_ORDERS_ENABLED = true

export function isDemoOrder(id) {
  return typeof id === 'string' && id.startsWith('demo-so-')
}

// Predefined pick-lists for the (real) Plan Delivery modal when it runs against a demo order.
export const DEMO_DELIVERY_PARTNERS = [
  { id: 'demo-dp-ravi', name: 'Ravi Kumar' },
  { id: 'demo-dp-sunil', name: 'Sunil Das' },
  { id: 'demo-dp-anil', name: 'Anil Yadav' },
]
export const DEMO_VEHICLES = [
  { id: 'demo-veh-1', vehicleNumber: 'KA-01-AB-1234' },
  { id: 'demo-veh-2', vehicleNumber: 'KA-05-CD-5678' },
]
export const DEMO_WAREHOUSES = [{ id: 'demo-wh', name: 'Main Warehouse' }]

const DAY_MS = 86_400_000
const iso = (days, hour = 10) => {
  const d = new Date(Date.now() + days * DAY_MS)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function line(overrides) {
  const qty = overrides.quantity
  const price = overrides.unitPrice
  const discPct = overrides.discountPercent || 0
  const taxRate = overrides.taxRate ?? 18
  const net = qty * price * (1 - discPct / 100)
  const delivered = overrides.deliveredQuantity ?? 0
  return {
    id: overrides.id,
    productId: overrides.productId || `demo-p-${overrides.id}`,
    variantId: '',
    productName: overrides.productName,
    quantity: qty,
    orderedQuantity: qty,
    unitPrice: price,
    discount: 0,
    discountPercent: discPct,
    costPrice: null,
    uom: overrides.uom || 'unit',
    taxRate,
    reservedQuantity: overrides.reservedQuantity ?? qty,
    deliveredQuantity: delivered,
    remainingQuantity: Math.max(qty - delivered, 0),
    availableStock: overrides.availableStock ?? null, // demo-only: drives the "Insufficient Stock" chip
    lineTotal: net + net * (taxRate / 100),
  }
}

function order({ id, number, customerName, status, fulfilmentStatus = 'not_started', method = 'delivery', pickupStatus = 'not_started', partner, quotation, deliveryId, invoiceId, rejectReason, notes, items }) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const total = items.reduce((s, it) => s + it.lineTotal, 0)
  return {
    id,
    orderNumber: number,
    status,
    fulfilmentStatus,
    customerId: `demo-customer-${id}`,
    customerName,
    warehouseId: 'demo-wh',
    warehouseName: 'Main Warehouse',
    orderDate: iso(-3),
    deliveryDate: iso(2),
    fulfilmentMethod: method,
    pickupStatus,
    collectedBy: pickupStatus === 'collected' ? customerName : '',
    collectedAt: pickupStatus === 'collected' ? iso(-1) : null,
    pickupNotes: '',
    paymentType: 'credit',
    paymentTermsDays: 30,
    source: quotation ? 'quotation' : 'office',
    salespersonId: '',
    salespersonName: 'sales',
    assignedDeliveryPartnerId: partner ? `demo-dp-${id}` : '',
    assignedDeliveryPartnerName: partner || '',
    quotationId: quotation?.id || null,
    quotationNumber: quotation?.number || null,
    deliveryId: deliveryId || null,
    deliveryNumber: deliveryId ? `DLV-DEMO-${id.toUpperCase()}` : null,
    invoiceId: invoiceId || null,
    invoiceNumber: invoiceId ? `INV-DEMO-${id.toUpperCase()}` : null,
    notes: notes || '',
    billingAddress: `${customerName}, 12 MG Road, Bengaluru 560001`,
    deliveryAddress: method === 'pickup' ? '' : `${customerName}, 12 MG Road, Bengaluru 560001`,
    paymentTerms: 'Net 30',
    discount: 0,
    tax: total - subtotal > 0 ? total - subtotal : 0,
    subtotal,
    total,
    items,
    stockSummary: [],
    warnings: [],
    approvedAt: ['confirmed', 'completed'].includes(status) ? iso(-2) : null,
    rejectReason: rejectReason || '',
    createdAt: iso(-3),
    updatedAt: iso(-1),
  }
}

const RICE = { productName: 'Rice 10kg', uom: 'bag', unitPrice: 620, taxRate: 5 }
const OIL = { productName: 'Sunflower Oil 1L', uom: 'bottle', unitPrice: 180, taxRate: 5 }
const FLOUR = { productName: 'Wheat Flour 5kg', uom: 'bag', unitPrice: 335, taxRate: 5 }

export const demoOrders = [
  // Draft (~₹6,500)
  order({
    id: 'demo-so-draft', number: 'SO-DEMO-D1', customerName: 'Aarav Mehta', status: 'placed',
    fulfilmentStatus: 'not_started', method: 'delivery',
    items: [line({ id: 'i1', ...RICE, quantity: 10 })],
  }),
  // Confirmed + stock reserved, no delivery planned (~₹12,400)
  order({
    id: 'demo-so-confirmed', number: 'SO-DEMO-C1', customerName: 'Rohan Patil', status: 'confirmed',
    fulfilmentStatus: 'reserved', method: 'delivery',
    items: [line({ id: 'i1', ...RICE, quantity: 19 })],
  }),
  // Confirmed + delivery assigned, from a quotation (carries a legacy per-item discount)
  order({
    id: 'demo-so-assigned', number: 'SO-DEMO-A1', customerName: 'Vikram Enterprises', status: 'confirmed',
    fulfilmentStatus: 'planned', method: 'delivery', partner: 'Ravi Kumar',
    quotation: { id: 'demo-qt-lead-converted', number: 'QT-DEMO-A2C' }, deliveryId: 'demo-dlv-a1',
    items: [line({ id: 'i1', ...FLOUR, quantity: 120, discountPercent: 8 })],
  }),
  // Loaded
  order({
    id: 'demo-so-loaded', number: 'SO-DEMO-L1', customerName: 'Aman Kapoor', status: 'confirmed',
    fulfilmentStatus: 'loaded', method: 'delivery', partner: 'Ravi Kumar', deliveryId: 'demo-dlv-l1',
    items: [line({ id: 'i1', ...RICE, quantity: 50 })],
  }),
  // In transit
  order({
    id: 'demo-so-transit', number: 'SO-DEMO-T1', customerName: 'Sneha Iyer', status: 'confirmed',
    fulfilmentStatus: 'in_transit', method: 'delivery', partner: 'Sunil Das', deliveryId: 'demo-dlv-t1',
    items: [line({ id: 'i1', ...OIL, quantity: 200 }), line({ id: 'i2', ...FLOUR, quantity: 30 })],
  }),
  // Delivered (no invoice yet)
  order({
    id: 'demo-so-delivered', number: 'SO-DEMO-DLV1', customerName: 'Priya Nair', status: 'confirmed',
    fulfilmentStatus: 'delivered', method: 'delivery', partner: 'Sunil Das', deliveryId: 'demo-dlv-dlv1',
    items: [line({ id: 'i1', ...RICE, quantity: 30, deliveredQuantity: 30 })],
  }),
  // Completed
  order({
    id: 'demo-so-completed', number: 'SO-DEMO-COMP1', customerName: 'Manish Rao', status: 'completed',
    fulfilmentStatus: 'delivered', method: 'delivery', partner: 'Ravi Kumar', deliveryId: 'demo-dlv-comp1', invoiceId: 'demo-inv-comp1',
    items: [line({ id: 'i1', ...FLOUR, quantity: 75, deliveredQuantity: 75 })],
  }),
  // Cancelled
  order({
    id: 'demo-so-cancelled', number: 'SO-DEMO-CAN1', customerName: 'Kunal Sharma', status: 'cancelled',
    fulfilmentStatus: 'not_started', method: 'delivery', rejectReason: 'Customer Cancelled — changed their mind before dispatch',
    items: [line({ id: 'i1', ...RICE, quantity: 20 })],
  }),
  // Self pickup - ready for pickup
  order({
    id: 'demo-so-pickup-ready', number: 'SO-DEMO-PICK1', customerName: 'Arjun Mehta', status: 'confirmed',
    fulfilmentStatus: 'reserved', method: 'pickup', pickupStatus: 'ready',
    items: [line({ id: 'i1', ...OIL, quantity: 24 })],
  }),
  // Self pickup - completed / picked up
  order({
    id: 'demo-so-pickup-done', number: 'SO-DEMO-PICK2', customerName: 'Rohit Verma', status: 'completed',
    fulfilmentStatus: 'delivered', method: 'pickup', pickupStatus: 'collected', invoiceId: 'demo-inv-pick2',
    items: [line({ id: 'i1', ...FLOUR, quantity: 15, deliveredQuantity: 15 })],
  }),
  // Insufficient stock - Draft, so Confirm can be clicked and fail to reserve
  order({
    id: 'demo-so-stock', number: 'SO-DEMO-STOCK1', customerName: 'Dev Patel', status: 'placed',
    fulfilmentStatus: 'not_started', method: 'delivery',
    items: [line({ id: 'i1', ...RICE, quantity: 10, reservedQuantity: 0, availableStock: 6 })],
    notes: 'Internal: only 6 of the 10 units required are in stock.',
  }),
  // Partially delivered
  order({
    id: 'demo-so-partial', number: 'SO-DEMO-PART1', customerName: 'Meera Shah', status: 'confirmed',
    fulfilmentStatus: 'partially_delivered', method: 'delivery', partner: 'Sunil Das', deliveryId: 'demo-dlv-part1',
    items: [line({ id: 'i1', ...FLOUR, quantity: 10, deliveredQuantity: 6, reservedQuantity: 10 })],
  }),
]

// ---- Local overrides (status flips from Confirm / Cancel / Plan Delivery / Invoice) ----
const OVERRIDE_KEY = 'saas.orderDemoOverride'
// ---- Runtime demo copies created by "Duplicate Order" ----
const COPIES_KEY = 'saas.orderDemoCopies'

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled - demo edits just won't persist across refresh */
  }
}

const readOverrides = () => readJson(OVERRIDE_KEY, {})
const readCopies = () => readJson(COPIES_KEY, [])

export function patchDemoOrder(id, partial) {
  if (!isDemoOrder(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial }
  writeJson(OVERRIDE_KEY, map)
}

function allDemoOrders() {
  return [...demoOrders, ...readCopies()]
}

export function getDemoOrder(id) {
  const base = allDemoOrders().find((o) => o.id === id)
  if (!base) return null
  const ov = readOverrides()[id]
  return ov ? { ...base, ...ov, updatedAt: new Date().toISOString() } : base
}

export function demoOrdersResolved() {
  const overrides = readOverrides()
  return allDemoOrders().map((o) => (overrides[o.id] ? { ...o, ...overrides[o.id] } : o))
}

// Frontend-only copy of a demo order -> a brand new demo Draft (SO-DEMO-COPY-00N).
// Copies customer / items / prices / tax / discount / addresses / notes only.
// Never copies: order number, status, delivery assignment, delivery state, invoice,
// payment status, created date, quotation link.
export function duplicateDemoOrder(src) {
  const copies = readCopies()
  const seq = copies.length + 1
  const number = `SO-DEMO-COPY-${String(seq).padStart(3, '0')}`
  const id = `demo-so-copy-${Date.now().toString(36)}`
  const now = new Date().toISOString()

  const items = (src.items || []).map((it, index) => {
    const qty = Number(it.quantity) || 0
    const price = Number(it.unitPrice) || 0
    const discPct = Number(it.discountPercent) || 0
    const taxRate = Number(it.taxRate) || 0
    const net = qty * price * (1 - discPct / 100)
    return {
      id: `ci${index + 1}`,
      productId: it.productId,
      variantId: '',
      productName: it.productName,
      quantity: qty,
      orderedQuantity: qty,
      unitPrice: price,
      discount: 0,
      discountPercent: discPct,
      costPrice: null,
      uom: it.uom || 'unit',
      taxRate,
      reservedQuantity: qty,
      deliveredQuantity: 0,
      remainingQuantity: qty,
      availableStock: it.availableStock ?? null,
      lineTotal: net + net * (taxRate / 100),
    }
  })
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const total = items.reduce((s, it) => s + it.lineTotal, 0)

  const copy = {
    id,
    orderNumber: number,
    status: 'placed',
    fulfilmentStatus: 'not_started',
    customerId: src.customerId,
    customerName: src.customerName,
    warehouseId: src.warehouseId || 'demo-wh',
    warehouseName: src.warehouseName || 'Main Warehouse',
    orderDate: now,
    deliveryDate: src.deliveryDate,
    fulfilmentMethod: src.fulfilmentMethod || 'delivery',
    pickupStatus: 'not_started',
    collectedBy: '',
    collectedAt: null,
    pickupNotes: '',
    paymentType: src.paymentType || 'credit',
    paymentTermsDays: src.paymentTermsDays ?? 30,
    source: 'office',
    salespersonId: '',
    salespersonName: src.salespersonName || 'sales',
    assignedDeliveryPartnerId: '',
    assignedDeliveryPartnerName: '',
    quotationId: null,
    quotationNumber: null,
    deliveryId: null,
    deliveryNumber: null,
    invoiceId: null,
    invoiceNumber: null,
    notes: src.notes || '',
    billingAddress: src.billingAddress || '',
    deliveryAddress: src.fulfilmentMethod === 'pickup' ? '' : src.deliveryAddress || '',
    paymentTerms: src.paymentTerms || 'Net 30',
    discount: Number(src.discount) || 0,
    tax: total - subtotal > 0 ? total - subtotal : 0,
    subtotal,
    total,
    items,
    stockSummary: [],
    warnings: [],
    approvedAt: null,
    rejectReason: '',
    createdAt: now,
    updatedAt: now,
    isCopy: true,
  }

  writeJson(COPIES_KEY, [...copies, copy])
  return copy.id
}

// Compact frontend-only invoice snapshot for a demo order (View Invoice modal).
export function buildDemoInvoice(order) {
  const invoiceNumber = order.invoiceNumber || `INV-DEMO-${String(order.orderNumber || '').replace(/^SO-DEMO-/, '')}`
  return {
    invoiceNumber,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    subtotal: order.subtotal || 0,
    discount: order.discount || 0,
    tax: order.tax || 0,
    total: order.total || 0,
    status: 'Created',
    items: (order.items || []).map((it) => ({
      productName: it.productName,
      quantity: it.deliveredQuantity || it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    })),
  }
}

// Compact frontend-only delivery snapshot for a demo order (View Delivery modal).
export function buildDemoDelivery(order) {
  return {
    deliveryNumber: order.deliveryNumber || `DLV-DEMO-${String(order.orderNumber || '').replace(/^SO-DEMO-/, '')}`,
    partnerName: order.assignedDeliveryPartnerName || '—',
    vehicle: order.demoDelivery?.vehicle || '—',
    warehouse: order.demoDelivery?.warehouse || order.warehouseName || '—',
    scheduledDate: order.demoDelivery?.scheduledDate || order.deliveryDate || null,
    address: order.deliveryAddress || '—',
    items: (order.items || []).map((it) => ({
      productName: it.productName,
      planned: it.quantity,
      delivered: it.deliveredQuantity || 0,
    })),
  }
}
