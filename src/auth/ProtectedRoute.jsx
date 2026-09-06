import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { resolveHomePath, resolveWorkspaceRole } from './roles'

// allowedRoles is optional - omit it for routes any authenticated user should reach
// regardless of role/workspace (e.g. /profile).
export default function ProtectedRoute({ allowedRoles, children }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const fullAccess = useAuthStore((state) => state.fullAccess)
  const role = useAuthStore((state) => state.role)
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Custom roles resolve to their workspace's canonical shell so they aren't locked out of
  // (or redirect-looped around) their own route tree. Per-screen permission guards still apply.
  const effectiveRole = resolveWorkspaceRole({ role, currentUser })
  if (allowedRoles && !fullAccess && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={resolveHomePath({ fullAccess, role, currentUser })} replace />
  }

  return children
}
