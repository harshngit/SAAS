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

function buildSupplierBody(payload) {
  return {
    name: payload.name.trim(),
    contact_person: payload.contactPerson?.trim() || payload.contact_person?.trim() || null,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    gst_number: payload.gstNumber?.trim() || payload.gst_number?.trim() || null,
    category: payload.category || null,
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    opening_balance: Number(payload.openingBalance ?? payload.opening_balance) || 0,
  }
}

export async function createSupplier(payload) {
  try {
    const { data } = await apiClient.post('/suppliers', buildSupplierBody(payload), {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listSuppliers(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category) queryParams.category = params.category
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/suppliers', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, suppliers: Array.isArray(data) ? data : data?.suppliers || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load suppliers. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getSupplier(supplierId) {
  try {
    const { data } = await apiClient.get(`/suppliers/${supplierId}`, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load supplier details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSupplier(supplierId, payload) {
  try {
    const { data } = await apiClient.put(`/suppliers/${supplierId}`, buildSupplierBody(payload), {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSupplierStatus(supplierId, isActive) {
  try {
    const { data } = await apiClient.patch(`/suppliers/${supplierId}/status`, { is_active: isActive }, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update supplier status. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteSupplier(supplierId) {
  try {
    await apiClient.delete(`/suppliers/${supplierId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function recordSupplierPayment(supplierId, payload) {
  try {
    const requestBody = {
      amount: Number(payload.amount) || 0,
      payment_mode: payload.paymentMode || payload.payment_mode || 'cash',
    }

    if (payload.reference) requestBody.reference = payload.reference
    if (payload.note) requestBody.note = payload.note
    if (payload.upiId || payload.upi_id) requestBody.upi_id = payload.upiId || payload.upi_id
    if (payload.transactionReference || payload.transaction_reference) {
      requestBody.transaction_reference = payload.transactionReference || payload.transaction_reference
    }
    if (payload.cardType || payload.card_type) requestBody.card_type = payload.cardType || payload.card_type
    if (payload.cardLastFour || payload.card_last_four) {
      requestBody.card_last_four = payload.cardLastFour || payload.card_last_four
    }
    if (payload.collectionInstructions || payload.collection_instructions) {
      requestBody.collection_instructions = payload.collectionInstructions || payload.collection_instructions
    }
    if (payload.paymentStatus || payload.payment_status) {
      requestBody.payment_status = payload.paymentStatus || payload.payment_status
    }

    const paidOn = payload.paidOn || payload.paid_on
    if (paidOn) requestBody.paid_on = paidOn

    const { data } = await apiClient.post(`/suppliers/${supplierId}/payments`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record payment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getSupplierPayments(supplierId) {
  try {
    const { data } = await apiClient.get(`/suppliers/${supplierId}/payments`, {
      headers: authHeader(),
    })

    return { success: true, payments: Array.isArray(data) ? data : data?.payments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment history. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function voidSupplierPayment(supplierId, paymentId) {
  try {
    const { data } = await apiClient.delete(`/suppliers/${supplierId}/payments/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to void payment. Please try again.',
    )

    return { success: false, error: message }
  }
}
