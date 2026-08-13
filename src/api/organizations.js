import axios from 'axios'
import { apiClient, API_BASE_URL } from './client'
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

// Admin-only, read-only, entirely derived: company, counts, storage, profile_completion,
// authorized_person, documents, addresses, recent_activity.
export async function getOrganizationOverview(activityLimit = 10) {
  try {
    const { data } = await apiClient.get('/organizations/overview', {
      headers: authHeader(),
      params: { activity_limit: activityLimit },
    })

    return { success: true, overview: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load company overview. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCurrentOrganizationState() {
  try {
    const { data } = await apiClient.get('/organizations/me', {
      headers: authHeader(),
    })

    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load current organization details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateOrganizationSettings(payload) {
  try {
    const requestBody = Object.fromEntries(
      Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value === '' ? null : value]),
    )

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

export async function uploadOrganizationLogo(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await axios.post(`${API_BASE_URL}organizations/settings/logo`, formData, {
      headers: authHeader(),
    })

    return { success: true, url: data?.url }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload company logo. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadOrganizationSignature(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await axios.post(`${API_BASE_URL}organizations/settings/signature`, formData, {
      headers: authHeader(),
    })

    return { success: true, url: data?.url }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload company signature. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadOrganizationSettingsFile(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await axios.post(`${API_BASE_URL}organizations/settings/upload-file`, formData, {
      headers: authHeader(),
    })

    return { success: true, url: data?.url }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload file. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadOrganizationOtherDocuments(files) {
  try {
    const formData = new FormData()

    files.forEach((file) => {
      formData.append('files', file)
    })

    const { data } = await axios.post(`${API_BASE_URL}organizations/settings/documents/other`, formData, {
      headers: authHeader(),
    })

    return { success: true, documents: Array.isArray(data) ? data : [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload other business documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getOrganizationOtherDocuments() {
  try {
    const { data } = await apiClient.get('/organizations/settings/documents/other', {
      headers: authHeader(),
    })

    return { success: true, documents: Array.isArray(data) ? data : [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load other business documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function clearOrganizationOtherDocuments() {
  try {
    await apiClient.delete('/organizations/settings/documents/other', {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to remove other business documents. Please try again.',
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
