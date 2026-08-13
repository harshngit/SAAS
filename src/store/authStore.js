import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const AUTH_PROFILE_STORAGE_KEY = 'aquapure-auth-profile'

function readStoredAuthProfile() {
  if (typeof window === 'undefined') return null

  try {
    const storedProfile = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)
    return storedProfile ? JSON.parse(storedProfile) : null
  } catch {
    return null
  }
}

function saveAuthProfile(authProfile) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(authProfile))
  } catch {
    // The persisted Zustand store still keeps the app usable if explicit storage is blocked.
  }
}

function removeAuthProfile() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures; in-memory auth is still cleared below.
  }
}

const storedAuthProfile = readStoredAuthProfile()

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: storedAuthProfile?.user || null,
      currentOrganization: storedAuthProfile?.organization || null,
      // From /auth/me: role is the assigned role object ({id, name, workspace, data_scope,
      // is_default}) or null for Admin. permissions is the per-module action matrix.
      // full_access: true (Admin) means every permission is granted regardless of `permissions`.
      role: storedAuthProfile?.role ?? null,
      permissions: storedAuthProfile?.permissions || {},
      fullAccess: storedAuthProfile?.fullAccess ?? false,
      dataScope: storedAuthProfile?.dataScope || 'own',
      authProfile: storedAuthProfile,
      authTokens: null,

      setAuthenticatedSession: ({
        user,
        organization,
        tokens,
        access_token,
        refresh_token,
        token_type,
        role,
        permissions,
        full_access,
        data_scope,
      }) => {
        const nextTokens =
          tokens ||
          (access_token && refresh_token
            ? {
                access_token,
                refresh_token,
                token_type: token_type || 'bearer',
              }
            : null)

        const normalizedUser = {
          ...user,
          orgId: user.organization_id,
          status: user.is_active ? 'active' : 'inactive',
          joinedAt: user.created_at,
        }

        const normalizedOrganization = organization
          ? {
              ...organization,
              legalName: organization.legal_name,
              industry: organization.industry,
              businessType: organization.business_type,
              gstNumber: organization.gst_number,
              panNumber: organization.pan_number,
              financialYear: organization.financial_year,
              createdAt: organization.created_at,
            }
          : null

        const authProfile = {
          user: normalizedUser,
          organization: normalizedOrganization,
          role: role ?? null,
          permissions: permissions || {},
          fullAccess: Boolean(full_access),
          dataScope: data_scope || 'own',
        }

        saveAuthProfile(authProfile)

        set((state) => ({
          currentUser: normalizedUser,
          currentOrganization: normalizedOrganization,
          role: authProfile.role,
          permissions: authProfile.permissions,
          fullAccess: authProfile.fullAccess,
          dataScope: authProfile.dataScope,
          authProfile,
          authTokens: nextTokens || state.authTokens,
        }))
      },

      setAuthTokens: (tokens) => {
        set({ authTokens: tokens })
      },

      // full_access (Admin) is granted everything without consulting the permissions matrix.
      hasPermission: (module, action) => {
        const { fullAccess, permissions } = get()
        if (fullAccess) return true
        return Boolean(permissions?.[module]?.[action])
      },

      logout: () => {
        removeAuthProfile()
        set({
          currentUser: null,
          currentOrganization: null,
          role: null,
          permissions: {},
          fullAccess: false,
          dataScope: 'own',
          authProfile: null,
          authTokens: null,
        })
      },
    }),
    { name: 'aquapure-auth-storage' },
  ),
)

// Non-hook helper for use outside React components (route guards, api layer, etc).
export function hasPermission(module, action) {
  return useAuthStore.getState().hasPermission(module, action)
}
