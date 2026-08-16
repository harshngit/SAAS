import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ban, Camera, Download, PackageCheck, Truck, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import {
  DELIVERY_STATUS_OPTIONS,
  confirmDelivery,
  downloadDeliveryChallan,
  getDelivery,
  loadDeliveryOntoVehicle,
} from '../../api/deliveries'
import { uploadFiles } from '../../api/files'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const statusVariant = {
  delivered: 'success',
  in_transit: 'warning',
  planned: 'info',
  loaded: 'info',
  partially_delivered: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
}

export default function DeliveryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [delivery, setDelivery] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState('')

  const [deliveredQuantities, setDeliveredQuantities] = useState({})
  const [notes, setNotes] = useState('')
  const [podFiles, setPodFiles] = useState([])
  const [isUploadingPod, setIsUploadingPod] = useState(false)
  const [showFailForm, setShowFailForm] = useState(false)
  const [failureReason, setFailureReason] = useState('')

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
    setIsLoading(false)
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
          action={{ label: 'Back', onClick: () => navigate(-1) }}
        />
      </Card>
    )
  }

  const canLoad = delivery.status === 'planned'
  const canConfirm = ['loaded', 'in_transit'].includes(delivery.status)
  const isFinal = ['delivered', 'partially_delivered', 'failed', 'cancelled'].includes(delivery.status)

  const handleLoad = async () => {
    setIsActing(true)
    setActionError('')

    const result = await loadDeliveryOntoVehicle(delivery.id)

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return
    }

    setDelivery(result.delivery)
    setIsActing(false)
    showToast({ title: 'Loaded', message: 'Delivery loaded onto the vehicle.' })
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
    setIsActing(true)
    setActionError('')

    const result = await confirmDelivery(delivery.id, {
      failed: false,
      items: delivery.items.map((item) => ({
        deliveryItemId: item.id,
        deliveredQuantity: deliveredQuantities[item.id] ?? 0,
      })),
      podPhotoFileIds: podFiles.map((file) => file.file_id).filter(Boolean),
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
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">Order {delivery.orderNumber}</h1>
              <Badge variant={statusVariant[delivery.status] || 'neutral'} dot>
                {DELIVERY_STATUS_OPTIONS.find((option) => option.value === delivery.status)?.label || delivery.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-500">{delivery.customerName}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadChallan}>
          <Download className="size-4" aria-hidden="true" />
          Delivery Challan
        </Button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <Card title="Delivery Info">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-neutral-400">Scheduled Date</p>
            <p className="font-medium text-neutral-900">{delivery.scheduledDate || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Vehicle</p>
            <p className="font-medium text-neutral-900">{delivery.vehicleNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Delivery Address</p>
            <p className="font-medium text-neutral-900">{delivery.deliveryAddress || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Amount Due</p>
            <p className="font-medium text-neutral-900">{formatCurrency(delivery.amountDue)}</p>
          </div>
        </div>
      </Card>

      <Card title="Delivery Items">
        <div className="space-y-3">
          {delivery.items.map((item) => (
            <div key={item.id} className="grid grid-cols-1 items-center gap-3 rounded-lg bg-neutral-50 p-3 md:grid-cols-3">
              <div>
                <p className="font-medium text-neutral-900">{item.productName}</p>
                <p className="text-sm text-neutral-500">
                  Planned {item.plannedQuantity} • Loaded {item.loadedQuantity} • {formatCurrency(item.unitPrice)}/unit
                </p>
              </div>
              {canConfirm ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-500">Delivered Quantity</label>
                  <input
                    type="number"
                    min="0"
                    max={item.loadedQuantity || item.plannedQuantity}
                    value={deliveredQuantities[item.id] ?? 0}
                    onChange={(event) => setDeliveredQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                    className="h-10 w-32 rounded-lg border border-neutral-200 bg-white px-3 text-sm"
                  />
                </div>
              ) : (
                <div className="text-sm text-neutral-600">Delivered: {item.deliveredQuantity}</div>
              )}
              <div className="text-right">
                <p className="font-semibold text-neutral-900">{formatCurrency(item.unitPrice * (item.deliveredQuantity || item.loadedQuantity || item.plannedQuantity))}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {canLoad && (
        <Card title="Load onto Vehicle">
          <p className="text-sm text-neutral-500">Confirm the planned goods have physically left the warehouse for this delivery.</p>
          <Button type="button" className="mt-4" loading={isActing} onClick={handleLoad}>
            <PackageCheck className="size-4" aria-hidden="true" />
            Mark as Loaded
          </Button>
        </Card>
      )}

      {canConfirm && !showFailForm && (
        <Card title="Confirm Delivery">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Proof of Delivery Photos (Optional)</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-3.5 py-4 text-sm text-neutral-500 hover:border-primary-300 hover:bg-primary-50/40">
                {isUploadingPod ? <LoadingSpinner /> : (
                  <>
                    <Camera className="size-4" aria-hidden="true" />
                    Upload photos
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePodUpload} disabled={isUploadingPod} />
              </label>
              {podFiles.length > 0 && (
                <p className="text-xs text-neutral-500">{podFiles.length} photo(s) attached</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Notes (Optional)</label>
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
                Confirm Delivery
              </Button>
              <Button type="button" variant="danger" onClick={() => setShowFailForm(true)}>
                <Ban className="size-4" aria-hidden="true" />
                Mark as Failed
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showFailForm && (
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

      {isFinal && delivery.notes && (
        <Card title="Notes">
          <p className="text-sm text-neutral-700 whitespace-pre-line">{delivery.notes}</p>
        </Card>
      )}
    </div>
  )
}
