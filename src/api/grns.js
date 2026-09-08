import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

// =============================================================================
// Goods Receipt Note (GRN) API - the real receiving module.
// -----------------------------------------------------------------------------
//   POST   /grns
//   GET    /grns                         (purchase_id, supplier_id, warehouse_id, status, search, skip, limit)
//   GET    /grns/{id}
//   PATCH  /grns/{id}                    (draft only)
//   POST   /grns/{id}/confirm            (the physical stock-inward event)
//   POST   /grns/{id}/cancel             (draft only)
//   DELETE /grns/{id}                    (draft only)
//
// A DRAFT GRN moves NO stock. Only CONFIRM adds accepted_qty to warehouse on_hand
// (StockMovement type = purchase_in) and rolls up the parent Purchase's received_qty
// / receiving_status. Confirmed / cancelled GRNs are immutable historical records.
//
// Demo mode never calls any of this - see purchaseGrnDemoData.js.
// =============================================================================

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }
  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const GRN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function normalizeGrnItem(item) {
  if (!item) return item
  const receivedQty = num(item.received_qty)
  const damagedQty = num(item.damaged_qty)
  const rejectedQty = num(item.rejected_qty)
  const acceptedQty =
    item.accepted_qty !== undefined && item.accepted_qty !== null
      ? num(item.accepted_qty)
      : Math.max(receivedQty - damagedQty - rejectedQty, 0)
  return {
    id: item.id,
    purchaseItemId: item.purchase_item_id || item.purchaseItemId || null,
    productId: item.product_id || item.productId || '',
    variantId: item.variant_id || item.variantId || '',
    productName: item.product_name || item.product?.name || '',
    sku: item.product_sku || item.sku || '',
    orderedQty: num(item.ordered_qty ?? item.quantity),
    previousReceived: num(item.previous_received_qty ?? item.previously_received_qty),
    receivedQty,
    damagedQty,
    rejectedQty,
    acceptedQty,
    remainingQty:
      item.remaining_qty !== undefined && item.remaining_qty !== null ? num(item.remaining_qty) : null,
    batchNumber: item.batch_number || '',
    serialNumbers: Array.isArray(item.serial_numbers) ? item.serial_numbers : item.serial_number ? [item.serial_number] : [],
    expiryDate: item.expiry_date || '',
  }
}

function normalizeGrn(grn) {
  if (!grn) return grn
  const items = Array.isArray(grn.items) ? grn.items.map(normalizeGrnItem) : []
  return {
    id: grn.id,
    grnNumber: grn.grn_number || grn.number || grn.id,
    status: String(grn.status || 'draft').toLowerCase(),
    purchaseId: grn.purchase_id || grn.purchase?.id || null,
    purchaseNumber: grn.purchase_number || grn.purchase?.purchase_number || grn.purchase?.invoice_number || '',
    supplierId: grn.supplier_id || grn.supplier?.id || '',
    supplierName: grn.supplier?.name || grn.supplier_name || '',
    warehouseId: grn.warehouse_id || grn.warehouse?.id || '',
    warehouseName: grn.warehouse?.name || grn.warehouse_name || '',
    receivedDate: grn.received_date || grn.receipt_date || null,
    notes: grn.notes || '',
    items,
    acceptedTotal: items.reduce((sum, item) => sum + item.acceptedQty, 0),
    damagedTotal: items.reduce((sum, item) => sum + item.damagedQty, 0),
    rejectedTotal: items.reduce((sum, item) => sum + item.rejectedQty, 0),
    receivedTotal: items.reduce((sum, item) => sum + item.receivedQty, 0),
    createdBy: grn.created_by_name || grn.created_by || '',
    confirmedBy: grn.confirmed_by_name || grn.confirmed_by || '',
    createdAt: grn.created_at || null,
    confirmedAt: grn.confirmed_at || null,
    cancelledAt: grn.cancelled_at || null,
  }
}

function grnError(error, fallback) {
  const status = error.response?.status
  const data = error.response?.data
  const detail = data?.detail || data?.message || data?.error || data
  if (status === 404) return 'This goods receipt is no longer available (404). Please refresh.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return formatApiError(detail, 'This goods receipt has already moved to the next stage. Refreshing…')
  return formatApiError(detail, fallback)
}

function buildGrnItemBody(item) {
  const body = {
    received_qty: Math.trunc(num(item.receivedQty ?? item.received_qty ?? item.receivingNow)) || 0,
    damaged_qty: Math.trunc(num(item.damagedQty ?? item.damaged_qty)) || 0,
    rejected_qty: Math.trunc(num(item.rejectedQty ?? item.rejected_qty)) || 0,
  }
  const purchaseItemId = item.purchaseItemId || item.purchase_item_id
  if (purchaseItemId) body.purchase_item_id = purchaseItemId
  const productId = item.productId || item.product_id
  if (productId) body.product_id = productId
  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId
  const batch = (item.batchNumber || item.batch_number || '').trim?.() ?? item.batchNumber
  if (batch) body.batch_number = batch
  const serials = item.serialNumbers || item.serial_numbers
  if (Array.isArray(serials) && serials.length) body.serial_numbers = serials.filter(Boolean)
  const expiry = item.expiryDate || item.expiry_date
  if (expiry) body.expiry_date = expiry
  return body
}

function buildGrnBody(payload) {
  const body = {
    purchase_id: payload.purchaseId || payload.purchase_id,
    items: (payload.items || []).map(buildGrnItemBody),
  }
  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId
  const receivedDate = payload.receivedDate || payload.received_date
  if (receivedDate) body.received_date = receivedDate
  const notes = (payload.notes || '').trim?.() ?? payload.notes
  if (notes) body.notes = notes
  return body
}

export async function listGrns(params = {}) {
  try {
    const queryParams = {}
    const purchaseId = params.purchase_id || params.purchaseId
    if (purchaseId) queryParams.purchase_id = purchaseId
    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) queryParams.supplier_id = supplierId
    const warehouseId = params.warehouse_id || params.warehouseId
    if (warehouseId) queryParams.warehouse_id = warehouseId
    if (params.status && params.status !== 'all') queryParams.status = params.status
    if (params.search) queryParams.search = params.search
    if (params.skip !== undefined) queryParams.skip = params.skip
    if (params.limit !== undefined) queryParams.limit = params.limit

    const { data } = await apiClient.get('/grns', { headers: authHeader(), params: queryParams })
    const rows = Array.isArray(data) ? data : data?.grns || data?.items || []
    return { success: true, grns: rows.map(normalizeGrn) }
  } catch (error) {
    return { success: false, error: grnError(error, 'Unable to load goods receipts. Please try again.') }
  }
}

export async function getGrn(grnId) {
  try {
    const { data } = await apiClient.get(`/grns/${encodeURIComponent(grnId)}`, { headers: authHeader() })
    return { success: true, grn: normalizeGrn(data) }
  } catch (error) {
    return { success: false, error: grnError(error, 'Unable to load this goods receipt.') }
  }
}

export async function createGrn(payload) {
  try {
    const { data } = await apiClient.post('/grns', buildGrnBody(payload), { headers: authHeader() })
    return { success: true, grn: normalizeGrn(data) }
  } catch (error) {
    return { success: false, error: grnError(error, 'Unable to create this goods receipt. Please try again.') }
  }
}

// Draft only.
export async function updateGrn(grnId, payload) {
  try {
    const { data } = await apiClient.patch(`/grns/${encodeURIComponent(grnId)}`, buildGrnBody(payload), { headers: authHeader() })
    return { success: true, grn: normalizeGrn(data) }
  } catch (error) {
    return { success: false, error: grnError(error, 'Unable to update this goods receipt. Please try again.') }
  }
}

async function grnAction(grnId, action, fallback) {
  try {
    const { data } = await apiClient.post(`/grns/${encodeURIComponent(grnId)}/${action}`, {}, { headers: authHeader() })
    return { success: true, grn: normalizeGrn(data) }
  } catch (error) {
    return { success: false, error: grnError(error, fallback) }
  }
}

// The physical inventory event: accepted_qty -> warehouse on_hand, purchase_in movement,
// Purchase received_qty / receiving_status roll up (backend, row-locked).
export function confirmGrn(grnId) {
  return grnAction(grnId, 'confirm', 'Unable to confirm this goods receipt. Please try again.')
}

export function cancelGrn(grnId) {
  return grnAction(grnId, 'cancel', 'Unable to cancel this goods receipt. Please try again.')
}

// Draft only.
export async function deleteGrn(grnId) {
  try {
    await apiClient.delete(`/grns/${encodeURIComponent(grnId)}`, { headers: authHeader() })
    return { success: true }
  } catch (error) {
    return { success: false, error: grnError(error, 'Unable to delete this goods receipt. Please try again.') }
  }
}
