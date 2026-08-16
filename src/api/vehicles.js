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

function buildVehicleBody(payload) {
  const body = {
    vehicle_number: payload.vehicleNumber?.trim() || payload.vehicle_number?.trim() || '',
    vehicle_type: payload.vehicleType?.trim() || payload.vehicle_type?.trim() || null,
    capacity_kg: payload.capacityKg !== undefined && payload.capacityKg !== ''
      ? Number(payload.capacityKg)
      : (payload.capacity_kg !== undefined && payload.capacity_kg !== '' ? Number(payload.capacity_kg) : null),
    default_driver_id: payload.defaultDriverId || payload.default_driver_id || null,
  }

  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    body.is_active = Boolean(payload.isActive ?? payload.is_active ?? true)
  }

  return body
}

function normalizeVehicle(vehicle) {
  if (!vehicle) return vehicle

  return {
    id: vehicle.id,
    vehicleNumber: vehicle.vehicle_number || '',
    vehicleType: vehicle.vehicle_type || '',
    capacityKg: vehicle.capacity_kg ?? null,
    defaultDriverId: vehicle.default_driver_id || '',
    isActive: vehicle.is_active !== false,
    createdAt: vehicle.created_at,
    updatedAt: vehicle.updated_at,
  }
}

export async function listVehicles(params = {}) {
  try {
    const queryParams = {}
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
