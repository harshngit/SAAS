import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BadgeInfo,
  Building2,
  CreditCard,
  FileText,
  Globe2,
  Handshake,
  LocateFixed,
  MapPin,
  Phone,
  ReceiptText,
  Trash2,
  Upload,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { formatCurrency } from '../../utils/format'
import { customerTypeOptions } from './customerConstants'

const gstNumberPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const today = new Date().toISOString().slice(0, 10)

const baseFields = {
  customerId: '',
  customerType: '',
  customType: '',
  customerName: '',
  legalBusinessName: '',
  displayName: '',
  industry: '',
  customerCategory: '',
  customerSince: today,
  status: 'active',
  primaryContactPerson: '',
  designation: '',
  mobileNumber: '',
  alternateMobileNumber: '',
  email: '',
  website: '',
  billingAddress: '',
  shippingAddress: '',
  sameAsBilling: false,
  city: '',
  state: '',
  country: 'India',
  pinZipCode: '',
  googleMapsLocation: '',
  gstNumber: '',
  panBusinessRegistrationNo: '',
  taxExempt: false,
  taxCategory: '',
  currency: 'INR',
  paymentTerms: '',
  creditLimit: 0,
  outstandingBalance: 0,
  preferredPaymentMethod: '',
  upiId: '',
  bankName: '',
  accountNumber: '',
  ifscSwiftCode: '',
  assignedSalesOfficerId: '',
  leadSource: '',
  territory: '',
  customerPriority: '',
  preferredCommunication: '',
  customerTags: '',
  facebook: '',
  instagram: '',
  linkedin: '',
  twitter: '',
  youtube: '',
  gstCertificate: '',
  panCard: '',
  businessRegistrationCertificate: '',
  addressProof: '',
  purchaseAgreement: '',
  otherDocuments: '',
  dateOfBirth: '',
  anniversaryDate: '',
  referralCustomer: '',
  loyaltyNumber: '',
  notes: '',
}

const makeCustomerId = () => `CUS-${new Date().getFullYear()}-AUTO`

const optionValues = {
  customerType: [
    ...customerTypeOptions,
    ...['Individual', 'Business', 'Government', 'Dealer', 'Distributor', 'Vendor'].map((value) => ({ value, label: value })),
  ],
  industry: ['Food & Beverage', 'Retail', 'Wholesale', 'Corporate', 'Healthcare', 'Education', 'Hospitality', 'Manufacturing', 'Services'],
  customerCategory: ['Retail', 'Wholesale', 'Corporate', 'VIP', 'Dealer', 'Distributor'],
  status: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'blacklisted', label: 'Blacklisted' },
    { value: 'prospect', label: 'Prospect' },
  ],
  country: ['India', 'United States', 'United Arab Emirates', 'Singapore', 'United Kingdom'],
  state: ['Andhra Pradesh', 'Delhi', 'Gujarat', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh'],
  taxCategory: ['Registered', 'Unregistered', 'Exempt'],
  currency: ['INR', 'USD', 'AED', 'SGD', 'GBP'],
  paymentTerms: ['Net 15', 'Net 30', 'Advance', 'Immediate', 'Due on Receipt'],
  preferredPaymentMethod: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'],
  leadSource: ['Website', 'Referral', 'Advertisement', 'Walk-in', 'Sales Visit', 'Marketplace'],
  territory: ['North', 'South', 'East', 'West', 'Central'],
  customerPriority: ['Low', 'Medium', 'High', 'VIP'],
}

const toOptions = (values) => values.map((value) => (typeof value === 'string' ? { value, label: value } : value))

const sectionMeta = {
  'Basic Information': { description: 'Customer identity and profile details.', icon: BadgeInfo },
  'Contact Information': { description: 'Primary contact and online contact details.', icon: Phone },
  'Address Information': { description: 'Billing, shipping, region, and map location.', icon: MapPin },
  'Business & Tax Information': { description: 'Tax registration, business identity, and currency settings.', icon: ReceiptText },
  'Payment Information': { description: 'Credit, payment terms, UPI, and bank details.', icon: CreditCard },
  'Sales & CRM Information': { description: 'Sales ownership, priority, source, territory, and tags.', icon: Handshake },
  'Social Media & Online Presence': { description: 'Customer social profile and channel links.', icon: Globe2 },
  'Documents (Uploads)': { description: 'Tax, registration, address, and agreement documents.', icon: FileText },
  'Additional Information': { description: 'Referral, loyalty, reminders, and internal notes.', icon: Building2 },
}

function section(title, fields) {
  const meta = sectionMeta[title] || {}

  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    title,
    description: meta.description || '',
    icon: meta.icon || BadgeInfo,
    fields,
  }
}

const formSections = [
  section('Basic Information', [
    { name: 'customerId', label: 'Customer ID', description: 'Unique customer identifier. Auto-generated.', type: 'Text (Auto Number)', required: true, input: 'readonly' },
    { name: 'customerType', label: 'Customer Type', description: 'Individual, Business, Government, Dealer, Distributor, Vendor.', type: 'Dropdown', required: true, input: 'select' },
    { name: 'customerName', label: 'Customer Name', description: 'Name of the customer or business.', type: 'Text (Max 100 chars)', required: true, maxLength: 100 },
    { name: 'legalBusinessName', label: 'Legal Business Name', description: 'Registered business name for companies.', type: 'Text' },
    { name: 'displayName', label: 'Display Name', description: 'Name displayed in invoices and reports.', type: 'Text' },
    { name: 'industry', label: 'Industry', description: 'Industry or business category.', type: 'Dropdown', input: 'select' },
    { name: 'customerCategory', label: 'Customer Category', description: 'Retail, Wholesale, Corporate, VIP, etc.', type: 'Dropdown', input: 'select' },
    { name: 'customerSince', label: 'Customer Since', description: 'Date the customer was added.', type: 'Date Picker', required: true, input: 'date' },
    { name: 'status', label: 'Status', description: 'Active, Inactive, Blacklisted, or Prospect.', type: 'Dropdown', required: true, input: 'select' },
  ]),
  section('Contact Information', [
    { name: 'primaryContactPerson', label: 'Primary Contact Person', description: 'Main point of contact.', type: 'Text', required: true },
    { name: 'designation', label: 'Designation', description: "Contact person's designation.", type: 'Text' },
    { name: 'mobileNumber', label: 'Mobile Number', description: 'Primary mobile number.', type: 'Phone Number', required: true, input: 'tel' },
    { name: 'alternateMobileNumber', label: 'Alternate Mobile Number', description: 'Secondary mobile number.', type: 'Phone Number', input: 'tel' },
    { name: 'email', label: 'Email Address', description: 'Primary email.', type: 'Email', input: 'email' },
    { name: 'website', label: 'Website', description: 'Business website.', type: 'URL', input: 'url' },
  ]),
  section('Address Information', [
    { name: 'billingAddress', label: 'Billing Address', description: 'Invoice or billing address.', type: 'Multi-line Text', required: true, input: 'textarea' },
    { name: 'shippingAddress', label: 'Shipping Address', description: 'Delivery address.', type: 'Multi-line Text', input: 'textarea' },
    { name: 'city', label: 'City', description: 'City.', type: 'Text' },
    { name: 'state', label: 'State', description: 'State or province.', type: 'Dropdown/Text', input: 'select' },
    { name: 'country', label: 'Country', description: 'Country.', type: 'Dropdown', input: 'select' },
    { name: 'pinZipCode', label: 'PIN/ZIP Code', description: 'Postal code.', type: 'Text' },
    { name: 'googleMapsLocation', label: 'Google Maps Location', description: 'Geo-location of customer.', type: 'Map Picker', required: true, input: 'map', placeholder: 'Paste Google Maps link or coordinates' },
  ]),
  section('Business & Tax Information', [
    { name: 'gstNumber', label: 'GSTIN / Tax ID', description: 'Tax registration number.', type: 'Text' },
    { name: 'panBusinessRegistrationNo', label: 'PAN / Business Registration No.', description: 'Business identification number.', type: 'Text' },
    { name: 'taxCategory', label: 'Tax Category', description: 'Registered, Unregistered, or Exempt.', type: 'Dropdown', input: 'select' },
    { name: 'currency', label: 'Currency', description: 'Preferred transaction currency.', type: 'Dropdown', input: 'select' },
    { name: 'taxExempt', label: 'Tax Exempt', description: 'Whether tax exempt.', type: 'Toggle', input: 'checkbox', wide: true },
  ]),
  section('Payment Information', [
    { name: 'paymentTerms', label: 'Payment Terms', description: 'Net 15, Net 30, Advance, Immediate, etc.', type: 'Dropdown', input: 'select' },
    { name: 'creditLimit', label: 'Credit Limit', description: 'Maximum allowed credit.', type: 'Decimal', input: 'number' },
    { name: 'outstandingBalance', label: 'Outstanding Balance', description: 'Current outstanding amount.', type: 'Decimal (Read-only/System Calculated)', input: 'moneyReadonly' },
    { name: 'preferredPaymentMethod', label: 'Preferred Payment Method', description: 'Cash, Card, UPI, Bank Transfer, Cheque.', type: 'Dropdown', input: 'select' },
    { name: 'upiId', label: 'UPI ID', description: 'Customer UPI ID.', type: 'Text' },
    { name: 'bankName', label: 'Bank Name', description: 'Bank name.', type: 'Text' },
    { name: 'accountNumber', label: 'Account Number', description: 'Bank account number.', type: 'Text' },
    { name: 'ifscSwiftCode', label: 'IFSC/SWIFT Code', description: 'Bank routing code.', type: 'Text' },
  ]),
  section('Sales & CRM Information', [
    { name: 'assignedSalesOfficerId', label: 'Sales Representative', description: 'Assigned sales executive.', type: 'Searchable Dropdown', required: true, input: 'salesOfficer' },
    { name: 'leadSource', label: 'Lead Source', description: 'Website, Referral, Advertisement, Walk-in, etc.', type: 'Dropdown', input: 'select' },
    { name: 'territory', label: 'Territory', description: 'Sales region.', type: 'Dropdown', input: 'select' },
    { name: 'customerPriority', label: 'Customer Priority', description: 'Low, Medium, High, VIP.', type: 'Dropdown', input: 'select' },
    { name: 'preferredCommunication', label: 'Preferred Communication', description: 'Email, Phone, SMS, WhatsApp.', type: 'Multi-select', placeholder: 'Email, Phone, SMS, WhatsApp' },
    { name: 'customerTags', label: 'Customer Tags', description: 'Labels for segmentation.', type: 'Multi-select / Tags', placeholder: 'VIP, monthly-billing, key-account' },
  ]),
  section('Social Media & Online Presence', [
    { name: 'facebook', label: 'Facebook', description: 'Facebook page or profile.', type: 'URL', input: 'url' },
    { name: 'instagram', label: 'Instagram', description: 'Instagram profile.', type: 'URL', input: 'url' },
    { name: 'linkedin', label: 'LinkedIn', description: 'LinkedIn page or profile.', type: 'URL', input: 'url' },
    { name: 'twitter', label: 'X (Twitter)', description: 'X profile.', type: 'URL', input: 'url' },
    { name: 'youtube', label: 'YouTube', description: 'YouTube channel.', type: 'URL', input: 'url' },
  ]),
  section('Documents (Uploads)', [
    { name: 'gstCertificate', label: 'GST Certificate', description: 'Tax registration certificate.', type: 'PDF/Image Upload', input: 'file' },
    { name: 'panCard', label: 'PAN Card', description: 'PAN document.', type: 'PDF/Image Upload', input: 'file' },
    { name: 'businessRegistrationCertificate', label: 'Business Registration Certificate', description: 'Registration proof.', type: 'PDF Upload', input: 'file' },
    { name: 'addressProof', label: 'Address Proof', description: 'Utility bill, lease agreement, etc.', type: 'PDF/Image Upload', input: 'file' },
    { name: 'purchaseAgreement', label: 'Purchase Agreement', description: 'Signed contract.', type: 'PDF Upload', input: 'file' },
    { name: 'otherDocuments', label: 'Other Documents', description: 'Additional files.', type: 'Multiple File Upload', input: 'file', multiple: true },
  ]),
  section('Additional Information', [
    { name: 'dateOfBirth', label: 'Date of Birth', description: 'For individual customers.', type: 'Date Picker', input: 'date' },
    { name: 'anniversaryDate', label: 'Anniversary Date', description: 'Anniversary reminder.', type: 'Date Picker', input: 'date' },
    { name: 'referralCustomer', label: 'Referral Customer', description: 'Referring customer.', type: 'Searchable Dropdown' },
    { name: 'loyaltyNumber', label: 'Loyalty Number', description: 'Loyalty membership ID.', type: 'Text' },
    { name: 'notes', label: 'Notes', description: 'Internal remarks.', type: 'Multi-line Text', input: 'textarea', wide: true },
  ]),
]

function normalizeComparableForm(data = {}) {
  return Object.keys(baseFields).reduce((result, key) => {
    const value = data[key]
    result[key] = typeof value === 'string' ? value.trim() : value
    return result
  }, {})
}

function hydrateCustomer(formCustomer, isSalesOfficer, currentUser, salesOfficerOptions) {
  const assignedSalesOfficerId =
    formCustomer?.assignedSalesOfficerId ||
    formCustomer?.assigned_sales_officer_id ||
    (isSalesOfficer ? currentUser?.id : '') ||
    salesOfficerOptions[0]?.value ||
    ''

  const customerName = formCustomer?.customerName || formCustomer?.name || ''
  const billingAddress = formCustomer?.billingAddress || formCustomer?.billing_address || formCustomer?.address || ''
  const shippingAddress = formCustomer?.shippingAddress || formCustomer?.deliveryAddress || formCustomer?.delivery_address || ''
  const customerType = formCustomer?.customerType || formCustomer?.type || formCustomer?.category || ''

  return {
    ...baseFields,
    ...formCustomer,
    customerId: formCustomer?.customerId || formCustomer?.id || makeCustomerId(),
    customerType,
    customerName,
    legalBusinessName: formCustomer?.legalBusinessName || formCustomer?.businessName || formCustomer?.business_name || '',
    displayName: formCustomer?.displayName || customerName,
    primaryContactPerson: formCustomer?.primaryContactPerson || customerName,
    mobileNumber: formCustomer?.mobileNumber || formCustomer?.phone || '',
    gstNumber: formCustomer?.gstNumber || formCustomer?.gst_number || '',
    billingAddress,
    shippingAddress,
    sameAsBilling: Boolean(formCustomer?.sameAsBilling),
    assignedSalesOfficerId,
    creditLimit: formCustomer?.creditLimit ?? formCustomer?.credit_limit ?? 0,
    outstandingBalance: formCustomer?.outstandingBalance ?? formCustomer?.outstanding_balance ?? 0,
    status: formCustomer?.status || (formCustomer?.is_active === false ? 'inactive' : 'active'),
    notes: formCustomer?.notes || '',
  }
}

function CustomerField({ children, className = '' }) {
  return <div className={className}>{children}</div>
}

function CustomerUploadField({ field, value, onChange, onRemove, error }) {
  return (
    <div>
      <div className="flex min-h-28 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(10rem,1fr)_auto_auto] xl:items-center">
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold leading-5 text-neutral-900">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </p>
            {value && <p className="mt-1 truncate text-xs font-medium text-primary-700">{value}</p>}
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-16 min-w-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-400">
              Preview
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
              <Upload className="size-3.5" aria-hidden="true" />
              Upload
              <input
                type="file"
                multiple={field.multiple}
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                className="sr-only"
                onChange={(event) => {
                  onChange(Array.from(event.target.files || []).map((file) => file.name).join(', '))
                  event.target.value = ''
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={!value}
              onClick={onRemove}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      </div>
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </div>
  )
}

export default function CustomerForm({
  isOpen,
  onClose,
  customer,
  initialCustomer,
  onSave,
  salesOfficers = [],
  currentUser,
  saving = false,
  formError = '',
}) {
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const [formData, setFormData] = useState(baseFields)
  const [initialFormData, setInitialFormData] = useState(baseFields)
  const [errors, setErrors] = useState({})
  const [activeSection, setActiveSection] = useState(formSections[0].id)

  const salesOfficerOptions = useMemo(
    () => salesOfficers.map((user) => ({ value: user.id, label: user.name })),
    [salesOfficers],
  )
  const activeFormSection = formSections.find((sectionItem) => sectionItem.id === activeSection) || formSections[0]
  const activeSectionIndex = formSections.findIndex((sectionItem) => sectionItem.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === formSections.length - 1

  const goToPreviousSection = () => {
    if (isFirstSection) return
    setActiveSection(formSections[activeSectionIndex - 1].id)
  }

  const goToNextSection = () => {
    if (isLastSection) return
    setActiveSection(formSections[activeSectionIndex + 1].id)
  }

  useEffect(() => {
    if (!isOpen) return

    const nextFormData = hydrateCustomer(customer || initialCustomer || {}, isSalesOfficer, currentUser, salesOfficerOptions)
    setFormData(nextFormData)
    setInitialFormData(nextFormData)
    setErrors({})
    setActiveSection(formSections[0].id)
  }, [customer, currentUser, initialCustomer, isOpen, isSalesOfficer, salesOfficerOptions])

  const hasChanges = !customer || JSON.stringify(normalizeComparableForm(formData)) !== JSON.stringify(normalizeComparableForm(initialFormData))

  const updateField = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value }

      if (field === 'customerName' && !current.displayName) {
        next.displayName = value
      }

      if (field === 'customerName' && !current.primaryContactPerson) {
        next.primaryContactPerson = value
      }

      if (field === 'billingAddress' && current.sameAsBilling) {
        next.shippingAddress = value
      }

      if (field === 'sameAsBilling' && value) {
        next.shippingAddress = current.billingAddress
      }

      return next
    })

    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.customerName.trim()) nextErrors.customerName = 'Customer name is required.'
    if (formData.customerName.trim().length > 100) nextErrors.customerName = 'Customer name must be 100 characters or fewer.'
    if (!formData.customerType) nextErrors.customerType = 'Customer type is required.'
    if (!formData.customerSince) nextErrors.customerSince = 'Customer since date is required.'
    if (!formData.status) nextErrors.status = 'Status is required.'
    if (!formData.primaryContactPerson.trim()) nextErrors.primaryContactPerson = 'Primary contact person is required.'
    if (!formData.mobileNumber.trim()) nextErrors.mobileNumber = 'Mobile number is required.'
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (formData.website && !/^https:\/\//i.test(formData.website.trim())) nextErrors.website = 'Website must begin with https://.'
    if (formData.gstNumber && !gstNumberPattern.test(formData.gstNumber.trim().toUpperCase())) nextErrors.gstNumber = 'Enter a valid GST number.'
    if (!formData.billingAddress.trim()) nextErrors.billingAddress = 'Billing address is required.'
    if (!formData.googleMapsLocation.trim()) nextErrors.googleMapsLocation = 'Google Maps location is required.'
    if (!formData.assignedSalesOfficerId) nextErrors.assignedSalesOfficerId = 'Assign a sales representative.'
    if (Number(formData.creditLimit) < 0) nextErrors.creditLimit = 'Credit limit cannot be negative.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!hasChanges) return
    if (!validate()) return

    onSave({
      ...formData,
      name: formData.customerName.trim(),
      type: formData.customerType,
      phone: formData.mobileNumber.trim(),
      email: formData.email.trim(),
      gstNumber: formData.gstNumber ? formData.gstNumber.trim().toUpperCase() : null,
      businessName: formData.legalBusinessName.trim() || formData.customerName.trim(),
      billingAddress: formData.billingAddress.trim(),
      deliveryAddress: formData.shippingAddress.trim() || formData.billingAddress.trim(),
      creditLimit: Number(formData.creditLimit) || 0,
      notes: formData.notes.trim(),
      isActive: formData.status !== 'inactive' && formData.status !== 'blacklisted',
    })
  }

  const renderField = (field) => {
    const commonProps = {
      label: field.label,
      value: formData[field.name] ?? '',
      onChange: (event) => updateField(field.name, event.target.value),
      error: errors[field.name],
      required: field.required,
      placeholder: field.placeholder,
      maxLength: field.maxLength,
    }

    if (field.input === 'select') {
      return (
        <Select
          {...commonProps}
          options={toOptions(optionValues[field.name] || [])}
          placeholder={`Select ${field.label.toLowerCase()}`}
        />
      )
    }

    if (field.input === 'salesOfficer') {
      return (
        <Select
          {...commonProps}
          options={salesOfficerOptions}
          placeholder="Select sales representative"
          disabled={isSalesOfficer}
        />
      )
    }

    if (field.input === 'textarea') {
      return <Input {...commonProps} as="textarea" />
    }

    if (field.input === 'map') {
      const encodedLocation = encodeURIComponent(formData[field.name] || '')
      const mapUrl = formData[field.name]
        ? `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
        : 'https://www.google.com/maps'

      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <div className={`flex rounded-xl border bg-neutral-50 transition-all focus-within:bg-white focus-within:ring-4 ${
            errors[field.name]
              ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-500/15'
              : 'border-neutral-200 focus-within:border-primary-400 focus-within:ring-primary-500/12'
          }`}>
            <input
              value={formData[field.name] || ''}
              onChange={(event) => updateField(field.name, event.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-r-xl border-l border-neutral-200 px-3.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
              title="Open map picker"
            >
              <LocateFixed className="size-4" aria-hidden="true" />
              Pick
            </a>
          </div>
          {errors[field.name] && <span className="text-xs text-red-600">{errors[field.name]}</span>}
        </div>
      )
    }

    if (field.input === 'checkbox') {
      return (
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={Boolean(formData[field.name])}
            onChange={(event) => updateField(field.name, event.target.checked)}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
          />
          {field.label}
        </label>
      )
    }

    if (field.input === 'file') {
      return (
        <CustomerUploadField
          field={field}
          value={formData[field.name]}
          onChange={(value) => updateField(field.name, value)}
          onRemove={() => updateField(field.name, '')}
          error={errors[field.name]}
        />
      )
    }

    if (field.input === 'readonly' || field.input === 'moneyReadonly') {
      const value = field.input === 'moneyReadonly' ? formatCurrency(Number(formData[field.name]) || 0) : formData[field.name] || 'System calculated'

      return (
        <Input
          label={field.label}
          value={value}
          readOnly
          disabled
          error={errors[field.name]}
        />
      )
    }

    return (
      <Input
        {...commonProps}
        type={field.input === 'date' ? 'date' : field.input === 'number' ? 'number' : field.input === 'email' ? 'email' : field.input === 'url' ? 'url' : field.input === 'tel' ? 'tel' : 'text'}
        min={field.input === 'number' ? '0' : undefined}
        onChange={(event) => updateField(field.name, field.name === 'gstNumber' ? event.target.value.toUpperCase() : event.target.value)}
      />
    )
  }

  if (!isOpen) return null

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="w-full overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
      >
        <div className="grid min-h-[34rem]" style={{ gridTemplateColumns: '22rem minmax(0, 1fr)' }}>
          <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <nav className="sticky top-6 flex flex-col gap-3">
              {formSections.map((sectionItem) => {
                const Icon = sectionItem.icon
                const isActive = sectionItem.id === activeSection

                return (
                  <button
                    key={sectionItem.id}
                    type="button"
                    onClick={() => setActiveSection(sectionItem.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-neutral-200'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{sectionItem.title}</span>
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
              <div className="flex flex-wrap items-center gap-2">
                {customer && (
                  <Badge variant={customer.outstandingBalance > 0 ? 'warning' : 'neutral'}>
                    Outstanding {formatCurrency(customer.outstandingBalance || 0)}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#063B00] text-[#063B00] hover:border-[#063B00] hover:bg-primary-50 hover:text-[#063B00]"
                  onClick={onClose}
                >
                  Back to Customers
                </Button>
              </div>
            </div>

            <section className="flex-1 border-b border-neutral-100 py-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeFormSection.fields.map((field) => (
                  <Fragment key={field.name}>
                    <CustomerField className={field.wide ? 'lg:col-span-2' : ''}>
                      {renderField(field)}
                    </CustomerField>
                    {activeFormSection.id === 'address-information' && field.name === 'shippingAddress' && (
                      <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3.5 text-sm text-neutral-600 lg:col-span-2">
                        <input
                          type="checkbox"
                          checked={formData.sameAsBilling}
                          onChange={(event) => updateField('sameAsBilling', event.target.checked)}
                          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                        />
                        Shipping address same as billing address
                      </label>
                    )}
                  </Fragment>
                ))}
              </div>
            </section>

            {formError && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={goToPreviousSection} disabled={saving || isFirstSection}>
                Back
              </Button>
              {isLastSection ? (
                <Button type="submit" loading={saving} disabled={!hasChanges}>
                  {customer ? 'Save Changes' : 'Add New Customer'}
                </Button>
              ) : (
                <Button type="button" onClick={goToNextSection} disabled={saving}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
