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

export async function getProduct(productId) {
  try {
    const { data } = await apiClient.get(`/products/${productId}`, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load product details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateProduct(productId, payload) {
  try {
    const requestBody = {}

    if (payload.name !== undefined) requestBody.name = payload.name.trim()
    if (payload.description !== undefined) requestBody.description = payload.description?.trim() || ''
    if (payload.price !== undefined) requestBody.price = Number(payload.price) || 0
    if (payload.coverImage !== undefined || payload.cover_image !== undefined) {
      requestBody.cover_image = payload.coverImage ?? payload.cover_image ?? ''
    }
    if (payload.images !== undefined) requestBody.images = payload.images
    if (payload.productType !== undefined || payload.product_type !== undefined || payload.category !== undefined) {
      requestBody.product_type = payload.productType || payload.product_type || payload.category || ''
    }
    if (payload.vendor !== undefined) requestBody.vendor = payload.vendor || ''
    if (payload.brand !== undefined) requestBody.brand = payload.brand?.trim() || ''
    if (payload.sku !== undefined) requestBody.sku = payload.sku || payload.variants?.[0]?.sku || ''
    if (payload.categoryId !== undefined || payload.category_id !== undefined || payload.category !== undefined) {
      requestBody.category_id = payload.categoryId || payload.category_id || payload.category || ''
    }
    if (payload.isActive !== undefined || payload.is_active !== undefined) {
      requestBody.is_active = payload.isActive ?? payload.is_active
    }
    if (payload.totalInventory !== undefined || payload.total_inventory !== undefined) {
      requestBody.total_inventory = Number(payload.totalInventory ?? payload.total_inventory) || 0
    }
    if (payload.variants !== undefined) {
      requestBody.variations = payload.variants.map((variant) => ({
        name: variant.size || variant.name || 'Default',
        length: Number(variant.length) || 0,
        width: Number(variant.width) || 0,
        height: Number(variant.height) || 0,
        weight: Number(variant.weight) || 0,
        price: Number(variant.sellingPrice ?? variant.price) || 0,
        inventory: Number(variant.inventory ?? variant.stock) || 0,
      }))

      if (requestBody.total_inventory === undefined) {
        requestBody.total_inventory = requestBody.variations.reduce((sum, variant) => sum + variant.inventory, 0)
      }
    }

    const { data } = await apiClient.patch(`/products/${productId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update product. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteProduct(productId) {
  try {
    await apiClient.delete(`/products/${productId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete product. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteProductsBulk(productIds) {
  try {
    const { data } = await apiClient.post(
      '/products/bulk-delete',
      { ids: productIds },
      { headers: authHeader() },
    )

    return { success: true, deleted: data?.deleted ?? productIds.length }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete selected products. Please try again.',
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
