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

function buildWarehouseBody(payload) {
  const body = {
    name: payload.name?.trim() || '',
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    contact_number: payload.contactNumber?.trim() || payload.contact_number?.trim() || null,
  }

  const code = payload.code?.trim() || ''
  if (code) body.code = code

  if (payload.isDefault !== undefined || payload.is_default !== undefined) {
    body.is_default = Boolean(payload.isDefault ?? payload.is_default)
  }

  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    body.is_active = Boolean(payload.isActive ?? payload.is_active ?? true)
  }

  return body
}

function normalizeWarehouse(warehouse) {
  if (!warehouse) return warehouse

  return {
    id: warehouse.id,
    name: warehouse.name || '',
    code: warehouse.code || '',
    address: warehouse.address || '',
    city: warehouse.city || '',
    contactNumber: warehouse.contact_number || '',
    isDefault: Boolean(warehouse.is_default),
    isActive: warehouse.is_active !== false,
    createdAt: warehouse.created_at,
    updatedAt: warehouse.updated_at,
  }
}

export async function listWarehouses(params = {}) {
  try {
    const queryParams = {}
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/warehouses', {
      headers: authHeader(),
      params: queryParams,
    })

    const warehouses = Array.isArray(data) ? data : data?.warehouses || []
    return { success: true, warehouses: warehouses.map(normalizeWarehouse) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load warehouses. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createWarehouse(payload) {
  try {
    const { data } = await apiClient.post('/warehouses', buildWarehouseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, warehouse: normalizeWarehouse(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create warehouse. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getWarehouse(warehouseId) {
  try {
    const { data } = await apiClient.get(`/warehouses/${warehouseId}`, {
      headers: authHeader(),
    })

    return { success: true, warehouse: normalizeWarehouse(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load warehouse details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateWarehouse(warehouseId, payload) {
  try {
    const { data } = await apiClient.patch(`/warehouses/${warehouseId}`, buildWarehouseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, warehouse: normalizeWarehouse(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update warehouse. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteWarehouse(warehouseId) {
  try {
    await apiClient.delete(`/warehouses/${warehouseId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete warehouse. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getWarehouseStock(params = {}) {
  try {
    const queryParams = {}
    if (params.warehouse_id) queryParams.warehouse_id = params.warehouse_id
    if (params.product_id) queryParams.product_id = params.product_id
    if (params.low_stock_only !== undefined) queryParams.low_stock_only = params.low_stock_only

    const { data } = await apiClient.get('/warehouses/stock', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, stock: Array.isArray(data) ? data : data?.stock || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load warehouse stock. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function adjustWarehouseStock(warehouseId, payload) {
  try {
    const requestBody = {
      product_id: payload.productId || payload.product_id,
      variant_id: payload.variantId || payload.variant_id || undefined,
      quantity: Math.round(Number(payload.quantity)) || 0,
      movement_type: payload.movementType || payload.movement_type || 'adjustment',
      note: payload.note || undefined,
    }

    if (payload.batch) requestBody.batch = payload.batch
    if (payload.serialNumbers || payload.serial_numbers) {
      requestBody.serial_numbers = payload.serialNumbers || payload.serial_numbers
    }

    const { data } = await apiClient.post(`/warehouses/${warehouseId}/stock/adjust`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, result: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to adjust warehouse stock. Please try again.',
    )

    return { success: false, error: message }
  }
}
