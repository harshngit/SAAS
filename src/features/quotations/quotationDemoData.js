import { quotationTotals } from './quotationHelpers'

// =============================================================================
// FRONTEND DEMO / MOCK QUOTATIONS - UI TESTING ONLY
// -----------------------------------------------------------------------------
// One row per quotation state so every state-driven action is visible without
// hand-creating each scenario. Appended to the list AFTER the real API load and
// never sent to any backend endpoint (no call carries a `demo-qt-` id).
//
// The demo quotation object now carries the Lead relationship directly
// (`leadId` + `lead`), matching the shape real API data is moving toward.
// `demoQuotationMeta` is kept as a THIN compatibility adapter derived from these
// objects - components that still read the localStorage-style meta keep working.
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
    taxRate: overrides.taxRate ?? 5,
    taxAmount: 0,
    lineTotal: 0,
  }
  const gross = base.quantity * base.unitPrice
  const net = gross - gross * (base.discount / 100)
  base.taxAmount = net * (base.taxRate / 100)
  base.lineTotal = net + base.taxAmount
  return base
}

// `lead` (optional): { id, name, leadStatus, convertedCustomerId }.
// If a lead has a convertedCustomerId, the quotation also carries that customer.
function quotation({ id, number, status, customerId, customerName, lead, validDays, items, notes, terms }) {
  const totals = quotationTotals(items)
  const linkedCustomerId = customerId || lead?.convertedCustomerId || ''
  const linkedCustomerName = customerName || (lead?.convertedCustomerId ? lead.name : '')
  return {
    id,
    quotationNumber: number,
    quotationDate: isoDate(-4),
    validUntil: isoDate(validDays ?? 10),
    customerId: linkedCustomerId,
    customerName: linkedCustomerName,
    // Real-API-shaped lead relationship (not browser-only metadata).
    leadId: lead?.id || '',
    lead: lead ? { id: lead.id, name: lead.name, leadStatus: lead.leadStatus || 'qualified' } : null,
    billingAddress: linkedCustomerName ? `${linkedCustomerName}, 4th Cross, Industrial Area` : '',
    shippingAddress: linkedCustomerName ? `${linkedCustomerName} Warehouse, Bhiwandi` : '',
    salespersonId: 'demo-user-rahul',
    salespersonName: 'Rahul Sharma',
    currency: 'INR',
    paymentTerms: 'Net 30',
    deliveryTerms: 'Standard delivery',
    notes: notes || 'Internal: customer negotiating on freight.',
    termsConditions: terms || 'Prices valid for 15 days. GST extra as applicable. Delivery within 5 working days of a confirmed order.',
    status,
    items,
    itemCount: items.length,
    subtotal: totals.subtotal,
    taxTotal: totals.tax,
    total: totals.grandTotal,
    convertedOrderId: status === 'converted' ? 'demo-so-completed' : null,
    convertedAt: status === 'converted' ? iso(-1) : null,
    createdAt: iso(-4),
    updatedAt: iso(-1),
  }
}

const RICE = { productName: 'Rice 10kg', productId: 'demo-p-rice', uom: 'bag', unitPrice: 620, taxRate: 5 }
const OIL = { productName: 'Sunflower Oil 1L', productId: 'demo-p-oil', uom: 'bottle', unitPrice: 180, taxRate: 5 }
const FLOUR = { productName: 'Wheat Flour 5kg', productId: 'demo-p-flour', uom: 'bag', unitPrice: 335, taxRate: 5 }
const SUGAR = { productName: 'Sugar 5kg', productId: 'demo-p-sugar', uom: 'bag', unitPrice: 260, taxRate: 5 }

// Leads referenced by the demo lead-quotations (ids match src/features/leads/demoData.js).
const LEAD_AMAN = { id: 'demo-lead-aman', name: 'Aman Distributors', leadStatus: 'qualified', convertedCustomerId: '' }
const LEAD_PRIYA = { id: 'demo-lead-priya', name: 'Priya Retail', leadStatus: 'won', convertedCustomerId: 'demo-customer-priya' }

export const demoQuotations = [
  // 1. Draft + customer -> Edit / Send / Download / Delete
  quotation({
    id: 'demo-qt-draft-customer', number: 'QT-DEMO-D1', status: 'draft',
    customerId: 'demo-customer-metro', customerName: 'Metro Mart', validDays: 12,
    items: [item({ id: 'i1', ...RICE, quantity: 40 }), item({ id: 'i2', ...OIL, quantity: 100 })],
  }),
  // 2. Sent + customer -> Edit / Accept / Reject / Download
  quotation({
    id: 'demo-qt-sent-customer', number: 'QT-DEMO-S1', status: 'sent',
    customerId: 'demo-customer-green', customerName: 'Green Basket Stores', validDays: 6,
    items: [item({ id: 'i1', ...FLOUR, quantity: 60 }), item({ id: 'i2', ...SUGAR, quantity: 20 })],
  }),
  // 3. Accepted + customer -> Convert to Order / Download / Duplicate
  quotation({
    id: 'demo-qt-accepted-customer', number: 'QT-DEMO-A1', status: 'accepted',
    customerId: 'demo-customer-aarav', customerName: 'Aarav Distributors', validDays: 8,
    items: [item({ id: 'i1', ...RICE, quantity: 80 }), item({ id: 'i2', ...OIL, quantity: 150, discount: 5 })],
  }),
  // 4. Accepted + LEAD only, NO customer -> Convert to Customer (NOT Convert to Order) (§20 A)
  quotation({
    id: 'demo-qt-accepted-lead', number: 'QT-DEMO-A2', status: 'accepted',
    lead: LEAD_AMAN, validDays: 9,
    items: [item({ id: 'i1', ...FLOUR, quantity: 120, discount: 8 })],
    notes: 'Internal: prospect wants a quote before onboarding.',
  }),
  // 5. Accepted, LEAD reference + customer already created -> View Customer + Convert to Order (§20 B)
  quotation({
    id: 'demo-qt-lead-converted', number: 'QT-DEMO-A2C', status: 'accepted',
    lead: LEAD_PRIYA, validDays: 11,
    items: [item({ id: 'i1', ...RICE, quantity: 90, discount: 6 })],
    notes: 'Internal: lead was converted to a customer from this quotation.',
  }),
  // 6. Rejected -> Edit & Resend / Download / Duplicate
  quotation({
    id: 'demo-qt-rejected', number: 'QT-DEMO-R1', status: 'rejected',
    customerId: 'demo-customer-metro', customerName: 'Metro Mart', validDays: 3,
    items: [item({ id: 'i1', ...RICE, quantity: 30 })],
  }),
  // 7. Expired = sent + valid-until in the past (frontend-derived, never a stored status) (§21)
  quotation({
    id: 'demo-qt-expired', number: 'QT-DEMO-E1', status: 'sent',
    customerId: 'demo-customer-green', customerName: 'Green Basket Stores', validDays: -3,
    items: [item({ id: 'i1', ...OIL, quantity: 200 }), item({ id: 'i2', ...FLOUR, quantity: 40 })],
  }),
  // 8. Converted to an order -> View Order / Download / Duplicate
  quotation({
    id: 'demo-qt-converted', number: 'QT-DEMO-C1', status: 'converted',
    customerId: 'demo-customer-aarav', customerName: 'Aarav Distributors', validDays: 20,
    items: [item({ id: 'i1', ...FLOUR, quantity: 75 })],
  }),
]

// Thin compatibility adapter - derived from the quotation objects above, not the
// other way round. Components that still read getQuotationMeta()-style data get it here.
export const demoQuotationMeta = demoQuotations.reduce((map, q) => {
  if (q.leadId) {
    map[q.id] = {
      leadId: q.leadId,
      leadName: q.lead?.name || '',
      leadStatus: q.lead?.leadStatus || '',
      convertedCustomerId: q.customerId && q.leadId ? q.customerId : '',
    }
  }
  return map
}, {})

// Local overrides for demo quotations (status flips from Edit & Resend / Send).
// Versioned key so a rebuild never inherits stale rows; old key cleaned up once.
const OVERRIDE_KEY = 'saas.quotationDemoOverride.v2'
try {
  window.localStorage.removeItem('saas.quotationDemoOverride')
} catch {
  /* storage disabled */
}

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
