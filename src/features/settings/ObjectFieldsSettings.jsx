import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Info,
  Lock,
  Package,
  PackagePlus,
  Receipt,
  RotateCcw,
  Save,
  ShoppingCart,
  Store,
  UsersRound,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { getFieldSettings, updateFieldSettings } from '../../api/settings'

const moduleMeta = {
  company: { label: 'Company', icon: Store },
  customer: { label: 'Customer', icon: UsersRound },
  product: { label: 'Product', icon: Package },
  sales: { label: 'Sales', icon: ShoppingCart },
  purchase: { label: 'Purchase', icon: PackagePlus },
  expenses: { label: 'Expenses', icon: Receipt },
}

function humanizeFieldKey(key) {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function FieldToggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3.5 py-2.5 transition-colors hover:border-neutral-200 hover:bg-neutral-50">
      <span className="truncate text-sm font-medium text-neutral-800" title={label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

export default function ObjectFieldsSettings() {
  const { showToast } = useToast()
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
      setActiveModule(Object.keys(result.availableFields)[0] || null)
      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const moduleKeys = useMemo(() => Object.keys(availableFields), [availableFields])
  const currentModuleFields = activeModule ? availableFields[activeModule] : null
  const currentModuleSettings = (activeModule && fieldSettings[activeModule]) || {}

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
    setIsSaving(false)
    showToast({ title: 'Field settings saved', message: 'Object field visibility has been updated.' })
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading field settings..." />
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
      </div>

      <div className="overflow-x-auto rounded-t-xl border border-neutral-100 bg-white">
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
        <span>Mandatory fields always show on the form and can't be hidden.</span>
      </div>

      {currentModuleFields && (
        <div className="space-y-4">
          {(currentModuleFields.mandatory || []).length > 0 && (
            <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Mandatory fields · always visible
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {currentModuleFields.mandatory.map((fieldKey) => (
                  <div
                    key={fieldKey}
                    className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2 text-sm text-neutral-600"
                    title={humanizeFieldKey(fieldKey)}
                  >
                    <Lock className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="truncate">{humanizeFieldKey(fieldKey)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Optional fields</p>
            {(currentModuleFields.optional || []).length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {currentModuleFields.optional.map((fieldKey) => (
                  <FieldToggle
                    key={fieldKey}
                    label={humanizeFieldKey(fieldKey)}
                    checked={currentModuleSettings[fieldKey] !== false}
                    onChange={(checked) => toggleField(fieldKey, checked)}
                  />
                ))}
              </div>
            ) : (currentModuleFields.mandatory || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">No configurable fields for this module.</p>
            ) : (
              <p className="py-4 text-center text-sm text-neutral-400">No optional fields for this module.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
