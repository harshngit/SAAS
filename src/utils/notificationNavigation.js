import { ROLES } from '../auth/roles'

export function resolveNotificationDestination(notification, currentUser) {
  const link = String(notification?.link || '').trim()

  if (!link) return ''

  if (notification?.type === 'delivery') {
    if (currentUser?.role === ROLES.DELIVERY_PARTNER) {
      return `/delivery/deliveries/${link}`
    }

    if (currentUser?.role === ROLES.ADMIN) {
      return `/admin/deliveries/${link}`
    }
  }

  return link
}
