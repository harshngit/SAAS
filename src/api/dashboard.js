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

// GET /dashboard/admin - 11 blocks: filters, summary, orders, cashflow, receivables_payables,
// top_customers, top_products, expense_breakdown, sales_trend, stock_watch, recent_orders.
// branch_id is accepted by the backend but doesn't currently narrow anything (no record carries
// a branch yet) - passed through anyway in case that changes.
export async function getAdminDashboard(params = {}) {
  try {
    const queryParams = {}
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to
    if (params.customer_id) queryParams.customer_id = params.customer_id
    if (params.supplier_id) queryParams.supplier_id = params.supplier_id
    if (params.warehouse_id) queryParams.warehouse_id = params.warehouse_id
    if (params.branch_id) queryParams.branch_id = params.branch_id

    const { data } = await apiClient.get('/dashboard/admin', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, dashboard: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load the dashboard. Please try again.',
    )

    return { success: false, error: message }
  }
}
