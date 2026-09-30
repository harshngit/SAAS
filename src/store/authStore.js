import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeOrganizationTheme, DEFAULT_THEME } from '../api/theme'

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
      // Cached from the last /auth/me response (Part 2.8: no flash on load) - ThemeProvider
      // applies this synchronously on first render, before its own GET /organization/theme
      // refresh resolves. Org-scoped implicitly: it's part of the same persisted authProfile
      // blob as `user`/`organization`, so a different login/org always overwrites it.
      orgTheme: storedAuthProfile?.theme || DEFAULT_THEME,

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
        theme,
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

        set((state) => {
          // Every /auth/me response carries `theme` per the current contract, but this setter is
          // also reachable from other callers (e.g. token refresh) that may not - never wipe a
          // good cached theme back to the default just because one particular call omitted it.
          const nextTheme = theme !== undefined ? normalizeOrganizationTheme(theme) : state.orgTheme
          saveAuthProfile({ ...authProfile, theme: nextTheme })

          return {
            currentUser: normalizedUser,
            currentOrganization: normalizedOrganization,
            role: authProfile.role,
            permissions: authProfile.permissions,
            fullAccess: authProfile.fullAccess,
            dataScope: authProfile.dataScope,
            authProfile,
            authTokens: nextTokens || state.authTokens,
            orgTheme: nextTheme,
          }
        })
      },

      // Called after a successful PATCH/reset/background upload so the cached copy (and thus the
      // next page load's pre-paint state) stays authoritative without waiting for the next
      // /auth/me call. Takes an ALREADY-normalized theme (api/theme.js's functions all return
      // one) - never re-normalize here, that would read camelCase keys as if they were the
      // snake_case wire shape and silently produce garbage.
      setOrgTheme: (normalizedTheme) => {
        set((state) => {
          if (state.authProfile) saveAuthProfile({ ...state.authProfile, theme: normalizedTheme })
          return { orgTheme: normalizedTheme }
        })
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
          // Multi-tenant safety: never let the next login (possibly a different organization)
          // render with the previous org's theme, even for the instant before the fresh
          // /auth/me response comes back.
          orgTheme: DEFAULT_THEME,
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
