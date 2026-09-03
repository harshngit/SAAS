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

// Honest demo vehicle stock for the Delivery-Partner "+ Add Product" picker (§10) and the
// read-only Vehicle Stock page. Represents a mid-day session: some units already delivered,
// Wheat Flour fully consumed (Out of Stock). Only referenced for demo delivery ids -
// real deliveries always use the real API.
export const DEMO_VEHICLE_STOCK = [
  { productId: RICE.productId, productName: RICE.productName, sku: 'RICE-10KG', variantId: '', uom: RICE.uom, loadedQuantity: 20, extraQuantity: 0, deliveredQuantity: 8, returnedQuantity: 0, remainingQuantity: 12 },
  { productId: OIL.productId, productName: OIL.productName, sku: 'OIL-1L', variantId: '', uom: OIL.uom, loadedQuantity: 12, extraQuantity: 0, deliveredQuantity: 5, returnedQuantity: 0, remainingQuantity: 7 },
  { productId: SUGAR.productId, productName: SUGAR.productName, sku: 'SUGAR-5KG', variantId: '', uom: SUGAR.uom, loadedQuantity: 10, extraQuantity: 0, deliveredQuantity: 6, returnedQuantity: 2, remainingQuantity: 2 },
  { productId: FLOUR.productId, productName: FLOUR.productName, sku: 'FLOUR-5KG', variantId: '', uom: FLOUR.uom, loadedQuantity: 5, extraQuantity: 0, deliveredQuantity: 5, returnedQuantity: 0, remainingQuantity: 0 },
]

// A stand-in POD photo (inline SVG data URI - no network). Used only by demo deliveries.
export const DEMO_POD_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect width='240' height='240' fill='%23d1d5db'/%3E%3Ctext x='120' y='124' font-family='sans-serif' font-size='15' fill='%23374151' text-anchor='middle'%3EDemo POD photo%3C/text%3E%3C/svg%3E"

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
  pickupStatus = 'not_started', partnerId, deliveryPickingStatus, deliveryAccepted = false,
  deliveryFailed = false, deliveryRejected = false, deliveryRejectReason = '',
  deliveryVehicle, quotation,
  deliveryId, invoiceId, rejectReason, notes, items, previousBalance = 0,
  collectedAmount = 0, collectedFull = false, deliveryPod = null,
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
    // demo-only hints consumed by getOrderProgress / buildOrderTimeline / the demo delivery builder
    deliveryPickingStatus: deliveryPickingStatus || null,
    deliveryAccepted,
    deliveryFailed,
    deliveryRejected,
    deliveryRejectReason,
    collectedAmount,
    collectedFull,
    deliveryPod,
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
  // C. Delivery Assigned - partner assigned, delivery not yet accepted. From a customer quotation.
  order({
    key: 'assigned', number: 'SO-DEMO-03', customer: 'aarav', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-assigned', deliveryVehicle: 'MH-12-AB-4521',
    quotation: { id: 'demo-qt-accepted-customer', number: 'QT-DEMO-A1' },
    items: [line({ id: 'i1', ...FLOUR, quantity: 40 })],
  }),
  // C2. Accepted - partner accepted the delivery, picking not started (dashboard "Accepted" tile).
  order({
    key: 'accepted-only', number: 'SO-DEMO-17', customer: 'royal', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-accepted-only', deliveryVehicle: 'MH-12-AB-4521',
    deliveryAccepted: true,
    items: [line({ id: 'i1', ...FLOUR, quantity: 8 })],
  }),
  // C3. Picked, waiting to be loaded - second loadable group for the Vehicle Loading page.
  order({
    key: 'accepted', number: 'SO-DEMO-15', customer: 'metro', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-accepted', deliveryVehicle: 'MH-12-AB-4521',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...SUGAR, quantity: 16 })],
  }),
  // D. Picking - delivery assigned and currently picking (§6 D, drives the new "Picking" step).
  order({
    key: 'picking', number: 'SO-DEMO-04', customer: 'green', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-picking', deliveryVehicle: 'MH-12-AB-4521',
    deliveryPickingStatus: 'picking',
    items: [line({ id: 'i1', ...RICE, quantity: 12, availableStock: 8 }), line({ id: 'i2', ...OIL, quantity: 24 })],
  }),
  // E. Vehicle Loaded.
  order({
    key: 'loaded', number: 'SO-DEMO-05', customer: 'royal', status: 'confirmed', fulfilmentStatus: 'loaded',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-loaded', deliveryVehicle: 'MH-12-AB-4521',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...RICE, quantity: 50 })],
  }),
  // F. In Transit — also the delivery-adjustment demo: Aarav Distributors ordered Rice 10kg x 10,
  // the van carries Rice 20 / Oil 12, so the partner can bump Rice 10 -> 15 and add Sunflower Oil.
  order({
    key: 'transit', number: 'SO-DEMO-06', customer: 'aarav', status: 'confirmed', fulfilmentStatus: 'in_transit',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-transit', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked',
    items: [line({ id: 'i1', ...RICE, quantity: 10 })],
    notes: 'Adjustment demo: partner carries extra Rice + Oil on the van.',
  }),
  // G. Delivered - no invoice yet (tests Create Invoice) + a previous pending balance so the
  // Collection section shows Order Amount / Previous Pending / Total Due and the partner can
  // record a part-collection against an outstanding receivable (§10: Delivered != fully paid).
  order({
    key: 'delivered', number: 'SO-DEMO-07', customer: 'metro', status: 'confirmed', fulfilmentStatus: 'delivered',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-delivered', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked', previousBalance: 3000,
    items: [line({ id: 'i1', ...RICE, quantity: 20, deliveredQuantity: 20 })],
  }),
  // H. Completed - delivered + invoice created + order completed. Fully collected + POD photos
  // uploaded (POD "uploaded" + "fully collected" demo).
  order({
    key: 'completed', number: 'SO-DEMO-08', customer: 'aarav', status: 'completed', fulfilmentStatus: 'delivered',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-completed', invoiceId: 'demo-inv-completed',
    deliveryPickingStatus: 'picked', collectedFull: true,
    deliveryPod: { photo_file_ids: [DEMO_POD_PHOTO, DEMO_POD_PHOTO], signature_file_id: '' },
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
  // N. Partial Delivery (exception outcome, not a primary stage). Part-collected against the
  // delivered value (Collection = "Partially Collected" demo).
  order({
    key: 'partial', number: 'SO-DEMO-14', customer: 'green', status: 'confirmed', fulfilmentStatus: 'partially_delivered',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-partial', deliveryVehicle: 'MH-14-CD-7824',
    deliveryPickingStatus: 'picked', collectedAmount: 1500,
    items: [line({ id: 'i1', ...FLOUR, quantity: 10, deliveredQuantity: 6, reservedQuantity: 10 })],
  }),
  // O. Failed delivery attempt (exception - needs a re-attempt). Order stays Confirmed,
  // fulfilment is back to planned pending the next attempt.
  order({
    key: 'failed', number: 'SO-DEMO-16', customer: 'royal', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-sunil', deliveryId: 'demo-dlv-failed', deliveryVehicle: 'MH-14-CD-7824',
    deliveryFailed: true,
    items: [line({ id: 'i1', ...OIL, quantity: 30 })],
    notes: 'Customer unavailable at the address — needs a re-attempt.',
  }),
  // P. Rejected delivery - the partner declined the assignment (order stays Confirmed so the
  // office can reassign). Off-flow: no operational progression.
  order({
    key: 'rejected', number: 'SO-DEMO-18', customer: 'royal', status: 'confirmed', fulfilmentStatus: 'planned',
    partnerId: 'demo-dp-ravi', deliveryId: 'demo-dlv-rejected', deliveryVehicle: 'MH-12-AB-4521',
    deliveryRejected: true, deliveryRejectReason: 'Vehicle breakdown — cannot run this route today.',
    items: [line({ id: 'i1', ...OIL, quantity: 12 })],
    notes: 'Partner rejected the assignment; awaiting reassignment by the office.',
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
  if (order.deliveryRejected) return 'rejected' // -> getDeliveryStage() => "Rejected"
  if (order.deliveryFailed) return 'returned' // -> getDeliveryStage() => "Failed"
  const fs = order.fulfilmentStatus
  if (fs === 'delivered') return 'delivered'
  if (fs === 'partially_delivered') return 'partially_delivered'
  if (fs === 'in_transit') return 'in_transit'
  if (fs === 'loaded') return 'in_transit' // internal loaded surfaces as public in_transit
  // planned: still awaiting the partner's Accept unless it is accepted / picking already.
  // planned + not accepted -> public `pending` -> getDeliveryStage() => "Assigned" (Accept/Reject).
  // planned + accepted     -> public `accepted` (+ pickingStatus not_started) => "Accepted".
  // planned + picking       -> public `accepted` (+ pickingStatus picking) => "Picking".
  if (order.deliveryAccepted || ['picking', 'picked'].includes(order.deliveryPickingStatus)) return 'accepted'
  return 'pending'
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
      uom: it.uom || 'unit',
      warehouseAvailable: it.availableStock ?? null,
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
    failureReason: order.deliveryRejected
      ? order.deliveryRejectReason || 'Delivery rejected by the partner.'
      : order.deliveryFailed
        ? 'Customer unavailable at the address — re-attempt required.'
        : '',
    receiverName: done ? order.customerName : '',
    notes: order.notes || '',
    items,
    plannedTotal,
    loadedTotal,
    deliveredTotal,
    // Collection is operationally relevant once the goods reach the customer (In Transit ->
    // Delivered) and no invoice has settled the order yet. `amountDue` is the CURRENT
    // outstanding (order total + previous pending, minus anything collected via patchDemoDelivery).
    amountDue:
      ['in_transit', 'partially_delivered', 'delivered'].includes(fs) && !order.invoiceId
        ? Math.round(order.total) + (order.previousPendingBalance || 0)
        : 0,
    collectedAmount: order.collectedFull
      ? Math.round((order.total + (order.previousPendingBalance || 0)) * 100) / 100
      : Number(order.collectedAmount) || 0,
    previousPendingBalance: order.previousPendingBalance || 0,
    pod: order.deliveryPod || null,
    createdAt: order.createdAt,
    updatedAt: new Date().toISOString(),
  }

  const ov = readDeliveryOverrides()[deliveryId]
  if (!ov) return base

  const merged = { ...base, ...ov }
  // Reflect a simulated Vehicle-Loading confirm on the line items so the Delivery Items
  // table shows the loaded quantities too (not just the override's loadedTotal).
  if (Array.isArray(ov.loadedItems) && ov.loadedItems.length) {
    const loadedByProduct = new Map(ov.loadedItems.map((li) => [li.productId, Number(li.qty) || 0]))
    merged.items = merged.items.map((item) =>
      loadedByProduct.has(item.productId)
        ? { ...item, loadedQuantity: loadedByProduct.get(item.productId), pickedQuantity: Math.max(item.pickedQuantity, loadedByProduct.get(item.productId)) }
        : item,
    )
  }
  return merged
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

// ---- Demo vehicle stock ----------------------------------------------------------------
// The consolidated onboard stock = the baseline van load + everything the Vehicle Loading
// page (or Delivery Detail's "Mark Vehicle Loaded") has moved onto the van from demo
// deliveries. Keeps Vehicle Loading / Vehicle Stock / Dashboard / Delivery Detail in sync.
export function demoVehicleStockResolved() {
  const byProduct = new Map()
  DEMO_VEHICLE_STOCK.forEach((entry) => byProduct.set(entry.productId, { ...entry }))

  Object.values(readDeliveryOverrides()).forEach((override) => {
    ;(override.loadedItems || []).forEach((li) => {
      const qty = Number(li.qty) || 0
      if (qty <= 0) return
      const current = byProduct.get(li.productId) || {
        productId: li.productId,
        productName: li.productName || li.productId,
        sku: '',
        variantId: '',
        uom: 'unit',
        loadedQuantity: 0,
        extraQuantity: 0,
        deliveredQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 0,
      }
      current.loadedQuantity = (Number(current.loadedQuantity) || 0) + qty
      current.remainingQuantity = (Number(current.remainingQuantity) || 0) + qty
      byProduct.set(li.productId, current)
    })
  })

  return [...byProduct.values()]
}

// A full normalizeSession()-shaped demo vehicle-stock session for the read-only Vehicle
// Stock page. Vehicle / driver / warehouse context matches the shared demo delivery records.
export function demoVehicleSessionResolved() {
  const partner = DEMO_DELIVERY_PARTNERS[0]
  return {
    id: 'demo-vss-1',
    deliveryPartnerId: partner.id,
    deliveryPartnerName: partner.name,
    vehicleId: 'demo-veh-1',
    vehicleNumber: 'MH-12-AB-4521',
    vehicleType: 'Tempo',
    vehicleCapacityKg: 1500,
    warehouseId: 'demo-wh-main',
    warehouseName: 'Main Warehouse',
    date: iso(0),
    lastLoadedAt: iso(0, 7),
    status: 'active',
    items: demoVehicleStockResolved(),
    isDemo: true,
  }
}

// Simulate the Vehicle Loading confirm for a demo delivery: it reaches "Vehicle Loaded" and
// its picked items are added to the demo van stock. Local only - no API call.
export function simulateDemoVehicleLoad(deliveryId, loadedItems = []) {
  if (!isDemoDelivery(deliveryId)) return
  const clean = loadedItems
    .map((li) => ({ productId: li.productId, productName: li.productName || '', qty: Math.max(0, Math.round(Number(li.qty) || 0)) }))
    .filter((li) => li.productId && li.qty > 0)
  patchDemoDelivery(deliveryId, {
    status: 'in_transit', // internal loaded -> public in_transit, no dispatchedAt -> stage "Vehicle Loaded"
    pickingStatus: 'picked',
    dispatchedAt: null,
    loadedTotal: clean.reduce((sum, li) => sum + li.qty, 0),
    loadedItems: clean,
  })
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
