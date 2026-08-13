import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePermission } from './usePermission'
import { resolveHomePath } from './roles'

// Inline gate for a single button/section - e.g. wrap a "Create Order" button with
// <RequirePermission module="sales_orders" action="create"> so it only renders when the
// signed-in role actually has that permission, instead of relying on the API to 403.
export function RequirePermission({ module, action = 'view', fallback = null, children }) {
  const { can } = usePermission()
  return can(module, action) ? children : fallback
}

// Route-level guard - wrap a page element so the whole route redirects away (rather than
// rendering and then failing on every request) when the module isn't permitted.
export default function RequirePermissionRoute({ module, action = 'view', children }) {
  const { can } = usePermission()
  const currentUser = useAuthStore((state) => state.currentUser)
  const fullAccess = useAuthStore((state) => state.fullAccess)
  const role = useAuthStore((state) => state.role)

  if (!can(module, action)) {
    return <Navigate to={resolveHomePath({ fullAccess, role, currentUser })} replace />
  }

  return children
}
