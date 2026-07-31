import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Plus,
  Smartphone,
  Store,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { ROLES, roleHomePath } from '../../auth/roles'
import { products } from '../../mockData/products'
import { customers as seedCustomers } from '../../mockData/customers'
import { buildOrder, orders as seedOrders } from '../../mockData/orders'
import { users } from '../../mockData/users'
import { createCustomer } from '../../api/customers'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from '../customers/CustomerForm'
import { useToast } from '../../components/ui/toastContext'

const paymentOptions = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'cod', label: 'COD', icon: Wallet },
]

const deliveryOptions = [
  { value: 'takeaway', label: 'Takeaway Order', description: 'Customer will collect the order.', icon: Store },
  { value: 'delivery_boy', label: 'Choose Delivery Boy', description: 'Assign a delivery partner for doorstep delivery.', icon: Truck },
]

const normalizeCustomerSearchValue = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, ' ')
const normalizePhone = (value = '') => String(value).replace(/\D/g, '')
const phoneMatches = (registeredPhone = '', typedPhone = '') => {
  const registered = normalizePhone(registeredPhone)
  const typed = normalizePhone(typedPhone)

  return Boolean(typed && (registered === typed || registered.endsWith(typed) || typed.endsWith(registered)))
}

export default function CreateSalesOrder() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [customerRecords, setCustomerRecords] = useState(seedCustomers)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    email: '',
  })
  const [orderItems, setOrderItems] = useState([{ productId: null, quantity: 1 }])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [deliveryType, setDeliveryType] = useState('')
  const [deliveryBoyId, setDeliveryBoyId] = useState('')
  const [errors, setErrors] = useState({})
  const [customerLookupMessage, setCustomerLookupMessage] = useState('')
  const [showCustomerPrompt, setShowCustomerPrompt] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [customerFormError, setCustomerFormError] = useState('')
  const canCreateOrder = Boolean(deliveryType && (deliveryType !== 'delivery_boy' || deliveryBoyId))

  const deliveryBoys = useMemo(
    () => users.filter((user) => user.role === ROLES.DELIVERY_PARTNER && user.status !== 'inactive'),
    [],
  )

  const salesOfficers = useMemo(
    () => users.filter((user) => user.role === ROLES.SALES_OFFICER && user.status !== 'inactive'),
    [],
  )

  const calculateItemTotal = (item) => {
    const product = products.find((p) => p.id === item.productId)
    return product ? product.sellingPrice * item.quantity : 0
  }

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const calculateGst = () => {
    return orderItems.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId)
      return sum + (product ? product.sellingPrice * item.quantity * product.gstRate : 0)
    }, 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discountAmount = (subtotal * discount) / 100
    return subtotal - discountAmount + calculateGst()
  }

  const updateCustomerField = (field, value) => {
    setCustomerDetails((current) => ({ ...current, [field]: value }))
    setSelectedCustomer(null)
    setCustomerLookupMessage('')
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const fillCustomerDetails = (customer) => {
    setSelectedCustomer(customer)
    setCustomerDetails({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
    })
    setCustomerLookupMessage(`${customer.name} found. Details filled for this order.`)
    setShowCustomerPrompt(false)
    setErrors((current) => ({ ...current, name: '', phone: '', email: '', customer: '' }))
  }

  const findExistingCustomer = (details = customerDetails) => {
    const phone = normalizePhone(details.phone)
    const email = normalizeCustomerSearchValue(details.email)
    const name = normalizeCustomerSearchValue(details.name)

    return customerRecords.find((customer) => {
      const matchesPhone = phone && phoneMatches(customer.phone, phone)
      const matchesEmail = email && normalizeCustomerSearchValue(customer.email) === email
      const matchesName = name && normalizeCustomerSearchValue(customer.name) === name
      return matchesPhone || matchesEmail || matchesName
    })
  }

  const handlePhoneNumberChange = (value) => {
    const nextDetails = { ...customerDetails, phone: value }
    const normalizedPhone = normalizePhone(value)

    setCustomerDetails(nextDetails)
    setSelectedCustomer(null)
    setCustomerLookupMessage('')
    setErrors((current) => ({ ...current, phone: '', customer: '' }))

    if (normalizedPhone.length < 10) {
      setShowCustomerPrompt(false)
      return
    }

    const existingCustomer = findExistingCustomer(nextDetails)

    if (existingCustomer) {
      fillCustomerDetails(existingCustomer)
      return
    }

    setCustomerLookupMessage('No registered customer found for this phone number.')
  }

  const handlePhoneLookupBlur = () => {
    const normalizedPhone = normalizePhone(customerDetails.phone)

    if (selectedCustomer || normalizedPhone.length < 10) return

    const existingCustomer = findExistingCustomer()

    if (existingCustomer) {
      fillCustomerDetails(existingCustomer)
      return
    }

    setShowCustomerPrompt(true)
    setCustomerLookupMessage('Customer does not exist. Add this customer before creating the order.')
  }

  const handleOpenCustomerForm = () => {
    setCustomerFormError('')
    setShowCustomerPrompt(false)
    setShowCustomerForm(true)
  }

  const handleCloseCustomerForm = () => {
    setCustomerFormError('')
    setShowCustomerForm(false)
  }

  const handleSaveNewCustomer = async (customerData) => {
    setIsSavingCustomer(true)
    setCustomerFormError('')

    const result = await createCustomer(customerData)

    if (!result.success) {
      setCustomerFormError(result.error)
      setIsSavingCustomer(false)
      return
    }

    const createdCustomer = {
      ...customerData,
      ...result.customer,
      id: result.customer.id,
      name: result.customer.name || customerData.name,
      phone: result.customer.phone || customerData.phone,
      email: result.customer.email || customerData.email,
      type: result.customer.category || customerData.type,
      assignedSalesOfficerId: result.customer.assigned_sales_officer_id || customerData.assignedSalesOfficerId,
    }

    setCustomerRecords((current) => [createdCustomer, ...current])
    fillCustomerDetails(createdCustomer)
    setIsSavingCustomer(false)
    setShowCustomerForm(false)
  }

  const handleAddItem = () => {
    setOrderItems([...orderItems, { productId: null, quantity: 1 }])
  }

  const handleRemoveItem = (index) => {
    if (orderItems.length === 1) return
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems]
    newItems[index][field] = value
    setOrderItems(newItems)
    setErrors((current) => ({ ...current, items: '' }))
  }

  const validateForm = () => {
    const nextErrors = {}
    const email = customerDetails.email.trim()

    if (!customerDetails.name.trim()) nextErrors.name = 'Customer name is required.'
    if (!customerDetails.phone.trim()) nextErrors.phone = 'Phone number is required.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!selectedCustomer) nextErrors.customer = 'Check the customer first. If they do not exist, add them from the popup.'
    if (orderItems.some((item) => !item.productId || Number(item.quantity) < 1)) {
      nextErrors.items = 'Select every product and keep quantity at least 1.'
    }
    if (!paymentMethod) nextErrors.paymentMethod = 'Select a payment method.'
    if (paymentMethod && !deliveryType) nextErrors.deliveryType = 'Select a delivery option.'
    if (deliveryType === 'delivery_boy' && !deliveryBoyId) nextErrors.deliveryBoyId = 'Choose a delivery boy.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validateForm()) return

    const total = calculateTotal()
    const isCod = paymentMethod === 'cod'
    const deliveryPartnerId = deliveryType === 'delivery_boy' ? deliveryBoyId : null
    const newOrder = buildOrder({
      id: `ORD-${Date.now()}`,
      orderNumber: `SO-${new Date().getFullYear()}-${1000 + seedOrders.length + 1}`,
      customerId: selectedCustomer.id,
      customerName: customerDetails.name.trim(),
      status: deliveryPartnerId ? 'Confirmed' : 'Draft',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: deliveryPartnerId ? new Date().toISOString().slice(0, 10) : null,
      deliveryPartnerId,
      amountPaid: isCod ? 0 : total,
      discountPercent: discount,
      lines: orderItems.map((item) => ({ productId: item.productId, qty: item.quantity })),
    })

    seedOrders.unshift({
      ...newOrder,
      customerPhone: customerDetails.phone.trim(),
      customerEmail: customerDetails.email.trim() || null,
      paymentMethod,
      fulfillmentType: deliveryType,
    })

    showToast({
      title: 'Order created',
      message: `${newOrder.orderNumber} has been created successfully.`,
    })
    navigate(currentUser?.role === ROLES.ADMIN ? '/admin/orders' : roleHomePath[currentUser?.role] || '/')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Create Sales Order</h1>
        <p className="text-sm text-neutral-500">Add customer details, items, payment, and delivery preference.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="space-y-6">
          <Card>
            <div className="space-y-5 p-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Customer Details</h3>
                <p className="mt-1 text-sm text-neutral-500">Check whether the customer exists before continuing the order.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                
                <Input
                  label="Phone Number"
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(event) => handlePhoneNumberChange(event.target.value)}
                  onBlur={handlePhoneLookupBlur}
                  error={errors.phone}
                  required
                />

                <Input
                  label="Customer Name"
                  value={customerDetails.name}
                  onChange={(event) => updateCustomerField('name', event.target.value)}
                  error={errors.name}
                  required
                />
                
                <Input
                  label="Email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(event) => updateCustomerField('email', event.target.value)}
                  error={errors.email}
                  placeholder="Optional"
                  className="lg:col-span-2"
                />
              </div>
              <div>
                {customerLookupMessage && (
                  <p className={`text-sm ${selectedCustomer ? 'text-primary-700' : 'text-amber-700'}`}>
                    {customerLookupMessage}
                  </p>
                )}
                {errors.customer && <p className="text-sm text-red-600">{errors.customer}</p>}
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-neutral-900">Order Items</h3>
                <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-4">
                {orderItems.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId)
                  const isLowStock = product && item.quantity > product.stock
                  return (
                    <div key={index} className="rounded-xl bg-neutral-50 p-4">
                      <div className="grid grid-cols-12 items-end gap-3">
                        <div className="col-span-12 md:col-span-6">
                          <label className="mb-1 block text-xs font-medium text-neutral-600">Product</label>
                          <select
                            value={item.productId || ''}
                            onChange={(event) => handleItemChange(index, 'productId', event.target.value)}
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          >
                            <option value="">-- Select --</option>
                            {products.map((prod) => (
                              <option key={prod.id} value={prod.id}>{prod.fullName} ({formatCurrency(prod.sellingPrice)})</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-6 md:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-neutral-600">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, 'quantity', Number(event.target.value))}
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-900">
                            {formatCurrency(calculateItemTotal(item))}
                          </div>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={orderItems.length === 1}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {product && (
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {isLowStock ? <AlertCircle className="size-3" aria-hidden="true" /> : <CheckCircle className="size-3" aria-hidden="true" />}
                            Stock: {product.stock} {isLowStock ? '(Low!)' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <div className="space-y-5 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Payment</h3>
                  <p className="mt-1 text-sm text-neutral-500">Choose how the customer will pay.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = paymentMethod === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(option.value)
                          setErrors((current) => ({ ...current, paymentMethod: '', deliveryType: '' }))
                        }}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all focus:outline-none focus:ring-4 focus:ring-primary-500/12 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-800'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-200 hover:bg-primary-50/50'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {errors.paymentMethod && <p className="text-sm text-red-600">{errors.paymentMethod}</p>}
              </div>
            </Card>

            <Card>
              <div className="space-y-5 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Delivery</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {paymentMethod ? 'Select takeaway or assign a delivery boy.' : 'Select payment first, then choose delivery.'}
                  </p>
                </div>
                <div className="space-y-3">
                  {deliveryOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = deliveryType === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!paymentMethod}
                        onClick={() => {
                          setDeliveryType(option.value)
                          if (option.value === 'takeaway') setDeliveryBoyId('')
                          setErrors((current) => ({ ...current, deliveryType: '', deliveryBoyId: '' }))
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/50'
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
                {deliveryType === 'delivery_boy' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Delivery Boy</label>
                    <select
                      value={deliveryBoyId}
                      onChange={(event) => {
                        setDeliveryBoyId(event.target.value)
                        setErrors((current) => ({ ...current, deliveryBoyId: '' }))
                      }}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                    >
                      <option value="">-- Choose delivery boy --</option>
                      {deliveryBoys.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    {errors.deliveryBoyId && <p className="text-sm text-red-600">{errors.deliveryBoyId}</p>}
                  </div>
                )}
                {errors.deliveryType && <p className="text-sm text-red-600">{errors.deliveryType}</p>}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <div className="space-y-6 p-6">
              <h3 className="text-lg font-semibold text-neutral-900">Order Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Subtotal</span>
                  <span className="text-sm font-medium text-neutral-900">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(event) => setDiscount(Number(event.target.value))}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                  />
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Discount</span>
                    <span className="text-sm font-medium text-red-600">-{formatCurrency((calculateSubtotal() * discount) / 100)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">GST</span>
                  <span className="text-sm font-medium text-neutral-900">{formatCurrency(calculateGst())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Payment</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {paymentOptions.find((option) => option.value === paymentMethod)?.label || 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Delivery</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {deliveryOptions.find((option) => option.value === deliveryType)?.label || 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                  <span className="text-base font-semibold text-neutral-900">Total</span>
                  <span className="text-2xl font-bold text-primary-700">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!canCreateOrder}>
                Create Order
              </Button>
            </div>
          </Card>
        </div>
      </form>

      {showCustomerPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm"
          onClick={() => setShowCustomerPrompt(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-not-found-title"
            className="w-full max-w-md rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-popover)"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="customer-not-found-title" className="text-base font-semibold text-neutral-900">
              Customer Not Found
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              This customer does not exist yet. Add the customer profile first, then the details will be filled into this order.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setShowCustomerPrompt(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleOpenCustomerForm}>
                Add Customer
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCustomerForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 p-4 backdrop-blur-sm"
          onClick={handleCloseCustomerForm}
        >
          <div className="mx-auto my-6 max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <CustomerForm
              isOpen={showCustomerForm}
              onClose={handleCloseCustomerForm}
              customer={null}
              initialCustomer={{
                name: customerDetails.name,
                phone: customerDetails.phone,
                email: customerDetails.email,
              }}
              onSave={handleSaveNewCustomer}
              salesOfficers={salesOfficers}
              currentUser={currentUser}
              saving={isSavingCustomer}
              formError={customerFormError}
            />
          </div>
        </div>
      )}
    </div>
  )
}
