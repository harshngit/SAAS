import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { resolveHomePath } from './roles'

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

  if (allowedRoles && !fullAccess && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={resolveHomePath({ fullAccess, role, currentUser })} replace />
  }

  return children
}
