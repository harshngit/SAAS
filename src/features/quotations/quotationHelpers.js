import { Ban, CheckCircle2, Clock, FileText, Send, ShoppingCart, Sparkles, UserPlus } from 'lucide-react'
import { dayDelta } from '../leads/leadActivity'

// =============================================================================
// Quotation frontend helpers
// -----------------------------------------------------------------------------
// Lead linkage is now a REAL backend field (`quotation.lead_id` / `quotation.lead`,
// crm_changes Phase 2) - the old `saas.quotationMeta` lead workaround is gone.
// `saas.quotationMeta` is retained ONLY for two display-only edit-flow flags
// (`updatedAfterSend`, `resent`) that the backend has no activity feed for yet.
// BACKEND LATER: a quotation activity/timeline endpoint would replace that too.
// The expiry *display* stays frontend-derived (backend never persists `expired`).
// =============================================================================

// The party a quotation is for - a lead (prospect) or a customer. Reads the real
// backend fields; a converted lead quotation carries BOTH lead_id (history) and
// customer_id, and is then treated as a customer quotation for actions.
export function quotationParty(quotation) {
  if (!quotation) return { type: 'customer', id: '', name: '' }
  if (quotation.customerId) {
    return { type: 'customer', id: quotation.customerId, name: quotation.customerName || quotation.lead?.name || 'Customer' }
  }
  if (quotation.leadId) {
    return { type: 'lead', id: quotation.leadId, name: quotation.leadName || quotation.lead?.name || 'Lead' }
  }
  return { type: 'customer', id: '', name: '' }
}

export const QUOTATION_STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted to Order',
}

export const QUOTATION_STATUS_VARIANT = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  converted: 'purple',
}

// The statuses a user can filter by (no `converted` - it's a terminal state, still
// rendered wherever it appears).
export const QUOTATION_FILTER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

export function formatQuotationStatus(status) {
  return QUOTATION_STATUS_LABEL[status] || String(status || '').replace(/\b\w/g, (c) => c.toUpperCase())
}

// -----------------------------------------------------------------------------
// Quotation meta (localStorage) - display-only edit-flow flags the backend has no
// activity feed for yet. Shape: { updatedAfterSend, resent }.
// The lead link is NO LONGER stored here - it's the real `quotation.lead_id`.
// BACKEND LATER: a quotation activity/timeline endpoint removes this entirely.
// -----------------------------------------------------------------------------
const META_KEY = 'saas.quotationMeta'

function readMeta() {
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY)) || {}
  } catch {
    return {}
  }
}

function writeMeta(map) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(map))
  } catch {
    /* private mode / disabled storage - meta just won't persist */
  }
}

export function getQuotationMeta(id) {
  if (!id) return null
  return readMeta()[id] || null
}

export function setQuotationMeta(id, meta) {
  if (!id) return
  const map = readMeta()
  map[id] = { ...meta }
  writeMeta(map)
}

export function patchQuotationMeta(id, partial) {
  if (!id) return
  const map = readMeta()
  map[id] = { ...(map[id] || {}), ...partial }
  writeMeta(map)
}

export function clearQuotationMeta(id) {
  if (!id) return
  const map = readMeta()
  delete map[id]
  writeMeta(map)
}

// -----------------------------------------------------------------------------
// Expiry (display only - never mutates the backend status)
// -----------------------------------------------------------------------------
export function describeExpiry(validUntil) {
  const delta = dayDelta(validUntil)
  if (delta === null) return { label: '', tone: 'muted', overdue: false }
  if (delta < 0) return { label: `Expired ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} ago`, tone: 'danger', overdue: true }
  if (delta === 0) return { label: 'Expires today', tone: 'warning', overdue: false }
  if (delta <= 3) return { label: `Expires in ${delta} day${delta === 1 ? '' : 's'}`, tone: 'warning', overdue: false }
  return { label: '', tone: 'muted', overdue: false }
}

// The status to SHOW: real status, except a still-open quote past its valid-until
// date reads as Expired (spec: not for accepted/rejected/converted).
export function deriveQuotationStatus(quotation) {
  if (!quotation) return 'draft'
  const status = quotation.status
  if ((status === 'sent' || status === 'draft') && quotation.validUntil && dayDelta(quotation.validUntil) < 0) {
    return 'expired'
  }
  return status
}

// -----------------------------------------------------------------------------
// State-driven action list - the single source for Detail buttons + List menu.
// Simple edit flow: the SAME quotation can be edited & re-sent until it is
// Accepted (then it's locked - use Duplicate for a new one). No revisions.
// Action keys: edit | editResend | send | accept | reject | download | delete |
//              convertToOrder | convertToCustomer | viewCustomer | viewOrder | duplicate
// -----------------------------------------------------------------------------
export function getQuotationActions(quotation) {
  if (!quotation) return []
  const status = deriveQuotationStatus(quotation)
  const hasCustomer = Boolean(quotation.customerId)
  const hasLead = Boolean(quotation.leadId)

  switch (status) {
    case 'draft':
      return ['edit', 'send', 'download', 'delete']
    case 'sent':
      return ['edit', 'accept', 'reject', 'download']
    case 'accepted': {
      if (hasCustomer) {
        // A lead quotation that has since gained a customer_id shows "View Customer" too.
        const acts = ['convertToOrder', 'download', 'duplicate']
        if (hasLead) acts.unshift('viewCustomer')
        return acts
      }
      if (hasLead) return ['convertToCustomer', 'download', 'duplicate']
      return ['download', 'duplicate']
    }
    case 'rejected':
      return ['editResend', 'download', 'duplicate']
    case 'expired':
      return ['editResend', 'download', 'duplicate']
    case 'converted':
      return ['viewOrder', 'download', 'duplicate']
    default:
      return ['download']
  }
}

// Which statuses can still be opened in the edit form.
export function canEditQuotation(quotation) {
  return ['draft', 'sent', 'rejected', 'expired'].includes(deriveQuotationStatus(quotation))
}

// -----------------------------------------------------------------------------
// Quantity step by UOM - whole numbers for countable units, decimals for
// weight/volume/length.
// -----------------------------------------------------------------------------
const DECIMAL_UOMS = new Set([
  'kg', 'g', 'gram', 'grams', 'kilogram', 'kgs', 'ltr', 'l', 'litre', 'liter', 'litres',
  'ml', 'mtr', 'm', 'metre', 'meter', 'metres', 'ton', 'tonne', 'quintal', 'cm', 'ft', 'inch',
])

export function quantityStepForUom(uom) {
  return DECIMAL_UOMS.has(String(uom || '').toLowerCase().trim()) ? 0.001 : 1
}

export function isDecimalUom(uom) {
  return quantityStepForUom(uom) !== 1
}

// -----------------------------------------------------------------------------
// Soft price / discount warnings (display only - never blocks saving)
// -----------------------------------------------------------------------------
export function priceWarnings(item, product) {
  const price = Number(item?.unitPrice)
  const base = Number(product?.price)
  const discount = Number(item?.discount) || 0
  return {
    lowPrice: Boolean(base > 0 && price > 0 && price < base * 0.8),
    highDiscount: discount >= 25,
  }
}

// -----------------------------------------------------------------------------
// Totals breakdown from line items (Subtotal / Discount / Tax / Grand Total)
// -----------------------------------------------------------------------------
// One line's discount as { percent, amount }. Real quotations carry discountPercent (% off) or discountAmount (rupees off);
// demo rows only have `discount` in %. Percent wins when both are present.
export function lineDiscount(item) {
  const gross = (Number(item?.quantity) || 0) * (Number(item?.unitPrice ?? item?.unit_price) || 0)
  const percent = Number(item?.discountPercent) || 0
  const amount = Number(item?.discountAmount) || 0
  if (percent > 0) return { percent, amount: gross * (percent / 100) }
  if (amount > 0) return { percent: gross > 0 ? (amount / gross) * 100 : 0, amount }
  const legacy = Number(item?.discount) || 0
  return { percent: legacy, amount: gross * (legacy / 100) }
}

// The quotation backend rounds each amount to the paisa with a plain round(x, 2) on the stored number: 4.515 is stored as
// 4.51499... so it becomes 4.51, 0.505 (stored as 0.50500...) becomes 0.51, 1.845 becomes 1.84. toFixed(2) rounds the stored
// number the same way; the half-up helper in gstCalc would say 4.52 / 0.51 / 1.85.
const round2 = (value) => Number((Number(value) || 0).toFixed(2))

// Same per-line rounding as the backend (and the purchase form): the line, then its discount, then the tax on what is
// left are each rounded to the paisa, then added up. 450.55 x 2, 10.25 %, 5 % tax -> 901.10 - 92.36 = 808.74, tax 40.44, 849.18.
export function quotationTotals(items = []) {
  let subtotal = 0
  let discount = 0
  let tax = 0
  items.forEach((item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice ?? item.unit_price) || 0
    const rate = Number(item.taxRate ?? item.tax_rate) || 0
    const gross = round2(qty * price)
    const discAmt = round2(lineDiscount(item).amount)
    const net = round2(gross - discAmt)
    subtotal += gross
    discount += discAmt
    tax += round2((net * rate) / 100)
  })
  subtotal = round2(subtotal)
  discount = round2(discount)
  tax = round2(tax)
  return { subtotal, discount, tax, grandTotal: round2(subtotal - discount + tax) }
}

// The form's pricing with the same per-line rounding: one quotation-level discount (a % or a rupee amount) is applied
// line by line - a % per line, a rupee amount split over the lines in proportion (the last line takes the remainder) -
// then each line is rounded to the paisa and its tax is charged on what is left.
export function priceQuotationLines(items = [], discountType = 'percentage', discountValue = 0) {
  const lines = items.map((item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return { qty, rate: Number(item.taxRate) || 0, gross: round2(qty * price) }
  })
  const subtotal = round2(lines.reduce((sum, line) => sum + line.gross, 0))
  let discounts
  if (discountType === 'percentage') {
    const percent = Math.min(Math.max(round2(Number(discountValue) || 0), 0), 100)
    discounts = lines.map((line) => round2((line.gross * percent) / 100))
  } else {
    const total = round2(Math.min(Math.max(Number(discountValue) || 0, 0), subtotal))
    let lastIndex = -1
    lines.forEach((line, index) => { if (line.gross > 0) lastIndex = index })
    let allocated = 0
    discounts = lines.map((line, index) => {
      if (line.gross <= 0) return 0
      const share = index === lastIndex ? round2(total - allocated) : round2(subtotal > 0 ? (total * line.gross) / subtotal : 0)
      if (index !== lastIndex) allocated += share
      return share
    })
  }
  const priced = lines.map((line, index) => {
    const discount = Math.min(discounts[index], line.gross)
    const net = round2(line.gross - discount)
    return { ...line, discount, net, tax: round2((net * line.rate) / 100) }
  })
  const discountAmount = round2(priced.reduce((sum, line) => sum + line.discount, 0))
  const tax = round2(priced.reduce((sum, line) => sum + line.tax, 0))
  const net = round2(priced.reduce((sum, line) => sum + line.net, 0))
  return { lines: priced, subtotal, discountAmount, tax, grandTotal: round2(net + tax), totalQuantity: lines.reduce((sum, line) => sum + line.qty, 0) }
}

// -----------------------------------------------------------------------------
// Compact activity timeline (derived from status + timestamps + meta)
// -----------------------------------------------------------------------------
export function buildQuotationTimeline(quotation, meta) {
  if (!quotation) return []
  const events = []
  const stamp = quotation.updatedAt || quotation.createdAt
  const status = quotation.status

  events.push({
    id: 'created',
    icon: FileText,
    iconClass: 'bg-primary-50 text-primary-700',
    title: 'Quotation created',
    subtitle: quotation.quotationNumber,
    timestamp: quotation.createdAt,
  })

  if (quotation.leadId) {
    events.push({
      id: 'lead',
      icon: Sparkles,
      iconClass: 'bg-blue-50 text-blue-600',
      title: quotation.leadName ? `Linked to lead: ${quotation.leadName}` : 'Linked to a lead',
      subtitle: 'Quotation raised for a prospect',
      timestamp: quotation.createdAt,
    })
  }

  const wasSent = ['sent', 'accepted', 'rejected', 'converted'].includes(status) || meta?.updatedAfterSend
  if (wasSent) {
    events.push({ id: 'sent', icon: Send, iconClass: 'bg-indigo-50 text-indigo-600', title: 'Quotation sent', subtitle: 'Shared with the customer', timestamp: stamp })
  }
  if (meta?.updatedAfterSend) {
    events.push({ id: 'updated', icon: FileText, iconClass: 'bg-amber-50 text-amber-600', title: 'Quotation updated', subtitle: 'Edited after being sent', timestamp: stamp })
  }
  if (meta?.resent) {
    events.push({ id: 'resent', icon: Send, iconClass: 'bg-indigo-50 text-indigo-600', title: 'Quotation sent again', subtitle: 'Re-shared after changes', timestamp: stamp })
  }
  if (status === 'accepted' || status === 'converted') {
    events.push({ id: 'accepted', icon: CheckCircle2, iconClass: 'bg-green-50 text-green-600', title: 'Quotation accepted', subtitle: 'The customer accepted this quote', timestamp: stamp })
  }
  if (status === 'rejected') {
    events.push({ id: 'rejected', icon: Ban, iconClass: 'bg-red-50 text-red-600', title: 'Quotation rejected', subtitle: 'The customer declined', timestamp: stamp })
  }
  if (deriveQuotationStatus(quotation) === 'expired' && status !== 'converted') {
    events.push({ id: 'expired', icon: Clock, iconClass: 'bg-amber-50 text-amber-600', title: 'Quotation expired', subtitle: 'Past its valid-until date', timestamp: quotation.validUntil })
  }
  if (quotation.leadId && quotation.customerId) {
    events.push({ id: 'customer', icon: UserPlus, iconClass: 'bg-green-50 text-green-600', title: 'Lead converted to Customer', subtitle: 'The linked lead became a customer and was attached to this quotation', timestamp: stamp })
  }
  if (status === 'converted' || quotation.convertedOrderId) {
    events.push({ id: 'order', icon: ShoppingCart, iconClass: 'bg-green-50 text-green-600', title: 'Converted to Order', subtitle: 'A sales order was created from this quotation', timestamp: quotation.convertedAt || stamp })
  }

  return events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
}

// -----------------------------------------------------------------------------
// Source quote -> form data. Used by Duplicate (fresh draft) and Edit (pre-fill).
// Keeps entity, items, terms, addresses, pricing; the caller decides number /
// status / dates.
// -----------------------------------------------------------------------------
export function quotationToDraftForm(source) {
  return {
    customerId: source.customerId || '',
    leadId: source.leadId || '',
    billingAddress: source.billingAddress || '',
    shippingAddress: source.shippingAddress || '',
    salespersonId: source.salespersonId || '',
    currency: source.currency || 'INR',
    paymentTerms: source.paymentTerms || '',
    deliveryTerms: source.deliveryTerms || '',
    notes: source.notes || '',
    termsConditions: source.termsConditions || '',
    items: (source.items || []).map((item) => ({
      productId: item.productId || '',
      variantId: item.variantId || '',
      productName: item.productName || '',
      sku: item.sku || '',
      uom: item.uom || '',
      quantity: String(item.quantity ?? ''),
      unitPrice: String(item.unitPrice ?? ''),
      discount: String(item.discount ?? ''),
      discountPercent: String(item.discountPercent ?? ''),
      discountAmount: String(item.discountAmount ?? ''),
      taxRate: String(item.taxRate ?? ''),
    })),
  }
}
