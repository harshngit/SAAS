// =============================================================================
// Local-only demo layer for Sales Invoices + Receivables + Payments.
// -----------------------------------------------------------------------------
// Explicit switch ONLY (VITE_DEMO_DATA=true) - never inferred from an empty or
// failed API, a 404, or an error. When enabled, the invoice and payment-receipt
// API wrappers return ONLY these records and simulate every mutation in
// localStorage: no real /invoices or /payment-receipts request is made, and no
// `demo-` id is ever sent to the backend.
//
// The records are anchored to the shared demo customers / products / orders
// (see features/orders/orderDemoData.js) so the whole finance picture stays
// coherent: A unpaid, B partially paid, C overdue (all direct counter sales),
// plus D & E paid - each invoiced from a genuinely delivered/collected demo
// order (SO-DEMO-08 / SO-DEMO-20), reusing the invoice id that order already
// declares. No invoice is ever sourced from a Draft / Reserved / Assigned /
// Picking order.
//
// TODO: remove the invoice demo layer once the backend provides finance fixtures.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'

export const INVOICE_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoInvoice(id) {
  return typeof id === 'string' && id.startsWith('demo-inv-')
}
export function isDemoReceipt(id) {
  return typeof id === 'string' && id.startsWith('demo-rcpt-')
}

const RECEIPTS_KEY = 'saas.invoiceDemoReceipts.v1'

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
    /* storage disabled - the demo payment just won't survive a refresh */
  }
}

const DAY_MS = 86_400_000
const iso = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * DAY_MS)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}
const dateOnly = (daysFromNow) => iso(daysFromNow).slice(0, 10)

// ---- Coherent demo catalogue (mirrors orders/orderDemoData.js) ----
const CUST = {
  metro: { id: 'demo-customer-metro', name: 'Metro Mart', city: 'Pune' },
  aarav: { id: 'demo-customer-aarav', name: 'Aarav Distributors', city: 'Nagpur' },
  green: { id: 'demo-customer-green', name: 'Green Basket Stores', city: 'Nashik' },
  balaji: { id: 'demo-customer-balaji', name: 'Shree Balaji Retail', city: 'Mumbai' },
  royal: { id: 'demo-customer-royal', name: 'Royal Foods', city: 'Thane' },
}
const P = {
  rice: { productId: 'demo-p-rice', productName: 'Rice 10kg' },
  oil: { productId: 'demo-p-oil', productName: 'Sunflower Oil 1L' },
  flour: { productId: 'demo-p-flour', productName: 'Wheat Flour 5kg' },
  sugar: { productId: 'demo-p-sugar', productName: 'Sugar 5kg' },
}

// 5% GST line - matches the tax rate every product carries in orderDemoData.js, so an
// order-linked invoice's totals line up exactly with its source order.
function line(idx, base, quantity, unitPrice, taxRate = 5) {
  const taxable = quantity * unitPrice
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100
  return {
    id: `demo-invi-${idx}`,
    productId: base.productId,
    variantId: '',
    productName: base.productName,
    hsnCode: '',
    quantity,
    unitPrice,
    discount: 0,
    taxRate,
    taxAmount,
    lineTotal: taxable + taxAmount,
  }
}

function seed({ id, number, cust, order, deliveryId, items, discount = 0, dueInDays, notes }) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
  const tax = Math.round(items.reduce((sum, it) => sum + it.taxAmount, 0) * 100) / 100
  return {
    id,
    invoiceNumber: number,
    _customerKey: cust,
    _order: order || null,
    _deliveryId: deliveryId || null,
    items,
    subtotal,
    discount,
    tax,
    additionalCharges: 0,
    roundOff: 0,
    total: Math.round((subtotal - discount + tax) * 100) / 100,
    invoiceDate: dateOnly(dueInDays - 20),
    dueDate: dateOnly(dueInDays),
    notes: notes || '',
    createdAt: iso(dueInDays - 20),
  }
}

// Every invoice's source is either a genuinely delivered/collected demo order or a true
// counter sale (no order at all) - never a Draft / Reserved / Assigned / Picking order.
//   A. UNPAID        - direct counter sale, nothing paid
//   B. PARTIALLY PAID - direct counter sale, one part payment
//   C. OVERDUE       - direct counter sale, part paid, due date passed
//   D. PAID          - SO-DEMO-08  (Completed / Delivered, Aarav Distributors)
//   E. PAID          - SO-DEMO-20  (Pickup Collected / Completed, Shree Balaji Retail)
const SEED_INVOICES = [
  seed({
    id: 'demo-inv-a1', number: 'INV-DEMO-A1', cust: 'metro',
    items: [line(1, P.rice, 10, 620), line(2, P.oil, 8, 180)],
    dueInDays: 10,
    notes: 'Direct counter sale — Metro Mart, Pune. Awaiting payment.',
  }),
  seed({
    id: 'demo-inv-b1', number: 'INV-DEMO-B1', cust: 'green',
    items: [line(1, P.flour, 12, 335), line(2, P.sugar, 6, 260)],
    dueInDays: 4,
    notes: 'Direct counter sale — part payment received.',
  }),
  seed({
    id: 'demo-inv-c1', number: 'INV-DEMO-C1', cust: 'royal',
    items: [line(1, P.oil, 24, 180)],
    dueInDays: -18,
    notes: 'Overdue — follow up with Royal Foods.',
  }),
  seed({
    id: 'demo-inv-completed', number: 'INV-DEMO-08', cust: 'aarav',
    order: { id: 'demo-so-completed', number: 'SO-DEMO-08' }, deliveryId: 'demo-dlv-completed',
    items: [line(1, P.flour, 75, 335)],
    dueInDays: -6,
    notes: 'Invoiced from delivered order SO-DEMO-08. Paid in full.',
  }),
  seed({
    id: 'demo-inv-takeaway', number: 'INV-DEMO-20', cust: 'balaji',
    order: { id: 'demo-so-takeaway-picked', number: 'SO-DEMO-20' },
    items: [line(1, P.rice, 12, 620)],
    dueInDays: -2,
    notes: 'Counter pickup SO-DEMO-20 — collected and paid at the counter.',
  }),
]

// Seeded payment ledger - always present, alongside anything recorded locally.
const SEED_RECEIPTS = {
  'demo-inv-b1': [
    { id: 'demo-rcpt-b1a', receiptNumber: 'RCPT-DEMO-B11', receiptDate: dateOnly(-6), amountReceived: 2000, paymentMethod: 'bank_transfer', transactionReference: 'NEFT-4471902', note: 'Part payment', createdAt: iso(-6) },
  ],
  'demo-inv-c1': [
    { id: 'demo-rcpt-c1a', receiptNumber: 'RCPT-DEMO-C11', receiptDate: dateOnly(-30), amountReceived: 1500, paymentMethod: 'upi', transactionReference: 'UPI-8830155217', note: '', createdAt: iso(-30) },
  ],
  'demo-inv-completed': [
    { id: 'demo-rcpt-08a', receiptNumber: 'RCPT-DEMO-081', receiptDate: dateOnly(-14), amountReceived: 20000, paymentMethod: 'bank_transfer', transactionReference: 'NEFT-5510338', note: 'On delivery', createdAt: iso(-14) },
    { id: 'demo-rcpt-08b', receiptNumber: 'RCPT-DEMO-082', receiptDate: dateOnly(-5), amountReceived: 6381.25, paymentMethod: 'upi', transactionReference: 'UPI-9021447781', note: 'Balance cleared', createdAt: iso(-5) },
  ],
  'demo-inv-takeaway': [
    { id: 'demo-rcpt-20a', receiptNumber: 'RCPT-DEMO-201', receiptDate: dateOnly(-2), amountReceived: 7812, paymentMethod: 'cash', transactionReference: '', note: 'Collected at counter', createdAt: iso(-2) },
  ],
}

const storedReceipts = () => readJson(RECEIPTS_KEY, {})

function receiptsForRaw(invoiceId) {
  const stored = storedReceipts()[invoiceId] || []
  const seeded = SEED_RECEIPTS[invoiceId] || []
  return [...seeded, ...stored].sort(
    (a, b) => new Date(a.receiptDate || a.createdAt || 0) - new Date(b.receiptDate || b.createdAt || 0),
  )
}

function financials(invoice) {
  const received = receiptsForRaw(invoice.id).reduce((sum, r) => sum + (Number(r.amountReceived) || 0), 0)
  const amountPaid = Math.min(Math.round(received * 100) / 100, invoice.total)
  const outstandingAmount = Math.max(0, Math.round((invoice.total - amountPaid) * 100) / 100)
  const paymentStatus = outstandingAmount <= 0 && invoice.total > 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid'
  return { amountPaid, outstandingAmount, paymentStatus }
}

// normalizeInvoice()-shaped (see api/invoices.js) so every screen consumes it unchanged.
function resolveInvoice(invoice) {
  const cust = CUST[invoice._customerKey] || null
  const { amountPaid, outstandingAmount, paymentStatus } = financials(invoice)
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    salesId: '',
    orderId: invoice._order?.id || null,
    orderNumber: invoice._order?.number || '',
    deliveryId: invoice._deliveryId || null,
    customerId: cust?.id || '',
    customerName: cust?.name || '',
    walkInName: '',
    walkInPhone: '',
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    invoiceStatus: 'Issued',
    paymentStatus,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    additionalCharges: invoice.additionalCharges,
    roundOff: invoice.roundOff,
    total: invoice.total,
    amountPaid,
    outstandingAmount,
    notes: invoice.notes || '',
    isCreditNote: false,
    creditNoteReason: '',
    billingAddress: cust ? `${cust.name}, 12 MG Road, ${cust.city}` : '',
    salesType: '',
    salesDate: invoice.invoiceDate,
    items: invoice.items,
    createdAt: invoice.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

export function demoInvoicesResolved(params = {}) {
  let list = SEED_INVOICES.map(resolveInvoice)
  if (params.customer_id) list = list.filter((inv) => inv.customerId === params.customer_id)
  if (params.order_id) list = list.filter((inv) => inv.orderId === params.order_id)
  if (params.status) {
    const want = String(params.status).toLowerCase()
    list = list.filter((inv) => String(inv.paymentStatus).toLowerCase() === want)
  }
  return list.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0))
}

export function getDemoInvoiceById(id) {
  return SEED_INVOICES.map(resolveInvoice).find((inv) => inv.id === id) || null
}

// normalizeReceipt()-shaped (see api/paymentReceipts.js).
function shapeReceipt(receipt, invoiceId) {
  const inv = getDemoInvoiceById(invoiceId)
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber || receipt.id,
    receiptDate: receipt.receiptDate,
    customerId: inv?.customerId || '',
    customerName: inv?.customerName || '',
    invoiceId,
    invoiceNumber: inv?.invoiceNumber || '',
    amountReceived: Number(receipt.amountReceived) || 0,
    paymentMethod: receipt.paymentMethod || '',
    transactionReference: receipt.transactionReference || '',
    note: receipt.note || '',
    invoiceTotal: inv?.total ?? null,
    totalPaid: inv?.amountPaid ?? null,
    outstandingAmount: inv?.outstandingAmount ?? null,
    paymentStatus: '',
    createdAt: receipt.createdAt || receipt.receiptDate,
  }
}

export function demoReceiptsResult(params = {}) {
  if (params.invoice_id) {
    return { success: true, receipts: receiptsForRaw(params.invoice_id).map((r) => shapeReceipt(r, params.invoice_id)) }
  }
  const all = []
  const ids = new Set([...Object.keys(SEED_RECEIPTS), ...Object.keys(storedReceipts())])
  ids.forEach((invoiceId) => {
    if (params.customer_id) {
      const inv = getDemoInvoiceById(invoiceId)
      if (!inv || inv.customerId !== params.customer_id) return
    }
    receiptsForRaw(invoiceId).forEach((r) => all.push(shapeReceipt(r, invoiceId)))
  })
  return { success: true, receipts: all.sort((a, b) => new Date(b.receiptDate || 0) - new Date(a.receiptDate || 0)) }
}

// Simulate POST /payment-receipts against a demo invoice - localStorage only.
export function recordDemoPayment(payload) {
  const invoiceId = payload.invoiceReferenceId || payload.invoice_reference_id
  const invoice = getDemoInvoiceById(invoiceId)
  if (!invoice) return { success: false, error: 'This demo invoice could not be found.' }

  const amount = Math.max(0, Math.round((Number(payload.amountReceived ?? payload.amount_received) || 0) * 100) / 100)
  if (amount <= 0 && (payload.paymentMethod || payload.payment_method) !== 'cod') {
    return { success: false, error: 'Enter an amount greater than zero.' }
  }
  if (amount > invoice.outstandingAmount + 0.5) {
    return { success: false, error: `Amount cannot exceed the outstanding balance of ₹${invoice.outstandingAmount}.` }
  }

  const map = storedReceipts()
  const list = map[invoiceId] || []
  const seq = (SEED_RECEIPTS[invoiceId]?.length || 0) + list.length + 1
  const receipt = {
    id: `demo-rcpt-${Date.now().toString(36)}`,
    receiptNumber: `RCPT-DEMO-${invoice.invoiceNumber.replace('INV-DEMO-', '')}${seq}`,
    receiptDate: payload.receiptDate || payload.receipt_date || dateOnly(0),
    amountReceived: amount,
    paymentMethod: payload.paymentMethod || payload.payment_method || 'cash',
    transactionReference: payload.transactionReference || payload.transaction_reference || '',
    note: payload.note || '',
    createdAt: new Date().toISOString(),
  }
  map[invoiceId] = [...list, receipt]
  writeJson(RECEIPTS_KEY, map)
  return { success: true, receipt: shapeReceipt(receipt, invoiceId) }
}

export function getDemoReceiptById(id) {
  const ids = new Set([...Object.keys(SEED_RECEIPTS), ...Object.keys(storedReceipts())])
  for (const invoiceId of ids) {
    const match = receiptsForRaw(invoiceId).find((r) => r.id === id)
    if (match) return shapeReceipt(match, invoiceId)
  }
  return null
}
