import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { DEMO_EMPTY, DEMO_MODE } from '../config/demoMode'
import { buildDemoAdminDashboard, emptyDemoAdminDashboard } from '../features/dashboard/adminDashboardDemoData'

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

// A scope filter can be a single id (legacy callers) or an array of ids (multi-select) - only
// sent when non-empty, as repeated query keys for an array (axios' default array serialization,
// e.g. `warehouse_id=A&warehouse_id=B`) - the backend reads these as its normal list-of-ids query
// param, the same shape FastAPI expects for `warehouse_id: list[str] = Query([])`.
function scopeParam(value) {
  if (Array.isArray(value)) return value.length > 0 ? value : undefined
  return value || undefined
}

// GET /dashboard/admin - 11 blocks: filters, summary, orders, cashflow, receivables_payables,
// top_customers, top_products, expense_breakdown, sales_trend, stock_watch, recent_orders.
// Scope filters (query params): date_from / date_to / company_id / warehouse_id / customer_id /
// supplier_id - each either a single id or an array of ids. Only non-empty filters are sent.
export async function getAdminDashboard(params = {}) {
  // ANY demo mode - never calls GET /dashboard/admin.
  if (DEMO_MODE) {
    return { success: true, dashboard: DEMO_EMPTY ? emptyDemoAdminDashboard() : buildDemoAdminDashboard(params) }
  }

  try {
    const queryParams = {}
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to
    const companyId = scopeParam(params.company_id)
    if (companyId) queryParams.company_id = companyId
    const warehouseId = scopeParam(params.warehouse_id)
    if (warehouseId) queryParams.warehouse_id = warehouseId
    const customerId = scopeParam(params.customer_id)
    if (customerId) queryParams.customer_id = customerId
    const supplierId = scopeParam(params.supplier_id)
    if (supplierId) queryParams.supplier_id = supplierId

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

    return { success: false, error: message, status: error.response?.status }
  }
}
