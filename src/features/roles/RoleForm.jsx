import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { createRole, getRole, updateRole } from '../../api/roles'
import RolePermissionMatrix from './RolePermissionMatrix'

export default function RoleForm() {
  const { role_id: roleId } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(roleId)
  const [role, setRole] = useState(null)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!isEditing) return

    let isMounted = true

    async function loadRole() {
      setIsLoading(true)
      setLoadError('')

      const result = await getRole(roleId)

      if (!isMounted) return

      setIsLoading(false)

      if (!result.success) {
        setLoadError(result.error)
        return
      }

      setRole(result.role)
    }

    loadRole()

    return () => {
      isMounted = false
    }
  }, [roleId, isEditing])

  const handleSave = async ({ name, permissions }) => {
    setIsSaving(true)
    setFormError('')

    const result = isEditing
      ? await updateRole(roleId, { name, permissions })
      : await createRole({ name, permissions })

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    navigate('/admin/roles')
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading role details..." />
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to="/admin/roles" className="inline-flex items-center text-sm font-medium text-primary-700">
          Back to Roles
        </Link>
        <Card>
          <p className="text-sm text-red-600">{loadError}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full flex-col rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)">
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">{isEditing ? 'Edit role' : 'Create a new role'}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Configure module-level permissions for staff assigned to this role.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/roles')}>
          Back to Roles
        </Button>
      </div>

      <div className="mt-6 flex-1">
        <RolePermissionMatrix
          role={role}
          saving={isSaving}
          formError={formError}
          onClose={() => navigate('/admin/roles')}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
