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

export const LEAVE_TYPE_OPTIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'sick', label: 'Sick' },
  { value: 'annual', label: 'Annual' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'other', label: 'Other' },
]

export const LEAVE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Inclusive day-span preview shown client-side before submitting - the backend recomputes and
// persists the authoritative days_count itself, this is only for the live "X day(s)" UI hint.
export function calculateDaysCount(startDate, endDate) {
  if (!startDate || !endDate) return 0

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return days > 0 ? days : 0
}

function normalizeLeave(leave) {
  if (!leave) return leave

  return {
    id: leave.id,
    userId: leave.user_id || leave.user?.id || '',
    userName: leave.user?.name || '',
    userEmail: leave.user?.email || '',
    leaveType: leave.leave_type || 'casual',
    startDate: leave.start_date || '',
    endDate: leave.end_date || '',
    daysCount: leave.days_count ?? 0,
    reason: leave.reason || '',
    status: leave.status || 'pending',
    approvedBy: leave.approved_by || '',
    approverName: leave.approver?.name || '',
    rejectReason: leave.reject_reason || '',
    createdAt: leave.created_at,
    updatedAt: leave.updated_at,
  }
}

function buildLeaveBody(payload) {
  return {
    leave_type: payload.leaveType || payload.leave_type || 'casual',
    start_date: payload.startDate || payload.start_date,
    end_date: payload.endDate || payload.end_date,
    reason: payload.reason || '',
  }
}

export async function createLeave(payload) {
  try {
    const { data } = await apiClient.post('/leaves', buildLeaveBody(payload), {
      headers: authHeader(),
    })

    return { success: true, leave: normalizeLeave(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to submit the leave request. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getMyLeaves() {
  try {
    const { data } = await apiClient.get('/leaves/me', {
      headers: authHeader(),
    })

    const leaves = Array.isArray(data) ? data : data?.leaves || []
    return { success: true, leaves: leaves.map(normalizeLeave) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load your leave history. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listLeaves(params = {}) {
  try {
    const queryParams = {}
    if (params.userId || params.user_id) queryParams.user_id = params.userId || params.user_id
    if (params.status) queryParams.status = params.status
    if (params.leaveType || params.leave_type) queryParams.leave_type = params.leaveType || params.leave_type
    if (params.dateFrom || params.date_from) queryParams.date_from = params.dateFrom || params.date_from
    if (params.dateTo || params.date_to) queryParams.date_to = params.dateTo || params.date_to

    const { data } = await apiClient.get('/leaves', {
      headers: authHeader(),
      params: queryParams,
    })

    const leaves = Array.isArray(data) ? data : data?.leaves || []
    return { success: true, leaves: leaves.map(normalizeLeave) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load leave requests. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getLeave(leaveId) {
  try {
    const { data } = await apiClient.get(`/leaves/${leaveId}`, {
      headers: authHeader(),
    })

    return { success: true, leave: normalizeLeave(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load this leave request. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateLeave(leaveId, payload) {
  try {
    const { data } = await apiClient.patch(`/leaves/${leaveId}`, buildLeaveBody(payload), {
      headers: authHeader(),
    })

    return { success: true, leave: normalizeLeave(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update this leave request. Only pending requests can be edited.',
    )

    return { success: false, error: message }
  }
}

export async function approveLeave(leaveId) {
  try {
    const { data } = await apiClient.patch(`/leaves/${leaveId}/approve`, {}, {
      headers: authHeader(),
    })

    return { success: true, leave: normalizeLeave(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve this leave request. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function rejectLeave(leaveId, rejectReason) {
  try {
    const { data } = await apiClient.patch(`/leaves/${leaveId}/reject`, { reject_reason: rejectReason }, {
      headers: authHeader(),
    })

    return { success: true, leave: normalizeLeave(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reject this leave request. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteLeave(leaveId) {
  try {
    await apiClient.delete(`/leaves/${leaveId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel this leave request. Only pending requests can be cancelled.',
    )

    return { success: false, error: message }
  }
}
