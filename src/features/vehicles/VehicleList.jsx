import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarFront, Edit, Plus, RotateCw, Search, Trash2, User } from 'lucide-react'
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from '../../api/vehicles'
import { listDeliveryPartners } from '../../api/deliveries'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'

const emptyForm = {
  vehicleNumber: '',
  vehicleType: '',
  capacityKg: '',
  defaultDriverId: '',
  isActive: true,
}

function VehicleForm({ vehicle, drivers, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(vehicle ? { ...emptyForm, ...vehicle } : emptyForm)
    setErrors({})
  }, [vehicle])

  const driverOptions = useMemo(
    () => drivers.map((driver) => ({ value: driver.id, label: driver.name })),
    [drivers],
  )

  const validate = () => {
    const nextErrors = {}
    if (!formData.vehicleNumber.trim()) nextErrors.vehicleNumber = 'Enter a vehicle number.'
    if (formData.capacityKg !== '' && Number(formData.capacityKg) < 0) {
      nextErrors.capacityKg = 'Capacity cannot be negative.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}

      <Input
        label="Vehicle Number"
        placeholder="e.g. MH12AB1234"
        value={formData.vehicleNumber}
        onChange={(event) => setFormData((current) => ({ ...current, vehicleNumber: event.target.value }))}
        error={errors.vehicleNumber}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Vehicle Type"
          placeholder="e.g. Truck, Van"
          value={formData.vehicleType}
          onChange={(event) => setFormData((current) => ({ ...current, vehicleType: event.target.value }))}
        />
        <Input
          label="Capacity (kg)"
          type="number"
          min="0"
          placeholder="Load capacity in kg"
          value={formData.capacityKg}
          onChange={(event) => setFormData((current) => ({ ...current, capacityKg: event.target.value }))}
          error={errors.capacityKg}
        />
      </div>
      <Select
        label="Default Driver"
        options={driverOptions}
        value={formData.defaultDriverId}
        onChange={(event) => setFormData((current) => ({ ...current, defaultDriverId: event.target.value }))}
        placeholder={driverOptions.length ? 'Select a delivery partner' : 'No delivery partners available'}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Active
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {vehicle ? 'Save Changes' : 'Register Vehicle'}
        </Button>
      </div>
    </form>
  )
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadVehicles = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const [vehiclesResult, partnersResult] = await Promise.all([listVehicles(), listDeliveryPartners()])

    if (!vehiclesResult.success) {
      setVehicles([])
      setListError(vehiclesResult.error)
      setIsLoading(false)
      return
    }

    setVehicles(vehiclesResult.vehicles)

    if (partnersResult.success) {
      setDrivers(partnersResult.partners)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  const driverNameById = useMemo(() => {
    const map = new Map()
    drivers.forEach((driver) => map.set(driver.id, driver.name))
    return map
  }, [drivers])

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return vehicles

    return vehicles.filter((vehicle) =>
      [vehicle.vehicleNumber, vehicle.vehicleType, driverNameById.get(vehicle.defaultDriverId)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    )
  }, [vehicles, searchTerm, driverNameById])

  const openForm = (vehicle = null) => {
    setEditingVehicle(vehicle)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingVehicle(null)
    setFormError('')
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = editingVehicle
      ? await updateVehicle(editingVehicle.id, formData)
      : await createVehicle(formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    await loadVehicles()
    setIsSaving(false)
    closeForm()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteVehicle(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setVehicles((current) => current.filter((vehicle) => vehicle.id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Vehicles</h2>
              <p className="mt-1 text-sm text-neutral-500">Register and manage the delivery vehicles used to fulfil orders.</p>
            </div>
            <Button type="button" size="sm" onClick={() => openForm()}>
              <Plus className="size-4" aria-hidden="true" />
              Register Vehicle
            </Button>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex justify-end">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search vehicles"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadVehicles}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading vehicles..." />
          ) : vehicles.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No vehicles yet</p>
              <p className="mt-1 text-sm text-neutral-500">Register your first delivery vehicle to start assigning deliveries.</p>
              <Button type="button" className="mt-4" onClick={() => openForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Register Vehicle
              </Button>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No vehicles match this search.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Vehicle Number</th>
                  <th className="whitespace-nowrap px-4 py-3">Type</th>
                  <th className="whitespace-nowrap px-4 py-3">Capacity</th>
                  <th className="whitespace-nowrap px-4 py-3">Default Driver</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <CarFront className="size-4" aria-hidden="true" />
                        </div>
                        <span className="font-medium text-neutral-900">{vehicle.vehicleNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{vehicle.vehicleType || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {vehicle.capacityKg !== null && vehicle.capacityKg !== undefined ? `${vehicle.capacityKg} kg` : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        {vehicle.defaultDriverId && <User className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />}
                        {driverNameById.get(vehicle.defaultDriverId) || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={vehicle.isActive ? 'success' : 'neutral'} dot>
                        {vehicle.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => openForm(vehicle) },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(vehicle),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
          <span>
            {filteredVehicles.length === 0 ? '0' : `1 to ${filteredVehicles.length}`} of {vehicles.length}
          </span>
          <span>Vehicles</span>
        </div>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingVehicle ? 'Edit Vehicle' : 'Register Vehicle'}
        className="max-w-lg"
      >
        <VehicleForm
          vehicle={editingVehicle}
          drivers={drivers}
          saving={isSaving}
          formError={formError}
          onClose={closeForm}
          onSave={handleSave}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Vehicle"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.vehicleNumber || 'this vehicle'}? This cannot be undone. Vehicles referenced by an active
            delivery can't be deleted - deactivate them instead.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
