import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageSearch, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { apiClient } from '../../api/client'
import { createSalesReturn } from '../../api/salesReturns'
import { listWarehouses } from '../../api/warehouses'
import { formatCurrency } from '../../utils/format'

const basePath = '/admin/sales-returns'
const today = new Date().toISOString().slice(0, 10)

const returnTypeOptions = ['Credit Note', 'Replacement', 'Refund'].map((value) => ({ value, label: value }))

// The exact InvoiceItemOut shape isn't documented here, so every field is read defensively
// with several possible key names rather than assuming one canonical backend response.
function normalizeInvoiceItem(item) {
  const invoiceItemId = item.id || item.invoice_item_id || item.item_id || ''
  const productId = item.product_id || item.productId || item.product?.id || ''
  const variantId = item.variant_id || item.variantId || ''
  const productName = item.product_name || item.productName || item.product?.name || item.name || item.description || 'Item'
  const sku = item.sku || item.product_sku || item.product?.sku || ''
  const quantity = Number(item.quantity ?? item.quantity_ordered ?? item.qty ?? item.quantity_invoiced ?? 0) || 0
  const unitPrice = Number(item.unit_price ?? item.price ?? item.unitPrice ?? 0) || 0

  return { invoiceItemId, productId, variantId, productName, sku, quantity, unitPrice }
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

  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')
  const [invoice, setInvoice] = useState(null)

  const [selectedItems, setSelectedItems] = useState({})
  const [returnQuantities, setReturnQuantities] = useState({})

  const [returnReason, setReturnReason] = useState('')
  const [returnType, setReturnType] = useState('Credit Note')
  const [returnDate, setReturnDate] = useState(today)
  const [returnNumber, setReturnNumber] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [notes, setNotes] = useState('')

  const [warehouses, setWarehouses] = useState([])
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true)

  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadWarehouses() {
      const result = await listWarehouses()
      if (!isMounted) return

      if (result.success) {
        setWarehouses(result.warehouses)
        const defaultWarehouse = result.warehouses.find((warehouse) => warehouse.isDefault)
        setWarehouseId(defaultWarehouse?.id || result.warehouses[0]?.id || '')
      }
      setIsLoadingWarehouses(false)
    }

    loadWarehouses()
    return () => {
      isMounted = false
    }
  }, [])

  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    [warehouses],
  )

  const handleFetchInvoice = async () => {
    const query = invoiceQuery.trim()
    if (!query) {
      setInvoiceError('Enter an invoice number or ID.')
      return
    }

    setIsFetchingInvoice(true)
    setInvoiceError('')
    setInvoice(null)
    setSelectedItems({})
    setReturnQuantities({})

    try {
      const { data } = await apiClient.get(`/invoices/${encodeURIComponent(query)}`)
      const normalized = normalizeInvoice(data)

      if (!normalized || normalized.items.length === 0) {
        setInvoiceError('This invoice has no line items to return.')
        setIsFetchingInvoice(false)
        return
      }

      setInvoice(normalized)
      setIsFetchingInvoice(false)
    } catch (error) {
      const errorData = error.response?.data
      const message =
        (typeof errorData?.detail === 'string' && errorData.detail) ||
        errorData?.message ||
        'Unable to find that invoice. Check the number or ID and try again.'
      setInvoiceError(message)
      setIsFetchingInvoice(false)
    }
  }

  const toggleItem = (invoiceItemId, item) => {
    setSelectedItems((current) => {
      const next = { ...current, [invoiceItemId]: !current[invoiceItemId] }
      return next
    })
    setReturnQuantities((current) => {
      if (current[invoiceItemId] !== undefined) return current
      return { ...current, [invoiceItemId]: item.quantity }
    })
  }

  const updateQuantity = (invoiceItemId, value, maxQuantity) => {
    const numeric = Number(value)
    const clamped = Number.isNaN(numeric) ? '' : Math.max(0, Math.min(numeric, maxQuantity))
    setReturnQuantities((current) => ({ ...current, [invoiceItemId]: clamped }))
  }

  const selectedRows = useMemo(() => {
    if (!invoice) return []
    return invoice.items.filter((item) => selectedItems[item.invoiceItemId])
  }, [invoice, selectedItems])

  const creditEstimate = useMemo(
    () =>
      selectedRows.reduce((total, item) => {
        const quantity = Number(returnQuantities[item.invoiceItemId]) || 0
        return total + quantity * item.unitPrice
      }, 0),
    [selectedRows, returnQuantities],
  )

  const validate = () => {
    if (!invoice) return 'Fetch an invoice before raising a return.'
    if (!returnReason.trim()) return 'Return reason is required.'
    if (returnReason.trim().length > 100) return 'Return reason must be 100 characters or fewer.'
    if (selectedRows.length === 0) return 'Select at least one item to return.'

    const hasInvalidQuantity = selectedRows.some((item) => {
      const quantity = Number(returnQuantities[item.invoiceItemId])
      return !quantity || quantity <= 0 || quantity > item.quantity
    })
    if (hasInvalidQuantity) return 'Each selected item needs a valid return quantity within what was invoiced.'

    const hasFractionalQuantity = selectedRows.some((item) => !Number.isInteger(Number(returnQuantities[item.invoiceItemId])))
    if (hasFractionalQuantity) return 'Return quantity must be a whole number.'

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

    const payload = {
      invoiceReferenceId: invoice.id,
      returnReason: returnReason.trim(),
      returnType,
      returnDate,
      warehouseId: warehouseId || undefined,
      notes: notes.trim() || undefined,
      items: selectedRows.map((item) => ({
        invoiceItemId: item.invoiceItemId,
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantityReturned: Number(returnQuantities[item.invoiceItemId]) || 0,
      })),
    }
    if (returnNumber.trim()) payload.returnNumber = returnNumber.trim()

    const result = await createSalesReturn(payload)

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
          <p className="mt-1 text-xs text-neutral-400">Raise a return request against an existing invoice.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="Invoice" subtitle="Look up the invoice this return is against">
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
          {invoiceError && <p className="mt-3 text-xs text-red-600">{invoiceError}</p>}
          {invoice && (
            <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm">
              <p className="font-semibold text-neutral-900">{invoice.invoiceNumber}</p>
              <p className="mt-0.5 text-neutral-500">{invoice.customerName || 'Customer on invoice'}</p>
            </div>
          )}
        </Card>

        {invoice && (
          <Card title="Return Items" subtitle="Select the invoiced items being returned and the quantity for each" className="p-0" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="whitespace-nowrap px-5 py-3">Return</th>
                    <th className="whitespace-nowrap px-5 py-3">Product</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Invoiced Qty</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {invoice.items.map((item) => {
                    const isSelected = Boolean(selectedItems[item.invoiceItemId])

                    return (
                      <tr key={item.invoiceItemId} className="transition-colors hover:bg-primary-50/35">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.invoiceItemId, item)}
                            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-neutral-800">{item.productName}</p>
                          {item.sku && <p className="mt-0.5 text-xs text-neutral-400">{item.sku}</p>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantity}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="1"
                            disabled={!isSelected}
                            value={returnQuantities[item.invoiceItemId] ?? ''}
                            onChange={(event) => updateQuantity(item.invoiceItemId, event.target.value, item.quantity)}
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
          </Card>
        )}

        <Card title="Return Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Return Reason"
              required
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Why is this being returned?"
              maxLength={100}
            />
            <Select
              label="Return Type"
              options={returnTypeOptions}
              value={returnType}
              onChange={(event) => setReturnType(event.target.value)}
            />
            <Input
              label="Return Date"
              type="date"
              value={returnDate}
              onChange={(event) => setReturnDate(event.target.value)}
            />
            <Input
              label="Return Number"
              value={returnNumber}
              onChange={(event) => setReturnNumber(event.target.value)}
              placeholder="Auto-generated if left blank"
            />
            <Select
              label="Warehouse"
              options={warehouseOptions}
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              placeholder={isLoadingWarehouses ? 'Loading...' : 'Use firm default warehouse'}
              disabled={isLoadingWarehouses}
            />
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
          <Button type="submit" loading={isSubmitting}>
            <PackageSearch className="size-4" aria-hidden="true" />
            Raise Return
          </Button>
        </div>
      </form>
    </div>
  )
}
