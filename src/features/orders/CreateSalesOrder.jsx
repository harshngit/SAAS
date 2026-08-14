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
import { products } from '../../mockData/products'
import { customers as seedCustomers } from '../../mockData/customers'
import { buildOrder, orders as seedOrders } from '../../mockData/orders'
import { vehicleStock } from '../../mockData/vehicleStock'
import { users } from '../../mockData/users'
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

const warehouseOptions = [{ value: 'main', label: 'Main Warehouse' }]

const deliveryOptions = [
  { value: 'takeaway', label: 'Takeaway / Self Pickup', description: 'Customer will collect the order from our store.', icon: Store },
  { value: 'delivery_boy', label: 'Home Delivery', description: 'We will deliver the order to customer address.', icon: Truck },
]

const discountTypeOptions = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'amount', label: 'Amount (₹)' },
]

const normalizeCustomerSearchValue = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, ' ')
const normalizePhone = (value = '') => String(value).replace(/\D/g, '')
const phoneMatches = (registeredPhone = '', typedPhone = '') => {
  const registered = normalizePhone(registeredPhone)
  const typed = normalizePhone(typedPhone)

  return Boolean(typed && (registered === typed || registered.endsWith(typed) || typed.endsWith(registered)))
}

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
  const availableProducts = useMemo(() => {
    if (!restrictToVehicleStock) return products

    return vehicleStock
      .filter((entry) => entry.quantity > 0)
      .map((entry) => {
        const product = products.find((item) => item.id === entry.productId)
        return product ? { ...product, stock: entry.quantity } : null
      })
      .filter(Boolean)
  }, [restrictToVehicleStock])

  // Customer / Company
  const [customerRecords, setCustomerRecords] = useState(seedCustomers)
  const [customerMode, setCustomerMode] = useState('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false)

  // Order details
  const [orderDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10))
  const [warehouse, setWarehouse] = useState('main')

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

  const deliveryBoys = useMemo(
    () => users.filter((user) => user.role === ROLES.DELIVERY_PARTNER && user.status !== 'inactive'),
    [],
  )

  const selectedCustomer = useMemo(
    () => customerRecords.find((customer) => customer.id === selectedCustomerId) || null,
    [customerRecords, selectedCustomerId],
  )

  const customerOptions = useMemo(() => {
    const search = normalizeCustomerSearchValue(customerSearch)
    const filtered = search
      ? customerRecords.filter((customer) => {
          const matchesName = normalizeCustomerSearchValue(customer.name).includes(search)
          const matchesPhone = phoneMatches(customer.phone, customerSearch)
          const matchesEmail = normalizeCustomerSearchValue(customer.email).includes(search)
          return matchesName || matchesPhone || matchesEmail
        })
      : customerRecords

    return filtered.map((customer) => ({ value: customer.id, label: customer.name }))
  }, [customerRecords, customerSearch])

  const filteredPickerProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) return availableProducts
    return availableProducts.filter((product) => product.fullName.toLowerCase().includes(search))
  }, [availableProducts, productSearch])

  const handleCustomerCreated = (createdCustomer) => {
    setCustomerRecords((current) => [createdCustomer, ...current])
    setSelectedCustomerId(createdCustomer.id)
    setCustomerMode('existing')
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
      return [...current, { productId: product.id, sellingPrice: product.sellingPrice, quantity: 1 }]
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
      const sellingPrice = Number(item.sellingPrice) || 0
      const quantity = Number(item.quantity) || 0
      return { product, sellingPrice, quantity, lineSubtotal: sellingPrice * quantity }
    })

    const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0)
    const rawDiscount =
      discountType === 'percentage' ? subtotal * ((Number(discountValue) || 0) / 100) : Number(discountValue) || 0
    const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal)
    const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0

    const gstAmount = lines.reduce((sum, line) => {
      if (!line.product) return sum
      return sum + line.lineSubtotal * discountRatio * (line.product.gstRate || 0)
    }, 0)

    const taxableAmount = subtotal - discountAmount
    const effectiveGstPercent = taxableAmount > 0 ? (gstAmount / taxableAmount) * 100 : 0
    const total = taxableAmount + gstAmount
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
    const discountPercentEquivalent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0

    return { subtotal, discountAmount, gstAmount, effectiveGstPercent, total, totalQuantity, discountPercentEquivalent }
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

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validateForm()) return

    const isCod = paymentMethod === 'cod' || paymentMethod === 'credit'
    const deliveryPartnerId = deliveryType === 'delivery_boy' ? deliveryBoyId : null
    const newOrder = buildOrder({
      id: `ORD-${Date.now()}`,
      orderNumber: `SO-${new Date().getFullYear()}-${1000 + seedOrders.length + 1}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      status: deliveryPartnerId ? 'Confirmed' : 'Draft',
      orderDate,
      expectedDeliveryDate: deliveryDate,
      deliveryPartnerId,
      amountPaid: isCod ? 0 : totals.total,
      discountPercent: totals.discountPercentEquivalent,
      lines: orderItems.map((item) => ({
        productId: item.productId,
        qty: Number(item.quantity) || 0,
        price: Number(item.sellingPrice) || 0,
      })),
    })

    seedOrders.unshift({
      ...newOrder,
      customerPhone: selectedCustomer.phone,
      customerEmail: selectedCustomer.email || null,
      paymentMethod,
      paymentTerms: paymentMethod === 'credit' ? paymentTerms : null,
      warehouse,
      fulfillmentType: deliveryType,
      deliveryAddress: deliveryAddress || null,
      notes: orderNotes.trim() || null,
      internalNotes: internalNotes.trim() || null,
      source: restrictToVehicleStock ? 'delivery_vehicle' : 'standard',
    })

    showToast({
      title: 'Order created',
      message: `${newOrder.orderNumber} has been created successfully.`,
    })
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
                    checked={customerMode === 'existing'}
                    onChange={() => setCustomerMode('existing')}
                    className="size-4 text-primary-600 focus:ring-primary-500"
                  />
                  Select Existing Customer
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={customerMode === 'new'}
                    onChange={() => {
                      setCustomerMode('new')
                      setShowQuickAddCustomer(true)
                    }}
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
                    placeholder="Search by name, phone, email or GSTIN..."
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
                  placeholder={customerOptions.length ? 'Select a customer' : 'No matching customer found'}
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

              <Select label="Warehouse" required options={warehouseOptions} value={warehouse} onChange={(event) => setWarehouse(event.target.value)} />

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
                <Button type="button" variant="outline" size="sm" onClick={() => setIsProductPickerOpen((current) => !current)}>
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
                              <span className="block truncate font-medium text-neutral-900">{product.fullName}</span>
                              <span className="block text-xs text-neutral-400">In Stock: {product.stock}</span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-primary-700">{formatCurrency(product.sellingPrice)}</span>
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
                      <th className="px-3 py-3">UoM</th>
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
                      const sellingPrice = Number(item.sellingPrice) || 0
                      const isLowStock = quantity > product.stock

                      return (
                        <tr key={item.productId}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {product.image ? (
                                <img src={product.image} alt="" className="size-10 shrink-0 rounded-lg border border-neutral-100 object-cover" />
                              ) : (
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                                  <Package className="size-5" aria-hidden="true" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-neutral-900">{product.fullName}</p>
                                <p className={`text-xs ${isLowStock ? 'text-red-600' : 'text-neutral-400'}`}>
                                  In Stock: {product.stock}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="inline-flex items-center rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                              {product.unit}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.sellingPrice}
                              onChange={(event) => updateOrderItem(item.productId, 'sellingPrice', event.target.value)}
                              className="h-9 w-24 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                            />
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateOrderItem(item.productId, 'quantity', Math.max(1, quantity - 1))}
                                className="flex size-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                                aria-label={`Decrease quantity of ${product.fullName}`}
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
                                aria-label={`Increase quantity of ${product.fullName}`}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-neutral-500">{formatGstPercent((product.gstRate || 0) * 100)}%</td>
                          <td className="px-3 py-3.5 text-right font-semibold text-neutral-900">
                            {formatCurrency(sellingPrice * quantity)}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeOrderItem(item.productId)}
                              className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                              aria-label={`Remove ${product.fullName}`}
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
                          if (option.value === 'takeaway') setDeliveryBoyId('')
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
                    <Select
                      options={selectedCustomer ? [{ value: selectedCustomer.address || selectedCustomer.city || '', label: selectedCustomer.address || selectedCustomer.city || 'Customer address' }] : []}
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      placeholder="Search and select address"
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
                <label className="text-sm font-medium text-neutral-700">Order Notes (Visible to Customer)</label>
                <textarea
                  value={orderNotes}
                  maxLength={250}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
                <p className="text-right text-xs text-neutral-400">{orderNotes.length} / 250</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Internal Notes (Not Visible to Customer)</label>
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Shipping / Delivery</span>
                <span className="text-sm font-medium text-neutral-900">₹0.00</span>
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

            <Button type="submit" className="mt-5 w-full" disabled={!canCreateOrder}>
              <FileCheck2 className="size-4" aria-hidden="true" />
              Create Order
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-400">You can review and edit the order before confirmation.</p>
          </div>
        </div>
      </form>

      <QuickAddCustomerModal
        isOpen={showQuickAddCustomer}
        onClose={() => {
          setShowQuickAddCustomer(false)
          setCustomerMode('existing')
        }}
        onCreated={handleCustomerCreated}
      />
    </div>
  )
}
