import { useAuthStore } from '../store/authStore'
import { apiClient, API_BASE_URL, normalizeTokens } from './client'
import { disablePushForLogout, syncPushToken } from '../push/pushService'
import { phoneConflictFields } from '../utils/phoneConflict'

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

    syncPushToken() // fire-and-forget - never block/fail login on this

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

export async function sendPhoneOtp({ phone }) {
  try {
    const { data } = await apiClient.post('/auth/phone/send-otp', { phone })
    return { success: true, detail: data.detail, resendAfter: data.resend_after ?? 30 }
  } catch (error) {
    const data = error.response?.data
    return { success: false, status: error.response?.status, error: formatApiError(data?.detail || data, 'Unable to send OTP. Please try again.') }
  }
}

export async function loginWithPhoneOtp({ phone, code }) {
  try {
    const { data } = await apiClient.post('/auth/phone/verify-otp', { phone, code })
    const tokens = normalizeTokens(data)
    if (!tokens?.access_token) return { success: false, error: 'Unable to sign in. Please try again.' }
    useAuthStore.getState().setAuthTokens(tokens)
    const profileResult = await getCurrentProfile()
    if (!profileResult.success) return profileResult
    syncPushToken()
    return { success: true, ...profileResult }
  } catch (error) {
    const data = error.response?.data
    return { success: false, status: error.response?.status, error: formatApiError(data?.detail || data, 'Unable to verify OTP. Please try again.') }
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

    return { success: false, error: message, fieldErrors: phoneConflictFields(error.response?.status, message) }
  }
}

export async function forgotPassword({ email }) {
  try {
    const { data } = await apiClient.post('/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    })

    return { success: true, detail: data?.detail || 'If an account exists for this email, a reset link has been sent. Please check your inbox.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to start password reset. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function resetPassword({ token, newPassword, confirmPassword }) {
  try {
    const { data } = await apiClient.post('/auth/reset-password', {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    })

    return { success: true, detail: data?.detail || 'Password reset successfully.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reset password. The reset link may have expired.',
    )

    const fieldErrors = {}
    if (Array.isArray(errorData?.detail)) {
      for (const issue of errorData.detail) {
        const key = issue.loc?.find((part) => ['new_password', 'confirm_password'].includes(part))
        if (key) fieldErrors[key === 'new_password' ? 'newPassword' : 'confirmPassword'] = issue.msg
      }
    }
    return { success: false, status: error.response?.status, error: message, fieldErrors }
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
    if (error.response?.status === 401) useAuthStore.getState().logout()
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load profile details. Please try again.',
    )

    return { success: false, status: error.response?.status, error: message }
  }
}

export async function logout() {
  const { authTokens } = useAuthStore.getState()

  // Must run BEFORE the server logout call, while the access token is still valid - wrapped
  // internally so any failure here can never block the user from actually logging out.
  await disablePushForLogout()

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
    syncPushToken() // fire-and-forget - never block/fail the Google sign-in callback on this
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

    return { success: false, error: message, fieldErrors: phoneConflictFields(error.response?.status, message) }
  }
}
