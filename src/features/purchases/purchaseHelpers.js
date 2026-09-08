// =============================================================================
// Purchase module - single source of truth for status/action derivation.
// -----------------------------------------------------------------------------
// Canonical backend contract:
//   - `status` is the backend-managed lifecycle: draft -> confirmed -> closed, or -> cancelled
//     (POST /purchases, POST .../confirm, POST .../close, POST .../cancel, DELETE).
//     Purchase create / confirm / close / cancel move NO stock.
//   - `receiving_status` (not_received | partially_received | fully_received) is INDEPENDENT of
//     `status` and is rolled up by the backend from CONFIRMED GRNs only. The frontend never
//     sets it and never synthesizes it.
//   - `payment_status` (unpaid | partial | paid) is separate again, changed via PATCH
//     .../payment-status. It never drives Purchase status.
//   - Purchase items carry backend-controlled received_qty / remaining_qty.
//   - Physical stock inward happens only on GRN confirm (POST /grns/{id}/confirm).
// This file derives one truthful Purchase Status / Receiving Status / Payment Status +
// state-driven action keys from whatever the backend returns.
// =============================================================================

// A Draft purchase is commercially editable via PATCH /purchases/{id}. Once confirmed there is
// no normal commercial editing. Only these fields are sent on update.
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
  not_received: { key: 'not_received', label: 'Not Received', variant: 'neutral' },
  partially_received: { key: 'partially_received', label: 'Partially Received', variant: 'warning' },
  fully_received: { key: 'fully_received', label: 'Fully Received', variant: 'success' },
  // Tolerate legacy / stale free-text values from older records.
  pending: { key: 'not_received', label: 'Not Received', variant: 'neutral' },
  partial: { key: 'partially_received', label: 'Partially Received', variant: 'warning' },
  completed: { key: 'fully_received', label: 'Fully Received', variant: 'success' },
}

export const PURCHASE_RECEIVING_FILTER_OPTIONS = [
  { value: 'all', label: 'All Receiving' },
  { value: 'not_received', label: 'Not Received' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'fully_received', label: 'Fully Received' },
]

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
  return RECEIVING_STATUS_MAP[raw] || RECEIVING_STATUS_MAP.not_received
}

export function derivePaymentStatus(purchase) {
  const raw = String(purchase?.paymentStatus || '').toLowerCase()
  return PAYMENT_STATUS_MAP[raw] || PAYMENT_STATUS_MAP.unpaid
}

// PURCHASE STATUS - straight from the canonical backend `status` (draft | confirmed | closed |
// cancelled). Never synthesized from receiving/payment values; `closed` is a real backend state.
// Legacy `pending`/`approved` responses (older records) are normalized safely.
export function derivePurchaseStatus(purchase) {
  const status = String(purchase?.status || 'draft').toLowerCase()
  if (PURCHASE_STATUS_META[status]) return PURCHASE_STATUS_META[status]
  if (status === 'pending') return PURCHASE_STATUS_META.draft
  if (status === 'approved') return PURCHASE_STATUS_META.confirmed
  return PURCHASE_STATUS_META.draft
}

// True when any goods have been received - used to gate Cancel (backend also blocks it).
export function purchaseHasReceipts(purchase) {
  const total = safeNumber(purchase?.receivedQty)
  if (total > 0) return true
  return (Array.isArray(purchase?.items) ? purchase.items : []).some((item) => safeNumber(item?.receivedQty) > 0)
}

// State-driven action keys - the single source for List row menus + Detail header buttons.
//   draft                       -> edit, confirm, cancel, delete
//   confirmed + not fully recv  -> createGrn, cancel (only if nothing received yet)
//   confirmed + fully received  -> close
//   closed / cancelled          -> read-only
// recordPayment is available whenever the purchase is not cancelled (payment is independent).
export function getPurchaseActions(purchase) {
  if (!purchase) return []
  const status = derivePurchaseStatus(purchase).key
  const receiving = deriveReceivingStatus(purchase).key
  const hasReceipts = purchaseHasReceipts(purchase)
  const actions = []

  if (status === 'draft') {
    actions.push('edit', 'confirm', 'cancel', 'delete')
  } else if (status === 'confirmed') {
    if (receiving !== 'fully_received') actions.push('createGrn')
    if (receiving === 'fully_received') actions.push('close')
    if (!hasReceipts) actions.push('cancel')
    actions.push('return')
  }
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
