import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import {
  assignmentWarning,
  CAPACITY_UNIT_OPTIONS,
  partnerDisplayName,
  VEHICLE_TYPE_OPTIONS,
} from './vehicleHelpers'

const EMPTY = {
  name: '',
  vehicleNumber: '',
  vehicleType: '',
  capacityKg: '',
  capacityUnit: 'kg',
  make: '',
  model: '',
  year: '',
  defaultDriverId: '',
  status: 'active',
  isActive: true,
  notes: '',
}

const REAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
const DEMO_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
]

// `demoMode` unlocks the fields the live /vehicles API cannot persist
// (name/model, capacity unit, Maintenance state, notes, make/model/year).
export default function VehicleForm({ vehicle, demoMode = false, drivers = [], existingNumbers = [], saving, formError, error, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (vehicle) {
      setForm({
        ...EMPTY,
        ...vehicle,
        status: vehicle.status || (vehicle.isActive === false ? 'inactive' : 'active'),
        capacityKg: vehicle.capacityKg ?? '',
        year: vehicle.year ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    setFieldErrors({})
  }, [vehicle])

  const update = (patch) => setForm((current) => ({ ...current, ...patch }))

  const driverOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...drivers.map((driver) => ({ value: driver.id, label: partnerDisplayName(driver) }))],
    [drivers],
  )

  const warning = assignmentWarning(form)

  const handleSubmit = (event) => {
    event.preventDefault()
    const next = {}
    if (demoMode && !form.name.trim()) next.name = 'Enter the vehicle name / model.'
    if (!form.vehicleNumber.trim()) next.vehicleNumber = 'Enter a vehicle number.'
    else if (
      existingNumbers.map((value) => String(value || '').trim().toLowerCase()).includes(form.vehicleNumber.trim().toLowerCase())
    ) {
      next.vehicleNumber = 'A vehicle with this number already exists.'
    }
    if (!form.vehicleType.trim()) next.vehicleType = 'Select a vehicle type.'
    if (form.capacityKg !== '' && Number(form.capacityKg) < 0) next.capacityKg = 'Capacity cannot be negative.'
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return
    onSave({ ...form, isActive: form.status === 'active' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(formError || error) && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError || error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {demoMode && (
          <Input label="Vehicle Name / Model" required className="sm:col-span-2" value={form.name} error={fieldErrors.name} onChange={(event) => update({ name: event.target.value })} placeholder="e.g. Tata Ace Gold" />
        )}
        <Input label="Vehicle Number" required value={form.vehicleNumber} error={fieldErrors.vehicleNumber} onChange={(event) => update({ vehicleNumber: event.target.value })} placeholder="MH-02-AB-1234" />
        <Select label="Vehicle Type" required options={[{ value: '', label: 'Select type' }, ...VEHICLE_TYPE_OPTIONS]} value={form.vehicleType} onChange={(event) => update({ vehicleType: event.target.value })} />
        <Input label="Capacity" type="number" min="0" step="1" value={form.capacityKg} error={fieldErrors.capacityKg} onChange={(event) => update({ capacityKg: event.target.value })} />
        {demoMode ? (
          <Select label="Capacity Unit" options={CAPACITY_UNIT_OPTIONS} value={form.capacityUnit} onChange={(event) => update({ capacityUnit: event.target.value })} />
        ) : (
          <Input label="Capacity Unit" value="kg" disabled />
        )}
        {demoMode && <Input label="Make" value={form.make} onChange={(event) => update({ make: event.target.value })} />}
        {demoMode && <Input label="Year" type="number" min="0" step="1" value={form.year} onChange={(event) => update({ year: event.target.value })} />}
        <Select label="Assigned Delivery Partner" options={driverOptions} value={form.defaultDriverId} onChange={(event) => update({ defaultDriverId: event.target.value })} />
        <Select label="Status" required options={demoMode ? DEMO_STATUS_OPTIONS : REAL_STATUS_OPTIONS} value={form.status} onChange={(event) => update({ status: event.target.value })} />
        {demoMode && <Input as="textarea" label="Notes" className="sm:col-span-2" value={form.notes} onChange={(event) => update({ notes: event.target.value })} />}
      </div>

      {warning && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>{vehicle ? 'Save Changes' : 'Add Vehicle'}</Button>
      </div>
    </form>
  )
}
