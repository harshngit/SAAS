import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, CarFront, CheckCircle2, Pencil, UserRound } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { getVehicle, updateVehicle } from '../../api/vehicles'
import { listDeliveryPartners } from '../../api/deliveries'
import {
  capacityLabel,
  deriveAvailability,
  partnerDisplayName,
  vehicleDisplayName,
  vehicleStatusMeta,
  VEHICLE_ACTIVITY_NOTE,
  VEHICLE_ASSIGNMENT_HISTORY_NOTE,
} from './vehicleHelpers'
import {
  getDemoDeliveryPartners,
  getDemoVehicle,
  getDemoVehicleActivity,
  getDemoVehicleAssignments,
  isDemoVehicle,
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

export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDemo = isDemoVehicle(id)

  const [vehicle, setVehicle] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      const record = getDemoVehicle(id)
      setVehicle(record)
      setDrivers(getDemoDeliveryPartners())
      setLoadError(record ? '' : 'Demo vehicle not found.')
      setIsLoading(false)
      return
    }

    const [vehicleResult, partnersResult] = await Promise.all([getVehicle(id), listDeliveryPartners()])
    if (!vehicleResult.success) {
      setLoadError(vehicleResult.error)
      setIsLoading(false)
      return
    }
    setVehicle(vehicleResult.vehicle)
    setDrivers(partnersResult.success ? partnersResult.partners : [])
    setIsLoading(false)
  }, [id, isDemo])

  useEffect(() => {
    load()
  }, [load, refresh])

  const driverName = useMemo(() => {
    if (!vehicle?.defaultDriverId) return ''
    return partnerDisplayName(drivers.find((driver) => driver.id === vehicle.defaultDriverId)) || 'Delivery Partner'
  }, [drivers, vehicle])
  const assignments = useMemo(() => {
    if (isDemo) return getDemoVehicleAssignments(id)
    if (vehicle?.defaultDriverId) {
      return {
        current: { driverName: driverName || 'Delivery Partner', assignedOn: vehicle.assignedOn || '', status: 'Active' },
        history: [],
      }
    }
    return { current: null, history: [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, id, refresh, vehicle, driverName])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activity = useMemo(() => (isDemo ? getDemoVehicleActivity(id) : []), [isDemo, id, refresh])

  const handleEditSave = async (formData) => {
    setIsSaving(true)
    setEditError('')
    if (isDemo) {
      patchDemoVehicle(id, formData)
      setIsSaving(false)
      setEditOpen(false)
      setRefresh((value) => value + 1)
      return
    }
    const result = await updateVehicle(id, formData)
    if (!result.success) {
      setEditError(result.error)
      setIsSaving(false)
      return
    }
    setIsSaving(false)
    setEditOpen(false)
    setRefresh((value) => value + 1)
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
        <StatCard icon={UserRound} iconVariant="primary" label="Current Assignee" value={driverName || 'Unassigned'} />
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
              <Field label="Vehicle Name / Model" value={vehicleDisplayName(vehicle)} />
              <Field label="Vehicle Number" value={vehicle.vehicleNumber} />
              <Field label="Type" value={vehicle.vehicleType} />
              <Field label="Capacity" value={capacityLabel(vehicle)} />
              <Field label="Status" value={status.label} />
              {vehicle.make && <Field label="Make" value={[vehicle.make, vehicle.year].filter(Boolean).join(' · ')} />}
            </div>
          </Card>

          <Card title="Assignment">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Assigned Delivery Partner" value={driverName || 'Unassigned'} />
              <Field label="Assignment Status" value={availability.label} />
              {vehicle.notes && <Field label="Notes" value={vehicle.notes} />}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-4">
          <Card title="Current Assignment">
            {assignments.current ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Delivery Partner" value={assignments.current.driverName} />
                <Field label="Assigned Date" value={formatDate(assignments.current.assignedOn)} />
                <Field label="Status" value={assignments.current.status} />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">This vehicle is not assigned to a delivery partner.</p>
            )}
          </Card>

          {!isDemo ? (
            <Card><p className="py-6 text-center text-sm text-neutral-500">{VEHICLE_ASSIGNMENT_HISTORY_NOTE}</p></Card>
          ) : assignments.history.length === 0 ? (
            <Card><p className="py-6 text-center text-sm text-neutral-500">No assignment changes recorded yet.</p></Card>
          ) : (
            <Card title="Assignment History" className="p-0" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Delivery Partner</th>
                      <th className="px-5 py-3">Action</th>
                      <th className="px-5 py-3">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {assignments.history.map((entry) => (
                      <tr key={entry.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.date)}</td>
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{entry.driverName}</td>
                        <td className="px-5 py-3.5"><Badge variant={entry.action === 'Assigned' ? 'info' : 'neutral'}>{entry.action}</Badge></td>
                        <td className="px-5 py-3.5 text-neutral-500">{entry.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {!isDemo ? (
            <Card><EmptyState icon={Activity} title="Activity not available" description={VEHICLE_ACTIVITY_NOTE} /></Card>
          ) : activity.length === 0 ? (
            <Card><p className="py-8 text-center text-sm text-neutral-500">No operational activity recorded for this vehicle yet.</p></Card>
          ) : (
            <Card title="Activity" className="p-0" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Activity</th>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Warehouse</th>
                      <th className="px-5 py-3">Delivery Partner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {activity.map((entry) => (
                      <tr key={entry.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.date)}</td>
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{entry.activity}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{entry.reference || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{entry.warehouse || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{entry.deliveryPartner || '—'}</td>
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
    </div>
  )
}
