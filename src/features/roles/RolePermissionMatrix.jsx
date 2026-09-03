import { useEffect, useMemo, useState } from 'react'
import { Building2, ShoppingCart, Truck, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { getRolesCatalog } from '../../api/roles'

// The single "Workspace" concept - the functional family a custom role belongs to. Admin /
// Business Owner is the organization-level owner role and is configured separately - it is
// deliberately NOT a selectable workspace here. "Finance" maps to the backend value `accounts`
// (the existing role.workspace field; no new field is introduced).
const WORKSPACES = [
  { value: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Customers, leads, quotations, sales orders, visits & activities.' },
  { value: 'delivery', label: 'Delivery', icon: Truck, description: 'Assigned deliveries, POD, collection, vehicle stock & returns.' },
  { value: 'accounts', label: 'Finance', icon: Wallet, description: 'Invoices, payments, receivables, expenses & financial reports.' },
]

// Which permission-matrix modules belong to each workspace. Keys not listed anywhere (an
// unrecognised catalog module) stay visible in every workspace so nothing is hidden by
// accident. A workspace value that isn't one of the three (e.g. a legacy `admin` role) shows
// every module.
const WORKSPACE_MODULES = {
  sales: ['dashboard', 'customers', 'leads', 'quotations', 'sales_orders', 'visits', 'follow_ups', 'products', 'suppliers', 'inventory', 'reports'],
  delivery: ['dashboard', 'deliveries', 'vehicle_stock', 'attendance', 'leaves', 'expenses'],
  accounts: ['dashboard', 'invoices', 'payments', 'expenses', 'purchases', 'gst', 'reports'],
}
const MAPPED_MODULE_KEYS = new Set(Object.values(WORKSPACE_MODULES).flat())

// Some actions never make sense for a module inside a given workspace. The matrix renders
// those cells as an inert "—" so an admin can't grant a permission the role should never
// use (e.g. a Delivery role approving its own expense claims). This is a frontend guard
// only - the backend permission catalog and role API are unchanged; the same module
// (`expenses`, `leaves`, `attendance`) is still canonical, just with workspace-appropriate
// actions. Finance keeps the full action set for these modules.
const WORKSPACE_MODULE_ACTION_DENY = {
  delivery: {
    // Delivery Partner self-service: view + create, and cancel-own-pending via delete.
    // `download` is denied because no expenses.download check exists in the app - receipts
    // are viewed with a plain link - so the column would be a meaningless checkbox.
    expenses: ['approve', 'export', 'edit', 'download'],
    leaves: ['approve', 'export', 'edit', 'download'],
    attendance: ['approve', 'export', 'edit', 'delete', 'download'],
  },
}

function actionAllowed(workspace, moduleKey, actionKey) {
  const denied = WORKSPACE_MODULE_ACTION_DENY[workspace]?.[moduleKey]
  return !denied || !denied.includes(actionKey)
}

// The permission key stays canonical (`vehicle_stock`) but under Delivery it gates the whole
// vehicle-operations family (Vehicle Stock + Vehicle Loading + End of Day Return), so the
// matrix row is relabelled there to make the grant's real scope obvious.
const workspaceModuleLabels = {
  delivery: {
    vehicle_stock: 'Vehicle Stock / Loading / Returns',
  },
}
function moduleLabelFor(moduleKey, fallbackLabel, workspace) {
  return workspaceModuleLabels[workspace]?.[moduleKey] || moduleLabelOverrides[moduleKey] || fallbackLabel
}

const DATA_SCOPES = [
  { value: 'own', label: 'Own Records', description: 'Only records assigned to this user.' },
  { value: 'team', label: 'Team Records', description: 'Records assigned to this user and their team.' },
  { value: 'all', label: 'All Workspace Records', description: 'All records available inside the selected workspace.' },
]

// The "products" module also gates the Categories screen, so the matrix row is relabeled
// to make that scope clear without needing a separate backend module.
const moduleLabelOverrides = {
  products: 'Product & Categories',
}

function moduleInWorkspace(moduleKey, workspace) {
  const list = WORKSPACE_MODULES[workspace]
  if (!list) return true // legacy / admin workspace -> show everything
  return list.includes(moduleKey) || !MAPPED_MODULE_KEYS.has(moduleKey)
}

function buildMatrix(permissions, moduleKeys, actionKeys) {
  return moduleKeys.reduce((matrix, moduleKey) => {
    const modulePermissions = permissions?.[moduleKey] || {}
    matrix[moduleKey] = actionKeys.reduce((actionsMap, actionKey) => {
      actionsMap[actionKey] = Boolean(modulePermissions[actionKey])
      return actionsMap
    }, {})
    return matrix
  }, {})
}

export default function RolePermissionMatrix({ role, saving, formError, onClose, onSave }) {
  const isEditing = Boolean(role)
  const [name, setName] = useState(role?.name || '')
  const [nameError, setNameError] = useState('')
  const [workspace, setWorkspace] = useState(role?.workspace || 'sales')
  const [description, setDescription] = useState(role?.description || '')
  const [dataScope, setDataScope] = useState(role?.data_scope || 'own')
  const [catalogModules, setCatalogModules] = useState([])
  const [catalogActions, setCatalogActions] = useState([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [matrix, setMatrix] = useState({})
  const [pendingWorkspace, setPendingWorkspace] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadCatalog() {
      setIsCatalogLoading(true)
      setCatalogError('')

      const result = await getRolesCatalog()

      if (!isMounted) return

      setIsCatalogLoading(false)

      if (!result.success) {
        setCatalogError(result.error)
        return
      }

      const moduleKeys = result.modules.map((module) => module.key)
      const actionKeys = result.actions.map((action) => action.key)

      setCatalogModules(result.modules)
      setCatalogActions(result.actions)
      setMatrix(buildMatrix(role?.permissions, moduleKeys, actionKeys))
    }

    loadCatalog()

    return () => {
      isMounted = false
    }
  }, [role])

  // A legacy role can carry a workspace value that isn't one of the three selectable families
  // (e.g. `admin`). Keep it as a read-only chip so editing it doesn't silently reset it.
  const isLegacyWorkspace = workspace && !WORKSPACES.some((entry) => entry.value === workspace)

  const visibleModules = useMemo(
    () => catalogModules.filter((module) => moduleInWorkspace(module.key, workspace)),
    [catalogModules, workspace],
  )

  const allowedActionsFor = (moduleKey) => catalogActions.filter((action) => actionAllowed(workspace, moduleKey, action.key))

  const isRowFullyChecked = (moduleKey) => {
    const allowed = allowedActionsFor(moduleKey)
    return allowed.length > 0 && allowed.every((action) => matrix[moduleKey]?.[action.key])
  }

  const isColumnFullyChecked = (actionKey) => {
    const applicable = visibleModules.filter((module) => actionAllowed(workspace, module.key, actionKey))
    return applicable.length > 0 && applicable.every((module) => matrix[module.key]?.[actionKey])
  }

  const toggleAction = (moduleKey, actionKey) => {
    if (!actionAllowed(workspace, moduleKey, actionKey)) return
    setMatrix((current) => ({
      ...current,
      [moduleKey]: {
        ...current[moduleKey],
        [actionKey]: !current[moduleKey]?.[actionKey],
      },
    }))
  }

  const toggleRow = (moduleKey) => {
    const nextValue = !isRowFullyChecked(moduleKey)
    setMatrix((current) => ({
      ...current,
      [moduleKey]: catalogActions.reduce((actionsMap, action) => {
        actionsMap[action.key] = actionAllowed(workspace, moduleKey, action.key) ? nextValue : false
        return actionsMap
      }, {}),
    }))
  }

  const toggleColumn = (actionKey) => {
    const nextValue = !isColumnFullyChecked(actionKey)
    setMatrix((current) => {
      const next = { ...current }
      visibleModules.forEach((module) => {
        if (!actionAllowed(workspace, module.key, actionKey)) return
        next[module.key] = { ...next[module.key], [actionKey]: nextValue }
      })
      return next
    })
  }

  const hasPermissionsOutside = (nextWorkspace) =>
    catalogModules.some(
      (module) =>
        !moduleInWorkspace(module.key, nextWorkspace) &&
        catalogActions.some((action) => matrix[module.key]?.[action.key]),
    )

  const requestWorkspaceChange = (nextWorkspace) => {
    if (nextWorkspace === workspace) return
    if (hasPermissionsOutside(nextWorkspace)) {
      setPendingWorkspace(nextWorkspace)
      return
    }
    setWorkspace(nextWorkspace)
  }

  const confirmWorkspaceChange = () => {
    const nextWorkspace = pendingWorkspace
    setMatrix((current) => {
      const next = { ...current }
      catalogModules.forEach((module) => {
        if (!moduleInWorkspace(module.key, nextWorkspace)) next[module.key] = {}
      })
      return next
    })
    setWorkspace(nextWorkspace)
    setPendingWorkspace(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setNameError('')

    if (!name.trim()) {
      setNameError('Enter a role name.')
      return
    }

    // Persist permissions for modules shown in the selected workspace.
    const permissions = visibleModules.reduce((result, module) => {
      const moduleActions = matrix[module.key] || {}
      const hasAnyAction = catalogActions.some(
        (action) => actionAllowed(workspace, module.key, action.key) && moduleActions[action.key],
      )

      if (hasAnyAction) {
        result[module.key] = catalogActions.reduce((actionsMap, action) => {
          actionsMap[action.key] =
            actionAllowed(workspace, module.key, action.key) && Boolean(moduleActions[action.key])
          return actionsMap
        }, {})
      }

      return result
    }, {})

    // A plain edit that did NOT change the workspace keeps any pre-existing permissions for
    // modules that fall outside the current workspace's visible list (nothing silently lost).
    // A workspace CHANGE routes through the confirm dialog, which clears those first.
    if (isEditing && workspace === (role.workspace || 'sales')) {
      Object.entries(role.permissions || {}).forEach(([moduleKey, moduleValue]) => {
        if (!permissions[moduleKey] && !moduleInWorkspace(moduleKey, workspace)) {
          permissions[moduleKey] = moduleValue
        }
      })
    }

    onSave({ name: name.trim(), workspace, description: description.trim(), dataScope, permissions })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Role Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError || formError}
        placeholder="e.g. Sales Manager"
        required
        className="max-w-md"
      />

      {/* Workspace - the most important choice: it decides the module family. */}
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          Workspace <span className="text-red-500">*</span>
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Determines which module family this role belongs to. Admin / Business Owner is the organization owner and is set up separately.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {WORKSPACES.map((entry) => {
            const Icon = entry.icon
            const isSelected = workspace === entry.value
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => requestWorkspaceChange(entry.value)}
                className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-neutral-200 bg-white hover:border-primary-300'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <Icon className={`size-4 ${isSelected ? 'text-primary-700' : 'text-neutral-400'}`} aria-hidden="true" />
                  {entry.label}
                </span>
                <span className="text-xs leading-snug text-neutral-500">{entry.description}</span>
              </button>
            )
          })}
        </div>
        {isLegacyWorkspace && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
            This role uses the “{workspace}” workspace, managed at organization level. Pick a family above only if you want to move it.
          </p>
        )}
      </div>

      {/* Data Scope */}
      <div>
        <p className="text-sm font-semibold text-neutral-900">Data Scope</p>
        <p className="mt-0.5 text-xs text-neutral-500">How much of the workspace a user with this role can see.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DATA_SCOPES.map((scope) => {
            const isSelected = dataScope === scope.value
            return (
              <label
                key={scope.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors ${
                  isSelected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-neutral-200 bg-white hover:border-primary-300'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  <input
                    type="radio"
                    name="dataScope"
                    checked={isSelected}
                    onChange={() => setDataScope(scope.value)}
                    className="size-4 text-primary-600 focus:ring-primary-500"
                  />
                  {scope.label}
                </span>
                <span className="pl-6 text-xs leading-snug text-neutral-500">{scope.description}</span>
              </label>
            )
          })}
        </div>
      </div>

      <Input
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Optional"
        className="max-w-md"
      />

      {/* Permissions */}
      <div>
        <p className="text-sm font-semibold text-neutral-900">Permissions</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Only modules that belong to the <span className="font-medium text-neutral-700">{WORKSPACES.find((entry) => entry.value === workspace)?.label || workspace}</span> workspace are shown.
        </p>

        {isCatalogLoading ? (
          <div className="mt-3">
            <LoadingSpinner label="Loading permission catalog..." />
          </div>
        ) : catalogError ? (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{catalogError}</div>
        ) : visibleModules.length === 0 ? (
          <p className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
            No permission modules for this workspace.
          </p>
        ) : (
          <div className="mt-3 max-h-104 overflow-auto rounded-2xl border border-neutral-100">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="sticky left-0 top-0 z-20 bg-neutral-50 px-4 py-3">Module</th>
                  <th className="sticky top-0 z-10 bg-neutral-50 px-3 py-3 text-center">All</th>
                  {catalogActions.map((action) => (
                    <th key={action.key} className="sticky top-0 z-10 bg-neutral-50 px-3 py-3 text-center">
                      <label className="flex cursor-pointer flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={isColumnFullyChecked(action.key)}
                          onChange={() => toggleColumn(action.key)}
                          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="normal-case tracking-normal text-neutral-500">{action.label}</span>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleModules.map((module) => {
                  const moduleLabel = moduleLabelFor(module.key, module.label, workspace)
                  return (
                    <tr key={module.key} className="border-b border-neutral-50 last:border-b-0">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-neutral-900">{moduleLabel}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRowFullyChecked(module.key)}
                          onChange={() => toggleRow(module.key)}
                          aria-label={`Toggle all actions for ${moduleLabel}`}
                          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      {catalogActions.map((action) => (
                        <td key={action.key} className="px-3 py-3 text-center">
                          {actionAllowed(workspace, module.key, action.key) ? (
                            <input
                              type="checkbox"
                              checked={Boolean(matrix[module.key]?.[action.key])}
                              onChange={() => toggleAction(module.key, action.key)}
                              aria-label={`${action.label} - ${moduleLabel}`}
                              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            />
                          ) : (
                            <span className="text-neutral-300" title={`${action.label} does not apply to ${moduleLabel} in this workspace`} aria-hidden="true">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={isCatalogLoading || Boolean(catalogError)}>
          {isEditing ? 'Save Changes' : 'Create Role'}
        </Button>
      </div>

      <Modal
        isOpen={Boolean(pendingWorkspace)}
        onClose={() => setPendingWorkspace(null)}
        title="Change workspace?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPendingWorkspace(null)}>Keep current</Button>
            <Button type="button" variant="danger" onClick={confirmWorkspaceChange}>Change &amp; reset</Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-neutral-600">
          Changing the workspace to{' '}
          <span className="font-medium text-neutral-900">
            {WORKSPACES.find((entry) => entry.value === pendingWorkspace)?.label || pendingWorkspace}
          </span>{' '}
          will reset permissions that do not belong to the new workspace.
        </p>
      </Modal>
    </form>
  )
}
