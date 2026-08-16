import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Check,
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
        <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-(--shadow-card)">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
              <tr>
                <th className="px-4 py-3">Field Name</th>
                <th className="w-28 px-4 py-3 text-center">Visible</th>
                <th className="w-32 px-4 py-3 text-center">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(currentModuleFields.mandatory || []).map((fieldKey) => (
                <tr key={fieldKey} className="bg-neutral-50/40">
                  <td className="px-4 py-3 text-xs font-semibold text-neutral-800">{humanizeFieldKey(fieldKey)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="grid size-4 place-items-center rounded border border-primary-700 bg-primary-700 text-white mx-auto">
                      <Check className="size-3" />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[0.65rem] font-semibold text-neutral-600">
                      <Lock className="size-3" />
                      Required
                    </span>
                  </td>
                </tr>
              ))}
              {(currentModuleFields.optional || []).map((fieldKey) => {
                const checked = currentModuleSettings[fieldKey] !== false

                return (
                  <tr key={fieldKey} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-3 text-xs font-semibold text-neutral-800">{humanizeFieldKey(fieldKey)}</td>
                    <td className="px-4 py-3 text-center">
                      <label className="inline-flex cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleField(fieldKey, event.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="grid size-4 place-items-center rounded border border-neutral-300 bg-white text-white peer-checked:border-primary-700 peer-checked:bg-primary-700">
                          <Check className="size-3" />
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-400">-</td>
                  </tr>
                )
              })}
              {(currentModuleFields.mandatory || []).length === 0 && (currentModuleFields.optional || []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-neutral-400">No configurable fields for this module.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
