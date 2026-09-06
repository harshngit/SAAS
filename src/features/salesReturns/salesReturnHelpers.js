// Single source of truth for how a Sales Return reads in the UI.
//
// Backend `SalesReturnOut.status`: requested | received | approved | rejected. The backend
// flow is request -> receive -> approve (approve is terminal: it restocks the saleable goods
// and raises the credit note). There is NO separate "completed" step and NO stand-alone
// "approved, awaiting receipt" state - approve IS the completion. The UI vocabulary is
// normalized here at the boundary; nothing downstream maps raw status values itself.
//
//   requested -> Pending    (awaiting review / goods not back yet)
//   received  -> Received   (goods physically in, condition recorded)
//   approved  -> Completed  (restock + credit note done - terminal)
//   rejected  -> Rejected   (declined - terminal)

const STATUS_META = {
  requested: { key: 'pending', label: 'Pending', variant: 'info' },
  received: { key: 'received', label: 'Received', variant: 'warning' },
  approved: { key: 'completed', label: 'Completed', variant: 'success' },
  rejected: { key: 'rejected', label: 'Rejected', variant: 'danger' },
}

const RAW_BY_UI_KEY = {
  pending: 'requested',
  received: 'received',
  completed: 'approved',
  rejected: 'rejected',
}

export function srStatusMeta(rawStatus) {
  const raw = String(rawStatus || 'requested').toLowerCase()
  return STATUS_META[raw] || { key: raw, label: raw.replace(/_/g, ' ') || 'Pending', variant: 'neutral' }
}

// For the list status filter: UI key -> the raw value GET /sales-returns?status= expects.
export function rawStatusForFilter(uiKey) {
  return RAW_BY_UI_KEY[uiKey] || null
}

export const SR_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

// Compact controlled reason list (spec §7). The picked label is sent as `return_reason`
// (backend free text, max 100). "Other" swaps in the typed detail.
export const RETURN_REASONS = [
  'Damaged Product',
  'Wrong Product',
  'Quality Issue',
  'Excess Quantity',
  'Customer Changed Mind',
  'Other',
]

export function totalReturnQty(salesReturn) {
  return (salesReturn?.items || []).reduce((sum, item) => sum + (Number(item.quantityReturned) || 0), 0)
}

export function totalReceivedQty(salesReturn) {
  return (salesReturn?.items || []).reduce((sum, item) => sum + (Number(item.receivedQuantity) || 0), 0)
}

// Restockable = what actually went back to sellable stock on approval (backend
// `restocked_quantity`), else the received qty of a saleable+restock line. Damaged = the rest.
export function itemRestockableQty(item) {
  if (item?.restockedQuantity != null) return Number(item.restockedQuantity) || 0
  const received = Number(item?.receivedQuantity) || 0
  const saleable = String(item?.condition || '').toLowerCase() === 'saleable'
  return saleable && item?.restock ? received : 0
}

export function itemDamagedQty(item) {
  const received = Number(item?.receivedQuantity) || 0
  return Math.max(received - itemRestockableQty(item), 0)
}

// The one next-step action key for the current status (admin-only actions).
export function srNextActions(rawStatus) {
  switch (srStatusMeta(rawStatus).key) {
    case 'pending':
      return ['receive', 'reject']
    case 'received':
      return ['complete', 'reject']
    default:
      return [] // completed / rejected -> read-only
  }
}

// Build a compact activity timeline from the record's timestamps. No fabricated persistence -
// every entry is derived from a real field the backend already returns.
export function buildReturnActivity(salesReturn) {
  if (!salesReturn) return []
  const events = [{ label: 'Return requested', at: salesReturn.createdAt || salesReturn.returnDate }]
  if (salesReturn.receivedAt) events.push({ label: 'Goods received', at: salesReturn.receivedAt })
  if (salesReturn.approvedAt) {
    events.push({
      label: salesReturn.creditNoteId ? 'Completed — restocked & credit note raised' : 'Completed — restocked',
      at: salesReturn.approvedAt,
    })
  }
  if (srStatusMeta(salesReturn.status).key === 'rejected') {
    events.push({ label: `Rejected${salesReturn.rejectedReason ? ` — ${salesReturn.rejectedReason}` : ''}`, at: salesReturn.updatedAt })
  }
  return events.filter((event) => event.at)
}
