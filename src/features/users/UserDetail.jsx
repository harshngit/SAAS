import { useEffect, useState } from 'react'
import { ArrowLeft, KeyRound, Mail, Phone, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { ROLES, roleLabels } from '../../auth/roles'
import { useAuthStore } from '../../store/authStore'
import { clearEmployeeDocuments, clearEmployeeFile, deleteEmployeeDocument, getUser, listEmployeeDocuments } from '../../api/users'
import { normalizeApiUser } from './userRoleUtils'
import ResetPasswordModal from './ResetPasswordModal'

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value || '-'}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function formatList(values = []) {
  return values.length ? values.join(', ') : '-'
}

function DocumentList({ title, documents = [], isClearing = false, deletingDocumentId = '', onClear, onDelete }) {
  const hasDocuments = documents.length > 0

  return (
    <Card
      title={title}
      actions={hasDocuments && onClear ? (
        <Button type="button" variant="outline" size="sm" onClick={onClear} loading={isClearing}>
          Clear
        </Button>
      ) : null}
    >
      {!hasDocuments ? (
        <p className="text-sm text-neutral-500">No documents uploaded.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <div
              key={document.id || document.url || document.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900"
            >
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate transition-colors hover:text-primary-700"
              >
                {document.name || document.url}
              </a>
              <span className="shrink-0 text-xs text-neutral-400">{document.size ? `${Math.round(document.size / 1024)} KB` : 'Open'}</span>
              {document.id && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(document)}
                  loading={deletingDocumentId === document.id}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function FileItem({ label, value, isClearing = false, onClear }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 transition-colors hover:text-primary-700"
          >
            {value}
          </a>
        ) : (
          <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">-</p>
        )}
        {value && onClear && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} loading={isClearing}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

const documentCollections = [
  { collection: 'uploaded_documents', userKey: 'uploadedDocuments', title: 'Documents' },
  { collection: 'experience_certificates', userKey: 'experienceCertificates', title: 'Experience Certificates' },
  { collection: 'educational_certificates', userKey: 'educationalCertificates', title: 'Educational Certificates' },
]

const employeeFileFields = [
  { field: 'profile_photo', userKey: 'profilePhoto', label: 'Profile Photo' },
  { field: 'resume_cv', userKey: 'resumeCv', label: 'Resume/CV' },
  { field: 'offer_letter', userKey: 'offerLetter', label: 'Offer Letter' },
  { field: 'appointment_letter', userKey: 'appointmentLetter', label: 'Appointment Letter' },
]

export default function UserDetail() {
  const { user_id: userId } = useParams()
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

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      setIsLoading(true)
      setError('')
      setDocumentsError('')
      setFilesError('')

      const [result, ...documentResults] = await Promise.all([
        getUser(userId),
        ...documentCollections.map(({ collection }) => listEmployeeDocuments(userId, collection)),
      ])

      if (!isMounted) return

      setIsLoading(false)

      if (!result.success) {
        setError(result.error)
        return
      }

      const nextUser = normalizeApiUser(result.user)
      const documentLoadError = documentResults.find((documentResult) => !documentResult.success)?.error

      documentResults.forEach((documentResult, index) => {
        if (documentResult.success) {
          nextUser[documentCollections[index].userKey] = documentResult.documents || []
        }
      })

      if (documentLoadError) {
        setDocumentsError(documentLoadError)
      }

      setUser(nextUser)
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
      currentUser ? { ...currentUser, [userKey]: result.documents || [] } : currentUser
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
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      </div>
    )
  }

  if (!user) return null

  const roleLabel = roleLabels[user.role] || user.roleDetail?.name || user.role

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700">
            <ArrowLeft className="size-4" />
            Back to Staff
          </Link>
          <h1 className="mt-3 font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
            {user.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Staff profile and role details</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetPasswordUser(user)}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Reset Password
            </Button>
          )}
          <Badge variant={user.status === 'active' ? 'success' : 'danger'}>{user.status}</Badge>
        </div>
      </div>

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-semibold text-primary-700 ring-1 ring-primary-100">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <h2 className="font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">{user.name}</h2>
              <p className="mt-1 text-sm text-neutral-500">@{user.username || 'username'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="primary">{roleLabel}</Badge>
                <Badge variant={user.status === 'active' ? 'success' : 'danger'}>{user.status}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 border-t border-neutral-100 pt-5 sm:grid-cols-2">
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Phone" value={user.phone} />
            <DetailItem label="Employee ID" value={user.employeeId} />
            <DetailItem label="Designation" value={user.designation} />
            <DetailItem label="User ID" value={user.id} />
            <DetailItem label="Joined" value={formatDate(user.dateOfJoining || user.createdAt)} />
          </div>
        </Card>

        <Card title="Role Details">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{roleLabel}</p>
                <p className="text-xs text-neutral-500">{user.roleDetail?.is_default ? 'Default role' : 'Custom role'}</p>
              </div>
            </div>
            <DetailItem label="Role ID" value={user.roleId} />
            <DetailItem label="Organization ID" value={user.organizationId} />
          </div>
        </Card>
      </div>

      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <Mail className="size-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-400">Email</p>
              <p className="text-sm font-medium text-neutral-900">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <Phone className="size-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-400">Phone</p>
              <p className="text-sm font-medium text-neutral-900">{user.phone || '-'}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Personal Details">
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="First Name" value={user.firstName} />
            <DetailItem label="Last Name" value={user.lastName} />
            <DetailItem label="Gender" value={user.gender} />
            <DetailItem label="Date of Birth" value={formatDate(user.dateOfBirth)} />
            <DetailItem label="Marital Status" value={user.maritalStatus} />
            <DetailItem label="Blood Group" value={user.bloodGroup} />
            <DetailItem label="Nationality" value={user.nationality} />
            <DetailItem label="Skills" value={formatList(user.skills)} />
          </div>
        </Card>

        <Card title="Employment Details">
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="Employment Type" value={user.employmentType} />
            <DetailItem label="Employee Status" value={user.employeeStatus} />
            <DetailItem label="Date of Joining" value={formatDate(user.dateOfJoining)} />
            <DetailItem label="Date of Exit" value={formatDate(user.dateOfExit)} />
            <DetailItem label="Work Location" value={user.workLocation} />
            <DetailItem label="Shift" value={user.shift} />
            <DetailItem label="Reporting Manager ID" value={user.reportingManagerId} />
            <DetailItem label="Account Status" value={user.status} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Address">
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="Current Address" value={user.currentAddress} />
            <DetailItem label="Permanent Address" value={user.permanentAddress} />
            <DetailItem label="City" value={user.city} />
            <DetailItem label="State" value={user.state} />
            <DetailItem label="Country" value={user.country} />
            <DetailItem label="PIN/ZIP Code" value={user.pinZipCode} />
          </div>
        </Card>

        <Card title="Emergency Contact">
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailItem label="Name" value={user.emergencyContactName} />
            <DetailItem label="Phone" value={user.emergencyContactNumber} />
            <DetailItem label="Relationship" value={user.emergencyContactRelationship} />
            <DetailItem label="Alternate Mobile" value={user.alternateMobileNumber} />
            <DetailItem label="Personal Email" value={user.personalEmail} />
          </div>
        </Card>
      </div>

      <Card title="Files">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {employeeFileFields.slice(0, 1).map((fileField) => (
            <FileItem
              key={fileField.field}
              label={fileField.label}
              value={user[fileField.userKey]}
              isClearing={clearingFileField === fileField.field}
              onClear={isAdmin ? () => handleClearFile(fileField) : undefined}
            />
          ))}
          <DetailItem label="Identity Proof Type" value={user.identityProofType} />
          <DetailItem label="Identity Proof File" value={user.identityProofFile} />
          {employeeFileFields.slice(1).map((fileField) => (
            <FileItem
              key={fileField.field}
              label={fileField.label}
              value={user[fileField.userKey]}
              isClearing={clearingFileField === fileField.field}
              onClear={isAdmin ? () => handleClearFile(fileField) : undefined}
            />
          ))}
        </div>
        {filesError && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {filesError}
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {documentsError && (
          <div className="xl:col-span-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {documentsError}
          </div>
        )}
        {documentCollections.map((documentCollection) => (
          <DocumentList
            key={documentCollection.collection}
            title={documentCollection.title}
            documents={user[documentCollection.userKey]}
            isClearing={clearingCollection === documentCollection.collection}
            deletingDocumentId={deletingDocumentKey.startsWith(`${documentCollection.collection}:`) ? deletingDocumentKey.split(':')[1] : ''}
            onClear={isAdmin ? () => handleClearDocuments(documentCollection) : undefined}
            onDelete={isAdmin ? (document) => handleDeleteDocument(documentCollection, document) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
