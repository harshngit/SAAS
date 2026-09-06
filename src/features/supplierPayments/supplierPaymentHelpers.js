// =============================================================================
// Supplier Payments - frontend structure only.
// -----------------------------------------------------------------------------
// Supplier Payments is PAYMENT HISTORY: when, how much, and against which
// invoice(s) a supplier was paid. Accounts Payable answers "how much is still
// owed"; this module answers "how much was actually paid".
//
// There is NO SupplierPayment / SupplierPaymentAllocation backend today, so:
//   - demo mode  -> full local simulation (supplierPaymentDemoData.js), which is
//                   the single canonical demo payment ledger (Accounts Payable
//                   calls the same helpers)
//   - real mode  -> truthful future-state, Record Payment disabled, no writes
//
// BACKEND LATER (nothing below is live) - see the module report.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'

export const PAYMENT_STATUS_META = {
  recorded: { key: 'recorded', label: 'Recorded', variant: 'success' },
  voided: { key: 'voided', label: 'Voided', variant: 'neutral' },
}

export function paymentStatusMeta(key) {
  return PAYMENT_STATUS_META[String(key || '').toLowerCase()] || PAYMENT_STATUS_META.recorded
}

export const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export function paymentModeLabel(value) {
  return PAYMENT_MODE_OPTIONS.find((option) => option.value === value)?.label || value || '—'
}

export const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'voided', label: 'Voided' },
]

export const PAYMENT_DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'Any Date' },
  { value: 'this_month', label: 'This Month' },
  { value: 'recent', label: 'Last 30 Days' },
]

export const PAYMENT_SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'amount', label: 'Highest Amount' },
]

const DAY_MS = 86400000

export function isSameMonth(dateValue, now = new Date()) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function isWithinDays(dateValue, days, now = Date.now()) {
  if (!dateValue) return false
  const date = new Date(dateValue).getTime()
  if (Number.isNaN(date)) return false
  return now - date <= days * DAY_MS && date <= now
}

// Greedy "oldest due first" allocation of a payment amount across outstanding invoices.
// Never over-allocates a line beyond its outstanding, never allocates more than the amount.
export function autoAllocate(paymentAmount, invoices) {
  let remaining = Math.max(safeNumber(paymentAmount), 0)
  const ordered = [...(invoices || [])].sort(
    (a, b) => new Date(a.dueDate || a.invoiceDate || 0).getTime() - new Date(b.dueDate || b.invoiceDate || 0).getTime(),
  )
  const allocations = {}
  ordered.forEach((invoice) => {
    const take = Math.min(remaining, Math.max(safeNumber(invoice.outstanding), 0))
    allocations[invoice.id] = take > 0 ? String(take) : '0'
    remaining -= take
  })
  return allocations
}

// Validation for the Record Payment drawer (task section 10). This phase requires the whole
// payment to be allocated - no supplier advances / unallocated credit yet.
export function validateSupplierPayment({ supplierId, paymentDate, paymentMode, paymentAmount, allocations, invoices }) {
  if (!supplierId) return 'Select a supplier.'
  if (!paymentDate) return 'Payment date is required.'
  if (!paymentMode) return 'Payment mode is required.'
  const amount = Number(paymentAmount)
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a payment amount greater than 0.'

  let allocated = 0
  for (const invoice of invoices || []) {
    const value = Number(allocations?.[invoice.id] ?? 0)
    if (!Number.isFinite(value) || value < 0) return `${invoice.supplierInvoiceNumber}: allocation cannot be negative.`
    if (value > safeNumber(invoice.outstanding) + 0.001) {
      return `${invoice.supplierInvoiceNumber}: allocation cannot exceed its outstanding (₹${safeNumber(invoice.outstanding).toLocaleString('en-IN')}).`
    }
    allocated += value
  }
  if (allocated > amount + 0.001) return 'Allocated amount cannot exceed the payment amount.'
  if (Math.abs(amount - allocated) > 0.001) return 'Allocate the full payment amount before recording (Remaining Unallocated must be 0).'
  return ''
}

export const REAL_MODE_NOTE = 'Supplier payment posting will be available once payment integration is enabled.'
