import { useEffect, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { LEAD_MANUAL_STATUS_OPTIONS, LEAD_SEGMENT_OPTIONS, LEAD_SOURCE_OPTIONS, LEAD_TYPE_OPTIONS } from '../../api/leads'
import { formatLeadStatus } from './leadActivity'
import InterestedProductsField from './InterestedProductsField'

export const customerCategoryOptions = ['Retail', 'Wholesale', 'Corporate', 'VIP', 'Dealer', 'Distributor'].map((value) => ({
  value,
  label: value,
}))

export function LeadEditForm({ lead, customerOptions, salespersonOptions, saving, formError, onClose, onSave, lockAssignee = false }) {
  const [formData, setFormData] = useState(lead)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(lead)
    setErrors({})
  }, [lead])

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  // Sales Officers can't reassign a lead to someone else - the picker is locked to
  // the person it's already assigned to. Admins may assign to anyone or leave it
  // Unassigned, so the field is no longer strictly required here.
  const assigneeSelectOptions = lockAssignee
    ? salespersonOptions
    : [{ value: '', label: 'Unassigned' }, ...salespersonOptions]

  const validate = () => {
    const nextErrors = {}
    if (!formData.leadSource) nextErrors.leadSource = 'Lead source is required.'
    if (!formData.mobileNumber?.trim()) nextErrors.mobileNumber = 'Mobile number is required.'
    if (lockAssignee && !formData.assignedSalespersonId) nextErrors.assignedSalespersonId = 'Assigned salesperson is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  if (!formData) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prospect / Business Name"
          value={formData.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
        <Input
          label="Contact Person"
          value={formData.contactPerson}
          onChange={(event) => updateField('contactPerson', event.target.value)}
        />
        <Select
          label="Lead Source"
          required
          options={LEAD_SOURCE_OPTIONS}
          value={formData.leadSource}
          onChange={(event) => updateField('leadSource', event.target.value)}
          error={errors.leadSource}
        />
        <Select
          label="Existing Customer"
          options={[{ value: '', label: 'No existing customer' }, ...customerOptions]}
          value={formData.customerId}
          onChange={(event) => updateField('customerId', event.target.value)}
        />
        <Input
          label="Mobile Number"
          required
          value={formData.mobileNumber}
          onChange={(event) => updateField('mobileNumber', event.target.value)}
          error={errors.mobileNumber}
        />
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(event) => updateField('email', event.target.value)}
        />
        <Select
          label="Assigned Salesperson"
          required={lockAssignee}
          options={assigneeSelectOptions}
          value={formData.assignedSalespersonId}
          onChange={(event) => updateField('assignedSalespersonId', event.target.value)}
          error={errors.assignedSalespersonId}
          disabled={lockAssignee}
        />
        {formData.leadStatus === 'won' ? (
          // A converted lead's status is locked - it can't be changed back by hand.
          <Input label="Lead Status" value={formatLeadStatus('won')} readOnly disabled />
        ) : (
          <Select
            label="Lead Status"
            required
            options={LEAD_MANUAL_STATUS_OPTIONS}
            value={formData.leadStatus}
            onChange={(event) => updateField('leadStatus', event.target.value)}
          />
        )}
        <Select
          label="Lead Type"
          options={LEAD_TYPE_OPTIONS}
          value={formData.leadType || ''}
          onChange={(event) => updateField('leadType', event.target.value)}
          placeholder="Select a type"
        />
        <Select
          label="Segment"
          options={LEAD_SEGMENT_OPTIONS}
          value={formData.segment || ''}
          onChange={(event) => updateField('segment', event.target.value)}
          placeholder="Select a segment"
        />
        <InterestedProductsField
          value={formData.interestedProduct}
          onChange={(next) => updateField('interestedProduct', next)}
          className="sm:col-span-2"
        />
        <Input
          as="textarea"
          label="Notes"
          value={formData.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          inputClassName="min-h-20"
          className="sm:col-span-2"
        />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Lead</Button>
      </div>
    </form>
  )
}

export const customerTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
  { value: 'government', label: 'Government' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'vendor', label: 'Vendor' },
]

export const customerStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'prospect', label: 'Prospect' },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ConvertLeadForm({ lead, salespersonOptions, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    name: lead?.name || lead?.customerName || '',
    primaryContactPerson: lead?.contactPerson || '',
    phone: lead?.mobileNumber || '',
    email: lead?.email || '',
    gstNumber: '',
    billingAddress: '',
    deliveryAddress: '',
    assignedSalesOfficerId: lead?.assignedSalespersonId || '',
    creditLimit: '',
    openingBalance: '',
    category: '',
    notes: lead?.notes || '',
    customerType: 'individual',
    customerSince: todayIso(),
    status: 'active',
    googleMapsLocation: '',
  }))
  const [errors, setErrors] = useState({})

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.name.trim()) nextErrors.name = 'Business / customer name is required.'
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  if (!lead) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-neutral-500">
        Review and confirm the details below - this creates a real customer record linked back to this lead.
      </p>
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Business / Customer Name"
            required
            value={formData.name}
            onChange={(event) => updateField('name', event.target.value)}
            error={errors.name}
          />
          <Input
            label="Primary Contact Person"
            value={formData.primaryContactPerson}
            onChange={(event) => updateField('primaryContactPerson', event.target.value)}
          />
          <Input
            label="Phone"
            required
            value={formData.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            error={errors.phone}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
          <Select
            label="Customer Type"
            options={customerTypeOptions}
            value={formData.customerType}
            onChange={(event) => updateField('customerType', event.target.value)}
          />
          <Select
            label="Status"
            options={customerStatusOptions}
            value={formData.status}
            onChange={(event) => updateField('status', event.target.value)}
          />
          <Input
            label="Customer Since"
            type="date"
            value={formData.customerSince}
            onChange={(event) => updateField('customerSince', event.target.value)}
          />
          <Input
            label="GST Number"
            value={formData.gstNumber}
            onChange={(event) => updateField('gstNumber', event.target.value)}
          />
          <Select
            label="Category"
            options={[{ value: '', label: 'No category' }, ...customerCategoryOptions]}
            value={formData.category}
            onChange={(event) => updateField('category', event.target.value)}
          />
          <Select
            label="Assigned Sales Officer"
            options={[{ value: '', label: 'Unassigned' }, ...salespersonOptions]}
            value={formData.assignedSalesOfficerId}
            onChange={(event) => updateField('assignedSalesOfficerId', event.target.value)}
          />
          <Input
            label="Credit Limit"
            type="number"
            min="0"
            step="0.01"
            value={formData.creditLimit}
            onChange={(event) => updateField('creditLimit', event.target.value)}
          />
          <Input
            label="Opening Balance"
            type="number"
            step="0.01"
            value={formData.openingBalance}
            onChange={(event) => updateField('openingBalance', event.target.value)}
          />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-neutral-700">Google Maps Location</label>
            <div className="flex rounded-xl border border-neutral-200 bg-neutral-50 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/12">
              <input
                value={formData.googleMapsLocation}
                onChange={(event) => updateField('googleMapsLocation', event.target.value)}
                placeholder="Paste Google Maps link or coordinates"
                className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              <a
                href={
                  formData.googleMapsLocation
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.googleMapsLocation)}`
                    : 'https://www.google.com/maps'
                }
                target="_blank"
                rel="noreferrer"
                title="Open map picker"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-r-xl border-l border-neutral-200 px-3.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
              >
                <LocateFixed className="size-4" aria-hidden="true" />
                Pick
              </a>
            </div>
          </div>
          <Input
            label="Billing Address"
            value={formData.billingAddress}
            onChange={(event) => updateField('billingAddress', event.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label="Delivery Address"
            value={formData.deliveryAddress}
            onChange={(event) => updateField('deliveryAddress', event.target.value)}
            className="sm:col-span-2"
          />
          <Input
            as="textarea"
            label="Notes"
            value={formData.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            inputClassName="min-h-20"
            className="sm:col-span-2"
          />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Convert to Customer</Button>
      </div>
    </form>
  )
}
