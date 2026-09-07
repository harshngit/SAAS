import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const EMPTY = {
  name: '',
  code: '',
  address: '',
  addressLine2: '',
  city: '',
  state: '',
  pinCode: '',
  country: 'India',
  managerName: '',
  contactNumber: '',
  email: '',
  notes: '',
  isActive: true,
  isDefault: false,
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

// The live /warehouses API now persists the full master: name, code, address, city, state,
// pincode, country, contact_person (Manager / In-Charge), contact_number, email, notes,
// is_default, is_active. `demoMode` only still gates `addressLine2` (no backend field for it).
export default function WarehouseForm({ warehouse, demoMode = false, saving, formError, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(warehouse ? { ...EMPTY, ...warehouse } : EMPTY)
    setErrors({})
  }, [warehouse])

  const update = (patch) => setForm((current) => ({ ...current, ...patch }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Enter a warehouse name.'
    if (!form.code.trim()) next.code = 'Enter a warehouse code.'
    if (!form.address.trim()) next.address = 'Enter address line 1.'
    if (!form.city.trim()) next.city = 'Enter a city.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Warehouse Name" required value={form.name} error={errors.name} onChange={(event) => update({ name: event.target.value })} />
        <Input label="Warehouse Code" required placeholder="WH-MUM-001" value={form.code} error={errors.code} onChange={(event) => update({ code: event.target.value })} />
        <Input label="Address Line 1" required className="sm:col-span-2" value={form.address} error={errors.address} onChange={(event) => update({ address: event.target.value })} />
        {demoMode && (
          <Input label="Address Line 2" className="sm:col-span-2" value={form.addressLine2} onChange={(event) => update({ addressLine2: event.target.value })} />
        )}
        <Input label="City" required value={form.city} error={errors.city} onChange={(event) => update({ city: event.target.value })} />
        <Input label="State" value={form.state} error={errors.state} onChange={(event) => update({ state: event.target.value })} />
        <Input label="PIN Code" value={form.pinCode} error={errors.pinCode} onChange={(event) => update({ pinCode: event.target.value })} />
        <Input label="Country" value={form.country} onChange={(event) => update({ country: event.target.value })} />
        <Input label="Manager / In-Charge" value={form.managerName} onChange={(event) => update({ managerName: event.target.value })} />
        <Input label="Phone" value={form.contactNumber} onChange={(event) => update({ contactNumber: event.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={form.isActive ? 'active' : 'inactive'}
          onChange={(event) => update({ isActive: event.target.value === 'active' })}
        />
        <Input as="textarea" label="Notes" className="sm:col-span-2" value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(event) => update({ isDefault: event.target.checked })}
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        Set as default warehouse
      </label>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>{warehouse ? 'Save Changes' : 'Add Warehouse'}</Button>
      </div>
    </form>
  )
}
