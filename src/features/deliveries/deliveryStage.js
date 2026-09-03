// Single source of truth for how a delivery's lifecycle is shown in the UI.
//
// Backend public status (DeliveryOut.status): pending | accepted | in_transit |
// partially_delivered | delivered | returned | rejected | cancelled. It does NOT expose
// "assigned" / "picking" / "loaded" as status values, and internal `loaded` + `in_transit`
// both surface as public `in_transit`. The 6-stage flow the product wants is DERIVED here
// from status + picking_status + dispatched_at + loadedTotal:
//   pending                                   -> Assigned
//   accepted + picking_status=not_started      -> Accepted
//   accepted + picking_status=picking/picked   -> Picking
//   in_transit + no dispatched_at (has load)   -> Vehicle Loaded
//   in_transit + dispatched_at                 -> In Transit
//   delivered                                  -> Delivered
//   rejected / returned / cancelled / partially_delivered -> off-flow badges
// Every list / badge / stepper / dashboard tile reads its vocabulary from this module.

// The linear flow shown to users. Order matters - it drives the stepper.
export const DELIVERY_STAGES = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picking', label: 'Picking' },
  { key: 'loaded', label: 'Vehicle Loaded' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
]

// Off-flow outcomes that are not one of the 6 linear steps.
const OFF_FLOW = {
  rejected: { key: 'rejected', label: 'Rejected', variant: 'danger', offFlow: true },
  partially_delivered: { key: 'partially_delivered', label: 'Partially Delivered', variant: 'warning', offFlow: true },
  failed: { key: 'failed', label: 'Failed', variant: 'danger', offFlow: true },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'neutral', offFlow: true },
}

const STAGE_VARIANT = {
  assigned: 'info',
  accepted: 'primary',
  picking: 'warning',
  loaded: 'primary',
  in_transit: 'warning',
  delivered: 'success',
}

function loadedTotalOf(delivery) {
  if (typeof delivery.loadedTotal === 'number' && delivery.loadedTotal > 0) return delivery.loadedTotal
  return (delivery.items || []).reduce((sum, item) => sum + (Number(item.loadedQuantity) || 0), 0)
}

// Returns { key, label, variant, offFlow } for the given normalized delivery.
export function getDeliveryStage(delivery) {
  if (!delivery) return { key: 'assigned', label: 'Assigned', variant: 'info' }

  const status = delivery.status || 'pending'
  const pickingStatus = delivery.pickingStatus || 'not_started'
  const dispatched = Boolean(delivery.dispatchedAt)
  // A delivery whose parent Sales Order was cancelled has left the workflow, regardless of
  // its own (now stale) operational status. This keeps the client-approved cancelled-order
  // guard consistent everywhere the stage is read (list / dashboard / detail).
  const parentCancelled = String(delivery.order?.status || delivery.orderStatus || '').toLowerCase() === 'cancelled'

  if (status === 'cancelled' || parentCancelled) return OFF_FLOW.cancelled
  if (status === 'returned') return OFF_FLOW.failed
  if (status === 'rejected') return OFF_FLOW.rejected
  if (status === 'partially_delivered') return OFF_FLOW.partially_delivered
  if (status === 'delivered') return withVariant('delivered')

  // The backend collapses internal `loaded` AND `in_transit` into the single public status
  // `in_transit`. `dispatched_at` is set only once the vehicle actually leaves the warehouse,
  // so it separates the "loaded, not yet moving" stage from "on the road".
  if (status === 'in_transit') {
    if (dispatched || loadedTotalOf(delivery) === 0) return withVariant('in_transit')
    return withVariant('loaded')
  }

  if (status === 'accepted') {
    if (pickingStatus !== 'not_started') return withVariant('picking')
    return withVariant('accepted')
  }

  // status === 'pending' (or anything unrecognised)
  return withVariant('assigned')
}

function withVariant(key) {
  const stage = DELIVERY_STAGES.find((entry) => entry.key === key)
  return { key, label: stage?.label || key, variant: STAGE_VARIANT[key] || 'neutral' }
}

// Index into DELIVERY_STAGES for the stepper. -1 for rejected/failed/cancelled (left the flow);
// partially_delivered sits at the Delivered step.
export function deliveryStageIndex(delivery) {
  const { key, offFlow } = getDeliveryStage(delivery)
  if (key === 'partially_delivered') return DELIVERY_STAGES.length - 1
  if (offFlow) return -1
  return DELIVERY_STAGES.findIndex((entry) => entry.key === key)
}

// The ONE next action a delivery partner can take at the current stage, or null.
// Admins don't get workflow actions here - they use reassign / edit / cancel.
export function getNextDeliveryAction(delivery, { isAdmin = false } = {}) {
  if (isAdmin) return null

  switch (getDeliveryStage(delivery).key) {
    case 'assigned':
      return { type: 'accept_reject' }
    case 'accepted':
      return { type: 'start_picking', label: 'Start Picking' }
    case 'picking':
      return { type: 'mark_loaded', label: 'Mark Vehicle Loaded' }
    case 'loaded':
      return { type: 'start_delivery', label: 'Start Delivery' }
    case 'in_transit':
      return { type: 'complete', label: 'Complete Delivery' }
    default:
      return null
  }
}

// Options for an admin/list status filter - the 6 stages plus the off-flow outcomes.
export const DELIVERY_STAGE_FILTER_OPTIONS = [
  ...DELIVERY_STAGES.map((stage) => ({ value: stage.key, label: stage.label })),
  { value: 'rejected', label: 'Rejected' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]
