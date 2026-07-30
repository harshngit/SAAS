import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  LifeBuoy,
  Pencil,
  Save,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import { getCurrentProfile } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

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
  gstin: '27AABCU9603R1ZX',
  businessType: '',
  panNumber: '',
  financialYear: '',
  billingAddress: '',
  shippingAddressSameAsBilling: false,
  shippingAddress: '',
  website: '',
  invoicePrefix: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhone: '',
}

const settingsNav = [
  {
    id: 'account',
    label: 'Account',
    icon: UserRound,
    description: 'Manage primary admin registration details.',
  },
  {
    id: 'general',
    label: 'General Information',
    icon: Building2,
    description: 'Update public company details used across invoices and reports.',
  },
  {
    id: 'billings',
    label: 'Billings',
    icon: CreditCard,
    description: 'Review billing profile, tax, and subscription information.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Manage company alerts and communication settings.',
  },
  {
    id: 'support',
    label: 'Support',
    icon: LifeBuoy,
    description: 'View support contact information for your workspace.',
  },
]

const businessTypeOptions = [
  { value: 'sole-proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'private-limited', label: 'Private Limited' },
  { value: 'llp', label: 'LLP' },
]

const financialYearOptions = [
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
]

function buildCompanyDataFromProfile(user, organization) {
  return {
    ...initialCompanyData,
    name: organization?.name || initialCompanyData.name,
    email: organization?.email || initialCompanyData.email,
    phone: organization?.phone || initialCompanyData.phone,
    address: organization?.address || initialCompanyData.address,
    gstin: organization?.gst_number || organization?.gstNumber || initialCompanyData.gstin,
    businessType: organization?.business_type || organization?.businessType || '',
    panNumber: organization?.pan_number || organization?.panNumber || '',
    financialYear: organization?.financial_year || organization?.financialYear || '',
    billingAddress: organization?.address || organization?.billingAddress || '',
    adminName: user?.name || '',
    adminEmail: user?.email || '',
    adminPhone: user?.phone || '',
    adminPassword: '',
  }
}

export default function CompanySettings() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const [companyData, setCompanyData] = useState(() => buildCompanyDataFromProfile(currentUser, currentOrganization))
  const [activeTab, setActiveTab] = useState('account')
  const [editingSections, setEditingSections] = useState({ account: false, general: false })
  const [isOrganizationDetailsOpen, setIsOrganizationDetailsOpen] = useState(true)
  const [isBusinessDetailsOpen, setIsBusinessDetailsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const activeNavItem = settingsNav.find((item) => item.id === activeTab) || settingsNav[0]
  const isEditableSection = activeTab === 'account' || activeTab === 'general'
  const isActiveSectionEditing = Boolean(editingSections[activeTab])
  const isAccountEditing = editingSections.account
  const isGeneralEditing = editingSections.general

  const resetCompanyData = useCallback(() => {
    setCompanyData(buildCompanyDataFromProfile(currentUser, currentOrganization))
  }, [currentOrganization, currentUser])

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      const result = await getCurrentProfile()

      if (!isMounted) return

      if (!result.success) {
        setProfileError(result.error)
        return
      }

      setProfileError('')
      setCompanyData(buildCompanyDataFromProfile(result.user, result.organization))
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    resetCompanyData()
  }, [resetCompanyData])

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target
    const nextValue = type === 'checkbox' ? checked : value
    setCompanyData(prev => ({ ...prev, [name]: nextValue }))
  }

  const handleEditProfile = () => {
    if (!isEditableSection) return
    setEditingSections((prev) => ({ ...prev, [activeTab]: true }))
  }

  const handleCancel = () => {
    resetCompanyData()
    if (isEditableSection) {
      setEditingSections((prev) => ({ ...prev, [activeTab]: false }))
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Company settings saved successfully!')
    setIsSaving(false)
    if (isEditableSection) {
      setEditingSections((prev) => ({ ...prev, [activeTab]: false }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-(--font-display) text-2xl font-bold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage your company information and workspace details.</p>
        </div>
      </div>

      {profileError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {profileError}
        </div>
      )}

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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">
                    {activeNavItem.label}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">{activeNavItem.description}</p>
                </div>
                {isEditableSection && (
                  <div className="flex flex-wrap items-center gap-2">
                    {isActiveSectionEditing ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handleCancel}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} loading={isSaving}>
                          <Save className="size-3.5" />
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handleEditProfile}>
                        <Pencil className="size-3.5" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeTab === 'account' ? (
              <section className="pb-5">
                {/* <h3 className="text-sm font-semibold text-neutral-900">Admin Registration</h3> */}

                <section className="border-b border-neutral-100 py-3">
                  {/* <p className="text-sm font-semibold text-neutral-900">Company logo upload</p> */}
                  <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      <Button size="sm" disabled={!isAccountEditing}>
                        <Upload className="size-4" />
                        Upload New Logo
                      </Button>
                      <Button variant="outline" size="sm" disabled={!isAccountEditing}>
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </section>

                <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Input
                    label="Admin Name"
                    name="adminName"
                    value={companyData.adminName}
                    onChange={handleChange}
                    disabled={!isAccountEditing}
                  />
                  <Input
                    label="Email Address"
                    name="adminEmail"
                    type="email"
                    value={companyData.adminEmail}
                    onChange={handleChange}
                    disabled={!isAccountEditing}
                  />
                  <Input
                    label="Password"
                    name="adminPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={companyData.adminPassword}
                    onChange={handleChange}
                    disabled={!isAccountEditing}
                  />
                  <Input
                    label="Phone Number"
                    name="adminPhone"
                    value={companyData.adminPhone}
                    onChange={handleChange}
                    disabled={!isAccountEditing}
                  />
                </div>
              </section>
            ) : activeTab === 'general' ? (
              <>
                <section className="border-b border-neutral-100 py-5">
                  <button
                    type="button"
                    aria-expanded={isOrganizationDetailsOpen}
                    onClick={() => setIsOrganizationDetailsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                        1
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900">Organization Details</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">Update business identity and tax details.</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`size-4 text-neutral-500 transition-transform ${
                        isOrganizationDetailsOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOrganizationDetailsOpen && (
                    <div className="mt-5">
                      {/* <h3 className="text-sm font-semibold text-neutral-900">Organization Details</h3> */}
                      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                        <Input
                          label="Company/Firm/Shop Name"
                          name="name"
                          value={companyData.name}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                        <Select
                          label="Business Type"
                          name="businessType"
                          placeholder="Select business type"
                          value={companyData.businessType}
                          options={businessTypeOptions}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                        <Input
                          label="GST Number"
                          name="gstin"
                          value={companyData.gstin}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                        <Input
                          label="PAN Number (if applicable)"
                          name="panNumber"
                          value={companyData.panNumber}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                        <Select
                          label="Financial Year"
                          name="financialYear"
                          placeholder="Select financial year"
                          value={companyData.financialYear}
                          options={financialYearOptions}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="py-5">
                  <button
                    type="button"
                    aria-expanded={isBusinessDetailsOpen}
                    onClick={() => setIsBusinessDetailsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                        2
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900">Business Details</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">Manage billing, shipping, and invoice settings.</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`size-4 text-neutral-500 transition-transform ${isBusinessDetailsOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isBusinessDetailsOpen && (
                    <div className="mt-5">
                      {/* <h3 className="text-sm font-semibold text-neutral-900">Business Details</h3> */}
                      <div className="mt-4 space-y-5">
                        <Input
                          label="Billing Address"
                          name="billingAddress"
                          as="textarea"
                          value={companyData.billingAddress}
                          onChange={handleChange}
                          disabled={!isGeneralEditing}
                        />
                        <label className="flex items-center gap-3 text-sm font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            name="shippingAddressSameAsBilling"
                            checked={companyData.shippingAddressSameAsBilling}
                            onChange={handleChange}
                            disabled={!isGeneralEditing}
                            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                          />
                          Shipping/Warehouse address same as billing address
                        </label>
                        <Input
                          label="Shipping/Warehouse Address"
                          name="shippingAddress"
                          as="textarea"
                          value={
                            companyData.shippingAddressSameAsBilling
                              ? companyData.billingAddress
                              : companyData.shippingAddress
                          }
                          onChange={handleChange}
                          disabled={!isGeneralEditing || companyData.shippingAddressSameAsBilling}
                        />
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <Input
                            label="Website (if applicable)"
                            name="website"
                            value={companyData.website}
                            onChange={handleChange}
                            disabled={!isGeneralEditing}
                          />
                          <Input
                            label="Invoice Prefix"
                            name="invoicePrefix"
                            placeholder="e.g. INV"
                            value={companyData.invoicePrefix}
                            onChange={handleChange}
                            disabled={!isGeneralEditing}
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
