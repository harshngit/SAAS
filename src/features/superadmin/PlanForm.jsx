import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { ENTITLEMENT_GROUPS, entitlementLabel } from '../../entitlements/entitlementKeys'

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function featuresToText(features) {
  return Array.isArray(features) ? features.join('\n') : ''
}

function featuresFromText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

// Fills in every canonical key as false by default - a brand-new plan starts with nothing
// entitled rather than an incomplete dict that would read as "unknown" (and therefore
// fail-open) for keys it never mentions.
function buildEntitlementsState(entitlements) {
  const state = {}
  ENTITLEMENT_GROUPS.forEach((group) => {
    group.keys.forEach((key) => {
      state[key] = Boolean(entitlements?.[key])
    })
  })
  return state
}

function buildFormState(plan) {
  return {
    name: plan?.name || '',
    price_monthly: plan?.price_monthly ?? '',
    price_yearly: plan?.price_yearly ?? '',
    original_price_monthly: plan?.original_price_monthly ?? '',
    original_price_yearly: plan?.original_price_yearly ?? '',
    max_users: plan?.max_users ?? '',
    max_warehouses: plan?.max_warehouses ?? '',
    max_orders: plan?.max_orders ?? '',
    features: featuresToText(plan?.features),
    entitlements: buildEntitlementsState(plan?.entitlements),
    is_default: Boolean(plan?.is_default),
  }
}

function fieldsEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a || []) === JSON.stringify(b || [])
  }
  if (typeof a === 'object' && a !== null) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return (a ?? null) === (b ?? null)
}

// Collapsible section - closed by default except the first, since the full Report Access list
// alone is 17 rows; this keeps the editor usable without losing any of the required toggles.
function CollapsibleSection({ title, subtitle, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-neutral-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-neutral-900">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-neutral-500">{subtitle}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && <div className="border-t border-neutral-100 px-4 py-3">{children}</div>}
    </div>
  )
}

export default function PlanForm({ isOpen, onClose, plan, onSave, isSubmitting, submitError }) {
  const [formData, setFormData] = useState(() => buildFormState(plan))

  const handleClose = () => {
    setFormData(buildFormState(plan))
    onClose()
  }

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleCheckboxChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.checked }))
  }

  const toggleEntitlement = (key) => {
    setFormData((prev) => ({ ...prev, entitlements: { ...prev.entitlements, [key]: !prev.entitlements[key] } }))
  }

  const toggleGroup = (group, nextValue) => {
    setFormData((prev) => ({
      ...prev,
      entitlements: group.keys.reduce((acc, key) => ({ ...acc, [key]: nextValue }), { ...prev.entitlements }),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextValues = {
      name: formData.name.trim(),
      price_monthly: toNullableNumber(formData.price_monthly),
      price_yearly: toNullableNumber(formData.price_yearly),
      original_price_monthly: toNullableNumber(formData.original_price_monthly),
      original_price_yearly: toNullableNumber(formData.original_price_yearly),
      max_users: toNullableNumber(formData.max_users),
      max_warehouses: toNullableNumber(formData.max_warehouses),
      max_orders: toNullableNumber(formData.max_orders),
      features: featuresFromText(formData.features),
      entitlements: formData.entitlements,
      is_default: formData.is_default,
    }

    if (!plan) {
      onSave(nextValues)
      return
    }

    // Editing: PUT is partial, so only send fields that actually changed.
    const originalValues = {
      name: plan.name || '',
      price_monthly: plan.price_monthly ?? null,
      price_yearly: plan.price_yearly ?? null,
      original_price_monthly: plan.original_price_monthly ?? null,
      original_price_yearly: plan.original_price_yearly ?? null,
      max_users: plan.max_users ?? null,
      max_warehouses: plan.max_warehouses ?? null,
      max_orders: plan.max_orders ?? null,
      features: Array.isArray(plan.features) ? plan.features : [],
      entitlements: buildEntitlementsState(plan.entitlements),
      is_default: Boolean(plan.is_default),
    }

    const changedFields = Object.fromEntries(
      Object.entries(nextValues).filter(([key, value]) => !fieldsEqual(value, originalValues[key])),
    )

    onSave(changedFields)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={plan ? `Edit ${plan.name}` : 'Create Plan'} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">General</p>
          <div className="mt-3 space-y-4">
            <Input label="Plan Name" value={formData.name} onChange={handleChange('name')} required />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Price / month" type="number" min="0" step="1" value={formData.price_monthly} onChange={handleChange('price_monthly')} required />
              <Input label="Price / year" type="number" min="0" step="1" value={formData.price_yearly} onChange={handleChange('price_yearly')} required />
              <Input label="Original price / month" type="number" min="0" step="1" value={formData.original_price_monthly} onChange={handleChange('original_price_monthly')} />
              <Input label="Original price / year" type="number" min="0" step="1" value={formData.original_price_yearly} onChange={handleChange('original_price_yearly')} />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={handleCheckboxChange('is_default')}
                className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
              />
              <span>
                Set as default plan
                <span className="block text-xs text-neutral-500">Shown as the recommended plan for new organizations.</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Limits</p>
          <p className="mt-0.5 text-xs text-neutral-500">Leave blank for unlimited.</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Max Users" type="number" min="0" placeholder="Unlimited" value={formData.max_users} onChange={handleChange('max_users')} />
            <Input label="Max Warehouses" type="number" min="0" placeholder="Unlimited" value={formData.max_warehouses} onChange={handleChange('max_warehouses')} />
            <Input label="Max Orders" type="number" min="0" placeholder="Unlimited" value={formData.max_orders} onChange={handleChange('max_orders')} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Feature Access</p>
          <p className="mt-0.5 text-xs text-neutral-500">What this plan entitles an organization to use. Role permissions still apply on top of this.</p>
          <div className="mt-3 space-y-2">
            {ENTITLEMENT_GROUPS.map((group, index) => {
              const allOn = group.keys.every((key) => formData.entitlements[key])
              return (
                <CollapsibleSection key={group.label} title={group.label} defaultOpen={index === 0}>
                  <div className="mb-2 flex justify-end">
                    <button type="button" onClick={() => toggleGroup(group, !allOn)} className="text-xs font-medium text-primary-600 hover:underline">
                      {allOn ? 'Clear all' : 'Enable all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.entitlements[key])}
                          onChange={() => toggleEntitlement(key)}
                          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                        />
                        {entitlementLabel(key)}
                      </label>
                    ))}
                  </div>
                </CollapsibleSection>
              )
            })}
          </div>
        </div>

        <Input
          label="Marketing Features (one per line)"
          as="textarea"
          value={formData.features}
          onChange={handleChange('features')}
        />
        <p className="-mt-3 text-xs text-neutral-500">
          Free-text bullet points shown on the plan card (e.g. &ldquo;1 Admin User&rdquo;) - presentation only, separate from Feature Access above.
        </p>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {plan ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
