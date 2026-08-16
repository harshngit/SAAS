import { Fragment, useEffect, useMemo, useState } from 'react'
import { FileText, PackageSearch, ReceiptText, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { createQuotation } from '../../api/quotations'
import { listCustomers } from '../../api/customers'
import { listProducts } from '../../api/products'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'

const today = new Date().toISOString().slice(0, 10)

const emptyItem = {
  productId: '',
  variantId: '',
  productName: '',
  sku: '',
  uom: '',
  quantity: '',
  unitPrice: '',
  discount: '',
  taxRate: '',
}

const emptyQuotation = {
  quotationDate: today,
  validUntil: '',
  customerId: '',
  billingAddress: '',
  shippingAddress: '',
  salespersonId: '',
  currency: 'INR',
  paymentTerms: '',
  deliveryTerms: '',
  notes: '',
  termsConditions: '',
  items: [{ ...emptyItem }],
}

const currencyOptions = ['INR', 'USD', 'AED', 'SGD', 'GBP'].map((value) => ({ value, label: value }))
const paymentTermOptions = ['Net 15', 'Net 30', 'Advance', 'Immediate', 'Due on Receipt'].map((value) => ({ value, label: value }))
const deliveryTermOptions = ['Standard delivery', 'Express delivery', 'Customer pickup', 'Delivery within 2 business days'].map((value) => ({ value, label: value }))
const uomOptions = ['unit', 'jar', 'case (24)', 'case (12)', 'box', 'pack', 'piece'].map((value) => ({ value, label: value }))
const taxOptions = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

function calculateLineTotal(item) {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.taxRate) || 0
  const subtotal = quantity * unitPrice
  const discounted = subtotal - subtotal * (discount / 100)
  return discounted + discounted * (tax / 100)
}

function QuotationField({ children, className = '' }) {
  return <div className={className}>{children}</div>
}

export default function QuotationFormPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const basePath = currentUser?.role === ROLES.SALES_OFFICER ? '/sales/quotations' : '/admin/quotations'

  const [formData, setFormData] = useState(() => ({
    ...emptyQuotation,
    salespersonId: currentUser?.role === ROLES.SALES_OFFICER ? currentUser.id : '',
  }))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState('quotation-details')

  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [customersResult, productsResult, usersResult] = await Promise.all([
        listCustomers(),
        listProducts(),
        listUsers(),
      ])

      if (!isMounted) return

      if (customersResult.success) setCustomers(customersResult.customers)
      if (productsResult.success) setProducts(productsResult.products)
      if (usersResult.success) {
        setSalespeople(
          usersResult.users
            .map(normalizeApiUser)
            .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
        )
      }

      setIsLoadingOptions(false)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const formSections = [
    {
      id: 'quotation-details',
      title: 'Quotation Details',
      description: 'Dates, customer, and sales ownership.',
      icon: ReceiptText,
      fields: ['quotationDate', 'validUntil', 'customerId', 'billingAddress', 'shippingAddress', 'salespersonId', 'currency'],
    },
    {
      id: 'terms-details',
      title: 'Terms Details',
      description: 'Payment, delivery, notes, and printed terms.',
      icon: FileText,
      fields: ['paymentTerms', 'deliveryTerms', 'notes', 'termsConditions'],
    },
    {
      id: 'quotation-items',
      title: 'Quotation Items',
      description: 'Products, quantities, pricing, tax, and line totals.',
      icon: PackageSearch,
      fields: ['items'],
    },
  ]

  const activeFormSection = formSections.find((section) => section.id === activeSection) || formSections[0]
  const activeSectionIndex = formSections.findIndex((section) => section.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === formSections.length - 1

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}`, customer })),
    [customers],
  )
  const salespersonOptions = useMemo(() => salespeople.map((user) => ({ value: user.id, label: user.name })), [salespeople])
  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name, product })),
    [products],
  )

  const quotationTotal = useMemo(
    () => formData.items.reduce((total, item) => total + calculateLineTotal(item), 0),
    [formData.items],
  )

  const updateField = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value }

      if (field === 'customerId') {
        const selectedCustomer = customerOptions.find((option) => option.value === value)?.customer
        if (selectedCustomer) {
          next.billingAddress = selectedCustomer.billingAddress || next.billingAddress
          next.shippingAddress = selectedCustomer.shippingAddress || selectedCustomer.billingAddress || next.shippingAddress
        }
      }

      return next
    })
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const updateItem = (index, field, value) => {
    setFormData((current) => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        const nextItem = { ...item, [field]: value }

        if (field === 'productId') {
          const selectedProduct = productOptions.find((option) => option.value === value)?.product
          if (selectedProduct) {
            nextItem.productName = selectedProduct.name
            nextItem.sku = selectedProduct.sku || ''
            nextItem.unitPrice = selectedProduct.price ?? ''
            nextItem.taxRate = selectedProduct.tax_rate ?? ''
            nextItem.variantId = ''
          }
        }

        return nextItem
      })

      return { ...current, items }
    })
    setErrors((current) => ({ ...current, items: '' }))
  }

  const addItem = () => {
    setFormData((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }))
  }

  const removeItem = (index) => {
    setFormData((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.customerId) nextErrors.customerId = 'Customer is required.'
    if (!formData.salespersonId) nextErrors.salespersonId = 'Salesperson is required.'
    if (!formData.currency) nextErrors.currency = 'Currency is required.'

    const hasInvalidItem = formData.items.some((item) => (
      !item.productId ||
      !item.quantity ||
      Number(item.quantity) <= 0 ||
      item.unitPrice === '' ||
      Number(item.unitPrice) < 0
    ))
    if (hasInvalidItem) nextErrors.items = 'Each item needs a product, quantity, and unit price.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError('')

    const result = await createQuotation(formData)

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    navigate(basePath)
  }

  const goToPreviousSection = () => {
    if (isFirstSection) return
    setActiveSection(formSections[activeSectionIndex - 1].id)
  }

  const goToNextSection = () => {
    if (isLastSection) return
    setActiveSection(formSections[activeSectionIndex + 1].id)
  }

  const renderField = (field) => {
    if (field === 'quotationDate') return <Input label="Quotation Date" type="date" value={formData.quotationDate} onChange={(event) => updateField(field, event.target.value)} required error={errors.quotationDate} />
    if (field === 'validUntil') return <Input label="Valid Until" type="date" value={formData.validUntil} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'customerId') return <Select label="Customer" options={customerOptions} value={formData.customerId} onChange={(event) => updateField(field, event.target.value)} required placeholder={isLoadingOptions ? 'Loading...' : 'Select customer'} error={errors.customerId} disabled={isLoadingOptions} />
    if (field === 'billingAddress') return <Input label="Billing Address" value={formData.billingAddress} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'shippingAddress') return <Input label="Shipping Address" value={formData.shippingAddress} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'salespersonId') return <Select label="Salesperson" options={salespersonOptions} value={formData.salespersonId} onChange={(event) => updateField(field, event.target.value)} required placeholder={isLoadingOptions ? 'Loading...' : 'Select salesperson'} error={errors.salespersonId} disabled={isLoadingOptions} />
    if (field === 'currency') return <Select label="Currency" options={currencyOptions} value={formData.currency} onChange={(event) => updateField(field, event.target.value)} required error={errors.currency} />
    if (field === 'paymentTerms') return <Select label="Payment Terms" options={paymentTermOptions} value={formData.paymentTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select payment terms" />
    if (field === 'deliveryTerms') return <Select label="Delivery Terms" options={deliveryTermOptions} value={formData.deliveryTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select delivery terms" />
    if (field === 'notes') return <Input as="textarea" label="Notes" value={formData.notes} onChange={(event) => updateField(field, event.target.value)} placeholder="Internal remarks" />
    if (field === 'termsConditions') return <Input as="textarea" label="Terms & Conditions" value={formData.termsConditions} onChange={(event) => updateField(field, event.target.value)} placeholder="Terms printed on quotation" />

    return (
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Quotation Items</p>
            <p className="mt-1 text-xs text-neutral-400">Add products for this estimate.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {formData.items.map((item, index) => (
            <div key={index} className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-900">Item {index + 1}</p>
                <Button type="button" variant="ghost" size="sm" disabled={formData.items.length === 1} onClick={() => removeItem(index)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Select label="Product" required options={productOptions} value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)} placeholder={isLoadingOptions ? 'Loading...' : 'Select product'} disabled={isLoadingOptions} />
                <Input label="SKU" value={item.sku} disabled placeholder="Auto-filled product code" />
                <Input label="Quantity" required type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                <Select label="UOM" options={uomOptions} value={item.uom} onChange={(event) => updateItem(index, 'uom', event.target.value)} placeholder="Select UOM" />
                <Input label="Unit Price" required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} />
                <Input label="Discount (%)" type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} />
                <Select label="Tax (%)" options={taxOptions} value={String(item.taxRate ?? '')} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} placeholder="Select tax" />
                <Input label="Line Total" value={formatCurrency(calculateLineTotal(item))} disabled />
              </div>
            </div>
          ))}
        </div>
        {errors.items && <p className="mt-3 text-xs text-red-600">{errors.items}</p>}
        <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
          <div className="rounded-xl bg-primary-50 px-4 py-3 text-right">
            <p className="text-xs font-medium text-primary-700">Quotation Total</p>
            <p className="mt-1 text-xl font-semibold text-primary-900">{formatCurrency(quotationTotal)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
    >
      <div className="grid min-h-[34rem]" style={{ gridTemplateColumns: '18rem minmax(0, 1fr)' }}>
        <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <nav className="sticky top-6 flex flex-col gap-3">
            {formSections.map((section) => {
              const Icon = section.icon
              const isActive = section.id === activeSection

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-neutral-200'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.title}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{activeFormSection.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeFormSection.description}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(basePath)}>
              Back to Quotations
            </Button>
          </div>

          {submitError && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}

          <section className="flex-1 border-b border-neutral-100 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeFormSection.fields.map((field) => (
                <Fragment key={field}>
                  <QuotationField className={['notes', 'termsConditions', 'items'].includes(field) ? 'lg:col-span-2' : ''}>
                    {renderField(field)}
                  </QuotationField>
                </Fragment>
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={goToPreviousSection} disabled={isFirstSection}>
              Back
            </Button>
            {isLastSection ? (
              <Button type="submit" loading={isSubmitting}>
                Save Quotation
              </Button>
            ) : (
              <Button type="button" onClick={goToNextSection}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
