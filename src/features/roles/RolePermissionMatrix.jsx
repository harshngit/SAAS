import { useEffect, useMemo, useState } from 'react'
import { Building2, ShoppingCart, Truck, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getRolesCatalog } from '../../api/roles'

// "Workspace" only picks the user's primary shell / dashboard family - it is NOT a permission
// whitelist. Backend authorization is entirely role.permissions[module][action]. A custom role
// may legitimately hold permissions outside its workspace's common modules (e.g. a
// warehouse-oriented Delivery role needing products:view / inventory:view), so EVERY module
// GET /roles/catalog returns stays grantable - the workspace only decides which modules are
// pre-sorted into "Recommended" vs "Other Available".
const WORKSPACES = [
  { value: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Customers, leads, quotations, sales orders, visits & activities.' },
  { value: 'delivery', label: 'Delivery', icon: Truck, description: 'Assigned deliveries, POD, collection, vehicle stock & returns.' },
  { value: 'accounts', label: 'Finance', icon: Wallet, description: 'Invoices, payments, receivables, expenses & financial reports.' },
]

// Modules normally owned by each workspace - shown under "Recommended for <Workspace>".
// Everything else the catalog returns (incl. modules unknown to the frontend) goes under
// "Other Available Modules" - visible, never auto-enabled, never hidden.
const RECOMMENDED_MODULES = {
  sales: [
    'dashboard', 'customers', 'leads', 'quotations', 'suppliers', 'products', 'inventory',
    'sales_orders', 'sales_returns', 'visits', 'follow_ups', 'attendance', 'leaves',
  ],
  delivery: [
    'dashboard', 'products', 'customers', 'deliveries', 'delivery_collections', 'vehicle_stock',
    'attendance', 'leaves', 'expenses',
  ],
  accounts: [
    'dashboard', 'products', 'inventory', 'purchases', 'grn', 'supplier_invoices', 'accounts_payable',
    'supplier_payments', 'invoices', 'payments', 'payment_receipts', 'delivery_collections',
    'expenses', 'gst', 'reports', 'leaves',
  ],
}

const moduleLabelOverrides = {
  products: 'Product & Categories',
  grn: 'Goods Receipts (GRN)',
  supplier_invoices: 'Supplier Invoices',
  accounts_payable: 'Accounts Payable',
  supplier_payments: 'Supplier Payments',
  delivery_collections: 'Delivery Collections',
}
function moduleLabelFor(moduleKey, fallbackLabel) {
  return moduleLabelOverrides[moduleKey] || fallbackLabel
}

// Record Access -> backend data_scope. The current MVP exposes only own / all; the backend
// still understands "team" (see §10) but it is not offered for new/edited roles here.
const RECORD_ACCESS_OPTIONS = [
  { value: 'own', label: 'Own Records' },
  { value: 'all', label: 'All Records' },
]
// A role already saved with data_scope="team" keeps that value (read-only) until an Admin
// explicitly picks Own or All - never silently rewritten just by opening the role.
const LEGACY_TEAM_OPTION = { value: 'team', label: 'Team Records (Legacy)' }

// Sensible starting point per workspace for NEW roles only (Admin can change it before saving).
const WORKSPACE_DEFAULT_SCOPE = { sales: 'own', delivery: 'own', accounts: 'all' }

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
  // New role: default from the workspace. Existing role: always its real backend value.
  const [dataScope, setDataScope] = useState(
    role?.data_scope || WORKSPACE_DEFAULT_SCOPE[role?.workspace || 'sales'] || 'own',
  )
  const [dataScopeTouched, setDataScopeTouched] = useState(false)
  const isLegacyTeamScope = role?.data_scope === 'team' && dataScope === 'team'
  const recordAccessOptions = isLegacyTeamScope ? [...RECORD_ACCESS_OPTIONS, LEGACY_TEAM_OPTION] : RECORD_ACCESS_OPTIONS
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

  const isLegacyWorkspace = workspace && !WORKSPACES.some((entry) => entry.value === workspace)
  const workspaceLabel = WORKSPACES.find((entry) => entry.value === workspace)?.label || workspace

  // Every catalog module is grantable - split into recommended vs other by workspace.
  const { recommendedModules, otherModules } = useMemo(() => {
    const recommendedKeys = RECOMMENDED_MODULES[workspace] || []
    const recommended = []
    const other = []
    catalogModules.forEach((module) => {
      ;(recommendedKeys.includes(module.key) ? recommended : other).push(module)
    })
    // Keep the recommended list in the curated order, others in catalog order.
    recommended.sort((a, b) => recommendedKeys.indexOf(a.key) - recommendedKeys.indexOf(b.key))
    return { recommendedModules: recommended, otherModules: other }
  }, [catalogModules, workspace])

  const isRowFullyChecked = (moduleKey) =>
    catalogActions.length > 0 && catalogActions.every((action) => matrix[moduleKey]?.[action.key])

  const isColumnFullyChecked = (actionKey) =>
    catalogModules.length > 0 && catalogModules.every((module) => matrix[module.key]?.[actionKey])

  const toggleAction = (moduleKey, actionKey) => {
    setMatrix((current) => ({
      ...current,
      [moduleKey]: { ...current[moduleKey], [actionKey]: !current[moduleKey]?.[actionKey] },
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

  const enabledModuleCount = useMemo(
    () => catalogModules.filter((module) => catalogActions.some((action) => matrix[module.key]?.[action.key])).length,
    [catalogModules, catalogActions, matrix],
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    setNameError('')

    if (!name.trim()) {
      setNameError('Enter a role name.')
      return
    }

    // Persist every module that has at least one action checked - regardless of workspace.
    const permissions = catalogModules.reduce((result, module) => {
      const moduleActions = matrix[module.key] || {}
      if (catalogActions.some((action) => moduleActions[action.key])) {
        result[module.key] = catalogActions.reduce((actionsMap, action) => {
          actionsMap[action.key] = Boolean(moduleActions[action.key])
          return actionsMap
        }, {})
      }
      return result
    }, {})

    onSave({ name: name.trim(), workspace, description: description.trim(), dataScope, permissions })
  }

  const renderModuleRow = (module) => {
    const moduleLabel = moduleLabelFor(module.key, module.label)
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
  }

  const groupHeaderRow = (label) => (
    <tr className="bg-neutral-50/80">
      <td
        colSpan={catalogActions.length + 2}
        className="sticky left-0 px-4 py-2 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400"
      >
        {label}
      </td>
    </tr>
  )

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

      <div>
        <p className="text-sm font-semibold text-neutral-900">
          Workspace <span className="text-red-500">*</span>
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">Choose the main workspace for this role.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {WORKSPACES.map((entry) => {
            const Icon = entry.icon
            const isSelected = workspace === entry.value
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => {
                  setWorkspace(entry.value)
                  // New role, untouched: follow the workspace's sensible default.
                  if (!isEditing && !dataScopeTouched) setDataScope(WORKSPACE_DEFAULT_SCOPE[entry.value] || 'own')
                }}
                className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors ${
                  isSelected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-neutral-200 bg-white hover:border-primary-300'
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
            This role uses the &ldquo;{workspace}&rdquo; workspace, managed at organization level. Pick a family above only if you want to move it.
          </p>
        )}
      </div>

      <div className="max-w-md">
        <Select
          label="Record Access"
          options={recordAccessOptions}
          value={dataScope}
          onChange={(event) => {
            setDataScope(event.target.value)
            setDataScopeTouched(true)
          }}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {isLegacyTeamScope
            ? 'Team-based access is not used in the current MVP. Choose Own or All Records to update it.'
            : 'Choose how much data this role can access.'}
        </p>
      </div>

      <Input
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Optional"
        className="max-w-md"
      />

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-900">Permissions</p>
          {!isCatalogLoading && !catalogError && (
            <p className="text-xs text-neutral-400">{enabledModuleCount} of {catalogModules.length} modules enabled</p>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Modules commonly used by the <span className="font-medium text-neutral-700">{workspaceLabel}</span> workspace are listed first; every other
          catalog module stays available under &ldquo;Other Available Modules&rdquo;.
        </p>

        {isCatalogLoading ? (
          <div className="mt-3">
            <LoadingSpinner label="Loading permission catalog..." />
          </div>
        ) : catalogError ? (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{catalogError}</div>
        ) : catalogModules.length === 0 ? (
          <p className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
            The permission catalog is empty.
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
                {recommendedModules.length > 0 && groupHeaderRow(`Recommended for ${workspaceLabel}`)}
                {recommendedModules.map(renderModuleRow)}
                {otherModules.length > 0 && groupHeaderRow('Other Available Modules')}
                {otherModules.map(renderModuleRow)}
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
    </form>
  )
}
