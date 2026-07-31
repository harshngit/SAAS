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

export async function createProduct(payload) {
  try {
    const variations = (payload.variants || []).map((variant) => ({
      name: variant.size || variant.name || 'Default',
      length: Number(variant.length) || 0,
      width: Number(variant.width) || 0,
      height: Number(variant.height) || 0,
      weight: Number(variant.weight) || 0,
      price: Number(variant.sellingPrice ?? variant.price) || 0,
      inventory: Number(variant.inventory ?? variant.stock) || 0,
    }))

    const requestBody = {
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      price: Number(payload.price ?? variations[0]?.price) || 0,
      cover_image: payload.coverImage || payload.cover_image || '',
      images: payload.images || [],
      product_type: payload.productType || payload.product_type || payload.category || '',
      vendor: payload.vendor || '',
      brand: payload.brand?.trim() || '',
      sku: payload.sku || payload.variants?.[0]?.sku || '',
      category_id: payload.categoryId || payload.category_id || payload.category || '',
      total_inventory: Number(payload.totalInventory ?? payload.total_inventory) || variations.reduce((sum, variant) => sum + variant.inventory, 0),
      variations,
    }

    const { data } = await apiClient.post('/products', requestBody, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create product. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listProducts(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category_id) queryParams.category_id = params.category_id
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/products', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, products: Array.isArray(data) ? data : data?.products || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load products. Please try again.',
    )

    return { success: false, error: message }
  }
}
