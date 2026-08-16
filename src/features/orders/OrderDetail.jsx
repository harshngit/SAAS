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
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import {
  approveOrder,
  assignDeliveryPartner,
  cancelOrder,
  getOrder,
  rejectOrder,
} from '../../api/orders'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { formatCurrency } from '../../utils/format'

const statusBadgeVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

const cancellableStatuses = ['draft', 'placed', 'processing']

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

  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const loadOrder = async () => {
    setIsLoading(true)
    setLoadError('')

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
    let isMounted = true

    listUsers().then((result) => {
      if (!isMounted || !result.success) return
      setDeliveryPartners(result.users.map(normalizeApiUser).filter((user) => user.role === ROLES.DELIVERY_PARTNER))
    })

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

  const canApprove = order.status === 'awaiting_approval'
  const canAssignPartner = !['cancelled', 'completed'].includes(order.status) && !order.assignedDeliveryPartnerId
  const canCancel = cancellableStatuses.includes(order.status)
  const isReserved = ['reserved', 'planned', 'loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isLoaded = ['loaded', 'in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isInTransit = ['in_transit', 'partially_delivered', 'delivered'].includes(order.fulfilmentStatus)
  const isDelivered = order.fulfilmentStatus === 'delivered'

  const fulfillmentSteps = [
    { label: 'Order Placed', status: 'done' },
    { label: 'Stock Reserved', status: isReserved ? 'done' : 'current' },
    { label: 'Delivery Assigned', status: order.assignedDeliveryPartnerId ? 'done' : canAssignPartner ? 'current' : 'pending' },
    { label: 'Loaded', status: isLoaded ? 'done' : order.assignedDeliveryPartnerId ? 'current' : 'pending' },
    { label: 'In Transit', status: isInTransit ? 'done' : isLoaded ? 'current' : 'pending' },
    { label: 'Delivered', status: isDelivered ? 'done' : isInTransit ? 'current' : 'pending' },
  ]

  const runAction = async (action) => {
    setIsActing(true)
    setActionError('')

    const result = await action()

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return false
    }

    setOrder(result.order)
    setIsActing(false)
    return true
  }

  const handleApprove = () => runAction(() => approveOrder(order.id))
  const handleReject = () => runAction(() => rejectOrder(order.id))

  const handleAssignPartner = async () => {
    if (!selectedPartnerId) return
    const ok = await runAction(() => assignDeliveryPartner(order.id, selectedPartnerId))
    if (ok) {
      setIsAssignModalOpen(false)
      setSelectedPartnerId('')
    }
  }

  const handleCancel = async () => {
    const ok = await runAction(() => cancelOrder(order.id, cancelReason))
    if (ok) {
      setIsCancelModalOpen(false)
      setCancelReason('')
    }
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
          {canAssignPartner && (
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
              <Truck className="size-4" aria-hidden="true" />
              Assign Delivery
            </Button>
          )}
          {['placed', 'processing', 'completed'].includes(order.status) && (
            <Button variant="primary" size="sm" onClick={() => navigate(`/admin/invoices/new?orderId=${order.id}`)}>
              <FileText className="size-4" aria-hidden="true" />
              Create Invoice
            </Button>
          )}
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

      <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-5">
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
                  <th className="whitespace-nowrap px-5 py-3 text-right">Qty</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Reserved</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Delivered</th>
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
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.reservedQuantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.deliveredQuantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50/60 font-semibold text-neutral-900">
                  <td colSpan={3} />
                  <td className="px-5 py-3 text-right">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td colSpan={2} />
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
        <Card title="Delivery Information">
          {order.assignedDeliveryPartnerId ? (
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
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Delivery Partner"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!selectedPartnerId} loading={isActing} onClick={handleAssignPartner}>Assign</Button>
          </>
        }
      >
        <Select
          label="Delivery Partner"
          placeholder="Select a delivery partner"
          options={deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))}
          value={selectedPartnerId}
          onChange={(event) => setSelectedPartnerId(event.target.value)}
        />
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
