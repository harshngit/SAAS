import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { getRolesCatalog } from '../../api/roles'

const workspaceOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'accounts', label: 'Accounts' },
]

const dataScopeOptions = [
  { value: 'own', label: 'Own records only' },
  { value: 'all', label: 'All organization records' },
]

// The "products" module also gates the Categories screen, so the matrix row is relabeled
// to make that scope clear without needing a separate backend module.
const moduleLabelOverrides = {
  products: 'Product & Categories',
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

  const isRowFullyChecked = (moduleKey) =>
    catalogActions.length > 0 && catalogActions.every((action) => matrix[moduleKey]?.[action.key])

  const isColumnFullyChecked = (actionKey) =>
    catalogModules.length > 0 && catalogModules.every((module) => matrix[module.key]?.[actionKey])

  const toggleAction = (moduleKey, actionKey) => {
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
        actionsMap[action.key] = nextValue
        return actionsMap
      }, {}),
    }))
  }

  const toggleColumn = (actionKey) => {
    const nextValue = !isColumnFullyChecked(actionKey)
    setMatrix((current) => {
      const next = { ...current }
      catalogModules.forEach((module) => {
        next[module.key] = { ...next[module.key], [actionKey]: nextValue }
      })
      return next
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setNameError('')

    if (!name.trim()) {
      setNameError('Enter a role name.')
      return
    }

    const permissions = catalogModules.reduce((result, module) => {
      const moduleActions = matrix[module.key] || {}
      const hasAnyAction = catalogActions.some((action) => moduleActions[action.key])

      if (hasAnyAction) {
        result[module.key] = catalogActions.reduce((actionsMap, action) => {
          actionsMap[action.key] = Boolean(moduleActions[action.key])
          return actionsMap
        }, {})
      }

      return result
    }, {})

    onSave({ name: name.trim(), workspace, description: description.trim(), dataScope, permissions })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Role Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError || formError}
          required
        />
        <Select
          label="Workspace"
          options={workspaceOptions}
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
        />
        <Select
          label="Data Scope"
          options={dataScopeOptions}
          value={dataScope}
          onChange={(event) => setDataScope(event.target.value)}
        />
        <Input
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional"
        />
      </div>

      {isCatalogLoading ? (
        <LoadingSpinner label="Loading permission catalog..." />
      ) : catalogError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {catalogError}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-100">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                <th className="sticky left-0 z-10 bg-neutral-50 px-4 py-3">Module</th>
                <th className="px-3 py-3 text-center">All</th>
                {catalogActions.map((action) => (
                  <th key={action.key} className="px-3 py-3 text-center">
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
              {catalogModules.map((module) => {
                const moduleLabel = moduleLabelOverrides[module.key] || module.label

                return (
                <tr key={module.key} className="border-b border-neutral-50 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-neutral-900">
                    {moduleLabel}
                  </td>
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
                      <input
                        type="checkbox"
                        checked={Boolean(matrix[module.key]?.[action.key])}
                        onChange={() => toggleAction(module.key, action.key)}
                        aria-label={`${action.label} - ${moduleLabel}`}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  ))}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={isCatalogLoading || Boolean(catalogError)}>
          {isEditing ? 'Save Changes' : 'Create Role'}
        </Button>
      </div>
    </form>
  )
}
