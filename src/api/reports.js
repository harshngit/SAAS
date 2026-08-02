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

export async function getReport(type, params = {}) {
  try {
    const queryParams = {}
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to

    const { data } = await apiClient.get(`/reports/${type}`, {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, report: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this report. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function exportReport(type, params = {}, format = 'pdf') {
  try {
    const response = await apiClient.get(`/reports/${type}/export`, {
      headers: authHeader(),
      params: { ...(params.date_from ? { date_from: params.date_from } : {}), ...(params.date_to ? { date_to: params.date_to } : {}), format },
      responseType: 'blob',
    })

    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${type}-report.${format === 'excel' ? 'xlsx' : 'pdf'}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    let errorData = error.response?.data

    if (errorData instanceof Blob) {
      try {
        errorData = JSON.parse(await errorData.text())
      } catch {
        errorData = null
      }
    }

    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to export this report. Please try again.',
    )

    return { success: false, error: message }
  }
}
