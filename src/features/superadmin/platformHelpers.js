import { useAuthStore } from '../../store/authStore'
import { platformRoleForUser, platformBaseForUser } from '../../auth/platformRoles'

export function usePlatformAccess() {
  const user = useAuthStore(state => state.currentUser)
  return { isSuperAdmin: platformRoleForUser(user) === 'super_admin', basePath: platformBaseForUser(user) }
}
export function label(value) {
  return value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Not available'
}
export function dateLabel(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-IN')
}

export const featureKey = feature => feature.entitlement_key ?? feature.key
export const featureName = feature => feature.name ?? feature.feature_name ?? feature.label ?? 'Unnamed feature'
