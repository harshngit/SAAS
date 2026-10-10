import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../auth/roles'
import { getMyEntitlements } from '../api/entitlements'
import { EntitlementsContext } from './EntitlementsContext'

// Mirrors theme/ThemeProvider.jsx's architecture exactly (same codebase, same org-scoped
// "fetch once per org, expose a manual refresh, cache synchronously to avoid flashing"
// pattern) - see that file's own comments for the full rationale.
//
// Fail-open, not fail-closed: hasFeature()/getLimit() return "allowed"/"unlimited" until the
// FIRST successful fetch for this org lands (entitlements still null), and again if a fetch
// ever errors. A fail-closed default would mean a slow or failed network call makes every
// gated sidebar item and route vanish for every role, including Admin - a severe regression far
// worse than occasionally rendering one extra item for a moment. Once `entitlements` is non-null
// (either from this org's last successful fetch, synchronously rehydrated from localStorage via
// authStore's same authProfile cache orgTheme uses, or this session's own fresh fetch), gating
// is fully real. Super Admin never has an organization to gate against - entitlements stay null
// and every check stays open for that role, same as ThemeProvider.jsx excludes it from theming.
export default function EntitlementsProvider({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const role = useAuthStore((state) => state.role)
  const entitlements = useAuthStore((state) => state.entitlements)
  const setEntitlements = useAuthStore((state) => state.setEntitlements)

  const orgId = currentUser?.orgId || currentUser?.organization_id || ''
  const isOrgScoped = Boolean(orgId) && role !== ROLES.SUPER_ADMIN

  const [isLoading, setIsLoading] = useState(isOrgScoped)
  const [loadError, setLoadError] = useState('')
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!isOrgScoped) return { success: false }
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setLoadError('')

    const result = await getMyEntitlements()
    if (requestId !== requestIdRef.current) return result

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return result
    }

    setEntitlements(result.entitlements)
    return result
  }, [isOrgScoped, setEntitlements])

  // One real fetch per orgId - re-fires automatically on a different organization (new
  // login/account switch), and is also exposed as refreshEntitlements for explicit triggers
  // (plan upgrade approved, Super Admin changed this org's override/plan, session refresh).
  const refreshedOrgIdRef = useRef('')
  useEffect(() => {
    if (!isOrgScoped) {
      refreshedOrgIdRef.current = ''
      return
    }
    if (refreshedOrgIdRef.current === orgId) return
    refreshedOrgIdRef.current = orgId
    refresh()
  }, [isOrgScoped, orgId, refresh])

  const features = useMemo(() => entitlements?.features || {}, [entitlements])
  const limits = useMemo(() => entitlements?.limits || {}, [entitlements])

  const hasFeature = useCallback(
    (key) => {
      if (!isOrgScoped) return true
      if (!key) return true
      if (!entitlements) return true // not yet loaded (or load failed) - fail open, see above
      return Boolean(features[key])
    },
    [isOrgScoped, entitlements, features],
  )

  const getLimit = useCallback(
    (key) => {
      if (!isOrgScoped) return null
      if (!entitlements) return null // unknown - treat as unlimited until real data arrives
      const value = limits[key]
      return value === undefined ? null : value
    },
    [isOrgScoped, entitlements, limits],
  )

  const value = useMemo(
    () => ({
      isLoading,
      isReady: Boolean(entitlements) || !isOrgScoped,
      loadError,
      entitlements,
      features,
      limits,
      plan: entitlements?.plan || null,
      subscriptionStatus: entitlements?.subscription_status || '',
      trialEndsAt: entitlements?.trial_ends_at || null,
      trialDaysLeft: entitlements?.trial_days_left ?? null,
      activeFeatureOverridesCount: entitlements?.active_feature_overrides_count ?? 0,
      activeLimitOverridesCount: entitlements?.active_limit_overrides_count ?? 0,
      hasFeature,
      getLimit,
      refreshEntitlements: refresh,
    }),
    [isLoading, loadError, entitlements, features, limits, isOrgScoped, hasFeature, getLimit, refresh],
  )

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}
