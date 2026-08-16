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

function buildReceiptBody(payload) {
  const body = {
    amount_received: Number(payload.amountReceived ?? payload.amount_received) || 0,
  }

  const invoiceRef = payload.invoiceReferenceId || payload.invoice_reference_id
  if (invoiceRef) body.invoice_reference_id = invoiceRef

  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId

  if (payload.paymentMethod || payload.payment_method) body.payment_method = payload.paymentMethod || payload.payment_method
  if (payload.transactionReference || payload.transaction_reference) {
    body.transaction_reference = payload.transactionReference || payload.transaction_reference
  }
  if (payload.receiptDate || payload.receipt_date) body.receipt_date = payload.receiptDate || payload.receipt_date
  if (payload.note) body.note = payload.note

  return body
}

function normalizeReceipt(receipt) {
  if (!receipt) return receipt

  return {
    id: receipt.id,
    receiptNumber: receipt.receipt_number || receipt.id,
    receiptDate: receipt.receipt_date,
    customerId: receipt.customer_id || receipt.customer?.id || '',
    customerName: receipt.customer?.name || '',
    invoiceId: receipt.invoice_id || receipt.invoice_reference_id || null,
    invoiceNumber: receipt.invoice?.invoice_number || '',
    amountReceived: receipt.amount_received ?? 0,
    paymentMethod: receipt.payment_method || '',
    transactionReference: receipt.transaction_reference || '',
    note: receipt.note || '',
    invoiceTotal: receipt.invoice_total ?? null,
    totalPaid: receipt.total_paid ?? null,
    outstandingAmount: receipt.outstanding_amount ?? null,
    paymentStatus: receipt.payment_status || '',
    createdAt: receipt.created_at,
  }
}

export async function listPaymentReceipts(params = {}) {
  try {
    const queryParams = {}
    if (params.customer_id) queryParams.customer_id = params.customer_id
    if (params.invoice_id) queryParams.invoice_id = params.invoice_id

    const { data } = await apiClient.get('/payment-receipts', {
      headers: authHeader(),
      params: queryParams,
    })

    const receipts = Array.isArray(data) ? data : data?.receipts || []
    return { success: true, receipts: receipts.map(normalizeReceipt) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment receipts. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getPaymentReceipt(receiptId) {
  try {
    const { data } = await apiClient.get(`/payment-receipts/${receiptId}`, {
      headers: authHeader(),
    })

    return { success: true, receipt: normalizeReceipt(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createPaymentReceipt(payload) {
  try {
    const { data } = await apiClient.post('/payment-receipts', buildReceiptBody(payload), {
      headers: authHeader(),
    })

    return { success: true, receipt: normalizeReceipt(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record payment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePaymentReceipt(receiptId, payload) {
  try {
    const requestBody = {}
    if (payload.paymentMethod) requestBody.payment_method = payload.paymentMethod
    if (payload.transactionReference !== undefined) requestBody.transaction_reference = payload.transactionReference
    if (payload.receiptDate) requestBody.receipt_date = payload.receiptDate
    if (payload.receiptNumber) requestBody.receipt_number = payload.receiptNumber

    const { data } = await apiClient.patch(`/payment-receipts/${receiptId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, receipt: normalizeReceipt(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update payment receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deletePaymentReceipt(receiptId) {
  try {
    await apiClient.delete(`/payment-receipts/${receiptId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to void payment receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}
