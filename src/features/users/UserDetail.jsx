import { useEffect, useState } from 'react'
import { ArrowLeft, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { ROLES, roleLabels } from '../../auth/roles'
import { useAuthStore } from '../../store/authStore'
import { getUser } from '../../api/users'
import ResetPasswordModal from './ResetPasswordModal'

const roleNameToSystemRole = {
  superadmin: ROLES.SUPER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  salesofficer: ROLES.SALES_OFFICER,
  sales_officer: ROLES.SALES_OFFICER,
  deliverypartner: ROLES.DELIVERY_PARTNER,
  delivery_partner: ROLES.DELIVERY_PARTNER,
  accountant: ROLES.ACCOUNTANT,
}

function getSystemRoleFromRoleName(name = '') {
  const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const compactName = normalizedName.replace(/_/g, '')
  return roleNameToSystemRole[normalizedName] || roleNameToSystemRole[compactName] || normalizedName
}

function normalizeApiUser(user) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name),
    roleId: user.role_id,
    roleDetail: user.role_detail,
    status: user.is_active ? 'active' : 'inactive',
    createdAt: user.created_at,
  }
}

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

export default function UserDetail() {
  const { user_id: userId } = useParams()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [resetPasswordUser, setResetPasswordUser] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      setIsLoading(true)
      setError('')

      const result = await getUser(userId)

      if (!isMounted) return

      setIsLoading(false)

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
        onSuccess={(resetUser) => {
          setResetPasswordUser(null)
          showToast({
            title: 'Password reset',
            message: `Password reset for ${resetUser.name}.`,
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
            <DetailItem label="User ID" value={user.id} />
            <DetailItem label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'} />
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
    </div>
  )
}
