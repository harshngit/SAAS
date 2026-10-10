import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData

  if (Array.isArray(errorData)) {
    return errorData.map((item) => formatApiError(item)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }

  return String(errorData)
}

// The backend's runtime plan-restriction errors (PLAN_FEATURE_NOT_AVAILABLE / PLAN_LIMIT_REACHED)
// are detail *codes*, not something OpenAPI enumerates - read defensively from whichever shape the
// error body actually uses (a bare code string, or a {code, message} object under `detail`).
export function planErrorCode(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') {
    if (detail === 'PLAN_FEATURE_NOT_AVAILABLE' || detail === 'PLAN_LIMIT_REACHED') return detail
    return null
  }
  if (detail && typeof detail === 'object') {
    const code = detail.code || detail.error_code
    if (code === 'PLAN_FEATURE_NOT_AVAILABLE' || code === 'PLAN_LIMIT_REACHED') return code
  }
  return null
}

export function planErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail && typeof detail === 'object' && detail.message) return detail.message
  return formatApiError(detail || error?.response?.data, fallback)
}

// GET /organizations/me/entitlements - the single source of truth for this organization's
// effective features/limits. Already-computed by the backend (plan defaults + overrides +
// expiry) - never recalculated here.
export async function getMyEntitlements() {
  try {
    const { data } = await apiClient.get('/organizations/me/entitlements')
    return { success: true, entitlements: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load plan entitlements.') }
  }
}

export async function getOrganizationEntitlementsAdmin(orgId) {
  try {
    const { data } = await apiClient.get(`/superadmin/organizations/${orgId}/entitlements`)
    return { success: true, entitlements: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load organization entitlements.') }
  }
}

export async function listFeatureOverrides(orgId) {
  try {
    const { data } = await apiClient.get(`/superadmin/organizations/${orgId}/overrides/features`)
    return { success: true, overrides: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load feature overrides.') }
  }
}

// effect: 'ALLOW' | 'BLOCK'
export async function upsertFeatureOverride(orgId, { entitlementKey, effect, expiresAt, reason }) {
  try {
    const { data } = await apiClient.post(`/superadmin/organizations/${orgId}/overrides/features`, {
      entitlement_key: entitlementKey,
      effect,
      expires_at: expiresAt || null,
      reason: reason || null,
    })
    return { success: true, override: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to save feature override.') }
  }
}

export async function deleteFeatureOverride(orgId, entitlementKey) {
  try {
    await apiClient.delete(`/superadmin/organizations/${orgId}/overrides/features/${encodeURIComponent(entitlementKey)}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to reset feature override.') }
  }
}

export async function listLimitOverrides(orgId) {
  try {
    const { data } = await apiClient.get(`/superadmin/organizations/${orgId}/overrides/limits`)
    return { success: true, overrides: Array.isArray(data) ? data : [] }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load limit overrides.') }
  }
}

// value: integer, or null for "unlimited"
export async function upsertLimitOverride(orgId, { limitKey, value, expiresAt, reason }) {
  try {
    const { data } = await apiClient.post(`/superadmin/organizations/${orgId}/overrides/limits`, {
      limit_key: limitKey,
      value: value === '' || value === undefined ? null : value,
      expires_at: expiresAt || null,
      reason: reason || null,
    })
    return { success: true, override: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to save limit override.') }
  }
}

export async function deleteLimitOverride(orgId, limitKey) {
  try {
    await apiClient.delete(`/superadmin/organizations/${orgId}/overrides/limits/${encodeURIComponent(limitKey)}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to reset limit override.') }
  }
}

export async function resetAllOverrides(orgId) {
  try {
    await apiClient.post(`/superadmin/organizations/${orgId}/overrides/reset-all`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to reset overrides.') }
  }
}
