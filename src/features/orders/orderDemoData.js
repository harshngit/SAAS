// =============================================================================
// FRONTEND DEMO / MOCK ORDERS + DELIVERIES - UI TESTING ONLY
// -----------------------------------------------------------------------------
// One row per Order state so every state-driven action, the Order-status vs
// Delivery-status separation, the Order Detail progress stepper and the
// Delivery-Partner adjustment flow can all be seen without hand-creating each
// scenario. Appended after the real listOrders(); NEVER sent to any backend
// endpoint - no call ever carries a `demo-so-`, `demo-dlv-`, `demo-inv-`,
// `demo-dp-`, `demo-veh-` or `demo-customer-` id.
//
// Demo rows are INTERACTIVE: Confirm / Cancel / Plan Delivery / Create Invoice /
// Duplicate / Edit and the demo delivery workflow all run through the local
// simulation helpers here + localStorage. Real records (any id NOT starting
// with `demo-`) always use the real API.
//
// TODO: remove order/delivery demo simulation when the backend provides fixtures.
// =============================================================================

export const DEMO_ORDERS_ENABLED = true

export function isDemoOrder(id) {
  return typeof id === 'string' && id.startsWith('demo-so-')
}
export function isDemoDelivery(id) {
  return typeof id === 'string' && id.startsWith('demo-dlv-')
}

// ---- Shared demo catalogue - coherent, reused across every linked demo record ----
export const DEMO_SALES_OFFICER = { id: 'demo-user-rahul', name: 'Rahul Sharma', role: 'sales_officer' }

export const DEMO_DELIVERY_PARTNERS = [
  { id: 'demo-dp-ravi', name: 'Ravi Kumar', phone: '+91 90000 11111', email: 'ravi.kumar@demo.in', employeeId: 'DP-01' },
  { id: 'demo-dp-sunil', name: 'Sunil Yadav', phone: '+91 90000 22222', email: 'sunil.yadav@demo.in', employeeId: 'DP-02' },
]
export const DEMO_VEHICLES = [
  { id: 'demo-veh-1', vehicleNumber: 'MH-12-AB-4521', vehicleType: 'Tempo', capacityKg: 1500 },
  { id: 'demo-veh-2', vehicleNumber: 'MH-14-CD-7824', vehicleType: 'Pickup', capacityKg: 900 },
]
export const DEMO_WAREHOUSES = [
  { id: 'demo-wh-main', name: 'Main Warehouse' },
  { id: 'demo-wh-central', name: 'Central Warehouse' },
]

const CUSTOMERS = {
  balaji: { name: 'Shree Balaji Retail', phone: '+91 98200 41001', email: 'orders@shreebalaji.in', city: 'Mumbai' },
  metro: { name: 'Metro Mart', phone: '+91 98200 41002', email: 'purchase@metromart.in', city: 'Pune' },
  aarav: { name: 'Aarav Distributors', phone: '+91 98200 41003', email: 'accounts@aaravdist.in', city: 'Nagpur' },
  green: { name: 'Green Basket Stores', phone: '+91 98200 41004', email: 'buy@greenbasket.in', city: 'Nashik' },
  royal: { name: 'Royal Foods', phone: '+91 98200 41005', email: 'procure@royalfoods.in', city: 'Thane' },
}

const RICE = { productId: 'demo-p-rice', productName: 'Rice 10kg', uom: 'bag', unitPrice: 620, taxRate: 5 }
const OIL = { productId: 'demo-p-oil', productName: 'Sunflower Oil 1L', uom: 'bottle', unitPrice: 180, taxRate: 5 }
const FLOUR = { productId: 'demo-p-flour', productName: 'Wheat Flour 5kg', uom: 'bag', unitPrice: 335, taxRate: 5 }
const SUGAR = { productId: 'demo-p-sugar', productName: 'Sugar 5kg', uom: 'bag', unitPrice: 260, taxRate: 5 }

// Honest demo vehicle stock for the Delivery-Partner "+ Add Product" picker (§10).
// Only referenced for demo delivery ids - real deliveries always use the real API.
export const DEMO_VEHICLE_STOCK = [
  { productId: RICE.productId, productName: RICE.productName, loadedQuantity: 20, extraQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, remainingQuantity: 20 },
  { productId: OIL.productId, productName: OIL.productName, loadedQuantity: 12, extraQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, remainingQuantity: 12 },
  { productId: FLOUR.productId, productName: FLOUR.productName, loadedQuantity: 0, extraQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, remainingQuantity: 0 },
]

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
  const taxRate = overrides.taxRate ?? 5
  const net = qty * price * (1 - discPct / 100)
  const delivered = overrides.deliveredQuantity ?? 0
  return {
    id: overrides.id,
    orderItemId: overrides.id,
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

function order({
  key, number, customer, status, fulfilmentStatus = 'not_started', method = 'delivery',
  pickupStatus = 'not_started', partnerId, deliveryPickingStatus, deliveryVehicle, quotation,
  deliveryId, invoiceId, rejectReason, notes, items, previousBalance = 0,
}) {
  const c = CUSTOMERS[customer]
  const partner = DEMO_DELIVERY_PARTNERS.find((p) => p.id === partnerId) || null
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const total = items.reduce((s, it) => s + it.lineTotal, 0)
  return {
    id: `demo-so-${key}`,
    orderNumber: number,
    status,
    fulfilmentStatus,
    // demo-only hint consumed by getOrderProgress / buildOrderTimeline
    deliveryPickingStatus: deliveryPickingStatus || null,
    customerId: `demo-customer-${customer}`,
    customerName: c.name,
    customerPhone: c.phone,
    customerEmail: c.email,
    warehouseId: 'demo-wh-main',
    warehouseName: 'Main Warehouse',
    orderDate: iso(-3),
    deliveryDate: iso(2),
    fulfilmentMethod: method,
    pickupStatus,
    collectedBy: pickupStatus === 'collected' ? c.name : '',
    collectedAt: pickupStatus === 'collected' ? iso(-1) : null,
    pickupNotes: '',
    paymentType: 'credit',
    paymentTermsDays: 30,
    source: quotation ? 'quotation' : 'office',
    salespersonId: DEMO_SALES_OFFICER.id,
    salespersonName: DEMO_SALES_OFFICER.name,
    createdById: DEMO_SALES_OFFICER.id,
    createdByName: DEMO_SALES_OFFICER.name,
    createdByRole: DEMO_SALES_OFFICER.role,
    assignedDeliveryPartnerId: partner?.id || '',
    assignedDeliveryPartnerName: partner?.name || '',
    quotationId: quotation?.id || null,
    quotationNumber: quotation?.number || null,
    deliveryId: deliveryId || null,
    deliveryNumber: deliveryId ? `DLV-DEMO-${number.replace(/^SO-DEMO-/, '')}` : null,
    deliveryVehicle: deliveryVehicle || null,
    invoiceId: invoiceId || null,
    invoiceNumber: invoiceId ? `INV-DEMO-${number.replace(/^SO-DEMO-/, '')}` : null,
    notes: notes || '',
    billingAddress: `${c.name}, 12 MG Road, ${c.city}`,
    deliveryAddress: method === 'pickup' ? '' : `${c.name}, 12 MG Road, ${c.city}`,
    paymentTerms: 'Net 30',
    previousPendingBalance: previousBalance,
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

// ---- The demo order suite: one row per current frontend state (§6 A-N) ----
export const demoOrders = [
  // A. Draft Home Delivery - Edit / Confirm / Cancel; no reservation, no delivery.
  order({
    key: 'draft', number: 'SO-DEMO-01', customer: 'balaji', status: 'placed',
    items: [line({ id: 'i1', ...RICE, quantity: 10 })],
  }),
  // B. Confirmed / Stock Reserved - no delivery planned yet -> Plan Delivery / Create Invoice / Cancel.
  order({
    key: 'reserved', number: 'SO-DEMO-02', customer: 'metro', status: 'confirmed', fulfilmentStatus: 'reserved',
    items: [line({ id: 'i1', ...RICE, quantity: 18 }), line({ id: 'i2', ...SUGAR, quantity: 12 })],
  }),
  // C. Delivery Assigned - partner assigned, delivery not yet picking. From a customer quotation.
  order({
    key: 'assigned', number: 'SO-DEMO-03', customer: 'aarav', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-assigned', deliveryVehicle: 'MH-12-AB-4521',
    quotation: { id: 'demo-qt-accepted-customer', number: 'QT-DEMO-A1' },
    items: [line({ id: 'i1', ...FLOUR, quantity: 40 })],
  }),
  // D. Picking - delivery assigned and currently picking (§6 D, drives the new "Picking" step).
  order({
    key: 'picking', number: 'SO-DEMO-04', customer: 'green', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-picking', deliveryVehicle: 'MH-12-AB-4521',
    deliveryPickingStatus: 'picking',
    items: [line({ id: 'i1', ...RICE, quantity: 12 }), line({ id: 'i2', ...OIL, quantity: 24 })],
  }),
  // E. Vehicle Loaded.
  order({
    key: 'loaded', number: 'SO-DEMO-05', customer: 'royal', status: 'confirmed', fulfilmentStatus: 'loaded',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-loaded', deliveryVehicle: 'MH-12-AB-4521',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...RICE, quantity: 50 })],
  }),
  // F. In Transit.
  order({
    key: 'transit', number: 'SO-DEMO-06', customer: 'balaji', status: 'confirmed', fulfilmentStatus: 'in_transit',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-transit', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...RICE, quantity: 10 })],
    notes: 'Adjustment demo: partner carries extra Rice + Oil on the van.',
  }),
  // G. Delivered - final delivered quantities visible, no invoice yet (tests Create Invoice).
  order({
    key: 'delivered', number: 'SO-DEMO-07', customer: 'metro', status: 'confirmed', fulfilmentStatus: 'delivered',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-delivered', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...RICE, quantity: 30, deliveredQuantity: 30 })],
  }),
  // H. Completed - delivered + invoice created + order completed.
  order({
    key: 'completed', number: 'SO-DEMO-08', customer: 'aarav', status: 'completed', fulfilmentStatus: 'delivered',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-completed', invoiceId: 'demo-inv-completed',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...FLOUR, quantity: 75, deliveredQuantity: 75 })],
  }),
  // I. Cancelled before delivery - no active fulfilment.
  order({
    key: 'cancelled', number: 'SO-DEMO-09', customer: 'green', status: 'cancelled',
    rejectReason: 'Customer Cancelled — changed their mind before dispatch',
    items: [line({ id: 'i1', ...RICE, quantity: 20 })],
  }),
  // J. Cancelled parent order WITH an existing delivery stuck at Picking (§6 J / §11 guard test).
  order({
    key: 'cancelled-delivery', number: 'SO-DEMO-10', customer: 'royal', status: 'cancelled',
    fulfilmentStatus: 'planned', partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-cancelled',
    deliveryVehicle: 'MH-14-CD-7824', deliveryPickingStatus: 'picking',
    rejectReason: 'Duplicate Order — cancelled after the delivery was already assigned',
    items: [line({ id: 'i1', ...RICE, quantity: 15 })],
    notes: 'Guard test: delivery snapshot still shows Picking but the order is Cancelled.',
  }),
  // K. Takeaway - Ready for Pickup.
  order({
    key: 'pickup-ready', number: 'SO-DEMO-11', customer: 'metro', status: 'confirmed', fulfilmentStatus: 'reserved',
    method: 'pickup', pickupStatus: 'ready', previousBalance: 2500,
    items: [line({ id: 'i1', ...OIL, quantity: 24 }), line({ id: 'i2', ...SUGAR, quantity: 10 })],
  }),
  // L. Takeaway - Picked Up / Completed.
  order({
    key: 'pickup-done', number: 'SO-DEMO-12', customer: 'balaji', status: 'completed', fulfilmentStatus: 'delivered',
    method: 'pickup', pickupStatus: 'collected', invoiceId: 'demo-inv-pickup',
    items: [line({ id: 'i1', ...FLOUR, quantity: 15, deliveredQuantity: 15 })],
  }),
  // M. Insufficient Stock - Draft, so Confirm can be clicked and fail to reserve.
  order({
    key: 'stock', number: 'SO-DEMO-13', customer: 'aarav', status: 'placed',
    items: [line({ id: 'i1', ...RICE, quantity: 10, reservedQuantity: 0, availableStock: 6 })],
    notes: 'Internal: only 6 of the 10 units required are in stock.',
  }),
  // N. Partial Delivery (exception outcome, not a primary stage).
  order({
    key: 'partial', number: 'SO-DEMO-14', customer: 'green', status: 'confirmed', fulfilmentStatus: 'partially_delivered',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-partial', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...FLOUR, quantity: 10, deliveredQuantity: 6, reservedQuantity: 10 })],
  }),
]

// =============================================================================
// Local simulation store - versioned keys so a rebuild never inherits stale rows.
// =============================================================================
const OVERRIDE_KEY = 'saas.orderDemoOverride.v2'
const COPIES_KEY = 'saas.orderDemoCopies.v2'
const DELIVERY_OVERRIDE_KEY = 'saas.deliveryDemoOverride.v2'
const LEGACY_KEYS = ['saas.orderDemoOverride', 'saas.orderDemoCopies', 'saas.deliveryDemoOverride']

// One-time safe cleanup of the pre-v2 demo-only keys (never touches auth / business data).
try {
  LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key))
} catch {
  /* storage disabled - nothing to clean */
}

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
const readDeliveryOverrides = () => readJson(DELIVERY_OVERRIDE_KEY, {})

export function patchDemoOrder(id, partial) {
  if (!isDemoOrder(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial }
  writeJson(OVERRIDE_KEY, map)
}

export function patchDemoDelivery(id, partial) {
  if (!isDemoDelivery(id)) return
  const map = readDeliveryOverrides()
  map[id] = { ...(map[id] || {}), ...partial }
  writeJson(DELIVERY_OVERRIDE_KEY, map)
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

// Find the demo order that owns a given demo delivery id.
function demoOrderForDelivery(deliveryId) {
  return demoOrdersResolved().find((o) => o.deliveryId === deliveryId) || null
}

// Frontend-only copy of a demo order -> a brand new demo Draft (SO-DEMO-COPY-00N).
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
      orderItemId: `ci${index + 1}`,
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
    deliveryPickingStatus: null,
    customerId: src.customerId,
    customerName: src.customerName,
    customerPhone: src.customerPhone || '',
    customerEmail: src.customerEmail || '',
    warehouseId: src.warehouseId || 'demo-wh-main',
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
    salespersonId: src.salespersonId || DEMO_SALES_OFFICER.id,
    salespersonName: src.salespersonName || DEMO_SALES_OFFICER.name,
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
    previousPendingBalance: src.previousPendingBalance || 0,
    discount: Number(src.discount) || 0,
    tax: total - subtotal > 0 ? total - subtotal : 0,
    subtotal,
    total,
    items,
    stockSummary: [],
    warnings: [],
    approvedAt: null,
    rejectReason: '',
    createdById: src.createdById || DEMO_SALES_OFFICER.id,
    createdByName: src.createdByName || DEMO_SALES_OFFICER.name,
    createdByRole: src.createdByRole || DEMO_SALES_OFFICER.role,
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

// Compact frontend-only delivery snapshot for the Order Detail "View Delivery" modal.
export function buildDemoDelivery(order) {
  return {
    deliveryNumber: order.deliveryNumber || `DLV-DEMO-${String(order.orderNumber || '').replace(/^SO-DEMO-/, '')}`,
    partnerName: order.assignedDeliveryPartnerName || '—',
    vehicle: order.deliveryVehicle || order.demoDelivery?.vehicle || '—',
    warehouse: order.warehouseName || '—',
    scheduledDate: order.deliveryDate || null,
    address: order.deliveryAddress || '—',
    items: (order.items || []).map((it) => ({
      productName: it.productName,
      planned: it.quantity,
      delivered: it.deliveredQuantity || 0,
    })),
  }
}

// =============================================================================
// Full demo DELIVERY record (normalizeDelivery-shaped) for the Delivery Partner
// Delivery Detail screen. Derived from the owning demo order so the two stay
// consistent. Never hits the API - `getDemoDelivery` is used in place of it.
// =============================================================================
function publicDeliveryStatus(order) {
  const fs = order.fulfilmentStatus
  if (fs === 'delivered') return 'delivered'
  if (fs === 'partially_delivered') return 'partially_delivered'
  if (fs === 'in_transit') return 'in_transit'
  if (fs === 'loaded') return 'in_transit' // internal loaded surfaces as public in_transit
  return 'accepted' // planned / picking
}

function pickingStatusFor(order) {
  if (['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)) return 'picked'
  return order.deliveryPickingStatus || 'not_started'
}

export function buildDemoDeliveryRecord(deliveryId) {
  const order = demoOrderForDelivery(deliveryId)
  if (!order) return null

  const partner = DEMO_DELIVERY_PARTNERS.find((p) => p.id === order.assignedDeliveryPartnerId) || DEMO_DELIVERY_PARTNERS[0]
  const fs = order.fulfilmentStatus
  const loadedLike = ['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(fs)
  const dispatched = ['in_transit', 'partially_delivered', 'delivered'].includes(fs)
  const done = ['delivered', 'partially_delivered'].includes(fs)

  const items = (order.items || []).map((it) => {
    const planned = it.quantity
    const delivered = it.deliveredQuantity || 0
    return {
      id: `d-${it.id}`,
      orderItemId: it.orderItemId || it.id,
      productId: it.productId,
      variantId: '',
      productName: it.productName,
      unitPrice: it.unitPrice,
      plannedQuantity: planned,
      pickedQuantity: pickingStatusFor(order) === 'picked' ? planned : (pickingStatusFor(order) === 'picking' ? planned : 0),
      loadedQuantity: loadedLike ? planned : 0,
      deliveredQuantity: delivered,
      pendingQuantity: Math.max(planned - delivered, 0),
      remainingQuantity: Math.max(planned - delivered, 0),
      batchNumber: '',
      expiryDate: null,
      serialNumbers: [],
    }
  })

  const plannedTotal = items.reduce((s, it) => s + it.plannedQuantity, 0)
  const loadedTotal = items.reduce((s, it) => s + it.loadedQuantity, 0)
  const deliveredTotal = items.reduce((s, it) => s + it.deliveredQuantity, 0)

  const base = {
    id: deliveryId,
    deliveryNumber: order.deliveryNumber || `DLV-DEMO-${String(order.orderNumber).replace(/^SO-DEMO-/, '')}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    orderTotal: order.total,
    fulfilmentStatus: fs,
    pickingStatus: pickingStatusFor(order),
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status, fulfilmentStatus: fs, total: order.total },
    customerId: order.customerId,
    customerName: order.customerName,
    customerBusinessName: order.customerName,
    customerPhone: order.customerPhone || '',
    customerEmail: order.customerEmail || '',
    customerDeliveryAddress: order.deliveryAddress || '',
    status: publicDeliveryStatus(order),
    deliveryPartnerId: partner.id,
    deliveryPartnerName: partner.name,
    deliveryPartnerPhone: partner.phone,
    deliveryPartnerEmail: partner.email,
    deliveryPartnerEmployeeId: partner.employeeId,
    vehicleId: order.deliveryVehicle === 'MH-14-CD-7824' ? 'demo-veh-2' : 'demo-veh-1',
    vehicleNumber: order.deliveryVehicle || 'MH-12-AB-4521',
    vehicleType: 'Tempo',
    vehicleCapacityKg: 1500,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouseName,
    scheduledDate: order.deliveryDate,
    deliveryAddress: order.deliveryAddress || '',
    dispatchedAt: dispatched ? iso(-1) : null,
    dispatchedById: dispatched ? partner.id : '',
    confirmedAt: done ? iso(0) : null,
    failureReason: '',
    receiverName: done ? order.customerName : '',
    notes: order.notes || '',
    items,
    plannedTotal,
    loadedTotal,
    deliveredTotal,
    amountDue: done ? Math.round(order.total) : 0,
    previousPendingBalance: order.previousPendingBalance || 0,
    pod: null,
    createdAt: order.createdAt,
    updatedAt: new Date().toISOString(),
  }

  const ov = readDeliveryOverrides()[deliveryId]
  return ov ? { ...base, ...ov } : base
}

export function getDemoDelivery(deliveryId) {
  return buildDemoDeliveryRecord(deliveryId)
}

// Every demo delivery, list-shaped - appended to the Delivery Partner's list / dashboard.
export function demoDeliveriesResolved() {
  return demoOrdersResolved()
    .filter((o) => o.deliveryId)
    .map((o) => buildDemoDeliveryRecord(o.deliveryId))
    .filter(Boolean)
}

// The demo order that a demo delivery belongs to (used to resolve locked order prices).
export function getDemoOrderForDelivery(deliveryId) {
  return demoOrderForDelivery(deliveryId)
}

// The locked order pricing map (productId -> {unitPrice, discountPercent, taxRate}) for a
// demo delivery - stands in for a getOrder() call on the Delivery Detail screen.
export function getDemoOrderPricing(deliveryId) {
  const order = demoOrderForDelivery(deliveryId)
  if (!order) return {}
  const map = {}
  ;(order.items || []).forEach((it) => {
    map[it.productId] = {
      unitPrice: Number(it.unitPrice) || 0,
      discountPercent: Number(it.discountPercent) || 0,
      taxRate: Number(it.taxRate) || 0,
    }
  })
  return map
}
