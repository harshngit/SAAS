// Single source of truth for how a Purchase Return reads in the UI.
//
// The backend has NO Purchase Return entity - only a thin fire-and-forget
// `POST /purchases/{id}/returns` (items + reason -> PurchaseOut, nothing tracked). So the
// lifecycle below is a FRONTEND model, fully exercised only in explicit demo mode. Real mode
// shows a truthful "not available yet" state - see PURCHASE_RETURN_BACKEND_LATER.
//
// Lifecycle:  draft -> confirmed -> dispatched -> completed   (+ cancelled)

const STATUS_META = {
  draft: { key: 'draft', label: 'Draft', variant: 'neutral' },
  confirmed: { key: 'confirmed', label: 'Confirmed', variant: 'info' },
  dispatched: { key: 'dispatched', label: 'Dispatched', variant: 'warning' },
  completed: { key: 'completed', label: 'Completed', variant: 'success' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'danger' },
}

// Legacy / alternative names normalized at this one boundary.
const ALIASES = {
  requested: 'draft',
  open: 'draft',
  approved: 'confirmed',
  in_transit: 'dispatched',
  sent: 'dispatched',
  closed: 'completed',
  done: 'completed',
  canceled: 'cancelled',
  void: 'cancelled',
}

export function prStatusMeta(rawStatus) {
  const raw = String(rawStatus || 'draft').toLowerCase()
  const key = ALIASES[raw] || raw
  return STATUS_META[key] || { key, label: raw.replace(/_/g, ' ') || 'Draft', variant: 'neutral' }
}

export const PR_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const RETURN_REASONS = [
  'Damaged Goods',
  'Wrong Product',
  'Quality Issue',
  'Excess Supply',
  'Expired / Near Expiry',
  'Other',
]

export function totalReturnQty(purchaseReturn) {
  return (purchaseReturn?.items || []).reduce((sum, item) => sum + (Number(item.returnQty ?? item.quantity) || 0), 0)
}

// The one next-step action(s) a user can take at the current status (each still permission-gated
// by the caller). Nothing is shown for terminal states.
export function prNextActions(rawStatus) {
  switch (prStatusMeta(rawStatus).key) {
    case 'draft':
      return ['edit', 'confirm', 'cancel']
    case 'confirmed':
      return ['dispatch', 'cancel']
    case 'dispatched':
      return ['complete']
    default:
      return [] // completed / cancelled -> read-only
  }
}

export function buildReturnActivity(purchaseReturn) {
  if (!purchaseReturn) return []
  const events = [{ label: 'Draft created', at: purchaseReturn.createdAt || purchaseReturn.returnDate }]
  if (purchaseReturn.confirmedAt) events.push({ label: 'Confirmed', at: purchaseReturn.confirmedAt })
  if (purchaseReturn.dispatchedAt) events.push({ label: 'Dispatched to supplier', at: purchaseReturn.dispatchedAt })
  if (purchaseReturn.completedAt) events.push({ label: 'Completed', at: purchaseReturn.completedAt })
  if (prStatusMeta(purchaseReturn.status).key === 'cancelled') {
    events.push({
      label: `Cancelled${purchaseReturn.cancelReason ? ` — ${purchaseReturn.cancelReason}` : ''}`,
      at: purchaseReturn.cancelledAt || purchaseReturn.updatedAt,
    })
  }
  return events.filter((event) => event.at)
}

// Everything a real Purchase Return module needs that the current backend does not provide.
// Surfaced verbatim in real mode so the UI never implies these already work.
export const PURCHASE_RETURN_BACKEND_LATER = [
  'PurchaseReturn / PurchaseReturnItem entity + table',
  'GET /purchase-returns list + GET /purchase-returns/{id} detail',
  'Return number generation',
  'Draft → Confirmed → Dispatched → Completed lifecycle endpoints (+ Cancel)',
  'Purchase → Return and Goods Receipt → Return relationships',
  'Per-item received quantity from a real Goods Receipt / GRN',
  'Per-item previously-returned quantity (multiple returns against one receipt)',
  'Source warehouse persisted on the return',
  'Stock movement out of the warehouse on dispatch / completion',
  'Batch / lot / serial / expiry references carried onto the return',
  'Supplier credit note / debit note / payable adjustment on completion',
  'Return audit trail',
  'purchase_returns permission module (currently reuses `purchases`)',
]
