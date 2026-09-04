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
export function quotationTotals(items = []) {
  let subtotal = 0
  let discount = 0
  let tax = 0
  items.forEach((item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice ?? item.unit_price) || 0
    const disc = Number(item.discount) || 0
    const rate = Number(item.taxRate ?? item.tax_rate) || 0
    const gross = qty * price
    const discAmt = gross * (disc / 100)
    const net = gross - discAmt
    subtotal += gross
    discount += discAmt
    tax += net * (rate / 100)
  })
  return { subtotal, discount, tax, grandTotal: subtotal - discount + tax }
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
      taxRate: String(item.taxRate ?? ''),
    })),
  }
}
