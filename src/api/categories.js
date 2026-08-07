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

function buildCategoryBody(payload) {
  return {
    name: payload.name?.trim() || payload.category_name?.trim() || '',
    image: payload.image?.trim() || payload.category_image?.trim() || '',
    description: payload.description?.trim() || payload.category_description?.trim() || '',
    subcategories: payload.subcategories || payload.sub_categories || [],
  }
}

export async function createCategory(payload) {
  try {
    const { data } = await apiClient.post('/categories', buildCategoryBody(payload), {
      headers: authHeader(),
    })

    return { success: true, category: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create category. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listCategories(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search

    const { data } = await apiClient.get('/categories', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, categories: Array.isArray(data) ? data : data?.categories || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load categories. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCategory(categoryId) {
  try {
    const { data } = await apiClient.get(`/categories/${categoryId}`, {
      headers: authHeader(),
    })

    return { success: true, category: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load category details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateCategory(categoryId, payload) {
  try {
    const { data } = await apiClient.patch(`/categories/${categoryId}`, buildCategoryBody(payload), {
      headers: authHeader(),
    })

    return { success: true, category: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update category. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteCategory(categoryId) {
  try {
    await apiClient.delete(`/categories/${categoryId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete category. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteCategoriesBulk(categoryIds) {
  try {
    await apiClient.delete('/categories/bulk', {
      headers: authHeader(),
      data: { category_ids: categoryIds },
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete selected categories. Please try again.',
    )

    return { success: false, error: message }
  }
}
