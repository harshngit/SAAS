// Shared formatting/eligibility helpers used by both the org Tickets UI and the Platform
// Support Tickets UI - one place for status/priority vocabulary so the two sides never drift.

export const TICKET_STATUS_VARIANT = {
  open: 'info',
  in_progress: 'warning',
  waiting_on_customer: 'purple',
  resolved: 'success',
  closed: 'neutral',
}

export const TICKET_PRIORITY_VARIANT = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  // "Waiting on Customer" reads correctly from both sides - the org user is the customer here,
  // and platform staff read it exactly as their own vocabulary.
  waiting_on_customer: 'Waiting on Customer',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

const CATEGORY_LABELS = {
  bug: 'Bug',
  billing: 'Billing',
  feature_request: 'Feature Request',
  how_to: 'How To',
  other: 'Other',
}

export function ticketStatusLabel(status) {
  return STATUS_LABELS[status] || status || 'Open'
}
export function ticketPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority || 'Medium'
}
export function ticketCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category || 'Other'
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// A resolved/closed ticket can only be reopened (by replying, or the explicit Reopen action)
// within 7 days of whichever happened - matches the backend's own reopen-window rule so the
// frontend never shows a Reopen control the backend would just 409 on.
export function isWithinReopenWindow(ticket) {
  const anchor = ticket?.status === 'closed' ? ticket?.closedAt : ticket?.resolvedAt
  if (!anchor) return false
  return Date.now() - new Date(anchor).getTime() <= SEVEN_DAYS_MS
}

export function canReply(ticket) {
  if (!ticket) return false
  if (ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'waiting_on_customer') return true
  // resolved/closed: the backend accepts the reply (and reopens) only inside the 7-day window.
  return isWithinReopenWindow(ticket)
}
