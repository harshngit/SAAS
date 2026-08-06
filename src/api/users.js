import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (errorData?.code === 'ECONNABORTED') {
    return 'The request timed out. Please try again.'
  }

  if (errorData?.message === 'Network Error') {
    return 'Network error. Please check your connection and try again.'
  }

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

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (
      value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
    )),
  )
}

function toIsoDateTime(value) {
  if (!value) return ''

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function toNumberOrEmpty(value) {
  if (value === undefined || value === null || value === '') return ''

  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? '' : numberValue
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function createUser(payload) {
  try {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const displayName = payload.name?.trim() || `${payload.firstName || ''} ${payload.lastName || ''}`.trim()
    const username = (payload.username || normalizedEmail.split('@')[0] || displayName).trim()

    const requestBody = cleanPayload({
      employee_id: payload.employeeId?.trim(),
      first_name: payload.firstName?.trim(),
      last_name: payload.lastName?.trim(),
      display_name: displayName,
      gender: payload.gender,
      date_of_birth: toIsoDateTime(payload.dateOfBirth),
      marital_status: payload.maritalStatus,
      blood_group: payload.bloodGroup,
      nationality: payload.nationality,
      alternate_mobile_number: payload.alternateMobileNumber?.trim(),
      personal_email: payload.personalEmail?.trim().toLowerCase(),
      emergency_contact_name: payload.emergencyContactName?.trim(),
      emergency_contact_number: payload.emergencyContactNumber?.trim(),
      emergency_contact_relationship: payload.emergencyContactRelationship,
      current_address: payload.currentAddress?.trim(),
      permanent_address: payload.permanentAddress?.trim(),
      city: payload.city?.trim(),
      state: payload.state,
      country: payload.country,
      pin_zip_code: payload.pinCode?.trim(),
      designation: payload.designation?.trim(),
      reporting_manager_id: payload.reportingManager,
      employment_type: payload.employmentType,
      date_of_joining: toIsoDateTime(payload.dateOfJoining),
      date_of_exit: toIsoDateTime(payload.dateOfExit),
      work_location: payload.workLocation,
      shift: payload.shift,
      employee_status: payload.employeeStatus,
      basic_salary: toNumberOrEmpty(payload.basicSalary),
      bank_name: payload.bankName?.trim(),
      account_number: payload.accountNumber?.trim(),
      ifsc_swift_code: payload.ifscSwiftCode?.trim(),
      account_holder_name: payload.accountHolderName?.trim(),
      upi_id: payload.upiId?.trim(),
      profile_photo: payload.profilePictureName,
      identity_proof_type: payload.identityProofType,
      identity_proof_file: payload.identityDocumentsName,
      resume_cv: payload.resumeCvName,
      offer_letter: payload.offerLetterName,
      appointment_letter: payload.appointmentLetterName,
      skills: toStringList(payload.skills),
      language: payload.language,
      time_zone: payload.timeZone,
      status: payload.systemStatus,
      name: displayName,
      email: normalizedEmail,
      username,
      phone: payload.phone.trim(),
      password: payload.password,
      confirm_password: payload.confirmPassword,
    })

    const selectedRoleId = payload.role_id || payload.roleId
    if (selectedRoleId) {
      requestBody.role_id = selectedRoleId
    } else if (payload.role) {
      requestBody.role = payload.role
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

export async function listUsers(params = {}) {
  try {
    const queryParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/users', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, users: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      error.code ? { code: error.code, message: error.message } : errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load staff. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getEmployeeOptions() {
  try {
    const { data } = await apiClient.get('/users/meta/employee-options', {
      headers: authHeader(),
    })

    return { success: true, options: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load employee form options. Using defaults.',
    )

    return { success: false, error: message }
  }
}

export async function uploadEmployeeFile(userId, field, file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`/users/${userId}/files/${field}`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload employee file. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function clearEmployeeFile(userId, field) {
  try {
    const { data } = await apiClient.delete(`/users/${userId}/files/${field}`, {
      headers: authHeader(),
    })

    return { success: true, user: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to clear employee file. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadIdentityProof(userId, file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`/users/${userId}/identity-proof`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, url: data?.url || '' }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload identity proof. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadEmployeeDocuments(userId, collection, files) {
  try {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const { data } = await apiClient.post(`/users/${userId}/documents/${collection}`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, documents: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload employee documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listEmployeeDocuments(userId, collection) {
  try {
    const { data } = await apiClient.get(`/users/${userId}/documents/${collection}`, {
      headers: authHeader(),
    })

    return { success: true, documents: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load employee documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteEmployeeDocument(userId, collection, documentId) {
  try {
    const { data } = await apiClient.delete(`/users/${userId}/documents/${collection}/${documentId}`, {
      headers: authHeader(),
    })

    return { success: true, documents: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete employee document. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function clearEmployeeDocuments(userId, collection) {
  try {
    await apiClient.delete(`/users/${userId}/documents/${collection}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to clear employee documents. Please try again.',
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
    const requestBody = cleanPayload({
      employee_id: payload.employeeId?.trim(),
      first_name: payload.firstName?.trim(),
      last_name: payload.lastName?.trim(),
      display_name: payload.name?.trim(),
      gender: payload.gender,
      date_of_birth: toIsoDateTime(payload.dateOfBirth),
      marital_status: payload.maritalStatus,
      blood_group: payload.bloodGroup,
      nationality: payload.nationality,
      alternate_mobile_number: payload.alternateMobileNumber?.trim(),
      personal_email: payload.personalEmail?.trim().toLowerCase(),
      emergency_contact_name: payload.emergencyContactName?.trim(),
      emergency_contact_number: payload.emergencyContactNumber?.trim(),
      emergency_contact_relationship: payload.emergencyContactRelationship,
      current_address: payload.currentAddress?.trim(),
      permanent_address: payload.permanentAddress?.trim(),
      city: payload.city?.trim(),
      state: payload.state,
      country: payload.country,
      pin_zip_code: payload.pinCode?.trim(),
      designation: payload.designation?.trim(),
      reporting_manager_id: payload.reportingManager,
      employment_type: payload.employmentType,
      date_of_joining: toIsoDateTime(payload.dateOfJoining),
      date_of_exit: toIsoDateTime(payload.dateOfExit),
      work_location: payload.workLocation,
      shift: payload.shift,
      employee_status: payload.employeeStatus,
      basic_salary: toNumberOrEmpty(payload.basicSalary),
      bank_name: payload.bankName?.trim(),
      account_number: payload.accountNumber?.trim(),
      ifsc_swift_code: payload.ifscSwiftCode?.trim(),
      account_holder_name: payload.accountHolderName?.trim(),
      upi_id: payload.upiId?.trim(),
      identity_proof_type: payload.identityProofType,
      skills: toStringList(payload.skills),
      language: payload.language,
      time_zone: payload.timeZone,
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
      username: payload.username?.trim(),
      phone: payload.phone?.trim(),
    })

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

export async function changeUserRole(userId, payload) {
  try {
    const requestBody = cleanPayload({
      role_id: payload.role_id || payload.roleId,
      role: payload.role,
    })

    const { data } = await apiClient.patch(`/users/${userId}/role`, requestBody, {
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

export async function deleteUser(userId) {
  try {
    await apiClient.delete(`/users/${userId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete staff member. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function resetUserPassword(userId, newPassword) {
  try {
    const { data } = await apiClient.post(
      `/users/${userId}/reset-password`,
      { new_password: newPassword },
      { headers: authHeader() },
    )

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
