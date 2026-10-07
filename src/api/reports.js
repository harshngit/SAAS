import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { DEMO_MODE } from '../config/demoMode'
import { getDemoReport } from '../features/reports/reportsDemoData'

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

// Sends every active filter, not just date_from/date_to - the finalized backend contract accepts
// per-report filters (customer_id, status, group_by, ageing_bucket, ...) on top of the common
// date_from/date_to/search/page/page_size. Keeps valid falsy values (false, 0) that a naive
// `if (value)` check would incorrectly drop, and strips only genuinely absent ones.
export function buildReportParams(filters = {}) {
  const params = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params[key] = value
  })
  return params
}

export async function getReport(type, filters = {}) {
  // ANY demo mode (true OR empty) - never calls GET /reports/*. getDemoReport returns an
  // empty/"not available" result for report types the local demo layer doesn't simulate.
  if (DEMO_MODE) return getDemoReport(type, filters)

  try {
    const { data } = await apiClient.get(`/reports/${type}`, {
      headers: authHeader(),
      params: buildReportParams(filters),
    })

    return { success: true, report: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this report. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

function filenameFromContentDisposition(headerValue, fallback) {
  if (!headerValue) return fallback
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      // fall through to the plain filename match below
    }
  }
  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch ? plainMatch[1] : fallback
}

// Exports the FULL filtered dataset - every active filter is sent (date range, search, every
// report-specific filter, group_by), but never page/page_size: the backend export endpoint
// ignores pagination and streams the entire filtered result itself.
export async function exportReport(type, filters = {}, format = 'pdf') {
  if (DEMO_MODE) {
    return { success: false, error: 'Report export is disabled in demo mode.', demoUnavailable: true }
  }

  const { page: _page, page_size: _pageSize, ...exportFilters } = filters

  try {
    const response = await apiClient.get(`/reports/${type}/export`, {
      headers: authHeader(),
      params: { ...buildReportParams(exportFilters), format },
      responseType: 'blob',
    })

    const fallbackExt = format === 'excel' ? 'xlsx' : 'pdf'
    const filename = filenameFromContentDisposition(
      response.headers?.['content-disposition'],
      `${type}-report.${fallbackExt}`,
    )

    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
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

    // The backend's own >10,000-row message (§31) is specific and actionable - surface it
    // verbatim instead of collapsing every export failure into a generic error.
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to export this report. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}
