import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { getSalesWorkflowSettings, updateSalesWorkflowSettings } from '../../api/settings'

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-neutral-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function AdminSettings() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getSalesWorkflowSettings().then((result) => {
      if (!result.success) {
        setLoadError(result.error)
        setIsLoading(false)
        return
      }
      setSettings(result.settings)
      setIsLoading(false)
    })
  }, [])

  const updateField = (field) => (value) => setSettings((current) => ({ ...current, [field]: value }))

  const handleSave = async () => {
    setIsSaving(true)

    const result = await updateSalesWorkflowSettings(settings)

    if (!result.success) {
      showToast({ title: 'Save failed', message: result.error, variant: 'error' })
      setIsSaving(false)
      return
    }

    setSettings(result.settings)
    setIsSaving(false)
    showToast({ title: 'Settings saved', message: 'Sales workflow settings updated. Applies to the next order placed.' })
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading settings..." />
      </Card>
    )
  }

  if (loadError || !settings) {
    return (
      <Card>
        <div className="py-8 text-center text-sm text-red-600">{loadError || 'Unable to load settings.'}</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Sales Workflow Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Order approval, stock reservation, backorders, invoicing, and credit-limit behavior</p>
        </div>
        <Button onClick={handleSave} loading={isSaving}>
          <Save className="size-4" />
          Save Changes
        </Button>
      </div>

      <Card title="Order Processing" subtitle="Controls how new sales orders are handled">
        <div className="divide-y divide-neutral-50">
          <Toggle
            label="Require approval before placing orders"
            description="Orders start as Awaiting Approval until an admin approves them"
            checked={settings.orderRequiresApproval}
            onChange={updateField('orderRequiresApproval')}
          />
          <Toggle
            label="Reserve stock on order"
            description="Stock is reserved as soon as an order is placed, before delivery"
            checked={settings.reserveStockOnOrder}
            onChange={updateField('reserveStockOnOrder')}
          />
          <Toggle
            label="Allow partial delivery"
            description="Orders can be delivered in multiple shipments"
            checked={settings.allowPartialDelivery}
            onChange={updateField('allowPartialDelivery')}
          />
          <Toggle
            label="Allow backorders"
            description="Orders can be placed even when stock is insufficient"
            checked={settings.allowBackorder}
            onChange={updateField('allowBackorder')}
          />
          <Toggle
            label="Delivery collection allowed"
            description="Delivery partners can collect payment at the time of delivery"
            checked={settings.deliveryCollectionAllowed}
            onChange={updateField('deliveryCollectionAllowed')}
          />
          <Toggle
            label="Allow draft orders"
            description="Sales staff can save an order as a draft before it reserves stock, then confirm it later"
            checked={settings.draftOrdersEnabled}
            onChange={updateField('draftOrdersEnabled')}
          />
        </div>
      </Card>

      <Card title="Invoicing" subtitle="When and how invoices are generated">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Select
            label="Invoice timing"
            value={settings.invoiceTiming}
            onChange={(event) => updateField('invoiceTiming')(event.target.value)}
            options={[
              { value: 'after_delivery', label: 'After delivery' },
              { value: 'on_order', label: 'On order placement' },
            ]}
          />
          <Select
            label="Partial delivery invoice mode"
            value={settings.partialDeliveryInvoiceMode}
            onChange={(event) => updateField('partialDeliveryInvoiceMode')(event.target.value)}
            options={[
              { value: 'per_delivery', label: 'Invoice per delivery' },
              { value: 'after_full_order', label: 'Invoice after full order delivered' },
            ]}
          />
        </div>
        <div className="mt-4">
          <Toggle
            label="Allow direct invoicing"
            description="Staff can create invoices without a sales order (counter sales)"
            checked={settings.allowDirectInvoice}
            onChange={updateField('allowDirectInvoice')}
          />
        </div>
      </Card>

      <Card title="Credit Limit" subtitle="What happens when an order would exceed a customer's credit limit">
        <Select
          value={settings.creditLimitAction}
          onChange={(event) => updateField('creditLimitAction')(event.target.value)}
          options={[
            { value: 'warn', label: 'Warn, but allow the order' },
            { value: 'block', label: 'Block the order' },
            { value: 'ignore', label: 'Ignore credit limit' },
          ]}
          className="max-w-xs"
        />
      </Card>
    </div>
  )
}
