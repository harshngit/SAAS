import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import { createPurchase, PURCHASE_TYPE_OPTIONS, updatePurchase } from '../../api/purchases'
import { listProducts } from '../../api/products'
import { listSuppliers } from '../../api/suppliers'
import { listWarehouses } from '../../api/warehouses'
import { formatCurrency } from '../../utils/format'

function emptyItem() {
  return { productId: '', quantity: 1, purchasePrice: '', discount: 0, tax: 0 }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyFormState() {
  return {
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: todayIso(),
    purchaseType: 'Direct Purchase',
    warehouseId: '',
    notes: '',
    discount: '0',
    items: [emptyItem()],
  }
}

export default function PurchaseInvoiceForm({ isOpen, onClose, invoice, onSaved }) {
  const isEditing = Boolean(invoice)

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  const [formState, setFormState] = useState(emptyFormState)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setSubmitError('')
    setFormState(
      invoice
        ? {
            supplierId: invoice.supplierId || '',
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: invoice.invoiceDate ? String(invoice.invoiceDate).slice(0, 10) : todayIso(),
            purchaseType: invoice.purchaseType || 'Direct Purchase',
            warehouseId: invoice.warehouseId || '',
            notes: invoice.notes || '',
            discount: String(invoice.discount ?? 0),
            items:
              invoice.items?.length > 0
                ? invoice.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    purchasePrice: item.purchasePrice,
                    discount: item.discount,
                    tax: item.tax,
                  }))
                : [emptyItem()],
          }
        : emptyFormState(),
    )

    setIsLoadingOptions(true)
    Promise.all([listSuppliers(), listProducts(), listWarehouses()]).then(([suppliersResult, productsResult, warehousesResult]) => {
      if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
      if (productsResult.success) setProducts(productsResult.products)
      if (warehousesResult.success) setWarehouses(warehousesResult.warehouses)
      setIsLoadingOptions(false)
    })
  }, [isOpen, invoice])

  const supplierOptions = useMemo(() => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })), [suppliers])
  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: product.name })), [products])
  const warehouseOptions = useMemo(() => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })), [warehouses])

  const lineItems = useMemo(
    () =>
      formState.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)
        const quantity = Number(item.quantity) || 0
        const purchasePrice = Number(item.purchasePrice) || 0
        const lineSubtotal = purchasePrice * quantity
        const discountAmount = (lineSubtotal * (Number(item.discount) || 0)) / 100
        const taxable = lineSubtotal - discountAmount
        const taxAmount = taxable * ((Number(item.tax) || 0) / 100)
        return { ...item, product, quantity, purchasePrice, discountAmount, taxAmount, amount: taxable + taxAmount }
      }),
    [formState.items, products],
  )

  const subtotal = lineItems.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0)
  const itemDiscountTotal = lineItems.reduce((sum, item) => sum + item.discountAmount, 0)
  const taxTotal = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const extraDiscount = Number(formState.discount) || 0
  const grandTotal = Math.max(0, subtotal - itemDiscountTotal - extraDiscount + taxTotal)

  const updateField = (field, value) => setFormState((current) => ({ ...current, [field]: value }))

  const updateItem = (index, field, value) => {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: value }

        if (field === 'productId') {
          const product = products.find((p) => p.id === value)
          if (product) {
            nextItem.purchasePrice = product.price ?? ''
            nextItem.tax = product.tax_rate ?? nextItem.tax
          }
        }

        return nextItem
      }),
    }))
  }

  const addItem = () => setFormState((current) => ({ ...current, items: [...current.items, emptyItem()] }))
  const removeItem = (index) =>
    setFormState((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, i) => i !== index),
    }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formState.supplierId) {
      setSubmitError('Select a supplier.')
      return
    }
    if (!formState.invoiceNumber.trim()) {
      setSubmitError('Enter an invoice number.')
      return
    }
    const validItems = formState.items.filter((item) => item.productId)
    if (validItems.length === 0) {
      setSubmitError('Add at least one item before saving.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    const payload = {
      supplierId: formState.supplierId,
      invoiceNumber: formState.invoiceNumber.trim(),
      invoiceDate: formState.invoiceDate,
      purchaseType: formState.purchaseType,
      warehouseId: formState.warehouseId || undefined,
      notes: formState.notes.trim() || undefined,
      discount: extraDiscount,
      items: validItems,
    }

    const result = isEditing ? await updatePurchase(invoice.id, payload) : await createPurchase(payload)

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    onSaved?.(result.purchase)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={isEditing ? 'Edit Purchase Invoice' : 'Add Purchase Invoice'}
      className="w-full max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {submitError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Supplier"
            required
            options={supplierOptions}
            value={formState.supplierId}
            onChange={(event) => updateField('supplierId', event.target.value)}
            placeholder={isLoadingOptions ? 'Loading...' : 'Select supplier'}
            disabled={isLoadingOptions}
          />
          <Input
            label="Invoice Number"
            required
            value={formState.invoiceNumber}
            onChange={(event) => updateField('invoiceNumber', event.target.value)}
          />
          <Input
            label="Invoice Date"
            type="date"
            required
            value={formState.invoiceDate}
            onChange={(event) => updateField('invoiceDate', event.target.value)}
          />
          <Select
            label="Purchase Type"
            options={PURCHASE_TYPE_OPTIONS}
            value={formState.purchaseType}
            onChange={(event) => updateField('purchaseType', event.target.value)}
          />
          <Select
            label="Warehouse"
            options={warehouseOptions}
            value={formState.warehouseId}
            onChange={(event) => updateField('warehouseId', event.target.value)}
            placeholder={isLoadingOptions ? 'Loading...' : 'Use firm default warehouse'}
            disabled={isLoadingOptions}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Items</p>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus className="size-4" />
              Add Item
            </Button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Qty</th>
                  <th className="px-3 py-2.5">Purchase Price</th>
                  <th className="px-3 py-2.5">Discount %</th>
                  <th className="px-3 py-2.5">Tax %</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="w-9 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2.5">
                      <Select
                        options={productOptions}
                        value={item.productId}
                        onChange={(event) => updateItem(index, 'productId', event.target.value)}
                        placeholder={isLoadingOptions ? 'Loading...' : 'Select product'}
                        triggerClassName="min-w-48"
                        disabled={isLoadingOptions}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                        className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.purchasePrice}
                        onChange={(event) => updateItem(index, 'purchasePrice', event.target.value)}
                        className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount}
                        onChange={(event) => updateItem(index, 'discount', event.target.value)}
                        className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.tax}
                        onChange={(event) => updateItem(index, 'tax', event.target.value)}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Extra Discount (₹)"
            type="number"
            min="0"
            step="0.01"
            value={formState.discount}
            onChange={(event) => updateField('discount', event.target.value)}
          />
          <Input as="textarea" label="Notes" value={formState.notes} onChange={(event) => updateField('notes', event.target.value)} />
        </div>

        <div className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-medium text-neutral-800">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Item Discount</span>
            <span className="font-medium text-red-500">- {formatCurrency(itemDiscountTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Extra Discount</span>
            <span className="font-medium text-red-500">- {formatCurrency(extraDiscount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Tax</span>
            <span className="font-medium text-neutral-800">{formatCurrency(taxTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 pt-2 text-base">
            <span className="font-semibold text-neutral-900">Grand Total</span>
            <span className="font-semibold text-primary-700">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEditing ? 'Update' : 'Add'} Invoice</Button>
        </div>
      </form>
    </Modal>
  )
}
