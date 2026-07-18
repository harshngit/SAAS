import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { roleHomePath } from './roles'

export default function ProtectedRoute({ allowedRoles, children }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={roleHomePath[currentUser.role]} replace />
  }

  return children
}
