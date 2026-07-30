import { useEffect, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { roleLabels } from '../../auth/roles'
import { changeUserRole, getUser, listRoles, updateUser } from '../../api/users'
import { getSystemRoleFromRoleName, normalizeApiUser, staffRoleOptions } from './userRoleUtils'

const staffRoleSelectOptions = staffRoleOptions.map((role) => ({
  value: role,
  label: roleLabels[role],
}))

export default function UserEdit() {
  const { user_id: userId } = useParams()
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    role: '',
    role_id: '',
    profilePictureName: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [error, setError] = useState('')
  const roleChanged = Boolean(formData.role_id && formData.role_id !== user?.role_id)
  const basicInformationChanged = Boolean(user) && (
    formData.name !== (user.name || '') ||
    formData.email !== (user.email || '') ||
    formData.username !== (user.username || '') ||
    formData.phone !== (user.phone || '')
  )

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

  useEffect(() => {
    let isMounted = true

    async function loadEditData() {
      setIsLoading(true)
      setError('')

      const [userResult, rolesResult] = await Promise.all([getUser(userId), listRoles()])

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
      setFormData({
        name: nextUser.name || '',
        email: nextUser.email || '',
        username: nextUser.username || '',
        phone: nextUser.phone || '',
        role: nextUser.role || '',
        role_id: nextUser.role_id || '',
        profilePictureName: '',
      })
    }

    loadEditData()

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!basicInformationChanged) {
      return
    }

    setIsSaving(true)

    const updateResult = await updateUser(userId, formData)

    if (!updateResult.success) {
      setIsSaving(false)
      setError(updateResult.error)
      return
    }

    setIsSaving(false)
    navigate('/admin/users')
  }

  const handleSaveRole = async () => {
    setError('')

    if (!formData.role_id) {
      setError('Unable to change role because the selected role is missing a backend role ID. Please reload roles and try again.')
      return
    }

    setIsSavingRole(true)
    const roleResult = await changeUserRole(userId, formData.role_id)
    setIsSavingRole(false)

    if (!roleResult.success) {
      setError(roleResult.error)
      return
    }

    const updatedUser = normalizeApiUser(roleResult.user)
    setUser(updatedUser)
    setFormData((currentFormData) => ({
      ...currentFormData,
      role: updatedUser.role || currentFormData.role,
      role_id: updatedUser.role_id || currentFormData.role_id,
    }))
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
      className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Edit user profile</p>
          <p className="mt-1 text-sm text-neutral-500">Update contact details, profile image, and workspace role.</p>
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
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                required
              />
              <Input
                label="Username"
                value={formData.username}
                onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
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
              <div className="flex w-[50%] items-end gap-2">
                <Select
                  label="Role"
                  options={effectiveRoleSelectOptions}
                  placeholder="Select role"
                  className="min-w-0 flex-1"
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
                {roleChanged && (
                  <Button type="button" size="md" onClick={handleSaveRole} loading={isSavingRole}>
                    Save
                  </Button>
                )}
              </div>
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

      {error && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => navigate(`/admin/users/${userId}`)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSaving} disabled={!basicInformationChanged}>
          Update User
        </Button>
      </div>
    </form>
  )
}
