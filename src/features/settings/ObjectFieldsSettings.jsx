import { useMemo, useState } from 'react'
import {
  Building2,
  Check,
  ChevronDown,
  Info,
  Lock,
  RotateCcw,
  Save,
  Search,
  Truck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

const storageKey = 'object-field-settings'

const objectModules = [
  {
    key: 'employee_profile',
    label: 'Employee Profile',
    icon: UserRound,
    description: 'This is how the Employee Profile form will appear.',
    sections: [
      section('Basic Information', [
        field('firstName', 'First Name', "Employee's given name as per official records.", true),
        field('lastName', 'Last Name', "Employee's family name as per official records.", true),
        field('displayName', 'Display Name', 'Name displayed across the system.'),
        field('gender', 'Gender', "Employee's gender.", false, 'select', 'Male'),
        field('dateOfBirth', 'Date of Birth', "Employee's date of birth.", false, 'date', '15 / 06 / 2022'),
        field('maritalStatus', 'Marital Status', "Employee's marital status."),
        field('bloodGroup', 'Blood Group', "Employee's blood group."),
        field('nationality', 'Nationality', "Employee's nationality.", false, 'select', 'Indian'),
        field('profilePhoto', 'Profile Photo', 'Upload employee profile photo.', false, 'upload'),
      ]),
      section('Contact Information', [
        field('mobileNumber', 'Mobile Number', 'Primary mobile number.', true),
        field('email', 'Email Address', 'Primary email address.', true),
        field('alternateMobile', 'Alternate Mobile', 'Secondary mobile number.'),
        field('emergencyContact', 'Emergency Contact', 'Emergency contact details.'),
        field('personalEmail', 'Personal Email', 'Personal email address.'),
        field('workPhone', 'Work Phone', 'Desk or work phone number.'),
        field('whatsappNumber', 'WhatsApp Number', 'WhatsApp contact number.'),
      ]),
      section('Address Information', [
        field('currentAddress', 'Current Address', 'Current residential address.', true),
        field('permanentAddress', 'Permanent Address', 'Permanent residential address.'),
        field('city', 'City', 'City.'),
        field('state', 'State', 'State.'),
        field('country', 'Country', 'Country.'),
        field('pinCode', 'PIN Code', 'Postal code.'),
      ]),
      section('Employment Information', [
        field('employeeId', 'Employee ID', 'Unique employee identifier.', true),
        field('role', 'Role', 'Employee role.', true),
        field('department', 'Department', 'Department name.'),
        field('designation', 'Designation', 'Job designation.', true),
        field('joiningDate', 'Joining Date', 'Employment start date.', true),
        field('manager', 'Reporting Manager', 'Assigned reporting manager.'),
        field('employmentType', 'Employment Type', 'Full-time, part-time, or contract.'),
        field('employeeStatus', 'Employee Status', 'Current employment status.'),
      ]),
      section('Payroll Information', [
        field('basicSalary', 'Basic Salary', 'Monthly base salary.'),
        field('hra', 'HRA', 'House rent allowance.'),
        field('bankName', 'Bank Name', 'Salary account bank.'),
        field('accountNumber', 'Account Number', 'Salary account number.'),
        field('ifscCode', 'IFSC Code', 'Bank IFSC code.'),
        field('panNumber', 'PAN Number', 'Employee PAN number.'),
      ]),
      section('Documents', [
        field('identityProof', 'Identity Proof', 'Government identity proof.', true, 'upload'),
        field('addressProof', 'Address Proof', 'Address proof document.', true, 'upload'),
        field('resume', 'Resume', 'Employee resume.', false, 'upload'),
        field('offerLetter', 'Offer Letter', 'Signed offer letter.', false, 'upload'),
        field('experienceLetter', 'Experience Letter', 'Previous employment proof.', false, 'upload'),
        field('educationCertificate', 'Education Certificate', 'Education certificate.', false, 'upload'),
        field('otherDocuments', 'Other Documents', 'Additional employee documents.', false, 'upload'),
      ]),
      section('System Preferences', [
        field('language', 'Language', 'Preferred language.'),
        field('timeZone', 'Time Zone', 'Preferred timezone.'),
        field('notificationPreference', 'Notifications', 'Notification preferences.'),
      ]),
    ],
  },
  {
    key: 'customer_profile',
    label: 'Customer Profile',
    icon: UsersRound,
    description: 'This is how the Customer Profile form will appear.',
    sections: [
      section('Basic Information', [
        field('customerName', 'Customer Name', 'Name of the customer or business.', true),
        field('customerType', 'Customer Type', 'Individual, business, dealer, or distributor.', true, 'select', 'Business'),
        field('displayName', 'Display Name', 'Name displayed in invoices.'),
        field('industry', 'Industry', 'Industry or business category.', false, 'select', 'Beverages'),
        field('customerSince', 'Customer Since', 'Date customer was added.', true, 'date', '15 / 01 / 2025'),
        field('status', 'Status', 'Customer account status.', true, 'select', 'Active'),
      ]),
      section('Contact Information', [
        field('primaryContactPerson', 'Primary Contact Person', 'Main point of contact.', true),
        field('mobileNumber', 'Mobile Number', 'Primary mobile number.', true),
        field('email', 'Email Address', 'Primary email address.'),
        field('website', 'Website', 'Business website.'),
      ]),
      section('Address Information', [
        field('billingAddress', 'Billing Address', 'Invoice address.', true),
        field('shippingAddress', 'Shipping Address', 'Delivery address.'),
        field('city', 'City', 'City.'),
        field('state', 'State', 'State.'),
        field('googleMapsLocation', 'Google Maps Location', 'Customer geo-location.', true),
      ]),
      section('Payment Information', [
        field('paymentTerms', 'Payment Terms', 'Default payment terms.'),
        field('creditLimit', 'Credit Limit', 'Maximum allowed credit.'),
        field('preferredPaymentMethod', 'Payment Method', 'Preferred payment method.'),
        field('upiId', 'UPI ID', 'Customer UPI ID.'),
      ]),
    ],
  },
  {
    key: 'driver_profile',
    label: 'Driver Profile',
    icon: Truck,
    description: 'This is how the Driver Profile form will appear.',
    sections: [
      section('Basic Information', [
        field('driverName', 'Driver Name', 'Driver full name.', true),
        field('mobileNumber', 'Mobile Number', 'Primary mobile number.', true),
        field('licenseNumber', 'License Number', 'Driving license number.', true),
        field('licenseExpiry', 'License Expiry', 'Driving license expiry date.', true, 'date', '15 / 06 / 2026'),
        field('vehicleAssigned', 'Vehicle Assigned', 'Assigned vehicle.'),
      ]),
      section('Documents', [
        field('licenseDocument', 'License Document', 'Uploaded license copy.', true, 'upload'),
        field('idProof', 'ID Proof', 'Government ID proof.', true, 'upload'),
        field('addressProof', 'Address Proof', 'Address document.', false, 'upload'),
      ]),
    ],
  },
  {
    key: 'company_profile',
    label: 'Company Profile',
    icon: Building2,
    description: 'This is how the Company Profile form will appear.',
    sections: [
      section('Basic Information', [
        field('companyName', 'Company Name', 'Public company name.', true),
        field('legalName', 'Legal Name', 'Registered legal name.', true),
        field('businessType', 'Business Type', 'Company business structure.', true, 'select', 'LLP'),
        field('industry', 'Industry', 'Primary industry.', true, 'select', 'Beverages'),
        field('status', 'Status', 'Company account status.', true, 'select', 'Active'),
      ]),
      section('Contact Information', [
        field('phone', 'Primary Mobile Number', 'Primary company number.', true),
        field('email', 'Official Email Address', 'Official company email.', true),
        field('website', 'Website', 'Company website.'),
      ]),
      section('Documents', [
        field('logo', 'Company Logo', 'Company logo.', true, 'upload'),
        field('gstCertificate', 'GST Certificate', 'GST certificate.', false, 'upload'),
        field('panCard', 'PAN Card', 'PAN card.', false, 'upload'),
      ]),
    ],
  },
]

function section(title, fields) {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    title,
    fields,
  }
}

function field(key, label, description, required = false, input = 'text', sampleValue = '') {
  return { key, label, description, required, input, sampleValue }
}

function buildDefaultVisibility() {
  return Object.fromEntries(
    objectModules.map((module) => [
      module.key,
      Object.fromEntries(module.sections.flatMap((sectionItem) => sectionItem.fields.map((fieldItem) => [fieldItem.key, true]))),
    ]),
  )
}

function readStoredVisibility() {
  if (typeof window === 'undefined') return buildDefaultVisibility()

  try {
    const storedValue = window.localStorage.getItem(storageKey)
    return storedValue ? { ...buildDefaultVisibility(), ...JSON.parse(storedValue) } : buildDefaultVisibility()
  } catch {
    return buildDefaultVisibility()
  }
}

function getVisibleCount(moduleVisibility, fields) {
  return fields.filter((fieldItem) => fieldItem.required || moduleVisibility[fieldItem.key] !== false).length
}

export default function ObjectFieldsSettings() {
  const { showToast } = useToast()
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const [activeModuleKey, setActiveModuleKey] = useState(objectModules[0].key)
  const [openSections, setOpenSections] = useState({ [objectModules[0].sections[0].id]: true })
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState(readStoredVisibility)
  const activeModule = objectModules.find((module) => module.key === activeModuleKey) || objectModules[0]
  const moduleVisibility = visibility[activeModule.key] || {}
  const normalizedQuery = query.trim().toLowerCase()

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return activeModule.sections

    return activeModule.sections
      .map((sectionItem) => ({
        ...sectionItem,
        fields: sectionItem.fields.filter(
          (fieldItem) =>
            fieldItem.label.toLowerCase().includes(normalizedQuery) ||
            fieldItem.description.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((sectionItem) => sectionItem.fields.length > 0)
  }, [activeModule, normalizedQuery])

  const updateVisibility = (fieldItem, checked) => {
    if (fieldItem.required) return

    setVisibility((current) => ({
      ...current,
      [activeModule.key]: {
        ...current[activeModule.key],
        [fieldItem.key]: checked,
      },
    }))
  }

  const updateSectionVisibility = (sectionItem, checked) => {
    setVisibility((current) => ({
      ...current,
      [activeModule.key]: {
        ...current[activeModule.key],
        ...Object.fromEntries(
          sectionItem.fields
            .filter((fieldItem) => !fieldItem.required)
            .map((fieldItem) => [fieldItem.key, checked]),
        ),
      },
    }))
  }

  const handleModuleChange = (moduleKey) => {
    const nextModule = objectModules.find((module) => module.key === moduleKey)
    setActiveModuleKey(moduleKey)
    setOpenSections({ [nextModule?.sections[0]?.id]: true })
  }

  const handleReset = () => {
    setVisibility(buildDefaultVisibility())
    showToast({ title: 'Defaults restored', message: 'All object fields are visible again.' })
  }

  const handleSave = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(visibility))
    showToast({ title: 'Field settings saved', message: 'Object field visibility has been updated.' })
  }

  return (
    <div className="space-y-4 pb-0">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Object Field Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">Configure which fields are visible for each object in your CRM.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fields..."
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-500/12 sm:w-64"
            />
          </div>
          <Select
            value={currentOrganization?.name || 'AquaHub Logistics'}
            options={[{ value: currentOrganization?.name || 'AquaHub Logistics', label: currentOrganization?.name || 'AquaHub Logistics' }]}
            triggerClassName="h-10 bg-white py-1.5"
            className="sm:w-64"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Reset to Default
          </Button>
          <Button type="button" onClick={handleSave}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div>
        <div className="min-w-0 space-y-3">
          <div className="overflow-x-auto rounded-t-xl border border-neutral-100 bg-white">
            <div className="flex min-w-[46rem]">
              {objectModules.map((module) => {
                const Icon = module.icon
                const isActive = module.key === activeModule.key

                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => handleModuleChange(module.key)}
                    className={`flex min-w-44 items-center justify-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-primary-600 bg-primary-50/30 text-primary-700'
                        : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                    }`}
                  >
                    <Icon className="size-4" />
                    {module.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            <Info className="size-4 shrink-0" />
            <span>Required fields stay enabled by default and cannot be hidden.</span>
            <X className="ml-auto size-4 text-primary-600" />
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-(--shadow-card)">
            {filteredSections.map((sectionItem, sectionIndex) => {
              const isOpen = openSections[sectionItem.id] !== false && (openSections[sectionItem.id] || sectionIndex === 0 || normalizedQuery)
              const visibleCount = getVisibleCount(moduleVisibility, sectionItem.fields)
              const hasVisibleOptionalField = sectionItem.fields.some(
                (fieldItem) => !fieldItem.required && moduleVisibility[fieldItem.key] !== false,
              )

              return (
                <section key={sectionItem.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenSections((current) => ({ ...current, [sectionItem.id]: !isOpen }))}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-700 text-[0.65rem] font-semibold text-white">
                      {sectionIndex + 1}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">
                      {sectionIndex + 1}. {sectionItem.title}
                    </span>
                    <span className="ml-auto flex w-28 shrink-0 justify-end">
                      <label className="inline-flex cursor-pointer items-center justify-center" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={hasVisibleOptionalField}
                          onChange={(event) => updateSectionVisibility(sectionItem, event.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="grid size-4 place-items-center rounded border border-neutral-300 bg-white text-white peer-checked:border-primary-700 peer-checked:bg-primary-700">
                          <Check className="size-3" />
                        </span>
                      </label>
                    </span>
                    <span className="w-32 shrink-0 text-right text-xs font-medium text-neutral-500">
                      {visibleCount} of {sectionItem.fields.length} visible
                    </span>
                    <ChevronDown className={`size-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto border-t border-neutral-100">
                      <table className="min-w-[48rem] w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Field Name</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="w-28 px-4 py-3 text-center">Visible</th>
                            <th className="w-32 px-4 py-3 text-center">Required</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {sectionItem.fields.map((fieldItem) => {
                            const checked = fieldItem.required || moduleVisibility[fieldItem.key] !== false

                            return (
                              <tr key={fieldItem.key} className="hover:bg-neutral-50/70">
                                <td className="px-4 py-3 text-xs font-semibold text-neutral-800">{fieldItem.label}</td>
                                <td className="px-4 py-3 text-xs text-neutral-500">{fieldItem.description}</td>
                                <td className="px-4 py-3 text-center">
                                  <label className="inline-flex cursor-pointer items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={fieldItem.required}
                                      onChange={(event) => updateVisibility(fieldItem, event.target.checked)}
                                      className="peer sr-only"
                                    />
                                    <span className="grid size-4 place-items-center rounded border border-neutral-300 bg-white text-white peer-checked:border-primary-700 peer-checked:bg-primary-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                      <Check className="size-3" />
                                    </span>
                                  </label>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {fieldItem.required ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[0.65rem] font-semibold text-neutral-600">
                                      <Lock className="size-3" />
                                      Required
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">-</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
