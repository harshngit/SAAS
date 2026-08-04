import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

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

export async function login({ email, phone, password, otp }) {
  if (phone || otp) {
    return { success: false, error: 'Phone login is not available yet. Please sign in with email and password.' }
  }

  try {
    const requestBody = {
      email: email.trim().toLowerCase(),
      password,
    }

    const { data } = await apiClient.post('/auth/login', requestBody)
    useAuthStore.getState().setAuthenticatedSession(data)
    return { success: true, ...data }
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

export async function resetPasswordDirect({ email, newPassword }) {
  try {
    const requestBody = {
      email: email.trim().toLowerCase(),
      new_password: newPassword,
    }

    const { data } = await apiClient.post('/auth/reset-password-direct', requestBody)
    return { success: true, detail: data?.detail || 'Password reset successfully.' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reset password. Please try again.',
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
