import { quotationTotals } from './quotationHelpers'

// =============================================================================
// FRONTEND DEMO / MOCK QUOTATIONS - UI TESTING ONLY
// -----------------------------------------------------------------------------
// One row per quotation state so every state-driven action is visible without
// hand-creating each scenario. Appended to the list AFTER the real API load and
// never sent to any backend endpoint (no call carries a `demo-qt-` id).
//
// TODO: remove quotation demo data when the backend provides test fixtures.
// =============================================================================

export const DEMO_QUOTATIONS_ENABLED = true

export function isDemoQuotation(id) {
  return typeof id === 'string' && id.startsWith('demo-qt-')
}

const DAY_MS = 86_400_000
const iso = (days) => new Date(Date.now() + days * DAY_MS).toISOString()
const isoDate = (days) => iso(days).slice(0, 10)

function item(overrides) {
  const base = {
    id: `${overrides.id}`,
    productId: overrides.productId || 'demo-product',
    variantId: '',
    productName: overrides.productName,
    quantity: overrides.quantity,
    uom: overrides.uom || 'unit',
    unitPrice: overrides.unitPrice,
    discount: overrides.discount || 0,
    taxRate: overrides.taxRate ?? 18,
    taxAmount: 0,
    lineTotal: 0,
  }
  const gross = base.quantity * base.unitPrice
  const net = gross - gross * (base.discount / 100)
  base.taxAmount = net * (base.taxRate / 100)
  base.lineTotal = net + base.taxAmount
  return base
}

function quotation({ id, number, status, customerId, customerName, validDays, items, notes, terms }) {
  const totals = quotationTotals(items)
  return {
    id,
    quotationNumber: number,
    quotationDate: isoDate(-4),
    validUntil: isoDate(validDays ?? 10),
    customerId: customerId || '',
    customerName: customerName || '',
    billingAddress: customerName ? `${customerName}, 4th Cross, Industrial Area, Bengaluru 560058` : '',
    shippingAddress: customerName ? `${customerName} Warehouse, Peenya, Bengaluru 560058` : '',
    salespersonId: '',
    salespersonName: 'sales',
    currency: 'INR',
    paymentTerms: 'Net 30',
    deliveryTerms: 'Standard delivery',
    notes: notes || 'Internal: customer negotiating on freight.',
    termsConditions: terms || 'Prices valid for 15 days. GST extra as applicable. Delivery within 5 working days of confirmed order.',
    status,
    items,
    itemCount: items.length,
    subtotal: totals.subtotal,
    taxTotal: totals.tax,
    total: totals.grandTotal,
    convertedOrderId: null,
    convertedAt: null,
    createdAt: iso(-4),
    updatedAt: iso(-1),
  }
}

const RICE = { productName: 'Rice 10kg', productId: 'demo-p-rice', uom: 'bag', unitPrice: 620, taxRate: 5 }
const OIL = { productName: 'Sunflower Oil 1L', productId: 'demo-p-oil', uom: 'bottle', unitPrice: 180, taxRate: 5 }
const FLOUR = { productName: 'Wheat Flour 5kg', productId: 'demo-p-flour', uom: 'bag', unitPrice: 335, taxRate: 5 }

export const demoQuotations = [
  // 1. Draft + customer -> Edit / Send / Delete
  quotation({
    id: 'demo-qt-draft-customer', number: 'QT-DEMO-D1', status: 'draft',
    customerId: 'demo-customer-abc', customerName: 'ABC Traders', validDays: 12,
    items: [item({ id: 'i1', ...RICE, quantity: 40 }), item({ id: 'i2', ...OIL, quantity: 100 })],
  }),
  // 2. Sent + customer -> Accept / Reject
  quotation({
    id: 'demo-qt-sent-customer', number: 'QT-DEMO-S1', status: 'sent',
    customerId: 'demo-customer-rohan', customerName: 'Rohan Patil', validDays: 6,
    items: [item({ id: 'i1', ...FLOUR, quantity: 60 }), item({ id: 'i2', ...RICE, quantity: 20 })],
  }),
  // 3. Accepted + customer -> Convert to Order
  quotation({
    id: 'demo-qt-accepted-customer', number: 'QT-DEMO-A1', status: 'accepted',
    customerId: 'demo-customer-neha', customerName: 'Neha Sharma', validDays: 8,
    items: [item({ id: 'i1', ...RICE, quantity: 80 }), item({ id: 'i2', ...OIL, quantity: 150, discount: 5 })],
  }),
  // 4. Accepted + LEAD (no customer) -> Convert to Customer, NO Convert to Order
  quotation({
    id: 'demo-qt-accepted-lead', number: 'QT-DEMO-A2', status: 'accepted',
    customerId: '', customerName: '', validDays: 9,
    items: [item({ id: 'i1', ...FLOUR, quantity: 120, discount: 8 })],
    notes: 'Internal: prospect wants a quote before onboarding.',
  }),
  // 5. Accepted LEAD that has ALREADY been converted -> View Customer + Convert to Order
  quotation({
    id: 'demo-qt-lead-converted', number: 'QT-DEMO-A2C', status: 'accepted',
    customerId: 'demo-customer-aman', customerName: 'Aman Kapoor', validDays: 11,
    items: [item({ id: 'i1', ...RICE, quantity: 90, discount: 6 })],
    notes: 'Internal: lead was converted to a customer from this quotation.',
  }),
  // 6. Rejected -> Duplicate only
  quotation({
    id: 'demo-qt-rejected', number: 'QT-DEMO-R1', status: 'rejected',
    customerId: 'demo-customer-priya', customerName: 'Priya Nair', validDays: 3,
    items: [item({ id: 'i1', ...RICE, quantity: 30 })],
  }),
  // 7. Expired (sent + valid-until in the past) -> Edit & Resend
  quotation({
    id: 'demo-qt-expired', number: 'QT-DEMO-E1', status: 'sent',
    customerId: 'demo-customer-aman', customerName: 'Aman Kapoor', validDays: -3,
    items: [item({ id: 'i1', ...OIL, quantity: 200 }), item({ id: 'i2', ...FLOUR, quantity: 40 })],
  }),
  // Terminal: already converted to an order
  quotation({
    id: 'demo-qt-converted', number: 'QT-DEMO-C1', status: 'converted',
    customerId: 'demo-customer-manish', customerName: 'Manish Rao', validDays: 20,
    items: [item({ id: 'i1', ...FLOUR, quantity: 75 })],
  }),
]

// Lead links for the demo lead quotations (mirrors what getQuotationMeta would return).
export const demoQuotationMeta = {
  'demo-qt-accepted-lead': { leadId: 'demo-lead-vikram', leadName: 'Vikram Joshi', leadStatus: 'qualified', convertedCustomerId: '' },
  // Already-converted lead quotation: has a customer + records the source lead.
  'demo-qt-lead-converted': { leadId: 'demo-lead-aman', leadName: 'Aman Kapoor', leadStatus: 'qualified', convertedCustomerId: 'demo-customer-aman' },
}

// Local overrides for demo quotations (e.g. status flips from the Edit & Resend / Send
// flow). Kept in localStorage so the change survives navigation - demo only, never sent.
const OVERRIDE_KEY = 'saas.quotationDemoOverride'

function readOverrides() {
  try {
    return JSON.parse(window.localStorage.getItem(OVERRIDE_KEY)) || {}
  } catch {
    return {}
  }
}

export function patchDemoQuotation(id, partial) {
  if (!isDemoQuotation(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial }
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
  } catch {
    /* storage disabled - override just won't persist */
  }
}

export function getDemoQuotation(id) {
  const base = demoQuotations.find((q) => q.id === id)
  if (!base) return null
  const override = readOverrides()[id]
  return override ? { ...base, ...override, updatedAt: new Date().toISOString() } : base
}

// The demo rows with any local status overrides applied - used by the list.
export function demoQuotationsResolved() {
  const overrides = readOverrides()
  return demoQuotations.map((q) => (overrides[q.id] ? { ...q, ...overrides[q.id] } : q))
}
