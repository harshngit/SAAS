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

// Live schema (confirmed via /openapi.json) only exposes name/description/is_active on
// BrandCreate/BrandUpdate - no code or logo_url column exists yet despite earlier docs.
function buildBrandBody(payload) {
  const body = {
    name: payload.name?.trim() || '',
    description: payload.description?.trim() || '',
  }

  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    body.is_active = payload.isActive ?? payload.is_active
  }

  return body
}

export async function createBrand(payload) {
  try {
    const { data } = await apiClient.post('/brands', buildBrandBody(payload), {
      headers: authHeader(),
    })

    return { success: true, brand: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create brand. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listBrands(params = {}) {
  try {
    const queryParams = {}
    if (params.search) queryParams.search = params.search
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/brands', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, brands: Array.isArray(data) ? data : data?.brands || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load brands. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getBrand(brandId) {
  try {
    const { data } = await apiClient.get(`/brands/${brandId}`, {
      headers: authHeader(),
    })

    return { success: true, brand: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load brand details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateBrand(brandId, payload) {
  try {
    const { data } = await apiClient.patch(`/brands/${brandId}`, buildBrandBody(payload), {
      headers: authHeader(),
    })

    return { success: true, brand: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update brand. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteBrand(brandId) {
  try {
    await apiClient.delete(`/brands/${brandId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete brand. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteBrandsBulk(brandIds) {
  try {
    await apiClient.post('/brands/bulk-delete', { ids: brandIds }, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete selected brands. Please try again.',
    )

    return { success: false, error: message }
  }
}
