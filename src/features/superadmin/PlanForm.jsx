import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

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

function buildFormState(plan) {
  return {
    name: plan?.name || '',
    price_monthly: plan?.price_monthly ?? '',
    price_yearly: plan?.price_yearly ?? '',
    original_price_monthly: plan?.original_price_monthly ?? '',
    original_price_yearly: plan?.original_price_yearly ?? '',
    max_users: plan?.max_users ?? '',
    max_orders: plan?.max_orders ?? '',
    features: featuresToText(plan?.features),
  }
}

function fieldsEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a || []) === JSON.stringify(b || [])
  }
  return (a ?? null) === (b ?? null)
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

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextValues = {
      name: formData.name.trim(),
      price_monthly: toNullableNumber(formData.price_monthly),
      price_yearly: toNullableNumber(formData.price_yearly),
      original_price_monthly: toNullableNumber(formData.original_price_monthly),
      original_price_yearly: toNullableNumber(formData.original_price_yearly),
      max_users: toNullableNumber(formData.max_users),
      max_orders: toNullableNumber(formData.max_orders),
      features: featuresFromText(formData.features),
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
      max_orders: plan.max_orders ?? null,
      features: Array.isArray(plan.features) ? plan.features : [],
    }

    const changedFields = Object.fromEntries(
      Object.entries(nextValues).filter(([key, value]) => !fieldsEqual(value, originalValues[key])),
    )

    onSave(changedFields)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={plan ? `Edit ${plan.name}` : 'Create Plan'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Plan Name" value={formData.name} onChange={handleChange('name')} required />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price / month"
            type="number"
            min="0"
            value={formData.price_monthly}
            onChange={handleChange('price_monthly')}
            required
          />
          <Input
            label="Price / year"
            type="number"
            min="0"
            value={formData.price_yearly}
            onChange={handleChange('price_yearly')}
            required
          />
          <Input
            label="Original price / month"
            type="number"
            min="0"
            value={formData.original_price_monthly}
            onChange={handleChange('original_price_monthly')}
          />
          <Input
            label="Original price / year"
            type="number"
            min="0"
            value={formData.original_price_yearly}
            onChange={handleChange('original_price_yearly')}
          />
          <Input
            label="Max users"
            type="number"
            min="0"
            placeholder="Unlimited"
            value={formData.max_users}
            onChange={handleChange('max_users')}
          />
          <Input
            label="Max orders"
            type="number"
            min="0"
            placeholder="Unlimited"
            value={formData.max_orders}
            onChange={handleChange('max_orders')}
          />
        </div>

        <Input
          label="Features (one per line)"
          as="textarea"
          value={formData.features}
          onChange={handleChange('features')}
        />

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-3 pt-2">
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
