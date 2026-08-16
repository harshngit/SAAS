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

export const SALES_RETURN_STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'received', label: 'Received' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function buildReturnItemBody(item) {
  const body = {
    invoice_item_id: item.invoiceItemId || item.invoice_item_id,
    product_id: item.productId || item.product_id,
    quantity_returned: Number(item.quantityReturned ?? item.quantity_returned) || 0,
  }

  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId

  return body
}

function buildCreateBody(payload) {
  const body = {
    return_reason: payload.returnReason || payload.reason || payload.return_reason || '',
    return_type: payload.returnType || payload.return_type || 'Credit Note',
    items: (payload.items || []).map(buildReturnItemBody),
  }

  const invoiceReferenceId = payload.invoiceReferenceId || payload.invoice_reference_id
  if (invoiceReferenceId) body.invoice_reference_id = invoiceReferenceId

  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId

  const returnDate = payload.returnDate || payload.return_date
  if (returnDate) body.return_date = returnDate

  const returnNumber = payload.returnNumber || payload.return_number
  if (returnNumber) body.return_number = returnNumber

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId

  if (payload.notes) body.notes = payload.notes

  return body
}

function buildUpdateBody(payload) {
  const body = {}

  const returnReason = payload.returnReason || payload.reason || payload.return_reason
  if (returnReason) body.return_reason = returnReason

  const returnType = payload.returnType || payload.return_type
  if (returnType) body.return_type = returnType

  const returnDate = payload.returnDate || payload.return_date
  if (returnDate) body.return_date = returnDate

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId

  if (payload.notes !== undefined) body.notes = payload.notes

  if (Array.isArray(payload.items)) {
    body.items = payload.items.map(buildReturnItemBody)
  }

  return body
}

function buildReceiveBody(payload) {
  const body = {
    items: (payload.items || []).map((item) => {
      const itemBody = {
        return_item_id: item.returnItemId || item.return_item_id,
        received_quantity: Number(item.receivedQuantity ?? item.received_quantity) || 0,
      }

      if (item.condition) itemBody.condition = item.condition
      if (item.restock !== undefined) itemBody.restock = Boolean(item.restock)

      return itemBody
    }),
  }

  if (payload.notes) body.notes = payload.notes

  return body
}

function buildApproveBody(payload) {
  const body = {
    credit_note: payload.creditNote !== undefined ? Boolean(payload.creditNote) : true,
  }

  const warehouseId = payload.warehouseId || payload.warehouse_id
  if (warehouseId) body.warehouse_id = warehouseId

  if (payload.notes) body.notes = payload.notes

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    body.items = payload.items.map((item) => {
      const itemBody = {
        return_item_id: item.returnItemId || item.return_item_id,
      }

      if (item.condition) itemBody.condition = item.condition
      if (item.restock !== undefined) itemBody.restock = Boolean(item.restock)

      return itemBody
    })
  }

  return body
}

function normalizeSalesReturnItem(item) {
  if (!item) return item

  return {
    id: item.id,
    invoiceItemId: item.invoice_item_id || '',
    productId: item.product_id || '',
    variantId: item.variant_id || '',
    productName: item.product_name || item.product?.name || item.name || '',
    sku: item.sku || item.product_sku || '',
    quantityReturned: item.quantity_returned ?? item.quantity ?? 0,
    receivedQuantity: item.received_quantity ?? null,
    condition: item.condition || '',
    restock: Boolean(item.restock),
    unitPrice: item.unit_price ?? item.price ?? 0,
    lineTotal: item.line_total ?? item.total ?? 0,
  }
}

function normalizeSalesReturn(salesReturn) {
  if (!salesReturn) return salesReturn

  return {
    id: salesReturn.id,
    organizationId: salesReturn.organization_id,
    returnNumber: salesReturn.return_number || salesReturn.id,
    returnDate: salesReturn.return_date,
    status: salesReturn.return_status || salesReturn.status || 'requested',
    customerId: salesReturn.customer_id || salesReturn.customer?.id || '',
    customerName: salesReturn.customer?.name || salesReturn.customer?.customer_name || salesReturn.customer_name || '',
    invoiceReferenceId: salesReturn.invoice_reference_id || salesReturn.invoice?.id || '',
    invoiceNumber: salesReturn.invoice?.invoice_number || salesReturn.invoice?.number || salesReturn.invoice_number || '',
    returnReason: salesReturn.return_reason || salesReturn.reason || '',
    returnType: salesReturn.return_type || '',
    warehouseId: salesReturn.warehouse_id || '',
    receivedAt: salesReturn.received_at || null,
    approvedAt: salesReturn.approved_at || null,
    approvedBy: salesReturn.approved_by || null,
    rejectedReason: salesReturn.rejected_reason || '',
    notes: salesReturn.notes || '',
    creditNoteId: salesReturn.credit_note_id || null,
    creditAmount: salesReturn.credit_amount ?? 0,
    items: (salesReturn.items || []).map(normalizeSalesReturnItem),
    customer: salesReturn.customer || null,
    invoice: salesReturn.invoice || null,
    creditNote: salesReturn.credit_note || null,
    createdAt: salesReturn.created_at,
    updatedAt: salesReturn.updated_at,
  }
}

export async function listSalesReturns(params = {}) {
  try {
    const queryParams = {}
    if (params.status) queryParams.status = params.status
    if (params.customer_id || params.customerId) queryParams.customer_id = params.customer_id || params.customerId
    if (params.invoice_reference_id || params.invoiceReferenceId) {
      queryParams.invoice_reference_id = params.invoice_reference_id || params.invoiceReferenceId
    }

    const { data } = await apiClient.get('/sales-returns', {
      headers: authHeader(),
      params: queryParams,
    })

    const salesReturns = Array.isArray(data) ? data : data?.sales_returns || data?.items || []
    return { success: true, salesReturns: salesReturns.map(normalizeSalesReturn) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load sales returns. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getSalesReturn(returnId) {
  try {
    const { data } = await apiClient.get(`/sales-returns/${encodeURIComponent(returnId)}`, {
      headers: authHeader(),
    })

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load sales return details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createSalesReturn(payload) {
  try {
    const { data } = await apiClient.post('/sales-returns', buildCreateBody(payload), {
      headers: authHeader(),
    })

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create sales return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSalesReturn(returnId, payload) {
  try {
    const { data } = await apiClient.patch(`/sales-returns/${encodeURIComponent(returnId)}`, buildUpdateBody(payload), {
      headers: authHeader(),
    })

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update sales return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function receiveSalesReturn(returnId, payload) {
  try {
    const { data } = await apiClient.patch(
      `/sales-returns/${encodeURIComponent(returnId)}/receive`,
      buildReceiveBody(payload),
      { headers: authHeader() },
    )

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to mark sales return as received. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function approveSalesReturn(returnId, payload = {}) {
  try {
    const { data } = await apiClient.patch(
      `/sales-returns/${encodeURIComponent(returnId)}/approve`,
      buildApproveBody(payload),
      { headers: authHeader() },
    )

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve sales return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function rejectSalesReturn(returnId, reason) {
  try {
    const { data } = await apiClient.patch(
      `/sales-returns/${encodeURIComponent(returnId)}/reject`,
      { reason },
      { headers: authHeader() },
    )

    return { success: true, salesReturn: normalizeSalesReturn(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reject sales return. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteSalesReturn(returnId) {
  try {
    await apiClient.delete(`/sales-returns/${encodeURIComponent(returnId)}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete sales return. Please try again.',
    )

    return { success: false, error: message }
  }
}
