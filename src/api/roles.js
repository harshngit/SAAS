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

function humanizeKey(key = '') {
  return key
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeCatalogItem(item) {
  if (item && typeof item === 'object') {
    const key = item.key || item.value || item.id || item.code || item.name
    return { key, label: item.label || item.name || humanizeKey(key) }
  }

  return { key: item, label: humanizeKey(item) }
}

export async function getRolesCatalog() {
  try {
    const { data } = await apiClient.get('/roles/catalog', {
      headers: authHeader(),
    })

    const rawModules = data?.modules || []
    const rawActions = data?.actions || []

    return {
      success: true,
      modules: rawModules.map(normalizeCatalogItem),
      actions: rawActions.map(normalizeCatalogItem),
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load the roles catalog. Please try again.',
    )

    return { success: false, error: message, modules: [], actions: [] }
  }
}

export async function listRoles() {
  try {
    const { data } = await apiClient.get('/roles', {
      headers: authHeader(),
    })

    return { success: true, roles: Array.isArray(data) ? data : data?.roles || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load roles. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getRole(roleId) {
  try {
    const { data } = await apiClient.get(`/roles/${roleId}`, {
      headers: authHeader(),
    })

    return { success: true, role: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load role details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createRole({ name, workspace, description, dataScope, permissions }) {
  try {
    const requestBody = {
      name: name?.trim(),
      permissions,
    }
    if (workspace !== undefined) requestBody.workspace = workspace
    if (description !== undefined) requestBody.description = description
    if (dataScope !== undefined) requestBody.data_scope = dataScope

    const { data } = await apiClient.post('/roles', requestBody, { headers: authHeader() })

    return { success: true, role: data }
  } catch (error) {
    const errorData = error.response?.data
    const fallbackMessage =
      error.response?.status === 409
        ? 'A role with this name already exists.'
        : 'Unable to create role. Please try again.'
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      fallbackMessage,
    )

    return { success: false, error: message }
  }
}

// PUT /roles/{id} was removed (405) - roles are now edited with PATCH, and it replaces the
// whole permission matrix, so always send the complete set of module permissions.
export async function updateRole(roleId, { name, workspace, description, dataScope, permissions } = {}) {
  try {
    const requestBody = {}
    if (name !== undefined) requestBody.name = name?.trim()
    if (workspace !== undefined) requestBody.workspace = workspace
    if (description !== undefined) requestBody.description = description
    if (dataScope !== undefined) requestBody.data_scope = dataScope
    if (permissions !== undefined) requestBody.permissions = permissions

    const { data } = await apiClient.patch(`/roles/${roleId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, role: data }
  } catch (error) {
    const errorData = error.response?.data
    const fallbackMessage =
      error.response?.status === 409
        ? 'A role with this name already exists.'
        : 'Unable to update role. Please try again.'
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      fallbackMessage,
    )

    return { success: false, error: message }
  }
}

export async function deleteRole(roleId) {
  try {
    await apiClient.delete(`/roles/${roleId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete role. Please try again.',
    )

    return { success: false, error: message }
  }
}
