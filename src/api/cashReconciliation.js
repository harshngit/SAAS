import { apiClient } from './client'
import {
  CASH_RECON_DEMO_ENABLED,
  closeDemoCashReconciliation,
  createDemoCashReconciliation,
  deleteDemoCashReconciliation,
  demoCashReconciliationForDate,
  demoCashReconciliationPreview,
  getDemoCashReconciliation,
  listDemoCashReconciliations,
  updateDemoCashReconciliation,
} from '../features/reconciliation/cashReconciliationDemoData'

// =============================================================================
// Cash Reconciliation - day-close physical cash/drawer reconciliation, backed by the real,
// persisted GET/POST /cash-reconciliation contract. This is a SEPARATE feature from Collection
// Reconciliation (src/api/deliveryCollections.js's listCollections/listDeliveryCollections,
// matching recorded delivery-partner cash collections against deposits) - never conflate the two.
// =============================================================================

export { CASH_RECON_DEMO_ENABLED }

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
      return formatApiError(errorData.message || errorData.error)
    }
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }

  return String(errorData)
}

function errorResult(error, fallbackMessage) {
  const errorData = error.response?.data
  return {
    success: false,
    error: formatApiError(errorData?.detail || errorData?.message || errorData?.error || errorData, fallbackMessage),
    status: error.response?.status,
  }
}

// Monetary fields arrive from the backend as decimal STRINGS ("50000.00"), never numbers.
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeUserBrief(raw) {
  if (!raw) return null
  return { id: raw.id, name: raw.name || '', email: raw.email || '' }
}

function normalizeDetail(raw) {
  return {
    id: raw?.id ?? null,
    paymentMethod: raw?.payment_method || '',
    expectedAmount: toNumber(raw?.expected_amount),
    actualAmount: toNumber(raw?.actual_amount),
    varianceAmount: toNumber(raw?.variance_amount),
    notes: raw?.notes || '',
  }
}

// The one place a real CashReconciliationOut is shaped into the frontend's canonical
// (camelCase, numeric) model - demo data is already produced directly in this same shape, so
// every caller (CashReconciliation.jsx) works identically regardless of DEMO_MODE.
export function normalizeCashReconciliation(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    organizationId: raw.organization_id || null,
    reconciliationDate: raw.reconciliation_date || '',
    status: raw.status || 'draft',
    totalExpectedCollections: toNumber(raw.total_expected_collections),
    totalActualCollections: toNumber(raw.total_actual_collections),
    collectionsVariance: toNumber(raw.collections_variance),
    openingBalance: toNumber(raw.opening_balance),
    cashSales: toNumber(raw.cash_sales),
    cashReceived: toNumber(raw.cash_received),
    cashPaid: toNumber(raw.cash_paid),
    expensesPaid: toNumber(raw.expenses_paid),
    expectedClosingCash: toNumber(raw.expected_closing_cash),
    actualCashOnHand: toNumber(raw.actual_cash_on_hand),
    cashBalanceVariance: toNumber(raw.cash_balance_variance),
    varianceReason: raw.variance_reason || '',
    notes: raw.notes || '',
    createdById: raw.created_by_id || null,
    closedById: raw.closed_by_id || null,
    createdBy: normalizeUserBrief(raw.created_by),
    closedBy: normalizeUserBrief(raw.closed_by),
    closedAt: raw.closed_at || null,
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
    details: Array.isArray(raw.details) ? raw.details.map(normalizeDetail) : [],
  }
}

function normalizePreview(raw) {
  return {
    reconciliationDate: raw.reconciliation_date || '',
    totalExpectedCollections: toNumber(raw.total_expected_collections),
    details: Array.isArray(raw.details) ? raw.details.map(normalizeDetail) : [],
    openingBalance: toNumber(raw.opening_balance),
    cashSales: toNumber(raw.cash_sales),
    cashReceived: toNumber(raw.cash_received),
    cashPaid: toNumber(raw.cash_paid),
    expensesPaid: toNumber(raw.expenses_paid),
    expectedClosingCash: toNumber(raw.expected_closing_cash),
  }
}

// GET /cash-reconciliation/preview - what a brand-new draft for this date would look like
// (expected collections by method + the cash-closing-balance movement fields) before anything
// is saved. No id/status/actuals - those only exist once a real record is created.
export async function getCashReconciliationPreview(date) {
  if (CASH_RECON_DEMO_ENABLED) return demoCashReconciliationPreview(date)
  try {
    const { data } = await apiClient.get('/cash-reconciliation/preview', { params: { reconciliation_date: date } })
    return { success: true, preview: normalizePreview(data) }
  } catch (error) {
    return errorResult(error, 'Unable to load the expected totals for this date.')
  }
}

// GET /cash-reconciliation/for-date/{date} - the real record for this date if one exists
// (draft or closed). A 404 means "nothing saved for this date yet" - resolved as success with a
// null reconciliation, NOT an error, so the caller can fall straight through to the preview.
export async function getCashReconciliationForDate(date, refresh = true) {
  if (CASH_RECON_DEMO_ENABLED) return demoCashReconciliationForDate(date)
  try {
    const { data } = await apiClient.get(`/cash-reconciliation/for-date/${encodeURIComponent(date)}`, { params: { refresh } })
    return { success: true, reconciliation: normalizeCashReconciliation(data) }
  } catch (error) {
    if (error.response?.status === 404) return { success: true, reconciliation: null }
    return errorResult(error, 'Unable to load the reconciliation for this date.')
  }
}

export async function listCashReconciliations(params = {}) {
  if (CASH_RECON_DEMO_ENABLED) return listDemoCashReconciliations(params)
  try {
    const queryParams = { page_size: params.page_size || 25, page: params.page || 1 }
    if (params.date_from) queryParams.date_from = params.date_from
    if (params.date_to) queryParams.date_to = params.date_to
    if (params.status) queryParams.status = params.status

    const { data } = await apiClient.get('/cash-reconciliation', { params: queryParams })
    const rows = Array.isArray(data?.items) ? data.items : []
    return {
      success: true,
      reconciliations: rows.map(normalizeCashReconciliation),
      total: data?.total ?? rows.length,
      page: data?.page ?? 1,
      pageSize: data?.page_size ?? rows.length,
      totalPages: data?.total_pages ?? 1,
    }
  } catch (error) {
    return errorResult(error, 'Unable to load reconciliation history.')
  }
}

export async function getCashReconciliation(id, refresh = true) {
  if (CASH_RECON_DEMO_ENABLED) return getDemoCashReconciliation(id)
  try {
    const { data } = await apiClient.get(`/cash-reconciliation/${encodeURIComponent(id)}`, { params: { refresh } })
    return { success: true, reconciliation: normalizeCashReconciliation(data) }
  } catch (error) {
    return errorResult(error, 'Unable to load this reconciliation.')
  }
}

// `details` here is the frontend row shape ({paymentMethod, actualAmount, ...}) - only
// paymentMethod + actualAmount are ever sent; expected amounts are never frontend-authoritative.
function buildDetailsPayload(detailRows) {
  return (detailRows || [])
    .filter((row) => row.paymentMethod)
    .map((row) => ({ payment_method: row.paymentMethod, actual_amount: Number(row.actualAmount) || 0 }))
}

export async function createCashReconciliation(payload) {
  if (CASH_RECON_DEMO_ENABLED) return createDemoCashReconciliation(payload)
  try {
    const body = {
      reconciliation_date: payload.reconciliationDate,
      opening_balance: Number(payload.openingBalance) || 0,
      actual_cash_on_hand: Number(payload.actualCashOnHand) || 0,
      details: buildDetailsPayload(payload.details),
      variance_reason: payload.varianceReason || null,
      notes: payload.notes || null,
    }
    const { data } = await apiClient.post('/cash-reconciliation', body)
    return { success: true, reconciliation: normalizeCashReconciliation(data) }
  } catch (error) {
    return errorResult(error, 'Unable to save this reconciliation draft.')
  }
}

export async function updateCashReconciliation(id, payload) {
  if (CASH_RECON_DEMO_ENABLED) return updateDemoCashReconciliation(id, payload)
  try {
    const body = {
      opening_balance: Number(payload.openingBalance) || 0,
      actual_cash_on_hand: Number(payload.actualCashOnHand) || 0,
      details: buildDetailsPayload(payload.details),
      variance_reason: payload.varianceReason || null,
      notes: payload.notes || null,
    }
    const { data } = await apiClient.patch(`/cash-reconciliation/${encodeURIComponent(id)}`, body)
    return { success: true, reconciliation: normalizeCashReconciliation(data) }
  } catch (error) {
    return errorResult(error, 'Unable to save this reconciliation draft.')
  }
}

export async function closeCashReconciliation(id, payload = {}) {
  if (CASH_RECON_DEMO_ENABLED) return closeDemoCashReconciliation(id, payload)
  try {
    const body = {
      opening_balance: payload.openingBalance !== undefined ? Number(payload.openingBalance) || 0 : undefined,
      actual_cash_on_hand: payload.actualCashOnHand !== undefined ? Number(payload.actualCashOnHand) || 0 : undefined,
      details: payload.details ? buildDetailsPayload(payload.details) : undefined,
      variance_reason: payload.varianceReason || null,
      notes: payload.notes || null,
    }
    const { data } = await apiClient.post(`/cash-reconciliation/${encodeURIComponent(id)}/close`, body)
    return { success: true, reconciliation: normalizeCashReconciliation(data) }
  } catch (error) {
    return errorResult(error, 'Unable to close this reconciliation.')
  }
}

export async function deleteCashReconciliation(id) {
  if (CASH_RECON_DEMO_ENABLED) return deleteDemoCashReconciliation(id)
  try {
    await apiClient.delete(`/cash-reconciliation/${encodeURIComponent(id)}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Unable to delete this reconciliation draft.')
  }
}
