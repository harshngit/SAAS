import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../auth/roles'
import { getFieldSettings } from '../api/settings'
import { FieldSettingsContext } from './FieldSettingsContext'

// Mirrors entitlements/EntitlementsProvider.jsx's architecture exactly: one real fetch per
// organization, fail-open (never hide a field just because the fetch is slow/failed/not yet
// run), cached so every Create/Edit form shares the same data instead of each one calling
// GET /organizations/settings/fields itself. GET is readable by every signed-in org member
// (admin or staff) per the current backend contract - this provider fetches for any org-scoped
// user, same as EntitlementsProvider does, and Super Admin (no organization) never fetches.
//
// The backend already resolves dependent fields (e.g. product.sub_category_id depending on
// category_id) into `field_settings` itself - see field_settings_service.py's DEPENDS_ON
// handling - so isFieldVisible() here is a plain lookup, not a second dependency computation.
// Locked classes (mandatory/conditional/non_configurable) are always visible by construction:
// the backend's own `field_settings` already carries `true` for every one of them.
export default function FieldSettingsProvider({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const role = useAuthStore((state) => state.role)

  const orgId = currentUser?.orgId || currentUser?.organization_id || ''
  const isOrgScoped = Boolean(orgId) && role !== ROLES.SUPER_ADMIN

  const [isLoading, setIsLoading] = useState(isOrgScoped)
  const [loadError, setLoadError] = useState('')
  const [availableFields, setAvailableFields] = useState({})
  const [fieldSettings, setFieldSettings] = useState({})
  const [settingsOrgId, setSettingsOrgId] = useState('')
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!isOrgScoped) return { success: false }
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setLoadError('')

    const result = await getFieldSettings()
    if (requestId !== requestIdRef.current) return result

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return result
    }

    setAvailableFields(result.availableFields)
    setFieldSettings(result.fieldSettings)
    setSettingsOrgId(orgId)
    return result
  }, [isOrgScoped, orgId])

  const refreshedOrgIdRef = useRef('')
  useEffect(() => {
    if (!isOrgScoped) {
      refreshedOrgIdRef.current = ''
      return
    }
    if (refreshedOrgIdRef.current === orgId) return
    refreshedOrgIdRef.current = orgId
    refresh()
    return () => { requestIdRef.current += 1; refreshedOrgIdRef.current = '' }
  }, [isOrgScoped, orgId, refresh])

  // `fieldSettings[module][fieldKey]` is the backend's already-resolved effective visibility -
  // true for every locked (mandatory/conditional/non_configurable) field, and the org's saved
  // (or default) preference for optional fields. Not-yet-loaded or an unknown module/field fails
  // open (visible), same rationale as EntitlementsProvider's hasFeature().
  const isFieldVisible = useCallback(
    (module, fieldKey) => {
      if (!isOrgScoped || settingsOrgId !== orgId) return true
      const meta = availableFields[module]?.fields?.find((field) => field.key === fieldKey)
      if (meta && meta.classification !== 'optional') return true
      const moduleSettings = fieldSettings[module]
      if (!moduleSettings || !(fieldKey in moduleSettings)) return true
      return moduleSettings[fieldKey] !== false
    },
    [isOrgScoped, fieldSettings, settingsOrgId, orgId, availableFields],
  )

  const getFieldMeta = useCallback(
    (module, fieldKey) => {
      if (settingsOrgId !== orgId) return null
      const moduleFields = availableFields[module]?.fields
      if (!Array.isArray(moduleFields)) return null
      return moduleFields.find((field) => field.key === fieldKey) || null
    },
    [availableFields, settingsOrgId, orgId],
  )

  const value = useMemo(
    () => ({
      isLoading,
      loadError,
      availableFields,
      fieldSettings,
      isFieldVisible,
      getFieldMeta,
      refreshFieldSettings: refresh,
    }),
    [isLoading, loadError, availableFields, fieldSettings, isFieldVisible, getFieldMeta, refresh],
  )

  return <FieldSettingsContext.Provider value={value}>{children}</FieldSettingsContext.Provider>
}
