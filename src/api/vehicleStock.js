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
  // Backend contract: available / expected-closing on the vehicle =
  //   loaded_qty + extra_qty - delivered_qty - returned_qty
  // Prefer the backend-authoritative value; derive it only for the older item schema that
  // does not return it. (This is the ONE place the formula lives - see §31 of the spec.)
  const derivedAvailable = Math.max(loadedQuantity + extraQuantity - deliveredQuantity - returnedQuantity, 0)
  // Backend contract: remaining_qty = loaded + extra - delivered (EXCLUDES returned_qty), so it
  // is NOT the stock currently on the vehicle once a return exists. expected_closing_qty is the
  // authoritative post-return available. Prefer it; derive only when the backend omits it.
  const availableQuantity = item.expected_closing_qty ?? item.available_qty ?? derivedAvailable

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || item.name || '',
    // Variant lines carry variant_name; sku/uom come straight from the API (null -> '').
    variantName: item.variant_name || '',
    sku: item.sku || item.product_sku || '',
    uom: item.uom || item.unit || item.unit_of_measure || '',
    loadedQuantity,
    extraQuantity,
    deliveredQuantity,
    returnedQuantity,
    // Current available on the vehicle (post-return). This is what every screen displays.
    remainingQuantity: availableQuantity,
    expectedClosingQty: availableQuantity,
    // Raw backend field, reference only - excludes returned_qty, never shown as available.
    rawRemainingQty: item.remaining_qty ?? null,
    // Only present once a physical count has been recorded against the session.
    physicalQuantity: item.physical_qty ?? null,
    varianceQuantity: item.variance_qty ?? null,
  }
}

function normalizeReconciliationItem(item) {
  if (!item) return item

  const loadedQuantity = item.loaded_qty ?? 0
  const extraQuantity = item.extra_qty ?? 0
  const deliveredQuantity = item.delivered_qty ?? 0
  const returnedQuantity = item.returned_qty ?? 0
  // expected_closing_qty = loaded + extra - delivered - returned ; variance = physical - expected.
  // Backend value preferred; derived only when the row omits it.
  const expectedClosingQty =
    item.expected_closing_qty ?? Math.max(loadedQuantity + extraQuantity - deliveredQuantity - returnedQuantity, 0)
  const physicalQuantity = item.physical_qty ?? 0
  const varianceQuantity = item.variance_qty ?? physicalQuantity - expectedClosingQty

  return {
    id: item.id,
    loadingItemId: item.loading_item_id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || '',
    loadedQuantity,
    extraQuantity,
    deliveredQuantity,
    returnedQuantity,
    expectedClosingQty,
    physicalQuantity,
    varianceQuantity,
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
    deliveryPartnerName: session.delivery_partner?.name || session.driver_name || '',
    vehicleId: session.vehicle_id || session.vehicle?.id || '',
    vehicleNumber: session.vehicle?.vehicle_number || session.vehicle_number || '',
    vehicleType: session.vehicle?.vehicle_type || '',
    vehicleCapacityKg: session.vehicle?.capacity_kg ?? null,
    warehouseId: session.warehouse_id || session.warehouse?.id || '',
    warehouseName: session.warehouse?.name || session.warehouse_name || '',
    date: session.date,
    lastLoadedAt: session.last_loaded_at || session.loaded_at || null,
    // Raw backend status - the UI treats anything other than "active" as a closed / read-only
    // session (§17). Lifecycle names are NOT invented here.
    status: session.status || 'active',
    items: (session.items || []).map(normalizeSessionItem),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }
}

// POST /vehicle-stock/loading — manual / ad-hoc vehicle loading session.
//
// ⚠️ NOT the delivery path. A planned delivery is loaded through
// POST /deliveries/{id}/load (see api/deliveries.js loadDeliveryOntoVehicle), which performs
// the warehouse -> vehicle stock movement AND advances the delivery. This endpoint is only
// for backend-expected manual sessions (e.g. a van doing ad-hoc field sales with no delivery
// behind it). NEVER call this for units already loaded via a delivery - it would double-move
// stock. Currently no screen calls this; the Vehicle Stock UI only READS the session.
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
    // A 404 just means the partner has not recorded an opening load yet - that's an
    // empty state, not a failure the user needs to retry.
    if (error.response?.status === 404) {
      return { success: true, session: null }
    }

    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicle stock. Please try again.',
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
    const queryParams = { page_size: params.page_size || 100 }
    if (params.delivery_partner_id) queryParams.delivery_partner_id = params.delivery_partner_id
    if (params.status) queryParams.status = params.status

    const { data } = await apiClient.get('/vehicle-stock', {
      headers: authHeader(),
      params: queryParams,
    })

    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return { success: true, sessions: rows.map(normalizeSession), total: data?.total ?? rows.length }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicle stock sessions. Please try again.',
    )

    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------------------------
// Admin Vehicle Stock list endpoints (permission vehicle_stock.view)
//   GET /vehicle-stock/today     -> plain array, active runs first then newest
//   GET /vehicle-stock/history   -> { items, total, page, page_size, total_pages }
//   GET /vehicle-stock/{id}      -> one session (same shape as /vehicle-stock/current/{partner}),
//                                   active OR closed
// Both lists return the same row shape (see normalizeStockRow). `date` is UTC.
// ---------------------------------------------------------------------------------------------
function normalizeStockRow(row) {
  if (!row) return row

  return {
    id: row.id,
    date: row.date,
    vehicleId: row.vehicle_id || '',
    vehicleNumber: row.vehicle_number || '',
    deliveryPartnerId: row.delivery_partner_id || '',
    driverName: row.driver_name || '',
    warehouseId: row.warehouse_id || '',
    orderUnits: Number(row.order_units) || 0,
    loadedUnits: Number(row.loaded_units) || 0,
    deliveredUnits: Number(row.delivered_units) || 0,
    returnedUnits: Number(row.returned_units) || 0,
    availableUnits: Number(row.available_units) || 0,
    itemCount: Number(row.item_count) || 0,
    status: String(row.status || 'active').toLowerCase(),
    updatedAt: row.updated_at,
  }
}

export async function getVehicleStockToday() {
  try {
    const { data } = await apiClient.get('/vehicle-stock/today', { headers: authHeader() })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return { success: true, rows: rows.map(normalizeStockRow) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        "Unable to load today's vehicle load information. Please try again.",
      ),
    }
  }
}

// params: page, pageSize (max 100), search, dateFrom/dateTo (YYYY-MM-DD), vehicleId,
// deliveryPartnerId, status ('active'|'closed'), sortBy (date|vehicle_number|delivery_partner|
// status|updated_at), sortOrder (asc|desc). Only non-empty values are sent.
export async function getVehicleStockHistory(params = {}) {
  try {
    const queryParams = {
      page: params.page || 1,
      page_size: Math.min(Number(params.pageSize) || 25, 100),
    }
    if (params.search) queryParams.search = params.search
    if (params.dateFrom) queryParams.date_from = params.dateFrom
    if (params.dateTo) queryParams.date_to = params.dateTo
    if (params.vehicleId) queryParams.vehicle_id = params.vehicleId
    if (params.deliveryPartnerId) queryParams.delivery_partner_id = params.deliveryPartnerId
    if (params.status) queryParams.status = params.status
    if (params.sortBy) {
      queryParams.sort_by = params.sortBy
      queryParams.sort_order = params.sortOrder || 'asc'
    }

    const { data } = await apiClient.get('/vehicle-stock/history', { headers: authHeader(), params: queryParams })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []

    return {
      success: true,
      rows: rows.map(normalizeStockRow),
      total: data?.total ?? rows.length,
      page: data?.page ?? queryParams.page,
      pageSize: data?.page_size ?? queryParams.page_size,
      totalPages: data?.total_pages ?? 1,
    }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load vehicle load history. Please try again.',
      ),
    }
  }
}

export async function getVehicleStockSession(sessionId) {
  try {
    const { data } = await apiClient.get(`/vehicle-stock/${encodeURIComponent(sessionId)}`, { headers: authHeader() })
    return { success: true, session: normalizeSession(data) }
  } catch (error) {
    // 404 = no such session (or not in this organization) - an empty state, not a retry-able failure.
    if (error.response?.status === 404) return { success: true, session: null }

    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load this vehicle load. Please try again.',
      ),
    }
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
