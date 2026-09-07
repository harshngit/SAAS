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

const numericOrNull = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null

// Canonical vehicle master fields: vehicle_number, vehicle_type, capacity, capacity_unit,
// make, model, year, status (active|inactive|maintenance - backend syncs is_active from it),
// default_driver_id, notes. Only keys actually present in the payload are sent, so a PATCH
// never clobbers a field the form does not control.
function buildVehicleBody(payload) {
  const body = {}
  const has = (camel, snake) => payload[camel] !== undefined || payload[snake] !== undefined

  if (has('vehicleNumber', 'vehicle_number')) {
    body.vehicle_number = (payload.vehicleNumber ?? payload.vehicle_number ?? '').trim()
  }
  if (has('vehicleType', 'vehicle_type')) {
    body.vehicle_type = (payload.vehicleType ?? payload.vehicle_type ?? '').trim() || null
  }
  if (has('capacityKg', 'capacity') || payload.capacity_kg !== undefined) {
    body.capacity = numericOrNull(payload.capacity ?? payload.capacityKg ?? payload.capacity_kg)
  }
  if (has('capacityUnit', 'capacity_unit')) {
    body.capacity_unit = (payload.capacityUnit ?? payload.capacity_unit ?? '').trim() || null
  }
  if (has('make', 'make')) body.make = (payload.make ?? '').trim() || null
  if (has('model', 'model')) body.model = (payload.model ?? '').trim() || null
  if (payload.year !== undefined) body.year = numericOrNull(payload.year)
  if (has('status', 'status')) body.status = (payload.status ?? '').trim() || 'active'
  if (has('notes', 'notes')) body.notes = (payload.notes ?? '').trim() || null
  if (payload.defaultDriverId !== undefined || payload.default_driver_id !== undefined) {
    body.default_driver_id = payload.defaultDriverId || payload.default_driver_id || null
  }

  return body
}

function briefPartner(value) {
  if (!value || typeof value !== 'object') return null
  return {
    id: value.id || value.user_id || null,
    name: value.name || value.full_name || value.display_name || '',
    email: value.email || '',
    phone: value.phone || value.phone_number || '',
  }
}

function normalizeVehicle(vehicle) {
  if (!vehicle) return vehicle

  const status = String(vehicle.status || (vehicle.is_active === false ? 'inactive' : 'active')).toLowerCase()
  const assignedPartner = briefPartner(vehicle.assigned_delivery_partner || vehicle.assigned_driver)

  return {
    id: vehicle.id,
    vehicleNumber: vehicle.vehicle_number || '',
    vehicleType: vehicle.vehicle_type || '',
    capacity: vehicle.capacity ?? vehicle.capacity_kg ?? null,
    // `capacityKg` kept as an alias so existing helpers keep working.
    capacityKg: vehicle.capacity ?? vehicle.capacity_kg ?? null,
    capacityUnit: vehicle.capacity_unit || 'kg',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year ?? '',
    status,
    isActive: vehicle.is_active !== false && status !== 'inactive',
    defaultDriverId: vehicle.default_driver_id || assignedPartner?.id || '',
    assignedDeliveryPartner: assignedPartner,
    notes: vehicle.notes || '',
    createdAt: vehicle.created_at,
    updatedAt: vehicle.updated_at,
  }
}

export async function listVehicles(params = {}) {
  try {
    const queryParams = {}
    if (params.skip !== undefined) queryParams.skip = params.skip
    if (params.limit !== undefined) queryParams.limit = params.limit
    if (params.status && params.status !== 'all') queryParams.status = params.status
    if (params.search) queryParams.search = params.search
    // Legacy caller support.
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active

    const { data } = await apiClient.get('/vehicles', {
      headers: authHeader(),
      params: queryParams,
    })

    const vehicles = Array.isArray(data) ? data : data?.vehicles || []
    return { success: true, vehicles: vehicles.map(normalizeVehicle) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicles. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createVehicle(payload) {
  try {
    const { data } = await apiClient.post('/vehicles', buildVehicleBody(payload), {
      headers: authHeader(),
    })

    return { success: true, vehicle: normalizeVehicle(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to register vehicle. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getVehicle(vehicleId) {
  try {
    const { data } = await apiClient.get(`/vehicles/${vehicleId}`, {
      headers: authHeader(),
    })

    return { success: true, vehicle: normalizeVehicle(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load vehicle details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateVehicle(vehicleId, payload) {
  try {
    const { data } = await apiClient.patch(`/vehicles/${vehicleId}`, buildVehicleBody(payload), {
      headers: authHeader(),
    })

    return { success: true, vehicle: normalizeVehicle(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update vehicle. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteVehicle(vehicleId) {
  try {
    await apiClient.delete(`/vehicles/${vehicleId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete vehicle. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Assignment is a plain PATCH - the backend opens/closes the assignment-history record itself.
// `driverId` null / '' unassigns.
export async function assignVehicleDriver(vehicleId, driverId) {
  try {
    const { data } = await apiClient.patch(
      `/vehicles/${vehicleId}`,
      { default_driver_id: driverId || null },
      { headers: authHeader() },
    )
    return { success: true, vehicle: normalizeVehicle(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update the vehicle assignment. Please try again.',
    )
    return { success: false, error: message }
  }
}

function normalizeAssignment(row) {
  if (!row) return row
  return {
    id: row.id,
    vehicleId: row.vehicle_id || null,
    driverId: row.driver_id || null,
    driverName: row.driver_name || row.driver?.name || '',
    assignedById: row.assigned_by_id || null,
    assignedAt: row.assigned_at || row.created_at || null,
    unassignedAt: row.unassigned_at || null,
    notes: row.notes || '',
    isCurrent: row.is_current === true || (row.is_current == null && !row.unassigned_at),
  }
}

export async function getVehicleAssignments(vehicleId) {
  try {
    const { data } = await apiClient.get(`/vehicles/${vehicleId}/assignments`, { headers: authHeader() })
    const rows = Array.isArray(data) ? data : data?.assignments || data?.items || []
    return { success: true, assignments: rows.map(normalizeAssignment) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load assignment history. Please try again.',
      ),
    }
  }
}

function normalizeVehicleActivity(row) {
  if (!row) return row
  return {
    id: row.id,
    type: row.activity_type || row.type || row.event_type || '',
    description: row.description || row.message || '',
    createdAt: row.created_at || row.timestamp || row.occurred_at || null,
    performedBy: row.performed_by_name || row.performed_by || row.actor_name || '',
  }
}

export async function getVehicleActivity(vehicleId) {
  try {
    const { data } = await apiClient.get(`/vehicles/${vehicleId}/activity`, { headers: authHeader() })
    const rows = Array.isArray(data) ? data : data?.activity || data?.events || data?.items || []
    return { success: true, activity: rows.map(normalizeVehicleActivity) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load vehicle activity. Please try again.',
      ),
    }
  }
}
