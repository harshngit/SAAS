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

// `action_url` is the preferred navigation target (see utils/notificationNavigation.js);
// `link` is kept only as the legacy fallback for older rows that predate it. Every other new
// field (event/entity_type/entity_id/actor_id/organization_id/recipient_user_id/scope) is passed
// through as-is - never parsed or re-derived, the backend already owns all of this.
function normalizeNotification(notification) {
  if (!notification) return notification

  return {
    id: notification.id,
    title: notification.title || '',
    body: notification.body || '',
    type: notification.type || 'info',
    event: notification.event || '',
    entityType: notification.entity_type || '',
    entityId: notification.entity_id || '',
    actionUrl: notification.action_url || '',
    link: notification.link || '',
    actorId: notification.actor_id || '',
    organizationId: notification.organization_id || '',
    recipientUserId: notification.recipient_user_id || '',
    scope: notification.scope || '',
    isRead: Boolean(notification.is_read),
    readAt: notification.read_at || null,
    createdAt: notification.created_at,
    data: notification.data || null,
  }
}

export async function listNotifications(params = {}) {
  try {
    const queryParams = { page_size: params.pageSize || params.page_size || 100 }
    if (params.page) queryParams.page = params.page
    if (params.unreadOnly || params.unread_only) queryParams.unread_only = true
    if (params.search) queryParams.search = params.search
    if (params.sortBy || params.sort_by) queryParams.sort_by = params.sortBy || params.sort_by
    if (params.sortOrder || params.sort_order) queryParams.sort_order = params.sortOrder || params.sort_order

    const { data } = await apiClient.get('/notifications', {
      headers: authHeader(),
      params: queryParams,
    })

    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return {
      success: true,
      notifications: rows.map(normalizeNotification),
      total: data?.total ?? rows.length,
      page: data?.page ?? queryParams.page ?? 1,
      pageSize: data?.page_size ?? queryParams.page_size,
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load notifications. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function getUnreadNotificationCount() {
  try {
    const { data } = await apiClient.get('/notifications/unread-count', {
      headers: authHeader(),
    })

    return { success: true, unread: data?.unread ?? 0 }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load unread notification count.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const { data } = await apiClient.patch(`/notifications/${notificationId}/read`, {}, {
      headers: authHeader(),
    })

    return { success: true, notification: normalizeNotification(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to mark notification as read.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function markAllNotificationsRead() {
  try {
    const { data } = await apiClient.patch('/notifications/read-all', {}, {
      headers: authHeader(),
    })

    return { success: true, detail: data?.detail || '' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to mark all notifications as read.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

// 404 (already gone) is treated as success - the end state the caller wants (this row no longer
// in the list) is already true.
export async function deleteNotification(notificationId) {
  try {
    await apiClient.delete(`/notifications/${notificationId}`, { headers: authHeader() })
    return { success: true }
  } catch (error) {
    if (error.response?.status === 404) return { success: true }
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete this notification.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function bulkDeleteNotifications(notificationIds) {
  try {
    await apiClient.post('/notifications/bulk-delete', { ids: notificationIds }, { headers: authHeader() })
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete these notifications.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function clearReadNotifications() {
  try {
    await apiClient.post('/notifications/clear-read', {}, { headers: authHeader() })
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to clear read notifications.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}
