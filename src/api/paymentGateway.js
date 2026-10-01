// Razorpay Part B - each organization's own connected Razorpay account (for invoice payment
// links, separate from Part A's SaaS plan payment - see api/billing.js). Secrets (key_secret,
// webhook_secret) are write-only: the backend never returns them, a saved one just shows as
// "•••• saved" and typing a new value replaces it; leaving the field blank on update keeps the
// existing stored value.
import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'

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
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function normalizeGateway(data) {
  if (!data) return data
  return {
    keyId: data.key_id || '',
    mode: data.mode || '',
    isActive: Boolean(data.is_active),
    verifiedAt: data.verified_at || null,
    configured: Boolean(data.configured),
    webhookUrl: data.webhook_url || '',
    requiredEvents: Array.isArray(data.required_events) ? data.required_events : [],
  }
}

export async function getPaymentGateway() {
  try {
    const { data } = await apiClient.get('/settings/payment-gateway', { headers: authHeader() })
    return { success: true, gateway: normalizeGateway(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment gateway settings. Please try again.',
    )
    return { success: false, error: message }
  }
}

// payload: { keyId, keySecret?, webhookSecret? } - omit a secret to keep the existing stored
// value (never send an empty string for "unchanged", only omit the field entirely).
export async function updatePaymentGateway({ keyId, keySecret, webhookSecret }) {
  try {
    const body = { key_id: keyId }
    if (keySecret) body.key_secret = keySecret
    if (webhookSecret) body.webhook_secret = webhookSecret

    const { data } = await apiClient.put('/settings/payment-gateway', body, { headers: authHeader() })
    return { success: true, gateway: normalizeGateway(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save payment gateway settings. Please try again.',
    )
    return { success: false, error: message }
  }
}

export async function deletePaymentGateway() {
  try {
    await apiClient.delete('/settings/payment-gateway', { headers: authHeader() })
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to disconnect the payment gateway. Please try again.',
    )
    return { success: false, error: message }
  }
}

export async function testPaymentGateway() {
  try {
    const { data } = await apiClient.post('/settings/payment-gateway/test', {}, { headers: authHeader() })
    return { success: true, gateway: data ? normalizeGateway(data) : null }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Invalid key id/secret.',
    )
    return { success: false, error: message }
  }
}
