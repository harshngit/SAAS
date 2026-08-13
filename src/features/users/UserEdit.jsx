import { useEffect, useState } from 'react'
import {
  Banknote,
  BriefcaseBusiness,
  Camera,
  FileText,
  MapPin,
  Phone,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { roleLabels } from '../../auth/roles'
import {
  changeUserRole,
  getUser,
  listRoles,
  updateUser,
  updateUserStatus,
} from '../../api/users'
import { uploadFile, uploadFiles } from '../../api/files'
import { getSystemRoleFromRoleName, normalizeApiUser, staffRoleOptions } from './userRoleUtils'

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

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

const identityProofOptions = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'voter-id', label: 'Voter ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving-license', label: 'Driving License' },
]

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
]

const timeZoneOptions = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
]

// Mirrors the "Add New Staff" modal's tab structure exactly, so the two staff forms feel like one product.
const staffFormSections = [
  { number: '1', title: 'Basic Information', description: 'Employee identity and personal profile details.', icon: UserRound },
  { number: '2', title: 'Contact Information', description: 'Primary, secondary, and emergency contact details.', icon: Phone },
  { number: '3', title: 'Address Information', description: 'Residential and regional address details.', icon: MapPin },
  { number: '4', title: 'Employment Information', description: 'Role, reporting, joining, location, and employee status.', icon: BriefcaseBusiness },
  { number: '5', title: 'Login & Security', description: 'Authentication credentials and invitation settings.', icon: ShieldCheck },
  { number: '6', title: 'Payroll Information', description: 'Salary bank and payment details.', icon: Banknote },
  { number: '7', title: 'Uploads', description: 'Compliance, onboarding, and qualification documents.', icon: FileText },
  { number: '8', title: 'System Preferences', description: 'Application language, timezone, and account status.', icon: Settings },
]

// Maps a staged Uploads-tab field to the payload key buildSectionedUserBody expects, and (for
// single files) the section/field the "remove" action must null out.
const singleDocUploadTargets = [
  { key: 'identityDocuments', payloadKey: 'identityProofFileUrl' },
  { key: 'resumeCv', payloadKey: 'resumeCvUrl' },
  { key: 'offerLetter', payloadKey: 'offerLetterUrl' },
  { key: 'appointmentLetter', payloadKey: 'appointmentLetterUrl' },
]

const multiDocUploadTargets = [
  { key: 'experienceCertificates', payloadKey: 'experienceCertificateUrls', userKey: 'experienceCertificates' },
  { key: 'educationalCertificates', payloadKey: 'educationalCertificateUrls', userKey: 'educationalCertificates' },
]

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

function StaffField({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

function DocumentUploadRow({ label, description, accept, multiple = false, existingItems = [], stagedFiles = [], removed, onFilesSelected, onRemove }) {
  const stagedNames = stagedFiles.map((file) => file.name).join(', ')
  const hasExisting = existingItems.length > 0 && !removed
  const hasAny = stagedFiles.length > 0 || hasExisting

  return (
    <div className="flex min-h-24 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(10rem,1fr)_auto] sm:items-center">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold leading-5 text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
          {stagedNames && <p className="mt-1 truncate text-xs font-medium text-primary-700">{stagedNames}</p>}
          {hasExisting && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {existingItems.map((item, index) => (
                <a
                  key={item.url || item.id || index}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs font-medium text-primary-700 hover:underline"
                >
                  {item.name || `File ${index + 1}`}
                </a>
              ))}
            </div>
          )}
          {!stagedNames && !hasExisting && <p className="mt-1 text-xs text-neutral-400">No file uploaded</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
            <Upload className="size-3.5" aria-hidden="true" />
            Upload
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              className="sr-only"
              onChange={(event) => {
                onFilesSelected(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
          </label>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" disabled={!hasAny} onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function UserEdit() {
  const { user_id: userId } = useParams()
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [user, setUser] = useState(null)
  const [activeSection, setActiveSection] = useState('1')
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAccountStatus, setIsSavingAccountStatus] = useState(false)
  const [error, setError] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState(null)
  const [profilePictureRemoved, setProfilePictureRemoved] = useState(false)
  const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] = useState('')
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  const effectivePhotoUrl = profilePicturePreviewUrl || (!profilePictureRemoved ? user?.profilePhoto : '')
  const showPhotoPreview = Boolean(effectivePhotoUrl) && !photoLoadFailed

  const [singleDocFiles, setSingleDocFiles] = useState({ identityDocuments: null, resumeCv: null, offerLetter: null, appointmentLetter: null })
  const [singleDocRemoved, setSingleDocRemoved] = useState({ identityDocuments: false, resumeCv: false, offerLetter: false, appointmentLetter: false })
  const [multiDocFiles, setMultiDocFiles] = useState({ experienceCertificates: [], educationalCertificates: [] })

  const roleChanged = Boolean(user) && (
    formData.role_id
      ? formData.role_id !== (user.role_id || user.roleId || '')
      : formData.role !== (user.role || '')
  )
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
  const profilePictureChanged = Boolean(profilePictureFile) || profilePictureRemoved
  const documentsChanged =
    Object.values(singleDocFiles).some(Boolean) ||
    Object.values(singleDocRemoved).some(Boolean) ||
    Object.values(multiDocFiles).some((files) => files.length > 0)
  const userProfileChanged = basicInformationChanged || profilePictureChanged || roleChanged || documentsChanged

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

  // No dropdown data comes from the backend (GET /users/meta/employee-options was removed) -
  // these option lists are entirely local now.
  const effectiveRoleSelectOptions = apiRoleOptions.length > 0 ? apiRoleOptions : staffRoleSelectOptions
  const effectiveGenderOptions = genderOptions
  const effectiveMaritalStatusOptions = maritalStatusOptions
  const effectiveBloodGroupOptions = bloodGroupOptions
  const effectiveNationalityOptions = []
  const effectiveEmergencyRelationshipOptions = []
  const effectiveCountryOptions = []
  const effectiveStateOptions = []
  const effectiveEmploymentTypeOptions = employmentTypeOptions
  const effectiveEmployeeStatusOptions = employeeStatusOptions
  const effectiveWorkLocationOptions = []
  const effectiveShiftOptions = shiftOptions
  const effectiveIdentityProofOptions = identityProofOptions
  const effectiveSystemStatusOptions = systemStatusOptions

  const activeStaffFormSection = staffFormSections.find((section) => section.number === activeSection) || staffFormSections[0]

  useEffect(() => {
    return () => {
      if (profilePicturePreviewUrl) URL.revokeObjectURL(profilePicturePreviewUrl)
    }
  }, [profilePicturePreviewUrl])

  useEffect(() => {
    setPhotoLoadFailed(false)
  }, [effectivePhotoUrl])

  useEffect(() => {
    let isMounted = true

    async function loadEditData() {
      setIsLoading(true)
      setError('')

      const [userResult, rolesResult] = await Promise.all([
        getUser(userId),
        listRoles(),
      ])

      if (!isMounted) return

      setIsLoading(false)

      if (rolesResult.success) {
        setRoles(rolesResult.roles || [])
      }

      if (!userResult.success) {
        setError(userResult.error)
        return
      }

      const nextUser = normalizeApiUser(userResult.user)
      setUser(nextUser)
      setActiveSection('1')
      setProfilePictureFile(null)
      setProfilePictureRemoved(false)
      setProfilePicturePreviewUrl('')
      setSingleDocFiles({ identityDocuments: null, resumeCv: null, offerLetter: null, appointmentLetter: null })
      setSingleDocRemoved({ identityDocuments: false, resumeCv: false, offerLetter: false, appointmentLetter: false })
      setMultiDocFiles({ experienceCertificates: [], educationalCertificates: [] })
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
        profilePictureName: '',
      })
    }

    loadEditData()

    return () => {
      isMounted = false
    }
  }, [userId])

  const updateSingleDoc = (key, files) => {
    setSingleDocFiles((current) => ({ ...current, [key]: files[0] || null }))
    setSingleDocRemoved((current) => ({ ...current, [key]: false }))
  }

  const removeSingleDoc = (key) => {
    setSingleDocFiles((current) => ({ ...current, [key]: null }))
    setSingleDocRemoved((current) => ({ ...current, [key]: true }))
  }

  const updateMultiDoc = (key, files) => {
    setMultiDocFiles((current) => ({ ...current, [key]: [...current[key], ...files] }))
  }

  const removeMultiDoc = (key) => {
    setMultiDocFiles((current) => ({ ...current, [key]: [] }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!userProfileChanged) {
      return
    }

    setIsSaving(true)

    // Files are uploaded individually (POST /files/upload has no user_id), then every touched
    // field - basic info, role, files, docs - rides together in one PATCH /users/{id}.
    const filePayload = {}

    if (profilePictureRemoved) {
      filePayload.profilePhotoUrl = null
    } else if (profilePictureFile) {
      const uploadResult = await uploadFile(profilePictureFile)
      if (!uploadResult.success) {
        setIsSaving(false)
        setError(uploadResult.error)
        return
      }
      filePayload.profilePhotoUrl = uploadResult.file.url
    }

    for (const { key, payloadKey } of singleDocUploadTargets) {
      if (singleDocRemoved[key]) {
        filePayload[payloadKey] = null
      } else if (singleDocFiles[key]) {
        const uploadResult = await uploadFile(singleDocFiles[key])
        if (!uploadResult.success) {
          setIsSaving(false)
          setError(uploadResult.error)
          return
        }
        filePayload[payloadKey] = uploadResult.file.url
      }
    }

    for (const { key, payloadKey, userKey } of multiDocUploadTargets) {
      if (multiDocFiles[key].length > 0) {
        const uploadResult = await uploadFiles(multiDocFiles[key])
        if (!uploadResult.success) {
          setIsSaving(false)
          setError(uploadResult.error)
          return
        }
        const existingUrls = (user?.[userKey] || []).map((document) => document.url).filter(Boolean)
        const newUrls = uploadResult.files.map((file) => file.url).filter(Boolean)
        filePayload[payloadKey] = [...existingUrls, ...newUrls]
      }
    }

    const updateResult = await updateUser(userId, { ...formData, ...filePayload })

    if (!updateResult.success) {
      setIsSaving(false)
      setError(updateResult.error)
      return
    }

    if (roleChanged) {
      const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === formData.role)
      const rolePayload = {
        role_id: formData.role_id || selectedRole?.roleId || '',
        role: selectedRole?.label || formData.role,
      }

      if (!rolePayload.role_id && !rolePayload.role) {
        setIsSaving(false)
        setError('Select a role before saving.')
        return
      }

      const roleResult = await changeUserRole(userId, rolePayload)

      if (!roleResult.success) {
        setIsSaving(false)
        setError(roleResult.error)
        return
      }
    }

    setIsSaving(false)
    navigate('/admin/users')
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
    setProfilePicturePreviewUrl('')
    setProfilePictureRemoved(Boolean(user?.profilePhoto))
    setFormData((currentFormData) => ({ ...currentFormData, profilePictureName: '' }))
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
      className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
    >
      <div className="grid flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-neutral-100 p-6 lg:border-b-0 lg:border-r">
          <nav className="space-y-2">
            {staffFormSections.map((section) => {
              const Icon = section.icon
              const isActive = section.number === activeSection
              return (
                <button
                  key={section.number}
                  type="button"
                  onClick={() => setActiveSection(section.number)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-all ${
                    isActive
                      ? 'border border-neutral-100 bg-neutral-50 text-primary-700 shadow-(--shadow-xs)'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-primary-700'
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.title}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 p-6">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{activeStaffFormSection.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeStaffFormSection.description}</p>
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

          <div className="mt-6 space-y-5">
            {activeSection === '1' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Profile Photo</label>
                  <div className="mt-1.5 flex items-center gap-4">
                    <label
                      className={`group relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border text-center transition-all ${
                        showPhotoPreview
                          ? 'border-primary-100 bg-neutral-900'
                          : 'border-dashed border-primary-200 bg-neutral-50 text-primary-700 hover:border-primary-300 hover:bg-primary-50/70'
                      }`}
                    >
                      {showPhotoPreview ? (
                        <>
                          <img
                            src={effectivePhotoUrl}
                            alt="Profile"
                            className="absolute inset-0 size-full object-cover"
                            onError={() => setPhotoLoadFailed(true)}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 opacity-0 transition-all group-hover:bg-neutral-900/60 group-hover:opacity-100">
                            <Camera className="size-6 text-white" aria-hidden="true" />
                          </div>
                        </>
                      ) : (
                        <Camera className="size-6" aria-hidden="true" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          setProfilePictureFile(file || null)
                          setProfilePictureRemoved(false)
                          setProfilePicturePreviewUrl(file ? URL.createObjectURL(file) : '')
                          setFormData({ ...formData, profilePictureName: file?.name || '' })
                        }}
                      />
                    </label>
                    <div>
                      <p className="text-xs text-neutral-500">PNG or JPG. Employee profile picture.</p>
                      {formData.profilePictureName && (
                        <p className="mt-1 truncate text-xs font-medium text-primary-700">{formData.profilePictureName}</p>
                      )}
                      {effectivePhotoUrl && (
                        <Button type="button" variant="ghost" size="sm" className="mt-1.5 -ml-3" onClick={handleRemoveProfilePhoto}>
                          <X className="size-4" aria-hidden="true" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Input
                  label="Employee ID"
                  value={formData.employeeId || 'System calculated'}
                  readOnly
                  disabled
                />
                <div />
                <Input
                  label="First Name"
                  required
                  value={formData.firstName}
                  onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
                />
                <Input
                  label="Last Name"
                  required
                  value={formData.lastName}
                  onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
                />
                <Input
                  label="Display Name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
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
              </div>
            )}

            {activeSection === '2' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Input
                  label="Mobile Number"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                />
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
                  label="Official Email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
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
            )}

            {activeSection === '3' && (
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
            )}

            {activeSection === '4' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Select
                  label="Role"
                  required
                  options={effectiveRoleSelectOptions}
                  placeholder="Select role"
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
                <Input
                  label="Designation"
                  required
                  value={formData.designation}
                  onChange={(event) => setFormData({ ...formData, designation: event.target.value })}
                />
                <Input
                  label="Reporting Manager ID"
                  value={formData.reportingManager}
                  onChange={(event) => setFormData({ ...formData, reportingManager: event.target.value })}
                />
                <Select
                  label="Employment Type"
                  required
                  options={effectiveEmploymentTypeOptions}
                  value={formData.employmentType}
                  onChange={(event) => setFormData({ ...formData, employmentType: event.target.value })}
                />
                <Input
                  label="Date of Joining"
                  type="date"
                  required
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
                <Select
                  label="Employee Status"
                  required
                  options={effectiveEmployeeStatusOptions}
                  value={formData.employeeStatus}
                  onChange={(event) => setFormData({ ...formData, employeeStatus: event.target.value })}
                />
              </div>
            )}

            {activeSection === '5' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Input
                  label="Username"
                  required
                  value={formData.username}
                  onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                />
                <div className="flex items-end">
                  <p className="text-xs text-neutral-400">
                    To change this employee's password, use "Reset Password" from the Staff list instead.
                  </p>
                </div>
              </div>
            )}

            {activeSection === '6' && (
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
            )}

            {activeSection === '7' && (
              <div className="space-y-4">
                <Select
                  label="Identity Proof Type"
                  options={effectiveIdentityProofOptions}
                  value={formData.identityProofType}
                  onChange={(event) => setFormData({ ...formData, identityProofType: event.target.value })}
                />
                <DocumentUploadRow
                  label="Identity Proof Document"
                  description="Aadhaar, PAN, Passport, or similar."
                  accept="application/pdf,image/*"
                  existingItems={user?.identityProofFile ? [{ name: 'Identity proof', url: user.identityProofFile }] : []}
                  stagedFiles={singleDocFiles.identityDocuments ? [singleDocFiles.identityDocuments] : []}
                  removed={singleDocRemoved.identityDocuments}
                  onFilesSelected={(files) => updateSingleDoc('identityDocuments', files)}
                  onRemove={() => removeSingleDoc('identityDocuments')}
                />
                <DocumentUploadRow
                  label="Resume/CV"
                  description="Employee resume."
                  accept="application/pdf,.doc,.docx"
                  existingItems={user?.resumeCv ? [{ name: 'Resume/CV', url: user.resumeCv }] : []}
                  stagedFiles={singleDocFiles.resumeCv ? [singleDocFiles.resumeCv] : []}
                  removed={singleDocRemoved.resumeCv}
                  onFilesSelected={(files) => updateSingleDoc('resumeCv', files)}
                  onRemove={() => removeSingleDoc('resumeCv')}
                />
                <DocumentUploadRow
                  label="Offer Letter"
                  description="Employment offer letter."
                  accept="application/pdf"
                  existingItems={user?.offerLetter ? [{ name: 'Offer letter', url: user.offerLetter }] : []}
                  stagedFiles={singleDocFiles.offerLetter ? [singleDocFiles.offerLetter] : []}
                  removed={singleDocRemoved.offerLetter}
                  onFilesSelected={(files) => updateSingleDoc('offerLetter', files)}
                  onRemove={() => removeSingleDoc('offerLetter')}
                />
                <DocumentUploadRow
                  label="Appointment Letter"
                  description="Appointment letter."
                  accept="application/pdf"
                  existingItems={user?.appointmentLetter ? [{ name: 'Appointment letter', url: user.appointmentLetter }] : []}
                  stagedFiles={singleDocFiles.appointmentLetter ? [singleDocFiles.appointmentLetter] : []}
                  removed={singleDocRemoved.appointmentLetter}
                  onFilesSelected={(files) => updateSingleDoc('appointmentLetter', files)}
                  onRemove={() => removeSingleDoc('appointmentLetter')}
                />
                <DocumentUploadRow
                  label="Experience Certificates"
                  description="Previous employment certificates."
                  accept="application/pdf,.doc,.docx,image/*"
                  multiple
                  existingItems={user?.experienceCertificates || []}
                  stagedFiles={multiDocFiles.experienceCertificates}
                  onFilesSelected={(files) => updateMultiDoc('experienceCertificates', files)}
                  onRemove={() => removeMultiDoc('experienceCertificates')}
                />
                <DocumentUploadRow
                  label="Educational Certificates"
                  description="Academic certificates."
                  accept="application/pdf,.doc,.docx,image/*"
                  multiple
                  existingItems={user?.educationalCertificates || []}
                  stagedFiles={multiDocFiles.educationalCertificates}
                  onFilesSelected={(files) => updateMultiDoc('educationalCertificates', files)}
                  onRemove={() => removeMultiDoc('educationalCertificates')}
                />
                <StaffField className="lg:col-span-2">
                  <Input
                    label="Skills"
                    placeholder="Separate skills with commas"
                    value={formData.skills}
                    onChange={(event) => setFormData({ ...formData, skills: event.target.value })}
                  />
                </StaffField>
              </div>
            )}

            {activeSection === '8' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Select
                  label="Language"
                  options={languageOptions}
                  value={formData.language}
                  onChange={(event) => setFormData({ ...formData, language: event.target.value })}
                />
                <Select
                  label="Time Zone"
                  options={timeZoneOptions}
                  value={formData.timeZone}
                  onChange={(event) => setFormData({ ...formData, timeZone: event.target.value })}
                />
                <div className="flex items-end gap-2">
                  <Select
                    label="Account Status"
                    required
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
            )}
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
        </div>
      </div>
    </form>
  )
}
