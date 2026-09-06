// Single source of truth for how a delivery's lifecycle is shown in the UI.
//
// TWO backend contracts are supported, newest-preferred:
//
//  A. NEW (preferred when present): DeliveryOut carries `internal_status`
//     (planned | accepted | picking | ready | loaded | in_transit |
//     partially_delivered | delivered | failed | rejected | cancelled) which names the
//     exact stage directly. `getDeliveryStage` maps it 1:1 (see stageFromInternalStatus).
//
//  B. LEGACY fallback (older DeliveryOut - what the bundled openapi.json still documents):
//     only the collapsed public `status` (pending | accepted | in_transit |
//     partially_delivered | delivered | returned | rejected | cancelled) is available;
//     internal `loaded` + `in_transit` BOTH surface as public `in_transit`. The stage is
//     DERIVED from status + picking_status + dispatched_at + loadedTotal:
//       pending                                   -> Assigned
//       accepted + picking_status=not_started      -> Accepted
//       accepted + picking_status=picking/picked   -> Picking
//       in_transit + no dispatched_at (has load)   -> Vehicle Loaded
//       in_transit + dispatched_at                 -> In Transit
//       delivered                                  -> Delivered
//       rejected / returned / cancelled / partially_delivered -> off-flow badges
//     "Ready" is never emitted in legacy mode (indistinguishable from Vehicle Loaded).
//
// Every list / badge / stepper / dashboard tile reads its vocabulary from this module.

// The linear flow shown to users. Order matters - it drives the stepper.
export const DELIVERY_STAGES = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picking', label: 'Picking' },
  { key: 'ready', label: 'Ready' },
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
  ready: 'primary',
  loaded: 'primary',
  in_transit: 'warning',
  delivered: 'success',
}

// NEW-contract map: DeliveryOut.internal_status -> display stage. Returns null for a value
// we don't recognise so the caller drops back to the legacy derivation.
function stageFromInternalStatus(internal, pickingStatus) {
  switch (internal) {
    case 'planned':
    case 'pending':
      return withVariant('assigned')
    case 'accepted':
      return pickingStatus === 'not_started' ? withVariant('accepted') : withVariant('picking')
    case 'picking':
      return withVariant('picking')
    case 'picked':
    case 'ready':
      return withVariant('ready')
    case 'loaded':
      return withVariant('loaded')
    case 'in_transit':
      return withVariant('in_transit')
    case 'delivered':
      return withVariant('delivered')
    case 'partially_delivered':
      return OFF_FLOW.partially_delivered
    case 'failed':
    case 'returned':
      return OFF_FLOW.failed
    case 'rejected':
      return OFF_FLOW.rejected
    case 'cancelled':
      return OFF_FLOW.cancelled
    default:
      return null
  }
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

  // (A) NEW contract: when the backend names the exact stage via `internal_status`, trust it
  // directly. Falls through to the legacy derivation below when the field is absent or holds
  // a value we don't map.
  const internal = String(delivery.internalStatus || '').toLowerCase()
  if (internal) {
    const fromInternal = stageFromInternalStatus(internal, pickingStatus)
    if (fromInternal) return fromInternal
  }
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
//
// NEW contract (delivery carries `internal_status`): pick -> ready -> load are three
// distinct backend calls, so Picking yields "Mark Ready" once every line is picked, and a
// dedicated "Ready" stage yields "Load Vehicle".
// LEGACY contract (no `internal_status`): a single "Mark Vehicle Loaded" button chains
// POST /ready + POST /load, exactly as before - the Ready stage is never reached.
export function getNextDeliveryAction(delivery, { isAdmin = false } = {}) {
  if (isAdmin) return null

  const hasInternal = Boolean(delivery?.internalStatus)
  const pickingStatus = delivery?.pickingStatus || 'not_started'

  switch (getDeliveryStage(delivery).key) {
    case 'assigned':
      return { type: 'accept_reject' }
    case 'accepted':
      return { type: 'start_picking', label: 'Start Picking' }
    case 'picking':
      if (hasInternal) {
        return pickingStatus === 'picked'
          ? { type: 'mark_ready', label: 'Mark Ready' }
          : { type: 'start_picking', label: 'Confirm Picked Quantities' }
      }
      return { type: 'mark_loaded', label: 'Mark Vehicle Loaded' }
    case 'ready':
      return { type: 'load', label: 'Load Vehicle' }
    case 'loaded':
      return { type: 'start_delivery', label: 'Start Delivery' }
    case 'in_transit':
      return { type: 'complete', label: 'Complete Delivery' }
    case 'partially_delivered':
      // The backend accepts another POST /deliveries/{id}/confirm from partially_delivered
      // (-> partially_delivered again, delivered, or failed). Same confirm flow, seeded from
      // the remaining quantity - never a new Delivery.
      return { type: 'complete', label: 'Complete Remaining Delivery' }
    default:
      return null
  }
}

// Options for an admin/list status filter - the 7 lifecycle stages plus the off-flow outcomes.
export const DELIVERY_STAGE_FILTER_OPTIONS = [
  ...DELIVERY_STAGES.map((stage) => ({ value: stage.key, label: stage.label })),
  { value: 'rejected', label: 'Rejected' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]
