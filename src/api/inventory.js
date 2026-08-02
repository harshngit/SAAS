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

export async function getStockBoard(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category_id) queryParams.category_id = params.category_id
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/inventory', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, items: Array.isArray(data) ? data : data?.items || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load the stock board. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getProductStock(productId) {
  try {
    const { data } = await apiClient.get(`/inventory/${productId}`, {
      headers: authHeader(),
    })

    return { success: true, stock: data, movements: data?.movements || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load stock details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function recordStockAdjustment(payload) {
  try {
    const requestBody = {
      product_id: payload.product_id || payload.productId,
      movement_type: payload.movement_type || payload.movementType,
      quantity: Number(payload.quantity) || 0,
    }

    const variantId = payload.variant_id ?? payload.variantId
    if (variantId) requestBody.variant_id = variantId
    if (payload.note) requestBody.note = payload.note

    const { data } = await apiClient.post('/inventory/adjustments', requestBody, {
      headers: authHeader(),
    })

    return { success: true, stock: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record the stock movement. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function setExactStock(productId, payload) {
  try {
    const requestBody = {
      quantity: Number(payload.quantity) || 0,
    }

    const variantId = payload.variant_id ?? payload.variantId
    if (variantId) requestBody.variant_id = variantId
    if (payload.note) requestBody.note = payload.note

    const { data } = await apiClient.patch(`/inventory/${productId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, stock: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update stock. Please try again.',
    )

    return { success: false, error: message }
  }
}
