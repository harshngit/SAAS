import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Info, Plus, Save, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { createPurchase, getPurchase, updatePurchase } from '../../api/purchases'
import { listProducts } from '../../api/products'
import { listSuppliers, getSupplier } from '../../api/suppliers'
import { listWarehouses } from '../../api/warehouses'
import { normalizeApiSupplier } from '../suppliers/supplierUtils'
import { getSupplierProducts } from '../suppliers/supplierProductUtils'
import { normalizeApiProduct } from '../products/productUtils'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { demoProducts as demoSupplierProducts, demoSuppliers, getDemoSupplier } from '../suppliers/supplierDemoData'
import { formatCurrency } from '../../utils/format'
import { computeFinancialYear, PURCHASE_TYPE_OPTIONS } from './purchaseHelpers'
import { createDemoPurchase, getDemoPurchase, isDemoPurchase, patchDemoPurchase } from './purchaseDemoData'

const demoModeOn = DEMO_MODE && !DEMO_EMPTY

function emptyItem() {
  return { productId: '', quantity: 1, purchasePrice: '', discount: 0, tax: 0 }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyFormState() {
  return {
    supplierId: '',
    purchaseType: 'Direct Purchase',
    purchaseDate: todayIso(),
    invoiceNumber: '',
    warehouseId: '',
    notes: '',
    discount: '0',
    items: [emptyItem()],
  }
}

// A compact read-only row used for both the Supplier Snapshot card and the "locked at creation"
// fields shown while editing (the backend's update endpoint does not accept changes to them -
// see PURCHASE_EDITABLE_ON_UPDATE in purchaseHelpers.js).
function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value || '—'}</p>
    </div>
  )
}

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/purchases' : '/admin/purchases'
  const isDemo = isEditing && isDemoPurchase(id)

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [supplierSnapshot, setSupplierSnapshot] = useState(null)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)

  const [formState, setFormState] = useState(emptyFormState)
  const [existingPurchase, setExistingPurchase] = useState(null)
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load supplier / product / warehouse pick-lists once.
  useEffect(() => {
    setIsLoadingOptions(true)
    if (demoModeOn) {
      setSuppliers(demoSuppliers)
      setProducts(demoSupplierProducts)
      setWarehouses([{ id: 'demo-wh-main', name: 'Main Warehouse' }, { id: 'demo-wh-central', name: 'Central Warehouse' }])
      setIsLoadingOptions(false)
      return
    }
    Promise.all([listSuppliers(), listProducts(), listWarehouses()]).then(([suppliersResult, productsResult, warehousesResult]) => {
      if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
      if (productsResult.success) setProducts(productsResult.products.map((product) => normalizeApiProduct(product)))
      if (warehousesResult.success) setWarehouses(warehousesResult.warehouses)
      setIsLoadingOptions(false)
    })
  }, [])

  // Load the existing purchase when editing.
  useEffect(() => {
    if (!isEditing) return

    async function load() {
      setIsLoadingPurchase(true)
      setLoadError('')

      if (isDemo) {
        const purchase = getDemoPurchase(id)
        if (!purchase) {
          setLoadError('Demo purchase not found.')
          setIsLoadingPurchase(false)
          return
        }
        setExistingPurchase(purchase)
        setFormState({
          supplierId: purchase.supplierId || '',
          purchaseType: purchase.purchaseType || 'Direct Purchase',
          purchaseDate: purchase.purchaseDate ? String(purchase.purchaseDate).slice(0, 10) : todayIso(),
          invoiceNumber: purchase.invoiceNumber || '',
          warehouseId: purchase.warehouseId || '',
          notes: purchase.notes || '',
          discount: String(purchase.discount ?? 0),
          items: purchase.items?.length ? purchase.items.map((item) => ({ ...item })) : [emptyItem()],
        })
        setIsLoadingPurchase(false)
        return
      }

      const result = await getPurchase(id)
      if (!result.success) {
        setLoadError(result.error)
        setIsLoadingPurchase(false)
        return
      }
      const purchase = result.purchase
      setExistingPurchase(purchase)
      setFormState({
        supplierId: purchase.supplierId || '',
        purchaseType: purchase.purchaseType || 'Direct Purchase',
        purchaseDate: (purchase.purchaseDate || purchase.invoiceDate) ? String(purchase.purchaseDate || purchase.invoiceDate).slice(0, 10) : todayIso(),
        invoiceNumber: purchase.invoiceNumber || '',
        warehouseId: purchase.warehouseId || '',
        notes: purchase.notes || '',
        discount: String(purchase.discount ?? 0),
        items: purchase.items?.length
          ? purchase.items.map((item) => ({ productId: item.productId, quantity: item.quantity, purchasePrice: item.purchasePrice, discount: item.discount, tax: item.tax }))
          : [emptyItem()],
      })
      setIsLoadingPurchase(false)
    }

    load()
  }, [isEditing, id, isDemo])

  // Supplier snapshot - fetched fresh whenever the selected supplier changes, never re-typed by
  // the user. Missing fields show "-" rather than being invented.
  useEffect(() => {
    if (!formState.supplierId) {
      setSupplierSnapshot(null)
      return
    }

    if (formState.supplierId.startsWith('demo-supplier-')) {
      setSupplierSnapshot(getDemoSupplier(formState.supplierId))
      return
    }

    let cancelled = false
    setIsLoadingSnapshot(true)
    getSupplier(formState.supplierId).then((result) => {
      if (cancelled) return
      setSupplierSnapshot(result.success ? normalizeApiSupplier(result.supplier) : null)
      setIsLoadingSnapshot(false)
    })
    return () => { cancelled = true }
  }, [formState.supplierId])

  const supplierOptions = useMemo(() => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })), [suppliers])
  const warehouseOptions = useMemo(() => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })), [warehouses])

  // Products linked to the selected supplier (Product.preferred_supplier_id - the current
  // interim mechanism, see supplierProductUtils.js) are surfaced first in every item row.
  const linkedProductIds = useMemo(() => {
    if (!supplierSnapshot) return new Set()
    return new Set(getSupplierProducts(supplierSnapshot, products, { demoMode: demoModeOn }).map((product) => product.id))
  }, [supplierSnapshot, products])

  const productOptions = useMemo(() => {
    const linked = []
    const rest = []
    products.forEach((product) => {
      const option = { value: product.id, label: linkedProductIds.has(product.id) ? `${product.name} (Linked)` : product.name }
      ;(linkedProductIds.has(product.id) ? linked : rest).push(option)
    })
    return [...linked, ...rest]
  }, [products, linkedProductIds])

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
  const financialYear = computeFinancialYear(formState.purchaseDate)

  const updateField = (field, value) => setFormState((current) => ({ ...current, [field]: value }))

  const roundItemFieldOnBlur = (index, field, { min = 0, max } = {}) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    const safe = Number.isFinite(rounded) ? rounded : min
    const clamped = max !== undefined ? Math.min(Math.max(safe, min), max) : Math.max(safe, min)
    updateItem(index, field, String(clamped))
  }

  const updateItem = (index, field, value) => {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: value }
        if (field === 'productId') {
          const product = products.find((p) => p.id === value)
          if (product) {
            nextItem.purchasePrice = product.variants?.[0]?.purchasePrice || product.purchasePrice || ''
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

    if (!formState.supplierId) return setSubmitError('Select a supplier.')
    if (!formState.purchaseType) return setSubmitError('Select a purchase type.')
    if (!formState.purchaseDate) return setSubmitError('Select a purchase date.')
    if (!formState.invoiceNumber.trim()) return setSubmitError('Enter the supplier reference / invoice number.')
    if (!isEditing && !formState.warehouseId) return setSubmitError('Select a warehouse.')
    const validItems = formState.items.filter((item) => item.productId && Number(item.quantity) > 0)
    if (validItems.length === 0) return setSubmitError('Add at least one item before saving.')
    if (validItems.some((item) => Number(item.purchasePrice) < 0 || Number(item.discount) < 0 || Number(item.tax) < 0)) {
      return setSubmitError('Purchase price, discount and tax cannot be negative.')
    }

    setIsSubmitting(true)
    setSubmitError('')

    const supplierName = suppliers.find((supplier) => supplier.id === formState.supplierId)?.name || supplierSnapshot?.name || ''
    const warehouseName = warehouses.find((warehouse) => warehouse.id === formState.warehouseId)?.name || existingPurchase?.warehouseName || ''

    if (isDemo || (demoModeOn && !isEditing)) {
      const items = validItems.map((item, index) => {
        const quantity = Number(item.quantity) || 0
        const purchasePrice = Number(item.purchasePrice) || 0
        const discount = Number(item.discount) || 0
        const tax = Number(item.tax) || 0
        const net = quantity * purchasePrice * (1 - discount / 100)
        return {
          id: `i${index + 1}`,
          productId: item.productId,
          productName: products.find((product) => product.id === item.productId)?.name || 'Item',
          sku: products.find((product) => product.id === item.productId)?.sku || '',
          quantity,
          purchasePrice,
          discount,
          tax,
          lineTotal: net + net * (tax / 100),
        }
      })
      const total = Math.max(0, items.reduce((sum, item) => sum + item.lineTotal, 0) - extraDiscount)
      const patch = {
        supplierId: formState.supplierId,
        supplierName,
        purchaseType: formState.purchaseType,
        purchaseDate: formState.purchaseDate,
        invoiceDate: formState.purchaseDate,
        financialYear,
        invoiceNumber: formState.invoiceNumber.trim(),
        warehouseId: formState.warehouseId,
        warehouseName,
        notes: formState.notes.trim(),
        discount: extraDiscount,
        subtotal,
        total,
        items,
      }
      const saved = isEditing ? (patchDemoPurchase(id, patch), { ...existingPurchase, ...patch, id }) : createDemoPurchase(patch)
      setIsSubmitting(false)
      navigate(`${basePath}/${saved.id}`)
      return
    }

    const payload = {
      invoiceNumber: formState.invoiceNumber.trim(),
      invoiceDate: formState.purchaseDate,
      discount: extraDiscount,
      notes: formState.notes.trim() || undefined,
      items: validItems,
    }
    if (!isEditing) {
      payload.supplierId = formState.supplierId
      payload.purchaseType = formState.purchaseType
      payload.purchaseDate = formState.purchaseDate
      payload.financialYear = financialYear
      payload.warehouseId = formState.warehouseId
    }

    const result = isEditing ? await updatePurchase(id, payload) : await createPurchase(payload)

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate(`${basePath}/${result.purchase.id}`)
  }

  if (isLoadingPurchase) {
    return <LoadingSpinner label="Loading purchase..." />
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white py-16 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(basePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Purchases
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate(basePath)} className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-primary-700">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Purchases
          </button>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{isEditing ? 'Edit Purchase' : 'Create Purchase'}</h1>
          <p className="mt-1 text-sm text-neutral-500">Record what you are buying from a supplier and what it costs.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        {isEditing && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            <p>Supplier, Purchase Type, Purchase Date, Warehouse and Financial Year are set at creation and can&apos;t be changed here yet. Reference number, notes, discount and items can still be updated.</p>
          </div>
        )}

        <Card title="Purchase Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isEditing ? (
              <ReadOnlyField label="Supplier" value={supplierSnapshot?.name || existingPurchase?.supplierName} />
            ) : (
              <Select
                label="Supplier"
                required
                options={supplierOptions}
                value={formState.supplierId}
                onChange={(event) => updateField('supplierId', event.target.value)}
                placeholder={isLoadingOptions ? 'Loading...' : 'Select supplier'}
                disabled={isLoadingOptions}
                searchable
              />
            )}
            {isEditing ? (
              <ReadOnlyField label="Purchase Type" value={formState.purchaseType} />
            ) : (
              <Select label="Purchase Type" required options={PURCHASE_TYPE_OPTIONS} value={formState.purchaseType} onChange={(event) => updateField('purchaseType', event.target.value)} />
            )}
            {isEditing ? (
              <ReadOnlyField label="Purchase Date" value={new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(formState.purchaseDate))} />
            ) : (
              <Input label="Purchase Date" type="date" required value={formState.purchaseDate} onChange={(event) => updateField('purchaseDate', event.target.value)} />
            )}
            <Input
              label="Supplier Reference / Invoice Number"
              required
              value={formState.invoiceNumber}
              onChange={(event) => updateField('invoiceNumber', event.target.value)}
              placeholder="Supplier's own invoice / reference number"
            />
            {isEditing ? (
              <ReadOnlyField label="Warehouse" value={existingPurchase?.warehouseName || warehouseOptions.find((w) => w.value === formState.warehouseId)?.label} />
            ) : (
              <Select
                label="Warehouse"
                required
                options={warehouseOptions}
                value={formState.warehouseId}
                onChange={(event) => updateField('warehouseId', event.target.value)}
                placeholder={isLoadingOptions ? 'Loading...' : 'Select warehouse'}
                disabled={isLoadingOptions}
              />
            )}
            <ReadOnlyField label="Financial Year" value={financialYear} />
          </div>
          <div className="mt-4">
            <Input as="textarea" label="Notes" value={formState.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </div>
        </Card>

        {formState.supplierId && (
          <Card title="Supplier Snapshot" subtitle="Read-only - pulled from the supplier's master record.">
            {isLoadingSnapshot ? (
              <LoadingSpinner label="Loading supplier details..." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ReadOnlyField label="Contact Person" value={supplierSnapshot?.contactPerson} />
                <ReadOnlyField label="Phone" value={supplierSnapshot?.phone} />
                <ReadOnlyField label="Email" value={supplierSnapshot?.email} />
                <ReadOnlyField label="GSTIN" value={supplierSnapshot?.gstNumber} />
                <ReadOnlyField label="Address" value={supplierSnapshot?.address} />
                <ReadOnlyField label="Payment Terms" value={supplierSnapshot?.paymentTerms} />
                <ReadOnlyField label="Purchase Currency" value={supplierSnapshot?.purchaseCurrency} />
              </div>
            )}
          </Card>
        )}

        <Card title="Items">
          {formState.supplierId && (
            <p className="mb-3 text-xs text-neutral-500">Products linked to this supplier are shown first.</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">UOM</th>
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
                        triggerClassName="min-w-52"
                        disabled={isLoadingOptions}
                        searchable
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-neutral-500">{item.product?.sku || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-neutral-500">{item.product?.unitOfMeasure || '—'}</td>
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
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addItem}>
            <Plus className="size-4" />
            Add Item
          </Button>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Additional Charges" subtitle="Coming soon - not yet part of the saved total.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {['Freight', 'Packing', 'Insurance', 'Other Charges'].map((label) => (
                <Input key={label} label={label} value="" disabled placeholder="Not available yet" />
              ))}
              <Input label="Round Off" value="" disabled placeholder="Not available yet" />
              <Input
                label="Extra Discount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={formState.discount}
                onChange={(event) => updateField('discount', event.target.value)}
              />
            </div>
          </Card>

          <Card title="Totals">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium text-neutral-800">{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Item Discount</span><span className="font-medium text-red-500">- {formatCurrency(itemDiscountTotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Extra Discount</span><span className="font-medium text-red-500">- {formatCurrency(extraDiscount)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Tax</span><span className="font-medium text-neutral-800">{formatCurrency(taxTotal)}</span></div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5 text-base">
                <span className="font-semibold text-neutral-900">Grand Total</span>
                <span className="font-semibold text-primary-700">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => navigate(basePath)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" aria-hidden="true" />
            {isEditing ? 'Save Changes' : 'Create Purchase'}
          </Button>
        </div>
      </form>
    </div>
  )
}
