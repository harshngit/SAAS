import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

// =============================================================================
// Delivery Day-End API.
// -----------------------------------------------------------------------------
// One session per delivery partner per business day: open -> submitted -> approved,
// or submitted -> rejected -> (partner corrects + resubmits) -> submitted -> approved.
// A wholly separate concept from Cash Reconciliation / Collection Reconciliation -
// this models a daily SESSION with its own status, not an individual transaction.
//
// Endpoints:
//   GET  /delivery-day-ends/current         (?business_date, ?delivery_partner_id)
//   POST /delivery-day-ends/submit
//   GET  /delivery-day-ends                 (?status, ?delivery_partner_id, ?date_from, ?date_to, ?page, ?page_size)
//   GET  /delivery-day-ends/{id}
//   POST /delivery-day-ends/{id}/approve
//   POST /delivery-day-ends/{id}/reject
// =============================================================================

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
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

export const DAY_END_STATUS_LABEL = { open: 'Open', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' }
export const DAY_END_STATUS_VARIANT = { open: 'neutral', submitted: 'info', approved: 'success', rejected: 'danger' }

export const DAY_END_STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'open', label: 'Open' },
]

// Fixed method set + order, matching the backend's `collections.breakdown` contract exactly.
export const PAYMENT_METHODS = ['cash', 'bank', 'upi', 'cheque', 'other']
export const PAYMENT_METHOD_LABEL = { cash: 'Cash', bank: 'Bank', upi: 'UPI', cheque: 'Cheque', other: 'Other' }

function normalizeBreakdownEntry(entry) {
  const method = entry?.method || ''
  return {
    method,
    label: PAYMENT_METHOD_LABEL[method] || method,
    expected: Number(entry?.system_expected) || 0,
    handedOver: Number(entry?.actual_handed_over) || 0,
    variance: Number(entry?.variance) || 0,
  }
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return { label: String(entry ?? ''), actorName: '', at: null, note: '' }
  return {
    label: entry.action || entry.event || entry.label || entry.status || '',
    actorName: entry.actor_name || entry.by_name || entry.user_name || '',
    at: entry.at || entry.created_at || entry.timestamp || null,
    note: entry.note || entry.reason || entry.message || '',
  }
}

function normalizeDayEnd(dayEnd) {
  if (!dayEnd) return dayEnd

  const collections = dayEnd.collections || {}
  const breakdown = Array.isArray(collections.breakdown) ? collections.breakdown.map(normalizeBreakdownEntry) : []
  // Always expose all 5 methods in the fixed order, even if the backend omits a zero entry,
  // so the Delivery Partner's form always has a stable set of inputs to render.
  const breakdownByMethod = new Map(breakdown.map((entry) => [entry.method, entry]))
  const fullBreakdown = PAYMENT_METHODS.map(
    (method) => breakdownByMethod.get(method) || { method, label: PAYMENT_METHOD_LABEL[method], expected: 0, handedOver: 0, variance: 0 },
  )

  return {
    id: dayEnd.id || null,
    deliveryPartnerId: dayEnd.delivery_partner_id || '',
    deliveryPartnerName: dayEnd.delivery_partner_name || '',
    businessDate: dayEnd.business_date || '',
    status: dayEnd.status || 'open',
    deliveries: {
      assigned: dayEnd.deliveries?.assigned_count ?? 0,
      delivered: dayEnd.deliveries?.delivered_count ?? 0,
      partiallyDelivered: dayEnd.deliveries?.partially_delivered_count ?? 0,
      returned: dayEnd.deliveries?.returned_count ?? 0,
      pending: dayEnd.deliveries?.pending_count ?? 0,
    },
    breakdown: fullBreakdown,
    expectedTotal: Number(collections.expected_total) || 0,
    handedOverTotal: Number(collections.handed_over_total) || 0,
    varianceTotal: Number(collections.variance_total) || 0,
    notes: dayEnd.notes || '',
    submissionCount: dayEnd.submission_count ?? 0,
    submittedAt: dayEnd.submitted_at || null,
    reviewedAt: dayEnd.reviewed_at || null,
    reviewedByName: dayEnd.reviewed_by_name || '',
    reviewNote: dayEnd.review_note || '',
    rejectionReason: dayEnd.rejection_reason || '',
    history: Array.isArray(dayEnd.history) ? dayEnd.history.map(normalizeHistoryEntry) : [],
  }
}

export async function getCurrentDayEnd({ businessDate, deliveryPartnerId } = {}) {
  try {
    const params = {}
    if (businessDate) params.business_date = businessDate
    if (deliveryPartnerId) params.delivery_partner_id = deliveryPartnerId

    const { data } = await apiClient.get('/delivery-day-ends/current', { headers: authHeader(), params })

    return { success: true, dayEnd: normalizeDayEnd(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load today\'s day-end. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

// handedOver: { cash, bank, upi, cheque, other } (numbers). All 5 keys are always sent so the
// backend never has to guess which categories were deliberately left at 0.
export async function submitDayEnd({ businessDate, handedOver, notes }) {
  try {
    const body = {
      business_date: businessDate,
      handed_over: PAYMENT_METHODS.reduce((acc, method) => {
        acc[method] = Number(handedOver?.[method]) || 0
        return acc
      }, {}),
      notes: notes || '',
    }

    const { data } = await apiClient.post('/delivery-day-ends/submit', body, { headers: authHeader() })

    return { success: true, dayEnd: normalizeDayEnd(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to submit day-end. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function listDayEnds(params = {}) {
  try {
    const queryParams = { page_size: params.pageSize || params.page_size || 20, page: params.page || 1 }
    if (params.status) queryParams.status = params.status
    if (params.deliveryPartnerId || params.delivery_partner_id) queryParams.delivery_partner_id = params.deliveryPartnerId || params.delivery_partner_id
    if (params.dateFrom || params.date_from) queryParams.date_from = params.dateFrom || params.date_from
    if (params.dateTo || params.date_to) queryParams.date_to = params.dateTo || params.date_to

    const { data } = await apiClient.get('/delivery-day-ends', { headers: authHeader(), params: queryParams })

    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return {
      success: true,
      dayEnds: rows.map(normalizeDayEnd),
      total: data?.total ?? rows.length,
      page: data?.page ?? queryParams.page,
      pageSize: data?.page_size ?? queryParams.page_size,
      totalPages: data?.total_pages ?? 1,
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load day-ends. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getDayEnd(id) {
  try {
    const { data } = await apiClient.get(`/delivery-day-ends/${id}`, { headers: authHeader() })

    return { success: true, dayEnd: normalizeDayEnd(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this day-end. Please try again.',
    )

    return { success: false, error: message }
  }
}

// DAY_END_COLLECTIONS_CHANGED detection (crm_changes: "collections changed after submission -
// reject and ask the partner to resubmit"). The backend returns a coded detail object for this
// specific 409, same shape convention as STAFF_NOT_FOUND in api/platform.js.
export async function approveDayEnd(id, note) {
  try {
    const { data } = await apiClient.post(`/delivery-day-ends/${id}/approve`, { note: note || undefined }, { headers: authHeader() })

    return { success: true, dayEnd: normalizeDayEnd(data) }
  } catch (error) {
    const detail = error.response?.data?.detail
    if (detail && typeof detail === 'object' && detail.code === 'DAY_END_COLLECTIONS_CHANGED') {
      return {
        success: false,
        code: 'DAY_END_COLLECTIONS_CHANGED',
        error: 'Collections have changed since this day-end was submitted. Reject this submission and ask the delivery partner to resubmit.',
      }
    }

    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve this day-end. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function rejectDayEnd(id, reason) {
  try {
    const { data } = await apiClient.post(`/delivery-day-ends/${id}/reject`, { reason }, { headers: authHeader() })

    return { success: true, dayEnd: normalizeDayEnd(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reject this day-end. Please try again.',
    )

    return { success: false, error: message }
  }
}
