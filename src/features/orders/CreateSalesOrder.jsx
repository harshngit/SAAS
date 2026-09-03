import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Info,
  Minus,
  Plus,
  Smartphone,
  Store,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES, roleHomePath } from '../../auth/roles'
import { listProducts } from '../../api/products'
import { listCustomers } from '../../api/customers'
import { listWarehouses } from '../../api/warehouses'
import { listDeliveryPartners } from '../../api/deliveries'
import { createOrder, assignDeliveryPartner, getOrder, updateOrder } from '../../api/orders'
import { getQuotation } from '../../api/quotations'
import { duplicateDemoOrder, getDemoOrder, isDemoOrder, patchDemoOrder } from './orderDemoData'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import QuickAddCustomerModal from '../customers/QuickAddCustomerModal'
import { useToast } from '../../components/ui/toastContext'
import ProductPickerList from './ProductPickerList'

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
  { value: 'pickup', label: 'Takeaway', description: 'Customer collects the order from our store.', icon: Store },
  { value: 'delivery_boy', label: 'Home Delivery', description: 'We deliver the order to the customer address.', icon: Truck },
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

// The customer's delivery address, tolerant of both the camelCase (single-customer GET) and
// snake_case (customer list) shapes - the list endpoint returns `delivery_address`.
const resolveCustomerAddress = (customer) =>
  customer?.deliveryAddress ||
  customer?.delivery_address ||
  customer?.shippingAddress ||
  customer?.shipping_address ||
  customer?.billingAddress ||
  customer?.billing_address ||
  ''

export default function CreateSalesOrder({ restrictToVehicleStock = false }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
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
  // Home Delivery: the Sales Officer picks the delivery partner at creation. Admin does not
  // (Admin's normal flow assigns it later from the order via Plan Delivery).
  const [deliveryPartnerId, setDeliveryPartnerId] = useState('')
  const [deliveryPartners, setDeliveryPartners] = useState([])

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [stockShortages, setStockShortages] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Takeaway / Self Pickup checkout: a frontend-only review step before the order is placed.
  // "preview" is never an order status - it is local UI state only.
  const [showPreview, setShowPreview] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      // Delivery-partner list for the Home Delivery picker (create flow, both roles).
      const needsPartners = !restrictToVehicleStock && !isEditMode
      const [productsResult, customersResult, warehousesResult, partnersResult] = await Promise.all([
        listProducts(),
        listCustomers(),
        listWarehouses(),
        needsPartners ? listDeliveryPartners() : Promise.resolve({ success: false }),
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
      if (partnersResult.success) setDeliveryPartners(partnersResult.partners)

      setIsLoadingOptions(false)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [preselectedCustomerId, isEditMode, restrictToVehicleStock])

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

  // Auto-fill the delivery address from the selected customer (still editable). Picking or
  // switching the customer clears the field first (see the customer <Select> onChange), so
  // this refills it from whichever customer is now selected.
  useEffect(() => {
    if (!selectedCustomer) return
    setDeliveryAddress((current) => current || resolveCustomerAddress(selectedCustomer))
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

  const handleCustomerCreated = (createdCustomer) => {
    setCustomerRecords((current) => [createdCustomer, ...current])
    setSelectedCustomerId(createdCustomer.id)
    setDeliveryAddress(resolveCustomerAddress(createdCustomer))
    setShowQuickAddCustomer(false)
    setErrors((current) => ({ ...current, customer: '' }))
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

  // Takeaway / Self Pickup on a fresh order goes through the Preview Sales Order modal first.
  // Home Delivery, edit mode, and the delivery-vehicle app place the order directly.
  const isTakeawayCheckout = !restrictToVehicleStock && !isEditMode && deliveryType === 'pickup'

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

    if (!restrictToVehicleStock) {
      if (!deliveryType) {
        nextErrors.deliveryType = 'Select a delivery method.'
      } else if (deliveryType === 'delivery_boy') {
        // Home Delivery: address is always required; the partner is required when a
        // Sales Officer creates the order (they own the assignment step).
        if (!deliveryAddress.trim()) {
          nextErrors.deliveryAddress = 'Delivery address is required for home delivery.'
        }
        if (isSalesOfficer && !isEditMode && !deliveryPartnerId) {
          nextErrors.deliveryPartnerId = 'Choose a delivery partner.'
        }
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validateForm()) return

    // Takeaway: open the frontend review modal instead of placing the order right away.
    if (isTakeawayCheckout && !showPreview) {
      setSubmitError('')
      setStockShortages(null)
      setShowPreview(true)
      return
    }

    submitOrder()
  }

  const submitOrder = async () => {
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

    const isHomeDelivery = restrictToVehicleStock || deliveryType === 'delivery_boy'

    const result = await createOrder({
      customerId: selectedCustomer.id,
      warehouseId,
      deliveryDate,
      quotationId: sourceQuotationId || undefined,
      fulfilmentMethod: isHomeDelivery ? 'delivery' : 'pickup',
      deliveryAddress: isHomeDelivery ? deliveryAddress.trim() : undefined,
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

    // Assign the delivery partner now when one was chosen at creation:
    //  - the delivery-vehicle app self-assigns the current partner
    //  - Home Delivery: whoever picked a partner (required for Sales Officer, optional for Admin).
    //    If it's left blank, it's assigned later from the order via Plan Delivery.
    const partnerToAssign = restrictToVehicleStock
      ? currentUser?.id
      : deliveryType === 'delivery_boy' && deliveryPartnerId
        ? deliveryPartnerId
        : null
    if (partnerToAssign) {
      await assignDeliveryPartner(result.order.id, partnerToAssign)
    }

    showToast({
      title: 'Order created',
      message: `${result.order.orderNumber} has been created successfully.`,
    })
    setIsSubmitting(false)
    navigate(currentUser?.role === ROLES.ADMIN ? '/admin/orders' : roleHomePath[currentUser?.role] || '/')
  }

  const assignedDeliveryBoyName = restrictToVehicleStock ? currentUser?.name : null
  const selectedDeliveryPartnerName = deliveryPartners.find((partner) => partner.id === deliveryPartnerId)?.name || ''
  const outstandingBalance = Number(
    selectedCustomer?.outstandingBalance ?? selectedCustomer?.outstanding_balance ?? 0,
  )
  const customerDefaultAddress = resolveCustomerAddress(selectedCustomer)

  // Preview (Takeaway) checkout maths - all frontend. Previous balance comes from the
  // customer's existing outstanding balance if the API already returned it, else ₹0.
  const previousBalance = outstandingBalance > 0 ? outstandingBalance : 0
  const grandPayable = totals.total + previousBalance
  const paidAmountValue = Math.max(0, Number(paidAmount) || 0)
  const remainingBalance = grandPayable - paidAmountValue
  const warehouseName = warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || '—'
  const paymentTypeLabel = paymentOptions.find((option) => option.value === paymentMethod)?.label || 'Not selected'

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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
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
                    // Clear so the effect refills the address from the newly chosen customer.
                    setDeliveryAddress('')
                    setErrors((current) => ({ ...current, customer: '', deliveryAddress: '' }))
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <ProductPickerList
                products={availableProducts}
                orderItems={orderItems}
                isLoading={isLoadingOptions}
                onSetQuantity={setPickerQuantity}
                onUpdateItem={updateOrderItem}
                onRoundBlur={roundToWholeNumberOnBlur}
              />
            </div>

            {errors.items && <p className="px-5 pt-4 text-sm text-red-600">{errors.items}</p>}

            {orderItems.length > 0 && (
              <div className="border-t border-neutral-100 px-5 py-4">
                <div className="flex flex-col gap-x-6 gap-y-3 rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <span className="text-xs text-neutral-500">Subtotal</span>
                    <span className="font-semibold text-neutral-900">{formatCurrency(totals.subtotal)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Discount</span>
                    <Select
                      options={discountTypeOptions}
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value)}
                      className="w-40"
                    />
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
                      aria-label="Discount value"
                      className="h-10 w-16 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                    />
                    <span className="text-xs font-medium text-neutral-500">{discountType === 'percentage' ? '%' : '₹'}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <span className="text-xs text-neutral-500">Discount Amount</span>
                    <span className={`font-semibold ${totals.discountAmount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                      {totals.discountAmount > 0 ? `-${formatCurrency(totals.discountAmount)}` : formatCurrency(0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <span className="text-xs text-neutral-500">GST ({formatGstPercent(totals.effectiveGstPercent)}%)</span>
                    <span className="font-semibold text-neutral-900">{formatCurrency(totals.gstAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-start">
                    <span className="text-xs text-neutral-500">Final Amount</span>
                    <span className="font-bold text-primary-700">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            )}
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
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          isSelected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => {
                            setDeliveryType(option.value)
                            setShowPreview(false)
                            setErrors((current) => ({ ...current, deliveryType: '', deliveryAddress: '', deliveryPartnerId: '' }))
                          }}
                          className="mt-0.5 size-4 shrink-0 text-primary-600 focus:ring-primary-500"
                        />
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-semibold text-neutral-900">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {errors.deliveryType && <p className="mt-3 text-sm text-red-600">{errors.deliveryType}</p>}

                {deliveryType === 'pickup' && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-neutral-700">
                    <Store className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
                    Customer collects from {warehouses.find((w) => w.id === warehouseId)?.name || 'the selected warehouse'}. No delivery address or partner needed — set the pickup date in Order Details.
                  </div>
                )}

                {deliveryType === 'delivery_boy' && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-neutral-700">
                        Delivery Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(event) => {
                          setDeliveryAddress(event.target.value)
                          setErrors((current) => ({ ...current, deliveryAddress: '' }))
                        }}
                        placeholder={customerDefaultAddress || 'Delivery address'}
                        disabled={!selectedCustomer}
                        maxLength={500}
                        className={`h-24 resize-none rounded-xl border bg-neutral-50 p-3 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-60 ${
                          errors.deliveryAddress ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-primary-400'
                        }`}
                      />
                      {errors.deliveryAddress ? (
                        <p className="text-xs text-red-600">{errors.deliveryAddress}</p>
                      ) : (
                        <p className="text-xs text-neutral-400">Auto-filled from the customer — edit if the delivery goes elsewhere.</p>
                      )}
                    </div>

                    {!isEditMode ? (
                      <div className="flex flex-col gap-1.5">
                        <Select
                          label="Delivery Partner"
                          required={isSalesOfficer}
                          options={deliveryPartners.map((partner) => ({ value: partner.id, label: partner.name }))}
                          value={deliveryPartnerId}
                          onChange={(event) => {
                            setDeliveryPartnerId(event.target.value)
                            setErrors((current) => ({ ...current, deliveryPartnerId: '' }))
                          }}
                          placeholder={deliveryPartners.length ? 'Select a delivery partner' : 'No delivery partners available'}
                          error={errors.deliveryPartnerId}
                          disabled={!deliveryPartners.length}
                        />
                        {!deliveryPartners.length && !isLoadingOptions ? (
                          <p className="text-xs text-neutral-400">Add an active delivery partner in Staff before assigning one here.</p>
                        ) : (
                          <p className="text-xs text-neutral-400">
                            {isSalesOfficer
                              ? 'Choose who will deliver this order.'
                              : 'Optional — you can also assign a partner later from the order via Plan Delivery.'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500 sm:self-center">
                        Manage the delivery partner from the order page via{' '}
                        <span className="font-medium text-neutral-700">Plan Delivery</span>.
                      </p>
                    )}
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
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-sm text-neutral-600">Customer</span>
                  <span className="min-w-0 text-right text-sm font-medium text-neutral-900">{selectedCustomer?.name || 'Not selected'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Products</span>
                  <span className="text-sm font-medium text-neutral-900">{orderItems.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Total Quantity</span>
                  <span className="text-sm font-medium text-neutral-900">{totals.totalQuantity} Items</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-neutral-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Subtotal</span>
                  <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Discount</span>
                  <span className={`text-sm font-medium ${totals.discountAmount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                    {totals.discountAmount > 0
                      ? `-${formatCurrency(totals.discountAmount)}${discountType === 'percentage' && Number(discountValue) > 0 ? ` (${Math.round(Number(discountValue))}%)` : ''}`
                      : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">GST ({formatGstPercent(totals.effectiveGstPercent)}%)</span>
                  <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.gstAmount)}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-neutral-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0 text-sm text-neutral-600">Delivery Method</span>
                  <span className="text-right text-sm font-medium text-neutral-900">
                    {restrictToVehicleStock
                      ? `Delivered by ${assignedDeliveryBoyName || 'you'}`
                      : deliveryType === 'pickup'
                        ? 'Takeaway'
                        : deliveryType === 'delivery_boy'
                          ? selectedDeliveryPartnerName
                            ? `Home Delivery · ${selectedDeliveryPartnerName}`
                            : 'Home Delivery (partner assigned later)'
                          : 'Not selected'}
                  </span>
                </div>
                {!restrictToVehicleStock && deliveryType === 'delivery_boy' && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-sm text-neutral-600">Address</span>
                    <span
                      className="line-clamp-2 min-w-0 text-right text-sm font-medium text-neutral-900"
                      title={deliveryAddress || customerDefaultAddress || ''}
                    >
                      {deliveryAddress || customerDefaultAddress || '—'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">{deliveryType === 'pickup' ? 'Pickup Date' : 'Delivery Date'}</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </span>
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
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                <span className="text-base font-semibold text-neutral-900">
                  Final Amount
                  <span className="block text-xs font-normal text-neutral-400">(All Inclusive)</span>
                </span>
                <span className="text-2xl font-bold text-primary-700">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <Button type="submit" className="mt-5 w-full" disabled={!canCreateOrder} loading={isSubmitting && !showPreview}>
              {isTakeawayCheckout ? <Eye className="size-4" aria-hidden="true" /> : <FileCheck2 className="size-4" aria-hidden="true" />}
              {isEditMode ? 'Save Changes' : isTakeawayCheckout ? 'Preview Sales Order' : 'Create Sales Order'}
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-400">
              {isEditMode
                ? 'Changes apply to this draft order immediately.'
                : isTakeawayCheckout
                  ? 'Review the order and record any payment before placing it.'
                  : 'The order is created as a draft — confirm it from the order page.'}
            </p>
          </div>
        </div>
      </form>

      <QuickAddCustomerModal
        isOpen={showQuickAddCustomer}
        onClose={() => setShowQuickAddCustomer(false)}
        onCreated={handleCustomerCreated}
      />

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Preview Sales Order"
        className="max-w-5xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitOrder}
              loading={isSubmitting}
              disabled={orderItems.length === 0}
            >
              <FileCheck2 className="size-4" aria-hidden="true" />
              Place Order
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {submitError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* LEFT: customer, products, add-a-product */}
          <div className="min-w-0 space-y-5">

          {/* Customer - read only */}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Customer</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedCustomer?.name || '—'}</p>
            {(deliveryAddress || customerDefaultAddress) && (
              <p className="mt-0.5 text-xs text-neutral-500">{deliveryAddress || customerDefaultAddress}</p>
            )}
          </div>

          {/* Products on the order - quantity editable, unit price + discount read-only here */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Products on this order</p>
              <span className="text-xs text-neutral-400">Adjust quantity here — discount &amp; unit price are set on the order.</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3 text-right">Line Total</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-400">
                        No products left on this order. Add one below or cancel.
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => {
                      const product = availableProducts.find((p) => p.id === item.productId)
                      if (!product) return null
                      const quantity = Number(item.quantity) || 0
                      const unitPrice = Number(item.unitPrice) || 0
                      const discountPercent = Math.min(Math.max(Number(item.discountPercent) || 0, 0), 100)
                      const lineTotal = unitPrice * quantity * (1 - discountPercent / 100)
                      const unit = product.sales_unit || product.uom || 'unit'
                      return (
                        <tr key={item.productId}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-neutral-900">{product.name}</p>
                            <p className="text-xs text-neutral-400">SKU: {product.sku || '—'}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="mx-auto flex w-fit items-center rounded-lg border border-neutral-200 p-0.5 text-neutral-500">
                              <button
                                type="button"
                                onClick={() => setPickerQuantity(product, quantity - 1)}
                                disabled={quantity <= 1}
                                className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-neutral-50 disabled:opacity-30"
                                aria-label={`Reduce ${product.name}`}
                              >
                                <Minus className="size-3.5" aria-hidden="true" />
                              </button>
                              <input
                                value={quantity}
                                onChange={(event) => setPickerQuantity(product, event.target.value)}
                                inputMode="numeric"
                                className="w-9 min-w-0 bg-transparent text-center text-xs font-semibold text-neutral-900 focus:outline-none"
                                aria-label={`${product.name} quantity`}
                              />
                              <button
                                type="button"
                                onClick={() => setPickerQuantity(product, quantity + 1)}
                                className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-neutral-50"
                                aria-label={`Add ${product.name}`}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-neutral-600">
                            {formatCurrency(unitPrice)}
                            <span className="ml-1 text-[0.64rem] text-neutral-400">/ {unit}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-neutral-900">{formatCurrency(lineTotal)}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setPickerQuantity(product, 0)}
                              className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Add a product</p>
              <ProductPickerList
                products={availableProducts}
                orderItems={orderItems}
                isLoading={isLoadingOptions}
                onSetQuantity={setPickerQuantity}
                onUpdateItem={updateOrderItem}
                onRoundBlur={roundToWholeNumberOnBlur}
                listMaxHeightClass="max-h-56"
              />
            </div>
          </div>
          </div>

          {/* RIGHT: summary + order details rail */}
          <div className="space-y-4 lg:self-start lg:border-l lg:border-neutral-100 lg:pl-6">
            {/* Financial summary */}
            <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium text-neutral-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Discount</span>
                <span className={`font-medium ${totals.discountAmount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                  {totals.discountAmount > 0 ? `-${formatCurrency(totals.discountAmount)}` : formatCurrency(0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Tax / GST</span>
                <span className="font-medium text-neutral-900">{formatCurrency(totals.gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <span className="font-semibold text-neutral-900">Current Order Total</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Previous Balance</span>
                <span className="font-medium text-neutral-900">{formatCurrency(previousBalance)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <span className="font-semibold text-neutral-900">Grand Payable</span>
                <span className="text-base font-bold text-primary-700">{formatCurrency(grandPayable)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-neutral-500">Paid Amount</span>
                <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white pl-2.5 pr-1">
                  <span className="text-xs text-neutral-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                    onBlur={(event) => {
                      const next = Math.max(0, Math.round(Number(event.target.value) || 0))
                      setPaidAmount(next ? String(next) : '')
                    }}
                    aria-label="Paid amount"
                    className="h-8 w-24 bg-transparent text-right text-sm font-semibold text-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                <span className="font-semibold text-neutral-900">Remaining Balance</span>
                <span className={`font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-primary-700'}`}>
                  {formatCurrency(Math.max(remainingBalance, 0))}
                </span>
              </div>
              <p className="pt-1 text-[0.7rem] text-neutral-400">
                Payment is recorded against the order after it is placed.
              </p>
            </div>

            {/* Order details - read only */}
            <div className="space-y-2 rounded-xl border border-neutral-100 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Delivery Date</span>
                <span className="font-medium text-neutral-900">
                  {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Warehouse</span>
                <span className="font-medium text-neutral-900">{warehouseName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Payment Type</span>
                <span className="font-medium text-neutral-900">{paymentTypeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Delivery Method</span>
                <span className="font-medium text-neutral-900">Takeaway / Self Pickup</span>
              </div>
            </div>
          </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
