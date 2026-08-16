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

export const DELIVERY_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'loaded', label: 'Loaded' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function normalizeDeliveryItem(item) {
  if (!item) return item

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || item.name || '',
    plannedQuantity: item.planned_quantity ?? item.quantity ?? 0,
    loadedQuantity: item.loaded_quantity ?? 0,
    deliveredQuantity: item.delivered_quantity ?? 0,
    unitPrice: item.unit_price ?? 0,
  }
}

function normalizeDelivery(delivery) {
  if (!delivery) return delivery

  return {
    id: delivery.id,
    orderId: delivery.order_id || '',
    orderNumber: delivery.order_number || delivery.order?.order_number || '',
    customerName: delivery.customer?.name || delivery.customer_name || '',
    status: delivery.status || 'planned',
    deliveryPartnerId: delivery.delivery_partner_id || delivery.delivery_partner?.id || '',
    deliveryPartnerName: delivery.delivery_partner?.name || '',
    vehicleId: delivery.vehicle_id || delivery.vehicle?.id || '',
    vehicleNumber: delivery.vehicle?.vehicle_number || '',
    warehouseId: delivery.warehouse_id || '',
    scheduledDate: delivery.scheduled_date,
    deliveryAddress: delivery.delivery_address || '',
    notes: delivery.notes || '',
    items: (delivery.items || []).map(normalizeDeliveryItem),
    plannedTotal: delivery.planned_total ?? 0,
    loadedTotal: delivery.loaded_total ?? 0,
    deliveredTotal: delivery.delivered_total ?? 0,
    amountDue: delivery.amount_due ?? 0,
    pod: delivery.pod || null,
    dispatchedAt: delivery.dispatched_at || null,
    createdAt: delivery.created_at,
    updatedAt: delivery.updated_at,
  }
}

export async function listDeliveries(params = {}) {
  try {
    const queryParams = {}
    if (params.status) queryParams.status = params.status
    if (params.order_id) queryParams.order_id = params.order_id
    if (params.delivery_partner_id) queryParams.delivery_partner_id = params.delivery_partner_id
    if (params.open_only !== undefined) queryParams.open_only = params.open_only

    const { data } = await apiClient.get('/deliveries', {
      headers: authHeader(),
      params: queryParams,
    })

    const deliveries = Array.isArray(data) ? data : data?.deliveries || []
    return { success: true, deliveries: deliveries.map(normalizeDelivery) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load deliveries. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getDelivery(deliveryId) {
  try {
    const { data } = await apiClient.get(`/deliveries/by-id/${deliveryId}`, {
      headers: authHeader(),
    })

    return { success: true, delivery: normalizeDelivery(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load delivery details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function planDelivery(payload) {
  try {
    const requestBody = {
      order_id: payload.orderId || payload.order_id,
    }

    if (payload.deliveryPartnerId || payload.delivery_partner_id) requestBody.delivery_partner_id = payload.deliveryPartnerId || payload.delivery_partner_id
    if (payload.vehicleId || payload.vehicle_id) requestBody.vehicle_id = payload.vehicleId || payload.vehicle_id
    if (payload.warehouseId || payload.warehouse_id) requestBody.warehouse_id = payload.warehouseId || payload.warehouse_id
    if (payload.scheduledDate || payload.scheduled_date) requestBody.scheduled_date = payload.scheduledDate || payload.scheduled_date
    if (payload.deliveryAddress || payload.delivery_address) requestBody.delivery_address = payload.deliveryAddress || payload.delivery_address
    if (payload.notes) requestBody.notes = payload.notes

    const { data } = await apiClient.post('/deliveries', requestBody, {
      headers: authHeader(),
    })

    return { success: true, delivery: normalizeDelivery(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to plan delivery. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateDeliveryPlan(deliveryId, payload) {
  try {
    const requestBody = {}

    if (payload.deliveryPartnerId || payload.delivery_partner_id) requestBody.delivery_partner_id = payload.deliveryPartnerId || payload.delivery_partner_id
    if (payload.vehicleId || payload.vehicle_id) requestBody.vehicle_id = payload.vehicleId || payload.vehicle_id
    if (payload.scheduledDate || payload.scheduled_date) requestBody.scheduled_date = payload.scheduledDate || payload.scheduled_date
    if (payload.deliveryAddress || payload.delivery_address) requestBody.delivery_address = payload.deliveryAddress || payload.delivery_address
    if (payload.notes !== undefined) requestBody.notes = payload.notes
    if (payload.status) requestBody.status = payload.status

    const { data } = await apiClient.patch(`/deliveries/by-id/${deliveryId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, delivery: normalizeDelivery(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update delivery. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function dispatchDelivery(deliveryId) {
  return updateDeliveryPlan(deliveryId, { status: 'in_transit' })
}

export async function loadDeliveryOntoVehicle(deliveryId) {
  try {
    const { data } = await apiClient.post(`/deliveries/${deliveryId}/load`, {}, {
      headers: authHeader(),
    })

    return { success: true, delivery: normalizeDelivery(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load delivery onto the vehicle. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function confirmDelivery(deliveryId, payload) {
  try {
    const requestBody = {
      failed: Boolean(payload.failed),
    }

    if (!payload.failed) {
      requestBody.items = (payload.items || []).map((item) => ({
        delivery_item_id: item.deliveryItemId || item.delivery_item_id,
        delivered_quantity: Number(item.deliveredQuantity ?? item.delivered_quantity) || 0,
      }))
    }

    if (payload.podPhotoFileIds?.length) requestBody.pod_photo_file_ids = payload.podPhotoFileIds
    if (payload.signatureFileId) requestBody.signature_file_id = payload.signatureFileId
    if (payload.notes) requestBody.notes = payload.notes
    if (payload.failed && payload.failureReason) requestBody.failure_reason = payload.failureReason

    const { data } = await apiClient.post(`/deliveries/${deliveryId}/confirm`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, delivery: normalizeDelivery(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to confirm delivery. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function downloadDeliveryChallan(deliveryId) {
  try {
    const response = await apiClient.get(`/deliveries/${deliveryId}/challan/pdf`, {
      headers: authHeader(),
      responseType: 'blob',
    })

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `delivery-challan-${deliveryId}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to download delivery challan. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Order-shaped convenience list for a delivery partner's "what's on my plate today" view.
function normalizeAssignedOrder(order) {
  if (!order) return order

  return {
    id: order.id,
    orderNumber: order.order_number || order.id,
    customerName: order.customer?.name || order.customer_name || '',
    fulfilmentStatus: order.fulfilment_status || 'not_started',
    deliveryDate: order.delivery_date,
    total: order.total ?? 0,
  }
}

export async function getAssignedDeliveries() {
  try {
    const { data } = await apiClient.get('/deliveries/assigned', {
      headers: authHeader(),
    })

    const orders = Array.isArray(data) ? data : data?.orders || []
    return { success: true, orders: orders.map(normalizeAssignedOrder) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load your assigned deliveries. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Legacy order-keyed status route - kept for the simplified "just mark it delivered" case.
export async function updateDeliveryStatusLegacy(orderId, status, reason) {
  try {
    const { data } = await apiClient.patch(`/deliveries/${orderId}/status`, { status, reason: reason || undefined }, {
      headers: authHeader(),
    })

    return { success: true, result: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update delivery status. Please try again.',
    )

    return { success: false, error: message }
  }
}
