import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, FileCheck2, Plus, Trash2, Upload } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { createInvoice, invoiceOrder, listInvoices } from '../../api/invoices'
import { listCustomers } from '../../api/customers'
import { getDelivery, listDeliveries } from '../../api/deliveries'
import { listOrders, getOrder } from '../../api/orders'
import { listProducts } from '../../api/products'
import { listWarehouses } from '../../api/warehouses'
import { getSalesWorkflowSettings } from '../../api/settings'
import { formatCurrency } from '../../utils/format'
import { getPaymentMethodFlags, sanitizePaymentDetails } from '../payments/paymentMethodUtils'

const orderStatusBadgeVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

function formatOrderDate(value) {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const paymentTypeOptions = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
]

function emptyItem() {
  return { productId: '', quantity: 1, unitPrice: '', discount: 0, taxRate: 0, batchNumber: '', serialNumbers: [] }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Order-based invoicing bills what the order already has (rates/discounts/tax snapshotted
// server-side) - no manual item entry, just a summary + confirm. Invoice quantity is always
// the actual delivered quantity, never the ordered quantity.
const billableDeliveryStatuses = ['delivered', 'partially_delivered']

const invoiceErrorHints = [
  { match: 'no delivered quantity', hint: 'This order has no delivered quantity to invoice yet.' },
  { match: 'pending delivery quantity', hint: 'Complete the pending delivery before creating the final invoice.' },
  { match: 'bills per delivery', hint: 'Select a delivery to invoice, then try again.' },
]

function friendlyInvoiceError(message) {
  const lower = (message || '').toLowerCase()
  const hint = invoiceErrorHints.find((entry) => lower.includes(entry.match))
  return hint ? hint.hint : message
}

function OrderInvoicePanel({ orderId }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [order, setOrder] = useState(null)
  const [allDeliveries, setAllDeliveries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [wholeOrderInvoice, setWholeOrderInvoice] = useState(null)
  const [invoiceMode, setInvoiceMode] = useState('per_delivery')
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('')
  const [previewDelivery, setPreviewDelivery] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [duplicateInvoice, setDuplicateInvoice] = useState(null)

  const loadData = () => {
    setIsLoading(true)

    return Promise.all([
      getOrder(orderId),
      listDeliveries({ order_id: orderId }),
      listInvoices({ order_id: orderId }),
      getSalesWorkflowSettings(),
    ]).then(([orderResult, deliveriesResult, invoicesResult, settingsResult]) => {
      if (!orderResult.success) {
        setLoadError(orderResult.error)
        setIsLoading(false)
        return
      }

      setOrder(orderResult.order)

      const invoiceList = invoicesResult.success ? invoicesResult.invoices : []
      setInvoices(invoiceList)
      const wholeOrder = invoiceList.find((invoice) => !invoice.deliveryId) || null
      setWholeOrderInvoice(wholeOrder)

      const mode = settingsResult.success ? settingsResult.settings.partialDeliveryInvoiceMode : 'per_delivery'
      setInvoiceMode(mode)

      const invoicedDeliveryIds = new Set(invoiceList.map((invoice) => invoice.deliveryId).filter(Boolean))
      const deliveries = deliveriesResult.success ? deliveriesResult.deliveries : []
      setAllDeliveries(deliveries)

      const billable = deliveries.filter(
        (delivery) => billableDeliveryStatuses.includes(delivery.status) && !invoicedDeliveryIds.has(delivery.id),
      )
      if (mode === 'per_delivery' && billable.length === 1) setSelectedDeliveryId(billable[0].id)

      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (invoiceMode !== 'per_delivery' || !selectedDeliveryId) {
      setPreviewDelivery(null)
      return
    }

    let isMounted = true

    getDelivery(selectedDeliveryId).then((result) => {
      if (!isMounted) return
      setPreviewDelivery(result.success ? result.delivery : null)
    })

    return () => {
      isMounted = false
    }
  }, [invoiceMode, selectedDeliveryId])

  // Preview must reflect what actually gets invoiced - the delivered quantity on the
  // selected delivery (per_delivery mode) or across the whole order (after_full_order mode) -
  // never the ordered quantity. Rate/tax still come from the order line since delivery lines
  // don't carry pricing.
  const previewItems = useMemo(() => {
    if (!order) return []
    if (!previewDelivery) {
      return order.items
        .filter((item) => (item.deliveredQuantity || 0) > 0)
        .map((item) => ({ ...item, deliveredQuantity: item.deliveredQuantity || 0 }))
    }

    return previewDelivery.items
      .filter((deliveryItem) => (deliveryItem.deliveredQuantity || 0) > 0)
      .map((deliveryItem) => {
        const orderItem = order.items.find((item) => item.id === deliveryItem.orderItemId) || {}
        return {
          id: deliveryItem.id,
          productName: deliveryItem.productName || orderItem.productName,
          deliveredQuantity: deliveryItem.deliveredQuantity || 0,
          unitPrice: orderItem.unitPrice || 0,
          discount: orderItem.discount || 0,
          taxRate: orderItem.taxRate || 0,
        }
      })
  }, [order, previewDelivery])

  const previewLineAmounts = previewItems.map((item) => {
    const gross = (item.deliveredQuantity || 0) * (item.unitPrice || 0)
    const taxable = gross - gross * ((item.discount || 0) / 100)
    const tax = taxable * ((item.taxRate || 0) / 100)
    return { subtotal: taxable, tax, total: taxable + tax }
  })
  const previewSubtotal = previewLineAmounts.reduce((sum, line) => sum + line.subtotal, 0)
  const previewTax = previewLineAmounts.reduce((sum, line) => sum + line.tax, 0)
  const previewTotal = previewSubtotal + previewTax

  const invoicedByDeliveryId = useMemo(() => {
    const map = {}
    invoices.forEach((invoice) => {
      if (invoice.deliveryId) map[invoice.deliveryId] = invoice
    })
    return map
  }, [invoices])

  const billableUninvoicedDeliveries = allDeliveries.filter(
    (delivery) => billableDeliveryStatuses.includes(delivery.status) && !invoicedByDeliveryId[delivery.id],
  )

  const isPickupOrder = order?.fulfilmentMethod === 'pickup'

  const handleIssue = async () => {
    setIsSubmitting(true)
    setSubmitError('')
    setDuplicateInvoice(null)

    const result = await invoiceOrder(orderId, !isPickupOrder && invoiceMode === 'per_delivery' ? selectedDeliveryId : undefined)

    if (!result.success) {
      if (result.duplicateRef) {
        let invoiceId = result.duplicateRef.id
        let invoiceNumber = result.duplicateRef.invoiceNumber

        if (!invoiceId) {
          const lookup = await listInvoices({ order_id: orderId })
          const match = lookup.success
            ? lookup.invoices.find((invoice) => invoice.invoiceNumber === invoiceNumber || invoice.id === invoiceId)
            : null
          invoiceId = match?.id
          invoiceNumber = match?.invoiceNumber || invoiceNumber
        }

        if (invoiceId) setDuplicateInvoice({ id: invoiceId, invoiceNumber })
      }

      setSubmitError(friendlyInvoiceError(result.error))
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Invoice created successfully', message: `${result.invoice.invoiceNumber} created from ${order?.orderNumber}.` })
    navigate(`/admin/invoices/${result.invoice.id}`)
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading order..." />
  }

  if (loadError || !order) {
    return <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError || 'Order not found.'}</div>
  }

  // Pickup orders never go through the delivery pipeline at all - no delivery records ever
  // exist for them, so the per_delivery/after_full_order delivery-selection logic below must
  // not apply. They always bill the whole order directly, gated only on whether the pickup has
  // actually been collected (which is when delivered_quantity gets set on the order items).
  const hasDeliveredQuantity = order.items.some((item) => (item.deliveredQuantity || 0) > 0)
  const isAfterFullOrderMode = !isPickupOrder && invoiceMode === 'after_full_order'
  const orderFullyDelivered = order.fulfilmentStatus === 'delivered'
  const needsDeliveryChoice = !isPickupOrder && invoiceMode === 'per_delivery' && billableUninvoicedDeliveries.length > 1
  const noBillableDelivery = !isPickupOrder && invoiceMode === 'per_delivery' && billableUninvoicedDeliveries.length === 0 && !wholeOrderInvoice
  const pickupNotCollected = isPickupOrder && !hasDeliveredQuantity && !wholeOrderInvoice

  // Already-invoiced states short-circuit the whole panel - never let the user attempt a duplicate.
  if (wholeOrderInvoice) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800">
          Invoice already exists for this order.
        </div>
        <Button type="button" className="w-full" onClick={() => navigate(`/admin/invoices/${wholeOrderInvoice.id}`)}>
          <FileCheck2 className="size-4" aria-hidden="true" />
          View Invoice {wholeOrderInvoice.invoiceNumber}
        </Button>
      </div>
    )
  }

  if (pickupNotCollected) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        This order has not been collected yet. Complete the pickup before creating an invoice.
      </div>
    )
  }

  if (isAfterFullOrderMode && !orderFullyDelivered) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Complete the pending delivery before creating the final invoice. This organization only invoices an order once it is fully delivered.
      </div>
    )
  }

  if (noBillableDelivery) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        This order has no delivered quantity to invoice yet.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <p className="text-sm font-semibold text-neutral-900">Invoicing Order {order.orderNumber}</p>
        <p className="mt-1 text-sm text-neutral-500">Customer: {order.customerName}</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="px-3.5 py-2.5">Product</th>
                <th className="px-3.5 py-2.5 text-right">{isPickupOrder ? 'Collected Qty' : 'Delivered Qty'}</th>
                <th className="px-3.5 py-2.5 text-right">Rate</th>
                <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                <th className="px-3.5 py-2.5 text-right">GST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {previewItems.map((item, index) => (
                <tr key={item.id || item.productId}>
                  <td className="px-3.5 py-2.5 text-neutral-800">{item.productName}</td>
                  <td className="px-3.5 py-2.5 text-right text-neutral-600">{item.deliveredQuantity}</td>
                  <td className="px-3.5 py-2.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-3.5 py-2.5 text-right text-neutral-600">{formatCurrency(previewLineAmounts[index]?.subtotal)}</td>
                  <td className="px-3.5 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(previewLineAmounts[index]?.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
          <span className="text-sm font-semibold text-neutral-900">Total</span>
          <span className="text-lg font-semibold text-primary-700">{formatCurrency(previewTotal)}</span>
        </div>
      </div>

      {invoiceMode === 'per_delivery' && allDeliveries.length > 0 && (
        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">Deliveries</p>
          <p className="mt-1 text-xs text-neutral-400">This organization bills per delivery. Select which delivery this invoice covers.</p>
          <div className="mt-3 space-y-2">
            {allDeliveries.map((delivery) => {
              const deliveryInvoice = invoicedByDeliveryId[delivery.id]
              const deliveredQty = delivery.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0)
              const isBillable = billableDeliveryStatuses.includes(delivery.status) && !deliveryInvoice
              const isSelected = selectedDeliveryId === delivery.id

              return (
                <div
                  key={delivery.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    isSelected ? 'border-primary-300 bg-primary-50/40' : 'border-neutral-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">{delivery.deliveryNumber}</p>
                      <Badge variant={delivery.status === 'delivered' ? 'success' : 'warning'}>{delivery.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">Delivered: {deliveredQty}</p>
                  </div>
                  <div className="shrink-0">
                    {deliveryInvoice ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/admin/invoices/${deliveryInvoice.id}`)}>
                        View Invoice {deliveryInvoice.invoiceNumber}
                      </Button>
                    ) : isBillable ? (
                      <Button type="button" size="sm" variant={isSelected ? 'primary' : 'outline'} onClick={() => setSelectedDeliveryId(delivery.id)}>
                        {isSelected ? 'Selected' : 'Create Invoice'}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled title="This delivery has not been delivered yet">
                        Not Available
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {submitError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{submitError}</p>
          {duplicateInvoice && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate(`/admin/invoices/${duplicateInvoice.id}`)}
            >
              View Invoice {duplicateInvoice.invoiceNumber}
            </Button>
          )}
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        loading={isSubmitting}
        disabled={needsDeliveryChoice && !selectedDeliveryId}
        onClick={handleIssue}
      >
        <FileCheck2 className="size-4" aria-hidden="true" />
        Issue Invoice
      </Button>
    </div>
  )
}

// Select a customer, then show every order they have (invoiceable or not) so nothing is
// hidden - each order's action reflects its real state: not yet delivered, ready to invoice,
// or already invoiced (possibly more than once, for per-delivery billing). Invoice state is
// checked per-order via order_id (the confirmed-supported filter), never a bulk customer_id
// invoice fetch, so a mismatch there can't silently hide a bad state.
function FromOrderFlow({ onBack }) {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [invoiceMode, setInvoiceMode] = useState('per_delivery')
  const [orders, setOrders] = useState([])
  const [invoicesByOrder, setInvoicesByOrder] = useState({})
  const [moreToInvoiceByOrder, setMoreToInvoiceByOrder] = useState({})
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)

  useEffect(() => {
    Promise.all([listCustomers(), getSalesWorkflowSettings()]).then(([customersResult, settingsResult]) => {
      if (customersResult.success) setCustomers(customersResult.customers)
      if (settingsResult.success) setInvoiceMode(settingsResult.settings.partialDeliveryInvoiceMode)
      setIsLoadingCustomers(false)
    })
  }, [])

  useEffect(() => {
    if (!customerId) {
      setOrders([])
      setInvoicesByOrder({})
      setMoreToInvoiceByOrder({})
      return
    }

    let isMounted = true
    setIsLoadingOrders(true)

    async function load() {
      const ordersResult = await listOrders({ customer_id: customerId })
      if (!isMounted) return
      const customerOrders = ordersResult.success ? ordersResult.orders : []
      setOrders(customerOrders)

      const invoiceResults = await Promise.all(customerOrders.map((order) => listInvoices({ order_id: order.id })))
      if (!isMounted) return

      const invoiceMap = {}
      customerOrders.forEach((order, index) => {
        const result = invoiceResults[index]
        invoiceMap[order.id] = result.success ? result.invoices : []
      })
      setInvoicesByOrder(invoiceMap)

      // Per-delivery orgs can have more to invoice even after one invoice exists - only
      // check deliveries for orders that already have an invoice but no whole-order one.
      if (invoiceMode === 'per_delivery') {
        const ordersNeedingCheck = customerOrders.filter((order) => {
          const orderInvoices = invoiceMap[order.id] || []
          return orderInvoices.length > 0 && !orderInvoices.some((invoice) => !invoice.deliveryId)
        })

        if (ordersNeedingCheck.length > 0) {
          const deliveryResults = await Promise.all(ordersNeedingCheck.map((order) => listDeliveries({ order_id: order.id })))
          if (!isMounted) return

          const moreMap = {}
          ordersNeedingCheck.forEach((order, index) => {
            const result = deliveryResults[index]
            const deliveries = result.success ? result.deliveries : []
            const invoicedDeliveryIds = new Set((invoiceMap[order.id] || []).map((invoice) => invoice.deliveryId).filter(Boolean))
            moreMap[order.id] = deliveries.some(
              (delivery) => billableDeliveryStatuses.includes(delivery.status) && !invoicedDeliveryIds.has(delivery.id),
            )
          })
          setMoreToInvoiceByOrder(moreMap)
        } else {
          setMoreToInvoiceByOrder({})
        }
      } else {
        setMoreToInvoiceByOrder({})
      }

      setIsLoadingOrders(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [customerId, invoiceMode])

  const customerOptions = useMemo(() => customers.map((customer) => ({ value: customer.id, label: customer.name })), [customers])
  const selectedCustomer = customers.find((customer) => customer.id === customerId)

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>

      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <Select
          label="Select Customer"
          searchable
          options={customerOptions}
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          placeholder={isLoadingCustomers ? 'Loading...' : 'Search customer...'}
          disabled={isLoadingCustomers}
        />
      </div>

      {customerId && (
        isLoadingOrders ? (
          <LoadingSpinner label="Loading orders..." />
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            {selectedCustomer?.name || 'This customer'} has no orders yet.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const orderInvoices = invoicesByOrder[order.id] || []
              const wholeOrderInvoice = orderInvoices.find((invoice) => !invoice.deliveryId)
              const deliveredQty = order.items.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0)
              const hasDelivered = deliveredQty > 0
              const canCreateNext = !wholeOrderInvoice && invoiceMode === 'per_delivery' && moreToInvoiceByOrder[order.id]

              return (
                <div
                  key={order.id}
                  className="rounded-[1.25rem] border border-neutral-100 bg-white p-4 shadow-(--shadow-card) sm:flex sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-900">{order.orderNumber}</p>
                      <Badge variant={orderStatusBadgeVariant[order.status] || 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
                      <Badge variant={order.fulfilmentStatus === 'delivered' ? 'success' : 'warning'}>
                        {order.fulfilmentStatus.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {formatOrderDate(order.orderDate)} · Total {formatCurrency(order.total)} · Delivered {deliveredQty}
                      {!hasDelivered && orderInvoices.length === 0 && ' · No delivered quantity'}
                    </p>
                  </div>
                  <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
                    {orderInvoices.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/invoices/${orderInvoices[0].id}`)}
                      >
                        {orderInvoices.length > 1 ? `View Invoices (${orderInvoices.length})` : `View Invoice ${orderInvoices[0].invoiceNumber}`}
                      </Button>
                    )}
                    {orderInvoices.length === 0 && hasDelivered && (
                      <Button type="button" size="sm" onClick={() => navigate(`/admin/invoices/new?orderId=${order.id}`)}>
                        Create Invoice
                      </Button>
                    )}
                    {canCreateNext && (
                      <Button type="button" size="sm" onClick={() => navigate(`/admin/invoices/new?orderId=${order.id}`)}>
                        Create Next Invoice
                      </Button>
                    )}
                    {orderInvoices.length === 0 && !hasDelivered && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled
                        title="No delivered quantity is available for invoicing"
                      >
                        Not Available
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

export default function CreateSalesInvoice() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [createMode, setCreateMode] = useState('choice')

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  const [customerType, setCustomerType] = useState('existing')
  const [customerId, setCustomerId] = useState('')
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [warehouseId, setWarehouseId] = useState('')
  const [paymentType, setPaymentType] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentDetails, setPaymentDetails] = useState({
    reference: '',
    upiId: '',
    cardType: '',
    cardLastFour: '',
    collectionInstructions: '',
    paymentStatus: 'pending',
  })
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [additionalCharges, setAdditionalCharges] = useState('0')
  const [discount, setDiscount] = useState('0')

  const [submitError, setSubmitError] = useState('')
  const [stockShortages, setStockShortages] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (createMode !== 'direct') return

    let isMounted = true

    Promise.all([listCustomers(), listProducts(), listWarehouses()]).then(([customersResult, productsResult, warehousesResult]) => {
      if (!isMounted) return
      if (customersResult.success) setCustomers(customersResult.customers)
      if (productsResult.success) setProducts(productsResult.products)
      if (warehousesResult.success) {
        setWarehouses(warehousesResult.warehouses)
        const defaultWarehouse = warehousesResult.warehouses.find((warehouse) => warehouse.isDefault)
        setWarehouseId(defaultWarehouse?.id || warehousesResult.warehouses[0]?.id || '')
      }
      setIsLoadingOptions(false)
    })

    return () => {
      isMounted = false
    }
  }, [createMode])

  useEffect(() => {
    setPaymentDetails({
      reference: '',
      upiId: '',
      cardType: '',
      cardLastFour: '',
      collectionInstructions: '',
      paymentStatus: paymentType === 'cod' ? 'pending' : '',
    })
  }, [paymentType])

  const customerOptions = useMemo(() => customers.map((customer) => ({ value: customer.id, label: customer.name })), [customers])
  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: product.name, product })), [products])

  const lineItems = useMemo(
    () =>
      items
        .filter((item) => item.productId)
        .map((item) => {
          const product = products.find((p) => p.id === item.productId)
          const quantity = Number(item.quantity) || 0
          const unitPrice = Number(item.unitPrice) || 0
          const lineSubtotal = unitPrice * quantity
          const discountAmount = (lineSubtotal * (Number(item.discount) || 0)) / 100
          const taxable = lineSubtotal - discountAmount
          const taxAmount = taxable * ((Number(item.taxRate) || 0) / 100)
          return { ...item, product, quantity, unitPrice, discountAmount, taxAmount, amount: taxable + taxAmount }
        }),
    [items, products],
  )

  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const discountTotal = lineItems.reduce((sum, item) => sum + item.discountAmount, 0)
  const taxTotal = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const chargesTotal = Number(additionalCharges) || 0
  const orderLevelDiscount = Number(discount) || 0
  const grandTotal = subtotal - discountTotal - orderLevelDiscount + taxTotal + chargesTotal
  const paidAmount = Number(amountPaid) || 0
  const dueAmount = Math.max(0, grandTotal - paidAmount)
  const paymentFlags = getPaymentMethodFlags(paymentType)

  // Rounds/clamps on blur, not on every keystroke - a controlled number input jumps its cursor
  // to the end after any programmatic value change mid-typing, so rounding while "10." is still
  // being typed turns the next digit into the wrong place (e.g. "100" instead of "10").
  const roundItemFieldOnBlur = (index, field, { min = 0, max } = {}) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    const safe = Number.isFinite(rounded) ? rounded : min
    const clamped = max !== undefined ? Math.min(Math.max(safe, min), max) : Math.max(safe, min)
    updateItem(index, field, String(clamped))
  }

  const updateItem = (index, field, value) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: value }

        if (field === 'productId') {
          const product = products.find((p) => p.id === value)
          if (product) {
            nextItem.unitPrice = product.price ?? ''
            nextItem.taxRate = product.tax_rate ?? 0
          }
          nextItem.batchNumber = ''
          nextItem.serialNumbers = []
        }

        return nextItem
      }),
    )
  }

  const addSerialNumber = (index) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, serialNumbers: [...(item.serialNumbers || []), ''] } : item,
      ),
    )
  }

  const updateSerialNumber = (index, serialIndex, value) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const serialNumbers = [...(item.serialNumbers || [])]
        serialNumbers[serialIndex] = value
        return { ...item, serialNumbers }
      }),
    )
  }

  const removeSerialNumber = (index, serialIndex) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, serialNumbers: (item.serialNumbers || []).filter((_, i) => i !== serialIndex) }
          : item,
      ),
    )
  }

  const removeItem = (index) => setItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)))
  const addItem = () => setItems((current) => [...current, emptyItem()])

  const handleIssueInvoice = async (event) => {
    event.preventDefault()

    if (lineItems.length === 0) {
      setSubmitError('Add at least one invoice item before issuing.')
      return
    }
    if (customerType === 'existing' && !customerId) {
      setSubmitError('Select a customer.')
      return
    }
    if (customerType === 'walk-in' && !walkInName.trim()) {
      setSubmitError('Enter a walk-in customer name.')
      return
    }
    if (paymentFlags.showUpiFields && !paymentDetails.upiId.trim()) {
      setSubmitError('Enter a UPI ID.')
      return
    }
    if (paymentFlags.showCardFields) {
      if (!paymentDetails.cardType.trim()) {
        setSubmitError('Enter the card type.')
        return
      }
      if (!/^\d{4}$/.test(paymentDetails.cardLastFour.trim())) {
        setSubmitError('Enter the last 4 digits of the card.')
        return
      }
    }
    if (paymentFlags.showReferenceField && !paymentDetails.reference.trim()) {
      setSubmitError('Enter a transaction/reference ID.')
      return
    }
    if (paymentFlags.showCodFields && !paymentDetails.collectionInstructions.trim()) {
      setSubmitError('Add collection or delivery instructions.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setStockShortages(null)

    const paymentPayload = paymentType
      ? {
          amount: paymentType === 'cod' ? Number(amountPaid) || 0 : paidAmount,
          paymentMethod: paymentType,
          ...sanitizePaymentDetails(paymentType, {
            upiId: paymentDetails.upiId.trim(),
            transactionReference: paymentDetails.reference.trim(),
            cardType: paymentDetails.cardType.trim(),
            cardLastFour: paymentDetails.cardLastFour.trim(),
            collectionInstructions: paymentDetails.collectionInstructions.trim(),
            paymentStatus: paymentDetails.paymentStatus,
          }),
        }
      : undefined

    const result = await createInvoice({
      customerId: customerType === 'existing' ? customerId : undefined,
      walkInName: customerType === 'walk-in' ? walkInName.trim() : undefined,
      walkInPhone: customerType === 'walk-in' ? walkInPhone.trim() : undefined,
      warehouseId,
      invoiceDate,
      discount: orderLevelDiscount,
      additionalCharges: chargesTotal,
      notes: notes.trim() || undefined,
      items: lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: Number(item.discount) || 0,
        taxRate: Number(item.taxRate) || 0,
        batchNumber: item.product?.batch_tracking && item.batchNumber ? item.batchNumber : undefined,
        serialNumbers: item.product?.serial_number_tracking
          ? (item.serialNumbers || []).filter(Boolean)
          : undefined,
      })),
      payment: paymentPayload,
    })

    if (!result.success) {
      setSubmitError(result.error)
      setStockShortages(result.shortages || null)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Invoice issued', message: `${result.invoice.invoiceNumber} issued.` })
    navigate(`/admin/invoices/${result.invoice.id}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/invoices')}
            aria-label="Back to invoices"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              {orderId ? 'Invoice Order' : createMode === 'from-order' ? 'From Sales Order' : createMode === 'direct' ? 'Direct / Walk-in Invoice' : 'Create Invoice'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {orderId
                ? 'Bill the selected sales order.'
                : createMode === 'from-order'
                  ? 'Generate from an existing customer’s delivered sales order.'
                  : createMode === 'direct'
                    ? 'Create a quick/manual invoice without a sales order.'
                    : 'How would you like to create this invoice?'}
            </p>
          </div>
        </div>
      </div>

      {orderId ? (
        <OrderInvoicePanel orderId={orderId} />
      ) : createMode === 'choice' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCreateMode('from-order')}
            className="rounded-[1.25rem] border border-neutral-100 bg-white p-6 text-left shadow-(--shadow-card) transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-(--shadow-card-hover)"
          >
            <FileCheck2 className="size-6 text-primary-700" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-neutral-900">From Sales Order</p>
            <p className="mt-1 text-sm text-neutral-500">Generate from an existing customer's delivered Sales Order.</p>
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('direct')}
            className="rounded-[1.25rem] border border-neutral-100 bg-white p-6 text-left shadow-(--shadow-card) transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-(--shadow-card-hover)"
          >
            <Upload className="size-6 text-primary-700" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-neutral-900">Direct / Walk-in Invoice</p>
            <p className="mt-1 text-sm text-neutral-500">Create a quick/manual invoice without a Sales Order.</p>
          </button>
        </div>
      ) : createMode === 'from-order' ? (
        <FromOrderFlow onBack={() => setCreateMode('choice')} />
      ) : (
        <>
        <button
          type="button"
          onClick={() => setCreateMode('choice')}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
        <form onSubmit={handleIssueInvoice} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            {submitError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{stockShortages ? 'Not enough stock to issue this invoice:' : submitError}</p>
                {stockShortages && (
                  <ul className="mt-2 space-y-1">
                    {stockShortages.map((shortage, index) => (
                      <li key={`${shortage.productId}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">{shortage.productName}</span>
                        <span>requested {shortage.requested}, available {shortage.available}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-700">
                  Customer<span className="text-red-500"> *</span>
                </p>
                <div className="inline-flex rounded-full bg-neutral-100 p-1">
                  {[{ value: 'existing', label: 'Existing Customer' }, { value: 'walk-in', label: 'Walk-in Customer' }].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCustomerType(option.value)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                        customerType === option.value ? 'bg-white text-primary-700 shadow-(--shadow-xs)' : 'text-neutral-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                {customerType === 'existing' ? (
                  <Select
                    options={customerOptions}
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    placeholder={isLoadingOptions ? 'Loading...' : 'Select customer'}
                    disabled={isLoadingOptions}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Walk-in Name" value={walkInName} onChange={(event) => setWalkInName(event.target.value)} required />
                    <Input label="Mobile Number" value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-2">
              <Input label="Invoice Date" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              <Select
                label="Warehouse"
                options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder={isLoadingOptions ? 'Loading...' : 'Select warehouse'}
                disabled={isLoadingOptions}
              />
            </div>

            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Invoice Items</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Qty</th>
                      <th className="px-3 py-2.5">Rate</th>
                      <th className="px-3 py-2.5">Discount %</th>
                      <th className="px-3 py-2.5">Tax %</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="w-9 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {lineItems.map((item, index) => (
                      <Fragment key={index}>
                      <tr>
                        <td className="px-3 py-2.5">
                          <Select
                            options={productOptions}
                            value={item.productId}
                            onChange={(event) => updateItem(index, 'productId', event.target.value)}
                            placeholder={isLoadingOptions ? 'Loading...' : 'Select item'}
                            triggerClassName="min-w-48"
                            disabled={isLoadingOptions}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                            onBlur={roundItemFieldOnBlur(index, 'quantity', { min: 1 })}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => updateItem(index, 'unitPrice', event.target.value)}
                            className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.discount}
                            onChange={(event) => updateItem(index, 'discount', event.target.value)}
                            onBlur={roundItemFieldOnBlur(index, 'discount', { min: 0, max: 100 })}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.taxRate}
                            onChange={(event) => updateItem(index, 'taxRate', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(item.amount)}</td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => removeItem(index)} aria-label="Remove item" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                      {item.product?.batch_tracking && (
                        <tr>
                          <td colSpan={7} className="bg-neutral-50/60 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-xs font-medium text-neutral-500">Batch Number</span>
                              <input
                                type="text"
                                value={item.batchNumber || ''}
                                onChange={(event) => updateItem(index, 'batchNumber', event.target.value)}
                                placeholder="Enter batch number"
                                className="w-48 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                      {item.product?.serial_number_tracking && (
                        <tr>
                          <td colSpan={7} className="bg-neutral-50/60 px-3 py-2.5">
                            <div className="space-y-2">
                              <span className="text-xs font-medium text-neutral-500">Serial Numbers</span>
                              {(item.serialNumbers || []).map((serial, serialIndex) => (
                                <div key={serialIndex} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={serial}
                                    onChange={(event) => updateSerialNumber(index, serialIndex, event.target.value)}
                                    placeholder={`Serial #${serialIndex + 1}`}
                                    className="w-48 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSerialNumber(index, serialIndex)}
                                    aria-label="Remove serial number"
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addSerialNumber(index)}
                                className="flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:underline"
                              >
                                <Plus className="size-3.5" /> Add Serial Number
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
                <Plus className="size-4" /> Add Item
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Additional Charges (₹)" type="number" min="0" step="0.01" value={additionalCharges} onChange={(event) => setAdditionalCharges(event.target.value)} />
              <Input label="Extra Discount (₹)" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </div>

            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Notes</p>
              <textarea
                value={notes}
                maxLength={200}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-3 h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{notes.length}/200</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Payment</p>
              <Select
                className="mt-3"
                options={paymentTypeOptions}
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value)}
                placeholder="Select payment method"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {paymentFlags.showUpiFields && (
                  <>
                    <Input
                      label="UPI ID"
                      value={paymentDetails.upiId}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, upiId: event.target.value }))}
                      required
                    />
                    <Input
                      label="Transaction / Reference ID"
                      value={paymentDetails.reference}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, reference: event.target.value }))}
                      required
                    />
                  </>
                )}

                {paymentFlags.showCardFields && (
                  <>
                    <Input
                      label="Card Type"
                      value={paymentDetails.cardType}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, cardType: event.target.value }))}
                      placeholder="Debit / Credit / RuPay"
                      required
                    />
                    <Input
                      label="Last 4 Digits"
                      value={paymentDetails.cardLastFour}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, cardLastFour: event.target.value }))}
                      inputClassName="tracking-[0.25em]"
                      maxLength={4}
                      required
                    />
                    <Input
                      label="Transaction / Reference ID"
                      value={paymentDetails.reference}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, reference: event.target.value }))}
                      required
                    />
                  </>
                )}

                {paymentFlags.showReferenceField && !paymentFlags.showUpiFields && !paymentFlags.showCardFields && (
                  <Input
                    label="Transaction / Reference ID"
                    value={paymentDetails.reference}
                    onChange={(event) => setPaymentDetails((current) => ({ ...current, reference: event.target.value }))}
                    required
                  />
                )}

                {paymentFlags.showCodFields && (
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">Collection / Delivery Instructions</label>
                    <textarea
                      value={paymentDetails.collectionInstructions}
                      onChange={(event) => setPaymentDetails((current) => ({ ...current, collectionInstructions: event.target.value }))}
                      className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                    <p className="text-xs text-amber-700">Payment status stays pending until the cash is collected.</p>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2.5 border-t border-neutral-100 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-medium text-neutral-800">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Item Discount</span>
                  <span className="font-medium text-red-500">- {formatCurrency(discountTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Extra Discount</span>
                  <span className="font-medium text-red-500">- {formatCurrency(orderLevelDiscount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Tax</span>
                  <span className="font-medium text-neutral-800">{formatCurrency(taxTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Additional Charges</span>
                  <span className="font-medium text-neutral-800">{formatCurrency(chargesTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5 text-base">
                  <span className="font-semibold text-neutral-900">Grand Total</span>
                  <span className="font-semibold text-primary-700">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Input
                  label={paymentType === 'cod' ? 'Amount Collected Now (Optional)' : 'Amount Paid Now (Optional)'}
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                />
                <div className="rounded-xl bg-amber-50 px-3.5 py-2.5">
                  <p className="text-xs text-amber-700">{paymentType === 'cod' ? 'Pending until collected' : 'Due Amount'}</p>
                  <p className="text-lg font-semibold text-amber-700">{formatCurrency(dueAmount)}</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={isSubmitting}>
              <Upload className="size-4" />
              Issue Invoice
            </Button>
          </div>
        </form>
        </>
      )}
    </div>
  )
}
