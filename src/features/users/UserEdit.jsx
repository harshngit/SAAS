import { useEffect, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { roleLabels } from '../../auth/roles'
import { changeUserRole, clearEmployeeFile, getEmployeeOptions, getUser, listRoles, updateUser, updateUserStatus, uploadEmployeeFile } from '../../api/users'
import { getSystemRoleFromRoleName, normalizeApiUser, staffRoleOptions } from './userRoleUtils'

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

const formatOptionLabel = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const toSelectOptions = (values = [], fallbackOptions = []) => {
  if (!values.length) {
    return fallbackOptions
  }

  return values.map((value) => ({
    value,
    label: formatOptionLabel(value),
  }))
}

const employmentTypeOptions = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
]

const employeeStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'Probation' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'notice_period', label: 'Notice Period' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
]

const systemStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const shiftOptions = [
  { value: 'general', label: 'General' },
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const maritalStatusOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => ({ value, label: value }))

const emptyEmployeeOptions = {
  employment_types: [],
  employee_statuses: [],
  account_statuses: [],
  genders: [],
  marital_statuses: [],
  blood_groups: [],
  emergency_contact_relationships: [],
  countries: [],
  nationalities: [],
  states: [],
  designations: [],
  work_locations: [],
  shifts: [],
}

function toDateInputValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function toSkillsInputValue(value) {
  return Array.isArray(value) ? value.join(', ') : value || ''
}

export default function UserEdit() {
  const { user_id: userId } = useParams()
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    employeeId: '',
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    maritalStatus: '',
    bloodGroup: '',
    nationality: '',
    alternateMobileNumber: '',
    personalEmail: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    emergencyContactRelationship: '',
    currentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    country: '',
    pinCode: '',
    role: '',
    role_id: '',
    designation: '',
    reportingManager: '',
    employmentType: '',
    dateOfJoining: '',
    dateOfExit: '',
    employeeStatus: '',
    workLocation: '',
    shift: '',
    basicSalary: '',
    bankName: '',
    accountNumber: '',
    ifscSwiftCode: '',
    accountHolderName: '',
    upiId: '',
    identityProofType: '',
    skills: '',
    language: '',
    timeZone: '',
    systemStatus: '',
    profilePictureName: '',
  })
  const [employeeOptions, setEmployeeOptions] = useState(emptyEmployeeOptions)
  const [employeeOptionsError, setEmployeeOptionsError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isSavingAccountStatus, setIsSavingAccountStatus] = useState(false)
  const [isClearingProfilePhoto, setIsClearingProfilePhoto] = useState(false)
  const [error, setError] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState(null)
  const roleChanged = Boolean(formData.role_id && formData.role_id !== user?.role_id)
  const accountStatusChanged = Boolean(user) && (formData.systemStatus === 'active') !== Boolean(user.isActive)
  const basicInformationChanged = Boolean(user) && (
    formData.name !== (user.name || '') ||
    formData.email !== (user.email || '') ||
    formData.username !== (user.username || '') ||
    formData.phone !== (user.phone || '') ||
    formData.employeeId !== (user.employeeId || '') ||
    formData.firstName !== (user.firstName || '') ||
    formData.lastName !== (user.lastName || '') ||
    formData.gender !== (user.gender || '') ||
    formData.dateOfBirth !== toDateInputValue(user.dateOfBirth) ||
    formData.maritalStatus !== (user.maritalStatus || '') ||
    formData.bloodGroup !== (user.bloodGroup || '') ||
    formData.nationality !== (user.nationality || '') ||
    formData.alternateMobileNumber !== (user.alternateMobileNumber || '') ||
    formData.personalEmail !== (user.personalEmail || '') ||
    formData.emergencyContactName !== (user.emergencyContactName || '') ||
    formData.emergencyContactNumber !== (user.emergencyContactNumber || '') ||
    formData.emergencyContactRelationship !== (user.emergencyContactRelationship || '') ||
    formData.currentAddress !== (user.currentAddress || '') ||
    formData.permanentAddress !== (user.permanentAddress || '') ||
    formData.city !== (user.city || '') ||
    formData.state !== (user.state || '') ||
    formData.country !== (user.country || '') ||
    formData.pinCode !== (user.pinZipCode || '') ||
    formData.designation !== (user.designation || '') ||
    formData.reportingManager !== (user.reportingManagerId || '') ||
    formData.employmentType !== (user.employmentType || '') ||
    formData.dateOfJoining !== toDateInputValue(user.dateOfJoining) ||
    formData.dateOfExit !== toDateInputValue(user.dateOfExit) ||
    formData.employeeStatus !== (user.employeeStatus || '') ||
    formData.workLocation !== (user.workLocation || '') ||
    formData.shift !== (user.shift || '') ||
    formData.basicSalary !== String(user.basicSalary ?? '') ||
    formData.bankName !== (user.bankName || '') ||
    formData.accountNumber !== (user.accountNumber || '') ||
    formData.ifscSwiftCode !== (user.ifscSwiftCode || '') ||
    formData.accountHolderName !== (user.accountHolderName || '') ||
    formData.upiId !== (user.upiId || '') ||
    formData.identityProofType !== (user.identityProofType || '') ||
    formData.skills !== toSkillsInputValue(user.skills) ||
    formData.language !== (user.language || '') ||
    formData.timeZone !== (user.timeZone || '')
  )
  const profilePictureChanged = Boolean(profilePictureFile)
  const userProfileChanged = basicInformationChanged || profilePictureChanged

  const apiRoleOptions = roles
    .map((role) => {
      const systemRole = getSystemRoleFromRoleName(role.name)
      return {
        value: systemRole,
        label: role.name,
        roleId: role.id,
      }
    })
    .filter((role) => staffRoleOptions.includes(role.value))

  const effectiveRoleSelectOptions = apiRoleOptions.length > 0 ? apiRoleOptions : staffRoleSelectOptions
  const effectiveGenderOptions = toSelectOptions(employeeOptions.genders, genderOptions)
  const effectiveMaritalStatusOptions = toSelectOptions(employeeOptions.marital_statuses, maritalStatusOptions)
  const effectiveBloodGroupOptions = toSelectOptions(employeeOptions.blood_groups, bloodGroupOptions)
  const effectiveNationalityOptions = toSelectOptions(employeeOptions.nationalities)
  const effectiveEmergencyRelationshipOptions = toSelectOptions(employeeOptions.emergency_contact_relationships)
  const effectiveCountryOptions = toSelectOptions(employeeOptions.countries)
  const effectiveStateOptions = toSelectOptions(employeeOptions.states)
  const effectiveDesignationOptions = toSelectOptions(employeeOptions.designations)
  const effectiveEmploymentTypeOptions = toSelectOptions(employeeOptions.employment_types, employmentTypeOptions)
  const effectiveEmployeeStatusOptions = toSelectOptions(employeeOptions.employee_statuses, employeeStatusOptions)
  const effectiveWorkLocationOptions = toSelectOptions(employeeOptions.work_locations)
  const effectiveShiftOptions = toSelectOptions(employeeOptions.shifts, shiftOptions)
  const effectiveSystemStatusOptions = systemStatusOptions

  useEffect(() => {
    let isMounted = true

    async function loadEditData() {
      setIsLoading(true)
      setError('')

      const [userResult, rolesResult, employeeOptionsResult] = await Promise.all([
        getUser(userId),
        listRoles(),
        getEmployeeOptions(),
      ])

      if (!isMounted) return

      setIsLoading(false)

      if (rolesResult.success) {
        setRoles(rolesResult.roles || [])
      }

      if (employeeOptionsResult.success) {
        setEmployeeOptions({ ...emptyEmployeeOptions, ...(employeeOptionsResult.options || {}) })
      } else {
        setEmployeeOptionsError(employeeOptionsResult.error)
      }

      if (!userResult.success) {
        setError(userResult.error)
        return
      }

      const nextUser = normalizeApiUser(userResult.user)
      setUser(nextUser)
      setFormData({
        name: nextUser.name || '',
        email: nextUser.email || '',
        username: nextUser.username || '',
        phone: nextUser.phone || '',
        employeeId: nextUser.employeeId || '',
        firstName: nextUser.firstName || '',
        lastName: nextUser.lastName || '',
        gender: nextUser.gender || '',
        dateOfBirth: toDateInputValue(nextUser.dateOfBirth),
        maritalStatus: nextUser.maritalStatus || '',
        bloodGroup: nextUser.bloodGroup || '',
        nationality: nextUser.nationality || '',
        alternateMobileNumber: nextUser.alternateMobileNumber || '',
        personalEmail: nextUser.personalEmail || '',
        emergencyContactName: nextUser.emergencyContactName || '',
        emergencyContactNumber: nextUser.emergencyContactNumber || '',
        emergencyContactRelationship: nextUser.emergencyContactRelationship || '',
        currentAddress: nextUser.currentAddress || '',
        permanentAddress: nextUser.permanentAddress || '',
        city: nextUser.city || '',
        state: nextUser.state || '',
        country: nextUser.country || '',
        pinCode: nextUser.pinZipCode || '',
        role: nextUser.role || '',
        role_id: nextUser.roleId || '',
        designation: nextUser.designation || '',
        reportingManager: nextUser.reportingManagerId || '',
        employmentType: nextUser.employmentType || '',
        dateOfJoining: toDateInputValue(nextUser.dateOfJoining),
        dateOfExit: toDateInputValue(nextUser.dateOfExit),
        employeeStatus: nextUser.employeeStatus || '',
        workLocation: nextUser.workLocation || '',
        shift: nextUser.shift || '',
        basicSalary: String(nextUser.basicSalary ?? ''),
        bankName: nextUser.bankName || '',
        accountNumber: nextUser.accountNumber || '',
        ifscSwiftCode: nextUser.ifscSwiftCode || '',
        accountHolderName: nextUser.accountHolderName || '',
        upiId: nextUser.upiId || '',
        identityProofType: nextUser.identityProofType || '',
        skills: toSkillsInputValue(nextUser.skills),
        language: nextUser.language || '',
        timeZone: nextUser.timeZone || '',
        systemStatus: nextUser.isActive ? 'active' : 'inactive',
        profilePictureName: nextUser.profilePhoto || '',
      })
    }

    loadEditData()

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!userProfileChanged) {
      return
    }

    setIsSaving(true)

    if (basicInformationChanged) {
      const updateResult = await updateUser(userId, formData)

      if (!updateResult.success) {
        setIsSaving(false)
        setError(updateResult.error)
        return
      }
    }

    if (profilePictureFile) {
      const uploadResult = await uploadEmployeeFile(userId, 'profile_photo', profilePictureFile)

      if (!uploadResult.success) {
        setIsSaving(false)
        setError(uploadResult.error)
        return
      }
    }

    setIsSaving(false)
    navigate('/admin/users')
  }

  const handleSaveRole = async () => {
    setError('')
    const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === formData.role)
    const rolePayload = {
      role_id: formData.role_id || selectedRole?.roleId || '',
      role: selectedRole?.label || formData.role,
    }

    if (!rolePayload.role_id && !rolePayload.role) {
      setError('Select a role before saving.')
      return
    }

    setIsSavingRole(true)
    const roleResult = await changeUserRole(userId, rolePayload)
    setIsSavingRole(false)

    if (!roleResult.success) {
      setError(roleResult.error)
      return
    }

    const updatedUser = normalizeApiUser(roleResult.user)
    setUser(updatedUser)
    setFormData((currentFormData) => ({
      ...currentFormData,
      role: updatedUser.role || currentFormData.role,
      role_id: updatedUser.role_id || currentFormData.role_id,
    }))
  }

  const handleSaveAccountStatus = async () => {
    setError('')

    const nextIsActive = formData.systemStatus === 'active'

    setIsSavingAccountStatus(true)
    const statusResult = await updateUserStatus(userId, nextIsActive)
    setIsSavingAccountStatus(false)

    if (!statusResult.success) {
      setError(statusResult.error)
      return
    }

    const updatedUser = normalizeApiUser(statusResult.user)
    setUser(updatedUser)
    setFormData((currentFormData) => ({
      ...currentFormData,
      systemStatus: updatedUser.isActive ? 'active' : 'inactive',
    }))
  }

  const handleRemoveProfilePhoto = async () => {
    setError('')
    setProfilePictureFile(null)

    if (!user?.profilePhoto) {
      setFormData({ ...formData, profilePictureName: '' })
      return
    }

    setIsClearingProfilePhoto(true)
    const result = await clearEmployeeFile(userId, 'profile_photo')
    setIsClearingProfilePhoto(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    const updatedUser = result.user ? normalizeApiUser(result.user) : null
    setUser((currentUser) => updatedUser || (currentUser ? { ...currentUser, profilePhoto: '' } : currentUser))
    setFormData((currentFormData) => ({
      ...currentFormData,
      profilePictureName: updatedUser?.profilePhoto || '',
    }))
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading staff edit form..." />
  }

  if (error && !user) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center text-sm font-medium text-primary-700">Back to Staff</Link>
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Edit user profile</p>
          <p className="mt-1 text-sm text-neutral-500">Update contact details, profile image, and workspace role.</p>
          {employeeOptionsError && (
            <p className="mt-2 text-xs font-medium text-amber-600">{employeeOptionsError}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#063B00] text-[#063B00] hover:border-[#063B00] hover:bg-primary-50 hover:text-[#063B00]"
          onClick={() => navigate('/admin/users')}
        >
          Back to Staff
        </Button>
      </div>

      <div className="mt-6 grid flex-1 content-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-primary-100 bg-linear-to-br from-white to-[#eef6eb] p-4">
          <p className="text-sm font-semibold text-neutral-900">Profile Picture</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">Add an optional image to make staff records easier to scan.</p>
          <label className="mt-4 flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary-200 bg-white text-center text-primary-700 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/70 hover:shadow-(--shadow-card)">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
              <Camera className="size-6" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">Upload Photo</span>
            <span className="max-w-36 truncate text-xs text-neutral-500">
              {formData.profilePictureName || 'PNG or JPG'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setProfilePictureFile(file || null)
                setFormData({ ...formData, profilePictureName: file?.name || '' })
              }}
            />
          </label>
          {formData.profilePictureName && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={handleRemoveProfilePhoto}
              loading={isClearingProfilePhoto}
            >
              <X className="size-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">1</span>
              <p className="text-sm font-semibold text-neutral-900">Basic information</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Employee ID"
                value={formData.employeeId}
                onChange={(event) => setFormData({ ...formData, employeeId: event.target.value })}
              />
              <Input
                label="First Name"
                value={formData.firstName}
                onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
              />
              <Input
                label="Last Name"
                value={formData.lastName}
                onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
              />
              <Input
                label="Display Name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                required
              />
              <Input
                label="Username"
                value={formData.username}
                onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">2</span>
              <p className="text-sm font-semibold text-neutral-900">Personal details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Select
                label="Gender"
                options={effectiveGenderOptions}
                value={formData.gender}
                onChange={(event) => setFormData({ ...formData, gender: event.target.value })}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(event) => setFormData({ ...formData, dateOfBirth: event.target.value })}
              />
              <Select
                label="Marital Status"
                options={effectiveMaritalStatusOptions}
                value={formData.maritalStatus}
                onChange={(event) => setFormData({ ...formData, maritalStatus: event.target.value })}
              />
              <Select
                label="Blood Group"
                options={effectiveBloodGroupOptions}
                value={formData.bloodGroup}
                onChange={(event) => setFormData({ ...formData, bloodGroup: event.target.value })}
              />
              {effectiveNationalityOptions.length > 0 ? (
                <Select
                  label="Nationality"
                  options={effectiveNationalityOptions}
                  value={formData.nationality}
                  onChange={(event) => setFormData({ ...formData, nationality: event.target.value })}
                />
              ) : (
                <Input
                  label="Nationality"
                  value={formData.nationality}
                  onChange={(event) => setFormData({ ...formData, nationality: event.target.value })}
                />
              )}
              <Input
                label="Skills"
                placeholder="Separate skills with commas"
                value={formData.skills}
                onChange={(event) => setFormData({ ...formData, skills: event.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">3</span>
              <p className="text-sm font-semibold text-neutral-900">Contact details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Alternate Mobile Number"
                type="tel"
                value={formData.alternateMobileNumber}
                onChange={(event) => setFormData({ ...formData, alternateMobileNumber: event.target.value })}
              />
              <Input
                label="Personal Email"
                type="email"
                value={formData.personalEmail}
                onChange={(event) => setFormData({ ...formData, personalEmail: event.target.value })}
              />
              <Input
                label="Emergency Contact Name"
                value={formData.emergencyContactName}
                onChange={(event) => setFormData({ ...formData, emergencyContactName: event.target.value })}
              />
              <Input
                label="Emergency Contact Number"
                type="tel"
                value={formData.emergencyContactNumber}
                onChange={(event) => setFormData({ ...formData, emergencyContactNumber: event.target.value })}
              />
              {effectiveEmergencyRelationshipOptions.length > 0 ? (
                <Select
                  label="Emergency Contact Relationship"
                  options={effectiveEmergencyRelationshipOptions}
                  value={formData.emergencyContactRelationship}
                  onChange={(event) => setFormData({ ...formData, emergencyContactRelationship: event.target.value })}
                />
              ) : (
                <Input
                  label="Emergency Contact Relationship"
                  value={formData.emergencyContactRelationship}
                  onChange={(event) => setFormData({ ...formData, emergencyContactRelationship: event.target.value })}
                />
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">4</span>
              <p className="text-sm font-semibold text-neutral-900">Address details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Current Address"
                as="textarea"
                value={formData.currentAddress}
                onChange={(event) => setFormData({ ...formData, currentAddress: event.target.value })}
              />
              <Input
                label="Permanent Address"
                as="textarea"
                value={formData.permanentAddress}
                onChange={(event) => setFormData({ ...formData, permanentAddress: event.target.value })}
              />
              <Input
                label="City"
                value={formData.city}
                onChange={(event) => setFormData({ ...formData, city: event.target.value })}
              />
              {effectiveStateOptions.length > 0 ? (
                <Select
                  label="State"
                  options={effectiveStateOptions}
                  value={formData.state}
                  onChange={(event) => setFormData({ ...formData, state: event.target.value })}
                />
              ) : (
                <Input
                  label="State"
                  value={formData.state}
                  onChange={(event) => setFormData({ ...formData, state: event.target.value })}
                />
              )}
              {effectiveCountryOptions.length > 0 ? (
                <Select
                  label="Country"
                  options={effectiveCountryOptions}
                  value={formData.country}
                  onChange={(event) => setFormData({ ...formData, country: event.target.value })}
                />
              ) : (
                <Input
                  label="Country"
                  value={formData.country}
                  onChange={(event) => setFormData({ ...formData, country: event.target.value })}
                />
              )}
              <Input
                label="PIN/ZIP Code"
                value={formData.pinCode}
                onChange={(event) => setFormData({ ...formData, pinCode: event.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">5</span>
              <p className="text-sm font-semibold text-neutral-900">Role and invitation</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
              <div className="flex w-[50%] items-end gap-2">
                <Select
                  label="Role"
                  options={effectiveRoleSelectOptions}
                  placeholder="Select role"
                  className="min-w-0 flex-1"
                  value={formData.role}
                  onChange={(event) => {
                    const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === event.target.value)
                    setFormData({
                      ...formData,
                      role: event.target.value,
                      role_id: selectedRole?.roleId || '',
                    })
                  }}
                />
                {roleChanged && (
                  <Button type="button" size="md" onClick={handleSaveRole} loading={isSavingRole}>
                    Save
                  </Button>
                )}
              </div>
              <label className="flex w-[50%] items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3.5 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  defaultChecked
                  className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                />
                Send a notification to the user for this new role.
              </label>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">6</span>
              <p className="text-sm font-semibold text-neutral-900">Employment details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {effectiveDesignationOptions.length > 0 ? (
                <Select
                  label="Designation"
                  options={effectiveDesignationOptions}
                  value={formData.designation}
                  onChange={(event) => setFormData({ ...formData, designation: event.target.value })}
                />
              ) : (
                <Input
                  label="Designation"
                  value={formData.designation}
                  onChange={(event) => setFormData({ ...formData, designation: event.target.value })}
                />
              )}
              <Select
                label="Employment Type"
                options={effectiveEmploymentTypeOptions}
                value={formData.employmentType}
                onChange={(event) => setFormData({ ...formData, employmentType: event.target.value })}
              />
              <Select
                label="Employee Status"
                options={effectiveEmployeeStatusOptions}
                value={formData.employeeStatus}
                onChange={(event) => setFormData({ ...formData, employeeStatus: event.target.value })}
              />
              <Input
                label="Reporting Manager ID"
                value={formData.reportingManager}
                onChange={(event) => setFormData({ ...formData, reportingManager: event.target.value })}
              />
              <Input
                label="Date of Joining"
                type="date"
                value={formData.dateOfJoining}
                onChange={(event) => setFormData({ ...formData, dateOfJoining: event.target.value })}
              />
              <Input
                label="Date of Exit"
                type="date"
                value={formData.dateOfExit}
                onChange={(event) => setFormData({ ...formData, dateOfExit: event.target.value })}
              />
              {effectiveWorkLocationOptions.length > 0 ? (
                <Select
                  label="Work Location"
                  options={effectiveWorkLocationOptions}
                  value={formData.workLocation}
                  onChange={(event) => setFormData({ ...formData, workLocation: event.target.value })}
                />
              ) : (
                <Input
                  label="Work Location"
                  value={formData.workLocation}
                  onChange={(event) => setFormData({ ...formData, workLocation: event.target.value })}
                />
              )}
              <Select
                label="Shift"
                options={effectiveShiftOptions}
                value={formData.shift}
                onChange={(event) => setFormData({ ...formData, shift: event.target.value })}
              />
              <div className="flex items-end gap-2">
                <Select
                  label="Account Status"
                  options={effectiveSystemStatusOptions}
                  className="min-w-0 flex-1"
                  value={formData.systemStatus}
                  onChange={(event) => setFormData({ ...formData, systemStatus: event.target.value })}
                />
                {accountStatusChanged && (
                  <Button type="button" size="md" onClick={handleSaveAccountStatus} loading={isSavingAccountStatus}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">7</span>
              <p className="text-sm font-semibold text-neutral-900">Payroll details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Basic Salary"
                type="number"
                step="0.01"
                value={formData.basicSalary}
                onChange={(event) => setFormData({ ...formData, basicSalary: event.target.value })}
              />
              <Input
                label="Bank Name"
                value={formData.bankName}
                onChange={(event) => setFormData({ ...formData, bankName: event.target.value })}
              />
              <Input
                label="Account Number"
                value={formData.accountNumber}
                onChange={(event) => setFormData({ ...formData, accountNumber: event.target.value })}
              />
              <Input
                label="IFSC/SWIFT Code"
                value={formData.ifscSwiftCode}
                onChange={(event) => setFormData({ ...formData, ifscSwiftCode: event.target.value })}
              />
              <Input
                label="Account Holder Name"
                value={formData.accountHolderName}
                onChange={(event) => setFormData({ ...formData, accountHolderName: event.target.value })}
              />
              <Input
                label="UPI ID"
                value={formData.upiId}
                onChange={(event) => setFormData({ ...formData, upiId: event.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => navigate(`/admin/users/${userId}`)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving} disabled={!userProfileChanged}>
          Update User
        </Button>
      </div>
    </form>
  )
}
