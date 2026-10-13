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

const PLAN_ERROR_CODES = ['PLAN_FEATURE_NOT_AVAILABLE', 'PLAN_LIMIT_REACHED', 'PLAN_STORAGE_LIMIT_REACHED']

// The backend's runtime plan-restriction errors (PLAN_FEATURE_NOT_AVAILABLE / PLAN_LIMIT_REACHED /
// PLAN_STORAGE_LIMIT_REACHED) are detail *codes*, not something OpenAPI enumerates - read
// defensively from whichever shape the error body actually uses (a bare code string, a
// {code, message} object under `detail`, or the X-Error-Code response header persistent-upload
// endpoints may also set).
export function planErrorCode(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && PLAN_ERROR_CODES.includes(detail)) return detail
  if (detail && typeof detail === 'object') {
    const code = detail.code || detail.error_code
    if (PLAN_ERROR_CODES.includes(code)) return code
  }
  const headerCode = error?.response?.headers?.['x-error-code']
  if (PLAN_ERROR_CODES.includes(headerCode)) return headerCode
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

// GET /organizations/me/storage-usage - the real breakdown (files/documents, stored reports,
// application data) + effective limit + percentage, already resolved by the backend (plan
// default + any organization override). Never recomputed here.
export async function getMyStorageUsage() {
  try {
    const { data } = await apiClient.get('/organizations/me/storage-usage')
    return { success: true, usage: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load storage usage.') }
  }
}

export async function getOrganizationStorageUsageAdmin(orgId) {
  try {
    const { data } = await apiClient.get(`/superadmin/organizations/${orgId}/storage-usage`)
    return { success: true, usage: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to load organization storage usage.') }
  }
}

// Returns the freshly recalculated OrganizationStorageUsageOut directly - callers can apply it
// without a second GET.
export async function recalculateOrganizationStorageUsage(orgId) {
  try {
    const { data } = await apiClient.post(`/superadmin/organizations/${orgId}/storage-usage/recalculate`)
    return { success: true, usage: data }
  } catch (error) {
    return { success: false, error: formatApiError(error.response?.data?.detail, 'Unable to recalculate storage usage.') }
  }
}
