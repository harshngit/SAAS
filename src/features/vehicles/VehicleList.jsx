import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CarFront, CheckCircle2, Edit, Eye, Plus, RotateCw, Search, Trash2, Truck } from 'lucide-react'
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from '../../api/vehicles'
import { listDeliveryPartners } from '../../api/deliveries'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import {
  AVAILABILITY_FILTER_OPTIONS,
  assignedPartnerName,
  capacityLabel,
  deriveAvailability,
  vehicleDisplayName,
  vehicleHasDriver,
  vehicleStatus,
  vehicleStatusMeta,
  VEHICLE_SORT_OPTIONS,
  VEHICLE_STATUS_FILTER_OPTIONS,
  VEHICLE_TYPE_FILTER_OPTIONS,
} from './vehicleHelpers'
import {
  createDemoVehicle,
  getDemoDeliveryPartners,
  getDemoVehicles,
  isDemoVehicle,
  patchDemoVehicle,
} from './vehicleDemoData'
import VehicleForm from './VehicleForm'

export default function VehicleList() {
  const navigate = useNavigate()
  // Explicit demo split (task section 26): demo mode -> demo fixtures only, no real API call;
  // real mode -> real API only, empty response is a real empty state (never a demo fallback).
  const isDemo = DEMO_MODE
  const demoHasFixtures = DEMO_MODE && !DEMO_EMPTY

  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Demo mode: local fixtures only, no real API call.
    if (isDemo) {
      setVehicles(demoHasFixtures ? getDemoVehicles() : [])
      setDrivers(demoHasFixtures ? getDemoDeliveryPartners() : [])
      setIsLoading(false)
      return
    }

    const [vehiclesResult, partnersResult] = await Promise.all([listVehicles(), listDeliveryPartners()])
    setDrivers(partnersResult.success ? partnersResult.partners : [])

    // Real mode: a failure is a real error; an empty list is a truthful empty state.
    if (!vehiclesResult.success) {
      setVehicles([])
      setListError(vehiclesResult.error)
      setIsLoading(false)
      return
    }

    setVehicles(vehiclesResult.vehicles)
    setIsLoading(false)
  }, [isDemo, demoHasFixtures])

  useEffect(() => {
    load()
  }, [load])

  // Driver name comes straight from the backend `assigned_delivery_partner` brief - no per-row
  // lookup, no role slugs (task section 3).
  const assignedName = (vehicle) => assignedPartnerName(vehicle)

  const stats = useMemo(() => {
    return vehicles.reduce(
      (acc, vehicle) => {
        const active = vehicleStatus(vehicle) === 'active'
        const assigned = active && vehicleHasDriver(vehicle)
        return {
          total: acc.total + 1,
          active: acc.active + (active ? 1 : 0),
          assigned: acc.assigned + (assigned ? 1 : 0),
          available: acc.available + (active && !assigned ? 1 : 0),
        }
      },
      { total: 0, active: 0, assigned: 0, available: 0 },
    )
  }, [vehicles])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = vehicles.filter((vehicle) => {
      const matchesSearch =
        !query ||
        [vehicleDisplayName(vehicle), vehicle.vehicleNumber, assignedPartnerName(vehicle)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all' || vehicleStatus(vehicle) === statusFilter
      const matchesAvailability = availabilityFilter === 'all' || deriveAvailability(vehicle).key === availabilityFilter
      const matchesType = typeFilter === 'all' || vehicle.vehicleType === typeFilter
      return matchesSearch && matchesStatus && matchesAvailability && matchesType
    })

    return filtered.sort((left, right) => {
      if (sortFilter === 'number') return String(left.vehicleNumber).localeCompare(String(right.vehicleNumber))
      if (sortFilter === 'name') return vehicleDisplayName(left).localeCompare(vehicleDisplayName(right))
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    })
  }, [vehicles, search, statusFilter, availabilityFilter, typeFilter, sortFilter])

  const openForm = (vehicle = null) => {
    setEditingVehicle(vehicle)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    setFormError('')

    if (isDemo || (editingVehicle && isDemoVehicle(editingVehicle.id))) {
      if (editingVehicle) patchDemoVehicle(editingVehicle.id, formData)
      else createDemoVehicle(formData)
      await load()
      setIsSaving(false)
      setIsFormOpen(false)
      setEditingVehicle(null)
      return
    }

    const result = editingVehicle ? await updateVehicle(editingVehicle.id, formData) : await createVehicle(formData)
    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }
    await load()
    setIsSaving(false)
    setIsFormOpen(false)
    setEditingVehicle(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')

    if (isDemoVehicle(deleteTarget.id)) {
      setVehicles((current) => current.filter((vehicle) => vehicle.id !== deleteTarget.id))
      setIsDeleting(false)
      setDeleteTarget(null)
      return
    }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Vehicles</h1>
          <p className="mt-1 text-sm text-neutral-500">Your delivery fleet — who each vehicle is assigned to and whether it can be used.</p>
        </div>
        <Button type="button" onClick={() => openForm()}>
          <Plus className="size-4" aria-hidden="true" />
          Add Vehicle
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} iconVariant="primary" label="Total Vehicles" value={stats.total} />
        <StatCard icon={CheckCircle2} iconVariant="success" label="Active Vehicles" value={stats.active} />
        <StatCard icon={CarFront} iconVariant="info" label="Assigned Vehicles" value={stats.assigned} />
        <StatCard icon={CarFront} iconVariant="warning" label="Available Vehicles" value={stats.available} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Vehicle / Number / Delivery Partner"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <Select options={VEHICLE_STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
          <Select options={AVAILABILITY_FILTER_OPTIONS} value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
          <Select options={VEHICLE_TYPE_FILTER_OPTIONS} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-36" triggerClassName="bg-white" />
          <Select options={VEHICLE_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
        </div>

        <div className="overflow-x-auto">
          {listError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={load}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-10"><LoadingSpinner label="Loading vehicles..." /></div>
          ) : vehicles.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No vehicles yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first delivery vehicle to start assigning deliveries.</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No vehicles match the selected filters.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {rows.map((vehicle) => {
                  const status = vehicleStatusMeta(vehicle)
                  const availability = deriveAvailability(vehicle)
                  return (
                    <div key={vehicle.id} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)" onClick={() => navigate(`/admin/vehicles/${vehicle.id}`)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">
                            {vehicleDisplayName(vehicle)}
                            {isDemoVehicle(vehicle.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                          </p>
                          <p className="truncate text-xs text-neutral-500">{vehicle.vehicleNumber} · {vehicle.vehicleType || '—'}</p>
                        </div>
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-neutral-400">Assigned To</p><p className="text-neutral-700">{assignedName(vehicle)}</p></div>
                        <div><p className="text-xs text-neutral-400">Availability</p><p className="text-neutral-700">{availability.label}</p></div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <table className="hidden w-full min-w-4xl text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    <th className="whitespace-nowrap px-4 py-3.5">Vehicle</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Vehicle Number</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Type</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Capacity</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Assigned To</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Availability</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {rows.map((vehicle) => {
                    const status = vehicleStatusMeta(vehicle)
                    const availability = deriveAvailability(vehicle)
                    return (
                      <tr key={vehicle.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`/admin/vehicles/${vehicle.id}`)}>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="font-medium text-neutral-900">{vehicleDisplayName(vehicle)}</span>
                          {isDemoVehicle(vehicle.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{vehicle.vehicleNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{vehicle.vehicleType || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{capacityLabel(vehicle)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-700">{assignedName(vehicle)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={status.variant} dot>{status.label}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={availability.variant}>{availability.label}</Badge></td>
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                          <ActionMenu
                            items={[
                              { label: 'View', icon: Eye, onClick: () => navigate(`/admin/vehicles/${vehicle.id}`) },
                              { label: 'Edit', icon: Edit, onClick: () => openForm(vehicle) },
                              { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(vehicle) },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Card>

      <Modal isOpen={isFormOpen} onClose={() => !isSaving && (setIsFormOpen(false), setEditingVehicle(null))} title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'} size="2xl">
        <VehicleForm
          vehicle={editingVehicle}
          demoMode={editingVehicle ? isDemoVehicle(editingVehicle.id) : isDemo}
          drivers={drivers}
          existingNumbers={vehicles.filter((vehicle) => vehicle.id !== editingVehicle?.id).map((vehicle) => vehicle.vehicleNumber)}
          saving={isSaving}
          formError={formError}
          onClose={() => { setIsFormOpen(false); setEditingVehicle(null) }}
          onSave={handleSave}
        />
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !isDeleting && setDeleteTarget(null)} title="Remove Vehicle">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Remove {deleteTarget?.vehicleNumber || 'this vehicle'}? Vehicles with delivery, loading or vehicle-stock history can&apos;t be removed — set them to Inactive instead.
          </p>
          {deleteError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Remove</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
