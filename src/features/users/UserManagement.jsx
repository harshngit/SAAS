import { useEffect, useState } from 'react'
import { CalendarDays, Camera, Edit, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { ROLES, roleLabels } from '../../auth/roles'
import { createUser, listRoles, listUsers, updateUserStatus } from '../../api/users'
import { getSystemRoleFromRoleName, normalizeApiUser, staffRoleOptions } from './userRoleUtils'

const initialUsers = [
  { id: 1, name: 'Amit Sharma', email: 'amit@aquapure.com', role: ROLES.ADMIN, status: 'active' },
  { id: 2, name: 'Priya Patel', email: 'priya@aquapure.com', role: ROLES.SALES_OFFICER, status: 'active' },
  { id: 3, name: 'Rajesh Kumar', email: 'rajesh@aquapure.com', role: ROLES.DELIVERY_PARTNER, status: 'active' },
  { id: 4, name: 'Sneha Desai', email: 'sneha@aquapure.com', role: ROLES.ACCOUNTANT, status: 'active' },
]

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState(initialUsers)
  const [roles, setRoles] = useState([])
  const [activeRoleFilter, setActiveRoleFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [listError, setListError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusUser, setStatusUser] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    role: ROLES.SALES_OFFICER,
    role_id: '',
    password: '',
    profilePictureName: '',
  })

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
  const effectiveFilterTabs = [
    { value: 'all', label: 'All' },
    ...effectiveRoleSelectOptions.map((role) => ({ value: role.value, label: role.label })),
  ]

  const handleOpenModal = () => {
    setFormError('')
    setFormData(
      {
        name: '',
        email: '',
        username: '',
        phone: '',
        role: ROLES.SALES_OFFICER,
        role_id: effectiveRoleSelectOptions.find((role) => role.value === ROLES.SALES_OFFICER)?.roleId || '',
        password: '',
        profilePictureName: '',
      },
    )
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormError('')
  }

  useEffect(() => {
    let isMounted = true

    async function loadStaffData() {
      setIsLoadingUsers(true)
      setListError('')

      const [usersResult, rolesResult] = await Promise.all([listUsers(), listRoles()])

      if (!isMounted) return

      setIsLoadingUsers(false)

      if (rolesResult.success) {
        setRoles(rolesResult.roles || [])
      }

      if (!usersResult.success) {
        setListError(usersResult.error)
        return
      }

      setUsers((usersResult.users || []).map(normalizeApiUser))
    }

    loadStaffData()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    setIsSaving(true)
    const result = await createUser(formData)
    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    if (result.user) {
      setUsers([...users, normalizeApiUser(result.user)])
    } else {
      const newUser = { ...formData, id: Date.now(), status: 'active' }
      setUsers([...users, newUser])
    }

    handleCloseModal()
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== id))
    }
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

    const nextIsActive = statusUser.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

    const result = await updateUserStatus(statusUser.id, nextIsActive)
    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    const updatedUser = result.user
      ? normalizeApiUser(result.user)
      : { ...statusUser, status: nextIsActive ? 'active' : 'inactive' }

    setUsers((currentUsers) => currentUsers.map((user) => (user.id === statusUser.id ? updatedUser : user)))
    setStatusUser(null)
  }

  const filteredUsers = users.filter((user) => {
    const matchesRole = activeRoleFilter === 'all' || user.role === activeRoleFilter
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      [user.name, user.email, user.phone, roleLabels[user.role], user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))

    return matchesRole && matchesSearch
  })

  if (isModalOpen) {
    return (
      <div>
        <div>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
          >
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">Add a user for a new role</p>
                <p className="mt-1 text-sm text-neutral-500">Enter contact details, upload a profile image, and choose a workspace role.</p>
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
                    onClick={() => setFormData({ ...formData, profilePictureName: '' })}
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
                      label="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                    <Input
                      label="Username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                    <Input
                      label="Phone Number"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">2</span>
                    <p className="text-sm font-semibold text-neutral-900">Role and invitation</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
                    <Select
                      label="Role"
                      options={effectiveRoleSelectOptions}
                      placeholder="Select role"
                      name="role"
                      className="w-[50%]"
                      value={formData.role}
                      onChange={(e) => {
                        const selectedRole = effectiveRoleSelectOptions.find((role) => role.value === e.target.value)
                        setFormData({
                          ...formData,
                          role: e.target.value,
                          role_id: selectedRole?.roleId || '',
                        })
                      }}
                    />
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
              </div>
            </div>

            {formError && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving}>
                Add New User
              </Button>
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
              {statusUser?.status === 'active' ? 'Set Inactive' : 'Set Active'}
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
              <Badge variant={statusUser?.status === 'active' ? 'success' : 'danger'}>
                {statusUser?.status === 'active' ? 'active' : 'inactive'}
              </Badge>
            </div>
          </div>
          <p className="text-sm leading-6 text-neutral-600">
            This will change the user to {statusUser?.status === 'active' ? 'inactive' : 'active'}.
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
        </div>
      </Modal>
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-5">
                {effectiveFilterTabs.map((tab) => {
                  const isActive = activeRoleFilter === tab.value

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveRoleFilter(tab.value)}
                      className={`relative py-2 text-sm font-medium transition-colors ${
                        isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />
                      )}
                    </button>
                  )
                })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleOpenModal} size="sm">
                <Plus className="size-4" />
                Add Staff
              </Button>
              <Button type="button" variant="outline" size="sm">
                <CalendarDays className="size-4" aria-hidden="true" />
                This Month
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search staff"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={effectiveFilterTabs}
                value={activeRoleFilter}
                onChange={(event) => setActiveRoleFilter(event.target.value)}
                className="sm:w-48"
              />
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
                  setIsLoadingUsers(true)
                  setListError('')
                  const result = await listUsers()
                  const rolesResult = await listRoles()
                  setIsLoadingUsers(false)

                  if (rolesResult.success) {
                    setRoles(rolesResult.roles || [])
                  }

                  if (!result.success) {
                    setListError(result.error)
                    return
                  }

                  setUsers((result.users || []).map(normalizeApiUser))
                }}
              >
                Retry
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No staff found.</p>
          ) : (
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
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(user.name)}
                        </div>
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
                      <Badge variant={user.status === 'active' ? 'success' : 'danger'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => navigate(`/admin/users/edit/${user.id}`) },
                          { label: 'Change Status', icon: RefreshCw, onClick: () => handleOpenStatusModal(user) },
                          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(user.id) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredUsers.length === 0 ? '0' : `1 to ${filteredUsers.length}`} of {users.length}
          </span>
          <span>Staff members</span>
        </div>
      </Card>
    </div>
  )
}
