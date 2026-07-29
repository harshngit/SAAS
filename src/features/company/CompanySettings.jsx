import { useState } from 'react'
import {
  Bell,
  Building2,
  CreditCard,
  LifeBuoy,
  Save,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'

const initialCompanyData = {
  name: 'SAAS Distributors',
  email: 'info@saasdistributors.com',
  phone: '+91 9876543210',
  address: '123 Main Street, Business District',
  country: 'india',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  fax: '',
  gstin: '27AABCU9603R1ZX'
}

const settingsNav = [
  {
    id: 'general',
    label: 'General Information',
    icon: Building2,
    description: 'Update public company details used across invoices and reports.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Manage company alerts and communication settings.',
  },
  {
    id: 'account',
    label: 'Account',
    icon: UserRound,
    description: 'Review workspace account ownership and access details.',
  },
  {
    id: 'account-manager',
    label: 'Account Manager',
    icon: UsersRound,
    description: 'Manage the primary account manager for this company.',
  },
  {
    id: 'billings',
    label: 'Billings',
    icon: CreditCard,
    description: 'Review billing profile, tax, and subscription information.',
  },
  {
    id: 'support',
    label: 'Support',
    icon: LifeBuoy,
    description: 'View support contact information for your workspace.',
  },
]

const countryOptions = [
  { value: 'india', label: 'India' },
  { value: 'usa', label: 'United States' },
  { value: 'uae', label: 'United Arab Emirates' },
  { value: 'singapore', label: 'Singapore' },
]

const stateOptions = [
  { value: 'Maharashtra', label: 'Maharashtra' },
  { value: 'Gujarat', label: 'Gujarat' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Delhi', label: 'Delhi' },
]

export default function CompanySettings() {
  const [companyData, setCompanyData] = useState(initialCompanyData)
  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const activeNavItem = settingsNav.find((item) => item.id === activeTab) || settingsNav[0]

  const handleChange = (e) => {
    const { name, value } = e.target
    setCompanyData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Company settings saved successfully!')
    setIsSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-(--font-display) text-2xl font-bold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your company information and workspace details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCompanyData(initialCompanyData)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <Card className="p-0">
        <div className="grid min-h-[34rem] grid-cols-1 lg:grid-cols-[17rem_1fr]">
          <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {settingsNav.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.label}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-colors lg:w-full ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="p-5 sm:p-7">
            <div className="border-b border-neutral-100 pb-5">
              <h2 className="font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">
                {activeNavItem.label}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">{activeNavItem.description}</p>
            </div>

            {activeTab === 'general' ? (
              <>
                <section className="border-b border-neutral-100 py-6">
                  <p className="text-sm font-semibold text-neutral-900">Profile picture upload</p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                        <Building2 className="size-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{companyData.name}</p>
                        <p className="text-xs text-neutral-500">Business logo</p>
                        <p className="truncate text-xs text-neutral-400">{companyData.city}, {companyData.state}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm">
                        <Upload className="size-4" />
                        Upload New Photo
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="pt-6">
                  <h3 className="text-sm font-semibold text-neutral-900">Organization Information</h3>
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Business Name"
                      name="name"
                      value={companyData.name}
                      onChange={handleChange}
                    />
                    <Input
                      label="Email Address"
                      name="email"
                      type="email"
                      value={companyData.email}
                      onChange={handleChange}
                    />
                    <Input
                      label="Phone Number"
                      name="phone"
                      value={companyData.phone}
                      onChange={handleChange}
                    />
                    <Input
                      label="Fax"
                      name="fax"
                      value={companyData.fax}
                      placeholder="Add fax number"
                      onChange={handleChange}
                    />
                    <Input
                      label="GSTIN"
                      name="gstin"
                      value={companyData.gstin}
                      onChange={handleChange}
                    />
                    <Input
                      label="Registered Address"
                      name="address"
                      value={companyData.address}
                      onChange={handleChange}
                    />
                  </div>
                </section>

                <section className="pt-7">
                  <h3 className="text-sm font-semibold text-neutral-900">Address</h3>
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Select
                      label="Country"
                      name="country"
                      value={companyData.country}
                      options={countryOptions}
                      onChange={handleChange}
                    />
                    <Input
                      label="City"
                      name="city"
                      value={companyData.city}
                      onChange={handleChange}
                    />
                    <Input
                      label="Postcode"
                      name="pincode"
                      value={companyData.pincode}
                      onChange={handleChange}
                    />
                    <Select
                      label="State"
                      name="state"
                      value={companyData.state}
                      options={stateOptions}
                      onChange={handleChange}
                    />
                  </div>
                </section>
              </>
            ) : (
              <section className="py-6">
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5">
                  <p className="text-sm font-semibold text-neutral-900">{activeNavItem.label}</p>
                  <p className="mt-1 text-sm text-neutral-500">{activeNavItem.description}</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
