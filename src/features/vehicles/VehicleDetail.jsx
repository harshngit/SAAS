import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, CarFront, CheckCircle2, Pencil, UserRound } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  assignVehicleDriver,
  getVehicle,
  getVehicleActivity,
  getVehicleAssignments,
  updateVehicle,
} from '../../api/vehicles'
import { listDeliveryPartners } from '../../api/deliveries'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import {
  assignedPartnerName,
  capacityLabel,
  deriveAvailability,
  isOperationallyUsable,
  partnerDisplayName,
  vehicleActivityLabel,
  vehicleDisplayName,
  vehicleStatusMeta,
} from './vehicleHelpers'
import {
  getDemoDeliveryPartners,
  getDemoVehicle,
  getDemoVehicleActivity,
  getDemoVehicleAssignments,
  patchDemoVehicle,
} from './vehicleDemoData'
import VehicleForm from './VehicleForm'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value === 0 ? '0' : value || '—'}</p>
    </div>
  )
}

// Explicit demo split (task section 26): DEMO_MODE is the network boundary; DEMO_EMPTY = demo
// mode with zero fixtures.
export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDemo = DEMO_MODE
  const demoHasFixtures = DEMO_MODE && !DEMO_EMPTY

  const [vehicle, setVehicle] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [activity, setActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignDriverId, setAssignDriverId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      if (!demoHasFixtures) {
        setVehicle(null)
        setLoadError('Demo vehicle not found.')
        setIsLoading(false)
        return
      }
      const record = getDemoVehicle(id)
      setVehicle(record)
      setDrivers(getDemoDeliveryPartners())
      setAssignments(record ? getDemoVehicleAssignments(id) : [])
      setActivity(record ? getDemoVehicleActivity(id) : [])
      setLoadError(record ? '' : 'Demo vehicle not found.')
      setIsLoading(false)
      return
    }

    const [vehicleResult, partnersResult, assignmentsResult, activityResult] = await Promise.all([
      getVehicle(id),
      listDeliveryPartners(),
      getVehicleAssignments(id),
      getVehicleActivity(id),
    ])
    if (!vehicleResult.success) {
      setLoadError(vehicleResult.error)
      setIsLoading(false)
      return
    }
    setVehicle(vehicleResult.vehicle)
    setDrivers(partnersResult.success ? partnersResult.partners : [])
    setAssignments(assignmentsResult.success ? assignmentsResult.assignments : [])
    setActivity(activityResult.success ? activityResult.activity : [])
    setIsLoading(false)
  }, [id, isDemo, demoHasFixtures])

  useEffect(() => {
    load()
  }, [load, refresh])

  const reloadAll = () => setRefresh((value) => value + 1)

  const driverName = vehicle ? assignedPartnerName(vehicle) : 'Unassigned'
  const hasDriver = driverName && driverName !== 'Unassigned'

  const driverOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...drivers.map((driver) => ({ value: driver.id, label: partnerDisplayName(driver) }))],
    [drivers],
  )

  const handleEditSave = async (formData) => {
    setIsSaving(true)
    setEditError('')
    if (isDemo) {
      patchDemoVehicle(id, formData)
      setIsSaving(false)
      setEditOpen(false)
      reloadAll()
      return
    }
    const result = await updateVehicle(id, formData)
    if (!result.success) {
      // Surfaces backend guards verbatim, e.g. the active-loading-session block on a
      // status change to inactive / maintenance (task section 18).
      setEditError(result.error)
      setIsSaving(false)
      return
    }
    setIsSaving(false)
    setEditOpen(false)
    reloadAll()
  }

  const openAssign = () => {
    setAssignError('')
    setAssignDriverId(vehicle?.defaultDriverId || '')
    setAssignOpen(true)
  }

  // One PATCH /vehicles/{id} { default_driver_id }. The backend opens/closes the assignment
  // history atomically - the frontend just refreshes server state afterwards.
  const submitAssign = async (driverId) => {
    setIsAssigning(true)
    setAssignError('')
    if (isDemo) {
      patchDemoVehicle(id, { defaultDriverId: driverId || '' })
      setIsAssigning(false)
      setAssignOpen(false)
      reloadAll()
      return
    }
    const result = await assignVehicleDriver(id, driverId || null)
    setIsAssigning(false)
    if (!result.success) {
      setAssignError(result.error)
      return
    }
    setAssignOpen(false)
    reloadAll()
  }

  if (isLoading) return <LoadingSpinner label="Loading vehicle..." />

  if (loadError || !vehicle) {
    return (
      <Card>
        <EmptyState
          icon={CarFront}
          title="Vehicle not found"
          description={loadError || 'This vehicle may have been removed.'}
          action={{ label: 'Back to Vehicles', onClick: () => navigate('/admin/vehicles') }}
        />
      </Card>
    )
  }

  const status = vehicleStatusMeta(vehicle)
  const availability = deriveAvailability(vehicle)
  const operational = isOperationallyUsable(vehicle)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/vehicles')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{vehicleDisplayName(vehicle)}</h1>
              <span className="text-sm text-neutral-400">{vehicle.vehicleNumber}</span>
              <Badge variant={status.variant} dot>{status.label}</Badge>
              <Badge variant={availability.variant}>{availability.label}</Badge>
              {isDemo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditError(''); setEditOpen(true) }}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit Vehicle
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} iconVariant={status.variant === 'success' ? 'success' : 'neutral'} label="Status" value={status.label} />
        <StatCard icon={CarFront} iconVariant="info" label="Availability" value={availability.label} />
        <StatCard icon={UserRound} iconVariant="primary" label="Current Assignee" value={driverName} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card title="Vehicle Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Vehicle Number" value={vehicle.vehicleNumber} />
              <Field label="Type" value={vehicle.vehicleType} />
              <Field label="Capacity" value={capacityLabel(vehicle)} />
              <Field label="Make" value={vehicle.make} />
              <Field label="Model" value={vehicle.model} />
              <Field label="Year" value={vehicle.year} />
              <Field label="Status" value={status.label} />
              <Field label="Created At" value={formatDate(vehicle.createdAt)} />
              <Field label="Updated At" value={formatDate(vehicle.updatedAt)} />
              {vehicle.notes && <Field label="Notes" value={vehicle.notes} />}
            </div>
          </Card>

          <Card
            title="Assignment"
            actions={
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={openAssign}>
                  {hasDriver ? 'Change Driver' : 'Assign Driver'}
                </Button>
                {hasDriver && (
                  <Button type="button" size="sm" variant="ghost" loading={isAssigning} onClick={() => submitAssign('')}>
                    Unassign
                  </Button>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Assigned Delivery Partner" value={driverName} />
              <Field label="Assignment Status" value={availability.label} />
              {vehicle.assignedDeliveryPartner?.phone && <Field label="Contact" value={vehicle.assignedDeliveryPartner.phone} />}
              {vehicle.assignedDeliveryPartner?.email && <Field label="Email" value={vehicle.assignedDeliveryPartner.email} />}
            </div>
            {assignError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{assignError}</div>}
            {!operational && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                This vehicle is {status.label} — it is not available for vehicle loading or delivery assignment.
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-4">
          {assignments.length === 0 ? (
            <Card><p className="py-6 text-center text-sm text-neutral-500">No assignment history for this vehicle yet.</p></Card>
          ) : (
            <Card title="Assignment History" className="p-0" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Driver</th>
                      <th className="px-5 py-3">Assigned At</th>
                      <th className="px-5 py-3">Unassigned At</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {assignments.map((entry) => (
                      <tr key={entry.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{entry.driverName || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.assignedAt)}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{entry.isCurrent ? '—' : formatDate(entry.unassignedAt)}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={entry.isCurrent ? 'success' : 'neutral'}>{entry.isCurrent ? 'Current' : 'Previous'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {activity.length === 0 ? (
            <Card><EmptyState icon={Activity} title="No activity yet" description="Vehicle events will appear here as the vehicle is used." /></Card>
          ) : (
            <Card title="Activity" className="p-0" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Event</th>
                      <th className="px-5 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {activity.map((entry) => (
                      <tr key={entry.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.createdAt)}</td>
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{vehicleActivityLabel(entry.type)}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{entry.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal isOpen={editOpen} onClose={() => !isSaving && setEditOpen(false)} title="Edit Vehicle" size="2xl">
        <VehicleForm vehicle={vehicle} demoMode={isDemo} drivers={drivers} saving={isSaving} error={editError} onClose={() => setEditOpen(false)} onSave={handleEditSave} />
      </Modal>

      <Modal isOpen={assignOpen} onClose={() => !isAssigning && setAssignOpen(false)} title={hasDriver ? 'Change Driver' : 'Assign Driver'} size="md">
        <div className="space-y-4">
          <Select
            label="Delivery Partner"
            options={driverOptions}
            value={assignDriverId}
            onChange={(event) => setAssignDriverId(event.target.value)}
          />
          {assignError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{assignError}</div>}
          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isAssigning} onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="button" loading={isAssigning} onClick={() => submitAssign(assignDriverId)}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
