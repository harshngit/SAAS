// =============================================================================
// Purchase module - single source of truth for status/action derivation.
// -----------------------------------------------------------------------------
// Backend reality (verified against scripts/openapi.json - PurchaseCreate / PurchaseUpdate /
// PurchaseOut):
//   - `status` is the REAL backend-managed lifecycle field: pending -> approved -> cancelled
//     (via POST create, PATCH .../approve, PATCH .../cancel). Approve currently also adds stock
//     and bumps the supplier's total_purchases - see PHASE 17 / BACKEND LATER notes below.
//   - `purchase_status`, `receiving_status` are OPTIONAL free-text fields the backend stores but
//     never transitions itself (no GRN/receiving endpoint exists) - they only ever change if a
//     future PurchaseUpdate call sets them, which the current PurchaseUpdate schema does not
//     even accept post-creation (PurchaseUpdate only accepts invoice_number/invoice_date/
//     discount/tax/notes/attachment_url/items - warehouse/purchase_type/purchase_date/
//     financial_year/purchase_status/billing_address/receiving_status/approval_status can only
//     be set at CREATE time, never edited afterwards today).
//   - `payment_status` is unpaid|partial|paid, changed via PATCH .../payment-status.
// This file derives one truthful Purchase Status / Receiving Status / Payment Status from
// whatever the backend actually returns, instead of scattering `status === 'pending'` checks
// across every screen.
// =============================================================================

// Fields the current PurchaseUpdate (PATCH/PUT) schema actually accepts. Anything else set at
// creation (supplier, purchase type, warehouse, purchase date, financial year, billing address,
// receiving/approval status) cannot be changed via update today - the Edit page shows those as
// read-only rather than silently dropping a change the backend would ignore.
export const PURCHASE_EDITABLE_ON_UPDATE = ['invoiceNumber', 'invoiceDate', 'discount', 'tax', 'notes', 'attachmentUrl', 'items']

export const PURCHASE_TYPE_OPTIONS = [
  { value: 'Purchase Order', label: 'Purchase Order' },
  { value: 'Direct Purchase', label: 'Direct Purchase' },
  { value: 'Service Purchase', label: 'Service Purchase' },
  { value: 'Asset Purchase', label: 'Asset Purchase' },
]

const PURCHASE_STATUS_META = {
  draft: { key: 'draft', label: 'Draft', variant: 'neutral' },
  confirmed: { key: 'confirmed', label: 'Confirmed', variant: 'info' },
  closed: { key: 'closed', label: 'Closed', variant: 'success' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'danger' },
}

const RECEIVING_STATUS_MAP = {
  pending: { key: 'not_received', label: 'Not Received', variant: 'neutral' },
  partial: { key: 'partially_received', label: 'Partially Received', variant: 'warning' },
  completed: { key: 'fully_received', label: 'Fully Received', variant: 'success' },
}

const PAYMENT_STATUS_MAP = {
  unpaid: { key: 'unpaid', label: 'Unpaid', variant: 'danger' },
  partial: { key: 'partial', label: 'Partially Paid', variant: 'warning' },
  paid: { key: 'paid', label: 'Paid', variant: 'success' },
}

// Safe numeric coercion - never lets NaN/undefined/Infinity reach a formatCurrency() call.
export function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

// Outstanding Payable: prefer the backend's own value when it is a finite number (real API
// purchases already compute this in normalizePurchase). Otherwise derive it safely from
// total - amountPaid (demo records, or any record missing the field), clamped to >= 0 so a
// rendered value is never NaN/undefined/Infinity.
export function derivePurchaseOutstanding(purchase) {
  const backend = Number(purchase?.outstandingAmount)
  if (Number.isFinite(backend)) return Math.max(backend, 0)
  const total = safeNumber(purchase?.total)
  const amountPaid = safeNumber(purchase?.amountPaid)
  return Math.max(total - amountPaid, 0)
}

// Tax: prefer the backend's own value when it is a finite number. Otherwise derive it from the
// item lines (same net*rate formula the Create/Edit form itself uses to build taxTotal), so a
// purchase saved without an aggregate tax field (e.g. an older demo record) still shows a real
// number instead of NaN/undefined. Falls back to 0 when neither is available.
export function derivePurchaseTax(purchase) {
  const backend = Number(purchase?.tax)
  if (Number.isFinite(backend)) return Math.max(backend, 0)
  const items = Array.isArray(purchase?.items) ? purchase.items : []
  const derived = items.reduce((sum, item) => {
    const quantity = safeNumber(item?.quantity)
    const price = safeNumber(item?.purchasePrice)
    const discount = safeNumber(item?.discount)
    const taxRate = safeNumber(item?.tax)
    const net = quantity * price * (1 - discount / 100)
    return sum + net * (taxRate / 100)
  }, 0)
  return Number.isFinite(derived) ? Math.max(derived, 0) : 0
}

// Payment status is DERIVED from the amount, never trusted from a manual dropdown that could
// contradict it (amount=0 selected as "Paid" would be an impossible state). Matches the backend's
// own unpaid|partial|paid vocabulary so the derived value can be sent straight to
// PATCH .../payment-status.
export function derivePaymentStatusFromAmount(amountPaid, grandTotal) {
  const paid = safeNumber(amountPaid)
  const total = safeNumber(grandTotal)
  if (paid <= 0) return 'unpaid'
  if (paid >= total) return 'paid'
  return 'partial'
}

// Aggregate purchase payment must satisfy 0 <= amountPaid <= grandTotal - overpayment (e.g.
// paying 100 against a 36 total) is rejected outright rather than silently clamped, so the user
// sees exactly why Save was blocked.
export function validatePurchasePaymentAmount(amountPaidRaw, grandTotal) {
  const amountPaid = Number(amountPaidRaw)
  if (!Number.isFinite(amountPaid)) return 'Enter a valid amount.'
  if (amountPaid < 0) return 'Amount paid cannot be negative.'
  const total = safeNumber(grandTotal)
  if (amountPaid > total) return `Amount paid cannot exceed the grand total (₹${total.toLocaleString('en-IN')}).`
  return ''
}

export function deriveReceivingStatus(purchase) {
  const raw = String(purchase?.receivingStatus || '').toLowerCase()
  return RECEIVING_STATUS_MAP[raw] || RECEIVING_STATUS_MAP.pending
}

export function derivePaymentStatus(purchase) {
  const raw = String(purchase?.paymentStatus || '').toLowerCase()
  return PAYMENT_STATUS_MAP[raw] || PAYMENT_STATUS_MAP.unpaid
}

// PURCHASE STATUS - derived from the real `status` field plus receiving/payment completeness.
// pending -> Draft. approved -> Confirmed, or Closed once both fully received AND fully paid
// (a purely frontend convenience label - the backend has no separate "closed" state).
// cancelled -> Cancelled.
export function derivePurchaseStatus(purchase) {
  const status = String(purchase?.status || '').toLowerCase()
  if (status === 'cancelled') return PURCHASE_STATUS_META.cancelled
  if (status !== 'approved') return PURCHASE_STATUS_META.draft
  const receiving = deriveReceivingStatus(purchase)
  const payment = derivePaymentStatus(purchase)
  if (receiving.key === 'fully_received' && payment.key === 'paid') return PURCHASE_STATUS_META.closed
  return PURCHASE_STATUS_META.confirmed
}

// State-driven action keys - the single source for List row menus + Detail header buttons.
// Mirrors the exact same gating the previous modal UI used (canEdit/canApprove/canCancel/
// canDelete/canReturn/canUpdatePayment), just consolidated: edit/confirm/delete only while
// pending (Draft); cancel/return only while approved; recordPayment any time it isn't cancelled.
export function getPurchaseActions(purchase) {
  if (!purchase) return []
  const status = String(purchase.status || '').toLowerCase()
  const actions = []
  if (status === 'pending') actions.push('edit', 'confirm', 'delete')
  if (status === 'approved') actions.push('cancel', 'return')
  if (status !== 'cancelled') actions.push('recordPayment')
  return actions
}

// Financial Year is never manually entered - derived read-only from the Purchase Date using the
// Indian April-March convention (backend has no derivation of its own; this is purely a display/
// prefill convenience, sent once at creation since PurchaseCreate accepts financial_year).
export function computeFinancialYear(dateValue) {
  const date = dateValue ? new Date(dateValue) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  const startYear = month >= 4 ? year : year - 1
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
  return `${startYear}-${endYearShort}`
}
