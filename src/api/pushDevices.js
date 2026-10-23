import { apiClient } from './client'

// Same error-normalization convention as every other api/*.js file in this codebase (recursively
// unwraps FastAPI-style {detail: [{loc, msg, type}]} 422 errors, or a flat {error, message}
// object, into a human-readable string).
function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData

  if (Array.isArray(errorData)) {
    return errorData.map((item) => formatApiError(item)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error, fallbackMessage)
    }
    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value, fallbackMessage)}`)
      .join(', ')
  }

  return String(errorData)
}

// 201 (new device) / 200 (existing token refreshed) both resolve here identically - the backend
// response carries `id` and `token_suffix` (a short, safe-to-display tail), never the full token
// back.
export async function registerPushDevice({ token, platform = 'web', label }) {
  try {
    const { data } = await apiClient.post('/notifications/devices/register', {
      token,
      platform,
      ...(label ? { label } : {}),
    })
    return { success: true, id: data?.id, tokenSuffix: data?.token_suffix, device: data }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      status: error.response?.status,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to register this device for notifications.',
      ),
    }
  }
}

// 404 (device already gone) is treated as success - the end state the caller wants (no device
// registered) is already true.
export async function deletePushDevice(id) {
  if (!id) return { success: true }

  try {
    await apiClient.delete(`/notifications/devices/${encodeURIComponent(id)}`)
    return { success: true }
  } catch (error) {
    if (error.response?.status === 404) return { success: true }
    const errorData = error.response?.data
    return {
      success: false,
      status: error.response?.status,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to remove this device.',
      ),
    }
  }
}

// Always 200 - the interesting part is in the body, surfaced to the user as-is rather than
// reduced to a generic success/fail.
export async function sendTestPush() {
  try {
    const { data } = await apiClient.post('/notifications/devices/test')
    return {
      success: true,
      enabled: data?.enabled,
      attempted: data?.attempted,
      accepted: data?.accepted,
      invalidTokensRemoved: data?.invalid_tokens_removed,
      transientFailures: data?.transient_failures,
      detail: data?.detail,
      raw: data,
    }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to send a test notification.',
      ),
    }
  }
}
