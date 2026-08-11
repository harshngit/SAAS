import { ROLES } from '../../auth/roles'
import { getFileUrl } from '../../api/files'

export const staffRoleOptions = [
  ROLES.SALES_OFFICER,
  ROLES.DELIVERY_PARTNER,
  ROLES.ACCOUNTANT,
]

export const roleNameToSystemRole = {
  superadmin: ROLES.SUPER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  salesofficer: ROLES.SALES_OFFICER,
  sales_officer: ROLES.SALES_OFFICER,
  deliverypartner: ROLES.DELIVERY_PARTNER,
  delivery_partner: ROLES.DELIVERY_PARTNER,
  accountant: ROLES.ACCOUNTANT,
}

export function getSystemRoleFromRoleName(name = '') {
  const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const compactName = normalizedName.replace(/_/g, '')
  return roleNameToSystemRole[normalizedName] || roleNameToSystemRole[compactName] || normalizedName
}

export function normalizeApiUser(user) {
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  const role = user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name)
  const isActive = user.is_active ?? user.status === 'active'

  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.display_name || user.name || fullName || user.username || user.email,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role,
    role_id: user.role_id,
    roleId: user.role_id,
    roleDetail: user.role_detail,
    isActive,
    status: user.status || (isActive ? 'active' : 'inactive'),
    createdAt: user.created_at,
    employeeId: user.employee_id,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name,
    gender: user.gender,
    dateOfBirth: user.date_of_birth,
    maritalStatus: user.marital_status,
    bloodGroup: user.blood_group,
    nationality: user.nationality,
    alternateMobileNumber: user.alternate_mobile_number,
    personalEmail: user.personal_email,
    emergencyContactName: user.emergency_contact_name,
    emergencyContactNumber: user.emergency_contact_number,
    emergencyContactRelationship: user.emergency_contact_relationship,
    currentAddress: user.current_address,
    permanentAddress: user.permanent_address,
    city: user.city,
    state: user.state,
    country: user.country,
    pinZipCode: user.pin_zip_code,
    designation: user.designation,
    employmentType: user.employment_type,
    dateOfJoining: user.date_of_joining,
    dateOfExit: user.date_of_exit,
    employeeStatus: user.employee_status,
    workLocation: user.work_location,
    reportingManagerId: user.reporting_manager_id,
    shift: user.shift,
    basicSalary: user.basic_salary,
    bankName: user.bank_name,
    accountNumber: user.account_number,
    ifscSwiftCode: user.ifsc_swift_code,
    accountHolderName: user.account_holder_name,
    upiId: user.upi_id,
    profilePhoto: getFileUrl(user.profile_photo),
    identityProofType: user.identity_proof_type,
    identityProofFile: getFileUrl(user.identity_proof_file),
    resumeCv: getFileUrl(user.resume_cv),
    offerLetter: getFileUrl(user.offer_letter),
    appointmentLetter: getFileUrl(user.appointment_letter),
    uploadedDocuments: normalizeDocuments(user.uploaded_documents),
    experienceCertificates: normalizeDocuments(user.experience_certificates),
    educationalCertificates: normalizeDocuments(user.educational_certificates),
    skills: user.skills || [],
    language: user.language,
    timeZone: user.time_zone,
  }
}

function normalizeDocuments(documents = []) {
  if (!Array.isArray(documents)) return []

  return documents.map((document) => ({
    ...document,
    url: getFileUrl(document),
  }))
}
