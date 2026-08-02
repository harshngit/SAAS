import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Plus, RotateCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { deleteRole, getRolesCatalog, listRoles } from '../../api/roles'

function getModuleSummary(role, catalogModuleCount, catalogActionKeys) {
  const permissions = role.permissions || {}
  const moduleKeys = Object.keys(permissions)
  const moduleCount = moduleKeys.length

  if (moduleCount === 0) {
    return 'No access configured'
  }

  const isFullAccess =
    catalogModuleCount > 0 &&
    moduleCount === catalogModuleCount &&
    moduleKeys.every((moduleKey) =>
      catalogActionKeys.every((actionKey) => Boolean(permissions[moduleKey]?.[actionKey])),
    )

  return `${moduleCount} module${moduleCount === 1 ? '' : 's'} • ${isFullAccess ? 'Full access' : 'Limited'}`
}

export default function RolesList() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [catalogModuleCount, setCatalogModuleCount] = useState(0)
  const [catalogActionKeys, setCatalogActionKeys] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadRoles = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const [rolesResult, catalogResult] = await Promise.all([listRoles(), getRolesCatalog()])

    setIsLoading(false)

    if (catalogResult.success) {
      setCatalogModuleCount(catalogResult.modules.length)
      setCatalogActionKeys(catalogResult.actions.map((action) => action.key))
    }

    if (!rolesResult.success) {
      setListError(rolesResult.error)
      return
    }

    setRoles(rolesResult.roles || [])
  }, [])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const filteredRoles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return roles
    return roles.filter((role) => (role.name || '').toLowerCase().includes(normalizedSearch))
  }, [roles, searchTerm])

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteRole(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setRoles((current) => current.filter((role) => role.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Roles & Permissions</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Create custom roles and configure module-level access for staff.
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => navigate('/admin/roles/new')}>
              <Plus className="size-4" aria-hidden="true" />
              New Role
            </Button>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex justify-end">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search roles"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadRoles}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading roles..." />
          ) : filteredRoles.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No roles found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Role</th>
                  <th className="whitespace-nowrap px-4 py-3">Access</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr
                    key={role.id}
                    className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <ShieldCheck className="size-4" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-neutral-900">{role.name}</span>
                            {role.is_default && <Badge variant="primary">Default</Badge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {getModuleSummary(role, catalogModuleCount, catalogActionKeys)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        triggerClassName="bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 hover:bg-primary-50 hover:text-primary-700 hover:ring-primary-200"
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => navigate(`/admin/roles/edit/${role.id}`) },
                          ...(role.is_default
                            ? []
                            : [
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  danger: true,
                                  onClick: () => setDeleteTarget(role),
                                },
                              ]),
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
            {filteredRoles.length === 0 ? '0' : `1 to ${filteredRoles.length}`} of {roles.length}
          </span>
          <span>Roles</span>
        </div>
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Role"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.name || 'this role'}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
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
