import { useState } from 'react'
import { Plus, Edit, Trash2, User } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { ROLES, roleLabels } from '../../auth/roles'

const initialUsers = [
  { id: 1, name: 'Amit Sharma', email: 'amit@aquapure.com', role: ROLES.ADMIN, status: 'active' },
  { id: 2, name: 'Priya Patel', email: 'priya@aquapure.com', role: ROLES.SALES_OFFICER, status: 'active' },
  { id: 3, name: 'Rajesh Kumar', email: 'rajesh@aquapure.com', role: ROLES.DELIVERY_PARTNER, status: 'active' },
  { id: 4, name: 'Sneha Desai', email: 'sneha@aquapure.com', role: ROLES.ACCOUNTANT, status: 'active' },
]

export default function UserManagement() {
  const [users, setUsers] = useState(initialUsers)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: ROLES.SALES_OFFICER,
    password: '',
  })

  const handleOpenModal = (user = null) => {
    setEditingUser(user)
    setFormData(user ? { ...user } : { name: '', email: '', role: ROLES.SALES_OFFICER, password: '' })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">User Management</h1>
          <p className="text-sm text-neutral-500">Manage users and assign roles</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="size-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
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
              {users.map((user) => (
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
          {!editingUser && (
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            >
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>{roleLabels[role]}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit">{editingUser ? 'Update User' : 'Add User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
