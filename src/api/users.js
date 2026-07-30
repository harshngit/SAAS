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
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
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

export async function createUser(payload) {
  try {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const username = (payload.username || normalizedEmail.split('@')[0] || payload.name).trim()
    const selectedRole = payload.role

    const requestBody = {
      name: payload.name.trim(),
      email: normalizedEmail,
      username,
      phone: payload.phone.trim(),
      password: payload.password,
      role: selectedRole,
    }

    const selectedRoleId = payload.role_id || payload.roleId
    if (selectedRoleId && selectedRoleId !== selectedRole) {
      requestBody.role_id = selectedRoleId
    }

    const { data } = await apiClient.post('/users', requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create staff. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listRoles() {
  try {
    const { data } = await apiClient.get('/roles', {
      headers: authHeader(),
    })

    return { success: true, roles: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load roles. Using default staff roles.',
    )

    return { success: false, error: message }
  }
}

export async function listUsers() {
  try {
    const { data } = await apiClient.get('/users', {
      headers: authHeader(),
    })

    return { success: true, users: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load staff. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getUser(userId) {
  try {
    const { data } = await apiClient.get(`/users/${userId}`, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load staff details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateUser(userId, payload) {
  try {
    const requestBody = {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      username: payload.username.trim(),
      phone: payload.phone.trim(),
    }

    const { data } = await apiClient.patch(`/users/${userId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update staff. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function changeUserRole(userId, roleId) {
  try {
    const { data } = await apiClient.patch(`/users/${userId}/role`, { role_id: roleId }, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to change staff role. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateUserStatus(userId, isActive) {
  try {
    const { data } = await apiClient.patch(`/users/${userId}/status`, { is_active: isActive }, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update staff status. Please try again.',
    )

    return { success: false, error: message }
  }
}
