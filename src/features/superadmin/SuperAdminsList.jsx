import { useEffect, useState } from 'react'
import { Edit, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { createSuperAdmin, deleteSuperAdmin, listSuperAdmins, updateSuperAdmin } from '../../api/superadmin'
import { useAuthStore } from '../../store/authStore'

function formatDateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const normalizeSuperAdmin = (admin) => ({
  id: admin.id,
  name: admin.name || admin.display_name || '',
  email: admin.email || '',
  phone: admin.phone || '',
  isActive: admin.is_active !== false,
  createdAt: admin.created_at || '',
})

const emptyForm = { name: '', email: '', phone: '', password: '', isActive: true }

function SuperAdminForm({ admin, isSelf, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(admin ? { ...emptyForm, ...admin, password: '' } : emptyForm)
    setErrors({})
  }, [admin])

  const validate = () => {
    const nextErrors = {}

    if (!formData.name.trim()) nextErrors.name = 'Enter a name.'
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email.'
    if (!admin && formData.password.trim().length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (admin && formData.password && formData.password.trim().length < 8) nextErrors.password = 'Password must be at least 8 characters.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}

      <Input
        label="Name"
        placeholder="Enter full name"
        value={formData.name}
        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
        error={errors.name}
        required
      />
      <Input
        label="Email"
        type="email"
        placeholder="Enter email address"
        value={formData.email}
        onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
        error={errors.email}
        required
      />
      <Input
        label="Phone (optional)"
        value={formData.phone}
        onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
      />
      <Input
        label={admin ? 'New Password (leave blank to keep current)' : 'Password'}
        type="password"
        placeholder={admin ? 'Leave blank to keep unchanged' : 'At least 8 characters'}
        value={formData.password}
        onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
        error={errors.password}
        required={!admin}
      />
      {admin && (
        <label
          className={`flex min-h-11 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium ${
            isSelf ? 'cursor-not-allowed text-neutral-400' : 'text-neutral-700'
          }`}
        >
          <input
            type="checkbox"
            checked={formData.isActive}
            disabled={isSelf}
            onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
          />
          Active
          {isSelf && <span className="ml-auto text-xs text-neutral-400">You can't deactivate your own account</span>}
        </label>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {admin ? 'Save Changes' : 'Create Superadmin'}
        </Button>
      </div>
    </form>
  )
}

export default function SuperAdminsList() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const [admins, setAdmins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadAdmins = async () => {
    setIsLoading(true)
    setListError('')

    const result = await listSuperAdmins()

    if (!result.success) {
      setAdmins([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setAdmins(result.admins.map(normalizeSuperAdmin))
    setIsLoading(false)
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  const openForm = (admin = null) => {
    setEditingAdmin(admin)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingAdmin(null)
    setFormError('')
  }

  const handleSaveAdmin = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = editingAdmin
      ? await updateSuperAdmin(editingAdmin.id, formData)
      : await createSuperAdmin(formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    const normalized = normalizeSuperAdmin({ ...formData, ...result.admin, id: result.admin?.id || editingAdmin?.id })

    setAdmins((current) =>
      editingAdmin
        ? current.map((admin) => (admin.id === editingAdmin.id ? normalized : admin))
        : [normalized, ...current],
    )
    setIsSaving(false)
    closeForm()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteSuperAdmin(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setAdmins((current) => current.filter((admin) => admin.id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Superadmins</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage platform-level Superadmin accounts.</p>
        </div>
        <Button type="button" onClick={() => openForm()}>
          <Plus className="size-4" aria-hidden="true" />
          Add Superadmin
        </Button>
      </div>

      <Card title="Superadmin Accounts">
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Name',
              sortable: true,
              render: (row) => (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <span className="font-medium text-neutral-900">{row.name}</span>
                  {row.id === currentUser?.id && <Badge variant="neutral">You</Badge>}
                </div>
              ),
            },
            { key: 'email', header: 'Email', sortable: true },
            { key: 'phone', header: 'Phone', sortable: true, render: (row) => row.phone || '—' },
            {
              key: 'isActive',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={row.isActive ? 'success' : 'neutral'} dot>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
            },
            { key: 'createdAt', header: 'Created', sortable: true, render: (row) => formatDateLabel(row.createdAt) },
          ]}
          data={admins}
          searchKeys={['name', 'email', 'phone']}
          searchPlaceholder="Search superadmins..."
          loading={isLoading}
          emptyTitle={listError ? 'Unable to load superadmins' : 'No superadmins found'}
          emptyDescription={listError || undefined}
          actions={(row) => {
            const isSelf = row.id === currentUser?.id
            const items = [{ label: 'Edit', icon: Edit, onClick: () => openForm(row) }]

            if (!isSelf && admins.length > 1) {
              items.push({
                label: 'Delete',
                icon: Trash2,
                danger: true,
                onClick: () => setDeleteTarget(row),
              })
            }

            return items
          }}
        />
      </Card>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingAdmin ? 'Edit Superadmin' : 'Add Superadmin'} className="max-w-lg">
        <SuperAdminForm
          admin={editingAdmin}
          isSelf={editingAdmin?.id === currentUser?.id}
          saving={isSaving}
          formError={formError}
          onClose={closeForm}
          onSave={handleSaveAdmin}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Superadmin"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.name || 'this superadmin'}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
