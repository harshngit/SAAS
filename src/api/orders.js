import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (errorData.error === 'INSUFFICIENT_STOCK' && Array.isArray(errorData.shortages)) {
    const lines = errorData.shortages.map((shortage) => {
      const name = shortage.product_name || shortage.product_id || 'item'
      const available = shortage.available ?? shortage.available_quantity
      const requested = shortage.requested ?? shortage.requested_quantity
      return `${name} (need ${requested ?? '?'}, have ${available ?? 0})`
    })
    return `Not enough stock: ${lines.join(', ')}`
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

function extractShortages(errorData) {
  const detail = errorData?.detail && typeof errorData.detail === 'object' ? errorData.detail : errorData

  if (detail?.error === 'INSUFFICIENT_STOCK' && Array.isArray(detail.shortages)) {
    return detail.shortages.map((shortage) => ({
      productId: shortage.product_id || '',
      variantId: shortage.variant_id || '',
      productName: shortage.product_name || shortage.product_id || 'Item',
      requested: shortage.requested ?? shortage.requested_quantity ?? 0,
      available: shortage.available ?? shortage.available_quantity ?? 0,
    }))
  }

  return null
}

// Canonical public Order Status vocabulary. POST /orders always creates `draft`;
// POST /orders/{id}/confirm moves it to `confirmed`; the only other public states are
// `completed` and `cancelled`. Any legacy internal value the backend may still emit for old
// records (placed / processing / awaiting_approval / rejected) is collapsed to a canonical
// value inside normalizeOrder() - every UI component only ever sees these four.
export const ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Legacy -> canonical public status. `placed` is the OLD unconfirmed name and is NOT Draft
// under the current contract - a `placed` record has already been confirmed, so it maps to
// `confirmed`. Applied only at this API boundary (normalizeOrder).
const LEGACY_ORDER_STATUS_MAP = {
  draft: 'draft',
  placed: 'confirmed',
  processing: 'confirmed',
  awaiting_approval: 'confirmed',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
}

function canonicalOrderStatus(raw) {
  const value = String(raw || 'draft').toLowerCase()
  return LEGACY_ORDER_STATUS_MAP[value] || value
}

// Operational fulfilment states - NOT order statuses. Kept separate on purpose.
export const FULFILMENT_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'planned', label: 'Planned' },
  { value: 'loaded', label: 'Loaded' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

function buildItemBody(item) {
  const body = {
    product_id: item.productId || item.product_id,
    quantity: Math.trunc(Number(item.quantity)) || 0,
  }

  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId

  if (item.unitPrice !== undefined && item.unitPrice !== '') body.unit_price = Number(item.unitPrice)
  if (item.unit_price !== undefined && item.unit_price !== '') body.unit_price = Number(item.unit_price)

  // discount_percent (0-100) is the real input field - the backend computes the flat `discount`
  // amount itself from it. Kept `discount` as a fallback for any caller still passing a flat
  // amount directly, but discount_percent always wins when both are present.
  const discountPercent = item.discountPercent ?? item.discount_percent
  if (discountPercent !== undefined && discountPercent !== '') body.discount_percent = Number(discountPercent)
  else if (item.discount !== undefined && item.discount !== '') body.discount = Number(item.discount)

  const uom = item.uom
  if (uom) body.uom = uom

  const taxRate = item.taxRate ?? item.tax_rate
  if (taxRate !== undefined && taxRate !== '') body.tax_rate = Number(taxRate)

  return body
}

function buildOrderBody(payload) {
  const body = {
    customer_id: payload.customerId || payload.customer_id,
    fulfilment_method: payload.fulfilmentMethod || payload.fulfilment_method || 'delivery',
    source: payload.source || 'office',
    items: (payload.items || []).map(buildItemBody),
  }

  if (payload.warehouseId || payload.warehouse_id) body.warehouse_id = payload.warehouseId || payload.warehouse_id
  if (payload.quotationId || payload.quotation_id) body.quotation_id = payload.quotationId || payload.quotation_id
  if (payload.deliveryDate || payload.delivery_date) body.delivery_date = payload.deliveryDate || payload.delivery_date
  const deliveryAddress = payload.deliveryAddress ?? payload.delivery_address
  if (deliveryAddress) body.delivery_address = deliveryAddress

  // Order Flow Enhancement (backend contract §4): the canonical `delivery_method`
  // (takeaway | home_delivery) is sent alongside the legacy `fulfilment_method`
  // (pickup | delivery) - the backend keeps the two in sync and accepts either.
  const deliveryMethod = payload.deliveryMethod || payload.delivery_method
  if (deliveryMethod) body.delivery_method = deliveryMethod

  // Upfront payment (backend contract §11). `payment_method` is the canonical field;
  // `payment_type` stays for backward compatibility. `cod` is not a backend
  // payment_method enum value, so for COD only the legacy `payment_type` is sent.
  const paymentType = payload.paymentType || payload.payment_type
  if (paymentType) {
    body.payment_type = paymentType
    const canonicalMethod = payload.paymentMethod || payload.payment_method || paymentType
    if (['cash', 'credit', 'upi', 'card', 'bank_transfer'].includes(canonicalMethod)) {
      body.payment_method = canonicalMethod
    }
  }
  const paymentStatus = payload.paymentStatus || payload.payment_status
  if (paymentStatus) body.payment_status = paymentStatus
  const paidAmount = payload.paidAmount ?? payload.paid_amount
  if (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') {
    body.paid_amount = Number(paidAmount) || 0
  }

  // Optional assignment at creation - the backend creates the delivery assignment itself
  // when these are present (contract §2 / §8). No separate assign call is needed.
  const deliveryPartnerId = payload.deliveryPartnerId || payload.delivery_partner_id
  if (deliveryPartnerId) body.delivery_partner_id = deliveryPartnerId
  const vehicleId = payload.vehicleId || payload.vehicle_id
  if (vehicleId) body.vehicle_id = vehicleId
  if (payload.paymentTermsDays !== undefined || payload.payment_terms_days !== undefined) {
    body.payment_terms_days = Number(payload.paymentTermsDays ?? payload.payment_terms_days) || 0
  }
  if (payload.discount !== undefined) body.discount = Number(payload.discount) || 0
  if (payload.tax !== undefined) body.tax = Number(payload.tax) || 0
  if (payload.notes) body.notes = payload.notes
  if (payload.salespersonId || payload.salesperson_id) body.salesperson_id = payload.salespersonId || payload.salesperson_id

  return body
}

function normalizeOrderItem(item) {
  if (!item) return item

  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unit_price) || 0
  const discount = Number(item.discount) || 0
  const discountPercent = Number(item.discount_percent) || 0
  const taxRate = Number(item.tax_rate) || 0
  const subtotal = quantity * unitPrice
  const discounted = subtotal - subtotal * (discountPercent / 100)
  const fallbackLineTotal = discounted + discounted * (taxRate / 100)
  const orderedQuantity = item.ordered_quantity ?? quantity
  const deliveredQuantity = item.delivered_quantity ?? 0

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || item.name || '',
    // Order items usually carry no image / SKU - OrderDetail backfills from the product catalogue,
    // but read them here too in case the backend nests the product.
    sku: item.product_sku || item.sku || item.product?.sku || '',
    productImage:
      item.product_image || item.product?.cover_image || item.product?.image_url || item.cover_image || '',
    quantity,
    orderedQuantity,
    unitPrice,
    discount,
    discountPercent,
    costPrice: item.cost_price ?? null,
    uom: item.uom || '',
    taxRate,
    reservedQuantity: item.reserved_quantity ?? 0,
    deliveredQuantity,
    remainingQuantity: item.remaining_quantity ?? Math.max(orderedQuantity - deliveredQuantity, 0),
    lineTotal: item.line_total ?? fallbackLineTotal,
  }
}

function normalizeOrder(order) {
  if (!order) return order

  const items = (order.items || []).map(normalizeOrderItem)
  const fallbackSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const fallbackTotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

  return {
    id: order.id,
    orderNumber: order.order_number || order.sales_order_number || order.id,
    status: canonicalOrderStatus(order.status || order.order_status),
    fulfilmentStatus: order.fulfilment_status || 'not_started',
    customerId: order.customer_id || order.customer?.id || '',
    customerName: order.customer?.name || order.customer_name || '',
    warehouseId: order.warehouse_id || '',
    warehouseName: order.warehouse?.name || '',
    orderDate: order.order_date || order.created_at,
    deliveryDate: order.delivery_date,
    fulfilmentMethod: order.fulfilment_method || 'delivery',
    // Canonical Order Flow Enhancement field (backend contract §6). May be absent on
    // legacy records - isTakeawayOrder() also falls back to fulfilmentMethod.
    deliveryMethod: order.delivery_method || '',
    pickupStatus: order.pickup_status || 'not_started',
    collectedBy: order.collected_by || '',
    collectedAt: order.collected_at || null,
    pickupNotes: order.pickup_notes || '',
    paymentType: order.payment_type || '',
    paymentMethod: order.payment_method || order.payment_type || '',
    paymentTermsDays: order.payment_terms_days ?? 0,
    // Payment figures - backend is authoritative (contract §6/§11). Null when the
    // backend hasn't returned them (older records / legacy create) so the UI can hide
    // the payment rows rather than show a misleading ₹0.
    paymentStatus: order.payment_status || '',
    paidAmount: order.paid_amount ?? null,
    remainingAmount: order.remaining_amount ?? null,
    previousBalance: order.previous_balance ?? null,
    currentOrderAmount: order.current_order_amount ?? null,
    totalDue: order.total_due ?? null,
    source: order.source || 'office',
    salespersonId: order.salesperson_id || order.salesperson?.id || '',
    salespersonName: order.salesperson?.name || '',
    assignedDeliveryPartnerId: order.assigned_delivery_partner_id || order.delivery_partner?.id || '',
    assignedDeliveryPartnerName: order.delivery_partner?.name || '',
    quotationId: order.quotation_id || null,
    quotationNumber: order.quotation_number || order.quotation?.quotation_number || null,
    deliveryId: order.delivery_id || null,
    deliveryNumber: order.delivery_number || null,
    invoiceId: order.invoice_id || null,
    invoiceNumber: order.invoice_number || null,
    notes: order.notes || '',
    billingAddress: order.billing_address || '',
    deliveryAddress: order.delivery_address || '',
    paymentTerms: order.payment_terms || '',
    discount: order.discount ?? 0,
    tax: order.tax ?? 0,
    subtotal: order.subtotal ?? fallbackSubtotal,
    total: order.total ?? fallbackTotal,
    items,
    stockSummary: order.stock_summary || [],
    warnings: order.warnings || [],
    approvedAt: order.approved_at || null,
    rejectReason: order.reject_reason || '',
    // Who created the order. `created_by` is a user id; name/role are resolved in the UI.
    // The `*_name` / `*_role` reads are for when the backend later expands the creator.
    createdById: order.created_by || order.created_by_id || order.creator?.id || null,
    createdByName: order.created_by_name || order.creator?.name || order.created_by_user?.name || '',
    createdByRole: order.created_by_role || order.creator?.role || order.creator?.system_role || '',
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  }
}

export async function listOrders(params = {}) {
  try {
    const queryParams = {}
    if (params.status) queryParams.status = params.status
    if (params.fulfilment_status) queryParams.fulfilment_status = params.fulfilment_status
    if (params.customer_id) queryParams.customer_id = params.customer_id
    if (params.assigned_delivery_partner_id) queryParams.assigned_delivery_partner_id = params.assigned_delivery_partner_id
    if (params.search) queryParams.search = params.search

    const { data } = await apiClient.get('/orders', {
      headers: authHeader(),
      params: queryParams,
    })

    const orders = Array.isArray(data) ? data : data?.orders || []
    return { success: true, orders: orders.map(normalizeOrder) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load orders. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getOrder(orderId) {
  try {
    const { data } = await apiClient.get(`/orders/${orderId}`, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load order details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createOrder(payload) {
  try {
    const { data } = await apiClient.post('/orders', buildOrderBody(payload), {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const shortages = extractShortages(errorData)
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create order. Please try again.',
    )

    return shortages ? { success: false, error: message, shortages } : { success: false, error: message }
  }
}

// PATCH /orders/{id} - unlike createOrder's buildOrderBody (which always sends a full create
// payload), this only includes fields the caller actually passed, since the backend treats a
// missing field as "leave unchanged" and `items` specifically means "replace the whole line-item
// list" - never send it unless the caller is genuinely editing items. Editable per the backend
// contract: notes, payment_terms, billing_address, delivery_address, customer_id, warehouse_id,
// salesperson_id, discount, tax, items. Blocked (400) once the order is cancelled/completed, has
// an invoice, or has an out-for-delivery/loaded delivery - the backend enforces this, the
// frontend only needs to hide the action, not duplicate the rule.
function buildOrderUpdateBody(payload) {
  const body = {}

  if (payload.notes !== undefined) body.notes = payload.notes
  if (payload.paymentTerms !== undefined || payload.payment_terms !== undefined) {
    body.payment_terms = payload.paymentTerms ?? payload.payment_terms
  }
  if (payload.billingAddress !== undefined || payload.billing_address !== undefined) {
    body.billing_address = payload.billingAddress ?? payload.billing_address
  }
  if (payload.deliveryAddress !== undefined || payload.delivery_address !== undefined) {
    body.delivery_address = payload.deliveryAddress ?? payload.delivery_address
  }
  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId
  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId
  const salespersonId = payload.salespersonId || payload.salesperson_id
  if (salespersonId) body.salesperson_id = salespersonId
  if (payload.discount !== undefined && payload.discount !== '') body.discount = Number(payload.discount) || 0
  if (payload.tax !== undefined && payload.tax !== '') body.tax = Number(payload.tax) || 0
  if (Array.isArray(payload.items)) body.items = payload.items.map(buildItemBody)

  return body
}

export async function updateOrder(orderId, payload) {
  try {
    const { data } = await apiClient.patch(`/orders/${orderId}`, buildOrderUpdateBody(payload), {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const shortages = extractShortages(errorData)
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update order. Please try again.',
    )

    return shortages ? { success: false, error: message, shortages } : { success: false, error: message }
  }
}

export async function confirmOrder(orderId) {
  try {
    const { data } = await apiClient.post(`/orders/${orderId}/confirm`, {}, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to confirm order. Please try again.',
    )

    return { success: false, error: message }
  }
}

// The finalized flow has no pre-confirmation approval/rejection step - a Draft is either
// Confirmed (POST /orders/{id}/confirm) or Cancelled (PATCH /orders/{id}/cancel). There are
// no `approveOrder` / `rejectOrder` wrappers; the app never calls the /approve or /reject
// endpoints. Any legacy `rejected` status is normalized to `cancelled` at the API boundary.

export async function assignDeliveryPartner(orderId, deliveryPartnerId) {
  try {
    const { data } = await apiClient.patch(`/orders/${orderId}/assign-delivery-partner`, {
      delivery_partner_id: deliveryPartnerId,
    }, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to assign delivery partner. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Canonical pickup start (was the legacy POST /orders/{id}/pickup/pick).
export async function pickupStart(orderId) {
  try {
    const { data } = await apiClient.post(`/orders/${orderId}/pickup/start`, {}, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to start picking this order. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function pickupReady(orderId) {
  try {
    const { data } = await apiClient.post(`/orders/${orderId}/pickup/ready`, {}, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to mark this order ready for pickup. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function pickupConfirm(orderId, payload = {}) {
  try {
    const requestBody = {
      items: (payload.items || []).map((item) => ({
        order_item_id: item.orderItemId || item.order_item_id,
        collected_quantity: Number(item.collectedQuantity ?? item.collected_quantity) || 0,
      })),
    }

    if (payload.collectedBy || payload.collected_by) requestBody.collected_by = payload.collectedBy || payload.collected_by
    if (payload.notes) requestBody.notes = payload.notes

    const { data } = await apiClient.post(`/orders/${orderId}/pickup/confirm`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to confirm this pickup. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function cancelOrder(orderId, reason) {
  try {
    const { data } = await apiClient.patch(`/orders/${orderId}/cancel`, { reason: reason || undefined }, {
      headers: authHeader(),
    })

    return { success: true, order: normalizeOrder(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel order. Please try again.',
    )

    return { success: false, error: message }
  }
}
