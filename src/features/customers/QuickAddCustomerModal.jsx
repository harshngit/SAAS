import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { createCustomer } from '../../api/customers'

const emptyForm = {
  customerName: '',
  mobileNumber: '',
  primaryContactPerson: '',
  email: '',
  gstNumber: '',
  billingAddress: '',
  notes: '',
}

export default function QuickAddCustomerModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const handleClose = () => {
    setForm(emptyForm)
    setSameAsBilling(true)
    setFormError('')
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.customerName.trim() || !form.mobileNumber.trim() || !form.primaryContactPerson.trim() || !form.billingAddress.trim()) {
      setFormError('Please fill in all required fields.')
      return
    }

    setIsSaving(true)
    setFormError('')

    const result = await createCustomer({
      customerName: form.customerName,
      // This quick-add form skips the full customer-type picker CustomerForm has, but the
      // backend requires a non-empty customer_type - default to the most common case rather
      // than sending '' (which the backend normalizes to null and then rejects outright).
      customerType: 'individual',
      phone: form.mobileNumber,
      primaryContactPerson: form.primaryContactPerson,
      email: form.email,
      gstNumber: form.gstNumber,
      billingAddress: form.billingAddress,
      shippingAddress: sameAsBilling ? form.billingAddress : '',
      notes: form.notes,
    })

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    onCreated({
      id: result.customer.id,
      name: result.customer.name || form.customerName,
      phone: result.customer.phone || form.mobileNumber,
      email: result.customer.email || form.email,
    })
    setForm(emptyForm)
    setSameAsBilling(true)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quick Add Customer" className="w-full max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="-mt-2 text-sm text-neutral-500">Add basic customer details to create a new customer and continue.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Customer Name" required value={form.customerName} onChange={updateField('customerName')} placeholder="Enter customer name" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Mobile Number<span className="text-red-500"> *</span>
            </label>
            <div className="flex gap-2">
              <span className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-600">+91</span>
              <input
                type="tel"
                required
                value={form.mobileNumber}
                onChange={updateField('mobileNumber')}
                placeholder="Enter mobile number"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Contact Person" required value={form.primaryContactPerson} onChange={updateField('primaryContactPerson')} placeholder="Enter contact person name" />
          <Input label="Email (Optional)" type="email" value={form.email} onChange={updateField('email')} placeholder="Enter email address" />
        </div>

        <Input label="GSTIN (Optional)" value={form.gstNumber} onChange={updateField('gstNumber')} placeholder="Enter GSTIN" />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            Billing Address<span className="text-red-500"> *</span>
          </label>
          <textarea
            required
            value={form.billingAddress}
            maxLength={300}
            onChange={updateField('billingAddress')}
            placeholder="Enter full billing address"
            className="h-20 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <p className="text-right text-xs text-neutral-400">{form.billingAddress.length} / 300</p>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={sameAsBilling}
            onChange={(event) => setSameAsBilling(event.target.checked)}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
          />
          Delivery Address is same as Billing Address
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">Notes (Optional)</label>
          <textarea
            value={form.notes}
            maxLength={200}
            onChange={updateField('notes')}
            placeholder="Enter any notes about this customer"
            className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <p className="text-right text-xs text-neutral-400">{form.notes.length} / 200</p>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={isSaving}>Create Customer & Continue</Button>
        </div>
      </form>
    </Modal>
  )
}
