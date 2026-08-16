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

function normalizeNotification(notification) {
  if (!notification) return notification

  return {
    id: notification.id,
    title: notification.title || '',
    body: notification.body || '',
    type: notification.type || 'info',
    link: notification.link || '',
    isRead: Boolean(notification.is_read),
    createdAt: notification.created_at,
  }
}

export async function listNotifications(unreadOnly = false) {
  try {
    const { data } = await apiClient.get('/notifications', {
      headers: authHeader(),
      params: unreadOnly ? { unread_only: true } : undefined,
    })

    const notifications = Array.isArray(data) ? data : data?.notifications || []
    return { success: true, notifications: notifications.map(normalizeNotification) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load notifications. Please try again.',
    )

    return { success: false, error: message }
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

    return { success: false, error: message }
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

    return { success: false, error: message }
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

    return { success: false, error: message }
  }
}
