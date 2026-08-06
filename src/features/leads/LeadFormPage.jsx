import { Fragment, useMemo, useState } from 'react'
import { BadgeInfo, Handshake, PackageSearch, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { products as seedProducts } from '../../mockData/products'
import { users as seedUsers } from '../../mockData/users'
import { leads as seedLeads } from '../../mockData/leads'
import { useAuthStore } from '../../store/authStore'
import { readStoredLeads, saveStoredLead } from './leadStorage'

const leadSourceOptions = [
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Data Calling', label: 'Data Calling' },
]

const leadStatusOptions = [
  { value: 'New', label: 'New' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Won', label: 'Won' },
  { value: 'Lost', label: 'Lost' },
]

const emptyLeadForm = {
  id: '',
  source: '',
  customer: '',
  contactPerson: '',
  mobile: '',
  email: '',
  interestedProducts: [],
  expectedBudget: '',
  expectedClosingDate: '',
  assignedSalesperson: '',
  status: 'New',
  notes: '',
}

const formSections = [
  {
    id: 'lead-information',
    title: 'Lead Information',
    description: 'Lead identity, source, customer, and ownership.',
    icon: BadgeInfo,
    fields: ['id', 'source', 'customer', 'assignedSalesperson', 'status'],
  },
  {
    id: 'contact-information',
    title: 'Contact Information',
    description: 'Primary contact person and communication details.',
    icon: Phone,
    fields: ['contactPerson', 'mobile', 'email'],
  },
  {
    id: 'interest-details',
    title: 'Interest Details',
    description: 'Products, estimated budget, and expected closure.',
    icon: PackageSearch,
    fields: ['interestedProducts', 'expectedBudget', 'expectedClosingDate'],
  },
  {
    id: 'Sales Follow-up',
    title: 'Sales Follow-up',
    description: 'Additional remarks for the sales team.',
    icon: Handshake,
    fields: ['notes'],
  },
]

function nextLeadId() {
  const allLeads = [...readStoredLeads(), ...seedLeads]
  const nextNumber = allLeads.reduce((highest, lead) => {
    const number = Number(String(lead.id || '').replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(highest, number) : highest
  }, 1000) + 1

  return `LEAD-${nextNumber}`
}

function LeadField({ children, className = '' }) {
  return <div className={className}>{children}</div>
}

export default function LeadFormPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const basePath = currentUser?.role === ROLES.SALES_OFFICER ? '/sales/leads' : '/admin/leads'
  const [formData, setFormData] = useState(() => ({ ...emptyLeadForm, id: nextLeadId() }))
  const [errors, setErrors] = useState({})
  const [activeSection, setActiveSection] = useState(formSections[0].id)

  const productOptions = useMemo(
    () => seedProducts.map((product) => product.fullName || product.name),
    [],
  )

  const salespersonOptions = useMemo(() => {
    const names = seedUsers
      .filter((user) => user.role === ROLES.SALES_OFFICER)
      .map((user) => user.name)

    if (currentUser?.role === ROLES.SALES_OFFICER && currentUser?.name && !names.includes(currentUser.name)) {
      names.unshift(currentUser.name)
    }

    return names.map((name) => ({ value: name, label: name }))
  }, [currentUser])

  const activeFormSection = formSections.find((section) => section.id === activeSection) || formSections[0]
  const activeSectionIndex = formSections.findIndex((section) => section.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === formSections.length - 1

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const toggleProduct = (productName) => {
    setFormData((current) => ({
      ...current,
      interestedProducts: current.interestedProducts.includes(productName)
        ? current.interestedProducts.filter((name) => name !== productName)
        : [...current.interestedProducts, productName],
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.source) nextErrors.source = 'Lead source is required.'
    if (!formData.customer.trim()) nextErrors.customer = 'Customer is required.'
    if (!formData.mobile.trim()) nextErrors.mobile = 'Mobile number is required.'
    if (formData.mobile.trim() && !/^[0-9+\-\s()]{7,16}$/.test(formData.mobile.trim())) {
      nextErrors.mobile = 'Enter a valid mobile number.'
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!formData.assignedSalesperson) nextErrors.assignedSalesperson = 'Assigned salesperson is required.'
    if (!formData.status) nextErrors.status = 'Lead status is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    saveStoredLead({
      ...formData,
      customer: formData.customer.trim(),
      contactPerson: formData.contactPerson.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      expectedBudget: Number(formData.expectedBudget) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
      notes: formData.notes.trim(),
    })

    navigate(basePath)
  }

  const goToPreviousSection = () => {
    if (isFirstSection) return
    setActiveSection(formSections[activeSectionIndex - 1].id)
  }

  const goToNextSection = () => {
    if (isLastSection) return
    setActiveSection(formSections[activeSectionIndex + 1].id)
  }

  const renderField = (name) => {
    if (name === 'id') {
      return <Input label="Lead ID" value={formData.id} disabled required />
    }

    if (name === 'source') {
      return (
        <Select
          label="Lead Source"
          required
          options={leadSourceOptions}
          value={formData.source}
          onChange={(event) => updateField('source', event.target.value)}
          placeholder="Select lead source"
          error={errors.source}
        />
      )
    }

    if (name === 'customer') {
      return (
        <Input
          label="Customer"
          required
          value={formData.customer}
          onChange={(event) => updateField('customer', event.target.value)}
          placeholder="Search or create customer"
          error={errors.customer}
        />
      )
    }

    if (name === 'assignedSalesperson') {
      return (
        <Select
          label="Assigned Salesperson"
          required
          options={salespersonOptions}
          value={formData.assignedSalesperson}
          onChange={(event) => updateField('assignedSalesperson', event.target.value)}
          placeholder="Select salesperson"
          error={errors.assignedSalesperson}
        />
      )
    }

    if (name === 'status') {
      return (
        <Select
          label="Lead Status"
          required
          options={leadStatusOptions}
          value={formData.status}
          onChange={(event) => updateField('status', event.target.value)}
          placeholder="Select lead status"
          error={errors.status}
        />
      )
    }

    if (name === 'contactPerson') {
      return <Input label="Contact Person" value={formData.contactPerson} onChange={(event) => updateField('contactPerson', event.target.value)} placeholder="Primary contact person" />
    }

    if (name === 'mobile') {
      return <Input label="Mobile Number" required value={formData.mobile} onChange={(event) => updateField('mobile', event.target.value)} placeholder="Contact mobile number" error={errors.mobile} />
    }

    if (name === 'email') {
      return <Input label="Email Address" type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Contact email address" error={errors.email} />
    }

    if (name === 'interestedProducts') {
      return (
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-neutral-700">Interested Products</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {productOptions.map((product) => (
              <label
                key={product}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={formData.interestedProducts.includes(product)}
                  onChange={() => toggleProduct(product)}
                  className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                />
                <span className="min-w-0 truncate">{product}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (name === 'expectedBudget') {
      return <Input label="Expected Budget" type="number" min="0" value={formData.expectedBudget} onChange={(event) => updateField('expectedBudget', event.target.value)} placeholder="Estimated customer budget" />
    }

    if (name === 'expectedClosingDate') {
      return <Input label="Expected Closing Date" type="date" value={formData.expectedClosingDate} onChange={(event) => updateField('expectedClosingDate', event.target.value)} />
    }

    return <Input as="textarea" label="Notes" value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Additional lead remarks" />
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
    >
      <div className="grid min-h-[34rem]" style={{ gridTemplateColumns: '18rem minmax(0, 1fr)' }}>
        <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <nav className="sticky top-6 flex flex-col gap-3">
            {formSections.map((section) => {
              const Icon = section.icon
              const isActive = section.id === activeSection

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-neutral-200'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.title}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{activeFormSection.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeFormSection.description}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(basePath)}>
              Back to Leads
            </Button>
          </div>

          <section className="flex-1 border-b border-neutral-100 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeFormSection.fields.map((field) => (
                <Fragment key={field}>
                  <LeadField className={field === 'interestedProducts' || field === 'notes' ? 'lg:col-span-2' : ''}>
                    {renderField(field)}
                  </LeadField>
                </Fragment>
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={goToPreviousSection} disabled={isFirstSection}>
              Back
            </Button>
            {isLastSection ? (
              <Button type="submit">
                Add Lead
              </Button>
            ) : (
              <Button type="button" onClick={goToNextSection}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
