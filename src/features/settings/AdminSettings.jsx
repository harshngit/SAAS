import { useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'

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

const initialNotificationPrefs = {
  lowStock: true,
  paymentOverdue: true,
  deliveryFailed: true,
  newOrder: false,
  dailySummaryEmail: true,
}

const initialSecurityPrefs = {
  twoFactor: false,
  forcePasswordReset: false,
}

export default function AdminSettings() {
  const { showToast } = useToast()
  const [notificationPrefs, setNotificationPrefs] = useState(initialNotificationPrefs)
  const [securityPrefs, setSecurityPrefs] = useState(initialSecurityPrefs)
  const [sessionTimeout, setSessionTimeout] = useState('60')
  const [currency, setCurrency] = useState('INR')
  const [dateFormat, setDateFormat] = useState('DD-MM-YYYY')
  const [isSaving, setIsSaving] = useState(false)

  const updateNotification = (key) => (value) =>
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }))

  const updateSecurity = (key) => (value) =>
    setSecurityPrefs((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsSaving(false)
    showToast({ title: 'Settings saved', message: 'Settings saved successfully.' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Configure notifications, security, and system preferences</p>
        </div>
        <Button onClick={handleSave} loading={isSaving}>
          <Save className="size-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6">
          <Card title="Notification Preferences" subtitle="Choose which alerts your organization receives">
            <div className="divide-y divide-neutral-50">
              <Toggle
                label="Low stock alerts"
                description="Notify when product inventory falls below threshold"
                checked={notificationPrefs.lowStock}
                onChange={updateNotification('lowStock')}
              />
              <Toggle
                label="Payment overdue alerts"
                description="Notify when a customer payment is past due"
                checked={notificationPrefs.paymentOverdue}
                onChange={updateNotification('paymentOverdue')}
              />
              <Toggle
                label="Delivery failed alerts"
                description="Notify when a scheduled delivery fails or is rescheduled"
                checked={notificationPrefs.deliveryFailed}
                onChange={updateNotification('deliveryFailed')}
              />
              <Toggle
                label="New order alerts"
                description="Notify admins whenever a new sales order is created"
                checked={notificationPrefs.newOrder}
                onChange={updateNotification('newOrder')}
              />
              <Toggle
                label="Daily summary email"
                description="Receive a daily digest of sales, deliveries, and expenses"
                checked={notificationPrefs.dailySummaryEmail}
                onChange={updateNotification('dailySummaryEmail')}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card title="Security" subtitle="Manage authentication and session policies">
            <div className="divide-y divide-neutral-50">
              <Toggle
                label="Require two-factor authentication"
                description="All users must verify with a one-time code at login"
                checked={securityPrefs.twoFactor}
                onChange={updateSecurity('twoFactor')}
              />
              <Toggle
                label="Force password reset every 90 days"
                description="Users are prompted to set a new password quarterly"
                checked={securityPrefs.forcePasswordReset}
                onChange={updateSecurity('forcePasswordReset')}
              />
            </div>
            <div className="mt-4 max-w-xs">
              <Select
                label="Session timeout (minutes)"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                options={[
                  { value: '15', label: '15 minutes' },
                  { value: '30', label: '30 minutes' },
                  { value: '60', label: '60 minutes' },
                  { value: '120', label: '120 minutes' },
                ]}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card title="System Preferences" subtitle="Defaults applied across the organization">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'Indian Rupee (₹)' },
                  { value: 'USD', label: 'US Dollar ($)' },
                  { value: 'EUR', label: 'Euro (€)' },
                ]}
              />
              <Select
                label="Date format"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                options={[
                  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
                  { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                ]}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
