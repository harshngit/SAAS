import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { supplierCategoryOptions } from './supplierConstants'

const gstNumberPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const emptyForm = {
  name: '',
  contactPerson: '',
  category: '',
  phone: '',
  email: '',
  gstNumber: '',
  city: '',
  address: '',
}

export default function SupplierForm({ isOpen, onClose, supplier, onSave, saving = false, formError = '' }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setFormData({ ...emptyForm, ...supplier })
    setErrors({})
  }, [isOpen, supplier])

  if (!isOpen) return null

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.name.trim()) nextErrors.name = 'Supplier name is required.'
    if (!formData.category) nextErrors.category = 'Category is required.'
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required.'
    if (formData.gstNumber && !gstNumberPattern.test(formData.gstNumber.trim().toUpperCase())) {
      nextErrors.gstNumber = 'Enter a valid GST number.'
    }
    if (!formData.city.trim()) nextErrors.city = 'City is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    onSave({
      ...formData,
      gstNumber: formData.gstNumber ? formData.gstNumber.trim().toUpperCase() : null,
      city: formData.city.trim(),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">
            {supplier ? 'Update supplier profile' : 'Add a new supplier'}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Track contact details, category and GST information for every vendor.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Back to Suppliers
        </Button>
      </div>

      {formError && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">1</span>
            <p className="text-sm font-semibold text-neutral-900">Basic information</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Input label="Supplier Name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} error={errors.name} required />
            <Input label="Contact Person" value={formData.contactPerson} onChange={(event) => updateField('contactPerson', event.target.value)} />
            <Select label="Category" options={supplierCategoryOptions} placeholder="Select category" value={formData.category} onChange={(event) => updateField('category', event.target.value)} error={errors.category} />
            <Input label="Phone" type="tel" value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} error={errors.phone} required />
            <Input label="Email" type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} />
            <Input label="GST Number" value={formData.gstNumber} onChange={(event) => updateField('gstNumber', event.target.value.toUpperCase())} error={errors.gstNumber} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">2</span>
            <p className="text-sm font-semibold text-neutral-900">Location</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Input label="City" value={formData.city} onChange={(event) => updateField('city', event.target.value)} error={errors.city} required />
            <Input label="Address" as="textarea" className="lg:col-span-2" value={formData.address} onChange={(event) => updateField('address', event.target.value)} />
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {supplier ? 'Save Changes' : 'Save Supplier'}
        </Button>
      </div>
    </form>
  )
}
