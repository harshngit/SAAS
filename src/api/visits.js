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

export const VISIT_TYPE_OPTIONS = [
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'audit', label: 'Audit' },
]

export const VISIT_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function normalizeFollowUp(followUp) {
  if (!followUp) return followUp

  return {
    id: followUp.id,
    customerId: followUp.customer_id || followUp.customer?.id || '',
    customerName: followUp.customer?.name || '',
    visitId: followUp.visit_id || '',
    assignedToId: followUp.assigned_to_id || followUp.assigned_to?.id || '',
    assignedToName: followUp.assigned_to?.name || '',
    title: followUp.title || '',
    description: followUp.description || '',
    dueDate: followUp.due_date || '',
    priority: followUp.priority || 'medium',
    status: followUp.status || 'pending',
    completedAt: followUp.completed_at || null,
    createdAt: followUp.created_at,
  }
}

function normalizeVisit(visit) {
  if (!visit) return visit

  return {
    id: visit.id,
    customerId: visit.customer_id || visit.customer?.id || '',
    customerName: visit.customer?.name || visit.customer?.business_name || '',
    customerPhone: visit.customer?.phone || '',
    leadId: visit.lead_id || visit.lead?.id || '',
    leadName: visit.lead?.name || '',
    userId: visit.user_id || visit.user?.id || '',
    userName: visit.user?.name || '',
    visitDate: visit.visit_date,
    visitType: visit.visit_type || 'site_visit',
    purpose: visit.purpose || '',
    notes: visit.notes || '',
    outcome: visit.outcome || '',
    status: visit.status || 'completed',
    location: visit.location || '',
    followUps: (visit.follow_ups || []).map(normalizeFollowUp),
    createdAt: visit.created_at,
  }
}

function buildVisitBody(payload) {
  const body = {
    visit_date: payload.visitDate || payload.visit_date || new Date().toISOString(),
    visit_type: payload.visitType || payload.visit_type || 'site_visit',
    status: payload.status || 'completed',
  }

  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId
  const leadId = payload.leadId || payload.lead_id
  if (leadId) body.lead_id = leadId
  if (payload.purpose !== undefined) body.purpose = payload.purpose || ''
  if (payload.notes !== undefined) body.notes = payload.notes || ''
  if (payload.outcome !== undefined) body.outcome = payload.outcome || ''
  if (payload.location !== undefined) body.location = payload.location || ''

  return body
}

export async function listVisits(params = {}) {
  try {
    const queryParams = {}
    if (params.customerId || params.customer_id) queryParams.customer_id = params.customerId || params.customer_id
    if (params.leadId || params.lead_id) queryParams.lead_id = params.leadId || params.lead_id
    if (params.userId || params.user_id) queryParams.user_id = params.userId || params.user_id
    if (params.status) queryParams.status = params.status

    const { data } = await apiClient.get('/visits', {
      headers: authHeader(),
      params: queryParams,
    })

    const visits = Array.isArray(data) ? data : data?.visits || []
    return { success: true, visits: visits.map(normalizeVisit) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load visits. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getVisit(visitId) {
  try {
    const { data } = await apiClient.get(`/visits/${visitId}`, {
      headers: authHeader(),
    })

    return { success: true, visit: normalizeVisit(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load visit details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createVisit(payload) {
  try {
    const { data } = await apiClient.post('/visits', buildVisitBody(payload), {
      headers: authHeader(),
    })

    return { success: true, visit: normalizeVisit(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save the visit. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateVisit(visitId, payload) {
  try {
    const { data } = await apiClient.patch(`/visits/${visitId}`, buildVisitBody(payload), {
      headers: authHeader(),
    })

    return { success: true, visit: normalizeVisit(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update the visit. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteVisit(visitId) {
  try {
    await apiClient.delete(`/visits/${visitId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete the visit. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Creates a follow-up task directly linked to a visit (POST /visits/{visit_id}/follow-ups) -
// use createFollowUp() from api/followups.js for a standalone (no-visit) follow-up instead.
export async function createVisitFollowUp(visitId, payload) {
  try {
    const body = {
      title: (payload.title || '').trim(),
      due_date: payload.dueDate || payload.due_date,
      priority: payload.priority || 'medium',
    }

    const customerId = payload.customerId || payload.customer_id
    if (customerId) body.customer_id = customerId
    if (payload.description) body.description = payload.description.trim()
    const assignedToId = payload.assigneeId || payload.assigned_to_id
    if (assignedToId) body.assigned_to_id = assignedToId

    const { data } = await apiClient.post(`/visits/${visitId}/follow-ups`, body, {
      headers: authHeader(),
    })

    return { success: true, followUp: normalizeFollowUp(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create the follow-up task. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerVisits(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/visits`, {
      headers: authHeader(),
    })

    const visits = Array.isArray(data) ? data : data?.visits || []
    return { success: true, visits: visits.map(normalizeVisit) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this customer\'s visit history. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerFollowUps(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/follow-ups`, {
      headers: authHeader(),
    })

    const followUps = Array.isArray(data) ? data : data?.follow_ups || []
    return { success: true, followUps: followUps.map(normalizeFollowUp) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this customer\'s follow-up tasks. Please try again.',
    )

    return { success: false, error: message }
  }
}

export { normalizeFollowUp }
