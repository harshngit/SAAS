import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  Calendar,
  CalendarCheck2,
  Camera,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import { ROLES, roleLabels } from '../../auth/roles'
import { useAuthStore } from '../../store/authStore'
import {
  clearEmployeeDocuments,
  clearEmployeeFile,
  deleteEmployeeDocument,
  deleteUser,
  getUser,
  getUserOverview,
  updateUserStatus,
} from '../../api/users'
import { listCustomers } from '../../api/customers'
import { getAttendance } from '../../api/attendance'
import { formatTimeLabel } from '../attendance/attendanceUtils'
import { normalizeApiUser } from './userRoleUtils'
import ResetPasswordModal from './ResetPasswordModal'
import { SalesStaffOverviewPanels, SalesStaffStatCards } from './SalesStaffOverview'
import { DeliveryStaffOverviewPanels, DeliveryStaffStatCards } from './DeliveryStaffOverview'
import {
  EmptyPanelState,
  Panel,
  emptyDeliveryPoints,
  emptyTrendPoints,
  formatChartDate,
  formatCurrency,
  formatDate,
} from './staffOverviewShared'

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function formatList(values = []) {
  return values.length ? values.join(', ') : ''
}

function calculateAge(dob) {
  if (!dob) return ''
  const birthDate = new Date(dob)
  if (Number.isNaN(birthDate.getTime())) return ''

  const now = new Date()
  let years = now.getFullYear() - birthDate.getFullYear()
  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
  if (!hasHadBirthdayThisYear) years -= 1

  return years >= 0 ? `${years} yrs` : ''
}

function calculateTenure(joinDate) {
  if (!joinDate) return ''
  const start = new Date(joinDate)
  if (Number.isNaN(start.getTime())) return ''

  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return ''

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years === 0 && remainingMonths === 0) return 'New'
  return [years ? `${years}y` : '', remainingMonths ? `${remainingMonths}m` : ''].filter(Boolean).join(' ')
}

function formatLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getFileMeta(url = '') {
  const extension = (url.split('?')[0].split('.').pop() || '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return { kind: 'image', badgeClass: 'bg-blue-50 text-blue-600' }
  }
  if (extension === 'pdf') {
    return { kind: 'pdf', badgeClass: 'bg-red-50 text-red-600' }
  }
  if (['doc', 'docx'].includes(extension)) {
    return { kind: 'doc', badgeClass: 'bg-primary-50 text-primary-700' }
  }
  return { kind: extension || 'file', badgeClass: 'bg-neutral-100 text-neutral-500' }
}

// Parses a 'HH:MM' check-in time (or ISO datetime) against today's date and returns
// minutes elapsed to now - used to show a live "duty hours" figure while checked in.
function minutesElapsedSince(checkInValue) {
  if (!checkInValue) return null

  const now = new Date()
  let start = null

  if (/^\d{1,2}:\d{2}$/.test(checkInValue)) {
    const [hours, minutes] = checkInValue.split(':').map(Number)
    start = new Date(now)
    start.setHours(hours, minutes, 0, 0)
  } else {
    const parsed = new Date(checkInValue)
    if (!Number.isNaN(parsed.getTime())) start = parsed
  }

  if (!start) return null
  const diff = Math.round((now.getTime() - start.getTime()) / 60000)
  return diff > 0 ? diff : null
}

function normalizeAttendanceRecord(record) {
  return {
    date: record.date || record.attendance_date || '',
    status: record.status || 'Present',
    checkIn: record.check_in || record.checkIn || null,
    checkOut: record.check_out || record.checkOut || null,
  }
}

// Mirrors CustomerDetail.jsx's normalizer so an assigned-customer list here matches what
// the customer's own record shows everywhere else in the app.
const normalizeCustomer = (customer) => ({
  ...customer,
  businessName: customer.business_name || customer.businessName || customer.name,
  billingAddress: customer.billing_address || customer.billingAddress || customer.address || '',
  outstandingBalance: customer.outstanding_balance || customer.outstandingBalance || 0,
  isActive: customer.is_active ?? customer.isActive,
})

function Avatar({ name, photoUrl, size = 'size-20', textSize = 'text-lg' }) {
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

function TopInfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="truncate text-sm font-semibold text-neutral-900" title={value || '-'}>{value || '-'}</p>
      </div>
    </div>
  )
}

function MiniWidget({ icon: Icon, label, value, sublabel }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="truncate text-base font-semibold text-neutral-900">{value}</p>
        {sublabel && <p className="truncate text-xs text-neutral-400">{sublabel}</p>}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-neutral-900" title={value || '-'}>
        {value || '-'}
      </p>
    </div>
  )
}

function Section({ number, title, icon: Icon, actions, children }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-neutral-900">{number}. {title}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">{children}</div>
    </div>
  )
}

function FileCard({ name, subtitle, url, isClearing = false, onClear }) {
  const { kind, badgeClass } = getFileMeta(url)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase ${badgeClass}`}>
        {kind === 'image' ? kind.slice(0, 3) : kind.slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium text-neutral-900 hover:text-primary-700"
          title={name}
        >
          {name}
        </a>
        {subtitle && <p className="truncate text-xs text-neutral-400">{subtitle}</p>}
      </div>
      {onClear && (
        <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" onClick={onClear} loading={isClearing}>
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

const documentCollections = [
  { collection: 'uploaded_documents', userKey: 'uploadedDocuments', title: 'Document' },
  { collection: 'experience_certificates', userKey: 'experienceCertificates', title: 'Experience Certificate' },
  { collection: 'educational_certificates', userKey: 'educationalCertificates', title: 'Educational Certificate' },
]

const employeeFileFields = [
  { field: 'resume_cv', userKey: 'resumeCv', label: 'Resume / CV' },
  { field: 'offer_letter', userKey: 'offerLetter', label: 'Offer Letter' },
  { field: 'appointment_letter', userKey: 'appointmentLetter', label: 'Appointment Letter' },
]

const profileTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks & Visits' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'documents', label: 'Documents' },
  { key: 'additional', label: 'Additional Details' },
]

const deliveryProfileTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'customers', label: 'Customers' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'documents', label: 'Documents' },
  { key: 'additional', label: 'Additional Details' },
]

export default function UserDetail() {
  const { user_id: userId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [documentsError, setDocumentsError] = useState('')
  const [filesError, setFilesError] = useState('')
  const [clearingFileField, setClearingFileField] = useState('')
  const [clearingCollection, setClearingCollection] = useState('')
  const [deletingDocumentKey, setDeletingDocumentKey] = useState('')
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [assignedCustomers, setAssignedCustomers] = useState([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true)
  const [overview, setOverview] = useState(null)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      setIsLoading(true)
      setError('')
      setDocumentsError('')
      setFilesError('')
      setIsLoadingCustomers(true)
      setIsLoadingAttendance(true)
      setIsLoadingOverview(true)
      setActiveTab('overview')

      // getUser/getUserOverview each catch their own HTTP errors and always resolve with
      // {success, ...} (see src/api/users.js) - neither ever rejects, so a failing overview
      // call can't reject this Promise.all or block the base profile from loading. The two
      // results are handled fully independently below.
      const [result, customersResult, attendanceResult, overviewResult] = await Promise.all([
        getUser(userId),
        listCustomers({ assigned_sales_officer_id: userId }),
        getAttendance({ user_id: userId }),
        getUserOverview(userId),
      ])

      if (!isMounted) return

      setIsLoading(false)
      setIsLoadingCustomers(false)
      setIsLoadingAttendance(false)
      setIsLoadingOverview(false)

      if (customersResult.success) {
        setAssignedCustomers(customersResult.customers.map(normalizeCustomer))
      }

      if (attendanceResult.success) {
        setAttendanceRecords(attendanceResult.records.map(normalizeAttendanceRecord))
      }

      // Best-effort: the overview endpoint 404s for users outside the caller's org, but the
      // page is still fully usable from the other real data sources above without it.
      if (overviewResult.success) {
        setOverview(overviewResult.overview)
      }

      if (!result.success) {
        setError(result.error)
        return
      }

      setUser(normalizeApiUser(result.user))
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleClearFile = async ({ field, userKey, label }) => {
    setFilesError('')
    setClearingFileField(field)

    const result = await clearEmployeeFile(userId, field)

    setClearingFileField('')

    if (!result.success) {
      setFilesError(result.error)
      return
    }

    const updatedUser = result.user ? normalizeApiUser(result.user) : null
    setUser((currentUser) => (
      updatedUser || (currentUser ? { ...currentUser, [userKey]: '' } : currentUser)
    ))
    showToast({
      title: 'File removed',
      message: `${label} removed successfully.`,
    })
  }

  const handleDeleteDocument = async ({ collection, userKey, title }, document) => {
    setDocumentsError('')

    const documentKey = `${collection}:${document.id}`
    setDeletingDocumentKey(documentKey)

    const result = await deleteEmployeeDocument(userId, collection, document.id)

    setDeletingDocumentKey('')

    if (!result.success) {
      setDocumentsError(result.error)
      return
    }

    setUser((currentUser) => (
      currentUser
        ? { ...currentUser, [userKey]: (currentUser[userKey] || []).filter((item) => item.id !== document.id) }
        : currentUser
    ))
    showToast({
      title: 'Document deleted',
      message: `${document.name || title} deleted successfully.`,
    })
  }

  const handleClearDocuments = async ({ collection, userKey, title }) => {
    setDocumentsError('')
    setClearingCollection(collection)

    const result = await clearEmployeeDocuments(userId, collection)

    setClearingCollection('')

    if (!result.success) {
      setDocumentsError(result.error)
      return
    }

    setUser((currentUser) => (currentUser ? { ...currentUser, [userKey]: [] } : currentUser))
    showToast({
      title: 'Documents cleared',
      message: `${title} cleared successfully.`,
    })
  }

  const handleChangeStatus = async () => {
    if (!user) return

    setStatusError('')
    setIsUpdatingStatus(true)

    const result = await updateUserStatus(userId, !user.isActive)

    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    const updatedUser = normalizeApiUser(result.user)
    setUser((currentUser) => ({ ...currentUser, ...updatedUser }))
    setIsStatusModalOpen(false)
    showToast({
      title: 'Status updated',
      message: `${updatedUser.name} is now ${updatedUser.status}.`,
    })
  }

  const handleConfirmDelete = async () => {
    setDeleteError('')
    setIsDeletingUser(true)

    const result = await deleteUser(userId)

    setIsDeletingUser(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    showToast({
      title: 'Staff deleted',
      message: `${user?.name || 'Staff member'} deleted successfully.`,
    })
    navigate('/admin/users')
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading staff details..." />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700">
          <ArrowLeft className="size-4" />
          Back to Staff
        </Link>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const roleLabel = roleLabels[user.role] || user.roleDetail?.name || user.role
  // Workspace (not role/system_role) decides which profile design renders - a role name like
  // "Delivery Partner" doesn't guarantee workspace='delivery' (custom roles, renamed roles,
  // etc.), but the backend's workspace field is authoritative for this. `overview.workspace`
  // (GET /users/{id}/overview) is the primary source since it's fetched fresh every load;
  // `user.roleDetail?.workspace` (embedded role on GET /users/{id}) is the fallback for when
  // overview fails to load (e.g. a scoped viewer without overview access) but the profile
  // itself still loaded fine.
  const workspace = overview?.workspace || user.roleDetail?.workspace || ''
  const isSalesWorkspace = workspace === 'sales'
  const isDeliveryWorkspace = workspace === 'delivery'
  const activeTabsList = isDeliveryWorkspace ? deliveryProfileTabs : profileTabs
  const age = calculateAge(user.dateOfBirth)
  const tenure = calculateTenure(user.dateOfJoining)

  const totalDocumentCount =
    (user.uploadedDocuments?.length || 0) +
    (user.experienceCertificates?.length || 0) +
    (user.educationalCertificates?.length || 0) +
    [user.identityProofFile, user.resumeCv, user.offerLetter, user.appointmentLetter].filter(Boolean).length

  const todayIso = new Date().toISOString().slice(0, 10)
  const todaysAttendance = attendanceRecords.find((record) => (record.date || '').slice(0, 10) === todayIso)
  const dutyStatus = todaysAttendance?.checkIn && !todaysAttendance?.checkOut
    ? 'on-duty'
    : todaysAttendance?.checkOut
      ? 'off-duty'
      : 'not-checked-in'
  const dutyMinutes = dutyStatus === 'on-duty' ? minutesElapsedSince(todaysAttendance.checkIn) : null
  const presentCount = attendanceRecords.filter((record) => record.status === 'Present').length
  const absentCount = attendanceRecords.filter((record) => record.status === 'Absent').length
  const onLeaveCount = attendanceRecords.filter((record) => record.status === 'On Leave').length
  const weekOffCount = attendanceRecords.filter((record) => record.status === 'Week Off').length

  const hasSalesPerformance = Array.isArray(overview?.performance) && overview.performance.length > 0
  const salesTrendPoints = hasSalesPerformance
    ? overview.performance.map((point) => ({
        label: formatChartDate(point.date),
        value: Number(point.sales_amount) || 0,
      }))
    : emptyTrendPoints

  const hasDeliveryPerformance = Array.isArray(overview?.performance) && overview.performance.length > 0
  const deliveryTrendPoints = hasDeliveryPerformance
    ? overview.performance.map((point) => ({
        label: formatChartDate(point.date),
        delivered: Number(point.deliveries_completed) || 0,
        amount: Number(point.delivery_amount) || 0,
      }))
    : emptyDeliveryPoints

  return (
    <div className="space-y-5">
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          if (isUpdatingStatus) return
          setIsStatusModalOpen(false)
          setStatusError('')
        }}
        title="Change Status"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button type="button" onClick={handleChangeStatus} loading={isUpdatingStatus}>
              {user.isActive ? 'Set Inactive' : 'Set Active'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div>
              <p className="font-medium text-neutral-900">{user.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{user.email}</p>
            </div>
            <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'active' : 'inactive'}</Badge>
          </div>
          <p className="text-sm leading-6 text-neutral-600">
            This will change the user to {user.isActive ? 'inactive' : 'active'}.
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeletingUser) return
          setIsDeleteModalOpen(false)
          setDeleteError('')
        }}
        title="Delete Staff Member"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {user.name}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeletingUser} onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} loading={isDeletingUser}>
              Delete
            </Button>
          </div>
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

      <div>
        <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">Employee Profile</h1>
        <Link to="/admin/users" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Staff
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar name={user.name} photoUrl={user.profilePhoto} size="size-24" textSize="text-2xl" />
              <Link
                to={`/admin/users/edit/${userId}`}
                className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary-600 text-white shadow-(--shadow-xs) transition-colors hover:bg-primary-700"
                title="Update photo"
              >
                <Camera className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold text-neutral-900">{user.name}</p>
              <p className="text-sm text-neutral-500">{user.designation || roleLabel}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{user.employeeId || '—'}</Badge>
                <Badge variant={dutyStatus === 'on-duty' ? 'success' : dutyStatus === 'off-duty' ? 'neutral' : 'warning'} dot>
                  {dutyStatus === 'on-duty' ? 'On Duty' : dutyStatus === 'off-duty' ? 'Off Duty' : 'Not Checked In'}
                </Badge>
              </div>
              {todaysAttendance?.checkIn && (
                <p className="mt-1.5 text-xs text-neutral-400">Since {formatTimeLabel(todaysAttendance.checkIn)}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-neutral-100 pt-5 sm:grid-cols-2 lg:border-x lg:border-t-0 lg:px-6 lg:pt-0">
            <TopInfoItem icon={Phone} label="Phone" value={user.phone} />
            <TopInfoItem icon={MapPin} label="Territory" value={user.workLocation} />
            <TopInfoItem icon={Mail} label="Email" value={user.email} />
            <TopInfoItem icon={Calendar} label="Joined" value={formatDate(user.dateOfJoining)} />
            {isDeliveryWorkspace && (
              <TopInfoItem
                icon={Truck}
                label="Vehicle"
                value={overview?.vehicle ? overview.vehicle.vehicle_number || '—' : 'Not assigned'}
              />
            )}
          </div>

          <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/admin/users/edit/${userId}`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit Profile
            </Button>
            {isAdmin && (
              <Button type="button" variant="outline" size="sm" onClick={() => setResetPasswordUser(user)}>
                <ShieldCheck className="size-4" aria-hidden="true" />
                Reset Password
              </Button>
            )}
            {isAdmin && (
              <ActionMenu
                items={[
                  { label: user.isActive ? 'Set Inactive' : 'Set Active', icon: RefreshCw, onClick: () => setIsStatusModalOpen(true) },
                  { label: 'Delete Staff', icon: Trash2, danger: true, onClick: () => setIsDeleteModalOpen(true) },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {isDeliveryWorkspace ? (
        <DeliveryStaffStatCards overview={overview} todaysAttendance={todaysAttendance} dutyMinutes={dutyMinutes} />
      ) : isSalesWorkspace ? (
        <SalesStaffStatCards overview={overview} todaysAttendance={todaysAttendance} />
      ) : null}

      <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-100 px-3">
          {activeTabsList.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {isDeliveryWorkspace ? (
                <DeliveryStaffOverviewPanels
                  overview={overview}
                  isLoadingOverview={isLoadingOverview}
                  deliveryTrendPoints={deliveryTrendPoints}
                  hasDeliveryPerformance={hasDeliveryPerformance}
                  dutyMinutes={dutyMinutes}
                  onViewDeliveries={() => setActiveTab('deliveries')}
                />
              ) : isSalesWorkspace ? (
                <SalesStaffOverviewPanels
                  overview={overview}
                  isLoadingOverview={isLoadingOverview}
                  salesTrendPoints={salesTrendPoints}
                  hasSalesPerformance={hasSalesPerformance}
                  dutyMinutes={dutyMinutes}
                  todaysAttendance={todaysAttendance}
                  assignedCustomers={assignedCustomers}
                  isLoadingCustomers={isLoadingCustomers}
                  onViewOrders={() => navigate('/admin/orders')}
                  onViewCustomers={() => setActiveTab('customers')}
                />
              ) : (
                // No sales/delivery workspace - no client-approved design for this workspace
                // yet, so show the shared employee sections below only. No fabricated stats.
                <Panel title="Overview">
                  <EmptyPanelState
                    message="No specialized overview for this workspace yet."
                    note={workspace ? `Workspace: ${formatLabel(workspace)}` : undefined}
                  />
                </Panel>
              )}

              <div className="grid gap-4 xl:grid-cols-3">
                <Section number={1} title="Basic Information" icon={UserRound}>
                  <Field label="First Name" value={user.firstName} />
                  <Field label="Last Name" value={user.lastName} />
                  <Field label="Display Name" value={user.displayName || user.name} />
                  <Field label="Gender" value={formatLabel(user.gender)} />
                  <Field label="Date of Birth" value={formatDate(user.dateOfBirth)} />
                  <Field label="Age" value={age} />
                  <Field label="Marital Status" value={formatLabel(user.maritalStatus)} />
                  <Field label="Blood Group" value={user.bloodGroup} />
                </Section>

                <Section number={2} title="Contact Information" icon={Phone}>
                  <Field label="Primary Phone" value={user.phone} />
                  <Field label="Secondary Phone" value={user.alternateMobileNumber} />
                  <Field label="Email Address" value={user.email} />
                  <Field label="Alternate Email" value={user.personalEmail} />
                  <Field label="Emergency Contact" value={user.emergencyContactName} />
                  <Field label="Emergency Number" value={user.emergencyContactNumber} />
                </Section>

                <Section number={3} title="Address Information" icon={MapPin}>
                  <Field label="Current Address" value={user.currentAddress} />
                  <Field label="Permanent Address" value={user.permanentAddress} />
                  <Field label="City" value={user.city} />
                  <Field label="State" value={user.state} />
                  <Field label="ZIP / PIN" value={user.pinZipCode} />
                  <Field label="Country" value={user.country} />
                </Section>

                <Section number={4} title="Employment Information" icon={BriefcaseBusiness}>
                  <Field label="Designation" value={user.designation} />
                  <Field label="Work Type" value={formatLabel(user.employmentType)} />
                  <Field label="Employee Status" value={formatLabel(user.employeeStatus)} />
                  <Field label="Date of Joining" value={formatDate(user.dateOfJoining)} />
                  <Field label="Tenure" value={tenure} />
                  <Field label="Reporting Manager" value={user.reportingManagerName || user.reportingManagerId} />
                  <Field label="Work Location" value={user.workLocation} />
                  <Field label="Shift" value={formatLabel(user.shift)} />
                </Section>

                <Section number={5} title="Payroll Information" icon={Banknote}>
                  <Field label="Monthly Salary" value={formatCurrency(user.basicSalary)} />
                  <Field label="Bank Name" value={user.bankName} />
                  <Field label="Account Number" value={user.accountNumber} />
                  <Field label="IFSC / SWIFT Code" value={user.ifscSwiftCode} />
                  <Field label="Account Holder Name" value={user.accountHolderName} />
                  <Field label="UPI ID" value={user.upiId} />
                </Section>

                <Section number={6} title="System Preferences" icon={Settings}>
                  <Field label="Username" value={user.username} />
                  <Field label="Account Status" value={formatLabel(user.status)} />
                  <Field label="Language" value={formatLabel(user.language)} />
                  <Field label="Time Zone" value={user.timeZone} />
                </Section>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <EmptyPanelState
              message="No tasks or visits recorded yet."
              note="Task and visit tracking isn't linked to staff accounts yet."
            />
          )}

          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <EmptyPanelState
                message="No deliveries linked to this staff member yet."
                note="Delivery tracking isn't tied to staff accounts yet."
              />
              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/deliveries')}>View All Deliveries</Button>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <EmptyPanelState
                message="No orders linked to this staff member yet."
                note="Order tracking isn't tied to staff accounts yet."
              />
              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/orders')}>View All Orders</Button>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            isLoadingCustomers ? (
              <LoadingSpinner label="Loading customers..." />
            ) : assignedCustomers.length === 0 ? (
              <EmptyPanelState message="No customers assigned to this staff member yet." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="whitespace-nowrap px-4 py-3">Customer</th>
                      <th className="whitespace-nowrap px-4 py-3">City</th>
                      <th className="whitespace-nowrap px-4 py-3">Phone</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {assignedCustomers.map((customer) => (
                      <tr key={customer.id} className="transition-colors hover:bg-primary-50/35">
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link to={`/admin/customers/${customer.id}`} className="font-medium text-neutral-800 hover:text-primary-700">
                            {customer.businessName || customer.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{customer.city || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{customer.phone || customer.mobileNumber || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(customer.outstandingBalance) || '₹ 0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {isLoadingAttendance ? (
                <LoadingSpinner label="Loading attendance..." />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <MiniWidget icon={CalendarCheck2} label="Present" value={presentCount} />
                    <MiniWidget icon={UserCheck} label="Absent" value={absentCount} />
                    <MiniWidget icon={Calendar} label="On Leave" value={onLeaveCount} />
                    <MiniWidget icon={Users} label="Week Off" value={weekOffCount} />
                  </div>
                  {attendanceRecords.length === 0 && (
                    <EmptyPanelState message="No attendance records found for this staff member yet." />
                  )}
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/admin/attendance/${userId}`)}>
                      View Full Attendance History
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <EmptyPanelState
              message="No expenses recorded yet."
              note="Expense tracking isn't linked to staff accounts yet."
            />
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {(filesError || documentsError) && (
                <div className="space-y-2">
                  {filesError && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{filesError}</div>
                  )}
                  {documentsError && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">{documentsError}</div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Documents / Uploads</p>
                <span className="text-xs text-neutral-400">{totalDocumentCount} file{totalDocumentCount === 1 ? '' : 's'}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {user.identityProofFile && (
                  <FileCard
                    name={formatLabel(user.identityProofType) || 'Identity Proof'}
                    subtitle="Identity Proof"
                    url={user.identityProofFile}
                    isClearing={clearingFileField === 'identity_proof_file'}
                    onClear={isAdmin ? () => handleClearFile({ field: 'identity_proof_file', userKey: 'identityProofFile', label: 'Identity proof' }) : undefined}
                  />
                )}
                {employeeFileFields.map((fileField) => (
                  user[fileField.userKey] && (
                    <FileCard
                      key={fileField.field}
                      name={fileField.label}
                      subtitle="Employee File"
                      url={user[fileField.userKey]}
                      isClearing={clearingFileField === fileField.field}
                      onClear={isAdmin ? () => handleClearFile(fileField) : undefined}
                    />
                  )
                ))}
                {documentCollections.flatMap((documentCollection) => (
                  (user[documentCollection.userKey] || []).map((document) => (
                    <FileCard
                      key={document.id || document.url}
                      name={document.name || documentCollection.title}
                      subtitle={documentCollection.title}
                      url={document.url}
                      isClearing={deletingDocumentKey === `${documentCollection.collection}:${document.id}`}
                      onClear={isAdmin && document.id ? () => handleDeleteDocument(documentCollection, document) : undefined}
                    />
                  ))
                ))}
              </div>

              {totalDocumentCount === 0 && (
                <p className="text-sm text-neutral-400">No documents uploaded yet.</p>
              )}

              {isAdmin && documentCollections.some((documentCollection) => (user[documentCollection.userKey] || []).length > 0) && (
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                  {documentCollections.map((documentCollection) => (
                    (user[documentCollection.userKey] || []).length > 0 && (
                      <Button
                        key={documentCollection.collection}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleClearDocuments(documentCollection)}
                        loading={clearingCollection === documentCollection.collection}
                      >
                        Clear all {documentCollection.title.toLowerCase()}s
                      </Button>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'additional' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Skills" value={formatList(user.skills)} />
              <Field label="Nationality" value={user.nationality} />
              <Field label="Blood Group" value={user.bloodGroup} />
              <Field label="Marital Status" value={formatLabel(user.maritalStatus)} />
              <Field label="Language" value={formatLabel(user.language)} />
              <Field label="Time Zone" value={user.timeZone} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
