import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (Array.isArray(errorData)) {
    return errorData.map((item) => formatApiError(item)).filter(Boolean).join(', ')
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

export async function getOrganizationSettings() {
  try {
    const { data } = await apiClient.get('/organizations/settings', {
      headers: authHeader(),
    })

    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load company settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateOrganizationSettings(payload) {
  try {
    const requestBody = {}

    if (payload.name !== undefined) requestBody.name = payload.name || null
    if (payload.legalName !== undefined) requestBody.legal_name = payload.legalName || null
    if (payload.industry !== undefined) requestBody.industry = payload.industry || null
    if (payload.businessType !== undefined) requestBody.business_type = payload.businessType || null
    if (payload.gstNumber !== undefined) requestBody.gst_number = payload.gstNumber || null
    if (payload.panNumber !== undefined) requestBody.pan_number = payload.panNumber || null
    if (payload.address !== undefined) requestBody.address = payload.address || null
    if (payload.phone !== undefined) requestBody.phone = payload.phone || null
    if (payload.email !== undefined) requestBody.email = payload.email || null
    if (payload.financialYear !== undefined) requestBody.financial_year = payload.financialYear || null
    if (payload.logoUrl !== undefined) requestBody.logo_url = payload.logoUrl || null
    if (payload.signatureUrl !== undefined) requestBody.signature_url = payload.signatureUrl || null

    const { data } = await apiClient.put('/organizations/settings', requestBody, {
      headers: authHeader(),
    })

    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save company settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function requestPlanUpgrade({ requestedPlanId, billingCycle }) {
  try {
    const { data } = await apiClient.post('/organizations/upgrade-request', {
      requested_plan_id: requestedPlanId,
      billing_cycle: billingCycle,
    })

    return { success: true, ...data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to submit upgrade request. Please try again.',
    )

    return { success: false, error: message }
  }
}
