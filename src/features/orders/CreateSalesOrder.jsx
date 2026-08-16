import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  CreditCard,
  FileCheck2,
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
import { listUsers } from '../../api/users'
import { listWarehouses } from '../../api/warehouses'
import { createOrder, assignDeliveryPartner } from '../../api/orders'
import { normalizeApiUser } from '../users/userRoleUtils'
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

  const [availableProducts, setAvailableProducts] = useState([])
  const [customerRecords, setCustomerRecords] = useState([])
  const [deliveryBoys, setDeliveryBoys] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  // Customer / Company
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false)

  // Order details
  const [orderDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10))
  const [warehouseId, setWarehouseId] = useState('')

  // Products
  const [orderItems, setOrderItems] = useState([])
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const productPickerRef = useRef(null)

  // Discount
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState(0)

  // Payment / delivery
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('15')
  const [deliveryType, setDeliveryType] = useState('')
  const [deliveryBoyId, setDeliveryBoyId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [stockShortages, setStockShortages] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [productsResult, customersResult, usersResult, warehousesResult] = await Promise.all([
        listProducts(),
        listCustomers(),
        listUsers(),
        listWarehouses(),
      ])

      if (!isMounted) return

      if (productsResult.success) setAvailableProducts(productsResult.products)
      if (customersResult.success) setCustomerRecords(customersResult.customers)
      if (usersResult.success) {
        setDeliveryBoys(usersResult.users.map(normalizeApiUser).filter((user) => user.role === ROLES.DELIVERY_PARTNER && user.isActive))
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
  }, [])

  useEffect(() => {
    if (!restrictToVehicleStock || !currentUser?.id) return
    setDeliveryType('delivery_boy')
    setDeliveryBoyId(currentUser.id)
  }, [restrictToVehicleStock, currentUser?.id])

  useEffect(() => {
    if (!isProductPickerOpen) return

    const handleClickOutside = (event) => {
      if (productPickerRef.current && !productPickerRef.current.contains(event.target)) {
        setIsProductPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isProductPickerOpen])

  const selectedCustomer = useMemo(
    () => customerRecords.find((customer) => customer.id === selectedCustomerId) || null,
    [customerRecords, selectedCustomerId],
  )

  const customerOptions = useMemo(() => {
    const search = customerSearch.trim().toLowerCase()
    const filtered = search
      ? customerRecords.filter((customer) => {
          const matchesName = customer.name?.toLowerCase().includes(search)
          const matchesPhone = customer.phone?.replace(/\D/g, '').includes(search.replace(/\D/g, ''))
          const matchesEmail = customer.email?.toLowerCase().includes(search)
          return matchesName || matchesPhone || matchesEmail
        })
      : customerRecords

    return filtered.map((customer) => ({ value: customer.id, label: customer.name }))
  }, [customerRecords, customerSearch])

  const filteredPickerProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return availableProducts
    return availableProducts.filter((product) => product.name?.toLowerCase().includes(search))
  }, [availableProducts, productSearch])

  const handleCustomerCreated = (createdCustomer) => {
    setCustomerRecords((current) => [createdCustomer, ...current])
    setSelectedCustomerId(createdCustomer.id)
    setShowQuickAddCustomer(false)
    setErrors((current) => ({ ...current, customer: '' }))
  }

  const addProductToOrder = (product) => {
    setOrderItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id)
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...current, { productId: product.id, unitPrice: product.price || 0, taxRate: product.tax_rate || 0, quantity: 1 }]
    })
    setErrors((current) => ({ ...current, items: '' }))
    setIsProductPickerOpen(false)
    setProductSearch('')
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
      return { product, unitPrice, quantity, taxRate, lineSubtotal: unitPrice * quantity }
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

  const canCreateOrder = restrictToVehicleStock || Boolean(deliveryType && (deliveryType !== 'delivery_boy' || deliveryBoyId))

  const validateForm = () => {
    const nextErrors = {}

    if (!selectedCustomer) nextErrors.customer = 'Select an existing customer or quick add a new one.'
    if (!deliveryDate) nextErrors.deliveryDate = 'Delivery date is required.'
    if (orderItems.length === 0) nextErrors.items = 'Add at least one product to the order.'
    if (orderItems.some((item) => !Number(item.quantity) || Number(item.quantity) < 1)) {
      nextErrors.items = 'Keep every product quantity at least 1.'
    }
    if (!paymentMethod) nextErrors.paymentMethod = 'Select a payment type.'
    if (!restrictToVehicleStock && !deliveryType) nextErrors.deliveryType = 'Select a delivery method.'
    if (deliveryType === 'delivery_boy' && !restrictToVehicleStock && !deliveryBoyId) nextErrors.deliveryBoyId = 'Choose a delivery partner.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitError('')
    setStockShortages(null)

    const result = await createOrder({
      customerId: selectedCustomer.id,
      warehouseId,
      deliveryDate,
      fulfilmentMethod: restrictToVehicleStock ? 'delivery' : deliveryType === 'delivery_boy' ? 'delivery' : 'pickup',
      paymentType: paymentMethod,
      paymentTermsDays: paymentMethod === 'credit' ? Number(paymentTerms) : 0,
      discount: totals.discountAmount,
      source: restrictToVehicleStock ? 'delivery_vehicle' : 'office',
      notes: orderNotes.trim() || internalNotes.trim() ? `${orderNotes.trim()}${internalNotes.trim() ? `\n[Internal] ${internalNotes.trim()}` : ''}` : undefined,
      items: orderItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        taxRate: Number(item.taxRate) || 0,
      })),
    })

    if (!result.success) {
      setSubmitError(result.error)
      setStockShortages(result.shortages || null)
      setIsSubmitting(false)
      return
    }

    const partnerId = restrictToVehicleStock ? currentUser?.id : deliveryType === 'delivery_boy' ? deliveryBoyId : null
    if (partnerId) {
      await assignDeliveryPartner(result.order.id, partnerId)
    }

    showToast({
      title: 'Order created',
      message: `${result.order.orderNumber} has been created successfully.`,
    })
    setIsSubmitting(false)
    navigate(currentUser?.role === ROLES.ADMIN ? '/admin/orders' : roleHomePath[currentUser?.role] || '/')
  }

  const assignedDeliveryBoyName = restrictToVehicleStock
    ? currentUser?.name
    : deliveryBoys.find((user) => user.id === deliveryBoyId)?.name

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Create Order</h1>
        <p className="text-sm text-neutral-500">Add order details and confirm to create a new order.</p>
      </div>

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
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search by name, phone or email..."
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm text-neutral-900 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
                <Select
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value)
                    setErrors((current) => ({ ...current, customer: '' }))
                  }}
                  placeholder={isLoadingOptions ? 'Loading customers...' : customerOptions.length ? 'Select a customer' : 'No matching customer found'}
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
                    Delivery Date<span className="text-red-500"> *</span>
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
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 p-5">
              <div className="flex items-center gap-2.5">
                <SectionBadge number={3} />
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Products / Order Items</h3>
                  <p className="mt-0.5 text-sm text-neutral-500">Add products, set selling price and quantity.</p>
                </div>
              </div>
              <div className="relative" ref={productPickerRef}>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsProductPickerOpen((current) => !current)} disabled={isLoadingOptions}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Product
                </Button>
                {isProductPickerOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-neutral-100 bg-white p-3 shadow-(--shadow-popover)">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="search"
                        autoFocus
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Search products..."
                        className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                      />
                    </div>
                    <div className="mt-2 max-h-64 overflow-y-auto">
                      {filteredPickerProducts.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-neutral-400">No products found.</p>
                      ) : (
                        filteredPickerProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addProductToOrder(product)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary-50/60"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-neutral-900">{product.name}</span>
                              <span className="block text-xs text-neutral-400">In Stock: {product.total_stock ?? '-'}</span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-primary-700">{formatCurrency(product.price || 0)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {orderItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-neutral-700">No products added yet</p>
                <p className="mt-1 text-sm text-neutral-500">Click "Add Product" to start building this order.</p>
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
                      const isLowStock = product.total_stock !== undefined && quantity > product.total_stock

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
                                {product.total_stock !== undefined && (
                                  <p className={`text-xs ${isLowStock ? 'text-red-600' : 'text-neutral-400'}`}>
                                    In Stock: {product.total_stock}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) => updateOrderItem(item.productId, 'unitPrice', event.target.value)}
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
                                value={item.quantity}
                                onChange={(event) => updateOrderItem(item.productId, 'quantity', event.target.value)}
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
                            {formatCurrency(unitPrice * quantity)}
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
                <div className="text-right">
                  <p className="text-xs text-neutral-400">Subtotal (Before Discount &amp; GST)</p>
                  <p className="text-sm font-semibold text-neutral-900">{formatCurrency(totals.subtotal)}</p>
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
                          if (option.value === 'pickup') setDeliveryBoyId('')
                          setErrors((current) => ({ ...current, deliveryType: '', deliveryBoyId: '' }))
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

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Assign Delivery Partner{deliveryType === 'delivery_boy' && <span className="text-red-500"> *</span>}
                    </label>
                    <Select
                      options={deliveryBoys.map((user) => ({ value: user.id, label: user.name }))}
                      value={deliveryBoyId}
                      onChange={(event) => {
                        setDeliveryBoyId(event.target.value)
                        setErrors((current) => ({ ...current, deliveryBoyId: '' }))
                      }}
                      placeholder="Choose delivery partner"
                      error={errors.deliveryBoyId}
                      disabled={deliveryType !== 'delivery_boy'}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">Delivery Address (Optional)</label>
                    <Input
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      placeholder={selectedCustomer?.billingAddress || 'Delivery address'}
                      disabled={!selectedCustomer}
                    />
                  </div>
                </div>
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Subtotal (Before Discount &amp; GST)</span>
                <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.subtotal)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">Discount</label>
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
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      className="h-11 w-full min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                    <span className="text-sm font-medium text-neutral-500">{discountType === 'percentage' ? '%' : '₹'}</span>
                  </div>
                </div>
                {totals.discountAmount > 0 && (
                  <p className="text-right text-sm font-medium text-red-600">-{formatCurrency(totals.discountAmount)}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Subtotal</span>
                <span className="text-sm font-medium text-neutral-900">{formatCurrency(totals.subtotal - totals.discountAmount)}</span>
              </div>

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
                  <span className="text-sm text-neutral-600">Delivery Partner</span>
                  <span className="text-sm font-medium text-neutral-900">{assignedDeliveryBoyName || 'Takeaway / Not assigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Delivery Date</span>
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
              Create Order
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-400">You can review and edit the order before confirmation.</p>
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
