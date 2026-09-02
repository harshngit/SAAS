import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  FileCheck2,
  FileText,
  Info,
  Minus,
  Package,
  Plus,
  Search,
  Smartphone,
  Store,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES, roleHomePath } from '../../auth/roles'
import { listProducts } from '../../api/products'
import { listCustomers } from '../../api/customers'
import { listWarehouses } from '../../api/warehouses'
import { createOrder, assignDeliveryPartner, getOrder, updateOrder } from '../../api/orders'
import { getQuotation } from '../../api/quotations'
import { duplicateDemoOrder, getDemoOrder, isDemoOrder, patchDemoOrder } from './orderDemoData'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import QuickAddCustomerModal from '../customers/QuickAddCustomerModal'
import { useToast } from '../../components/ui/toastContext'

const paymentOptions = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'cod', label: 'COD', icon: Wallet },
  { value: 'credit', label: 'Credit', icon: Banknote },
]

const paymentTermsOptions = [
  { value: '7', label: 'Credit (7 Days)' },
  { value: '15', label: 'Credit (15 Days)' },
  { value: '30', label: 'Credit (30 Days)' },
  { value: '45', label: 'Credit (45 Days)' },
]

const deliveryOptions = [
  { value: 'pickup', label: 'Takeaway / Self Pickup', description: 'Customer will collect the order from our store.', icon: Store },
  { value: 'delivery_boy', label: 'Home Delivery', description: 'We will deliver the order to customer address.', icon: Truck },
]

const discountTypeOptions = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'amount', label: 'Amount (₹)' },
]

function formatGstPercent(value) {
  if (!value) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function SectionBadge({ number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
      {number}
    </span>
  )
}

export default function CreateSalesOrder({ restrictToVehicleStock = false }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [searchParams] = useSearchParams()
  const { id: editOrderId } = useParams()
  const isEditMode = Boolean(editOrderId)
  // Pre-selected customer when arriving from the Customer Detail page ("Create Order" button).
  const preselectedCustomerId = searchParams.get('customerId') || searchParams.get('customer_id') || ''
  // Order source: a quotation this order is being created from (read-only banner + createOrder link).
  const sourceQuotationId = searchParams.get('quotationId') || searchParams.get('quotation_id') || ''
  // Duplicate: prefill from an existing order but save a brand new draft.
  const duplicateFromId = searchParams.get('from') || ''

  const [sourceQuotation, setSourceQuotation] = useState(null)
  const [prefillNotice, setPrefillNotice] = useState('')

  const [availableProducts, setAvailableProducts] = useState([])
  const [customerRecords, setCustomerRecords] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  // Customer / Company
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false)

  // Order details
  const [orderDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10))
  const [warehouseId, setWarehouseId] = useState('')

  // Products
  const [orderItems, setOrderItems] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Discount
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState(0)

  // Payment / delivery
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('15')
  const [deliveryType, setDeliveryType] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [stockShortages, setStockShortages] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [productsResult, customersResult, warehousesResult] = await Promise.all([
        listProducts(),
        listCustomers(),
        listWarehouses(),
      ])

      if (!isMounted) return

      if (productsResult.success) setAvailableProducts(productsResult.products)
      if (customersResult.success) {
        setCustomerRecords(customersResult.customers)
        if (preselectedCustomerId && customersResult.customers.some((customer) => customer.id === preselectedCustomerId)) {
          setSelectedCustomerId(preselectedCustomerId)
        }
      }
      if (warehousesResult.success) {
        setWarehouses(warehousesResult.warehouses)
        const defaultWarehouse = warehousesResult.warehouses.find((warehouse) => warehouse.isDefault)
        setWarehouseId(defaultWarehouse?.id || warehousesResult.warehouses[0]?.id || '')
      }

      setIsLoadingOptions(false)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [preselectedCustomerId])

  useEffect(() => {
    if (!restrictToVehicleStock || !currentUser?.id) return
    setDeliveryType('delivery_boy')
  }, [restrictToVehicleStock, currentUser?.id])

  // Prefill from an edit target, a duplicate source order, or a source quotation.
  // Runs once options are loaded so product / customer ids resolve.
  useEffect(() => {
    if (isLoadingOptions) return
    if (!editOrderId && !duplicateFromId && !sourceQuotationId) return

    let isMounted = true

    const applyItems = (items) =>
      items.map((item) => {
        const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        const discountPercent =
          item.discountPercent != null
            ? Number(item.discountPercent) || 0
            : gross > 0 && item.discount
              ? Math.round((Number(item.discount) / gross) * 100)
              : 0
        return {
          productId: item.productId,
          unitPrice: Number(item.unitPrice) || 0,
          taxRate: Number(item.taxRate) || 0,
          quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
          discountPercent,
        }
      })

    const applyCommonPrefill = (src, { isDemo } = {}) => {
      // Demo orders carry synthetic product / customer / warehouse ids that aren't in the
      // real option lists - inject stand-ins so the real form renders the rows.
      if (isDemo) {
        setAvailableProducts((current) => {
          const have = new Set(current.map((p) => p.id))
          const extra = (src.items || [])
            .filter((it) => !have.has(it.productId))
            .map((it) => ({
              id: it.productId,
              name: it.productName,
              sku: 'DEMO',
              price: it.unitPrice,
              tax_rate: it.taxRate,
              sales_unit: it.uom,
              total_stock: it.availableStock ?? 999,
            }))
          return extra.length ? [...current, ...extra] : current
        })
        setCustomerRecords((current) =>
          current.some((c) => c.id === src.customerId)
            ? current
            : [{ id: src.customerId, name: src.customerName, billingAddress: src.billingAddress, shippingAddress: src.deliveryAddress }, ...current],
        )
        setWarehouses((current) =>
          current.some((w) => w.id === src.warehouseId)
            ? current
            : [...current, { id: src.warehouseId || 'demo-wh', name: src.warehouseName || 'Main Warehouse' }],
        )
      }
      setSelectedCustomerId(src.customerId || '')
      setOrderItems(applyItems(src.items))
      if (src.warehouseId) setWarehouseId(src.warehouseId)
      if (src.deliveryDate) setDeliveryDate(src.deliveryDate.slice(0, 10))
      setDeliveryAddress(src.deliveryAddress || '')
      setDeliveryType(src.fulfilmentMethod === 'pickup' ? 'pickup' : 'delivery_boy')
      if (src.paymentType) setPaymentMethod(src.paymentType)
      if (src.paymentTermsDays) setPaymentTerms(String(src.paymentTermsDays))
      setOrderNotes(duplicateFromId ? '' : src.notes || '')
      if (src.discount) {
        setDiscountType('amount')
        setDiscountValue(String(Math.round(Number(src.discount))))
      }
    }

    async function prefill() {
      const targetId = editOrderId || duplicateFromId

      if (targetId && isDemoOrder(targetId)) {
        const src = getDemoOrder(targetId)
        if (!isMounted) return
        if (!src) {
          setPrefillNotice('Demo order not found.')
          return
        }
        if (editOrderId && src.status !== 'placed') {
          navigate(window.location.pathname.replace(/\/edit$/, ''), { replace: true })
          return
        }
        // Duplicating a demo order -> make the local copy now and jump to its detail page.
        if (duplicateFromId && !editOrderId) {
          const newId = duplicateDemoOrder(src)
          navigate(`${window.location.pathname.replace(/\/create$/, '')}/${newId}`, { replace: true })
          return
        }
        applyCommonPrefill(src, { isDemo: true })
        setPrefillNotice(
          editOrderId
            ? `Editing ${src.orderNumber} — this is a demo order, changes stay local.`
            : `Duplicating ${src.orderNumber}. This will be saved as a new draft order.`,
        )
        return
      }

      if (editOrderId || duplicateFromId) {
        const result = await getOrder(editOrderId || duplicateFromId)
        if (!isMounted) return
        if (!result.success) {
          setPrefillNotice(result.error)
          return
        }
        const src = result.order
        if (editOrderId && src.status !== 'placed') {
          navigate(`${window.location.pathname.replace(/\/edit$/, '')}`, { replace: true })
          return
        }
        applyCommonPrefill(src)
        setPrefillNotice(
          editOrderId
            ? `Editing ${src.orderNumber}. Only draft orders can be edited.`
            : `Duplicating ${src.orderNumber}. This will be saved as a new draft order.`,
        )
        return
      }

      const result = await getQuotation(sourceQuotationId)
      if (!isMounted) return
      if (!result.success) {
        setPrefillNotice(result.error)
        return
      }
      const q = result.quotation
      setSourceQuotation(q)
      setSelectedCustomerId(q.customerId || '')
      setOrderItems(applyItems(q.items))
      setDeliveryAddress(q.shippingAddress || q.billingAddress || '')
      setOrderNotes(q.notes || '')
    }

    prefill()
    return () => {
      isMounted = false
    }
  }, [isLoadingOptions, editOrderId, duplicateFromId, sourceQuotationId, navigate])


  const selectedCustomer = useMemo(
    () => customerRecords.find((customer) => customer.id === selectedCustomerId) || null,
    [customerRecords, selectedCustomerId],
  )

  // Auto-fill the delivery address from the selected customer (editable, only when still blank).
  useEffect(() => {
    if (!selectedCustomer) return
    const addr =
      selectedCustomer.deliveryAddress ||
      selectedCustomer.shippingAddress ||
      selectedCustomer.shipping_address ||
      selectedCustomer.billingAddress ||
      selectedCustomer.billing_address ||
      ''
    setDeliveryAddress((current) => current || addr)
  }, [selectedCustomer])

  const customerOptions = useMemo(
    () =>
      customerRecords.map((customer) => ({
        value: customer.id,
        label: customer.name,
        // Lets the searchable Select match on phone / email / city too, not just the name.
        searchText: [customer.phone, customer.phone?.replace(/\D/g, ''), customer.email, customer.city]
          .filter(Boolean)
          .join(' '),
      })),
    [customerRecords],
  )

  const filteredPickerProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return availableProducts
    return availableProducts.filter(
      (product) =>
        product.name?.toLowerCase().includes(search) || product.sku?.toLowerCase().includes(search),
    )
  }, [availableProducts, productSearch])

  const handleCustomerCreated = (createdCustomer) => {
    setCustomerRecords((current) => [createdCustomer, ...current])
    setSelectedCustomerId(createdCustomer.id)
    setShowQuickAddCustomer(false)
    setErrors((current) => ({ ...current, customer: '' }))
  }

  const orderItemQuantity = (productId) => {
    const item = orderItems.find((entry) => entry.productId === productId)
    return item ? Number(item.quantity) || 0 : 0
  }

  // The product picker sets a quantity directly (Amazon-style stepper). 0 removes the line;
  // a first non-zero value creates it carrying the product's price / tax defaults.
  const setPickerQuantity = (product, nextQuantity) => {
    const quantity = Math.max(0, Math.floor(Number(nextQuantity) || 0))
    setOrderItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id)
      if (quantity === 0) return current.filter((item) => item.productId !== product.id)
      if (existingIndex >= 0) {
        return current.map((item, index) => (index === existingIndex ? { ...item, quantity } : item))
      }
      return [
        ...current,
        { productId: product.id, unitPrice: product.price || 0, taxRate: product.tax_rate || 0, quantity, discountPercent: 0 },
      ]
    })
    setErrors((current) => ({ ...current, items: '' }))
  }

  // Quantity, Unit Price, and the order-level Discount are all whole-number fields here (no
  // paise, no fractional %). There is no per-item discount field - only one order-level
  // discount in the summary; any item-level discount carried in from a quotation or a legacy
  // order is kept in state for the maths but is not editable. Rounding is applied on blur, not on
  // every keystroke - a controlled <input type="number"> jumps its cursor to the end after any
  // programmatic value change, so rounding while a "10." is still being typed turns the next
  // keystroke into "1007" instead of "10" (the decimal point silently vanishes and later digits
  // land in the wrong place). Blur-time rounding still guarantees nothing but a whole number is
  // ever kept in state past the point the field is submitted.
  const roundToWholeNumberOnBlur = (productId, field, { min = 0, max } = {}) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    const safe = Number.isFinite(rounded) ? rounded : min
    const clamped = max !== undefined ? Math.min(Math.max(safe, min), max) : Math.max(safe, min)
    updateOrderItem(productId, field, String(clamped))
  }

  const updateOrderItem = (productId, field, value) => {
    setOrderItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, [field]: value } : item)),
    )
    setErrors((current) => ({ ...current, items: '' }))
  }

  const removeOrderItem = (productId) => {
    setOrderItems((current) => current.filter((item) => item.productId !== productId))
  }

  const totals = useMemo(() => {
    const lines = orderItems.map((item) => {
      const product = availableProducts.find((p) => p.id === item.productId)
      const unitPrice = Number(item.unitPrice) || 0
      const quantity = Number(item.quantity) || 0
      const taxRate = Number(item.taxRate) || 0
      const discountPercent = Math.min(Math.max(Number(item.discountPercent) || 0, 0), 100)
      const grossLineSubtotal = unitPrice * quantity
      const lineSubtotal = grossLineSubtotal - grossLineSubtotal * (discountPercent / 100)
      return { product, unitPrice, quantity, taxRate, discountPercent, lineSubtotal }
    })

    const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0)
    const rawDiscount =
      discountType === 'percentage' ? subtotal * ((Number(discountValue) || 0) / 100) : Number(discountValue) || 0
    const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal)
    const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0

    const gstAmount = lines.reduce((sum, line) => sum + line.lineSubtotal * discountRatio * (line.taxRate / 100), 0)

    const taxableAmount = subtotal - discountAmount
    const effectiveGstPercent = taxableAmount > 0 ? (gstAmount / taxableAmount) * 100 : 0
    const total = taxableAmount + gstAmount
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)

    return { subtotal, discountAmount, gstAmount, effectiveGstPercent, total, totalQuantity }
  }, [orderItems, availableProducts, discountType, discountValue])

  // A delivery partner is NOT required at creation - it is assigned later via Plan Delivery.
  const canCreateOrder = restrictToVehicleStock || Boolean(deliveryType)

  const validateForm = () => {
    const nextErrors = {}

    if (!selectedCustomer) nextErrors.customer = 'Select an existing customer or quick add a new one.'
    if (!deliveryDate) nextErrors.deliveryDate = 'Delivery date is required.'
    if (orderItems.length === 0) nextErrors.items = 'Add at least one product to the order.'
    if (orderItems.some((item) => !Number(item.quantity) || Number(item.quantity) < 1)) {
      nextErrors.items = 'Keep every product quantity at least 1.'
    } else if (orderItems.some((item) => !Number.isInteger(Number(item.quantity)))) {
      nextErrors.items = 'Quantity must be a whole number.'
    }
    if (!paymentMethod) nextErrors.paymentMethod = 'Select a payment type.'
    if (!restrictToVehicleStock && !deliveryType) nextErrors.deliveryType = 'Select a delivery method.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitError('')
    setStockShortages(null)

    const combinedNotes =
      orderNotes.trim() || internalNotes.trim()
        ? `${orderNotes.trim()}${internalNotes.trim() ? `\n[Internal] ${internalNotes.trim()}` : ''}`
        : undefined
    const itemsPayload = orderItems.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0,
      discountPercent: Number(item.discountPercent) || 0,
    }))

    // Demo edit: patch local demo state only, never touch the backend.
    if (isEditMode && isDemoOrder(editOrderId)) {
      const items = orderItems.map((item, index) => {
        const product = availableProducts.find((p) => p.id === item.productId)
        const qty = Number(item.quantity) || 0
        const price = Number(item.unitPrice) || 0
        const discPct = Number(item.discountPercent) || 0
        const taxRate = Number(item.taxRate) || 0
        const net = qty * price * (1 - discPct / 100)
        return {
          id: `i${index + 1}`,
          productId: item.productId,
          variantId: '',
          productName: product?.name || 'Item',
          quantity: qty,
          orderedQuantity: qty,
          unitPrice: price,
          discount: 0,
          discountPercent: discPct,
          costPrice: null,
          uom: product?.sales_unit || 'unit',
          taxRate,
          reservedQuantity: qty,
          deliveredQuantity: 0,
          remainingQuantity: qty,
          availableStock: product?.total_stock ?? null,
          lineTotal: net + net * (taxRate / 100),
        }
      })
      const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
      const total = items.reduce((sum, it) => sum + it.lineTotal, 0)
      patchDemoOrder(editOrderId, {
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.name || '',
        warehouseId,
        warehouseName: warehouses.find((w) => w.id === warehouseId)?.name || '',
        deliveryDate,
        deliveryAddress: deliveryType === 'pickup' ? '' : deliveryAddress,
        fulfilmentMethod: deliveryType === 'pickup' ? 'pickup' : 'delivery',
        paymentType: paymentMethod,
        paymentTermsDays: paymentMethod === 'credit' ? Number(paymentTerms) : 0,
        notes: combinedNotes || '',
        discount: totals.discountAmount,
        items,
        subtotal,
        tax: total - subtotal > 0 ? total - subtotal : 0,
        total,
        updatedAt: new Date().toISOString(),
      })
      showToast({ title: 'Demo order updated', message: 'Your changes have been saved locally.' })
      setIsSubmitting(false)
      navigate(`${currentUser?.role === ROLES.ADMIN ? '/admin' : '/sales'}/orders/${editOrderId}`)
      return
    }

    if (isEditMode) {
      const updateResult = await updateOrder(editOrderId, {
        customerId: selectedCustomer.id,
        warehouseId,
        deliveryAddress: deliveryType === 'pickup' ? '' : deliveryAddress,
        discount: totals.discountAmount,
        notes: combinedNotes,
        items: itemsPayload,
      })

      if (!updateResult.success) {
        setSubmitError(updateResult.error)
        setStockShortages(updateResult.shortages || null)
        setIsSubmitting(false)
        return
      }

      showToast({ title: 'Order updated', message: `${updateResult.order.orderNumber} has been updated.` })
      setIsSubmitting(false)
      navigate(`${currentUser?.role === ROLES.ADMIN ? '/admin' : '/sales'}/orders/${editOrderId}`)
      return
    }

    const result = await createOrder({
      customerId: selectedCustomer.id,
      warehouseId,
      deliveryDate,
      quotationId: sourceQuotationId || undefined,
      fulfilmentMethod: restrictToVehicleStock ? 'delivery' : deliveryType === 'delivery_boy' ? 'delivery' : 'pickup',
      paymentType: paymentMethod,
      paymentTermsDays: paymentMethod === 'credit' ? Number(paymentTerms) : 0,
      discount: totals.discountAmount,
      source: restrictToVehicleStock ? 'delivery_vehicle' : sourceQuotationId ? 'quotation' : 'office',
      notes: combinedNotes,
      items: itemsPayload,
    })

    if (!result.success) {
      setSubmitError(result.error)
      setStockShortages(result.shortages || null)
      setIsSubmitting(false)
      return
    }

    // Vehicle-stock flow still self-assigns; the office flow assigns a partner later via Plan Delivery.
    if (restrictToVehicleStock && currentUser?.id) {
      await assignDeliveryPartner(result.order.id, currentUser.id)
    }

    showToast({
      title: 'Order created',
      message: `${result.order.orderNumber} has been created successfully.`,
    })
    setIsSubmitting(false)
    navigate(currentUser?.role === ROLES.ADMIN ? '/admin/orders' : roleHomePath[currentUser?.role] || '/')
  }

  const assignedDeliveryBoyName = restrictToVehicleStock ? currentUser?.name : null
  const outstandingBalance = Number(
    selectedCustomer?.outstandingBalance ?? selectedCustomer?.outstanding_balance ?? 0,
  )
  const customerDefaultAddress =
    selectedCustomer?.deliveryAddress ||
    selectedCustomer?.shippingAddress ||
    selectedCustomer?.shipping_address ||
    selectedCustomer?.billingAddress ||
    selectedCustomer?.billing_address ||
    ''

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{isEditMode ? 'Edit Order' : 'Create Order'}</h1>
        <p className="text-sm text-neutral-500">
          {isEditMode ? 'Update this draft order and save your changes.' : 'Add order details and confirm to create a new order.'}
        </p>
      </div>

      {prefillNotice && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {prefillNotice}
        </div>
      )}

      {sourceQuotation && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-800">
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          Source: Quotation · {sourceQuotation.quotationNumber} — customer and items have been prefilled.
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          {submitError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{stockShortages ? 'Not enough stock to place this order:' : submitError}</p>
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

          {/* Customer + Order Details */}
          <div className="grid grid-cols-1 divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card) lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <SectionBadge number={1} />
                <h3 className="text-base font-semibold text-neutral-900">Customer</h3>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={!showQuickAddCustomer}
                    onChange={() => setShowQuickAddCustomer(false)}
                    className="size-4 text-primary-600 focus:ring-primary-500"
                  />
                  Select Existing Customer
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={showQuickAddCustomer}
                    onChange={() => setShowQuickAddCustomer(true)}
                    className="size-4 text-primary-600 focus:ring-primary-500"
                  />
                  Quick Add Customer
                </label>
              </div>

              <div className="space-y-2">
                <Select
                  searchable
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value)
                    setErrors((current) => ({ ...current, customer: '' }))
                  }}
                  placeholder={
                    isLoadingOptions
                      ? 'Loading customers...'
                      : customerOptions.length
                        ? 'Search or select a customer by name, phone or email...'
                        : 'No customers yet'
                  }
                  disabled={isLoadingOptions}
                />
                {errors.customer && <p className="text-sm text-red-600">{errors.customer}</p>}

                {selectedCustomer && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{selectedCustomer.name}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {selectedCustomer.phone} {selectedCustomer.city ? `• ${selectedCustomer.city}` : ''}
                      </p>
                    </div>
                    <a href={`/admin/customers/${selectedCustomer.id}`} className="shrink-0 text-sm font-medium text-primary-700 hover:underline">
                      View Details
                    </a>
                  </div>
                )}

                {selectedCustomer && outstandingBalance > 0 && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>Outstanding balance: {formatCurrency(outstandingBalance)}. This is for your information only and does not block the order.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <SectionBadge number={2} />
                <h3 className="text-base font-semibold text-neutral-900">Order Details</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Order Date</label>
                  <div className="flex h-11 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-600">
                    {new Date(orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">
                    {deliveryType === 'pickup' ? 'Pickup Date' : 'Delivery Date'}
                    {deliveryType !== 'pickup' && <span className="text-red-500"> *</span>}
                  </label>
                  <DatePicker value={deliveryDate} onChange={setDeliveryDate} error={errors.deliveryDate} />
                </div>
              </div>

              <Select
                label="Warehouse"
                required
                options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder={isLoadingOptions ? 'Loading...' : 'Select warehouse'}
                disabled={isLoadingOptions}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Payment Type<span className="text-red-500"> *</span>
                </label>
                <Select
                  options={paymentOptions.map(({ value, label }) => ({ value, label }))}
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value)
                    setErrors((current) => ({ ...current, paymentMethod: '' }))
                  }}
                  placeholder="Select payment type"
                  error={errors.paymentMethod}
                />
              </div>

              {paymentMethod === 'credit' && (
                <Select label="Payment Terms" required options={paymentTermsOptions} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
              )}
            </div>
          </div>

          {/* Products */}
          <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 p-5">
              <SectionBadge number={3} />
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Products / Order Items</h3>
                <p className="mt-0.5 text-sm text-neutral-500">Search a product below, then set its quantity.</p>
              </div>
            </div>

            {/* Inline product picker - always visible, ~5 rows then scroll (deliberately not a full marketplace grid) */}
            <div className="border-b border-neutral-100 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search products by name or SKU..."
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-60"
                />
              </div>
              <div className="mt-2 max-h-96 divide-y divide-neutral-50 overflow-y-auto rounded-xl border border-neutral-100">
                {isLoadingOptions ? (
                  <p className="px-3 py-6 text-center text-sm text-neutral-400">Loading products…</p>
                ) : filteredPickerProducts.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-neutral-400">No products found.</p>
                ) : (
                  filteredPickerProducts.map((product) => {
                    const quantity = orderItemQuantity(product.id)
                    const unit = product.sales_unit || product.uom || 'unit'
                    const stock = product.total_stock ?? product.total_inventory ?? null
                    const threshold = product.minimum_stock_level ?? product.reorder_level ?? 0
                    const isOutOfStock = stock !== null && stock <= 0
                    const isLowStock = stock !== null && stock > 0 && stock <= threshold

                    return (
                      <div key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                        {product.cover_image ? (
                          <img src={product.cover_image} alt="" className="size-11 shrink-0 rounded-lg border border-neutral-100 object-cover" />
                        ) : (
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                            <Package className="size-5" aria-hidden="true" />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                          <p className="truncate text-[0.7rem] text-neutral-400">SKU: {product.sku || '—'}</p>
                          <p
                            className={`text-[0.7rem] font-medium ${
                              isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-neutral-500'
                            }`}
                          >
                            {isOutOfStock
                              ? 'Out of stock'
                              : stock === null
                                ? 'Stock not tracked'
                                : `${isLowStock ? 'Low stock · ' : ''}${stock} ${unit}${isLowStock ? '' : ' available'}`}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-neutral-900">{formatCurrency(product.price || 0)}</p>
                          <p className="text-[0.64rem] text-neutral-400">/ {unit}</p>
                        </div>

                        <div className="w-24 shrink-0">
                          {quantity === 0 ? (
                            <button
                              type="button"
                              onClick={() => setPickerQuantity(product, 1)}
                              disabled={isOutOfStock}
                              className="w-full rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center justify-between rounded-lg bg-primary-600 p-0.5 text-white">
                              <button
                                type="button"
                                onClick={() => setPickerQuantity(product, quantity - 1)}
                                className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/20"
                                aria-label={`Reduce ${product.name}`}
                              >
                                <Minus className="size-3.5" aria-hidden="true" />
                              </button>
                              <input
                                value={quantity}
                                onChange={(event) => setPickerQuantity(product, event.target.value)}
                                inputMode="numeric"
                                className="w-8 min-w-0 bg-transparent text-center text-xs font-semibold focus:outline-none"
                                aria-label={`${product.name} quantity`}
                              />
                              <button
                                type="button"
                                onClick={() => setPickerQuantity(product, quantity + 1)}
                                className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/20"
                                aria-label={`Add ${product.name}`}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {orderItems.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-neutral-400">No products added yet — use the search above to add items.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Product</th>
                      <th className="px-3 py-3">Unit Price (₹)</th>
                      <th className="px-3 py-3 text-center">Qty</th>
                      <th className="px-3 py-3">Tax (%)</th>
                      <th className="px-3 py-3 text-right">Line Total (₹)</th>
                      <th className="w-10 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {orderItems.map((item) => {
                      const product = availableProducts.find((p) => p.id === item.productId)
                      if (!product) return null

                      const quantity = Number(item.quantity) || 0
                      const unitPrice = Number(item.unitPrice) || 0
                      const availableStock = product.total_stock ?? product.total_inventory ?? null
                      const isLowStock = availableStock !== null && quantity > availableStock

                      return (
                        <tr key={item.productId}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {product.cover_image ? (
                                <img src={product.cover_image} alt="" className="size-10 shrink-0 rounded-lg border border-neutral-100 object-cover" />
                              ) : (
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                                  <Package className="size-5" aria-hidden="true" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-neutral-900">{product.name}</p>
                                {availableStock !== null && (
                                  <p className={`text-xs ${isLowStock ? 'text-red-600' : 'text-neutral-400'}`}>
                                    Required {quantity} · Available {availableStock}
                                  </p>
                                )}
                                {isLowStock && (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-semibold text-amber-700">
                                    <AlertTriangle className="size-3" aria-hidden="true" />
                                    Insufficient Stock
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.unitPrice}
                              onChange={(event) => updateOrderItem(item.productId, 'unitPrice', event.target.value)}
                              onBlur={roundToWholeNumberOnBlur(item.productId, 'unitPrice', { min: 0 })}
                              className="h-9 w-24 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                            />
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateOrderItem(item.productId, 'quantity', Math.max(1, quantity - 1))}
                                className="flex size-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                                aria-label={`Decrease quantity of ${product.name}`}
                              >
                                <Minus className="size-3.5" aria-hidden="true" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(event) => updateOrderItem(item.productId, 'quantity', event.target.value)}
                                onBlur={roundToWholeNumberOnBlur(item.productId, 'quantity', { min: 1 })}
                                className="h-9 w-14 rounded-lg border border-neutral-200 bg-white text-center text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                              />
                              <button
                                type="button"
                                onClick={() => updateOrderItem(item.productId, 'quantity', quantity + 1)}
                                className="flex size-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                                aria-label={`Increase quantity of ${product.name}`}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-neutral-500">{formatGstPercent(item.taxRate || 0)}%</td>
                          <td className="px-3 py-3.5 text-right font-semibold text-neutral-900">
                            {formatCurrency(unitPrice * quantity * (1 - Math.min(Math.max(Number(item.discountPercent) || 0, 0), 100) / 100))}
                            {Number(item.discountPercent) > 0 && (
                              <p className="text-[0.7rem] font-normal text-neutral-400">incl. {Math.round(Number(item.discountPercent))}% item disc</p>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeOrderItem(item.productId)}
                              className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {errors.items && <p className="px-5 pb-2 text-sm text-red-600">{errors.items}</p>}

            <div className="flex flex-col gap-3 border-t border-neutral-100 p-5 sm:flex-row sm:items-center">
              <Input
                placeholder="Add notes for this order (optional)"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                className="flex-1"
                compact
              />
              <div className="flex shrink-0 items-center gap-6">
                <div>
                  <p className="text-xs text-neutral-400">Total Quantity</p>
                  <p className="text-sm font-semibold text-primary-700">{totals.totalQuantity} Items</p>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Method */}
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex items-center gap-2.5">
              <SectionBadge number={4} />
              <h3 className="text-base font-semibold text-neutral-900">Delivery Method</h3>
            </div>

            {restrictToVehicleStock ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
                <Truck className="size-5 text-primary-700" aria-hidden="true" />
                <span className="text-sm font-medium text-neutral-800">
                  Delivered by you ({currentUser?.name || 'this vehicle'}) — no separate assignment needed.
                </span>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {deliveryOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = deliveryType === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setDeliveryType(option.value)
                          setErrors((current) => ({ ...current, deliveryType: '' }))
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-4 focus:ring-primary-500/12 ${
                          isSelected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/50'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <Icon className="mt-0.5 size-5 text-primary-700" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-semibold text-neutral-900">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {errors.deliveryType && <p className="mt-3 text-sm text-red-600">{errors.deliveryType}</p>}

                {deliveryType === 'delivery_boy' && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">Delivery Address</label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        placeholder={customerDefaultAddress || 'Delivery address'}
                        disabled={!selectedCustomer}
                        maxLength={500}
                        className="h-20 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-60"
                      />
                      <p className="text-xs text-neutral-400">Auto-filled from the customer. A delivery partner is assigned later from the order via Plan Delivery.</p>
                    </div>
                  </div>
                )}

                {deliveryType === 'pickup' && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-neutral-700">
                    <Store className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
                    The customer collects this order from the store. Set the expected collection date above — no address or delivery partner is needed.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex items-center gap-2.5">
              <SectionBadge number={5} />
              <h3 className="text-base font-semibold text-neutral-900">Notes</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Order Notes</label>
                <textarea
                  value={orderNotes}
                  maxLength={250}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
                <p className="text-right text-xs text-neutral-400">{orderNotes.length} / 250</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Internal Notes</label>
                <textarea
                  value={internalNotes}
                  maxLength={250}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
                <p className="text-right text-xs text-neutral-400">{internalNotes.length} / 250</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-primary-100 bg-primary-50/60 px-5 py-3.5">
            <Info className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
            <p className="text-sm font-medium text-primary-800">Please review all details before creating the order.</p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <h3 className="text-lg font-semibold text-neutral-900">Order Summary</h3>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">Order Discount</label>
                <p className="text-xs text-neutral-400">Applies to the whole order. There is no per-product discount.</p>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                  <Select
                    options={discountTypeOptions}
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      onBlur={(event) => {
                        const rounded = Math.round(Number(event.target.value))
                        setDiscountValue(String(Number.isFinite(rounded) ? Math.max(rounded, 0) : 0))
                      }}
                      className="h-11 w-full min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                    <span className="text-sm font-medium text-neutral-500">{discountType === 'percentage' ? '%' : '₹'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Subtotal</span>
                <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.subtotal)}</span>
              </div>

              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Order Discount</span>
                  <span className="text-sm font-medium text-red-600">-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">GST ({formatGstPercent(totals.effectiveGstPercent)}%)</span>
                <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.gstAmount)}</span>
              </div>

              <div className="space-y-2 border-t border-neutral-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Total Quantity</span>
                  <span className="text-sm font-medium text-neutral-900">{totals.totalQuantity} Items</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Payment Type</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {paymentOptions.find((option) => option.value === paymentMethod)?.label || 'Not selected'}
                  </span>
                </div>
                {paymentMethod === 'credit' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Payment Terms</span>
                    <span className="text-sm font-medium text-neutral-900">
                      {paymentTermsOptions.find((option) => option.value === paymentTerms)?.label}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Delivery Method</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {restrictToVehicleStock
                      ? `Delivered by ${assignedDeliveryBoyName || 'you'}`
                      : deliveryType === 'pickup'
                        ? 'Self Pickup'
                        : deliveryType === 'delivery_boy'
                          ? 'Home Delivery (partner assigned later)'
                          : 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">{deliveryType === 'pickup' ? 'Pickup Date' : 'Delivery Date'}</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                <span className="text-base font-semibold text-neutral-900">
                  Total Amount
                  <span className="block text-xs font-normal text-neutral-400">(All Inclusive)</span>
                </span>
                <span className="text-2xl font-bold text-primary-700">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <Button type="submit" className="mt-5 w-full" disabled={!canCreateOrder} loading={isSubmitting}>
              <FileCheck2 className="size-4" aria-hidden="true" />
              {isEditMode ? 'Save Changes' : 'Create Order'}
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-400">
              {isEditMode ? 'Changes apply to this draft order immediately.' : 'The order is created as a draft — confirm it from the order page.'}
            </p>
          </div>
        </div>
      </form>

      <QuickAddCustomerModal
        isOpen={showQuickAddCustomer}
        onClose={() => setShowQuickAddCustomer(false)}
        onCreated={handleCustomerCreated}
      />
    </div>
  )
}
