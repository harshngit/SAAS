import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { formatCurrency } from '../../utils/format'
import { customerTypeOptions } from './customerConstants'

const gstNumberPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const emptyForm = {
  name: '',
  type: '',
  customType: '',
  phone: '',
  email: '',
  gstNumber: '',
  billingAddress: '',
  deliveryAddress: '',
  sameAsBilling: false,
  city: '',
  assignedSalesOfficerId: '',
  creditLimit: 0,
}

export default function CustomerForm({
  isOpen,
  onClose,
  customer,
  onSave,
  salesOfficers = [],
  currentUser,
  saving = false,
  formError = '',
}) {
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  const salesOfficerOptions = useMemo(
    () => salesOfficers.map((user) => ({ value: user.id, label: user.name })),
    [salesOfficers],
  )

  useEffect(() => {
    if (!isOpen) return

    const assignedSalesOfficerId =
      customer?.assignedSalesOfficerId ||
      (isSalesOfficer ? currentUser?.id : '') ||
      salesOfficerOptions[0]?.value ||
      ''

    setFormData({
      ...emptyForm,
      ...customer,
      gstNumber: customer?.gstNumber || '',
      billingAddress: customer?.billingAddress || customer?.address || '',
      deliveryAddress: customer?.deliveryAddress || '',
      sameAsBilling: Boolean(customer?.sameAsBilling),
      assignedSalesOfficerId,
      creditLimit: customer?.creditLimit ?? 0,
      customType: customer?.customType || '',
    })
    setErrors({})
  }, [customer, currentUser?.id, isOpen, isSalesOfficer, salesOfficerOptions])

  const updateField = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value }

      if (field === 'billingAddress' && current.sameAsBilling) {
        next.deliveryAddress = value
      }

      if (field === 'sameAsBilling' && value) {
        next.deliveryAddress = current.billingAddress
      }

      return next
    })

    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    const resolvedType = formData.type === 'Other' ? formData.customType.trim() : formData.type

    if (!formData.name.trim()) nextErrors.name = 'Customer name is required.'
    if (!resolvedType) nextErrors.type = 'Customer type is required.'
    if (formData.type === 'Other' && !formData.customType.trim()) nextErrors.customType = 'Enter the custom type.'
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required.'
    if (formData.gstNumber && !gstNumberPattern.test(formData.gstNumber.trim().toUpperCase())) {
      nextErrors.gstNumber = 'Enter a valid GST number.'
    }
    if (!formData.billingAddress.trim()) nextErrors.billingAddress = 'Billing address is required.'
    if (!formData.city.trim()) nextErrors.city = 'City is required.'
    if (!formData.assignedSalesOfficerId) nextErrors.assignedSalesOfficerId = 'Assign a sales officer.'
    if (Number(formData.creditLimit) < 0) nextErrors.creditLimit = 'Credit limit cannot be negative.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    const resolvedType = formData.type === 'Other' ? formData.customType.trim() : formData.type

    onSave({
      ...formData,
      type: resolvedType,
      gstNumber: formData.gstNumber ? formData.gstNumber.trim().toUpperCase() : null,
      billingAddress: formData.billingAddress.trim(),
      deliveryAddress: formData.deliveryAddress.trim(),
      city: formData.city.trim(),
      creditLimit: Number(formData.creditLimit) || 0,
    })
  }

  if (!isOpen) return null

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
      >
        <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-neutral-900">
              {customer ? 'Update customer profile' : 'Add a new customer'}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Keep billing, delivery, credit, and sales ownership details in one place.
            </p>
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
              className="border-[#063B00]! bg-white! text-[#063B00]! hover:bg-primary-900! hover:text-white!"
              onClick={onClose}
            >
              Back to Customers
            </Button>
          </div>
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
              <Input label="Customer Name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} error={errors.name} required />
              <Select label="Type" options={customerTypeOptions} placeholder="Select customer type" value={formData.type} onChange={(event) => updateField('type', event.target.value)} error={errors.type} />
              {formData.type === 'Other' && (
                <Input label="Custom Type" value={formData.customType} onChange={(event) => updateField('customType', event.target.value)} error={errors.customType} required />
              )}
              <Input label="Phone" type="tel" value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} error={errors.phone} required />
              <Input label="Email" type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} />
              <Input label="City" value={formData.city} onChange={(event) => updateField('city', event.target.value)} error={errors.city} required />
              <Input label="GST Number" value={formData.gstNumber} onChange={(event) => updateField('gstNumber', event.target.value.toUpperCase())} error={errors.gstNumber} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">2</span>
              <p className="text-sm font-semibold text-neutral-900">Billing and delivery</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input label="Billing Address" as="textarea" className="lg:col-span-2" value={formData.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} error={errors.billingAddress} required />
              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-600 lg:col-span-2">
                <input
                  type="checkbox"
                  checked={formData.sameAsBilling}
                  onChange={(event) => updateField('sameAsBilling', event.target.checked)}
                  className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
                />
                Delivery address same as billing
              </label>
              <Input label="Delivery Address" as="textarea" className="lg:col-span-2" value={formData.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} disabled={formData.sameAsBilling} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">3</span>
              <p className="text-sm font-semibold text-neutral-900">Ownership and credit</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Select
                label="Assigned Sales Officer"
                options={salesOfficerOptions}
                placeholder="Select sales officer"
                value={formData.assignedSalesOfficerId}
                onChange={(event) => updateField('assignedSalesOfficerId', event.target.value)}
                error={errors.assignedSalesOfficerId}
                disabled={isSalesOfficer}
              />
              <Input label="Credit Limit" type="number" min="0" value={formData.creditLimit} onChange={(event) => updateField('creditLimit', event.target.value)} error={errors.creditLimit} />
              {customer && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-neutral-700">Outstanding Balance</span>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-semibold text-neutral-900">
                    {formatCurrency(customer.outstandingBalance || 0)}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {customer ? 'Save Changes' : 'Save Customer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
