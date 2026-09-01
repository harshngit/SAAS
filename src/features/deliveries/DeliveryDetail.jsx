import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  Camera,
  Check,
  Download,
  PackageCheck,
  PackageSearch,
  Pencil,
  Truck,
  UserCog,
  Wallet,
  Warehouse as WarehouseIcon,
  X,
  XOctagon,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { DELIVERY_STAGES, deliveryStageIndex, getDeliveryStage, getNextDeliveryAction } from './deliveryStage'
import RejectDeliveryModal from './RejectDeliveryModal'
import RecordCollectionModal from './RecordCollectionModal'
import {
  acceptDelivery,
  confirmDelivery,
  dispatchDelivery,
  downloadDeliveryChallan,
  getDelivery,
  listDeliveryPartners,
  loadDeliveryOntoVehicle,
  markDeliveryReady,
  pickDeliveryItems,
  reassignDelivery,
  updateDeliveryPlan,
} from '../../api/deliveries'
import { getSalesWorkflowSettings } from '../../api/settings'
import { getFileUrl, uploadFiles } from '../../api/files'
import { listVehicles } from '../../api/vehicles'
import { listWarehouses } from '../../api/warehouses'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

// The 6-stage flow (Assigned -> Accepted -> Picking -> Vehicle Loaded -> In Transit ->
// Delivered) and its badge vocabulary are derived from the backend's collapsed status in
// ./deliveryStage - this file never maps raw status values itself.

function WorkflowTimeline({ delivery }) {
  const stage = getDeliveryStage(delivery)

  // rejected / failed / cancelled leave the linear flow; partially_delivered still shows it.
  if (stage.offFlow && stage.key !== 'partially_delivered') {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Badge variant={stage.variant} dot>{stage.label}</Badge>
        <span>This delivery left the standard workflow.</span>
      </div>
    )
  }

  const currentIndex = deliveryStageIndex(delivery)

  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {DELIVERY_STAGES.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step.key} className="flex min-w-20 flex-1 items-start gap-0">
            <div className="flex flex-col items-center">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? 'bg-primary-600 text-white'
                    : isCurrent
                      ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                      : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </div>
              <p className={`mt-1.5 whitespace-nowrap text-center text-[0.7rem] font-medium ${isDone || isCurrent ? 'text-neutral-800' : 'text-neutral-400'}`}>
                {step.label}
              </p>
            </div>
            {index < DELIVERY_STAGES.length - 1 && (
              <div className={`mt-3.5 h-0.5 flex-1 ${isDone ? 'bg-primary-500' : 'bg-neutral-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getFileLabel(file, index) {
  return file?.name || file?.filename || file?.original_name || file?.file_name || `Photo ${index + 1}`
}

function PreviewThumb({ url, label }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
        Preview
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={label}
      onError={() => setFailed(true)}
      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}

function PreviewGrid({ files }) {
  if (!files.length) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {files.map((file, index) => {
        const label = getFileLabel(file, index)
        const url = file?.url || file?.file_url || ''

        return (
          <a
            key={`${url || label}-${index}`}
            href={url || undefined}
            target={url ? '_blank' : undefined}
            rel={url ? 'noreferrer' : undefined}
            className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
            title={label}
          >
            <div className="aspect-square bg-neutral-100">
              <PreviewThumb url={url} label={label} />
            </div>
            <div className="border-t border-neutral-100 px-3 py-2">
              <p className="truncate text-xs font-medium text-neutral-700">{label}</p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

function DetailCard({ title, value, subtitle }) {
  return (
    <Card title={title}>
      <p className="text-sm font-medium text-neutral-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    </Card>
  )
}

function InfoField({ label, value, subtitle }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 font-medium text-neutral-900 break-words">{value || 'N/A'}</p>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
    </div>
  )
}

export default function DeliveryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isAdminView = window.location.pathname.startsWith('/admin')
  const basePath = isAdminView ? '/admin/deliveries' : '/delivery/deliveries'

  const [delivery, setDelivery] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState('')

  // Delivery partner: reject
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)

  // Delivery partner: confirm/POD
  const [deliveredQuantities, setDeliveredQuantities] = useState({})
  const [receiverName, setReceiverName] = useState('')
  const [notes, setNotes] = useState('')
  const [podFiles, setPodFiles] = useState([])
  const [isUploadingPod, setIsUploadingPod] = useState(false)
  const [showFailForm, setShowFailForm] = useState(false)
  const [failureReason, setFailureReason] = useState('')

  // Delivery partner: picking
  const [pickedQuantities, setPickedQuantities] = useState({})

  // Collection (financial action, gated by the firm's delivery_collection_allowed setting)
  const [collectionAllowed, setCollectionAllowed] = useState(true)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [collectionRecorded, setCollectionRecorded] = useState(false)

  // Admin: reassignment
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false)
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [reassignPartnerId, setReassignPartnerId] = useState('')
  const [reassignVehicleId, setReassignVehicleId] = useState('')
  const [reassignScheduledDate, setReassignScheduledDate] = useState('')

  // Admin: edit / cancel plan
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ deliveryPartnerId: '', vehicleId: '', scheduledDate: '', deliveryAddress: '', notes: '' })
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelNotes, setCancelNotes] = useState('')

  const loadDetail = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getDelivery(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setDelivery(result.delivery)
    setDeliveredQuantities(
      Object.fromEntries(
        result.delivery.items.map((item) => [item.id, item.loadedQuantity || item.plannedQuantity || 0]),
      ),
    )
    setPickedQuantities(
      Object.fromEntries(
        result.delivery.items.map((item) => [item.id, item.pickedQuantity || item.plannedQuantity || 0]),
      ),
    )
    setIsLoading(false)
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!isAdminView) return
    let isMounted = true

    // Only the admin/back-office can read settings and record collections - the delivery
    // partner role is 403'd on both, so it gets a read-only hand-off note instead.
    getSalesWorkflowSettings().then((result) => {
      if (isMounted && result.success) setCollectionAllowed(result.settings.deliveryCollectionAllowed !== false)
    })

    Promise.all([listDeliveryPartners(), listVehicles(), listWarehouses()]).then(([partnersResult, vehiclesResult, warehousesResult]) => {
      if (!isMounted) return
      if (partnersResult.success) setDeliveryPartners(partnersResult.partners)
      if (vehiclesResult.success) setVehicles(vehiclesResult.vehicles)
      if (warehousesResult.success) setWarehouses(warehousesResult.warehouses)
    })

    return () => {
      isMounted = false
    }
  }, [isAdminView])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading delivery..." />
      </Card>
    )
  }

  if (loadError || !delivery) {
    return (
      <Card>
        <EmptyState
          icon={Truck}
          title="Delivery not found"
          description={loadError || 'This delivery may have been removed or the link is out of date.'}
          action={{ label: 'Back to Deliveries', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const deliveryStage = getDeliveryStage(delivery)
  const stageKey = deliveryStage.key

  // The delivery partner sees exactly ONE next action for the current stage; the admin sees
  // no workflow buttons, only reassign / edit / cancel overrides. See ./deliveryStage.
  const nextAction = getNextDeliveryAction(delivery, { isAdmin: isAdminView })
  const isDeliveredStage = ['delivered', 'partially_delivered'].includes(stageKey)
  const canReassign = isAdminView && ['assigned', 'rejected'].includes(stageKey)
  const canEdit = isAdminView && ['assigned', 'rejected'].includes(stageKey)
  const canCancel = isAdminView && ['assigned', 'accepted', 'picking'].includes(stageKey)
  const amountDue = Number(delivery.amountDue) || 0
  // Recording a receipt is a back-office action; the delivery partner sees a hand-off note.
  const canRecordCollection = isAdminView && isDeliveredStage && collectionAllowed && amountDue > 0
  const showCollectionHandoff = !isAdminView && isDeliveredStage && amountDue > 0
  const warehouseName = delivery.warehouseName || warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.name || delivery.warehouseId
  const podPhotoFileIds = Array.isArray(delivery.pod?.photo_file_ids) ? delivery.pod.photo_file_ids.filter(Boolean) : []
  const podSignatureFileId = delivery.pod?.signature_file_id || ''
  const podPreviewFiles = podPhotoFileIds.map((fileId, index) => ({ url: getFileUrl(fileId), name: `Delivery Photo ${index + 1}` }))
  const customerLabel = delivery.customerBusinessName || delivery.customerName || 'No customer'
  const orderStatusLabel = delivery.order?.status || delivery.orderStatus || 'N/A'
  const fulfilmentStatusLabel = delivery.order?.fulfilmentStatus || delivery.fulfilmentStatus || 'N/A'
  const hasBatchTracking = delivery.items.some((item) => item.batchNumber || item.expiryDate)
  const hasSerialTracking = delivery.items.some((item) => item.serialNumbers.length > 0)

  const handleAccept = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await acceptDelivery(delivery.id)

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Delivery accepted', message: 'Start picking when you are ready to load.' })
  }

  const handleRejected = (updatedDelivery) => {
    if (updatedDelivery) setDelivery(updatedDelivery)
    else loadDetail()
    showToast({ title: 'Delivery rejected', message: 'The sales team has been notified to reassign this delivery.' })
  }

  const handleStartPicking = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await pickDeliveryItems(
      delivery.id,
      delivery.items.map((item) => ({ deliveryItemId: item.id, pickedQuantity: pickedQuantities[item.id] ?? 0 })),
    )

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Items picked', message: 'Load the vehicle when picking is complete.' })
  }

  // One button: mark ready (if the backend still needs it) then load the goods onto the
  // vehicle. This is the only place warehouse stock physically moves, so it must never run twice.
  const handleMarkLoaded = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    if (delivery.pickingStatus === 'picked' || delivery.pickingStatus === 'not_started') {
      const readyResult = await markDeliveryReady(delivery.id)
      // A "already ready" style error is fine - only bail on a real failure.
      if (!readyResult.success && !/already|ready|state|status/i.test(readyResult.error || '')) {
        setActionError(readyResult.error)
        setIsActing(false)
        return
      }
    }

    const result = await loadDeliveryOntoVehicle(delivery.id)

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Vehicle loaded', message: 'Start the delivery when you leave the warehouse.' })
  }

  const handleDispatch = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await dispatchDelivery(delivery.id)

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Delivery started', message: 'Delivery is now in transit.' })
  }

  const handleReassign = async () => {
    if (isActing) return
    if (!reassignPartnerId) {
      setActionError('Select a new delivery partner to reassign to.')
      return
    }

    setIsActing(true)
    setActionError('')

    const result = await reassignDelivery(delivery.id, {
      deliveryPartnerId: reassignPartnerId,
      vehicleId: reassignVehicleId || undefined,
      scheduledDate: reassignScheduledDate || undefined,
    })

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    setIsReassignModalOpen(false)
    setReassignPartnerId('')
    setReassignVehicleId('')
    setReassignScheduledDate('')
    showToast({ title: 'Delivery reassigned', message: 'The new delivery partner has been notified.' })
  }

  const openEditModal = () => {
    setEditForm({
      deliveryPartnerId: delivery.deliveryPartnerId || '',
      vehicleId: delivery.vehicleId || '',
      scheduledDate: delivery.scheduledDate ? delivery.scheduledDate.slice(0, 10) : '',
      deliveryAddress: delivery.deliveryAddress || '',
      notes: delivery.notes || '',
    })
    setActionError('')
    setIsEditModalOpen(true)
  }

  const handleEditSave = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await updateDeliveryPlan(delivery.id, {
      deliveryPartnerId: editForm.deliveryPartnerId || undefined,
      vehicleId: editForm.vehicleId || undefined,
      scheduledDate: editForm.scheduledDate || undefined,
      deliveryAddress: editForm.deliveryAddress || undefined,
      notes: editForm.notes,
    })

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    setIsEditModalOpen(false)
    showToast({ title: 'Delivery updated', message: 'The delivery plan has been updated.' })
  }

  const handleCancelDelivery = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await updateDeliveryPlan(delivery.id, {
      status: 'cancelled',
      notes: cancelNotes.trim() || undefined,
    })

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    setIsCancelModalOpen(false)
    setCancelNotes('')
    showToast({ title: 'Delivery cancelled', message: 'This delivery has been abandoned.' })
  }

  const handlePodUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setIsUploadingPod(true)
    const result = await uploadFiles(files)
    setIsUploadingPod(false)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    setPodFiles((current) => [...current, ...result.files])
  }

  const handleConfirm = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')

    const result = await confirmDelivery(delivery.id, {
      failed: false,
      items: delivery.items.map((item) => ({
        deliveryItemId: item.id,
        deliveredQuantity: deliveredQuantities[item.id] ?? 0,
      })),
      podPhotoFileIds: podFiles.map((file) => file.file_id).filter(Boolean),
      receiverName: receiverName.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Delivery confirmed', message: 'Delivery outcome recorded.' })
  }

  const handleMarkFailed = async () => {
    if (isActing) return
    if (!failureReason.trim()) {
      setActionError('Enter a reason for the failed delivery.')
      return
    }

    setIsActing(true)
    setActionError('')

    const result = await confirmDelivery(delivery.id, {
      failed: true,
      failureReason: failureReason.trim(),
      notes: notes.trim() || undefined,
    })

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    setShowFailForm(false)
    showToast({ title: 'Delivery marked failed', message: failureReason.trim() })
  }

  const handleDownloadChallan = async () => {
    const result = await downloadDeliveryChallan(delivery.id)
    if (!result.success) setActionError(result.error)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Deliveries
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{delivery.deliveryNumber}</h1>
              <Badge variant={deliveryStage.variant} dot>{deliveryStage.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Order {delivery.orderNumber || 'N/A'} | {delivery.customerName || 'Customer not assigned'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canReassign && (
            <Button variant="primary" size="sm" onClick={() => setIsReassignModalOpen(true)}>
              <UserCog className="size-4" aria-hidden="true" />
              Reassign Delivery
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEditModal}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit Delivery
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelModalOpen(true)}>
              <XOctagon className="size-4" aria-hidden="true" />
              Cancel Delivery
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadChallan}>
            <Download className="size-4" aria-hidden="true" />
            Delivery Challan
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <Card title="Delivery Progress">
        <WorkflowTimeline delivery={delivery} />
      </Card>

      {/* ---- Current action - the delivery partner sees exactly one per stage ---- */}
      {nextAction?.type === 'accept_reject' && (
        <Card title="New Delivery Assigned">
          <p className="text-sm text-neutral-500">Accept this delivery to start picking, or reject it if you cannot take it.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" loading={isActing} onClick={handleAccept}>
              <Check className="size-4" aria-hidden="true" />
              Accept
            </Button>
            <Button type="button" variant="danger" disabled={isActing} onClick={() => setIsRejectModalOpen(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
        </Card>
      )}

      {nextAction?.type === 'start_picking' && (
        <Card title="Start Picking">
          <p className="text-sm text-neutral-500">Confirm how many units of each line you are taking from the warehouse.</p>
          <div className="mt-4 space-y-3">
            {delivery.items.map((item) => (
              <div key={item.id} className="grid grid-cols-1 items-center gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-neutral-900">{item.productName}</p>
                  {item.variantId && <p className="text-xs text-neutral-500">{item.variantId}</p>}
                  <p className="text-sm text-neutral-500">Planned Qty: {item.plannedQuantity}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-500">Picked Qty</label>
                  <input
                    type="number"
                    min="0"
                    max={item.plannedQuantity}
                    step="1"
                    value={pickedQuantities[item.id] ?? 0}
                    onChange={(event) => setPickedQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                    onBlur={(event) => {
                      const rounded = Math.round(Number(event.target.value))
                      const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), item.plannedQuantity)
                      setPickedQuantities((current) => ({ ...current, [item.id]: clamped }))
                    }}
                    className="h-10 w-32 rounded-lg border border-neutral-200 bg-white px-3 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" className="mt-4" loading={isActing} onClick={handleStartPicking}>
            <PackageSearch className="size-4" aria-hidden="true" />
            Start Picking
          </Button>
        </Card>
      )}

      {nextAction?.type === 'mark_loaded' && (
        <Card title="Load the Vehicle">
          <p className="text-sm text-neutral-500">
            Move the picked goods onto {delivery.vehicleNumber || 'your vehicle'}. This takes the stock off the
            warehouse and onto the van.
          </p>
          <Button type="button" className="mt-4" loading={isActing} onClick={handleMarkLoaded}>
            <PackageCheck className="size-4" aria-hidden="true" />
            Mark Vehicle Loaded
          </Button>
        </Card>
      )}

      {nextAction?.type === 'start_delivery' && (
        <Card title="Ready to Go">
          <p className="text-sm text-neutral-500">Start the delivery once you leave the warehouse - it moves to In Transit.</p>
          <Button type="button" className="mt-4" loading={isActing} onClick={handleDispatch}>
            <Truck className="size-4" aria-hidden="true" />
            Start Delivery
          </Button>
        </Card>
      )}

      {nextAction?.type === 'complete' && !showFailForm && (
        <Card title="Complete Delivery">
          <div className="space-y-4">
            <div className="space-y-3">
              {delivery.items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 items-center gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                    <p className="text-sm text-neutral-500">Loaded: {item.loadedQuantity}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-500">Delivered Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={item.loadedQuantity || undefined}
                      step="1"
                      value={deliveredQuantities[item.id] ?? 0}
                      onChange={(event) => setDeliveredQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                      onBlur={(event) => {
                        const rounded = Math.round(Number(event.target.value))
                        const cap = item.loadedQuantity || Number.MAX_SAFE_INTEGER
                        const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), cap)
                        setDeliveredQuantities((current) => ({ ...current, [item.id]: clamped }))
                      }}
                      className="h-10 w-32 rounded-lg border border-neutral-200 bg-white px-3 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Receiver Name (optional)</label>
              <input
                type="text"
                value={receiverName}
                maxLength={120}
                onChange={(event) => setReceiverName(event.target.value)}
                className="h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Proof of Delivery Photos (optional)</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-3.5 py-4 text-sm text-neutral-500 hover:border-primary-300 hover:bg-primary-50/40">
                {isUploadingPod ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Camera className="size-4" aria-hidden="true" />
                    Upload photos
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePodUpload}
                  disabled={isUploadingPod}
                />
              </label>
              {podFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500">{podFiles.length} photo(s) attached</p>
                  <PreviewGrid files={podFiles} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Delivery Notes (optional)</label>
              <textarea
                value={notes}
                maxLength={1000}
                onChange={(event) => setNotes(event.target.value)}
                className="h-20 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" loading={isActing} onClick={handleConfirm}>
                <PackageCheck className="size-4" aria-hidden="true" />
                Complete Delivery
              </Button>
              <Button type="button" variant="danger" disabled={isActing} onClick={() => setShowFailForm(true)}>
                <Ban className="size-4" aria-hidden="true" />
                Mark as Failed
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Admin: this delivery is run by the partner ---- */}
      {isAdminView && !deliveryStage.offFlow && !isDeliveredStage && (
        <Card title="Current Stage">
          <p className="text-sm text-neutral-500">
            <span className="font-medium text-neutral-800">{deliveryStage.label}</span>
            {' — '}
            {delivery.deliveryPartnerName ? `handled by ${delivery.deliveryPartnerName}.` : 'handled by the assigned delivery partner.'}
            {' '}Use Reassign / Edit / Cancel above to intervene.
          </p>
        </Card>
      )}

      {!isAdminView && showFailForm && (
        <Card title="Mark Delivery as Failed">
          <div className="space-y-4">
            <textarea
              value={failureReason}
              onChange={(event) => setFailureReason(event.target.value)}
              placeholder="Reason the delivery failed (required)"
              maxLength={500}
              className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowFailForm(false)}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
              <Button type="button" variant="danger" loading={isActing} onClick={handleMarkFailed}>
                Confirm Failed
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---- After delivery: information & the separate collection action (not a status) ---- */}
      {isDeliveredStage && (
        <Card title="After Delivery">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <InfoField label="Delivery Summary" value={`${delivery.deliveredTotal ?? 0} delivered of ${delivery.plannedTotal ?? 0} planned`} />
              <InfoField label="Received By" value={delivery.receiverName || '—'} />
              <InfoField label="Proof of Delivery" value={(podPhotoFileIds.length > 0 || podSignatureFileId) ? 'Uploaded' : 'Not uploaded'} />
              <InfoField label="Amount Due" value={formatCurrency(amountDue)} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canRecordCollection && !collectionRecorded && (
                <Button type="button" onClick={() => setIsCollectionModalOpen(true)}>
                  <Wallet className="size-4" aria-hidden="true" />
                  Record Collection
                </Button>
              )}
              {collectionRecorded && <Badge variant="success" dot>Collection recorded</Badge>}
              {!isAdminView && (
                <Button type="button" variant="outline" onClick={() => navigate('/delivery/vehicle-stock')}>
                  <WarehouseIcon className="size-4" aria-hidden="true" />
                  Vehicle / Return Stock
                </Button>
              )}
            </div>
            {showCollectionHandoff && !collectionRecorded && (
              <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {formatCurrency(amountDue)} is still due on this order. Payment collection is recorded by the accounts team.
              </p>
            )}
            {stageKey === 'partially_delivered' && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Some quantity is still pending. The sales team will plan the remaining delivery.
              </p>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailCard title="Delivery Number" value={delivery.deliveryNumber} subtitle={deliveryStage.label} />
        <DetailCard
          title="Order Number"
          value={delivery.orderNumber || 'N/A'}
          subtitle={`${orderStatusLabel.replace(/_/g, ' ')} | ${fulfilmentStatusLabel.replace(/_/g, ' ')}`}
        />
        <DetailCard title="Customer" value={customerLabel} subtitle={delivery.customerId || 'Customer ID unavailable'} />
        <DetailCard
          title="Delivery Partner"
          value={delivery.deliveryPartnerName || 'Unassigned'}
          subtitle={delivery.deliveryPartnerEmployeeId || delivery.deliveryPartnerId || 'Partner ID unavailable'}
        />
      </div>

      <Card title="Delivery Info">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 xl:grid-cols-4">
          <InfoField label="Vehicle" value={delivery.vehicleNumber || 'N/A'} subtitle={delivery.vehicleType} />
          <InfoField label="Vehicle Capacity" value={delivery.vehicleCapacityKg != null ? `${delivery.vehicleCapacityKg} kg` : 'N/A'} />
          <InfoField label="Warehouse" value={warehouseName || 'N/A'} />
          <InfoField label="Scheduled Date" value={formatDate(delivery.scheduledDate)} />
          <InfoField label="Delivery Address" value={delivery.customerDeliveryAddress || delivery.deliveryAddress || 'N/A'} />
          <InfoField label="Dispatched At" value={formatDate(delivery.dispatchedAt)} />
          <InfoField label="Confirmed At" value={formatDate(delivery.confirmedAt)} />
          {delivery.receiverName && <InfoField label="Received By" value={delivery.receiverName} />}
          {delivery.previousPendingBalance != null && (
            <InfoField label="Previous Pending Balance" value={formatCurrency(delivery.previousPendingBalance)} />
          )}
          <InfoField label="Amount Due" value={formatCurrency(delivery.amountDue)} />
          {delivery.failureReason && <InfoField label="Failure Reason" value={delivery.failureReason} />}
        </div>
      </Card>

      <Card title="Contacts">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <InfoField label="Customer Phone" value={delivery.customerPhone || 'N/A'} />
          <InfoField label="Customer Email" value={delivery.customerEmail || 'N/A'} />
          <InfoField label="Partner Phone" value={delivery.deliveryPartnerPhone || 'N/A'} />
          <InfoField label="Partner Email" value={delivery.deliveryPartnerEmail || 'N/A'} />
        </div>
      </Card>

      <Card title="Delivery Items" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-4 py-3">Product</th>
                <th className="whitespace-nowrap px-4 py-3">Variant</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Planned</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Picked</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Loaded</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Delivered</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Pending</th>
                {hasBatchTracking && <th className="whitespace-nowrap px-4 py-3">Batch / Expiry</th>}
                {hasSerialTracking && <th className="whitespace-nowrap px-4 py-3">Serial Numbers</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {delivery.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-primary-50/35">
                  <td className="px-4 py-3.5 font-medium text-neutral-900">{item.productName}</td>
                  <td className="px-4 py-3.5 text-neutral-500">{item.variantId || '—'}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-700">{item.plannedQuantity}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-700">{item.pickedQuantity}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-700">{item.loadedQuantity}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-700">{item.deliveredQuantity}</td>
                  <td className="px-4 py-3.5 text-right text-neutral-700">{item.pendingQuantity}</td>
                  {hasBatchTracking && (
                    <td className="px-4 py-3.5 text-neutral-500">
                      {item.batchNumber || '—'}{item.expiryDate ? ` · exp ${formatDate(item.expiryDate)}` : ''}
                    </td>
                  )}
                  {hasSerialTracking && (
                    <td className="px-4 py-3.5 text-neutral-500">{item.serialNumbers.length ? item.serialNumbers.join(', ') : '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(podPhotoFileIds.length > 0 || podSignatureFileId) && (
        <Card title="Proof of Delivery">
          <div className="space-y-4">
            {podPhotoFileIds.length > 0 && <PreviewGrid files={podPreviewFiles} />}
            {podSignatureFileId && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-medium text-neutral-500">Signature</p>
                <a
                  href={getFileUrl(podSignatureFileId)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-primary-700 hover:underline"
                >
                  View signature
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {delivery.notes && (
        <Card title="Notes">
          <p className="text-sm whitespace-pre-line text-neutral-700">{delivery.notes}</p>
        </Card>
      )}

      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => {
          if (isActing) return
          setIsReassignModalOpen(false)
        }}
        title="Reassign Delivery"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!reassignPartnerId} loading={isActing} onClick={handleReassign}>Reassign</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            This delivery was rejected. Assign a new delivery partner to send it back to the active pipeline.
          </p>
          <Select
            label="New Delivery Partner"
            placeholder="Select a delivery partner"
            options={deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))}
            value={reassignPartnerId}
            onChange={(event) => setReassignPartnerId(event.target.value)}
          />
          <Select
            label="Vehicle"
            placeholder="Select a vehicle"
            options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber }))}
            value={reassignVehicleId}
            onChange={(event) => setReassignVehicleId(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Scheduled Date</label>
            <input
              type="date"
              value={reassignScheduledDate}
              onChange={(event) => setReassignScheduledDate(event.target.value)}
              className="h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (isActing) return
          setIsEditModalOpen(false)
        }}
        title="Edit Delivery"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={isActing} onClick={handleEditSave}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            This delivery is still planned, so its partner, vehicle, schedule, and address can be changed before it's accepted.
          </p>
          <Select
            label="Delivery Partner"
            placeholder="Select a delivery partner"
            options={deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))}
            value={editForm.deliveryPartnerId}
            onChange={(event) => setEditForm((current) => ({ ...current, deliveryPartnerId: event.target.value }))}
          />
          <Select
            label="Vehicle"
            placeholder="Select a vehicle"
            options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber }))}
            value={editForm.vehicleId}
            onChange={(event) => setEditForm((current) => ({ ...current, vehicleId: event.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Scheduled Date</label>
            <input
              type="date"
              value={editForm.scheduledDate}
              onChange={(event) => setEditForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              className="h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Delivery Address</label>
            <textarea
              value={editForm.deliveryAddress}
              onChange={(event) => setEditForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
              maxLength={500}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
              maxLength={1000}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (isActing) return
          setIsCancelModalOpen(false)
        }}
        title="Cancel Delivery"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCancelModalOpen(false)}>Keep Delivery</Button>
            <Button variant="danger" loading={isActing} onClick={handleCancelDelivery}>Cancel Delivery</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            This abandons the plan for {delivery.deliveryNumber}. It can only be done before goods are loaded onto a vehicle.
          </p>
          <textarea
            value={cancelNotes}
            onChange={(event) => setCancelNotes(event.target.value)}
            placeholder="Reason for cancelling (optional)"
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
        </div>
      </Modal>

      <RejectDeliveryModal
        delivery={delivery}
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onRejected={handleRejected}
      />

      <RecordCollectionModal
        delivery={delivery}
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onRecorded={() => {
          setCollectionRecorded(true)
          showToast({ title: 'Collection recorded', message: 'Payment receipt created.' })
          loadDetail()
        }}
      />
    </div>
  )
}
