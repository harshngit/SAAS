import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Search, UsersRound, Camera, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { ROLES, roleLabels } from '../../auth/roles'
import { createUser, listUsers } from '../../api/users'

const initialUsers = [
  { id: 1, name: 'Amit Sharma', email: 'amit@aquapure.com', role: ROLES.ADMIN, status: 'active' },
  { id: 2, name: 'Priya Patel', email: 'priya@aquapure.com', role: ROLES.SALES_OFFICER, status: 'active' },
  { id: 3, name: 'Rajesh Kumar', email: 'rajesh@aquapure.com', role: ROLES.DELIVERY_PARTNER, status: 'active' },
  { id: 4, name: 'Sneha Desai', email: 'sneha@aquapure.com', role: ROLES.ACCOUNTANT, status: 'active' },
]

const staffRoleOptions = [
  ROLES.SALES_OFFICER,
  ROLES.DELIVERY_PARTNER,
  ROLES.ACCOUNTANT,
]

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

const staffFilterTabs = [
  { value: 'all', label: 'All' },
  ...staffRoleSelectOptions,
]

export default function UserManagement() {
  const [users, setUsers] = useState(initialUsers)
  const [activeRoleFilter, setActiveRoleFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [listError, setListError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: ROLES.SALES_OFFICER,
    password: '',
    profilePictureName: '',
  })

  const handleOpenModal = (user = null) => {
    setEditingUser(user)
    setFormError('')
    setFormData(
      user
        ? { ...user, phone: user.phone || '', profilePictureName: user.profilePictureName || '' }
        : { name: '', email: '', phone: '', role: ROLES.SALES_OFFICER, password: '', profilePictureName: '' },
    )
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
    setFormError('')
  }

  const normalizeApiUser = (user) => ({
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.is_active ? 'active' : 'inactive',
    createdAt: user.created_at,
  })

  useEffect(() => {
    let isMounted = true

    async function loadUsers() {
      setIsLoadingUsers(true)
      setListError('')

      const result = await listUsers()

      if (!isMounted) return

      setIsLoadingUsers(false)

      if (!result.success) {
        setListError(result.error)
        return
      }

      setUsers((result.users || []).map(normalizeApiUser))
    }

    loadUsers()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u))
      handleCloseModal()
      return
    }

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

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-neutral-100 bg-linear-to-br from-white via-white to-[#eef6eb] p-5 shadow-(--shadow-card)">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary-50 text-primary-700 ring-1 ring-primary-100">
              <UsersRound className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Staff</h1>
              <p className="mt-1 text-sm text-neutral-500">Manage users and assign roles</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="size-4" />
            Add Staff
          </Button>
        </div>
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search staff"
                className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="flex flex-wrap gap-2">
            {staffFilterTabs.map((tab) => {
              const isActive = activeRoleFilter === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveRoleFilter(tab.value)}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-[0_8px_18px_-10px_rgb(6_59_0/0.85)]'
                      : 'border border-neutral-100 bg-white text-neutral-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
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
                  setIsLoadingUsers(false)

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
                <tr className="border-b border-neutral-100 bg-neutral-50/80">
                  <th className="whitespace-nowrap px-5 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">User</th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Email</th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Role</th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {user.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900">{user.name}</span>
                          {user.phone && <p className="mt-0.5 text-xs text-neutral-400">{user.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(user)}
                          aria-label={`Edit ${user.name}`}
                          className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        >
                          <Edit className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user.id)}
                          aria-label={`Delete ${user.name}`}
                          className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
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

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit Staff Member' : 'Add Staff Member'}
        className="max-w-2xl overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-primary-100 bg-linear-to-br from-white to-[#eef6eb] p-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-primary-100 transition-all hover:-translate-y-0.5 hover:ring-primary-200 hover:shadow-(--shadow-card)">
                <Camera className="size-6" aria-hidden="true" />
                <span className="text-[0.65rem] font-semibold">Upload</span>
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
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, profilePictureName: '' })}
                  aria-label="Remove profile picture"
                  className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-white text-neutral-400 shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-red-600"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">Profile picture</p>
              <p className="mt-1 truncate text-xs text-neutral-500">
                {formData.profilePictureName || 'Upload an optional staff profile image.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            {!editingUser && (
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            )}
          </div>

          <div>
            <Select
              label="Role"
              options={staffRoleSelectOptions}
              placeholder="Select role"
              name="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
          </div>

          {formError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" loading={isSaving}>{editingUser ? 'Update User' : 'Add User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
