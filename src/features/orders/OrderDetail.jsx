import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Ban,
  Check,
  IndianRupee,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { orderStatusBadgeVariant, orders as seedOrders } from '../../mockData/orders'
import { customers } from '../../mockData/customers'
import { users } from '../../mockData/users'
import { formatCurrency } from '../../utils/format'

const paymentBadgeVariant = { Paid: 'success', Partial: 'warning', Unpaid: 'danger' }
const cancellableStatuses = ['Draft', 'Confirmed', 'Processing']

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const deliveryPartners = users.filter((user) => user.role === 'delivery_partner')

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const initialOrder = useMemo(() => seedOrders.find((item) => item.id === id), [id])
  const [order, setOrder] = useState(initialOrder)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')

  const customer = useMemo(() => customers.find((item) => item.id === order?.customerId), [order])
  const salesOfficer = useMemo(() => users.find((user) => user.id === order?.salesOfficerId), [order])
  const deliveryPartner = useMemo(
    () => (order?.deliveryPartnerId ? users.find((user) => user.id === order.deliveryPartnerId) : null),
    [order],
  )

  if (!order) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingCart}
          title="Order not found"
          description="This order may have been deleted or the link is out of date."
          action={{ label: 'Back to Orders', onClick: () => navigate('/admin/orders') }}
        />
      </Card>
    )
  }

  const canApprove = order.requiresApproval && order.status === 'Confirmed'
  const canAssignPartner = order.status === 'Confirmed' && !order.deliveryPartnerId
  const canCancel = cancellableStatuses.includes(order.status)

  const handleApprove = () => {
    setOrder((current) => ({ ...current, status: 'Processing', requiresApproval: false }))
  }

  const handleReject = () => {
    setOrder((current) => ({ ...current, status: 'Cancelled', balanceDue: 0 }))
  }

  const handleAssignPartner = () => {
    if (!selectedPartnerId) return
    setOrder((current) => ({ ...current, deliveryPartnerId: selectedPartnerId, status: 'Out for Delivery' }))
    setIsAssignModalOpen(false)
    setSelectedPartnerId('')
  }

  const handleCancel = () => {
    setOrder((current) => ({ ...current, status: 'Cancelled', balanceDue: 0 }))
    setIsCancelModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/orders')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{order.orderNumber}</h1>
              <Badge variant={orderStatusBadgeVariant(order.status)}>{order.status}</Badge>
              {order.requiresApproval && order.status === 'Confirmed' && <Badge variant="warning">Needs Approval</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">{order.customerName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canApprove && (
            <>
              <Button variant="danger" size="sm" onClick={handleReject}>
                <X className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button variant="primary" size="sm" onClick={handleApprove}>
                <Check className="size-4" aria-hidden="true" />
                Approve
              </Button>
            </>
          )}
          {canAssignPartner && (
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
              <Truck className="size-4" aria-hidden="true" />
              Assign Delivery Partner
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={IndianRupee} iconVariant="neutral" label="Subtotal" value={formatCurrency(order.subtotal)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Discount" value={formatCurrency(order.discountAmount)} />
        <StatCard icon={IndianRupee} iconVariant="info" label="GST Amount" value={formatCurrency(order.gstAmount)} />
        <StatCard icon={IndianRupee} iconVariant="primary" label="Total" value={formatCurrency(order.total)} />
        <StatCard icon={Wallet} iconVariant="success" label="Amount Paid" value={formatCurrency(order.amountPaid)} />
        <StatCard icon={Wallet} iconVariant="danger" label="Balance Due" value={formatCurrency(order.balanceDue)} />
      </div>

      <Card title="Order Items" subtitle="Products included in this order" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3">Variant</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">GST Rate</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">GST Amount</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {order.items.map((item) => (
                <tr key={item.productId} className="transition-colors hover:bg-primary-50/35">
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{item.name}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{item.variant}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.qty}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.price)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{Math.round(item.gstRate * 100)}%</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.gstAmount)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Customer">
          {customer ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Name</p>
                <Link
                  to={`/admin/customers/${customer.id}`}
                  className="mt-1 block text-sm font-medium text-primary-600 hover:underline"
                >
                  {customer.name}
                </Link>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone</p>
                <p className="mt-1 text-sm text-neutral-800">{customer.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Address</p>
                <p className="mt-1 text-sm text-neutral-800">{customer.city || '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Customer record not found.</p>
          )}
        </Card>

        <Card title="Order Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Order Date</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDate(order.orderDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Expected Delivery</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDate(order.expectedDeliveryDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Sales Officer</p>
              <p className="mt-1 text-sm text-neutral-800">{salesOfficer?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Delivery Partner</p>
              <p className="mt-1 text-sm text-neutral-800">{deliveryPartner?.name || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment Status</p>
              <Badge variant={paymentBadgeVariant[order.paymentStatus]} className="mt-1">
                {order.paymentStatus}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Status History" subtitle="Order lifecycle milestones">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Package className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-800">Order placed</p>
              <p className="text-xs text-neutral-400">{formatDate(order.orderDate)}</p>
            </div>
          </div>
          {order.expectedDeliveryDate && (
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                <Truck className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-800">Expected delivery</p>
                <p className="text-xs text-neutral-400">{formatDate(order.expectedDeliveryDate)}</p>
              </div>
            </div>
          )}
        </div>
        {/* TODO: replace with real activity log once the Audit Log API is wired up */}
      </Card>

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Delivery Partner"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!selectedPartnerId} onClick={handleAssignPartner}>
              Assign
            </Button>
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

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Order"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            This will cancel {order.orderNumber} for {order.customerName}. This action cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)}>
              Keep Order
            </Button>
            <Button type="button" variant="danger" onClick={handleCancel}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
