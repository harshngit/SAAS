import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageSearch, Search } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { apiClient } from '../../api/client'
import { createSalesReturn, getInvoiceReturnedQuantities } from '../../api/salesReturns'
import { listWarehouses } from '../../api/warehouses'
import { formatCurrency } from '../../utils/format'
import { RETURN_REASONS } from './salesReturnHelpers'
import { SALES_RETURNS_DEMO_ENABLED, createDemoSalesReturn, demoReturnableOrders } from './salesReturnDemoData'

const today = new Date().toISOString().slice(0, 10)
const returnTypeOptions = ['Credit Note', 'Replacement', 'Refund'].map((value) => ({ value, label: value }))
const reasonOptions = RETURN_REASONS.map((value) => ({ value, label: value }))

// The exact InvoiceItemOut shape isn't documented, so read every field defensively.
function normalizeInvoiceItem(item) {
  return {
    invoiceItemId: item.id || item.invoice_item_id || item.item_id || '',
    productId: item.product_id || item.productId || item.product?.id || '',
    variantId: item.variant_id || item.variantId || '',
    productName: item.product_name || item.productName || item.product?.name || item.name || item.description || 'Item',
    sku: item.sku || item.product_sku || item.product?.sku || '',
    quantity: Number(item.quantity ?? item.quantity_ordered ?? item.qty ?? item.quantity_invoiced ?? 0) || 0,
    unitPrice: Number(item.unit_price ?? item.price ?? item.unitPrice ?? 0) || 0,
    taxRate: Number(item.tax_rate ?? item.taxRate ?? 0) || 0,
  }
}

function normalizeInvoice(data) {
  if (!data) return null
  const items = Array.isArray(data.items) ? data.items : data.invoice_items || []
  return {
    id: data.id || data.invoice_id || '',
    invoiceNumber: data.invoice_number || data.number || data.id || '',
    customerId: data.customer_id || data.customer?.id || '',
    customerName: data.customer?.name || data.customer?.customer_name || data.customer_name || '',
    items: items.map(normalizeInvoiceItem),
  }
}

export default function SalesReturnFormPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const basePath = pathname.startsWith('/sales') ? '/sales/sales-returns' : '/admin/sales-returns'
  const isDemo = SALES_RETURNS_DEMO_ENABLED

  const [invoiceQuery, setInvoiceQuery] = useState(searchParams.get('invoice') || '')
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')
  // { id, invoiceNumber, orderNumber?, customerId, customerName, lines: [{ invoiceItemId, productId,
  //   productName, sku, invoicedQty, alreadyReturned, returnableQty, unitPrice, taxRate }] }
  const [source, setSource] = useState(null)

  const [selectedItems, setSelectedItems] = useState({})
  const [returnQuantities, setReturnQuantities] = useState({})

  const [reason, setReason] = useState(RETURN_REASONS[0])
  const [otherReason, setOtherReason] = useState('')
  const [returnType, setReturnType] = useState('Credit Note')
  const [returnDate, setReturnDate] = useState(today)
  const [warehouseId, setWarehouseId] = useState('')
  const [notes, setNotes] = useState('')

  const [warehouses, setWarehouses] = useState([])
  const [demoOrders, setDemoOrders] = useState([])
  const [demoOrderId, setDemoOrderId] = useState('')

  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isDemo) {
      setDemoOrders(demoReturnableOrders())
      return
    }
    let isMounted = true
    listWarehouses().then((result) => {
      if (!isMounted || !result.success) return
      setWarehouses(result.warehouses)
      const def = result.warehouses.find((warehouse) => warehouse.isDefault)
      setWarehouseId(def?.id || result.warehouses[0]?.id || '')
    })
    return () => {
      isMounted = false
    }
  }, [isDemo])

  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    [warehouses],
  )

  const applySource = (next) => {
    setSource(next)
    setSelectedItems({})
    setReturnQuantities({})
  }

  const loadDemoSource = (orderInvoiceId) => {
    setDemoOrderId(orderInvoiceId)
    const demoInvoice = demoOrders.find((entry) => entry.id === orderInvoiceId)
    if (!demoInvoice) {
      applySource(null)
      return
    }
    applySource({
      id: demoInvoice.id,
      invoiceNumber: demoInvoice.invoiceNumber,
      orderId: demoInvoice.orderId,
      orderNumber: demoInvoice.orderNumber,
      customerId: demoInvoice.customerId,
      customerName: demoInvoice.customerName,
      lines: demoInvoice.items.map((line) => ({
        invoiceItemId: line.invoiceItemId,
        productId: line.productId,
        variantId: line.variantId || '',
        productName: line.productName,
        sku: line.sku || '',
        invoicedQty: line.deliveredQty,
        alreadyReturned: line.alreadyReturned,
        returnableQty: line.returnableQty,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
      })),
    })
  }

  const handleFetchInvoice = async () => {
    const query = invoiceQuery.trim()
    if (!query) {
      setInvoiceError('Enter an invoice number or ID.')
      return
    }
    setIsFetchingInvoice(true)
    setInvoiceError('')
    applySource(null)

    try {
      const { data } = await apiClient.get(`/invoices/${encodeURIComponent(query)}`)
      const invoice = normalizeInvoice(data)
      if (!invoice || invoice.items.length === 0) {
        setInvoiceError('This invoice has no line items to return.')
        setIsFetchingInvoice(false)
        return
      }

      // §5 — subtract quantities already returned on this invoice so the same units can't go
      // back twice. Real API; on failure we fall back to the invoiced quantity as the cap.
      const history = await getInvoiceReturnedQuantities(invoice.id)
      const returnedByItem = history.returnedByItem || {}

      applySource({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        lines: invoice.items.map((line) => {
          const already = Number(returnedByItem[line.invoiceItemId]) || 0
          return {
            invoiceItemId: line.invoiceItemId,
            productId: line.productId,
            variantId: line.variantId || '',
            productName: line.productName,
            sku: line.sku || '',
            invoicedQty: line.quantity,
            alreadyReturned: already,
            returnableQty: Math.max(line.quantity - already, 0),
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
          }
        }),
      })
      setIsFetchingInvoice(false)
    } catch (error) {
      const errorData = error.response?.data
      setInvoiceError(
        (typeof errorData?.detail === 'string' && errorData.detail) ||
          errorData?.message ||
          'Unable to find that invoice. Check the number or ID and try again.',
      )
      setIsFetchingInvoice(false)
    }
  }

  // Auto-fetch when arriving with ?invoice=<id> (e.g. from Order Detail).
  useEffect(() => {
    const preset = searchParams.get('invoice')
    if (preset && !isDemo) handleFetchInvoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const returnableLines = useMemo(() => (source?.lines || []).filter((line) => line.returnableQty > 0), [source])
  const noReturnable = Boolean(source) && returnableLines.length === 0

  const toggleItem = (line) => {
    setSelectedItems((current) => ({ ...current, [line.invoiceItemId]: !current[line.invoiceItemId] }))
    setReturnQuantities((current) =>
      current[line.invoiceItemId] !== undefined
        ? current
        : { ...current, [line.invoiceItemId]: line.returnableQty },
    )
  }

  const updateQuantity = (line, value) => {
    const numeric = Number(value)
    const clamped = Number.isNaN(numeric) ? '' : Math.max(0, Math.min(Math.round(numeric), line.returnableQty))
    setReturnQuantities((current) => ({ ...current, [line.invoiceItemId]: clamped }))
  }

  const selectedRows = useMemo(
    () => returnableLines.filter((line) => selectedItems[line.invoiceItemId]),
    [returnableLines, selectedItems],
  )

  const creditEstimate = useMemo(
    () =>
      selectedRows.reduce((total, line) => {
        const quantity = Number(returnQuantities[line.invoiceItemId]) || 0
        return total + quantity * line.unitPrice
      }, 0),
    [selectedRows, returnQuantities],
  )

  const resolvedReason = reason === 'Other' ? otherReason.trim() || 'Other' : reason

  const validate = () => {
    if (!source) return isDemo ? 'Select a delivered order first.' : 'Fetch an invoice before raising a return.'
    if (noReturnable) return 'All delivered quantities on this order have already been returned.'
    if (!resolvedReason) return 'A return reason is required.'
    if (reason === 'Other' && !otherReason.trim()) return 'Add the details for an "Other" reason.'
    if (selectedRows.length === 0) return 'Select at least one item to return.'

    const badQty = selectedRows.some((line) => {
      const quantity = Number(returnQuantities[line.invoiceItemId])
      return !quantity || quantity <= 0 || quantity > line.returnableQty || !Number.isInteger(quantity)
    })
    if (badQty) return 'Each selected item needs a whole return quantity within what is still returnable.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setSubmitError(validationError)
      return
    }
    setIsSubmitting(true)
    setSubmitError('')

    const items = selectedRows.map((line) => ({
      invoiceItemId: line.invoiceItemId,
      productId: line.productId,
      variantId: line.variantId || undefined,
      productName: line.productName,
      sku: line.sku,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      quantityReturned: Number(returnQuantities[line.invoiceItemId]) || 0,
    }))

    if (isDemo) {
      const record = createDemoSalesReturn({
        invoiceReferenceId: source.id,
        invoiceNumber: source.invoiceNumber,
        orderId: source.orderId,
        orderNumber: source.orderNumber,
        customerId: source.customerId,
        customerName: source.customerName,
        returnReason: resolvedReason,
        returnType,
        returnDate,
        warehouseId: warehouseId || undefined,
        notes: notes.trim() || undefined,
        items,
      })
      navigate(`${basePath}/${encodeURIComponent(record.id)}`)
      return
    }

    const result = await createSalesReturn({
      invoiceReferenceId: source.id,
      returnReason: resolvedReason,
      returnType,
      returnDate,
      warehouseId: warehouseId || undefined,
      notes: notes.trim() || undefined,
      items,
    })

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }
    navigate(`${basePath}/${encodeURIComponent(result.salesReturn.id)}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">New Sales Return</h1>
          <p className="mt-1 text-xs text-neutral-400">
            {isDemo
              ? 'Pick a delivered order — its delivered lines become returnable.'
              : 'Raise a return request against an existing invoice. The customer is derived from it.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title={isDemo ? 'Order' : 'Invoice'} subtitle={isDemo ? 'Delivered orders with returnable quantity' : 'Look up the invoice this return is against'}>
          {isDemo ? (
            <Select
              label="Delivered Order"
              options={demoOrders.map((entry) => ({
                value: entry.id,
                label: `${entry.orderNumber} · ${entry.customerName}${entry.hasReturnable ? '' : ' (fully returned)'}`,
              }))}
              value={demoOrderId}
              onChange={(event) => loadDemoSource(event.target.value)}
              placeholder="Select an order"
            />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Invoice Number or ID"
                value={invoiceQuery}
                onChange={(event) => setInvoiceQuery(event.target.value)}
                placeholder="e.g. INV-2026-000123"
                className="sm:flex-1"
              />
              <Button type="button" variant="outline" loading={isFetchingInvoice} onClick={handleFetchInvoice}>
                <Search className="size-4" aria-hidden="true" />
                Fetch Invoice
              </Button>
            </div>
          )}
          {invoiceError && <p className="mt-3 text-xs text-red-600">{invoiceError}</p>}
          {source && (
            <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm">
              <p className="font-semibold text-neutral-900">
                {source.orderNumber ? `${source.orderNumber} · ` : ''}{source.invoiceNumber}
              </p>
              <p className="mt-0.5 text-neutral-500">{source.customerName || 'Customer on invoice'}</p>
            </div>
          )}
        </Card>

        {source && (
          <Card
            title="Return Items"
            subtitle="Only quantities still returnable (delivered − already returned) can be selected"
            className="p-0"
            bodyClassName="p-0"
          >
            {noReturnable ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-500">
                No returnable items on this order — every delivered quantity has already been returned.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-4xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="whitespace-nowrap px-5 py-3">Return</th>
                        <th className="whitespace-nowrap px-5 py-3">Product</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">{isDemo ? 'Delivered' : 'Invoiced'}</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">Already Returned</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">Returnable</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">Return Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {returnableLines.map((line) => {
                        const isSelected = Boolean(selectedItems[line.invoiceItemId])
                        return (
                          <tr key={line.invoiceItemId} className="transition-colors hover:bg-primary-50/35">
                            <td className="px-5 py-3.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(line)}
                                className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-neutral-800">{line.productName}</p>
                              {line.sku && <p className="mt-0.5 text-xs text-neutral-400">{line.sku}</p>}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{line.invoicedQty}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{line.alreadyReturned}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{line.returnableQty}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(line.unitPrice)}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                              <input
                                type="number"
                                min="0"
                                max={line.returnableQty}
                                step="1"
                                disabled={!isSelected}
                                value={returnQuantities[line.invoiceItemId] ?? ''}
                                onChange={(event) => updateQuantity(line, event.target.value)}
                                className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-neutral-100 px-4 py-4">
                  <div className="rounded-xl bg-primary-50 px-4 py-3 text-right">
                    <p className="text-xs font-medium text-primary-700">Estimated Credit</p>
                    <p className="mt-1 text-xl font-semibold text-primary-900">{formatCurrency(creditEstimate)}</p>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        <Card title="Return Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Return Reason" required options={reasonOptions} value={reason} onChange={(event) => setReason(event.target.value)} />
            <Select label="Return Type" options={returnTypeOptions} value={returnType} onChange={(event) => setReturnType(event.target.value)} />
            {reason === 'Other' && (
              <Input
                label="Reason Details"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="Describe the reason"
                maxLength={100}
                className="sm:col-span-2"
              />
            )}
            <Input label="Return Date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
            {!isDemo && (
              <Select
                label="Receiving Warehouse"
                options={warehouseOptions}
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder="Use firm default warehouse"
              />
            )}
            <Input
              as="textarea"
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Internal remarks"
              className="sm:col-span-2"
            />
          </div>
        </Card>

        {submitError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(basePath)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={noReturnable}>
            <PackageSearch className="size-4" aria-hidden="true" />
            Raise Return
          </Button>
        </div>
      </form>
    </div>
  )
}
