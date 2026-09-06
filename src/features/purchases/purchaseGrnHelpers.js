// =============================================================================
// Goods Receipt Note (GRN) - frontend structure only.
// -----------------------------------------------------------------------------
// The final receiving flow is:
//   Purchase Confirmed -> Receive Goods -> GRN -> accepted stock enters the
//   warehouse -> Purchase Receiving Status updates.
//
// The current backend has NO GRN entity, no partial-receipt persistence and no
// stock movement on receipt (see the BACKEND LATER list in the Goods Receipts
// tab). So this file only holds the pure client-side math and status derivation
// that the UI needs. Nothing here calls an API. Real purchases never get a
// fabricated GRN - only explicit demo mode simulates them (purchaseGrnDemoData.js).
// =============================================================================

import { safeNumber } from './purchaseHelpers'

const GRN_STATUS_META = {
  partially_received: { key: 'partially_received', label: 'Partially Received', variant: 'warning' },
  fully_received: { key: 'fully_received', label: 'Fully Received', variant: 'success' },
  not_received: { key: 'not_received', label: 'Not Received', variant: 'neutral' },
}

export function grnStatusMeta(key) {
  return GRN_STATUS_META[key] || GRN_STATUS_META.not_received
}

// Per-line receiving math (task section 3).
//   acceptedQty  = max(receivingNow - damagedQty - rejectedQty, 0)
//   remainingQty = max(orderedQty - previousReceived - acceptedQty, 0)
export function computeGrnLine(line) {
  const orderedQty = safeNumber(line?.orderedQty)
  const previousReceived = safeNumber(line?.previousReceived)
  const receivingNow = safeNumber(line?.receivingNow)
  const damagedQty = safeNumber(line?.damagedQty)
  const rejectedQty = safeNumber(line?.rejectedQty)
  const acceptedQty = Math.max(receivingNow - damagedQty - rejectedQty, 0)
  const remainingQty = Math.max(orderedQty - previousReceived - acceptedQty, 0)
  return { orderedQty, previousReceived, receivingNow, damagedQty, rejectedQty, acceptedQty, remainingQty }
}

// Remaining quantity for a line BEFORE the current receipt is applied.
export function remainingBeforeReceipt(line) {
  return Math.max(safeNumber(line?.orderedQty) - safeNumber(line?.previousReceived), 0)
}

// Line-level validation (task section 3). Returns an error string, or '' when valid.
export function validateGrnLine(line) {
  const receivingNow = safeNumber(line?.receivingNow)
  const damagedQty = safeNumber(line?.damagedQty)
  const rejectedQty = safeNumber(line?.rejectedQty)
  if (receivingNow < 0 || damagedQty < 0 || rejectedQty < 0) return 'Quantities cannot be negative.'
  if (!Number.isInteger(receivingNow) || !Number.isInteger(damagedQty) || !Number.isInteger(rejectedQty)) {
    return 'Quantities must be whole numbers.'
  }
  if (damagedQty + rejectedQty > receivingNow) return 'Damaged + rejected cannot exceed the quantity received now.'
  const remaining = remainingBeforeReceipt(line)
  if (receivingNow > remaining) return `Cannot receive more than the ${remaining} unit(s) still remaining.`
  return ''
}

// Whole-GRN validation. Returns an error string, or '' when valid.
export function validateGrn(lines) {
  const rows = Array.isArray(lines) ? lines : []
  const totalReceiving = rows.reduce((sum, line) => sum + safeNumber(line?.receivingNow), 0)
  if (totalReceiving <= 0) return 'Enter a receiving quantity for at least one item.'
  for (const line of rows) {
    const error = validateGrnLine(line)
    if (error) return `${line?.productName || 'Item'}: ${error}`
  }
  return ''
}

// Cumulative accepted quantity per productId across a set of GRNs (task section 4 / "per-item
// cumulative received qty"). Used to prefill "Previously Received" on the next receipt.
export function cumulativeAcceptedByProduct(grns) {
  const totals = {}
  ;(Array.isArray(grns) ? grns : []).forEach((grn) => {
    ;(grn?.lines || []).forEach((line) => {
      const key = line?.productId
      if (!key) return
      totals[key] = (totals[key] || 0) + safeNumber(line?.acceptedQty)
    })
  })
  return totals
}

// Receiving Status derived purely from cumulative accepted quantities vs the ordered quantities
// on the purchase (task section 4). Never overloads Purchase Status.
export function deriveReceivingStatusFromGrns(purchaseItems, grns) {
  const items = Array.isArray(purchaseItems) ? purchaseItems : []
  const totalOrdered = items.reduce((sum, item) => sum + safeNumber(item?.quantity), 0)
  const acceptedByProduct = cumulativeAcceptedByProduct(grns)
  const totalAccepted = Object.values(acceptedByProduct).reduce((sum, value) => sum + safeNumber(value), 0)
  if (totalAccepted <= 0) return grnStatusMeta('not_received')
  if (totalOrdered > 0 && totalAccepted >= totalOrdered) return grnStatusMeta('fully_received')
  return grnStatusMeta('partially_received')
}

// Roll-up totals for a single GRN (task section 6 summary).
export function summarizeGrn(grn) {
  const lines = grn?.lines || []
  return lines.reduce(
    (acc, line) => ({
      ordered: acc.ordered + safeNumber(line?.orderedQty),
      receivedThisGrn: acc.receivedThisGrn + safeNumber(line?.receivingNow),
      accepted: acc.accepted + safeNumber(line?.acceptedQty),
      damaged: acc.damaged + safeNumber(line?.damagedQty),
      rejected: acc.rejected + safeNumber(line?.rejectedQty),
    }),
    { ordered: 0, receivedThisGrn: 0, accepted: 0, damaged: 0, rejected: 0 },
  )
}

export function grnLineHasTracking(line) {
  return Boolean(line?.batchNumber || line?.serialNumber || line?.expiryDate)
}

// BACKEND LATER - everything a real GRN needs that the current API does not provide. Surfaced
// verbatim in the Goods Receipts tab so the UI never implies these already work.
export const GRN_BACKEND_LATER = [
  'GRN entity / table',
  'GRN number generation',
  'Purchase -> GRN relationship',
  'Partial receipt persistence',
  'Per-item cumulative received quantity',
  'Damaged / rejected quantity capture',
  'Accepted quantity',
  'Batch / serial / expiry tracking',
  'Stock movement on accepted quantity',
  'Warehouse inventory increase',
  'Receiving status update from receipts',
  'GRN audit trail',
  'GRN cancellation / reversal',
]
