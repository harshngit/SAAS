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

// Canonical Purchase lifecycle (backend `status`): draft -> confirmed -> closed, or -> cancelled.
export const PURCHASE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Canonical receiving status - independent of `status`, rolled up by the backend from
// confirmed GRNs. Never transitioned by Purchase confirm/close.
export const PURCHASE_RECEIVING_STATUS_CANONICAL = [
  { value: 'not_received', label: 'Not Received' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'fully_received', label: 'Fully Received' },
]

export const PURCHASE_PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

export const PURCHASE_TYPE_OPTIONS = [
  { value: 'Purchase Order', label: 'Purchase Order' },
  { value: 'Direct Purchase', label: 'Direct Purchase' },
  { value: 'Service Purchase', label: 'Service Purchase' },
  { value: 'Asset Purchase', label: 'Asset Purchase' },
]

export const PURCHASE_SHEET_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Ordered', label: 'Ordered' },
  { value: 'Received', label: 'Received' },
  { value: 'Invoiced', label: 'Invoiced' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Cancelled', label: 'Cancelled' },
]

export const PURCHASE_RECEIVING_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Completed', label: 'Completed' },
]

// Item discount/tax are entered and displayed as percentages in the UI (matching the sales
// invoice item picker convention) - the server is the source of truth for computed totals.
function buildPurchaseItemBody(item) {
  const body = {
    product_id: item.productId || item.product_id,
    quantity: Math.trunc(Number(item.quantity)) || 0,
    purchase_price: Number(item.purchasePrice ?? item.purchase_price) || 0,
  }

  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId

  if (item.discount !== undefined && item.discount !== '') body.discount = Number(item.discount) || 0
  if (item.tax !== undefined && item.tax !== '') body.tax = Number(item.tax) || 0

  return body
}

// Commercial/procurement fields only. Server-managed receiving fields (received_qty,
// remaining_qty, receiving_status) and lifecycle status are NEVER sent - a Purchase is a
// commercial order, and only a confirmed GRN moves stock or advances receiving.
function buildPurchaseBody(payload) {
  const body = {
    invoice_number: (payload.invoiceNumber || payload.invoice_number || '').trim(),
    supplier_id: payload.supplierId || payload.supplier_id,
    items: (payload.items || []).map(buildPurchaseItemBody),
  }

  const invoiceDate = payload.invoiceDate || payload.invoice_date
  if (invoiceDate) body.invoice_date = invoiceDate

  if (payload.discount !== undefined && payload.discount !== '') body.discount = Number(payload.discount) || 0
  if (payload.tax !== undefined && payload.tax !== '') body.tax = Number(payload.tax) || 0
  if (payload.notes) body.notes = payload.notes
  const attachmentUrl = payload.attachmentUrl || payload.attachment_url
  if (attachmentUrl) body.attachment_url = attachmentUrl

  const purchaseType = payload.purchaseType || payload.purchase_type
  if (purchaseType) body.purchase_type = purchaseType

  const purchaseDate = payload.purchaseDate || payload.purchase_date
  if (purchaseDate) body.purchase_date = purchaseDate

  const financialYear = payload.financialYear || payload.financial_year
  if (financialYear) body.financial_year = financialYear

  const billingAddress = payload.billingAddress || payload.billing_address
  if (billingAddress) body.billing_address = billingAddress

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId

  const purchaseAccountId = payload.purchaseAccountId || payload.purchase_account_id
  if (purchaseAccountId) body.purchase_account_id = purchaseAccountId

  return body
}

function buildReturnBody(payload) {
  return {
    items: (payload.items || []).map((item) => {
      const body = {
        product_id: item.productId || item.product_id,
        quantity: Math.trunc(Number(item.quantity)) || 0,
      }

      const variantId = item.variantId || item.variant_id
      if (variantId) body.variant_id = variantId

      return body
    }),
    reason: payload.reason || '',
  }
}

function normalizePurchaseItem(item) {
  if (!item) return item

  const orderedQty = Number(item.ordered_qty ?? item.quantity) || 0
  const purchasePrice = Number(item.purchase_price ?? item.purchasePrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.tax) || 0
  const subtotal = orderedQty * purchasePrice
  const discounted = subtotal - subtotal * (discount / 100)
  const fallbackLineTotal = discounted + discounted * (tax / 100)

  // Backend-controlled GRN rollups. `remaining_qty` is authoritative when present; otherwise
  // derive it (clamped) so a stale/partial response never renders NaN.
  const receivedQty = Number(item.received_qty) || 0
  const remainingQty =
    item.remaining_qty !== undefined && item.remaining_qty !== null
      ? Math.max(Number(item.remaining_qty) || 0, 0)
      : Math.max(orderedQty - receivedQty, 0)

  return {
    id: item.id,
    productId: item.product_id || item.productId || '',
    variantId: item.variant_id || item.variantId || '',
    productName: item.product_name || item.product?.name || item.name || '',
    sku: item.sku || item.product_sku || '',
    // `quantity` kept as an alias for the ordered quantity (existing readers).
    quantity: orderedQty,
    orderedQty,
    receivedQty,
    remainingQty,
    purchasePrice,
    discount,
    tax,
    lineTotal: item.line_total ?? item.lineTotal ?? fallbackLineTotal,
  }
}

function normalizePurchase(purchase) {
  if (!purchase) return purchase

  const items = (purchase.items || []).map(normalizePurchaseItem)
  const fallbackSubtotal = items.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0)
  const fallbackTotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const total = purchase.total ?? fallbackTotal
  const amountPaid = purchase.amount_paid ?? 0

  return {
    id: purchase.id,
    organizationId: purchase.organization_id,
    invoiceNumber: purchase.invoice_number || purchase.purchase_number || purchase.id,
    purchaseId: purchase.purchase_id || '',
    purchaseNumber: purchase.purchase_number || '',
    supplierId: purchase.supplier_id || purchase.supplier?.id || '',
    supplierName: purchase.supplier?.name || purchase.supplier_name || '',
    supplier: purchase.supplier || null,
    warehouseName: purchase.warehouse?.name || purchase.warehouse_name || '',
    invoiceDate: purchase.invoice_date,
    // Canonical lifecycle status - draft | confirmed | closed | cancelled.
    status: String(purchase.status || 'draft').toLowerCase(),
    paymentStatus: purchase.payment_status || 'unpaid',
    subtotal: purchase.subtotal ?? fallbackSubtotal,
    discount: purchase.discount ?? 0,
    tax: purchase.tax ?? 0,
    total,
    amountPaid,
    outstandingAmount: Math.max(0, total - amountPaid),
    notes: purchase.notes || '',
    attachmentUrl: purchase.attachment_url || '',
    items,
    purchaseType: purchase.purchase_type || '',
    purchaseDate: purchase.purchase_date,
    financialYear: purchase.financial_year || '',
    billingAddress: purchase.billing_address || '',
    warehouseId: purchase.warehouse_id || '',
    // Canonical receiving status - not_received | partially_received | fully_received.
    receivingStatus: String(purchase.receiving_status || 'not_received').toLowerCase(),
    receivedQty: Number(purchase.received_qty ?? purchase.total_received_qty) || items.reduce((sum, i) => sum + i.receivedQty, 0),
    orderedQty: Number(purchase.ordered_qty ?? purchase.total_ordered_qty) || items.reduce((sum, i) => sum + i.orderedQty, 0),
    remainingQty:
      purchase.remaining_qty !== undefined && purchase.remaining_qty !== null
        ? Math.max(Number(purchase.remaining_qty) || 0, 0)
        : items.reduce((sum, i) => sum + i.remainingQty, 0),
    purchaseAccountId: purchase.purchase_account_id || '',
    grnCount: Number(purchase.grn_count ?? purchase.grns_count) || 0,
    confirmedAt: purchase.confirmed_at || null,
    closedAt: purchase.closed_at || null,
    cancelledAt: purchase.cancelled_at || null,
    createdAt: purchase.created_at,
    updatedAt: purchase.updated_at,
  }
}

// Canonical Purchase list - GET /purchases (the `/purchase-invoices` alias is legacy).
export async function listPurchases(params = {}) {
  try {
    const queryParams = {}

    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) queryParams.supplier_id = supplierId
    const warehouseId = params.warehouse_id || params.warehouseId
    if (warehouseId) queryParams.warehouse_id = warehouseId
    if (params.status && params.status !== 'all') queryParams.status = params.status
    const receivingStatus = params.receiving_status || params.receivingStatus
    if (receivingStatus && receivingStatus !== 'all') queryParams.receiving_status = receivingStatus
    const paymentStatus = params.payment_status || params.paymentStatus
    if (paymentStatus && paymentStatus !== 'all') queryParams.payment_status = paymentStatus
    if (params.search) queryParams.search = params.search
    if (params.tag) queryParams.tag = params.tag
    if (params.skip !== undefined) queryParams.skip = params.skip
    if (params.limit !== undefined) queryParams.limit = params.limit

    const { data } = await apiClient.get('/purchases', {
      headers: authHeader(),
      params: queryParams,
    })

    const purchases = Array.isArray(data) ? data : data?.purchases || data?.items || []
    return { success: true, purchases: purchases.map(normalizePurchase) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchases. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Purchases filtered by supplier - used by the Supplier Detail Purchases tab. Same canonical
// route + normalizer as listPurchases.
export async function listSupplierPurchases(supplierId) {
  try {
    const { data } = await apiClient.get('/purchases', {
      headers: authHeader(),
      params: supplierId ? { supplier_id: supplierId } : {},
    })

    const purchases = Array.isArray(data) ? data : data?.purchases || data?.items || []
    return { success: true, purchases: purchases.map(normalizePurchase) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchases for this supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getPurchase(purchaseId) {
  try {
    const { data } = await apiClient.get(`/purchases/${encodeURIComponent(purchaseId)}`, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchase details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createPurchase(payload) {
  try {
    const { data } = await apiClient.post('/purchases', buildPurchaseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create purchase. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Draft only (canonical). Commercial fields; never receiving/lifecycle fields.
export async function updatePurchase(purchaseId, payload) {
  try {
    const { data } = await apiClient.patch(`/purchases/${encodeURIComponent(purchaseId)}`, buildPurchaseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update purchase. Please try again.',
    )

    return { success: false, error: message }
  }
}

async function purchaseLifecycleAction(purchaseId, action, fallback) {
  try {
    const { data } = await apiClient.post(`/purchases/${encodeURIComponent(purchaseId)}/${action}`, {}, {
      headers: authHeader(),
    })
    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      fallback,
    )
    return { success: false, error: message }
  }
}

// draft -> confirmed. ZERO stock movement (only a confirmed GRN moves stock).
export function confirmPurchase(purchaseId) {
  return purchaseLifecycleAction(purchaseId, 'confirm', 'Unable to confirm this purchase. Please try again.')
}

// confirmed + fully_received -> closed. ZERO stock movement. Backend blocks an early close.
export function closePurchase(purchaseId) {
  return purchaseLifecycleAction(purchaseId, 'close', 'Unable to close this purchase. Please try again.')
}

export async function updatePurchasePaymentStatus(purchaseId, payload) {
  try {
    const body = { payment_status: payload.paymentStatus || payload.payment_status }
    const amountPaid = payload.amountPaid ?? payload.amount_paid
    if (amountPaid !== undefined && amountPaid !== '') body.amount_paid = Number(amountPaid) || 0

    const { data } = await apiClient.patch(`/purchases/${encodeURIComponent(purchaseId)}/payment-status`, body, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update payment status. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function cancelPurchase(purchaseId, reason) {
  try {
    const { data } = await apiClient.post(`/purchases/${encodeURIComponent(purchaseId)}/cancel`, { reason: reason || undefined }, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel this purchase. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadPurchaseDocument(purchaseId, file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`/purchases/${encodeURIComponent(purchaseId)}/documents`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, document: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload document. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function returnPurchaseItems(purchaseId, payload) {
  try {
    const { data } = await apiClient.post(`/purchases/${encodeURIComponent(purchaseId)}/returns`, buildReturnBody(payload), {
      headers: authHeader(),
    })

    return { success: true, result: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to return items to supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deletePurchase(purchaseId) {
  try {
    await apiClient.delete(`/purchases/${encodeURIComponent(purchaseId)}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete this purchase. Please try again.',
    )

    return { success: false, error: message }
  }
}
