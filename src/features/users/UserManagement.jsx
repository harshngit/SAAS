import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Edit,
  FileText,
  KeyRound,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import { ROLES, roleLabels } from '../../auth/roles'
import { RequirePermission } from '../../auth/RequirePermission'
import { useAuthStore } from '../../store/authStore'
import { uploadFiles as uploadGenericFiles } from '../../api/files'
import { createUser, listRoles, listUsers, permanentlyDeleteUser, updateUserStatus } from '../../api/users'
import { getSystemRoleFromRoleName, normalizeApiUser, staffRoleOptions } from './userRoleUtils'
import ResetPasswordModal from './ResetPasswordModal'

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

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

const countryOptions = [
  { value: 'india', label: 'India' },
  { value: 'usa', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'uae', label: 'United Arab Emirates' },
]

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

const shiftOptions = [
  { value: 'general', label: 'General' },
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

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

const systemStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'locked', label: 'Locked' },
]

const pageSizeOptions = [10, 25, 50].map((value) => ({ value: String(value), label: `${value} / page` }))

// Purely a UI preview so the field never looks blank/confusing while filling the form - the
// backend is free to assign its own employee_id if the admin leaves this untouched.
const makeEmployeeId = () => `EMP-${new Date().getFullYear()}-AUTO`

const initialStaffFormData = {
  employeeId: '',
  firstName: '',
  lastName: '',
  name: '',
  gender: '',
  dateOfBirth: '',
  maritalStatus: '',
  bloodGroup: '',
  nationality: '',
  profilePictureName: '',
  mobileNumber: '',
  alternateMobileNumber: '',
  personalEmail: '',
  email: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
  emergencyContactRelationship: '',
  currentAddress: '',
  permanentAddress: '',
  city: '',
  state: '',
  country: '',
  pinCode: '',
  role: ROLES.SALES_OFFICER,
  role_id: '',
  designation: '',
  reportingManager: '',
  employmentType: '',
  dateOfJoining: '',
  dateOfExit: '',
  workLocation: '',
  shift: '',
  employeeStatus: 'active',
  username: '',
  password: '',
  confirmPassword: '',
  basicSalary: '',
  bankName: '',
  accountNumber: '',
  ifscSwiftCode: '',
  accountHolderName: '',
  upiId: '',
  identityProofType: '',
  identityDocumentsName: '',
  resumeCvName: '',
  offerLetterName: '',
  appointmentLetterName: '',
  experienceCertificatesName: '',
  educationalCertificatesName: '',
  skills: '',
  language: '',
  timeZone: '',
  systemStatus: 'active',
  sendNotification: true,
}

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

const staffRequiredFieldsBySection = {
  1: [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
  ],
  2: [
    { key: 'mobileNumber', label: 'Mobile Number' },
    { key: 'email', label: 'Official Email' },
  ],
  4: [
    { key: 'role', label: 'Role' },
    { key: 'designation', label: 'Designation' },
    { key: 'employmentType', label: 'Employment Type' },
    { key: 'dateOfJoining', label: 'Date of Joining' },
    { key: 'employeeStatus', label: 'Employee Status' },
  ],
  5: [
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password' },
    { key: 'confirmPassword', label: 'Confirm Password' },
  ],
  7: [
    { key: 'identityProofType', label: 'Identity Proof Type' },
    { key: 'identityDocumentsName', label: 'Identity Proof File' },
  ],
  8: [
    { key: 'systemStatus', label: 'Status' },
  ],
}

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function StaffAvatar({ name, photoUrl, size = 'size-9', textSize = 'text-xs' }) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [photoUrl])

  if (photoUrl && !imageFailed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${size} shrink-0 rounded-full object-cover ring-1 ring-primary-100`}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary-50 ${textSize} font-semibold text-primary-700 ring-1 ring-primary-100`}>
      {getInitials(name)}
    </div>
  )
}

function StaffSection({ number, title, description, children }) {
  void title
  void description

  return (
    <section id={`staff-section-${number}`} className="scroll-mt-6 border-b border-neutral-100 py-5 first:pt-0 last:border-b-0">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>
    </section>
  )
}

function StaffField({ description, format, required, children, className = '' }) {
  void description
  void format
  void required

  return (
    <div className={className}>
      {children}
    </div>
  )
}

const createUploadPreview = (file) => ({
  name: file.name,
  type: file.type,
  url: URL.createObjectURL(file),
})

const revokeUploadPreviewUrls = (previews = []) => {
  previews.forEach((preview) => URL.revokeObjectURL(preview.url))
}

function UploadPreview({ previews = [] }) {
  if (!previews.length) {
    return (
      <div className="flex h-16 min-w-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-400">
        Preview
      </div>
    )
  }

  const visiblePreviews = previews.slice(0, 2)
  const remainingCount = previews.length - visiblePreviews.length

  return (
    <div className="flex min-w-0 items-center gap-2">
      {visiblePreviews.map((preview) => {
        const isImage = preview.type.startsWith('image/')
        const isPdf = preview.type === 'application/pdf'

        return (
          <a
            key={`${preview.name}-${preview.url}`}
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            title={`Preview ${preview.name}`}
              className="group relative flex size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            {isImage ? (
              <img src={preview.url} alt={preview.name} className="size-full object-cover" />
            ) : isPdf ? (
              <iframe src={preview.url} title={preview.name} className="size-full pointer-events-none border-0 bg-white" />
            ) : (
              <span className="flex size-full items-center justify-center text-neutral-500">
                <FileText className="size-5" aria-hidden="true" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {preview.name}
            </span>
          </a>
        )
      })}
      {remainingCount > 0 && (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-500">
          +{remainingCount}
        </span>
      )}
    </div>
  )
}

function StaffUploadField({
  label,
  name,
  value,
  previews,
  required = false,
  accept,
  multiple = false,
  uploading = false,
  onChange,
  onRemove,
}) {
  return (
    <div className="flex min-h-28 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(10rem,1fr)_auto_auto] xl:items-center">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold leading-5 text-neutral-900">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </p>
          {value && <p className="mt-1 truncate text-xs font-medium text-primary-700">{value}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-center">
          <UploadPreview previews={previews} />
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <label className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700 ${
            uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
          }`}>
            <Upload className="size-3.5" aria-hidden="true" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const files = Array.from(event.target.files || [])
                onChange(name, files)
                event.target.value = ''
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={!value || uploading}
            onClick={() => onRemove(name)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

function IdentityProofUploadField({
  proofValue,
  fileValue,
  previews,
  options,
  onProofChange,
  onFileChange,
  onRemove,
  uploading = false,
}) {
  return (
    <div className="flex min-h-28 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(10rem,1fr)_auto_auto] xl:items-center">
        <Select
          label="Identity Proofs"
          name="identityProofType"
          options={options}
          value={proofValue}
          onChange={onProofChange}
          required
        />
        <div className="flex shrink-0 items-center justify-center">
          <UploadPreview previews={previews} />
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <label className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700 ${
            uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
          }`}>
            <Upload className="size-3.5" aria-hidden="true" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const files = Array.from(event.target.files || [])
                onFileChange('identityDocumentsName', files)
                event.target.value = ''
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={!fileValue || uploading}
            onClick={() => onRemove('identityDocumentsName')}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
          {fileValue && <p className="max-w-80 truncate text-xs font-medium text-primary-700">{fileValue}</p>}
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [activeRoleFilter, setActiveRoleFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [listError, setListError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusUser, setStatusUser] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null)
  const [permanentDeleteError, setPermanentDeleteError] = useState('')
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [formData, setFormData] = useState(initialStaffFormData)
  const [uploadPreviews, setUploadPreviews] = useState({})
  const [uploadedFileUrls, setUploadedFileUrls] = useState({})
  const [uploadingField, setUploadingField] = useState('')
  const uploadPreviewsRef = useRef({})
  const staffRequestIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const [activeStaffSection, setActiveStaffSection] = useState('1')

  const apiRoleOptions = roles.map((role) => {
    const systemRole = getSystemRoleFromRoleName(role.name)
    return {
      value: systemRole,
      label: role.name,
      roleId: role.id,
    }
  })

  // No dropdown data comes from the backend (GET /users/meta/employee-options was removed) -
  // these option lists are entirely local now.
  const effectiveRoleSelectOptions = apiRoleOptions.length > 0 ? apiRoleOptions : staffRoleSelectOptions
  const effectiveGenderOptions = genderOptions
  const effectiveMaritalStatusOptions = maritalStatusOptions
  const effectiveBloodGroupOptions = bloodGroupOptions
  const effectiveCountryOptions = countryOptions
  const effectiveNationalityOptions = effectiveCountryOptions
  const effectiveEmploymentTypeOptions = employmentTypeOptions
  const effectiveEmployeeStatusOptions = employeeStatusOptions
  const effectiveShiftOptions = shiftOptions
  const effectiveIdentityProofOptions = identityProofOptions
  const effectiveSystemStatusOptions = systemStatusOptions
  const effectiveEmergencyRelationshipOptions = []
  const effectiveStateOptions = []
  const effectiveWorkLocationOptions = []
  const effectiveFilterTabs = [
    { value: 'all', label: 'All' },
    ...effectiveRoleSelectOptions.map((role) => ({ value: role.value, label: role.label })),
  ]
  const refreshUsers = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = staffRequestIdRef.current + 1
    staffRequestIdRef.current = requestId

    if (showLoading) {
      setIsLoadingUsers(true)
    }
    setListError('')

    const selectedRole = activeRoleFilter === 'all'
      ? null
      : roles.find((role) => getSystemRoleFromRoleName(role.name) === activeRoleFilter)
    const usersResult = await listUsers({
      role_id: selectedRole?.id,
      search: searchTerm.trim(),
    })

    if (!isMountedRef.current || requestId !== staffRequestIdRef.current) {
      return usersResult
    }

    setIsLoadingUsers(false)

    if (!usersResult.success) {
      setListError(usersResult.error)
      return usersResult
    }

    setUsers((usersResult.users || []).map(normalizeApiUser))
    return usersResult
  }, [activeRoleFilter, roles, searchTerm])

  const handleOpenModal = () => {
    setFormError('')
    setActiveStaffSection('1')
    setUploadPreviews((current) => {
      Object.values(current).forEach(revokeUploadPreviewUrls)
      uploadPreviewsRef.current = {}
      return {}
    })
    setUploadedFileUrls({})
    setUploadingField('')
    setFormData(
      {
        ...initialStaffFormData,
        employeeId: makeEmployeeId(),
        role: ROLES.SALES_OFFICER,
        role_id: effectiveRoleSelectOptions.find((role) => role.value === ROLES.SALES_OFFICER)?.roleId || '',
      },
    )
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormError('')
    setUploadPreviews((current) => {
      Object.values(current).forEach(revokeUploadPreviewUrls)
      uploadPreviewsRef.current = {}
      return {}
    })
    setUploadedFileUrls({})
    setUploadingField('')
  }

  const handleFormChange = (event) => {
    const { name, type, checked, value } = event.target
    setFormError('')
    setFormData((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleUploadChange = async (name, files) => {
    const selectedFiles = Array.from(files || [])
    const fileNames = selectedFiles.map((file) => file.name).join(', ')

    setFormError('')
    setUploadPreviews((current) => {
      revokeUploadPreviewUrls(current[name])
      const nextPreviews = {
        ...current,
        [name]: selectedFiles.map(createUploadPreview),
      }
      uploadPreviewsRef.current = nextPreviews
      return nextPreviews
    })
    setFormData((current) => ({ ...current, [name]: fileNames }))

    if (selectedFiles.length === 0) {
      setUploadedFileUrls((current) => {
        const { [name]: removed, ...remaining } = current
        void removed
        return remaining
      })
      return
    }

    setUploadingField(name)

    try {
      const result = await uploadGenericFiles(selectedFiles)

      if (!result.success) {
        setFormError(`${fileNames || 'File'} could not be uploaded: ${result.error}`)
        setUploadedFileUrls((current) => {
          const { [name]: removed, ...remaining } = current
          void removed
          return remaining
        })
        setFormData((current) => ({ ...current, [name]: '' }))
        return
      }

      const urls = result.files.map((file) => file.url).filter(Boolean)
      setUploadPreviews((current) => {
        revokeUploadPreviewUrls(current[name])
        const nextPreviews = {
          ...current,
          [name]: result.files.map((file, index) => ({
            name: file.name || selectedFiles[index]?.name || 'Uploaded file',
            type: file.content_type || selectedFiles[index]?.type || '',
            url: file.url,
          })),
        }
        uploadPreviewsRef.current = nextPreviews
        return nextPreviews
      })
      setUploadedFileUrls((current) => ({
        ...current,
        [name]: selectedFiles.length > 1 ? urls : urls[0] || '',
      }))
    } catch {
      // Guards against the "stuck on Uploading..." state forever if anything in this chain
      // throws unexpectedly instead of resolving to {success:false} - the button must always
      // recover, even on an error path we didn't anticipate.
      setFormError(`${fileNames || 'File'} could not be uploaded. Please try again.`)
      setUploadedFileUrls((current) => {
        const { [name]: removed, ...remaining } = current
        void removed
        return remaining
      })
      setFormData((current) => ({ ...current, [name]: '' }))
    } finally {
      setUploadingField('')
    }
  }

  const handleUploadRemove = (name) => {
    setFormError('')
    setUploadPreviews((current) => {
      revokeUploadPreviewUrls(current[name])
      const { [name]: removed, ...remaining } = current
      void removed
      uploadPreviewsRef.current = remaining
      return remaining
    })
    setUploadedFileUrls((current) => {
      const { [name]: removed, ...remaining } = current
      void removed
      return remaining
    })
    setFormData((current) => ({ ...current, [name]: '' }))
  }

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      Object.values(uploadPreviewsRef.current).forEach(revokeUploadPreviewUrls)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      await refreshUsers()
    }, searchTerm.trim() ? 300 : 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refreshUsers, searchTerm])

  useEffect(() => {
    const handleWindowFocus = () => {
      refreshUsers({ showLoading: false })
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [refreshUsers])

  useEffect(() => {
    let isMounted = true

    async function loadStaffRoles() {
      const rolesResult = await listRoles()

      if (!isMounted) return

      if (rolesResult.success) {
        setRoles(rolesResult.roles || [])
      }
    }

    loadStaffRoles()

    return () => {
      isMounted = false
    }
  }, [])

  const validateStaffSections = (sectionNumbers) => {
    const sectionsToValidate = sectionNumbers.map(String)

    for (const sectionNumber of sectionsToValidate) {
      const missingRequiredFields = (staffRequiredFieldsBySection[sectionNumber] || [])
        .filter((field) => !String(formData[field.key] || '').trim())
        .map((field) => field.label)

      if (missingRequiredFields.length > 0) {
        setActiveStaffSection(sectionNumber)
        setFormError(`Please complete required fields: ${missingRequiredFields.join(', ')}.`)
        return false
      }

      if (sectionNumber === '5') {
        if (formData.password.length > 0 && formData.password.length < 8) {
          setActiveStaffSection(sectionNumber)
          setFormError('Password must be at least 8 characters.')
          return false
        }

        if (formData.password !== formData.confirmPassword) {
          setActiveStaffSection(sectionNumber)
          setFormError('Password and confirm password must match.')
          return false
        }
      }
    }

    setFormError('')
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (uploadingField) {
      setFormError('Please wait for the file upload to finish before saving.')
      return
    }

    if (!validateStaffSections(staffFormSections.map((section) => section.number))) {
      return
    }

    const displayName = formData.name.trim() || `${formData.firstName} ${formData.lastName}`.trim()
    const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === formData.role)
    const payload = {
      ...formData,
      ...Object.fromEntries(
        Object.entries(uploadedFileUrls).filter(([, value]) => (
          value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
        )),
      ),
      // The auto-generated "EMP-YYYY-AUTO" is only a UI placeholder - never submit it as a real id.
      employeeId: formData.employeeId === makeEmployeeId() ? '' : formData.employeeId,
      name: displayName,
      email: formData.email,
      phone: formData.mobileNumber,
      role_id: formData.role_id || selectedRole?.roleId || '',
      role: selectedRole?.label || formData.role,
    }

    setIsSaving(true)
    const result = await createUser(payload)

    if (!result.success) {
      setIsSaving(false)
      setFormError(result.error)
      return
    }

    setIsSaving(false)

    await refreshUsers({ showLoading: false })
    handleCloseModal()
  }

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget || permanentDeleteTarget.id === currentUser?.id) return

    setIsDeletingUser(true)
    setPermanentDeleteError('')

    const result = await permanentlyDeleteUser(permanentDeleteTarget.id)

    setIsDeletingUser(false)

    if (!result.success) {
      setPermanentDeleteError(result.error)
      return
    }

    await refreshUsers({ showLoading: false })
    setPermanentDeleteTarget(null)
    showToast({
      title: 'User permanently deleted',
      message: `${permanentDeleteTarget.name || 'User'} removed from the database.`,
    })
  }

  const handleOpenStatusModal = (user) => {
    setStatusUser(user)
    setStatusError('')
  }

  const handleCloseStatusModal = () => {
    if (isUpdatingStatus) return
    setStatusUser(null)
    setStatusError('')
  }

  const handleChangeStatus = async () => {
    if (!statusUser) return

    const nextIsActive = !statusUser.isActive
    setIsUpdatingStatus(true)
    setStatusError('')

    const result = await updateUserStatus(statusUser.id, nextIsActive)
    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    await refreshUsers({ showLoading: false })
    setStatusUser(null)
  }

  const filteredUsers = users.filter((user) => {
    const matchesRole = activeRoleFilter === 'all' || user.role === activeRoleFilter
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      [user.name, user.email, user.phone, roleLabels[user.role], user.isActive ? 'active' : 'inactive']
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))

    return matchesRole && matchesSearch
  })
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / Number(pageSize)))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedUsers = filteredUsers.slice((safeCurrentPage - 1) * Number(pageSize), safeCurrentPage * Number(pageSize))
  const rangeStart = filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredUsers.length, safeCurrentPage * Number(pageSize))
  const paginationPages = (() => {
    const pages = new Set([
      1,
      totalPages,
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
    ])

    return Array.from(pages)
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
      .sort((a, b) => a - b)
  })()

  useEffect(() => {
    setCurrentPage(1)
  }, [activeRoleFilter, searchTerm, pageSize])

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])
  const activeStaffFormSection = staffFormSections.find((section) => section.number === activeStaffSection) || staffFormSections[0]
  const activeStaffSectionIndex = staffFormSections.findIndex((section) => section.number === activeStaffSection)
  const isFirstStaffSection = activeStaffSectionIndex <= 0
  const isLastStaffSection = activeStaffSectionIndex === staffFormSections.length - 1

  const goToPreviousStaffSection = () => {
    if (isFirstStaffSection) return
    setFormError('')
    setActiveStaffSection(staffFormSections[activeStaffSectionIndex - 1].number)
  }

  const goToNextStaffSection = () => {
    if (isLastStaffSection) return
    setFormError('')
    setActiveStaffSection(staffFormSections[activeStaffSectionIndex + 1].number)
  }

  const goToStaffSection = (sectionNumber) => {
    setFormError('')
    setActiveStaffSection(sectionNumber)
  }

  if (isModalOpen) {
    return (
      <div>
        <div>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
          >
            <div className="grid flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="border-b border-neutral-100 p-6 lg:border-b-0 lg:border-r">
                <nav className="space-y-2">
                  {staffFormSections.map((section) => {
                    const Icon = section.icon
                    const isActive = section.number === activeStaffSection
                    return (
                      <button
                        key={section.number}
                        type="button"
                        onClick={() => goToStaffSection(section.number)}
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
                    onClick={handleCloseModal}
                  >
                    Back to Staff
                  </Button>
                </div>

                <div className="mt-6 space-y-5">
              {activeStaffSection === '1' && (
              <StaffSection number="1" title="Basic Information" description="Employee identity and personal profile details.">
                <StaffUploadField
                  label="Profile Photo"
                  name="profilePictureName"
                  value={formData.profilePictureName}
                  previews={uploadPreviews.profilePictureName}
                  description="Employee profile picture."
                  format="Image upload"
                  accept="image/png,image/jpeg,image/jpg"
                  uploading={uploadingField === 'profilePictureName'}
                  onChange={handleUploadChange}
                  onRemove={handleUploadRemove}
                />
                <div className="hidden lg:block" aria-hidden="true" />
                <StaffField description="Unique employee identifier. Auto-generated." format="Text (Auto Number)" required={false}>
                  <Input label="Employee ID" value={formData.employeeId || 'System calculated'} readOnly disabled />
                </StaffField>
                <div className="hidden lg:block" aria-hidden="true" />
                <StaffField description="Employee's first name." format="Text, max 50 characters" required>
                  <Input label="First Name" name="firstName" maxLength={50} value={formData.firstName} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Employee's surname." format="Text, max 50 characters" required>
                  <Input label="Last Name" name="lastName" maxLength={50} value={formData.lastName} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Name displayed in the application." format="Text" required={false}>
                  <Input label="Display Name" name="name" value={formData.name} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Gender of the employee." format="Dropdown" required={false}>
                  <Select label="Gender" name="gender" options={effectiveGenderOptions} value={formData.gender} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Employee's birth date." format="Date picker" required={false}>
                  <Input label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Employee's marital status." format="Dropdown" required={false}>
                  <Select label="Marital Status" name="maritalStatus" options={effectiveMaritalStatusOptions} value={formData.maritalStatus} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Blood group for emergency purposes." format="Dropdown" required={false}>
                  <Select label="Blood Group" name="bloodGroup" options={effectiveBloodGroupOptions} value={formData.bloodGroup} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Employee nationality." format="Dropdown" required={false}>
                  <Select label="Nationality" name="nationality" options={effectiveNationalityOptions} value={formData.nationality} onChange={handleFormChange} />
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '2' && (
              <StaffSection number="2" title="Contact Information" description="Primary, secondary, and emergency contact details.">
                <StaffField description="Primary contact number." format="Phone number" required>
                  <Input label="Mobile Number" name="mobileNumber" type="tel" value={formData.mobileNumber} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Secondary contact number." format="Phone number" required={false}>
                  <Input label="Alternate Mobile Number" name="alternateMobileNumber" type="tel" value={formData.alternateMobileNumber} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Personal email address." format="Email" required={false}>
                  <Input label="Personal Email" name="personalEmail" type="email" value={formData.personalEmail} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Company email address." format="Email" required>
                  <Input label="Official Email" name="email" type="email" value={formData.email} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Emergency contact person." format="Text" required={false}>
                  <Input label="Emergency Contact Name" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Emergency contact phone number." format="Phone number" required={false}>
                  <Input label="Emergency Contact Number" name="emergencyContactNumber" type="tel" value={formData.emergencyContactNumber} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Relationship with employee." format="Dropdown or text" required={false}>
                  {effectiveEmergencyRelationshipOptions.length > 0 ? (
                    <Select
                      label="Emergency Contact Relationship"
                      name="emergencyContactRelationship"
                      options={effectiveEmergencyRelationshipOptions}
                      value={formData.emergencyContactRelationship}
                      onChange={handleFormChange}
                    />
                  ) : (
                    <Input label="Emergency Contact Relationship" name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleFormChange} />
                  )}
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '3' && (
              <StaffSection number="3" title="Address Information" description="Residential and regional address details.">
                <StaffField description="Current residential address." format="Multi-line text" required={false}>
                  <Input label="Current Address" name="currentAddress" as="textarea" value={formData.currentAddress} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Permanent address." format="Multi-line text" required={false}>
                  <Input label="Permanent Address" name="permanentAddress" as="textarea" value={formData.permanentAddress} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="City." format="Text" required={false}>
                  <Input label="City" name="city" value={formData.city} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="State or province." format="Text or dropdown" required={false}>
                  {effectiveStateOptions.length > 0 ? (
                    <Select label="State" name="state" options={effectiveStateOptions} value={formData.state} onChange={handleFormChange} />
                  ) : (
                    <Input label="State" name="state" value={formData.state} onChange={handleFormChange} />
                  )}
                </StaffField>
                <StaffField description="Country." format="Dropdown" required={false}>
                  <Select label="Country" name="country" options={effectiveCountryOptions} value={formData.country} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Postal code." format="Text" required={false}>
                  <Input label="PIN/ZIP Code" name="pinCode" value={formData.pinCode} onChange={handleFormChange} />
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '4' && (
              <StaffSection number="4" title="Employment Information" description="Role, reporting, joining, location, and employee status.">
                <StaffField description="Application access role." format="Dropdown" required>
                  <Select
                    label="Role"
                    name="role"
                    options={effectiveRoleSelectOptions}
                    value={formData.role}
                    onChange={(e) => {
                      const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === e.target.value)
                      setFormData((current) => ({
                        ...current,
                        role: e.target.value,
                        role_id: selectedRole?.roleId || '',
                      }))
                    }}
                    required
                  />
                </StaffField>
                <StaffField description="Job title or designation." format="Text" required>
                  <Input label="Designation" name="designation" value={formData.designation} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Employee's manager." format="Searchable dropdown" required={false}>
                  <Select
                    label="Reporting Manager"
                    name="reportingManager"
                    options={users.map((user) => ({ value: String(user.id), label: user.name }))}
                    value={formData.reportingManager}
                    onChange={handleFormChange}
                  />
                </StaffField>
                <StaffField description="Full-time, part-time, contract, intern, etc." format="Dropdown" required>
                  <Select label="Employment Type" name="employmentType" options={effectiveEmploymentTypeOptions} value={formData.employmentType} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Employment start date." format="Date picker" required>
                  <Input label="Date of Joining" name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Last working day." format="Date picker" required={false}>
                  <Input label="Date of Exit" name="dateOfExit" type="date" value={formData.dateOfExit} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Office or branch location." format="Dropdown" required={false}>
                  {effectiveWorkLocationOptions.length > 0 ? (
                    <Select label="Work Location" name="workLocation" options={effectiveWorkLocationOptions} value={formData.workLocation} onChange={handleFormChange} />
                  ) : (
                    <Input label="Work Location" name="workLocation" value={formData.workLocation} onChange={handleFormChange} />
                  )}
                </StaffField>
                <StaffField description="Assigned work shift." format="Dropdown" required={false}>
                  <Select label="Shift" name="shift" options={effectiveShiftOptions} value={formData.shift} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Current employment state." format="Dropdown" required>
                  <Select label="Employee Status" name="employeeStatus" options={effectiveEmployeeStatusOptions} value={formData.employeeStatus} onChange={handleFormChange} required />
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '5' && (
              <StaffSection number="5" title="Login & Security" description="Authentication credentials and invitation settings.">
                <StaffField description="Login username. Must be unique." format="Text" required>
                  <Input label="Username" name="username" value={formData.username} onChange={handleFormChange} required />
                </StaffField>
                <StaffField description="Initial login password." format="Password" required>
                  <Input label="Password" name="password" type="password" value={formData.password} onChange={handleFormChange} required minLength={8} />
                </StaffField>
                <StaffField description="Password confirmation." format="Password" required>
                  <Input label="Confirm Password" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleFormChange} required minLength={8} />
                </StaffField>
                <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3.5 text-sm text-neutral-600">
                  <input
                    type="checkbox"
                    name="sendNotification"
                    checked={formData.sendNotification}
                    onChange={handleFormChange}
                    className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                  />
                  Send a notification to the user for this new role.
                </label>
              </StaffSection>
              )}

              {activeStaffSection === '6' && (
              <StaffSection number="6" title="Payroll Information" description="Salary bank and payment details.">
                <StaffField description="Base salary amount." format="Decimal" required={false}>
                  <Input label="Basic Salary" name="basicSalary" type="number" step="0.01" value={formData.basicSalary} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Salary bank." format="Text" required={false}>
                  <Input label="Bank Name" name="bankName" value={formData.bankName} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Salary account number." format="Text" required={false}>
                  <Input label="Account Number" name="accountNumber" value={formData.accountNumber} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Bank routing code." format="Text" required={false}>
                  <Input label="IFSC/SWIFT Code" name="ifscSwiftCode" value={formData.ifscSwiftCode} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Bank account holder." format="Text" required={false}>
                  <Input label="Account Holder Name" name="accountHolderName" value={formData.accountHolderName} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="UPI payment ID." format="Text" required={false}>
                  <Input label="UPI ID" name="upiId" value={formData.upiId} onChange={handleFormChange} />
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '7' && (
              <StaffSection number="7" title="Uploads" description="Compliance, onboarding, and qualification documents.">
                <IdentityProofUploadField
                  proofValue={formData.identityProofType}
                  fileValue={formData.identityDocumentsName}
                  previews={uploadPreviews.identityDocumentsName}
                  options={effectiveIdentityProofOptions}
                  onProofChange={handleFormChange}
                  onFileChange={handleUploadChange}
                  onRemove={handleUploadRemove}
                  uploading={uploadingField === 'identityDocumentsName'}
                />
                <StaffUploadField label="Resume/CV" name="resumeCvName" value={formData.resumeCvName} previews={uploadPreviews.resumeCvName} description="Employee resume." format="PDF or DOCX upload" accept="application/pdf,.doc,.docx" uploading={uploadingField === 'resumeCvName'} onChange={handleUploadChange} onRemove={handleUploadRemove} />
                <StaffUploadField label="Offer Letter" name="offerLetterName" value={formData.offerLetterName} previews={uploadPreviews.offerLetterName} description="Employment offer letter." format="PDF upload" accept="application/pdf" uploading={uploadingField === 'offerLetterName'} onChange={handleUploadChange} onRemove={handleUploadRemove} />
                <StaffUploadField label="Appointment Letter" name="appointmentLetterName" value={formData.appointmentLetterName} previews={uploadPreviews.appointmentLetterName} description="Appointment letter." format="PDF upload" accept="application/pdf" uploading={uploadingField === 'appointmentLetterName'} onChange={handleUploadChange} onRemove={handleUploadRemove} />
                <StaffUploadField label="Experience Certificates" name="experienceCertificatesName" value={formData.experienceCertificatesName} previews={uploadPreviews.experienceCertificatesName} description="Previous employment certificates." format="Multiple file upload" accept="application/pdf,.doc,.docx,image/*" multiple uploading={uploadingField === 'experienceCertificatesName'} onChange={handleUploadChange} onRemove={handleUploadRemove} />
                <StaffUploadField label="Educational Certificates" name="educationalCertificatesName" value={formData.educationalCertificatesName} previews={uploadPreviews.educationalCertificatesName} description="Academic certificates." format="Multiple file upload" accept="application/pdf,.doc,.docx,image/*" multiple uploading={uploadingField === 'educationalCertificatesName'} onChange={handleUploadChange} onRemove={handleUploadRemove} />
                <StaffField description="Employee skills." format="Multi-select or tags" required={false} className="lg:col-span-2">
                  <Input label="Skills" name="skills" placeholder="Separate skills with commas" value={formData.skills} onChange={handleFormChange} />
                </StaffField>
              </StaffSection>
              )}

              {activeStaffSection === '8' && (
              <StaffSection number="8" title="System Preferences" description="Application language, timezone, and account status.">
                <StaffField description="Preferred application language." format="Dropdown" required={false}>
                  <Select label="Language" name="language" options={languageOptions} value={formData.language} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Preferred application timezone." format="Dropdown" required={false}>
                  <Select label="Time Zone" name="timeZone" options={timeZoneOptions} value={formData.timeZone} onChange={handleFormChange} />
                </StaffField>
                <StaffField description="Active, inactive, suspended, or locked." format="Dropdown" required>
                  <Select label="Status" name="systemStatus" options={effectiveSystemStatusOptions} value={formData.systemStatus} onChange={handleFormChange} required />
                </StaffField>
              </StaffSection>
              )}
            </div>

            {formError && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={goToPreviousStaffSection} disabled={isSaving || isFirstStaffSection}>
                Back
              </Button>
              {isLastStaffSection ? (
                <Button type="submit" loading={isSaving} disabled={Boolean(uploadingField)}>
                  Add New User
                </Button>
              ) : (
                <Button type="button" onClick={goToNextStaffSection} disabled={isSaving}>
                  Next
                </Button>
              )}
            </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Modal
        isOpen={Boolean(statusUser)}
        onClose={handleCloseStatusModal}
        title="Change Status"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleCloseStatusModal} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button type="button" onClick={handleChangeStatus} loading={isUpdatingStatus}>
              {statusUser?.isActive ? 'Set Inactive' : 'Set Active'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-500">Current status</p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <div>
                <p className="font-medium text-neutral-900">{statusUser?.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{statusUser?.email}</p>
              </div>
              <Badge variant={statusUser?.isActive ? 'success' : 'danger'}>
                {statusUser?.isActive ? 'active' : 'inactive'}
              </Badge>
            </div>
          </div>
          <p className="text-sm leading-6 text-neutral-600">
            This will change the user to {statusUser?.isActive ? 'inactive' : 'active'}.
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
        </div>
      </Modal>
      <ResetPasswordModal
        user={resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        onSuccess={(resetUser, detail) => {
          setResetPasswordUser(null)
          showToast({
            title: 'Password reset',
            message: detail || `Password reset for ${resetUser.name}.`,
          })
        }}
      />
      <Modal
        isOpen={Boolean(permanentDeleteTarget)}
        onClose={() => {
          if (isDeletingUser) return
          setPermanentDeleteTarget(null)
          setPermanentDeleteError('')
        }}
        title="Permanently Delete User"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Permanently delete {permanentDeleteTarget?.name || 'this user'}? This cannot be undone and all data will be removed.
          </p>
          {permanentDeleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {permanentDeleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeletingUser}
              onClick={() => {
                setPermanentDeleteTarget(null)
                setPermanentDeleteError('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmPermanentDelete} loading={isDeletingUser}>
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[12rem_1fr_auto] lg:items-center">
            <div className="w-full">
              <Select
                options={effectiveFilterTabs}
                value={activeRoleFilter}
                onChange={(event) => setActiveRoleFilter(event.target.value)}
                className="w-full"
              />
            </div>

            <div className="relative w-full lg:mx-auto lg:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search staff"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <RequirePermission module="users" action="create">
                <Button onClick={handleOpenModal} size="sm">
                  <Plus className="size-4" />
                  Add Staff
                </Button>
              </RequirePermission>
              <Button type="button" variant="outline" size="sm">
                <CalendarDays className="size-4" aria-hidden="true" />
                This Month
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {isLoadingUsers ? (
            <LoadingSpinner label="Loading staff..." />
          ) : listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={async () => {
                  const rolesResult = await listRoles()

                  if (rolesResult.success) {
                    setRoles(rolesResult.roles || [])
                  }

                  await refreshUsers()
                }}
              >
                Retry
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No staff found.</p>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    <th className="whitespace-nowrap px-4 py-3">User</th>
                    <th className="whitespace-nowrap px-4 py-3">Email</th>
                    <th className="whitespace-nowrap px-4 py-3">Role</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3">Joined</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <StaffAvatar name={user.name} photoUrl={user.profilePhoto} />
                          <div>
                            <Link
                              to={`/admin/users/${user.id}`}
                              className="font-medium text-neutral-900 transition-colors hover:text-primary-700"
                            >
                              {user.name}
                            </Link>
                            {user.phone && <p className="mt-0.5 text-xs text-neutral-400">{user.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{user.email}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant="primary">{roleLabels[user.role] || user.roleDetail?.name || user.role}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={user.isActive ? 'success' : 'danger'}>
                          {user.isActive ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/edit/${user.id}`)}
                            className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label={`Edit ${user.name}`}
                            title="Edit"
                          >
                            <Edit className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(user)}
                            className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label={`Change status for ${user.name}`}
                            title="Change Status"
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setResetPasswordUser(user)}
                              className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                              aria-label={`Reset password for ${user.name}`}
                              title="Reset Password"
                            >
                              <KeyRound className="size-4" aria-hidden="true" />
                            </button>
                          )}
                          {isSuperAdmin && user.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setPermanentDeleteError('')
                                setPermanentDeleteTarget(user)
                              }}
                              className="flex size-8 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Permanently delete ${user.name}`}
                              title="Delete Permanently"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400 lg:flex-row lg:items-center lg:justify-between">
                <span>
                  Showing <span className="font-semibold text-neutral-700">{rangeStart}</span> to{' '}
                  <span className="font-semibold text-neutral-700">{rangeEnd}</span> of{' '}
                  <span className="font-semibold text-neutral-700">{filteredUsers.length}</span> users
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    aria-label="Previous page"
                  >
                    <span aria-hidden="true">‹</span>
                  </button>

                  {paginationPages.map((pageNumber, index) => {
                    const previousPage = paginationPages[index - 1]
                    const isGap = previousPage && pageNumber - previousPage > 1

                    return (
                      <span key={pageNumber} className="flex items-center gap-2">
                        {isGap && <span className="px-1 text-neutral-300">…</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            pageNumber === safeCurrentPage
                              ? 'bg-primary-600 text-white'
                              : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      </span>
                    )
                  })}

                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    aria-label="Next page"
                  >
                    <span aria-hidden="true">›</span>
                  </button>

                  <Select
                    options={pageSizeOptions}
                    value={pageSize}
                    onChange={(event) => setPageSize(event.target.value)}
                    className="w-28"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
