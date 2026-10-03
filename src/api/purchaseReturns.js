import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

// Dedicated Purchase Returns API - the real, canonical backend entity (confirmed now built):
//   POST   /purchase-returns
//   GET    /purchase-returns
//   GET    /purchase-returns/{id}
//   PATCH  /purchase-returns/{id}
//   POST   /purchase-returns/{id}/confirm
//   POST   /purchase-returns/{id}/dispatch
//   POST   /purchase-returns/{id}/complete
//   POST   /purchase-returns/{id}/cancel
//
// The older POST /purchases/{purchase_id}/returns (api/purchases.js#createPurchaseReturn) was a
// thin fire-and-forget call with nothing tracked - it is NOT used by this module and stays
// untouched for whatever (if anything) still calls it elsewhere.

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

// Accepts either snake_case or the frontend-friendly camelCase alias the backend may send for
// the same field - never assumes only one casing.
function pick(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object[key] !== null) return object[key]
  }
  return undefined
}

function normalizePurchaseReturnItem(item) {
  if (!item) return item

  return {
    id: pick(item, 'id') || '',
    purchaseItemId: pick(item, 'purchase_item_id', 'purchaseItemId') || '',
    productId: pick(item, 'product_id', 'productId') || '',
    variantId: pick(item, 'variant_id', 'variantId') || '',
    productName: pick(item, 'product_name', 'productName') || item.product?.name || '',
    sku: pick(item, 'sku', 'product_sku', 'productSku') || '',
    receivedQty: Number(pick(item, 'received_qty', 'receivedQty', 'received_quantity')) || 0,
    previouslyReturned: Number(pick(item, 'previously_returned', 'previouslyReturned', 'prior_returned_qty')) || 0,
    returnQty: Number(pick(item, 'quantity', 'return_qty', 'returnQty')) || 0,
    unitPrice: Number(pick(item, 'unit_price', 'unitPrice')) || 0,
    reason: pick(item, 'reason') || '',
    batchNumber: pick(item, 'batch_number', 'batchNumber') || '',
    expiryDate: pick(item, 'expiry_date', 'expiryDate') || '',
  }
}

function normalizePurchaseReturn(purchaseReturn) {
  if (!purchaseReturn) return purchaseReturn

  return {
    id: purchaseReturn.id,
    returnNumber: pick(purchaseReturn, 'return_number', 'returnNumber') || purchaseReturn.id,
    status: (pick(purchaseReturn, 'status') || 'draft').toLowerCase(),
    returnDate: pick(purchaseReturn, 'return_date', 'returnDate') || '',
    supplierId: pick(purchaseReturn, 'supplier_id', 'supplierId') || purchaseReturn.supplier?.id || '',
    supplierName: pick(purchaseReturn, 'supplierName') || purchaseReturn.supplier?.name || '',
    purchaseId: pick(purchaseReturn, 'purchase_id', 'purchaseId') || purchaseReturn.purchase?.id || '',
    purchaseNumber: pick(purchaseReturn, 'purchaseNumber') || purchaseReturn.purchase?.purchase_number || purchaseReturn.purchase?.number || '',
    grnId: pick(purchaseReturn, 'grn_id', 'grnId') || purchaseReturn.grn?.id || '',
    grnNumber: pick(purchaseReturn, 'grnNumber') || purchaseReturn.grn?.grn_number || purchaseReturn.grn?.number || '',
    warehouseId: pick(purchaseReturn, 'warehouse_id', 'warehouseId') || purchaseReturn.warehouse?.id || '',
    warehouseName: pick(purchaseReturn, 'warehouseName') || purchaseReturn.warehouse?.name || '',
    returnReason: pick(purchaseReturn, 'reason', 'return_reason', 'returnReason') || '',
    returnType: pick(purchaseReturn, 'return_type', 'returnType') || 'Debit Note',
    notes: pick(purchaseReturn, 'notes') || '',
    confirmedAt: pick(purchaseReturn, 'confirmed_at', 'confirmedAt') || null,
    dispatchedAt: pick(purchaseReturn, 'dispatched_at', 'dispatchedAt') || null,
    completedAt: pick(purchaseReturn, 'completed_at', 'completedAt') || null,
    cancelledAt: pick(purchaseReturn, 'cancelled_at', 'cancelledAt') || null,
    cancelReason: pick(purchaseReturn, 'cancel_reason', 'cancelReason') || '',
    totalReturnQty: Number(pick(purchaseReturn, 'total_return_qty', 'totalReturnQty')) || null,
    totalAmount: Number(pick(purchaseReturn, 'total_amount', 'totalAmount')) || null,
    items: (purchaseReturn.items || []).map(normalizePurchaseReturnItem),
    createdAt: pick(purchaseReturn, 'created_at', 'createdAt'),
    updatedAt: pick(purchaseReturn, 'updated_at', 'updatedAt'),
  }
}

function buildItemBody(item) {
  const body = {
    purchase_item_id: item.purchaseItemId || item.purchase_item_id,
    quantity: Number(item.returnQty ?? item.quantity) || 0,
  }
  const reason = item.reason
  if (reason) body.reason = reason
  const batchNumber = item.batchNumber || item.batch_number
  if (batchNumber) body.batch_number = batchNumber
  return body
}

function buildCreateBody(payload) {
  const body = {
    purchase_id: payload.purchaseId || payload.purchase_id,
    supplier_id: payload.supplierId || payload.supplier_id,
    return_date: payload.returnDate || payload.return_date,
    reason: payload.reason || payload.returnReason || '',
    items: (payload.items || []).map(buildItemBody),
  }

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId
  if (payload.notes) body.notes = payload.notes

  return body
}

function buildUpdateBody(payload) {
  const body = {}

  const reason = payload.reason || payload.returnReason
  if (reason) body.reason = reason

  const returnDate = payload.returnDate || payload.return_date
  if (returnDate) body.return_date = returnDate

  if (payload.notes !== undefined) body.notes = payload.notes

  if (Array.isArray(payload.items)) {
    body.items = payload.items.map(buildItemBody)
  }

  return body
}

export async function listPurchaseReturns(params = {}) {
  try {
    const queryParams = {}
    if (params.status && params.status !== 'all') queryParams.status = params.status
    if (params.supplierId || params.supplier_id) queryParams.supplier_id = params.supplierId || params.supplier_id
    if (params.purchaseId || params.purchase_id) queryParams.purchase_id = params.purchaseId || params.purchase_id
    if (params.search) queryParams.search = params.search
    if (params.dateFrom || params.date_from) queryParams.date_from = params.dateFrom || params.date_from
    if (params.dateTo || params.date_to) queryParams.date_to = params.dateTo || params.date_to
    if (params.page) queryParams.page = params.page
    if (params.pageSize || params.page_size) queryParams.page_size = params.pageSize || params.page_size

    const { data } = await apiClient.get('/purchase-returns', {
      headers: authHeader(),
      params: queryParams,
    })

    const items = Array.isArray(data) ? data : data?.items || data?.purchase_returns || []
    return {
      success: true,
      purchaseReturns: items.map(normalizePurchaseReturn),
      total: data?.total ?? items.length,
      page: data?.page ?? 1,
      pageSize: data?.page_size ?? items.length,
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchase returns. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getPurchaseReturn(id) {
  try {
    const { data } = await apiClient.get(`/purchase-returns/${encodeURIComponent(id)}`, {
      headers: authHeader(),
    })

    return { success: true, purchaseReturn: normalizePurchaseReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this purchase return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createPurchaseReturn(payload) {
  try {
    const { data } = await apiClient.post('/purchase-returns', buildCreateBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchaseReturn: normalizePurchaseReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create purchase return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePurchaseReturn(id, payload) {
  try {
    const { data } = await apiClient.patch(`/purchase-returns/${encodeURIComponent(id)}`, buildUpdateBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchaseReturn: normalizePurchaseReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update purchase return. Please try again.',
    )

    return { success: false, error: message }
  }
}

function lifecycleAction(action, fallbackMessage) {
  return async (id) => {
    try {
      const { data } = await apiClient.post(`/purchase-returns/${encodeURIComponent(id)}/${action}`, {}, {
        headers: authHeader(),
      })

      return { success: true, purchaseReturn: normalizePurchaseReturn(data) }
    } catch (error) {
      const errorData = error.response?.data
      const message = formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        fallbackMessage,
      )

      return { success: false, error: message }
    }
  }
}

export const confirmPurchaseReturn = lifecycleAction('confirm', 'Unable to confirm this purchase return. Please try again.')
export const dispatchPurchaseReturn = lifecycleAction('dispatch', 'Unable to dispatch this purchase return. Please try again.')
export const completePurchaseReturn = lifecycleAction('complete', 'Unable to complete this purchase return. Please try again.')

export async function cancelPurchaseReturn(id, cancelReason) {
  try {
    const { data } = await apiClient.post(
      `/purchase-returns/${encodeURIComponent(id)}/cancel`,
      { cancel_reason: cancelReason },
      { headers: authHeader() },
    )

    return { success: true, purchaseReturn: normalizePurchaseReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel this purchase return. Please try again.',
    )

    return { success: false, error: message }
  }
}
