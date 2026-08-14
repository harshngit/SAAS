import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Ban,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  IndianRupee,
  Pencil,
  Receipt,
  ShoppingCart,
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
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { orderStatusBadgeVariant, orders as seedOrders } from '../../mockData/orders'
import { customers } from '../../mockData/customers'
import { users } from '../../mockData/users'
import { getInvoiceByOrderNumber } from '../../mockData/invoices'
import { formatCurrency } from '../../utils/format'

const paymentBadgeVariant = { Paid: 'success', Partial: 'warning', Unpaid: 'danger' }
const cancellableStatuses = ['Draft', 'Confirmed', 'Processing']
const reservedFromStatus = ['Confirmed', 'Processing', 'Out for Delivery', 'Delivered', 'Partially Delivered']
const loadedFromStatus = ['Out for Delivery', 'Delivered', 'Partially Delivered']
const transitFromStatus = ['Out for Delivery', 'Delivered', 'Partially Delivered']

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const formatDateTime = (value, time) => {
  if (!value) return '—'
  return `${formatDate(value)}${time ? ` ${time}` : ''}`
}

const deliveryPartners = users.filter((user) => user.role === 'delivery_partner')

function StepperNode({ index, label, status, timestamp, isLast }) {
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
        <p className="mt-0.5 text-center text-[0.65rem] text-neutral-400">{status === 'pending' ? 'Pending' : timestamp}</p>
      </div>
      {!isLast && <div className={`mt-4 h-0.5 flex-1 ${status === 'done' ? 'bg-primary-500' : 'bg-neutral-100'}`} />}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const initialOrder = useMemo(() => seedOrders.find((item) => item.id === id), [id])
  const [order, setOrder] = useState(initialOrder)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [activityNotes, setActivityNotes] = useState([])

  const customer = useMemo(() => customers.find((item) => item.id === order?.customerId), [order])
  const deliveryPartner = useMemo(
    () => (order?.deliveryPartnerId ? users.find((user) => user.id === order.deliveryPartnerId) : null),
    [order],
  )
  const invoice = useMemo(() => (order ? getInvoiceByOrderNumber(order.orderNumber) : null), [order])

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
  const isDelivered = order.status === 'Delivered'
  const isReserved = reservedFromStatus.includes(order.status)
  const isLoaded = loadedFromStatus.includes(order.status)
  const isInTransit = transitFromStatus.includes(order.status)

  const fulfillmentSteps = [
    { label: 'Order Created', status: 'done', timestamp: formatDateTime(order.orderDate, '') },
    { label: 'Stock Reserved', status: isReserved ? 'done' : order.status === 'Draft' ? 'pending' : 'current', timestamp: formatDate(order.orderDate) },
    { label: 'Delivery Assigned', status: order.deliveryPartnerId ? 'done' : canAssignPartner ? 'current' : 'pending', timestamp: formatDate(order.orderDate) },
    { label: 'Loaded', status: isLoaded ? 'done' : order.deliveryPartnerId && !isLoaded ? 'current' : 'pending', timestamp: formatDate(order.expectedDeliveryDate) },
    { label: 'In Transit', status: isInTransit ? 'done' : isLoaded ? 'current' : 'pending', timestamp: formatDate(order.expectedDeliveryDate) },
    { label: 'Delivered', status: isDelivered ? 'done' : isInTransit ? 'current' : 'pending', timestamp: formatDate(order.expectedDeliveryDate) },
    { label: 'Invoice', status: invoice ? 'done' : isDelivered ? 'current' : 'pending', timestamp: invoice ? formatDate(invoice.invoiceDate) : '' },
  ]

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

  const handleAddNote = () => {
    if (!internalNote.trim()) return
    setActivityNotes((current) => [{ text: internalNote.trim(), at: new Date().toISOString() }, ...current])
    setInternalNote('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/orders')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Orders
          </Button>
          <div>
            <p className="text-xs font-medium text-neutral-400">Order Details</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{order.orderNumber}</h1>
              <Badge variant={orderStatusBadgeVariant(order.status)}>{order.status}</Badge>
              <Badge variant={paymentBadgeVariant[order.paymentStatus]}>{order.paymentStatus === 'Partial' ? 'Partially Paid' : order.paymentStatus}</Badge>
              {order.requiresApproval && order.status === 'Confirmed' && <Badge variant="warning">Needs Approval</Badge>}
            </div>
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
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden="true" />
            Edit Order
          </Button>
          {canAssignPartner && (
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
              <Truck className="size-4" aria-hidden="true" />
              Assign Delivery
            </Button>
          )}
          {invoice ? (
            <Button variant="primary" size="sm" onClick={() => navigate(`/admin/invoices/${invoice.invoiceNumber}`)}>
              <FileText className="size-4" aria-hidden="true" />
              View Invoice
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => navigate('/admin/invoices/new')}>
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

      <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><User className="size-3.5" />Customer</p>
          <Link to={customer ? `/admin/customers/${customer.id}` : '#'} className="mt-1 block truncate text-sm font-medium text-primary-700 hover:underline">
            {order.customerName}
          </Link>
          <p className="truncate text-xs text-neutral-400">{customer?.city || '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Calendar className="size-3.5" />Order Date</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{formatDate(order.orderDate)}</p>
          <p className="text-xs text-neutral-400">Delivery {formatDate(order.expectedDeliveryDate)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Wallet className="size-3.5" />Payment Type</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">Credit</p>
          <p className="text-xs text-neutral-400">15 Days</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Warehouse className="size-3.5" />Warehouse</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">Main Warehouse</p>
          <p className="truncate text-xs text-neutral-400">{customer?.city || '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Truck className="size-3.5" />Delivery Partner</p>
          <p className="mt-1 truncate text-sm font-medium text-neutral-900">{deliveryPartner?.name || 'Unassigned'}</p>
          <p className="text-xs text-neutral-400">{deliveryPartner?.phone || '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400"><IndianRupee className="size-3.5" />Total Amount</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(order.total)}</p>
          <p className="text-xs text-red-500">Due {formatCurrency(order.balanceDue)}</p>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="flex items-start">
          {fulfillmentSteps.map((step, index) => (
            <StepperNode key={step.label} index={index + 1} isLast={index === fulfillmentSteps.length - 1} {...step} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
                {order.items.map((item, index) => {
                  const delivered = isDelivered ? item.qty : order.status === 'Partially Delivered' ? Math.round(item.qty / 2) : 0
                  const reserved = isReserved ? item.qty : 0

                  return (
                    <tr key={item.productId} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-400">{index + 1}</td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <p className="font-medium text-neutral-800">{item.name}</p>
                        <p className="text-xs text-neutral-400">{item.variant}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.price)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.qty}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{reserved}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{delivered}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-neutral-50/60 font-semibold text-neutral-900">
                  <td colSpan={3} />
                  <td className="px-5 py-3 text-right">{order.items.reduce((sum, item) => sum + item.qty, 0)}</td>
                  <td colSpan={2} />
                  <td className="px-5 py-3 text-right">{formatCurrency(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Stock & Fulfillment">
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-neutral-500">Warehouse</span><span className="font-medium text-neutral-900">Main Warehouse</span></div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Reservation Status</span>
              <Badge variant={isReserved ? 'success' : 'neutral'}>{isReserved ? 'Reserved' : 'Not Reserved'}</Badge>
            </div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Reserved On</span><span className="font-medium text-neutral-900">{isReserved ? formatDate(order.orderDate) : '—'}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Reserved By</span><span className="font-medium text-neutral-900">{isReserved ? 'System' : '—'}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Picking Status</span>
              <Badge variant={isLoaded ? 'success' : 'neutral'}>{isLoaded ? 'Completed' : 'Pending'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Packing Status</span>
              <Badge variant={isLoaded ? 'success' : 'neutral'}>{isLoaded ? 'Completed' : 'Pending'}</Badge>
            </div>
          </div>
        </Card>

        <Card title="Payment Summary">
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-neutral-500">Subtotal (Before Tax)</span><span className="font-medium text-neutral-900">{formatCurrency(order.subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Discount</span><span className="font-medium text-red-500">-{formatCurrency(order.discountAmount)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Tax</span><span className="font-medium text-neutral-900">{formatCurrency(order.gstAmount)}</span></div>
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3"><span className="font-semibold text-neutral-900">Total Amount</span><span className="font-semibold text-neutral-900">{formatCurrency(order.total)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Amount Paid</span><span className="font-medium text-green-600">{formatCurrency(order.amountPaid)}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Due Amount</span><span className="font-medium text-red-500">{formatCurrency(order.balanceDue)}</span></div>
          </div>
          {order.balanceDue > 0 && (
            <div className="mt-4 rounded-xl bg-primary-50 px-4 py-3">
              <p className="text-xs text-primary-700">Balance Due</p>
              <p className="text-xl font-semibold text-primary-700">{formatCurrency(order.balanceDue)}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Delivery Information">
          {deliveryPartner ? (
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Delivery Partner</span><span className="text-right font-medium text-neutral-900">{deliveryPartner.name}<br /><span className="text-xs font-normal text-neutral-400">{deliveryPartner.phone}</span></span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Vehicle No.</span><span className="font-medium text-neutral-900">Not tracked</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Route / Area</span><span className="font-medium text-neutral-900">{customer?.city || '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Assigned On</span><span className="font-medium text-neutral-900">{formatDate(order.orderDate)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Expected Delivery</span><span className="font-medium text-neutral-900">{formatDate(order.expectedDeliveryDate)}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">POD Status</span>
                <Badge variant={isDelivered ? 'success' : 'warning'}>{isDelivered ? 'Uploaded' : 'Pending'}</Badge>
              </div>
            </div>
          ) : (
            <EmptyState icon={Truck} title="No delivery partner assigned" description="Assign a delivery partner to start fulfillment." />
          )}
        </Card>

        <Card title="Notes & Activity Timeline">
          <div className="space-y-3">
            {order.notes && (
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs font-medium text-neutral-500">Order Notes</p>
                <p className="mt-1 text-sm text-neutral-700">{order.notes}</p>
              </div>
            )}
            <div>
              <textarea
                value={internalNote}
                maxLength={250}
                onChange={(event) => setInternalNote(event.target.value)}
                placeholder="Add internal note..."
                className="h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-neutral-400">{internalNote.length} / 250</p>
                <Button type="button" size="sm" onClick={handleAddNote}>Add Note</Button>
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-100 pt-3">
              {activityNotes.map((note, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="mt-1 flex size-2 shrink-0 rounded-full bg-primary-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-700">{note.text}</p>
                    <p className="text-xs text-neutral-400">{formatDate(note.at.slice(0, 10))}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm text-neutral-700">Order created</p>
                  <p className="text-xs text-neutral-400">{formatDate(order.orderDate)}</p>
                </div>
              </div>
              {order.deliveryPartnerId && (
                <div className="flex items-start gap-2.5">
                  <Truck className="mt-0.5 size-4 shrink-0 text-primary-600" />
                  <div>
                    <p className="text-sm text-neutral-700">Delivery assigned to {deliveryPartner?.name}</p>
                    <p className="text-xs text-neutral-400">{formatDate(order.orderDate)}</p>
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="w-full border-t border-neutral-100 pt-3 text-sm font-medium text-primary-700 hover:underline">
              View full activity
            </button>
          </div>
        </Card>

        <Card title="Related Documents">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">Quotation</p>
                  <p className="text-xs text-neutral-400">QT-2026-{order.orderNumber.slice(-4)}</p>
                </div>
              </div>
              <Badge variant="success">Linked</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3">
              <div className="flex items-center gap-2.5">
                <Box className="size-4 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">Delivery Challan</p>
                  <p className="text-xs text-neutral-400">DC-2026-{order.orderNumber.slice(-4)}</p>
                </div>
              </div>
              <Badge variant={isLoaded ? 'primary' : 'neutral'}>{isLoaded ? 'Ready' : 'Pending'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3">
              <div className="flex items-center gap-2.5">
                <Receipt className="size-4 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">Invoice</p>
                  <p className="text-xs text-neutral-400">{invoice ? invoice.invoiceNumber : 'Not created yet'}</p>
                </div>
              </div>
              {invoice ? (
                <Button size="sm" variant="outline" onClick={() => navigate(`/admin/invoices/${invoice.invoiceNumber}`)}>View</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => navigate('/admin/invoices/new')}>Create</Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3">
              <div className="flex items-center gap-2.5">
                <Wallet className="size-4 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">Payment Receipt</p>
                  <p className="text-xs text-neutral-400">{order.amountPaid > 0 ? `PR-2026-${order.orderNumber.slice(-4)}` : 'No payment recorded'}</p>
                </div>
              </div>
              <Badge variant={order.amountPaid > 0 ? 'success' : 'neutral'}>{order.amountPaid > 0 ? 'Paid' : 'Pending'}</Badge>
            </div>
          </div>
        </Card>
      </div>

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
