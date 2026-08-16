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

export const PURCHASE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'cancelled', label: 'Cancelled' },
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

  const purchaseStatus = payload.purchaseStatus || payload.purchase_status
  if (purchaseStatus) body.purchase_status = purchaseStatus

  const billingAddress = payload.billingAddress || payload.billing_address
  if (billingAddress) body.billing_address = billingAddress

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId

  const receivingStatus = payload.receivingStatus || payload.receiving_status
  if (receivingStatus) body.receiving_status = receivingStatus

  const purchaseAccountId = payload.purchaseAccountId || payload.purchase_account_id
  if (purchaseAccountId) body.purchase_account_id = purchaseAccountId

  const approvalStatus = payload.approvalStatus || payload.approval_status
  if (approvalStatus) body.approval_status = approvalStatus

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

  const quantity = Number(item.quantity) || 0
  const purchasePrice = Number(item.purchase_price ?? item.purchasePrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.tax) || 0
  const subtotal = quantity * purchasePrice
  const discounted = subtotal - subtotal * (discount / 100)
  const fallbackLineTotal = discounted + discounted * (tax / 100)

  return {
    id: item.id,
    productId: item.product_id || item.productId || '',
    variantId: item.variant_id || item.variantId || '',
    productName: item.product_name || item.product?.name || item.name || '',
    sku: item.sku || item.product_sku || '',
    quantity,
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
    invoiceDate: purchase.invoice_date,
    status: purchase.status || 'pending',
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
    purchaseStatus: purchase.purchase_status || '',
    billingAddress: purchase.billing_address || '',
    warehouseId: purchase.warehouse_id || '',
    receivingStatus: purchase.receiving_status || '',
    purchaseAccountId: purchase.purchase_account_id || '',
    approvalStatus: purchase.approval_status || '',
    createdAt: purchase.created_at,
    updatedAt: purchase.updated_at,
  }
}

export async function listPurchases(params = {}) {
  try {
    const queryParams = {}

    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) queryParams.supplier_id = supplierId
    if (params.status) queryParams.status = params.status
    const paymentStatus = params.payment_status || params.paymentStatus
    if (paymentStatus) queryParams.payment_status = paymentStatus
    if (params.search) queryParams.search = params.search

    const { data } = await apiClient.get('/purchase-invoices', {
      headers: authHeader(),
      params: queryParams,
    })

    const purchases = Array.isArray(data) ? data : data?.purchases || data?.purchase_invoices || []
    return { success: true, purchases: purchases.map(normalizePurchase) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchase invoices. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getPurchase(purchaseId) {
  try {
    const { data } = await apiClient.get(`/purchase-invoices/${encodeURIComponent(purchaseId)}`, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load purchase invoice details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createPurchase(payload) {
  try {
    const { data } = await apiClient.post('/purchase-invoices', buildPurchaseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create purchase invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePurchase(purchaseId, payload) {
  try {
    const { data } = await apiClient.put(`/purchase-invoices/${encodeURIComponent(purchaseId)}`, buildPurchaseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update purchase invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function approvePurchase(purchaseId) {
  try {
    const { data } = await apiClient.patch(`/purchase-invoices/${encodeURIComponent(purchaseId)}/approve`, {}, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve purchase invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePurchasePaymentStatus(purchaseId, payload) {
  try {
    const body = { payment_status: payload.paymentStatus || payload.payment_status }
    const amountPaid = payload.amountPaid ?? payload.amount_paid
    if (amountPaid !== undefined && amountPaid !== '') body.amount_paid = Number(amountPaid) || 0

    const { data } = await apiClient.patch(`/purchase-invoices/${encodeURIComponent(purchaseId)}/payment-status`, body, {
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
    const { data } = await apiClient.patch(`/purchase-invoices/${encodeURIComponent(purchaseId)}/cancel`, { reason: reason || undefined }, {
      headers: authHeader(),
    })

    return { success: true, purchase: normalizePurchase(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel purchase invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadPurchaseDocument(purchaseId, file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`/purchase-invoices/${encodeURIComponent(purchaseId)}/documents`, formData, {
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
    const { data } = await apiClient.post(`/purchase-invoices/${encodeURIComponent(purchaseId)}/returns`, buildReturnBody(payload), {
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
    await apiClient.delete(`/purchase-invoices/${encodeURIComponent(purchaseId)}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete purchase invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}
