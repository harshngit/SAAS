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

const AUTH_TOKENS_STORAGE_KEY = 'aquapure-auth-storage'

// zustand's `persist` middleware (below) rehydrates authTokens from this same key, but only
// ASYNCHRONOUSLY, after the first render has already committed. currentUser/authProfile are
// seeded synchronously above specifically so ProtectedRoute can let the authenticated app render
// immediately on reload with no flash of the login page - but every one of those pages fires its
// own data-loading useEffect on mount, which races ahead of persist's async rehydration and goes
// out with no Authorization header at all, 401-ing even /auth/me. Reading the same storage key
// synchronously here (zustand persist's own on-disk shape: {state: {...}, version}) closes that
// race - persist's later async pass re-applies the identical value, which is a harmless no-op.
function readStoredAuthTokens() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AUTH_TOKENS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.authTokens || null
  } catch {
    return null
  }
}

const storedAuthProfile = readStoredAuthProfile()
const storedAuthTokens = readStoredAuthTokens()

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
      authTokens: storedAuthTokens,
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
    {
      // Keep the ORIGINAL key name - renaming it would orphan every already-logged-in browser's
      // saved authTokens (nothing else restores them across a reload), silently logging everyone
      // out on their next visit. The one-time rehydration of a stale orgTheme this key name might
      // still carry over is harmless: ThemeProvider's own self-heal GET (see ThemeProvider.jsx)
      // corrects it moments later, and every set() from then on is already partialized below, so
      // the stale extra fields stop being written back and the key cleans itself up permanently.
      name: 'aquapure-auth-storage',
      // BUG FOUND 2026-09-30: zustand's persist, unrestricted, snapshots the WHOLE state
      // (including orgTheme/currentUser/role/...) to this SEPARATE localStorage key on every
      // set() call, and rehydrates it ASYNCHRONOUSLY on load via a shallow merge that OVERWRITES
      // current state. That collided with the manual authProfile/orgTheme scheme above (which
      // seeds those same fields SYNCHRONOUSLY from the 'aquapure-auth-profile' key, specifically
      // to avoid a flash of unauthenticated/unthemed content) - a stale value sitting in THIS
      // key from any earlier session would silently stomp a freshly-seeded-correct orgTheme
      // moments after mount, with no visible error. `authTokens` is the one field that has no
      // manual counterpart (nothing else restores it across a reload), so it's the only thing
      // this middleware needs to own; everything else stays exclusively on the manual scheme.
      partialize: (state) => ({ authTokens: state.authTokens }),
    },
  ),
)

// Non-hook helper for use outside React components (route guards, api layer, etc).
export function hasPermission(module, action) {
  return useAuthStore.getState().hasPermission(module, action)
}
