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

export async function createCustomer(payload) {
  try {
    const name = payload.name.trim()
    const requestBody = {
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
    }

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
