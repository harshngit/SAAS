import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

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

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

export async function listSuperAdminOrganizations(filters = {}) {
  try {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value != null && value !== ''),
    )

    const { data } = await apiClient.get('/superadmin/organizations', { params })
    return { success: true, organizations: Array.isArray(data) ? data : [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load organizations. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getOrganization(orgId) {
  try {
    const { data } = await apiClient.get(`/superadmin/organizations/${orgId}`)
    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load organization. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteOrganization(orgId) {
  try {
    await apiClient.delete(`/superadmin/organizations/${orgId}`)
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete organization. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function approveOrganizationUpgrade(orgId) {
  try {
    const { data } = await apiClient.patch(`/superadmin/organizations/${orgId}/approve-upgrade`)
    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve upgrade. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function rejectOrganizationUpgrade(orgId, reason) {
  try {
    const { data } = await apiClient.patch(`/superadmin/organizations/${orgId}/reject-upgrade`, { reason })
    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reject upgrade. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateOrganizationStatus(orgId, status) {
  try {
    const { data } = await apiClient.patch(`/superadmin/organizations/${orgId}/status`, { status })
    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update organization status. Please try again.',
    )

    return { success: false, error: message }
  }
}

function buildSuperAdminBody(payload) {
  const body = {}

  if (payload.name !== undefined) body.name = payload.name?.trim() || ''
  if (payload.email !== undefined) body.email = payload.email?.trim() || ''
  if (payload.phone !== undefined) body.phone = payload.phone?.trim() || ''
  if (payload.password) body.password = payload.password
  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    body.is_active = payload.isActive ?? payload.is_active
  }

  return body
}

export async function listSuperAdmins() {
  try {
    const { data } = await apiClient.get('/superadmin/admins')
    return { success: true, admins: Array.isArray(data) ? data : data?.admins || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load superadmins. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createSuperAdmin(payload) {
  try {
    const { data } = await apiClient.post('/superadmin/admins', buildSuperAdminBody(payload))
    return { success: true, admin: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create superadmin. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSuperAdmin(adminId, payload) {
  try {
    const { data } = await apiClient.patch(`/superadmin/admins/${adminId}`, buildSuperAdminBody(payload))
    return { success: true, admin: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update superadmin. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteSuperAdmin(adminId) {
  try {
    await apiClient.delete(`/superadmin/admins/${adminId}`)
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete superadmin. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listPlans() {
  try {
    const { data } = await apiClient.get('/superadmin/plans')
    return { success: true, plans: Array.isArray(data) ? data : data?.plans || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load plans. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createPlan(payload) {
  try {
    const { data } = await apiClient.post('/superadmin/plans', payload)
    return { success: true, plan: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create plan. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePlan(id, payload) {
  try {
    const { data } = await apiClient.put(`/superadmin/plans/${id}`, payload)
    return { success: true, plan: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update plan. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updatePlanStatus(id, isActive) {
  try {
    const { data } = await apiClient.patch(`/superadmin/plans/${id}/status`, { is_active: isActive })
    return { success: true, plan: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update plan status. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deletePlan(id) {
  try {
    await apiClient.delete(`/superadmin/plans/${id}`)
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete plan. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deactivatePlan(id) {
  try {
    const { data } = await apiClient.patch(`/superadmin/plans/${id}/deactivate`)
    return { success: true, plan: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to deactivate plan. Please try again.',
    )

    return { success: false, error: message }
  }
}
