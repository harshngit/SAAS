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

function buildCustomerRequestBody(payload) {
  const name = payload.name.trim()

  return {
    name,
    business_name: (payload.businessName || payload.business_name || name).trim(),
    phone: payload.phone.trim(),
    email: payload.email?.trim().toLowerCase() || '',
    gst_number: payload.gstNumber || payload.gst_number || '',
    billing_address: payload.billingAddress?.trim() || '',
    delivery_address: payload.deliveryAddress?.trim() || payload.billingAddress?.trim() || '',
    assigned_sales_officer_id: payload.assignedSalesOfficerId || payload.assigned_sales_officer_id || '',
    credit_limit: Number(payload.creditLimit) || 0,
    category: payload.type || payload.category || '',
    notes: payload.notes?.trim() || '',
    is_active: payload.isActive ?? payload.is_active ?? payload.status !== 'inactive',
  }
}

export async function createCustomer(payload) {
  try {
    const requestBody = buildCustomerRequestBody(payload)

    const { data } = await apiClient.post('/customers', requestBody, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateCustomer(customerId, payload) {
  try {
    const { data } = await apiClient.patch(`/customers/${customerId}`, buildCustomerRequestBody(payload), {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listCustomers(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category) queryParams.category = params.category
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active
    if (params.assigned_sales_officer_id) queryParams.assigned_sales_officer_id = params.assigned_sales_officer_id

    const { data } = await apiClient.get('/customers', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, customers: Array.isArray(data) ? data : data?.customers || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customers. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomer(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}`, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customer details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteCustomer(customerId) {
  try {
    await apiClient.delete(`/customers/${customerId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function recordCustomerPayment(customerId, payload) {
  try {
    const requestBody = {
      amount: Number(payload.amount),
      payment_mode: payload.paymentMode || payload.payment_mode || 'cash',
      reference: payload.reference || '',
      note: payload.note || '',
      order_id: payload.orderId || payload.order_id || '',
      invoice_id: payload.invoiceId || payload.invoice_id || '',
      received_on: payload.receivedOn || payload.received_on || new Date().toISOString(),
    }

    const { data } = await apiClient.post(`/customers/${customerId}/payments`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record customer payment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerPayments(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/payments`, {
      headers: authHeader(),
    })

    return { success: true, payments: Array.isArray(data) ? data : data?.payments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customer payments. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerPaymentReceipt(customerId, paymentId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/payments/receipt/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, receipt: data?.url || data?.receipt_url || data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to download customer payment receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function voidCustomerPayment(customerId, paymentId) {
  try {
    const { data } = await apiClient.delete(`/customers/${customerId}/payments/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to void customer payment. Please try again.',
    )

    return { success: false, error: message }
  }
}
