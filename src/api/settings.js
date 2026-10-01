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

export async function getFieldSettings() {
  try {
    const { data } = await apiClient.get('/organizations/settings/fields', {
      headers: authHeader(),
    })

    return {
      success: true,
      fieldSettings: data?.field_settings || {},
      availableFields: data?.available_fields || {},
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load field settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateFieldSettings(fieldSettings) {
  try {
    const { data } = await apiClient.put('/organizations/settings/fields', { field_settings: fieldSettings }, {
      headers: authHeader(),
    })

    return { success: true, fieldSettings: data?.field_settings || fieldSettings }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save field settings. Please try again.',
    )

    return { success: false, error: message }
  }
}
