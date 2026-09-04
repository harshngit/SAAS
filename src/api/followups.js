import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { normalizeFollowUp } from './visits'

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

export const FOLLOW_UP_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function buildFollowUpBody(payload) {
  const body = {
    title: (payload.title || '').trim(),
    due_date: payload.dueDate || payload.due_date,
    priority: payload.priority || 'medium',
  }

  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId
  // A follow-up can now hang directly off an unconverted Lead (POST /follow-ups + lead_id) -
  // no customer_id / visit_id required. The backend resolves assignment from the lead's
  // assigned salesperson when assigned_to_id is omitted.
  const leadId = payload.leadId || payload.lead_id
  if (leadId) body.lead_id = leadId
  const visitId = payload.visitId || payload.visit_id
  if (visitId) body.visit_id = visitId
  if (payload.description !== undefined) body.description = payload.description || ''
  const assignedToId = payload.assigneeId || payload.assigned_to_id
  if (assignedToId) body.assigned_to_id = assignedToId
  if (payload.status) body.status = payload.status

  return body
}

// Standalone follow-up task, not linked to any visit - use createVisitFollowUp() in
// api/visits.js when the task should hang off a specific visit record instead.
export async function createFollowUp(payload) {
  try {
    const { data } = await apiClient.post('/follow-ups', buildFollowUpBody(payload), {
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

export async function listFollowUps(params = {}) {
  try {
    const queryParams = {}
    if (params.customerId || params.customer_id) queryParams.customer_id = params.customerId || params.customer_id
    if (params.leadId || params.lead_id) queryParams.lead_id = params.leadId || params.lead_id
    if (params.visitId || params.visit_id) queryParams.visit_id = params.visitId || params.visit_id
    if (params.assignedToId || params.assigned_to_id) queryParams.assigned_to_id = params.assignedToId || params.assigned_to_id
    if (params.status) queryParams.status = params.status
    if (params.priority) queryParams.priority = params.priority

    const { data } = await apiClient.get('/follow-ups', {
      headers: authHeader(),
      params: queryParams,
    })

    const followUps = Array.isArray(data) ? data : data?.follow_ups || []
    return { success: true, followUps: followUps.map(normalizeFollowUp) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load follow-up tasks. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateFollowUp(followUpId, payload) {
  try {
    const { data } = await apiClient.patch(`/follow-ups/${followUpId}`, buildFollowUpBody(payload), {
      headers: authHeader(),
    })

    return { success: true, followUp: normalizeFollowUp(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update the follow-up task. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function completeFollowUp(followUpId, payload = {}) {
  try {
    const body = {}
    if (payload.outcome) body.outcome = payload.outcome
    if (payload.outcomeNotes) body.outcome_notes = payload.outcomeNotes

    const { data } = await apiClient.post(`/follow-ups/${followUpId}/complete`, body, {
      headers: authHeader(),
    })

    return { success: true, followUp: normalizeFollowUp(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to mark the follow-up task as complete. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteFollowUp(followUpId) {
  try {
    await apiClient.delete(`/follow-ups/${followUpId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete the follow-up task. Please try again.',
    )

    return { success: false, error: message }
  }
}
