import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePermission } from './usePermission'
import { resolveHomePath } from './roles'
import { useEntitlements } from '../entitlements/EntitlementsContext'
import PlanRestricted from '../entitlements/PlanRestricted'

// Inline gate for a single button/section - e.g. wrap a "Create Order" button with
// <RequirePermission module="sales_orders" action="create"> so it only renders when the
// signed-in role actually has that permission, instead of relying on the API to 403.
export function RequirePermission({ module, action = 'view', fallback = null, children }) {
  const { can } = usePermission()
  return can(module, action) ? children : fallback
}

// Route-level guard - wrap a page element so the whole route redirects away (rather than
// rendering and then failing on every request) when the module isn't permitted.
//
// `feature` (optional) composes the SEPARATE plan-entitlement layer (Plan Entitlements brief §3/
// §6) onto the same wrapper rather than a second route-level component: role permission is
// checked first (unchanged silent-redirect behavior, exactly as before `feature` existed), and
// only once that passes is the plan feature checked - a feature-only denial renders the distinct
// PlanRestricted "Feature Not Available" page in place instead of redirecting, so a direct/typed
// URL to a disentitled-but-permitted feature shows a clean message rather than bouncing home.
export default function RequirePermissionRoute({ module, action = 'view', feature, children }) {
  const { can } = usePermission()
  const { hasFeature } = useEntitlements()
  const currentUser = useAuthStore((state) => state.currentUser)
  const fullAccess = useAuthStore((state) => state.fullAccess)
  const role = useAuthStore((state) => state.role)

  if (!can(module, action)) {
    return <Navigate to={resolveHomePath({ fullAccess, role, currentUser })} replace />
  }

  if (feature && !hasFeature(feature)) {
    return <PlanRestricted />
  }

  return children
}
