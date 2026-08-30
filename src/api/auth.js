import { useAuthStore } from '../store/authStore'
import { apiClient, API_BASE_URL, normalizeTokens } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (Array.isArray(errorData)) {
    return errorData.map(formatApiError).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

// /auth/login only verifies credentials and returns tokens - the full session (user, role,
// permissions, organization) comes from /auth/me, so login chains straight into it.
export async function login({ email, password }) {
  try {
    const requestBody = {
      email: email.trim().toLowerCase(),
      password,
    }

    const { data } = await apiClient.post('/auth/login', requestBody)
    const tokens = normalizeTokens(data)

    if (!tokens?.access_token) {
      return { success: false, error: 'Unable to sign in. Please try again.' }
    }

    useAuthStore.getState().setAuthTokens(tokens)

    const profileResult = await getCurrentProfile()

    if (!profileResult.success) {
      return profileResult
    }

    return { success: true, ...profileResult }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to sign in. Please check your credentials and try again.',
    )

    return { success: false, error: message }
  }
}

export async function registerOrganization(payload) {
  try {
    const requestBody = {
      organization_name: payload.organizationName.trim(),
      admin_name: payload.adminName.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      password: payload.password,
      role: 'admin',
    }

    const { data } = await apiClient.post('/auth/register', requestBody)
    useAuthStore.getState().setAuthenticatedSession(data)
    return { success: true, ...data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to register organization. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function forgotPassword({ email }) {
  try {
    const { data } = await apiClient.post('/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    })

    // reset_token is only populated when the backend runs with expose_reset_token enabled
    // (dev/demo) - production responses omit it and rely on the emailed link instead.
    return { success: true, detail: data?.detail || 'If an account exists for that email, a reset link has been sent.', resetToken: data?.reset_token || '' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to start password reset. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function resetPassword({ token, newPassword }) {
  try {
    const { data } = await apiClient.post('/auth/reset-password', {
      token,
      new_password: newPassword,
    })

    return { success: true, detail: data?.detail || 'Password reset successfully.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reset password. The reset link may have expired.',
    )

    return { success: false, error: message }
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  try {
    const { data } = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }, {
      headers: authHeader(),
    })

    return { success: true, detail: data?.detail || 'Password changed successfully.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to change password. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCurrentProfile() {
  try {
    const { data } = await apiClient.get('/auth/me', {
      headers: authHeader(),
    })
    useAuthStore.getState().setAuthenticatedSession(data)
    return { success: true, ...data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load profile details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function logout() {
  const { authTokens } = useAuthStore.getState()

  try {
    if (authTokens?.refresh_token) {
      const { data } = await apiClient.post('/auth/logout', {
        refresh_token: authTokens.refresh_token,
      })

      return { success: true, ...data }
    }

    return { success: true, detail: 'Logged out locally.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to log out on the server. Your local session was cleared.',
    )

    return { success: false, error: message }
  } finally {
    useAuthStore.getState().logout()
  }
}

// Full-page redirect (never fetch/axios) - GET /auth/google issues a 307 straight to Google's
// consent screen, so the browser itself must navigate there, not an XHR. Trims/adds the slash
// explicitly rather than relying on API_BASE_URL always ending in one - safe either way.
export function googleLoginRedirect() {
  window.location.href = `${API_BASE_URL.replace(/\/+$/, '')}/auth/google`
}

// AuthResponse ({user, organization, tokens}) is the same shape login()/registerOrganization()
// already produce via setAuthenticatedSession, so this plugs into the exact same session store.
export async function exchangeGoogleCode(code) {
  try {
    const { data } = await apiClient.post('/auth/exchange', { code })
    useAuthStore.getState().setAuthenticatedSession(data)
    return { success: true, ...data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'This sign-in link has expired. Please try signing in again.',
    )

    return { success: false, error: message }
  }
}

export async function getGoogleRegistrationInfo(registrationCode) {
  try {
    const { data } = await apiClient.post('/auth/google/registration-info', {
      registration_code: registrationCode,
    })

    return { success: true, email: data?.email || '', name: data?.name || '' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'This registration link has expired. Please start over.',
    )

    return { success: false, error: message }
  }
}

export async function completeGoogleRegistration(payload) {
  try {
    const requestBody = {
      registration_code: payload.registrationCode,
      organization_name: payload.organizationName?.trim(),
      admin_name: payload.adminName?.trim(),
      password: payload.password,
    }

    if (payload.businessType) requestBody.business_type = payload.businessType.trim()
    if (payload.gstNumber) requestBody.gst_number = payload.gstNumber.trim()
    if (payload.panNumber) requestBody.pan_number = payload.panNumber.trim()
    if (payload.address) requestBody.address = payload.address.trim()
    if (payload.phone) requestBody.phone = payload.phone.trim()
    if (payload.financialYear) requestBody.financial_year = payload.financialYear.trim()
    if (payload.logoUrl) requestBody.logo_url = payload.logoUrl.trim()

    const { data } = await apiClient.post('/auth/google/complete-registration', requestBody)
    useAuthStore.getState().setAuthenticatedSession(data)
    return { success: true, ...data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to complete registration. Please try again.',
    )

    return { success: false, error: message }
  }
}
