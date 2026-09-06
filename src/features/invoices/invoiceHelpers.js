// One source of truth for how a Sales Invoice's financial state is shown, and for the
// receivable date maths used across the Invoices list, Invoice Detail and Receivables.
// Nothing here calls an API - it only derives display state from the normalized invoice
// (see api/invoices.js normalizeInvoice: total / amountPaid / outstandingAmount / dueDate /
// paymentStatus / invoiceStatus / isCreditNote).

const DAY_MS = 86_400_000
const DUE_SOON_DAYS = 7

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isInvoiceCancelled(invoice) {
  return String(invoice?.invoiceStatus || '').toLowerCase() === 'cancelled'
}

export function isInvoicePaid(invoice) {
  return (
    String(invoice?.paymentStatus || '').toLowerCase() === 'paid' ||
    (Number(invoice?.total) > 0 && Number(invoice?.outstandingAmount) <= 0)
  )
}

// §19 - overdue = due date passed AND still owed. Paid / cancelled invoices are never overdue.
export function isInvoiceOverdue(invoice) {
  if (!invoice || isInvoiceCancelled(invoice) || isInvoicePaid(invoice)) return false
  const due = parseDate(invoice.dueDate)
  return Boolean(due && due < startOfToday() && Number(invoice.outstandingAmount) > 0)
}

// §18 - due soon = falls due within the next 7 days AND still owed. Not already overdue.
export function isInvoiceDueSoon(invoice) {
  if (!invoice || isInvoiceCancelled(invoice) || isInvoicePaid(invoice) || isInvoiceOverdue(invoice)) return false
  const due = parseDate(invoice.dueDate)
  if (!due || Number(invoice.outstandingAmount) <= 0) return false
  const days = Math.ceil((due - startOfToday()) / DAY_MS)
  return days >= 0 && days <= DUE_SOON_DAYS
}

// §5 - user-facing financial status. Overdue is DERIVED, never a stored value.
export function financialStatus(invoice) {
  if (!invoice) return 'Unpaid'
  if (isInvoiceCancelled(invoice)) return 'Cancelled'
  if (isInvoicePaid(invoice)) return 'Paid'
  if (isInvoiceOverdue(invoice)) return 'Overdue'
  const paid = Number(invoice.amountPaid) || 0
  return paid > 0 ? 'Partially Paid' : 'Unpaid'
}

export const FINANCIAL_STATUS_VARIANT = {
  Paid: 'success',
  'Partially Paid': 'warning',
  Unpaid: 'danger',
  Overdue: 'danger',
  Cancelled: 'neutral',
}

export const INVOICE_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Partially Paid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Overdue', label: 'Overdue' },
]

// §17 - aging buckets for display only (never persisted).
export const AGING_BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+']

export function agingBucket(invoice) {
  if (!invoice || Number(invoice.outstandingAmount) <= 0) return 'Current'
  const due = parseDate(invoice.dueDate)
  if (!due) return 'Current'
  const daysOverdue = Math.floor((startOfToday() - due) / DAY_MS)
  if (daysOverdue <= 0) return 'Current'
  if (daysOverdue <= 30) return '1–30'
  if (daysOverdue <= 60) return '31–60'
  if (daysOverdue <= 90) return '61–90'
  return '90+'
}

export function daysOverdue(invoice) {
  const due = parseDate(invoice?.dueDate)
  if (!due) return 0
  return Math.max(0, Math.floor((startOfToday() - due) / DAY_MS))
}

// An invoice that still contributes to receivables: owed money, not a credit note, not cancelled.
export function isOpenReceivable(invoice) {
  return (
    invoice &&
    !invoice.isCreditNote &&
    !isInvoiceCancelled(invoice) &&
    Number(invoice.outstandingAmount) > 0
  )
}
