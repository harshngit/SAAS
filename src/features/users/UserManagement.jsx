import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, User } from 'lucide-react'
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
  })

  const handleOpenModal = (user = null) => {
    setEditingUser(user)
    setFormError('')
    setFormData(
      user
        ? { ...user, phone: user.phone || '' }
        : { name: '', email: '', phone: '', role: ROLES.SALES_OFFICER, password: '' },
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

  const filteredUsers =
    activeRoleFilter === 'all'
      ? users
      : users.filter((user) => user.role === activeRoleFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff</h1>
          <p className="text-sm text-neutral-500">Manage users and assign roles</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {staffFilterTabs.map((tab) => {
              const isActive = activeRoleFilter === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveRoleFilter(tab.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-[0_8px_18px_-10px_rgb(6_59_0/0.85)]'
                      : 'border border-neutral-200 bg-white text-neutral-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="size-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <Card>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                          <User className="size-4" />
                        </div>
                        <span className="font-medium text-neutral-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-neutral-600">{user.email}</td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        >
                          <Edit className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
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
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingUser ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Select
            label="Role"
            options={staffRoleSelectOptions}
            placeholder="Select role"
            name="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" loading={isSaving}>{editingUser ? 'Update User' : 'Add User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
