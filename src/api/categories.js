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
  const body = {
    name: payload.name?.trim() || payload.category_name?.trim() || '',
    image: payload.image?.trim() || payload.category_image?.trim() || '',
    description: payload.description?.trim() || payload.category_description?.trim() || '',
  }

  const parentId = payload.parentId ?? payload.parent_id
  if (parentId !== undefined) body.parent_id = parentId || null

  return body
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

// Product Type options belong to a subcategory; these are not sellable product variations.
export async function listSubcategoryVariants(subcategoryId, { includeInactive = false } = {}) {
  try {
    const { data } = await apiClient.get(`/categories/${subcategoryId}/variants`, {
      headers: authHeader(), params: { include_inactive: includeInactive },
    })
    return { success: true, variants: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load Product Types.') }
  }
}

export async function createSubcategoryVariant(subcategoryId, payload) {
  try {
    const { data } = await apiClient.post(`/categories/${subcategoryId}/variants`, {
      name: payload.name.trim(), sort_order: payload.sort_order ?? 0,
    }, { headers: authHeader() })
    return { success: true, variant: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to create Product Type.') }
  }
}

export async function getCategoryBrands(categoryId) {
  try {
    const { data } = await apiClient.get(`/categories/${categoryId}/brands`, { headers: authHeader() })
    return { success: true, brands: data }
  } catch (error) {
    return { success: false, status: error.response?.status, error: formatApiError(error.response?.data?.detail, 'Unable to load allowed brands.') }
  }
}

export async function setCategoryBrands(categoryId, ids) {
  try {
    const { data } = await apiClient.put(`/categories/${categoryId}/brands`, { brand_ids: ids }, { headers: authHeader() })
    return { success: true, brands: data }
  } catch (error) {
    const status = error.response?.status
    return { success: false, status, error: status === 409
      ? 'Someone else saved this at the same time. Reload and try again.'
      : formatApiError(error.response?.data?.detail, 'Unable to save allowed brands.') }
  }
}

export async function deleteCategoriesBulk(categoryIds) {
  try {
    await apiClient.post('/categories/bulk-delete', { ids: categoryIds }, {
      headers: authHeader(),
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
