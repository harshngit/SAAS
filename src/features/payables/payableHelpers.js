// =============================================================================
// Accounts Payable - shared frontend helpers (demo simulation only).
// -----------------------------------------------------------------------------
// Accounts Payable is a DERIVED, READ-ONLY view over Supplier Invoices: "how much
// do we still owe each supplier?". The real API lives in src/api/accountsPayable.js
// (GET /accounts-payable, /summary, /supplier/{id}) and is authoritative for
// overdue / days_overdue / ageing_bucket / every money total.
//   - real mode  -> `/accounts-payable` APIs (read-only; no create/edit/delete)
//   - demo mode  -> full local simulation (payableDemoData.js), never an API call
//
// The maths below (ageingBucket / dueCondition / daysOverdue) is used ONLY by the
// demo path to model what the backend returns. Real rows carry those fields ready-made.
// There is no AccountsPayable mutation and no "pay via AP" endpoint - Supplier
// Payment is a separate downstream module.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'

const DAY_MS = 86400000
const DUE_SOON_DAYS = 7

export const AGEING_META = {
  current: { key: 'current', label: 'Current', variant: 'neutral' },
  '1_30': { key: '1_30', label: '1–30 Days', variant: 'warning' },
  '31_60': { key: '31_60', label: '31–60 Days', variant: 'warning' },
  '61_90': { key: '61_90', label: '61–90 Days', variant: 'danger' },
  '90_plus': { key: '90_plus', label: '90+ Days', variant: 'danger' },
}

export const AGEING_FILTER_OPTIONS = [
  { value: 'all', label: 'All Ageing' },
  { value: 'current', label: 'Current' },
  { value: '1_30', label: '1–30 Days' },
  { value: '31_60', label: '31–60 Days' },
  { value: '61_90', label: '61–90 Days' },
  { value: '90_plus', label: '90+ Days' },
]

export const DUE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Due' },
  { value: 'due_soon', label: 'Due Soon' },
  { value: 'overdue', label: 'Overdue' },
]

export function daysOverdue(dueDate, now = Date.now()) {
  if (!dueDate) return 0
  const due = new Date(dueDate).getTime()
  if (Number.isNaN(due)) return 0
  const diff = Math.floor((now - due) / DAY_MS)
  return diff > 0 ? diff : 0
}

// Ageing bucket for an outstanding balance. Returns null for anything with nothing
// outstanding - a paid invoice is not an ageing row.
export function ageingBucket(dueDate, outstanding, now = Date.now()) {
  if (safeNumber(outstanding) <= 0) return null
  const overdue = daysOverdue(dueDate, now)
  if (overdue <= 0) return AGEING_META.current
  if (overdue <= 30) return AGEING_META['1_30']
  if (overdue <= 60) return AGEING_META['31_60']
  if (overdue <= 90) return AGEING_META['61_90']
  return AGEING_META['90_plus']
}

// Due-date condition, kept SEPARATE from payment status. Null when nothing is
// outstanding (a paid invoice is never "Due Soon" or "Overdue") or no due date.
export function dueCondition(dueDate, outstanding, now = Date.now()) {
  if (safeNumber(outstanding) <= 0 || !dueDate) return null
  const due = new Date(dueDate).getTime()
  if (Number.isNaN(due)) return null
  if (due < now) return { key: 'overdue', label: 'Overdue', variant: 'danger' }
  if (due - now <= DUE_SOON_DAYS * DAY_MS) return { key: 'due_soon', label: 'Due Soon', variant: 'warning' }
  return null
}

export function isSameMonth(dateValue, now = new Date()) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

// Record Payment validation (task section 10). Overpayment is rejected outright.
export function validatePayablePayment(amountRaw, outstanding, { paymentDate, paymentMode } = {}) {
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than 0.'
  if (amount > safeNumber(outstanding)) {
    return `Amount cannot exceed the outstanding balance (₹${safeNumber(outstanding).toLocaleString('en-IN')}).`
  }
  if (paymentDate !== undefined && !paymentDate) return 'Payment date is required.'
  if (paymentMode !== undefined && !paymentMode) return 'Payment mode is required.'
  return ''
}

export const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export const PAYABLE_SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'outstanding', label: 'Highest Outstanding' },
  { value: 'dueDate', label: 'Due Date' },
]

export const REAL_MODE_NOTE = 'Supplier payment posting will be available once payment integration is enabled.'
