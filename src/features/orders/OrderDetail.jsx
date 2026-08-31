import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  FileText,
  IndianRupee,
  PackageCheck,
  Store,
  Truck,
  User,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import {
  approveOrder,
  cancelOrder,
  confirmOrder,
  getOrder,
  pickupConfirm,
  pickupPick,
  pickupReady,
  rejectOrder,
} from '../../api/orders'
import { listDeliveries, listDeliveryPartners, planDelivery } from '../../api/deliveries'
import { listInvoices } from '../../api/invoices'
import { getSalesWorkflowSettings } from '../../api/settings'
import { listVehicles } from '../../api/vehicles'
import { listWarehouses } from '../../api/warehouses'
import { formatCurrency } from '../../utils/format'

// order.status is the backend's normalized public value - only ever placed/confirmed/
// completed/cancelled (draft/awaiting_approval/placed collapse to "placed", the old internal
// "processing" now shows as "confirmed"). Raw keys kept harmlessly in case an older API build
// is ever hit, but they're not expected to match live responses.
const statusBadgeVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

const cancellableStatuses = ['placed', 'confirmed']
const billableDeliveryStatuses = ['delivered', 'partially_delivered']

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

function StepperNode({ index, label, status, isLast }) {
  return (
    <div className="flex flex-1 items-start gap-0">
      <div className="flex flex-col items-center">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            status === 'done'
              ? 'bg-primary-600 text-white'
              : status === 'current'
                ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                : 'bg-neutral-100 text-neutral-400'
          }`}
        >
          {status === 'done' ? <Check className="size-4" /> : index}
        </div>
        <p className={`mt-2 max-w-26 text-center text-xs font-medium ${status === 'pending' ? 'text-neutral-400' : 'text-neutral-800'}`}>
          {label}
        </p>
      </div>
      {!isLast && <div className={`mt-4 h-0.5 flex-1 ${status === 'done' ? 'bg-primary-500' : 'bg-neutral-100'}`} />}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'

  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)
  // Set once a Confirm/Approve attempt is rejected as "not applicable" - proves the order
  // has already cleared both pre-placement stages, so neither button is retried for this order.
  const [preConfirmationResolved, setPreConfirmationResolved] = useState(false)

  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ deliveryPartnerId: '', vehicleId: '', warehouseId: '', scheduledDate: '', deliveryAddress: '' })
  const [planItemQuantities, setPlanItemQuantities] = useState({})
  const [planError, setPlanError] = useState('')
  const [isPlanning, setIsPlanning] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isPickupConfirmModalOpen, setIsPickupConfirmModalOpen] = useState(false)
  const [pickupItemQuantities, setPickupItemQuantities] = useState({})
  const [collectedBy, setCollectedBy] = useState('')
  const [pickupNotesInput, setPickupNotesInput] = useState('')
  const [pickupError, setPickupError] = useState('')
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false)
  const [orderInvoices, setOrderInvoices] = useState([])
  const [hasMoreToInvoice, setHasMoreToInvoice] = useState(false)
  const [invoiceMode, setInvoiceMode] = useState('per_delivery')

  const loadOrder = async () => {
    setIsLoading(true)
    setLoadError('')
    setPreConfirmationResolved(false)

    const result = await getOrder(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setOrder(result.order)
    setIsLoading(false)
  }

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!order?.id) {
      setOrderInvoices([])
      setHasMoreToInvoice(false)
      return
    }

    let isMounted = true

    listInvoices({ order_id: order.id }).then((invoicesResult) => {
      if (!isMounted) return
      const invoices = invoicesResult.success ? invoicesResult.invoices : []
      setOrderInvoices(invoices)

      const wholeOrderInvoice = invoices.find((invoice) => !invoice.deliveryId)
      if (invoices.length === 0 || wholeOrderInvoice) {
        setHasMoreToInvoice(false)
        return
      }

      // Some deliveries may still be uninvoiced (per-delivery billing) - check before
      // deciding whether "Create Next Invoice" should appear alongside "View Invoice(s)".
      listDeliveries({ order_id: order.id }).then((deliveriesResult) => {
        if (!isMounted) return
        const deliveries = deliveriesResult.success ? deliveriesResult.deliveries : []
        const invoicedDeliveryIds = new Set(invoices.map((invoice) => invoice.deliveryId).filter(Boolean))
        setHasMoreToInvoice(
          deliveries.some((delivery) => billableDeliveryStatuses.includes(delivery.status) && !invoicedDeliveryIds.has(delivery.id)),
        )
      })
    })

    return () => {
      isMounted = false
    }
  }, [order?.id])

  useEffect(() => {
    let isMounted = true

    Promise.all([listDeliveryPartners(), listVehicles(), listWarehouses(), getSalesWorkflowSettings()]).then(
      ([partnersResult, vehiclesResult, warehousesResult, settingsResult]) => {
        if (!isMounted) return
        if (partnersResult.success) setDeliveryPartners(partnersResult.partners)
        if (vehiclesResult.success) setVehicles(vehiclesResult.vehicles)
        if (warehousesResult.success) setWarehouses(warehousesResult.warehouses)
        if (settingsResult.success) setInvoiceMode(settingsResult.settings.partialDeliveryInvoiceMode)
      },
    )

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading order..." />
      </Card>
    )
  }

  if (loadError || !order) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Order not found"
          description={loadError || 'This order may have been removed or the link is out of date.'}
          action={{ label: 'Back to Orders', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const isPickupOrder = order.fulfilmentMethod === 'pickup'
  // The backend collapses draft/awaiting_approval/placed into one public "placed" bucket, so
  // the frontend can no longer tell which of those three an order is actually in. Show both
  // pre-confirmation actions together here and let the backend's own validation (it returns a
  // clear message, e.g. "Only a draft order may be confirmed") reject whichever doesn't apply.
  const canConfirmDraft = order.status === 'placed' && !preConfirmationResolved
  const canApprove = order.status === 'placed' && !preConfirmationResolved
  const canPlanDelivery = !isPickupOrder && ['placed', 'confirmed'].includes(order.status) && !order.assignedDeliveryPartnerId
  const canCancel = cancellableStatuses.includes(order.status)
  const isReserved = ['reserved', 'planned', 'loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isLoaded = ['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isInTransit = ['in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isDelivered = order.fulfilmentStatus === 'delivered'
  const hasDeliveredQuantity = order.items.some((item) => (item.deliveredQuantity || 0) > 0)

  const canPickupPick = isPickupOrder && ['placed', 'confirmed'].includes(order.status) && order.pickupStatus === 'not_started'
  const canPickupReady = isPickupOrder && order.pickupStatus === 'picking'
  const canConfirmPickup = isPickupOrder && order.pickupStatus === 'ready'
  const isPickupCollected = isPickupOrder && order.pickupStatus === 'collected'

  const fulfillmentSteps = isPickupOrder
    ? [
        { label: 'Order Placed', status: 'done' },
        { label: 'Stock Reserved', status: isReserved ? 'done' : 'current' },
        {
          label: 'Picking',
          status: ['picking', 'ready', 'collected'].includes(order.pickupStatus) ? 'done' : canPickupPick ? 'current' : 'pending',
        },
        {
          label: 'Ready for Pickup',
          status: ['ready', 'collected'].includes(order.pickupStatus) ? 'done' : canPickupReady ? 'current' : 'pending',
        },
        { label: 'Collected', status: isPickupCollected ? 'done' : canConfirmPickup ? 'current' : 'pending' },
      ]
    : [
        { label: 'Order Placed', status: 'done' },
        { label: 'Stock Reserved', status: isReserved ? 'done' : 'current' },
        { label: 'Delivery Assigned', status: order.assignedDeliveryPartnerId ? 'done' : canPlanDelivery ? 'current' : 'pending' },
        { label: 'Loaded', status: isLoaded ? 'done' : order.assignedDeliveryPartnerId ? 'current' : 'pending' },
        { label: 'In Transit', status: isInTransit ? 'done' : isLoaded ? 'current' : 'pending' },
        { label: 'Delivered', status: isDelivered ? 'done' : isInTransit ? 'current' : 'pending' },
      ]

  // The backend collapses draft/awaiting_approval/placed into one public "placed" status,
  // so the frontend can't tell in advance which of Confirm/Approve actually applies - both
  // buttons show together and the backend's own validation decides. But whichever one gets
  // rejected as "not applicable" (order is neither a draft nor awaiting approval) proves the
  // order has already cleared *both* pre-placement stages - so that single rejection is enough
  // to retire both buttons for the rest of this view, instead of leaving the user to hit the
  // same dead end twice.
  const notDraftPattern = /only a draft order may be confirmed/i
  const notAwaitingApprovalPattern = /only an order awaiting approval can be approved/i

  const runAction = async (action) => {
    setIsActing(true)
    setActionError('')

    const result = await action()

    if (!result.success) {
      if (notDraftPattern.test(result.error) || notAwaitingApprovalPattern.test(result.error)) {
        setPreConfirmationResolved(true)
        setActionError('')
      } else {
        setActionError(result.error)
      }
      setIsActing(false)
      return false
    }

    setOrder(result.order)
    setIsActing(false)
    return true
  }

  const handleConfirmDraft = () => runAction(() => confirmOrder(order.id))
  const handleApprove = () => runAction(() => approveOrder(order.id))
  const handleReject = () => runAction(() => rejectOrder(order.id))

  const openPlanModal = () => {
    setPlanForm({
      deliveryPartnerId: '',
      vehicleId: '',
      warehouseId: order.warehouseId || '',
      scheduledDate: '',
      deliveryAddress: '',
    })
    setPlanItemQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])))
    setPlanError('')
    setIsPlanModalOpen(true)
  }

  const handlePlanDelivery = async () => {
    if (!planForm.deliveryPartnerId) {
      setPlanError('Select a delivery partner.')
      return
    }
    if (!planForm.warehouseId) {
      setPlanError('Select a warehouse.')
      return
    }

    setIsPlanning(true)
    setPlanError('')

    const result = await planDelivery({
      orderId: order.id,
      deliveryPartnerId: planForm.deliveryPartnerId,
      vehicleId: planForm.vehicleId || undefined,
      warehouseId: planForm.warehouseId,
      scheduledDate: planForm.scheduledDate || undefined,
      deliveryAddress: planForm.deliveryAddress || undefined,
      items: order.items.map((item) => ({ orderItemId: item.id, plannedQuantity: planItemQuantities[item.id] ?? item.quantity })),
    })

    setIsPlanning(false)

    if (!result.success) {
      setPlanError(result.error)
      return
    }

    setIsPlanModalOpen(false)
    navigate(`/admin/deliveries/${result.delivery.id}`)
  }

  const handleCancel = async () => {
    const ok = await runAction(() => cancelOrder(order.id, cancelReason))
    if (ok) {
      setIsCancelModalOpen(false)
      setCancelReason('')
    }
  }

  const handlePickupPick = () => runAction(() => pickupPick(order.id))
  const handlePickupReady = () => runAction(() => pickupReady(order.id))

  const openPickupConfirmModal = () => {
    setPickupItemQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])))
    setCollectedBy('')
    setPickupNotesInput('')
    setPickupError('')
    setIsPickupConfirmModalOpen(true)
  }

  const handleConfirmPickup = async () => {
    setIsConfirmingPickup(true)
    setPickupError('')

    const result = await pickupConfirm(order.id, {
      items: order.items.map((item) => ({ orderItemId: item.id, collectedQuantity: pickupItemQuantities[item.id] ?? item.quantity })),
      collectedBy: collectedBy.trim() || undefined,
      notes: pickupNotesInput.trim() || undefined,
    })

    setIsConfirmingPickup(false)

    if (!result.success) {
      setPickupError(result.error)
      return
    }

    setOrder(result.order)
    setIsPickupConfirmModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Orders
          </Button>
          <div>
            <p className="text-xs font-medium text-neutral-400">Order Details</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{order.orderNumber}</h1>
              <Badge variant={statusBadgeVariant[order.status] || 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canConfirmDraft && (
            <Button variant="primary" size="sm" loading={isActing} onClick={handleConfirmDraft}>
              <Check className="size-4" aria-hidden="true" />
              Confirm Order
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="danger" size="sm" loading={isActing} onClick={handleReject}>
                <X className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button variant="primary" size="sm" loading={isActing} onClick={handleApprove}>
                <Check className="size-4" aria-hidden="true" />
                Approve
              </Button>
            </>
          )}
          {canPlanDelivery && (
            <Button variant="outline" size="sm" onClick={openPlanModal}>
              <Truck className="size-4" aria-hidden="true" />
              Plan Delivery
            </Button>
          )}
          {canPickupPick && (
            <Button variant="outline" size="sm" loading={isActing} onClick={handlePickupPick}>
              <Store className="size-4" aria-hidden="true" />
              Pick Items
            </Button>
          )}
          {canPickupReady && (
            <Button variant="outline" size="sm" loading={isActing} onClick={handlePickupReady}>
              <PackageCheck className="size-4" aria-hidden="true" />
              Mark Ready for Pickup
            </Button>
          )}
          {canConfirmPickup && (
            <Button variant="primary" size="sm" onClick={openPickupConfirmModal}>
              <Check className="size-4" aria-hidden="true" />
              Confirm Pickup
            </Button>
          )}
          {['placed', 'confirmed', 'completed'].includes(order.status) && (() => {
            const wholeOrderInvoice = orderInvoices.find((invoice) => !invoice.deliveryId)

            if (wholeOrderInvoice) {
              return (
                <Button variant="primary" size="sm" onClick={() => navigate(`/admin/invoices/${wholeOrderInvoice.id}`)}>
                  <FileText className="size-4" aria-hidden="true" />
                  View Invoice {wholeOrderInvoice.invoiceNumber}
                </Button>
              )
            }

            if (orderInvoices.length > 0) {
              return (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/invoices/${orderInvoices[0].id}`)}>
                    <FileText className="size-4" aria-hidden="true" />
                    {orderInvoices.length > 1 ? `View Invoices (${orderInvoices.length})` : `View Invoice ${orderInvoices[0].invoiceNumber}`}
                  </Button>
                  {hasMoreToInvoice && (
                    <Button variant="primary" size="sm" onClick={() => navigate(`/admin/invoices/new?orderId=${order.id}`)}>
                      <FileText className="size-4" aria-hidden="true" />
                      Create Next Invoice
                    </Button>
                  )}
                </>
              )
            }

            const canCreateInvoice = invoiceMode === 'after_full_order' ? isDelivered : hasDeliveredQuantity
            const disabledReason = !hasDeliveredQuantity
              ? 'No delivered quantity is available for invoicing'
              : !canCreateInvoice
                ? 'Complete the pending delivery before creating the final invoice'
                : undefined

            return (
              <Button
                variant="primary"
                size="sm"
                disabled={!canCreateInvoice}
                title={disabledReason}
                onClick={() => navigate(`/admin/invoices/new?orderId=${order.id}`)}
              >
                <FileText className="size-4" aria-hidden="true" />
                Create Invoice
              </Button>
            )
          })()}
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelModalOpen(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {preConfirmationResolved && order.status === 'placed' && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          This order is already placed and doesn&apos;t need confirming or approving — it&apos;s ready for the next step (Plan Delivery / Create Invoice).
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><User className="size-3.5" />Customer</p>
          <Link to={`/admin/customers/${order.customerId}`} className="mt-1 block truncate text-sm font-medium text-primary-700 hover:underline">
            {order.customerName}
          </Link>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">Order Date</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{formatDate(order.orderDate)}</p>
          <p className="text-xs text-neutral-400">Delivery {formatDate(order.deliveryDate)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Wallet className="size-3.5" />Payment Type</p>
          <p className="mt-1 text-sm font-medium capitalize text-neutral-900">{order.paymentType || '—'}</p>
          {order.paymentTermsDays > 0 && <p className="text-xs text-neutral-400">{order.paymentTermsDays} Days</p>}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Warehouse className="size-3.5" />Warehouse</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{order.warehouseName || '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><IndianRupee className="size-3.5" />Total Amount</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(order.total)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><FileText className="size-3.5" />Delivery / Invoice</p>
          <p className="mt-1 text-sm font-medium">
            {order.deliveryId ? (
              <Link to={`/admin/deliveries/${order.deliveryId}`} className="text-primary-700 hover:underline">
                {order.deliveryNumber || 'View Delivery'}
              </Link>
            ) : (
              <span className="text-neutral-400">No delivery yet</span>
            )}
          </p>
          <p className="text-xs">
            {order.invoiceId ? (
              <Link to={`/admin/invoices/${order.invoiceNumber || order.invoiceId}`} className="text-primary-700 hover:underline">
                {order.invoiceNumber || 'View Invoice'}
              </Link>
            ) : (
              <span className="text-neutral-400">No invoice yet</span>
            )}
          </p>
        </div>
      </div>

      {order.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {order.warnings.map((warning, index) => (
            <p key={index}>{typeof warning === 'string' ? warning : JSON.stringify(warning)}</p>
          ))}
        </div>
      )}

      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="flex items-start">
          {fulfillmentSteps.map((step, index) => (
            <StepperNode key={step.label} index={index + 1} isLast={index === fulfillmentSteps.length - 1} {...step} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card title="Order Items" className="p-0" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">#</th>
                  <th className="whitespace-nowrap px-5 py-3">Product</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Disc %</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Qty</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Reserved</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Delivered</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Remaining</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {order.items.map((item, index) => (
                  <tr key={item.id || item.productId} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-400">{index + 1}</td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <p className="font-medium text-neutral-800">{item.productName}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {formatCurrency(item.unitPrice)}
                      {item.costPrice != null && (
                        <p className="text-xs font-normal text-neutral-400">Cost: {formatCurrency(item.costPrice)}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.reservedQuantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.deliveredQuantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.remainingQuantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50/60 font-semibold text-neutral-900">
                  <td colSpan={4} />
                  <td className="px-5 py-3 text-right">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td colSpan={3} />
                  <td className="px-5 py-3 text-right">{formatCurrency(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Payment Summary">
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium text-neutral-900">{formatCurrency(order.subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Discount</span><span className="font-medium text-red-500">-{formatCurrency(order.discount)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Tax</span><span className="font-medium text-neutral-900">{formatCurrency(order.tax)}</span></div>
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3"><span className="font-semibold text-neutral-900">Total Amount</span><span className="font-semibold text-neutral-900">{formatCurrency(order.total)}</span></div>
          </div>
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Receivables are created once this order is invoiced, not at placement.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={isPickupOrder ? 'Pickup Information' : 'Delivery Information'}>
          {isPickupOrder ? (
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Fulfilment Method</span><span className="font-medium text-neutral-900">Takeaway / Self Pickup</span></div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Pickup Status</span>
                <Badge variant={isPickupCollected ? 'success' : 'warning'}>{order.pickupStatus.replace(/_/g, ' ')}</Badge>
              </div>
              {order.collectedBy && (
                <div className="flex items-center justify-between"><span className="text-neutral-500">Collected By</span><span className="font-medium text-neutral-900">{order.collectedBy}</span></div>
              )}
              {order.collectedAt && (
                <div className="flex items-center justify-between"><span className="text-neutral-500">Collected At</span><span className="font-medium text-neutral-900">{formatDate(order.collectedAt)}</span></div>
              )}
              {order.pickupNotes && (
                <div className="border-t border-neutral-100 pt-3">
                  <span className="text-neutral-500">Pickup Notes</span>
                  <p className="mt-1 whitespace-pre-line text-neutral-700">{order.pickupNotes}</p>
                </div>
              )}
            </div>
          ) : order.assignedDeliveryPartnerId ? (
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Delivery Partner</span><span className="font-medium text-neutral-900">{order.assignedDeliveryPartnerName}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Fulfilment Method</span><span className="font-medium capitalize text-neutral-900">{order.fulfilmentMethod}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Expected Delivery</span><span className="font-medium text-neutral-900">{formatDate(order.deliveryDate)}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Fulfilment Status</span>
                <Badge variant={isDelivered ? 'success' : 'warning'}>{order.fulfilmentStatus.replace(/_/g, ' ')}</Badge>
              </div>
            </div>
          ) : (
            <EmptyState icon={Truck} title="No delivery partner assigned" description="Assign a delivery partner to start fulfillment." />
          )}
        </Card>

        <Card title="Notes">
          {order.notes ? (
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-sm text-neutral-700 whitespace-pre-line">{order.notes}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No notes recorded for this order.</p>
          )}
          <div className="mt-4 flex items-start gap-2.5 border-t border-neutral-100 pt-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
            <div>
              <p className="text-sm text-neutral-700">Order placed</p>
              <p className="text-xs text-neutral-400">{formatDate(order.orderDate)}</p>
            </div>
          </div>
          {order.approvedAt && (
            <div className="mt-3 flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              <div>
                <p className="text-sm text-neutral-700">Order approved</p>
                <p className="text-xs text-neutral-400">{formatDate(order.approvedAt)}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => {
          if (isPlanning) return
          setIsPlanModalOpen(false)
        }}
        title="Plan Delivery"
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPlanModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={isPlanning} onClick={handlePlanDelivery}>Plan Delivery</Button>
          </>
        }
      >
        <div className="space-y-4">
          {planError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</div>
          )}
          <Select
            label="Delivery Partner"
            placeholder="Select a delivery partner"
            options={deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))}
            value={planForm.deliveryPartnerId}
            onChange={(event) => setPlanForm((current) => ({ ...current, deliveryPartnerId: event.target.value }))}
          />
          <Select
            label="Vehicle"
            placeholder="Select a vehicle"
            options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber }))}
            value={planForm.vehicleId}
            onChange={(event) => setPlanForm((current) => ({ ...current, vehicleId: event.target.value }))}
          />
          <Select
            label="Warehouse"
            placeholder="Select a warehouse"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
            value={planForm.warehouseId}
            onChange={(event) => setPlanForm((current) => ({ ...current, warehouseId: event.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Scheduled Date</label>
            <input
              type="date"
              value={planForm.scheduledDate}
              onChange={(event) => setPlanForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              className="h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Delivery Address</label>
            <textarea
              value={planForm.deliveryAddress}
              onChange={(event) => setPlanForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
              placeholder="Delivery address (optional)"
              maxLength={500}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Items / Planned Qty</label>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-xs text-neutral-400">Ordered: {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={planItemQuantities[item.id] ?? item.quantity}
                    onChange={(event) =>
                      setPlanItemQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                    }
                    onBlur={(event) => {
                      const rounded = Math.round(Number(event.target.value))
                      const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), item.quantity)
                      setPlanItemQuantities((current) => ({ ...current, [item.id]: clamped }))
                    }}
                    className="h-9 w-24 shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isPickupConfirmModalOpen}
        onClose={() => {
          if (isConfirmingPickup) return
          setIsPickupConfirmModalOpen(false)
        }}
        title="Confirm Pickup"
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPickupConfirmModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={isConfirmingPickup} onClick={handleConfirmPickup}>Confirm Pickup</Button>
          </>
        }
      >
        <div className="space-y-4">
          {pickupError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{pickupError}</div>
          )}
          <Input
            label="Collected By (optional)"
            placeholder="Name of the person collecting"
            value={collectedBy}
            onChange={(event) => setCollectedBy(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Collected Quantity</label>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-xs text-neutral-400">Ordered: {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={pickupItemQuantities[item.id] ?? item.quantity}
                    onChange={(event) =>
                      setPickupItemQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                    }
                    onBlur={(event) => {
                      const rounded = Math.round(Number(event.target.value))
                      const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), item.quantity)
                      setPickupItemQuantities((current) => ({ ...current, [item.id]: clamped }))
                    }}
                    className="h-9 w-24 shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Notes (optional)</label>
            <textarea
              value={pickupNotesInput}
              onChange={(event) => setPickupNotesInput(event.target.value)}
              placeholder="Any additional notes about this pickup"
              maxLength={500}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Order">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            This will cancel {order.orderNumber} for {order.customerName}. This action cannot be undone.
          </p>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Reason for cancellation (optional)"
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)}>Keep Order</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={handleCancel}>Cancel Order</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
