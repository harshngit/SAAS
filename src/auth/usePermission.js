import { useAuthStore } from '../store/authStore'

// Reads permissions from the auth store (populated from /auth/me - see authStore.js).
// full_access (Admin) is treated as every permission granted, same as the backend does,
// so callers never need to special-case admins.
export function usePermission() {
  const fullAccess = useAuthStore((state) => state.fullAccess)
  const permissions = useAuthStore((state) => state.permissions)
  const role = useAuthStore((state) => state.role)
  const dataScope = useAuthStore((state) => state.dataScope)

  const can = (module, action = 'view') => {
    if (fullAccess) return true
    return Boolean(permissions?.[module]?.[action])
  }

  return { can, fullAccess, permissions, role, dataScope }
}
