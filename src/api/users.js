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

// Documents live under documents.<field> in the sectioned body; the "generic" collection frontend
// code calls `uploaded_documents` is stored server-side as `other_documents`.
const DOCUMENT_COLLECTION_FIELDS = {
  uploaded_documents: 'other_documents',
  experience_certificates: 'experience_certificates',
  educational_certificates: 'educational_certificates',
}

const EMPLOYEE_FILE_FIELD_SECTIONS = {
  profile_photo: 'basic_information',
  identity_proof_file: 'documents',
  resume_cv: 'documents',
  offer_letter: 'documents',
  appointment_letter: 'documents',
}

// undefined = leave the field untouched (omit from the PATCH), null = explicitly clear it,
// otherwise set it to the given URL/array of URLs.
function setFileField(section, key, value) {
  if (value === undefined) return
  section[key] = value
}

function toUrlList(value) {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

// GET/PATCH /users/{id} return a "sectioned" profile (basic_information, contact_information, ...),
// while GET /users (list) and POST /users still deal in the old flat shape. Flatten sectioned
// responses back to the flat shape so normalizeApiUser (built for the flat/list shape) keeps working
// everywhere. Already-flat objects (no known section keys) pass through untouched.
const USER_SECTION_KEYS = [
  'basic_information',
  'contact_information',
  'address_information',
  'employment_information',
  'login_security',
  'payroll_information',
  'documents',
  'professional_information',
  'system_preferences',
]

function flattenSectionedUser(data) {
  if (!data || typeof data !== 'object') return data
  if (!USER_SECTION_KEYS.some((key) => key in data)) return data

  const basic = data.basic_information || {}
  const contact = data.contact_information || {}
  const address = data.address_information || {}
  const employment = data.employment_information || {}
  const loginSecurity = data.login_security || {}
  const payroll = data.payroll_information || {}
  const documents = data.documents || {}
  const professional = data.professional_information || {}
  const preferences = data.system_preferences || {}

  return {
    id: data.id,
    employee_id: data.employee_id,
    organization_id: data.organization_id,
    name: data.name,
    system_role: data.system_role,
    is_active: data.is_active,
    status: preferences.account_status || (data.is_active === false ? 'inactive' : 'active'),
    created_at: data.created_at,

    role_id: employment.role_id,
    role_detail: employment.role_detail,

    first_name: basic.first_name,
    last_name: basic.last_name,
    display_name: basic.display_name,
    gender: basic.gender,
    date_of_birth: basic.date_of_birth,
    marital_status: basic.marital_status,
    blood_group: basic.blood_group,
    nationality: basic.nationality,
    profile_photo: basic.profile_photo,

    phone: contact.mobile_number,
    alternate_mobile_number: contact.alternate_mobile_number,
    personal_email: contact.personal_email,
    email: contact.official_email,
    emergency_contact_name: contact.emergency_contact_name,
    emergency_contact_number: contact.emergency_contact_number,
    emergency_contact_relationship: contact.emergency_contact_relationship,

    current_address: address.current_address,
    permanent_address: address.permanent_address,
    city: address.city,
    state: address.state,
    country: address.country,
    pin_zip_code: address.pin_zip_code,

    designation: employment.designation,
    reporting_manager_id: employment.reporting_manager_id || employment.reporting_manager?.id,
    reporting_manager_name: employment.reporting_manager?.name,
    employment_type: employment.employment_type,
    date_of_joining: employment.date_of_joining,
    date_of_exit: employment.date_of_exit,
    work_location: employment.work_location,
    shift: employment.shift,
    employee_status: employment.employee_status,

    username: loginSecurity.username,

    basic_salary: payroll.basic_salary,
    bank_name: payroll.bank_name,
    account_number: payroll.account_number,
    ifsc_swift_code: payroll.ifsc_swift_code,
    account_holder_name: payroll.account_holder_name,
    upi_id: payroll.upi_id,

    identity_proof_type: documents.identity_proof_type,
    identity_proof_file: documents.identity_proof_file,
    resume_cv: documents.resume_cv,
    offer_letter: documents.offer_letter,
    appointment_letter: documents.appointment_letter,
    experience_certificates: documents.experience_certificates || [],
    educational_certificates: documents.educational_certificates || [],
    uploaded_documents: documents.other_documents || [],

    skills: professional.skills || [],
    language: preferences.language,
    time_zone: preferences.time_zone,
  }
}

// Flat camelCase payload (from UserEdit/UserManagement formData) -> the sectioned PATCH body.
function buildSectionedUserBody(payload) {
  const body = cleanPayload({
    employee_id: payload.employeeId?.trim(),
    name: payload.name?.trim(),
  })

  const basicInformation = cleanPayload({
    first_name: payload.firstName?.trim(),
    last_name: payload.lastName?.trim(),
    display_name: payload.name?.trim(),
    gender: payload.gender,
    date_of_birth: toIsoDateTime(payload.dateOfBirth),
    marital_status: payload.maritalStatus,
    blood_group: payload.bloodGroup,
    nationality: payload.nationality,
  })
  setFileField(basicInformation, 'profile_photo', payload.profilePhotoUrl)
  body.basic_information = basicInformation

  body.contact_information = cleanPayload({
    mobile_number: payload.phone?.trim(),
    alternate_mobile_number: payload.alternateMobileNumber?.trim(),
    personal_email: payload.personalEmail?.trim().toLowerCase(),
    official_email: payload.email?.trim().toLowerCase(),
    emergency_contact_name: payload.emergencyContactName?.trim(),
    emergency_contact_number: payload.emergencyContactNumber?.trim(),
    emergency_contact_relationship: payload.emergencyContactRelationship,
  })

  body.address_information = cleanPayload({
    current_address: payload.currentAddress?.trim(),
    permanent_address: payload.permanentAddress?.trim(),
    city: payload.city?.trim(),
    state: payload.state,
    country: payload.country,
    pin_zip_code: payload.pinCode?.trim(),
  })

  body.employment_information = cleanPayload({
    designation: payload.designation?.trim(),
    reporting_manager_id: payload.reportingManager,
    employment_type: payload.employmentType,
    date_of_joining: toIsoDateTime(payload.dateOfJoining),
    date_of_exit: toIsoDateTime(payload.dateOfExit),
    work_location: payload.workLocation,
    shift: payload.shift,
    employee_status: payload.employeeStatus,
  })

  body.login_security = cleanPayload({
    username: payload.username?.trim(),
    password: payload.password,
    confirm_password: payload.confirmPassword,
  })

  body.payroll_information = cleanPayload({
    basic_salary: toNumberOrEmpty(payload.basicSalary),
    bank_name: payload.bankName?.trim(),
    account_number: payload.accountNumber?.trim(),
    ifsc_swift_code: payload.ifscSwiftCode?.trim(),
    account_holder_name: payload.accountHolderName?.trim(),
    upi_id: payload.upiId?.trim(),
  })

  const documents = cleanPayload({
    identity_proof_type: payload.identityProofType,
  })
  setFileField(documents, 'identity_proof_file', payload.identityProofFileUrl)
  setFileField(documents, 'resume_cv', payload.resumeCvUrl)
  setFileField(documents, 'offer_letter', payload.offerLetterUrl)
  setFileField(documents, 'appointment_letter', payload.appointmentLetterUrl)
  setFileField(documents, 'experience_certificates', payload.experienceCertificateUrls)
  setFileField(documents, 'educational_certificates', payload.educationalCertificateUrls)
  setFileField(documents, 'other_documents', payload.otherDocumentUrls)
  body.documents = documents

  body.professional_information = cleanPayload({
    skills: toStringList(payload.skills),
  })

  body.system_preferences = cleanPayload({
    language: payload.language,
    time_zone: payload.timeZone,
  })

  Object.keys(body).forEach((key) => {
    const value = body[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      delete body[key]
    }
  })

  return body
}

export async function createUser(payload) {
  try {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const displayName = payload.name?.trim() || `${payload.firstName || ''} ${payload.lastName || ''}`.trim()
    const username = (payload.username || normalizedEmail.split('@')[0] || displayName).trim()

    // Add Staff already uploads files immediately via POST /files/upload and stores the
    // resulting URLs under these *Name keys (see UserManagement.jsx) - bridge them into the
    // canonical *Url fields buildSectionedUserBody expects.
    const requestBody = buildSectionedUserBody({
      ...payload,
      name: displayName,
      email: normalizedEmail,
      username,
      phone: payload.phone?.trim(),
      profilePhotoUrl: payload.profilePictureName || undefined,
      identityProofFileUrl: payload.identityDocumentsName || undefined,
      resumeCvUrl: payload.resumeCvName || undefined,
      offerLetterUrl: payload.offerLetterName || undefined,
      appointmentLetterUrl: payload.appointmentLetterName || undefined,
      experienceCertificateUrls: toUrlList(payload.experienceCertificatesName),
      educationalCertificateUrls: toUrlList(payload.educationalCertificatesName),
    })

    if (payload.systemStatus) {
      requestBody.system_preferences = {
        ...(requestBody.system_preferences || {}),
        account_status: payload.systemStatus,
      }
    }

    const selectedRoleId = payload.role_id || payload.roleId
    if (selectedRoleId || payload.role) {
      requestBody.employment_information = {
        ...(requestBody.employment_information || {}),
        ...(selectedRoleId ? { role_id: selectedRoleId } : { role: payload.role }),
      }
    }

    const { data } = await apiClient.post('/users', requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
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

// Per-field upload/clear endpoints (POST/DELETE /users/{id}/files/{field}) were removed.
// Files are now uploaded generically via POST /files/upload (see api/files.js's uploadFile/
// uploadFiles) and the resulting URL is attached with a normal sectioned PATCH /users/{id}.
// clearEmployeeFile still targets a single field, so it PATCHes just that field to null.
export async function clearEmployeeFile(userId, field) {
  try {
    const section = EMPLOYEE_FILE_FIELD_SECTIONS[field] || 'documents'
    const { data } = await apiClient.patch(`/users/${userId}`, { [section]: { [field]: null } }, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to clear employee file. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteEmployeeDocument(userId, collection, documentId) {
  try {
    const field = DOCUMENT_COLLECTION_FIELDS[collection] || collection

    await apiClient.delete(`/users/${userId}/documents/${field}`, {
      headers: authHeader(),
      params: { document_id: documentId },
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete employee document. Please try again.',
    )

    return { success: false, error: message }
  }
}

// The dedicated "clear whole collection" endpoint was removed - empty the list with a PATCH instead.
export async function clearEmployeeDocuments(userId, collection) {
  try {
    const field = DOCUMENT_COLLECTION_FIELDS[collection] || collection
    const { data } = await apiClient.patch(`/users/${userId}`, { documents: { [field]: [] } }, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
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

    return { success: true, user: flattenSectionedUser(data) }
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
    const requestBody = buildSectionedUserBody(payload)

    const { data } = await apiClient.patch(`/users/${userId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update staff. Please try again.',
    )

    return { success: false, error: message }
  }
}

// PATCH /users/{id}/role was removed - role reassignment now rides in the same sectioned
// PATCH /users/{id} body, under employment_information.role_id.
export async function changeUserRole(userId, payload) {
  try {
    const roleId = payload.role_id || payload.roleId
    const requestBody = {
      employment_information: cleanPayload({
        role_id: roleId,
        role: roleId ? undefined : payload.role,
      }),
    }

    const { data } = await apiClient.patch(`/users/${userId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to change staff role. Please try again.',
    )

    return { success: false, error: message }
  }
}

// PATCH /users/{id}/status was removed - account_status now rides in the same sectioned
// PATCH /users/{id} body, under system_preferences. Anything other than "active" blocks login.
export async function updateUserStatus(userId, isActive) {
  try {
    const requestBody = {
      system_preferences: { account_status: isActive ? 'active' : 'inactive' },
    }

    const { data } = await apiClient.patch(`/users/${userId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, user: flattenSectionedUser(data) }
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
