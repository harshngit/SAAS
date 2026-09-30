import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../auth/roles'
import { DEFAULT_THEME, getOrganizationTheme } from '../api/theme'
import { applyThemeToDocument, resetThemeDocument } from './themeConfig'
import { ThemeContext } from './ThemeContext'

// The org theme itself is no longer fetched independently here - GET /auth/me already embeds it,
// and authStore.setAuthenticatedSession normalizes + stores it as `orgTheme` (also persisted, so
// zustand-persist rehydrates it synchronously from localStorage before this component's first
// render - see the useLayoutEffect below). This provider's job is just to (a) push that theme onto
// the document as early as possible, and (b) expose `refreshTheme`, which re-fetches
// GET /organization/theme and writes the result back into the auth store, for use right after a
// save/reset/background upload so the rest of the app reflects the change immediately.
export default function ThemeProvider({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const role = useAuthStore((state) => state.role)
  const orgTheme = useAuthStore((state) => state.orgTheme)
  const setOrgTheme = useAuthStore((state) => state.setOrgTheme)
  // Keyed by orgId specifically (not just "is a user logged in") so switching to a different
  // organization's account - not only logout/login - always re-syncs instead of silently keeping
  // the previous organization's theme applied (multi-tenant safety). Super Admin never themes
  // (it manages every organization, not one) - that area always stays the plain default look
  // regardless of any org's saved theme, so it's excluded here even if orgId happens to be set.
  const orgId = currentUser?.orgId || currentUser?.organization_id || ''
  const isThemeable = Boolean(orgId) && role !== ROLES.SUPER_ADMIN
  const requestIdRef = useRef(0)

  const theme = isThemeable ? orgTheme || DEFAULT_THEME : DEFAULT_THEME

  // useLayoutEffect (not useEffect) so the theme's data-mode/data-bg/accent tokens are applied
  // before the browser paints - the cached theme is already available synchronously via
  // zustand-persist's rehydration, so this is what actually delivers "no flash of the default
  // look" rather than a hand-written inline <script> in index.html.
  useLayoutEffect(() => {
    if (isThemeable) applyThemeToDocument(theme)
    else resetThemeDocument()
  }, [isThemeable, theme])

  // All org users can see the theme (only Admin/Business Owner can edit it - that's enforced by
  // the settings page's own permission gate, not here), so this refresh is safe to call for any
  // authenticated session.
  const refresh = useCallback(async () => {
    if (!isThemeable) return { success: false }
    const requestId = ++requestIdRef.current
    const result = await getOrganizationTheme()
    if (requestId !== requestIdRef.current) return result
    if (result.success) setOrgTheme(result.theme)
    return result
  }, [isThemeable, setOrgTheme])

  // Self-heals a stale cached theme: `orgTheme` is normally sourced from /auth/me (no extra
  // request needed) and persisted across reloads via zustand-persist, but a browser tab that's
  // been open since before this theme contract existed - or across an earlier one - would still
  // have an old-shaped blob cached (missing customEnabled/mode/background) that never gets
  // migrated automatically. Also removes the previous design's sole reliance on Layout.jsx's
  // dashboard-only getCurrentProfile() call to ever populate a real theme on other routes. One
  // real GET per orgId (a role/permission-gated org user can always call it), not on every render.
  const refreshedOrgIdRef = useRef('')
  useEffect(() => {
    if (!isThemeable || refreshedOrgIdRef.current === orgId) return
    refreshedOrgIdRef.current = orgId
    refresh()
  }, [isThemeable, orgId, refresh])

  // Used right after a successful PATCH/upload/reset so the whole app reflects the change
  // immediately without waiting on a refetch.
  const setOptimisticTheme = useCallback((nextTheme) => {
    setOrgTheme(nextTheme)
  }, [setOrgTheme])

  useEffect(() => {
    return () => resetThemeDocument()
  }, [])

  const value = { theme, refreshTheme: refresh, setOptimisticTheme }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
