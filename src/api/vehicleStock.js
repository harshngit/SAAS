import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

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

function normalizeSessionItem(item) {
  if (!item) return item

  const loadedQuantity = item.loaded_qty ?? item.loaded_quantity ?? item.quantity ?? 0
  const deliveredQuantity = item.delivered_qty ?? item.delivered_quantity ?? 0
  const returnedQuantity = item.returned_qty ?? item.returned_quantity ?? 0
  const extraQuantity = item.extra_qty ?? item.extra_quantity ?? 0
  const remainingQuantity = item.remaining_qty ?? Math.max(loadedQuantity + extraQuantity - deliveredQuantity, 0)

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || item.name || '',
    loadedQuantity,
    extraQuantity,
    deliveredQuantity,
    returnedQuantity,
    remainingQuantity,
    expectedClosingQty: item.expected_closing_qty ?? Math.max(remainingQuantity - returnedQuantity, 0),
  }
}

function normalizeReconciliationItem(item) {
  if (!item) return item

  return {
    id: item.id,
    loadingItemId: item.loading_item_id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || '',
    loadedQuantity: item.loaded_qty ?? 0,
    extraQuantity: item.extra_qty ?? 0,
    deliveredQuantity: item.delivered_qty ?? 0,
    returnedQuantity: item.returned_qty ?? 0,
    expectedClosingQty: item.expected_closing_qty ?? 0,
    physicalQuantity: item.physical_qty ?? 0,
    varianceQuantity: item.variance_qty ?? 0,
    notes: item.notes || '',
  }
}

function normalizeReconciliation(reconciliation) {
  if (!reconciliation) return reconciliation

  return {
    id: reconciliation.id,
    loadingId: reconciliation.loading_id,
    reconciledById: reconciliation.reconciled_by_id || '',
    status: reconciliation.status || 'reconciled',
    notes: reconciliation.notes || '',
    items: (reconciliation.items || []).map(normalizeReconciliationItem),
    createdAt: reconciliation.created_at,
  }
}

function normalizeSession(session) {
  if (!session) return session

  return {
    id: session.id,
    deliveryPartnerId: session.delivery_partner_id || session.delivery_partner?.id || '',
    deliveryPartnerName: session.delivery_partner?.name || '',
    vehicleId: session.vehicle_id || session.vehicle?.id || '',
    vehicleNumber: session.vehicle?.vehicle_number || '',
    vehicleType: session.vehicle?.vehicle_type || '',
    vehicleCapacityKg: session.vehicle?.capacity_kg ?? null,
    date: session.date,
    status: session.status || 'active',
    items: (session.items || []).map(normalizeSessionItem),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }
}

export async function loadVehicleStock(payload) {
  try {
    const requestBody = {
      items: (payload.items || []).map((item) => {
        const body = {
          product_id: item.productId || item.product_id,
          loaded_qty: Math.trunc(Number(item.loadedQty ?? item.quantity)) || 0,
        }
        const variantId = item.variantId || item.variant_id
        if (variantId) body.variant_id = variantId
        const deliveryItemId = item.deliveryItemId || item.delivery_item_id
        if (deliveryItemId) body.delivery_item_id = deliveryItemId
        return body
      }),
    }

    const deliveryId = payload.deliveryId || payload.delivery_id
    if (deliveryId) {
      requestBody.delivery_id = deliveryId
    } else {
      requestBody.delivery_partner_id = payload.deliveryPartnerId || payload.delivery_partner_id
    }

    if (payload.vehicleId || payload.vehicle_id) requestBody.vehicle_id = payload.vehicleId || payload.vehicle_id
    if (payload.date) requestBody.date = payload.date

    const { data } = await apiClient.post('/vehicle-stock/loading', requestBody, {
      headers: authHeader(),
    })

    return { success: true, session: normalizeSession(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicle stock. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCurrentVehicleStock(deliveryPartnerId) {
  try {
    const { data } = await apiClient.get(`/vehicle-stock/current/${deliveryPartnerId}`, {
      headers: authHeader(),
    })

    return { success: true, session: normalizeSession(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'No active loading session found.',
    )

    return { success: false, error: message }
  }
}

export async function addExtraLoad(sessionId, items) {
  try {
    const requestBody = {
      items: items.map((item) => {
        const body = {
          product_id: item.productId || item.product_id,
          quantity: Number(item.quantity) || 0,
        }
        const variantId = item.variantId || item.variant_id
        if (variantId) body.variant_id = variantId
        return body
      }),
    }

    const { data } = await apiClient.post(`/vehicle-stock/${sessionId}/extra-load`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, session: normalizeSession(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to add extra load. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function endOfDayReturn(sessionId, items) {
  try {
    const requestBody = {
      items: items.map((item) => {
        const body = {
          product_id: item.productId || item.product_id,
          returned_qty: Number(item.returnedQty ?? item.returned_qty) || 0,
        }
        const variantId = item.variantId || item.variant_id
        if (variantId) body.variant_id = variantId
        return body
      }),
    }

    const { data } = await apiClient.post(`/vehicle-stock/${sessionId}/end-of-day`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, session: normalizeSession(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record end of day return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listVehicleStockSessions(params = {}) {
  try {
    const queryParams = {}
    if (params.delivery_partner_id) queryParams.delivery_partner_id = params.delivery_partner_id
    if (params.status) queryParams.status = params.status

    const { data } = await apiClient.get('/vehicle-stock', {
      headers: authHeader(),
      params: queryParams,
    })

    const sessions = Array.isArray(data) ? data : data?.sessions || []
    return { success: true, sessions: sessions.map(normalizeSession) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicle stock sessions. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Physical-count variance audit against a (usually just-closed) loading session - does not
// touch warehouse stock, it's a read-only reconciliation record layered on top.
export async function reconcileVehicleStock(sessionId, { items, notes } = {}) {
  try {
    const requestBody = {
      items: (items || []).map((item) => {
        const body = {
          physical_qty: Math.trunc(Number(item.physicalQty ?? item.physical_qty)) || 0,
        }
        const productId = item.productId || item.product_id
        if (productId) body.product_id = productId
        const variantId = item.variantId || item.variant_id
        if (variantId) body.variant_id = variantId
        const loadingItemId = item.loadingItemId || item.loading_item_id || item.id
        if (loadingItemId) body.loading_item_id = loadingItemId
        if (item.notes) body.notes = item.notes
        return body
      }),
    }
    if (notes) requestBody.notes = notes

    const { data } = await apiClient.post(`/vehicle-stock/${sessionId}/reconcile`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, reconciliation: normalizeReconciliation(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record the stock reconciliation. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listVehicleStockReconciliations(sessionId) {
  try {
    const { data } = await apiClient.get(`/vehicle-stock/${sessionId}/reconciliations`, {
      headers: authHeader(),
    })

    const reconciliations = Array.isArray(data) ? data : data?.reconciliations || []
    return { success: true, reconciliations: reconciliations.map(normalizeReconciliation) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load past reconciliations. Please try again.',
    )

    return { success: false, error: message }
  }
}
