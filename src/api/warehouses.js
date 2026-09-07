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

// Trim a string field; return null (not '') so PATCH can clear it and empty stays out of POST.
function trimmedOrNull(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    const value = String(candidate).trim()
    return value || null
  }
  return null
}

// Backend canonical master fields (all persisted now):
//   name, code, address, city, state, pincode, country, contact_person,
//   contact_number, email, notes, is_default, is_active
// The UI keeps its own field names (managerName, contactNumber, pinCode) - map here so the
// backend naming never leaks into components.
function buildWarehouseBody(payload) {
  const body = {
    name: payload.name?.trim() || '',
    address: trimmedOrNull(payload.address),
    city: trimmedOrNull(payload.city),
    state: trimmedOrNull(payload.state),
    pincode: trimmedOrNull(payload.pinCode, payload.pincode),
    country: trimmedOrNull(payload.country),
    contact_person: trimmedOrNull(payload.managerName, payload.contactPerson, payload.contact_person),
    contact_number: trimmedOrNull(payload.contactNumber, payload.contact_number),
    email: trimmedOrNull(payload.email),
    notes: trimmedOrNull(payload.notes),
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
    state: warehouse.state || '',
    pinCode: warehouse.pincode || warehouse.pin_code || '',
    country: warehouse.country || '',
    managerName: warehouse.contact_person || '',
    contactNumber: warehouse.contact_number || '',
    email: warehouse.email || '',
    notes: warehouse.notes || '',
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

// -----------------------------------------------------------------------------
// Stock movement ledger.  GET /warehouses/{warehouse_id}/movements
// query: product_id, variant_id, movement_type, limit, offset
// -----------------------------------------------------------------------------
function normalizeMovement(row) {
  if (!row) return row
  return {
    id: row.id,
    warehouseId: row.warehouse_id || null,
    productId: row.product_id || null,
    variantId: row.variant_id || null,
    productName: row.product_name || row.variant_name || 'Product',
    variantName: row.variant_name || '',
    movementType: row.movement_type || '',
    // Signed: positive = stock added, negative = stock removed.
    quantity: Number(row.quantity) || 0,
    balanceAfter: row.balance_after ?? row.balance ?? null,
    note: row.note || row.notes || '',
    createdBy: row.created_by_name || row.created_by || '',
    createdAt: row.created_at || null,
  }
}

export async function getWarehouseMovements(warehouseId, params = {}) {
  try {
    const queryParams = { limit: params.limit ?? 50, offset: params.offset ?? 0 }
    if (params.product_id || params.productId) queryParams.product_id = params.product_id || params.productId
    if (params.variant_id || params.variantId) queryParams.variant_id = params.variant_id || params.variantId
    if (params.movement_type || params.movementType) {
      queryParams.movement_type = params.movement_type || params.movementType
    }

    const { data } = await apiClient.get(`/warehouses/${warehouseId}/movements`, {
      headers: authHeader(),
      params: queryParams,
    })

    const rows = Array.isArray(data) ? data : data?.movements || data?.items || []
    return { success: true, movements: rows.map(normalizeMovement) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load warehouse movements. Please try again.',
    )

    return { success: false, error: message }
  }
}

// -----------------------------------------------------------------------------
// Warehouse transfers.  Lifecycle: draft -> in_transit -> received (or draft -> cancelled)
//   GET  /transfers                     (status, source_warehouse_id, destination_warehouse_id)
//   POST /transfers
//   GET  /transfers/{id}
//   POST /transfers/{id}/dispatch | /receive | /cancel   (no request body)
// -----------------------------------------------------------------------------
function nestedWarehouse(value, idFallback) {
  if (value && typeof value === 'object') {
    return { id: value.id || idFallback || null, name: value.name || '', code: value.code || '', isActive: value.is_active !== false }
  }
  return { id: idFallback || value || null, name: '', code: '', isActive: true }
}

function normalizeTransferItem(item) {
  if (!item) return item
  return {
    id: item.id,
    productId: item.product_id || null,
    variantId: item.variant_id || null,
    productName: item.product_name || '',
    variantName: item.variant_name || '',
    quantity: Number(item.quantity) || 0,
  }
}

function normalizeTransfer(raw) {
  if (!raw) return raw
  const source = nestedWarehouse(raw.source_warehouse, raw.source_warehouse_id)
  const destination = nestedWarehouse(raw.destination_warehouse, raw.destination_warehouse_id)
  return {
    id: raw.id,
    transferNumber: raw.transfer_number || raw.number || raw.id,
    status: String(raw.status || 'draft').toLowerCase(),
    notes: raw.notes || raw.note || '',
    sourceWarehouseId: source.id,
    sourceWarehouseName: source.name,
    destinationWarehouseId: destination.id,
    destinationWarehouseName: destination.name,
    items: Array.isArray(raw.items) ? raw.items.map(normalizeTransferItem) : [],
    createdBy: raw.created_by_name || raw.created_by || '',
    dispatchedBy: raw.dispatched_by_name || raw.dispatched_by || '',
    dispatchedAt: raw.dispatched_at || null,
    receivedBy: raw.received_by_name || raw.received_by || '',
    receivedAt: raw.received_at || null,
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
  }
}

function transferError(error, fallback) {
  const status = error.response?.status
  const data = error.response?.data
  const detail = data?.detail || data?.message || data?.error || data
  if (status === 404) return 'This transfer is no longer available (404). Please refresh.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return formatApiError(detail, 'This transfer has already moved to the next stage. Refreshing…')
  return formatApiError(detail, fallback)
}

export async function listTransfers(params = {}) {
  try {
    const queryParams = {}
    if (params.status && params.status !== 'all') queryParams.status = params.status
    if (params.source_warehouse_id || params.sourceWarehouseId) {
      queryParams.source_warehouse_id = params.source_warehouse_id || params.sourceWarehouseId
    }
    if (params.destination_warehouse_id || params.destinationWarehouseId) {
      queryParams.destination_warehouse_id = params.destination_warehouse_id || params.destinationWarehouseId
    }

    const { data } = await apiClient.get('/transfers', { headers: authHeader(), params: queryParams })
    const rows = Array.isArray(data) ? data : data?.transfers || data?.items || []
    return { success: true, transfers: rows.map(normalizeTransfer) }
  } catch (error) {
    return { success: false, error: transferError(error, 'Unable to load transfers. Please try again.') }
  }
}

export async function getTransfer(transferId) {
  try {
    const { data } = await apiClient.get(`/transfers/${transferId}`, { headers: authHeader() })
    return { success: true, transfer: normalizeTransfer(data) }
  } catch (error) {
    return { success: false, error: transferError(error, 'Unable to load this transfer.') }
  }
}

export async function createTransfer(payload) {
  try {
    const body = {
      source_warehouse_id: payload.sourceWarehouseId || payload.source_warehouse_id,
      destination_warehouse_id: payload.destinationWarehouseId || payload.destination_warehouse_id,
      items: (payload.items || [])
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => {
          const line = {
            product_id: item.productId || item.product_id,
            quantity: Math.round(Number(item.quantity)) || 0,
          }
          const variantId = item.variantId || item.variant_id
          if (variantId) line.variant_id = variantId
          return line
        }),
    }
    const notes = (payload.notes || '').trim?.() ?? payload.notes
    if (notes) body.notes = notes

    const { data } = await apiClient.post('/transfers', body, { headers: authHeader() })
    return { success: true, transfer: normalizeTransfer(data) }
  } catch (error) {
    return { success: false, error: transferError(error, 'Unable to create this transfer. Please try again.') }
  }
}

async function transferAction(transferId, action, fallback) {
  try {
    const { data } = await apiClient.post(`/transfers/${transferId}/${action}`, {}, { headers: authHeader() })
    return { success: true, transfer: normalizeTransfer(data) }
  } catch (error) {
    return { success: false, error: transferError(error, fallback) }
  }
}

export function dispatchTransfer(transferId) {
  return transferAction(transferId, 'dispatch', 'Unable to dispatch this transfer. Please try again.')
}

export function receiveTransfer(transferId) {
  return transferAction(transferId, 'receive', 'Unable to receive this transfer. Please try again.')
}

export function cancelTransfer(transferId) {
  return transferAction(transferId, 'cancel', 'Unable to cancel this transfer. Please try again.')
}
