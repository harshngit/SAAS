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

export async function checkIn(type) {
  try {
    const { data } = await apiClient.post('/attendance/check-in', { type }, {
      headers: authHeader(),
    })

    return { success: true, record: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record attendance. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getMyAttendance(params = {}) {
  try {
    const queryParams = {}
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to

    const { data } = await apiClient.get('/attendance/me', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, records: Array.isArray(data) ? data : data?.records || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load attendance. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getAttendance(params = {}) {
  try {
    const queryParams = {}
    if (params.user_id) queryParams.user_id = params.user_id
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to

    const { data } = await apiClient.get('/attendance', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, records: Array.isArray(data) ? data : data?.records || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load attendance. Please try again.',
    )

    return { success: false, error: message }
  }
}
