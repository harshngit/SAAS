import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'
import { getFileUrl } from './files'

// Organization theme / appearance - "Organization Theme / Appearance API - Current Contract"
// (the older fonts/card-style/theme-logo/admin-only-GET sections are gone; do not resurrect them).
//   GET    /organization/theme            - any logged-in org user; also embedded in GET /auth/me
//   PATCH  /organization/theme             - admin; { custom_enabled?, mode?, primary_color?, overlay_opacity? }
//   POST   /organization/theme/background  - admin; multipart "file", PNG/JPEG/WebP, max 5 MB
//   DELETE /organization/theme/background  - admin
//   POST   /organization/theme/reset       - admin
// Singular "/organization/theme" is correct (confirmed against the live backend directly in an
// earlier pass: unauthenticated GET returned 403, not 404, meaning the route exists - a 404 would
// mean it doesn't. Do not "fix" this to plural without re-confirming via an actual request first).

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

// customEnabled:false here is what keeps the current CRM design active whenever the org has
// never customized its theme, the theme API fails, or the app hasn't fetched it yet.
export const DEFAULT_PRIMARY_COLOR = '#00092A'

export const DEFAULT_THEME = {
  customEnabled: false,
  mode: 'light',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  background: { url: '', overlayOpacity: null }, // null = "not set yet" -> ThemeSettings uses the shared 5% default.
  updatedAt: null,
}

// snake_case wire shape -> camelCase, one flat object - the one place this mapping happens.
export function normalizeOrganizationTheme(payload) {
  if (!payload) return DEFAULT_THEME
  const background = payload.background || {}
  return {
    customEnabled: Boolean(payload.custom_enabled ?? payload.customEnabled),
    mode: payload.mode === 'dark' ? 'dark' : 'light',
    primaryColor: payload.primary_color || payload.primaryColor || DEFAULT_PRIMARY_COLOR,
    background: {
      url: getFileUrl(background.url || ''),
      overlayOpacity: background.overlay_opacity ?? background.overlayOpacity ?? null,
    },
    updatedAt: payload.updated_at || payload.updatedAt || null,
  }
}

export async function getOrganizationTheme() {
  try {
    const { data } = await apiClient.get('/organization/theme', { headers: authHeader() })
    return { success: true, theme: normalizeOrganizationTheme(data) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load appearance settings. Please try again.',
      ),
    }
  }
}

// Partial update - only camelCase keys the caller actually set are sent (`!== undefined`).
export async function updateOrganizationTheme(payload = {}) {
  const body = {}
  if (payload.customEnabled !== undefined) body.custom_enabled = payload.customEnabled
  if (payload.mode !== undefined) body.mode = payload.mode
  if (payload.primaryColor !== undefined) body.primary_color = payload.primaryColor || null
  if (payload.overlayOpacity !== undefined) body.overlay_opacity = payload.overlayOpacity

  try {
    const { data } = await apiClient.patch('/organization/theme', body, { headers: authHeader() })
    return { success: true, theme: normalizeOrganizationTheme(data) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to save appearance settings. Please try again.',
      ),
    }
  }
}

export async function uploadThemeBackground(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post('/organization/theme/background', formData, {
      headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    })

    const url = data?.url || data?.background?.url || data?.theme?.background?.url || ''
    return { success: true, url: getFileUrl(url) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to upload background image. Please try again.',
      ),
    }
  }
}

export async function deleteThemeBackground() {
  try {
    const { data } = await apiClient.delete('/organization/theme/background', { headers: authHeader() })
    return { success: true, theme: data ? normalizeOrganizationTheme(data) : null }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to remove the background image. Please try again.',
      ),
    }
  }
}

export async function resetOrganizationTheme() {
  try {
    const { data } = await apiClient.post('/organization/theme/reset', {}, { headers: authHeader() })
    return { success: true, theme: normalizeOrganizationTheme(data) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to reset appearance settings. Please try again.',
      ),
    }
  }
}
