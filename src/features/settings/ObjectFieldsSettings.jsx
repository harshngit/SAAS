import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  FileText,
  HelpCircle,
  Info,
  Lock,
  Package,
  PackagePlus,
  Receipt,
  ShoppingCart,
  Store,
  Truck,
  UserPlus,
  UsersRound,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { getFieldSettings, updateFieldSettings } from '../../api/settings'
import { useFieldSettings } from '../../fieldSettings/FieldSettingsContext'

// All 9 canonical modules the backend's catalog serves today (GET /organizations/settings/fields
// -> available_fields keys). Renders whatever modules the backend actually returns, in this
// fixed display order when present, plus anything unrecognized falls back to a generic icon/label
// rather than being silently dropped - never a hardcoded assumption of which modules exist.
const MODULE_ORDER = ['company', 'lead', 'customer', 'quotation', 'product', 'sales_order', 'supplier', 'purchase', 'expense']

const moduleMeta = {
  company: { label: 'Company', icon: Store },
  lead: { label: 'Lead', icon: UserPlus },
  customer: { label: 'Customer', icon: UsersRound },
  quotation: { label: 'Quotation', icon: FileText },
  product: { label: 'Product', icon: Package },
  sales_order: { label: 'Sales Order', icon: ShoppingCart },
  supplier: { label: 'Supplier', icon: Truck },
  purchase: { label: 'Purchase', icon: PackagePlus },
  expense: { label: 'Expense', icon: Receipt },
}

function humanizeFieldKey(key) {
  const leaf = key.includes('.') ? key.split('.').pop() : key
  return leaf
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function LockedFieldRow({ label, condition }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <Lock className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className="truncate" title={label}>{label}</span>
      </div>
      {condition && <p className="mt-1 pl-5.5 text-xs text-neutral-400">{condition}</p>}
    </div>
  )
}

function FieldToggle({ label, checked, disabled, disabledReason, onChange }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed border-neutral-100 bg-neutral-50/40 opacity-60'
          : 'cursor-pointer border-neutral-100 bg-neutral-50/60 hover:border-neutral-200 hover:bg-neutral-50'
      }`}
      title={disabled ? disabledReason : undefined}
    >
      <span className="truncate text-sm font-medium text-neutral-800" title={label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
          checked && !disabled ? 'bg-primary-600' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`inline-block size-3.5 transform rounded-full bg-surface shadow transition-transform ${
            checked && !disabled ? 'translate-x-4.5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

export default function ObjectFieldsSettings() {
  const { refreshFieldSettings } = useFieldSettings()
  const { showToast } = useToast()
  // PUT /organizations/settings/fields is admin-only on the backend regardless of the
  // permissions matrix (GET is open to every org member) - fullAccess is this app's existing
  // "is actually Admin" signal, same one used to gate PATCH /users/{id} photo edits elsewhere.
  const { fullAccess: canSaveFieldSettings } = usePermission()
  const [availableFields, setAvailableFields] = useState({})
  const [fieldSettings, setFieldSettings] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeModule, setActiveModule] = useState(null)

  const loadSettings = () => {
    setIsLoading(true)
    setLoadError('')

    getFieldSettings().then((result) => {
      if (!result.success) {
        setLoadError(result.error)
        setIsLoading(false)
        return
      }

      setAvailableFields(result.availableFields)
      setFieldSettings(result.fieldSettings)
      setActiveModule((current) => current || Object.keys(result.availableFields)[0] || null)
      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // Backend module keys first, in the fixed display order, then anything else it ever returns
  // that isn't in that list - never silently dropped.
  const moduleKeys = useMemo(() => {
    const keys = Object.keys(availableFields)
    const known = MODULE_ORDER.filter((key) => keys.includes(key))
    const unknown = keys.filter((key) => !MODULE_ORDER.includes(key))
    return [...known, ...unknown]
  }, [availableFields])

  const currentModuleFields = activeModule ? availableFields[activeModule] : null
  const currentModuleSettings = (activeModule && fieldSettings[activeModule]) || {}

  // `fields` already carries every field's classification/label/condition/depends_on in one
  // list - group it by classification here instead of relying on the separate
  // mandatory/conditional/non_configurable/optional key-arrays for rendering, so labels and
  // depends_on are always available together with no second lookup.
  const fieldsByClassification = useMemo(() => {
    const list = Array.isArray(currentModuleFields?.fields) ? currentModuleFields.fields : []
    return {
      mandatory: list.filter((f) => f.classification === 'mandatory'),
      conditional: list.filter((f) => f.classification === 'conditional'),
      non_configurable: list.filter((f) => f.classification === 'non_configurable'),
      optional: list.filter((f) => f.classification === 'optional'),
    }
  }, [currentModuleFields])

  const fieldsByKey = useMemo(() => {
    const list = Array.isArray(currentModuleFields?.fields) ? currentModuleFields.fields : []
    return Object.fromEntries(list.map((f) => [f.key, f]))
  }, [currentModuleFields])

  // Draft-state effective visibility, for the settings screen's own live preview only (never
  // persisted separately - see toggleField below). A locked field is always visible. An optional
  // field whose depends_on parent is currently (in the unsaved draft) not visible is shown as
  // forced OFF here, without touching its own stored toggle value - turning the parent back on
  // reveals the child's real saved/default preference again, exactly per the backend's own
  // dependency resolution.
  const isDraftVisible = (fieldKey, visited = new Set()) => {
    if (visited.has(fieldKey)) return true // guard against any unexpected cycle
    visited.add(fieldKey)
    const field = fieldsByKey[fieldKey]
    if (!field) return true
    if (field.classification !== 'optional') return true
    const ownValue = currentModuleSettings[fieldKey] !== false
    if (!field.depends_on) return ownValue
    return ownValue && isDraftVisible(field.depends_on, visited)
  }

  const toggleField = (fieldKey, checked) => {
    setFieldSettings((current) => ({
      ...current,
      [activeModule]: {
        ...current[activeModule],
        [fieldKey]: checked,
      },
    }))
  }

  const handleReset = () => {
    loadSettings()
    showToast({ title: 'Reverted', message: 'Unsaved changes discarded.' })
  }

  const handleSave = async () => {
    setIsSaving(true)

    const result = await updateFieldSettings(fieldSettings)

    if (!result.success) {
      showToast({ title: 'Save failed', message: result.error, variant: 'error' })
      setIsSaving(false)
      return
    }

    setFieldSettings(result.fieldSettings)
    await refreshFieldSettings()
    setIsSaving(false)
    showToast({ title: 'Field settings saved', message: 'Object field visibility has been updated.' })
  }

  if (isLoading) {
    return <LoadingSpinner variant="settings" label="Loading field settings..." />
  }

  if (loadError) {
    return <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
  }

  return (
    <div className="space-y-4 pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Object Field Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Choose which optional fields appear on each form across your CRM.</p>
        </div>
        {canSaveFieldSettings && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button type="button" onClick={handleSave} loading={isSaving}>
              <Save className="size-4" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-t-xl border border-neutral-100 bg-surface">
        <div className="flex min-w-max">
          {moduleKeys.map((moduleKey) => {
            const meta = moduleMeta[moduleKey] || { label: humanizeFieldKey(moduleKey), icon: Boxes }
            const Icon = meta.icon
            const isActive = moduleKey === activeModule

            return (
              <button
                key={moduleKey}
                type="button"
                onClick={() => setActiveModule(moduleKey)}
                className={`flex min-w-36 items-center justify-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-50/30 text-primary-700'
                    : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                }`}
              >
                <Icon className="size-4" />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
        <Info className="size-4 shrink-0" />
        <span>Mandatory and conditional fields always show on the form and can&apos;t be hidden. Non-configurable fields are always available to the workflow.</span>
      </div>

      {currentModuleFields && (
        <div className="space-y-4">
          {fieldsByClassification.mandatory.length > 0 && (
            <div className="rounded-xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-card)">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Mandatory fields · always visible
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {fieldsByClassification.mandatory.map((field) => (
                  <LockedFieldRow key={field.key} label={field.label || humanizeFieldKey(field.key)} />
                ))}
              </div>
            </div>
          )}

          {fieldsByClassification.conditional.length > 0 && (
            <div className="rounded-xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-card)">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Conditional fields · always visible
                <HelpCircle className="size-3.5 text-neutral-300" aria-hidden="true" />
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {fieldsByClassification.conditional.map((field) => (
                  <LockedFieldRow key={field.key} label={field.label || humanizeFieldKey(field.key)} condition={field.condition} />
                ))}
              </div>
            </div>
          )}

          {fieldsByClassification.non_configurable.length > 0 && (
            <div className="rounded-xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-card)">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <SettingsIcon className="size-3.5 text-neutral-300" aria-hidden="true" />
                Non-configurable · always available to the workflow
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {fieldsByClassification.non_configurable.map((field) => (
                  <LockedFieldRow key={field.key} label={field.label || humanizeFieldKey(field.key)} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-card)">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Optional fields</p>
            {fieldsByClassification.optional.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {fieldsByClassification.optional.map((field) => {
                  const parentField = field.depends_on ? fieldsByKey[field.depends_on] : null
                  const parentVisible = field.depends_on ? isDraftVisible(field.depends_on) : true
                  const disabled = Boolean(field.depends_on) && !parentVisible
                  return (
                    <FieldToggle
                      key={field.key}
                      label={field.label || humanizeFieldKey(field.key)}
                      checked={isDraftVisible(field.key)}
                      disabled={disabled}
                      disabledReason={
                        disabled ? `Hidden while ${parentField?.label || humanizeFieldKey(field.depends_on)} is hidden` : undefined
                      }
                      onChange={(checked) => toggleField(field.key, checked)}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-neutral-400">No configurable optional fields for this module.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
