// Local-only demo layer for Sales Returns. Explicit switch only (VITE_DEMO_DATA=true) - never
// inferred from an empty/failed API. Demo returns are tied to the existing demo orders /
// customers / products so the whole picture stays coherent. NEVER calls a real API and never
// writes a real record.

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { demoOrdersResolved } from '../orders/orderDemoData'

export const SALES_RETURNS_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

const OVERRIDE_KEY = 'saas.salesReturnDemoOverride.v1'
const CUSTOM_KEY = 'saas.salesReturnDemoCustom.v1'

const readJson = (key, fallback) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}
const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled - demo change just won't survive a refresh */
  }
}

export function isDemoSalesReturn(id) {
  return typeof id === 'string' && id.startsWith('demo-sr-')
}

function iso(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
}

// Pull a couple of delivered/completed demo orders to anchor the seed returns to.
function anchorOrder(key) {
  return demoOrdersResolved().find((order) => order.id === `demo-so-${key}`) || null
}

function seedItem(orderItem, qtyReturned, extra = {}) {
  return {
    id: `demo-sri-${orderItem.id}-${qtyReturned}`,
    invoiceItemId: orderItem.orderItemId || orderItem.id,
    productId: orderItem.productId,
    variantId: '',
    productName: orderItem.productName,
    sku: '',
    quantityReturned: qtyReturned,
    receivedQuantity: null,
    restockedQuantity: null,
    condition: '',
    restock: false,
    unitPrice: orderItem.unitPrice || 0,
    taxRate: orderItem.taxRate || 0,
    lineTotal: (orderItem.unitPrice || 0) * qtyReturned,
    ...extra,
  }
}

function buildSeeds() {
  const metro = anchorOrder('delivered') // SO-DEMO-07, Rice 20 delivered, customer Metro
  const aarav = anchorOrder('completed') // SO-DEMO-08, Flour 75 delivered, customer Aarav
  const balaji = anchorOrder('takeaway-picked') // SO-DEMO-20, Rice 12, customer Balaji

  const seeds = []

  if (metro) {
    const rice = metro.items[0]
    // A — Pending: wrong product delivered
    seeds.push({
      id: 'demo-sr-01',
      returnNumber: 'SR-DEMO-001',
      returnDate: iso(2),
      status: 'requested',
      customerId: metro.customerId,
      customerName: metro.customerName,
      invoiceReferenceId: `demo-inv-${metro.id}`,
      invoiceNumber: metro.invoiceNumber || `INV-${metro.orderNumber}`,
      orderId: metro.id,
      orderNumber: metro.orderNumber,
      returnReason: 'Wrong Product',
      returnType: 'Credit Note',
      warehouseId: '',
      warehouseName: '',
      receivedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedReason: '',
      notes: 'Customer received a different SKU than ordered.',
      creditNoteId: null,
      creditAmount: 0,
      items: [seedItem(rice, 4)],
      createdAt: iso(2),
      updatedAt: iso(2),
    })
    // C — Received: some restockable + some damaged
    seeds.push({
      id: 'demo-sr-03',
      returnNumber: 'SR-DEMO-003',
      returnDate: iso(5),
      status: 'received',
      customerId: metro.customerId,
      customerName: metro.customerName,
      invoiceReferenceId: `demo-inv-${metro.id}`,
      invoiceNumber: metro.invoiceNumber || `INV-${metro.orderNumber}`,
      orderId: metro.id,
      orderNumber: metro.orderNumber,
      returnReason: 'Damaged Product',
      returnType: 'Credit Note',
      warehouseId: 'demo-wh-main',
      warehouseName: 'Central Mumbai Warehouse',
      receivedAt: iso(3),
      approvedAt: null,
      approvedBy: null,
      rejectedReason: '',
      notes: '',
      creditNoteId: null,
      creditAmount: 0,
      items: [seedItem(rice, 5, { receivedQuantity: 5, condition: 'damaged', restock: false })],
      createdAt: iso(5),
      updatedAt: iso(3),
    })
  }

  if (aarav) {
    const flour = aarav.items[0]
    // D — Completed: inventory disposition shown
    seeds.push({
      id: 'demo-sr-04',
      returnNumber: 'SR-DEMO-004',
      returnDate: iso(9),
      status: 'approved',
      customerId: aarav.customerId,
      customerName: aarav.customerName,
      invoiceReferenceId: `demo-inv-${aarav.id}`,
      invoiceNumber: aarav.invoiceNumber || `INV-${aarav.orderNumber}`,
      orderId: aarav.id,
      orderNumber: aarav.orderNumber,
      returnReason: 'Excess Quantity',
      returnType: 'Credit Note',
      warehouseId: 'demo-wh-main',
      warehouseName: 'Central Mumbai Warehouse',
      receivedAt: iso(7),
      approvedAt: iso(6),
      approvedBy: 'demo-admin',
      rejectedReason: '',
      notes: 'Customer over-ordered; 8 back in stock, 2 written off.',
      creditNoteId: 'demo-cn-004',
      creditAmount: flour.unitPrice * 10,
      items: [
        seedItem(flour, 10, { receivedQuantity: 10, restockedQuantity: 8, condition: 'saleable', restock: true }),
      ],
      createdAt: iso(9),
      updatedAt: iso(6),
    })
  }

  if (balaji) {
    const rice = balaji.items[0]
    // E — Rejected: clear reason
    seeds.push({
      id: 'demo-sr-05',
      returnNumber: 'SR-DEMO-005',
      returnDate: iso(12),
      status: 'rejected',
      customerId: balaji.customerId,
      customerName: balaji.customerName,
      invoiceReferenceId: `demo-inv-${balaji.id}`,
      invoiceNumber: balaji.invoiceNumber || `INV-${balaji.orderNumber}`,
      orderId: balaji.id,
      orderNumber: balaji.orderNumber,
      returnReason: 'Customer Changed Mind',
      returnType: 'Credit Note',
      warehouseId: '',
      warehouseName: '',
      receivedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedReason: 'Return window closed — goods dispatched more than 30 days ago.',
      notes: '',
      creditNoteId: null,
      creditAmount: 0,
      items: [seedItem(rice, 3)],
      createdAt: iso(12),
      updatedAt: iso(11),
    })
  }

  return seeds
}

function resolved() {
  const overrides = readJson(OVERRIDE_KEY, {})
  const custom = readJson(CUSTOM_KEY, [])
  const merge = (record) => (overrides[record.id] ? { ...record, ...overrides[record.id] } : record)
  return [...custom.map(merge), ...buildSeeds().map(merge)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  )
}

export function getDemoSalesReturns() {
  return resolved()
}

export function getDemoSalesReturn(id) {
  return resolved().find((record) => record.id === id) || null
}

function patch(id, partial) {
  const overrides = readJson(OVERRIDE_KEY, {})
  overrides[id] = { ...(overrides[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, overrides)
  return getDemoSalesReturn(id)
}

// ---- Interactive lifecycle simulation (localStorage only) ----------------------------------

export function createDemoSalesReturn(payload) {
  const custom = readJson(CUSTOM_KEY, [])
  const seq = custom.length + getDemoSalesReturns().length + 1
  const now = new Date().toISOString()
  const record = {
    id: `demo-sr-${Date.now().toString(36)}`,
    returnNumber: `SR-DEMO-${String(seq).padStart(3, '0')}`,
    returnDate: payload.returnDate || now,
    status: 'requested',
    customerId: payload.customerId || '',
    customerName: payload.customerName || '',
    invoiceReferenceId: payload.invoiceReferenceId || '',
    invoiceNumber: payload.invoiceNumber || '',
    orderId: payload.orderId || '',
    orderNumber: payload.orderNumber || '',
    returnReason: payload.returnReason || '',
    returnType: payload.returnType || 'Credit Note',
    warehouseId: payload.warehouseId || '',
    warehouseName: payload.warehouseName || '',
    receivedAt: null,
    approvedAt: null,
    approvedBy: null,
    rejectedReason: '',
    notes: payload.notes || '',
    creditNoteId: null,
    creditAmount: 0,
    items: (payload.items || []).map((item, index) => ({
      id: `demo-sri-${Date.now().toString(36)}-${index}`,
      invoiceItemId: item.invoiceItemId || '',
      productId: item.productId || '',
      variantId: item.variantId || '',
      productName: item.productName || 'Item',
      sku: item.sku || '',
      quantityReturned: Number(item.quantityReturned) || 0,
      receivedQuantity: null,
      restockedQuantity: null,
      condition: '',
      restock: false,
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0,
      lineTotal: (Number(item.unitPrice) || 0) * (Number(item.quantityReturned) || 0),
    })),
    createdAt: now,
    updatedAt: now,
  }
  writeJson(CUSTOM_KEY, [record, ...custom])
  return record
}

export function receiveDemoSalesReturn(id, payload) {
  const record = getDemoSalesReturn(id)
  if (!record) return null
  const decisions = new Map((payload.items || []).map((it) => [it.returnItemId, it]))
  const items = record.items.map((item) => {
    const d = decisions.get(item.id)
    if (!d) return item
    return {
      ...item,
      receivedQuantity: Number(d.receivedQuantity) || 0,
      condition: d.condition || item.condition,
      restock: Boolean(d.restock),
    }
  })
  return patch(id, { status: 'received', receivedAt: new Date().toISOString(), items, notes: payload.notes || record.notes })
}

export function approveDemoSalesReturn(id, payload) {
  const record = getDemoSalesReturn(id)
  if (!record) return null
  const decisions = new Map((payload.items || []).map((it) => [it.returnItemId, it]))
  let creditAmount = 0
  const items = record.items.map((item) => {
    const d = decisions.get(item.id) || {}
    const condition = d.condition || item.condition || 'saleable'
    const restock = d.restock != null ? Boolean(d.restock) : item.restock
    const received = item.receivedQuantity != null ? item.receivedQuantity : item.quantityReturned
    const restocked = condition === 'saleable' && restock ? received : 0
    creditAmount += (Number(item.unitPrice) || 0) * received
    return { ...item, condition, restock, receivedQuantity: received, restockedQuantity: restocked }
  })
  return patch(id, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: 'demo-admin',
    receivedAt: record.receivedAt || new Date().toISOString(),
    items,
    creditNoteId: payload.creditNote === false ? null : `demo-cn-${record.returnNumber}`,
    creditAmount: payload.creditNote === false ? 0 : Math.round(creditAmount * 100) / 100,
    warehouseId: payload.warehouseId || record.warehouseId,
    notes: payload.notes || record.notes,
  })
}

export function rejectDemoSalesReturn(id, reason) {
  if (!getDemoSalesReturn(id)) return null
  return patch(id, { status: 'rejected', rejectedReason: reason || 'Rejected.' })
}

export function deleteDemoSalesReturn(id) {
  const custom = readJson(CUSTOM_KEY, [])
  writeJson(CUSTOM_KEY, custom.filter((record) => record.id !== id))
  const overrides = readJson(OVERRIDE_KEY, {})
  if (overrides[id]) {
    delete overrides[id]
    writeJson(OVERRIDE_KEY, overrides)
  }
  return { success: true }
}

// ---- Create-form support: demo "invoices" = delivered demo orders --------------------------
// The real form fetches /invoices/{q}; in demo mode we offer the delivered demo orders and
// treat their delivered lines as the invoiced lines, minus anything already returned.

export function demoReturnableOrders() {
  const returnsByOrder = new Map()
  getDemoSalesReturns().forEach((sr) => {
    // A rejected return never received the goods, so it does not consume returnable units.
    if (String(sr.status).toLowerCase() === 'rejected') return
    const list = returnsByOrder.get(sr.orderId) || []
    list.push(sr)
    returnsByOrder.set(sr.orderId, list)
  })

  return demoOrdersResolved()
    .filter((order) => order.status === 'completed' || (order.items || []).some((it) => (Number(it.deliveredQuantity) || 0) > 0))
    .filter((order) => order.status !== 'cancelled')
    .map((order) => {
      const priorReturns = returnsByOrder.get(order.id) || []
      const returnedByItem = {}
      priorReturns.forEach((sr) => {
        ;(sr.items || []).forEach((item) => {
          returnedByItem[item.invoiceItemId] = (returnedByItem[item.invoiceItemId] || 0) + (Number(item.quantityReturned) || 0)
        })
      })
      const items = (order.items || [])
        .map((it) => {
          const delivered = Number(it.deliveredQuantity) || 0
          const already = returnedByItem[it.orderItemId || it.id] || 0
          return {
            invoiceItemId: it.orderItemId || it.id,
            productId: it.productId,
            variantId: '',
            productName: it.productName,
            sku: '',
            deliveredQty: delivered,
            alreadyReturned: already,
            returnableQty: Math.max(delivered - already, 0),
            unitPrice: Number(it.unitPrice) || 0,
            taxRate: Number(it.taxRate) || 0,
          }
        })
        .filter((line) => line.deliveredQty > 0)
      return {
        id: `demo-inv-${order.id}`,
        invoiceNumber: order.invoiceNumber || `INV-${order.orderNumber}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        items,
        hasReturnable: items.some((line) => line.returnableQty > 0),
      }
    })
}
