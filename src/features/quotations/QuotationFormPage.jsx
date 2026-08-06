import { Fragment, useMemo, useState } from 'react'
import { FileText, PackageSearch, ReceiptText, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { customers as seedCustomers } from '../../mockData/customers'
import { products as seedProducts } from '../../mockData/products'
import { quotations as seedQuotations } from '../../mockData/quotations'
import { users as seedUsers } from '../../mockData/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import { readStoredQuotations, saveStoredQuotation } from './quotationStorage'

const today = new Date().toISOString().slice(0, 10)

const emptyItem = {
  product: '',
  sku: '',
  description: '',
  quantity: '',
  uom: '',
  unitPrice: '',
  discount: '',
  tax: '',
}

const emptyQuotation = {
  id: '',
  quotationDate: today,
  validUntil: '',
  customer: '',
  billingAddress: '',
  shippingAddress: '',
  salesperson: '',
  currency: 'INR',
  paymentTerms: '',
  deliveryTerms: '',
  notes: '',
  terms: '',
  status: 'Draft',
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

const formSections = [
  {
    id: 'quotation-details',
    title: 'Quotation Details',
    description: 'Quotation number, dates, customer, and sales ownership.',
    icon: ReceiptText,
    fields: ['id', 'quotationDate', 'validUntil', 'customer', 'billingAddress', 'shippingAddress', 'salesperson', 'currency'],
  },
  {
    id: 'terms-details',
    title: 'Terms Details',
    description: 'Payment, delivery, notes, and printed terms.',
    icon: FileText,
    fields: ['paymentTerms', 'deliveryTerms', 'notes', 'terms'],
  },
  {
    id: 'quotation-items',
    title: 'Quotation Items',
    description: 'Products, quantities, pricing, tax, and line totals.',
    icon: PackageSearch,
    fields: ['items'],
  },
]

function makeQuotationNumber() {
  const allQuotations = [...readStoredQuotations(), ...seedQuotations]
  const nextNumber = allQuotations.reduce((highest, quotation) => {
    const number = Number(String(quotation.id || '').replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(highest, number) : highest
  }, 20261000) + 1

  return `QT-${new Date().getFullYear()}-${String(nextNumber).slice(-4)}`
}

function calculateLineTotal(item) {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.tax) || 0
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
  const [formData, setFormData] = useState(() => ({ ...emptyQuotation, id: makeQuotationNumber() }))
  const [errors, setErrors] = useState({})
  const [activeSection, setActiveSection] = useState(formSections[0].id)

  const activeFormSection = formSections.find((section) => section.id === activeSection) || formSections[0]
  const activeSectionIndex = formSections.findIndex((section) => section.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === formSections.length - 1

  const customerOptions = useMemo(
    () => seedCustomers.map((customer) => ({ value: customer.name, label: customer.name, customer })),
    [],
  )

  const salespersonOptions = useMemo(() => {
    const names = seedUsers
      .filter((user) => user.role === ROLES.SALES_OFFICER)
      .map((user) => user.name)

    if (currentUser?.role === ROLES.SALES_OFFICER && currentUser?.name && !names.includes(currentUser.name)) {
      names.unshift(currentUser.name)
    }

    return names.map((name) => ({ value: name, label: name }))
  }, [currentUser])

  const productOptions = useMemo(
    () => seedProducts.map((product) => ({ value: product.fullName || product.name, label: product.fullName || product.name, product })),
    [],
  )

  const quotationTotal = useMemo(
    () => formData.items.reduce((total, item) => total + calculateLineTotal(item), 0),
    [formData.items],
  )

  const updateField = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value }

      if (field === 'customer') {
        const selectedCustomer = customerOptions.find((option) => option.value === value)?.customer
        if (selectedCustomer) {
          next.billingAddress = selectedCustomer.city ? `${selectedCustomer.name}, ${selectedCustomer.city}` : selectedCustomer.name
          next.shippingAddress = next.billingAddress
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

        if (field === 'product') {
          const selectedProduct = productOptions.find((option) => option.value === value)?.product
          if (selectedProduct) {
            nextItem.sku = selectedProduct.id
            nextItem.description = selectedProduct.fullName || selectedProduct.name
            nextItem.uom = selectedProduct.unit || 'unit'
            nextItem.unitPrice = selectedProduct.sellingPrice || ''
            nextItem.tax = selectedProduct.gstRate ? String(Number(selectedProduct.gstRate) * 100) : ''
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

    if (!formData.id) nextErrors.id = 'Quotation number is required.'
    if (!formData.quotationDate) nextErrors.quotationDate = 'Quotation date is required.'
    if (!formData.validUntil) nextErrors.validUntil = 'Valid until date is required.'
    if (!formData.customer) nextErrors.customer = 'Customer is required.'
    if (!formData.billingAddress.trim()) nextErrors.billingAddress = 'Billing address is required.'
    if (!formData.salesperson) nextErrors.salesperson = 'Salesperson is required.'
    if (!formData.currency) nextErrors.currency = 'Currency is required.'

    const hasInvalidItem = formData.items.some((item) => (
      !item.product ||
      !item.quantity ||
      !item.uom ||
      !item.unitPrice ||
      Number(item.quantity) <= 0 ||
      Number(item.unitPrice) < 0
    ))
    if (hasInvalidItem) nextErrors.items = 'Each item needs product, quantity, UOM, and unit price.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    saveStoredQuotation({
      ...formData,
      items: formData.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discount) || 0,
        tax: Number(item.tax) || 0,
      })),
    })

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
    if (field === 'id') return <Input label="Quotation Number" value={formData.id} disabled required error={errors.id} />
    if (field === 'quotationDate') return <Input label="Quotation Date" type="date" value={formData.quotationDate} onChange={(event) => updateField(field, event.target.value)} required error={errors.quotationDate} />
    if (field === 'validUntil') return <Input label="Valid Until" type="date" value={formData.validUntil} onChange={(event) => updateField(field, event.target.value)} required error={errors.validUntil} />
    if (field === 'customer') return <Select label="Customer" options={customerOptions} value={formData.customer} onChange={(event) => updateField(field, event.target.value)} required placeholder="Select customer" error={errors.customer} />
    if (field === 'billingAddress') return <Input label="Billing Address" value={formData.billingAddress} onChange={(event) => updateField(field, event.target.value)} required error={errors.billingAddress} />
    if (field === 'shippingAddress') return <Input label="Shipping Address" value={formData.shippingAddress} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'salesperson') return <Select label="Salesperson" options={salespersonOptions} value={formData.salesperson} onChange={(event) => updateField(field, event.target.value)} required placeholder="Select salesperson" error={errors.salesperson} />
    if (field === 'currency') return <Select label="Currency" options={currencyOptions} value={formData.currency} onChange={(event) => updateField(field, event.target.value)} required error={errors.currency} />
    if (field === 'paymentTerms') return <Select label="Payment Terms" options={paymentTermOptions} value={formData.paymentTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select payment terms" />
    if (field === 'deliveryTerms') return <Select label="Delivery Terms" options={deliveryTermOptions} value={formData.deliveryTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select delivery terms" />
    if (field === 'notes') return <Input as="textarea" label="Notes" value={formData.notes} onChange={(event) => updateField(field, event.target.value)} placeholder="Internal remarks" />
    if (field === 'terms') return <Input as="textarea" label="Terms & Conditions" value={formData.terms} onChange={(event) => updateField(field, event.target.value)} placeholder="Terms printed on quotation" />

    return (
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Quotation Items</p>
            <p className="mt-1 text-xs text-neutral-400">Add products or services for this estimate.</p>
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
                <Select label="Product" required options={productOptions} value={item.product} onChange={(event) => updateItem(index, 'product', event.target.value)} placeholder="Select product or service" />
                <Input label="SKU" value={item.sku} onChange={(event) => updateItem(index, 'sku', event.target.value)} placeholder="Auto-filled product code" />
                <Input as="textarea" label="Description" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} placeholder="Product description" className="lg:col-span-2" />
                <Input label="Quantity" required type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                <Select label="UOM" required options={uomOptions} value={item.uom} onChange={(event) => updateItem(index, 'uom', event.target.value)} placeholder="Select UOM" />
                <Input label="Unit Price" required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} />
                <Input label="Discount (%)" type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} />
                <Select label="Tax (%)" options={taxOptions} value={String(item.tax)} onChange={(event) => updateItem(index, 'tax', event.target.value)} placeholder="Select tax" />
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

          <section className="flex-1 border-b border-neutral-100 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeFormSection.fields.map((field) => (
                <Fragment key={field}>
                  <QuotationField className={['notes', 'terms', 'items'].includes(field) ? 'lg:col-span-2' : ''}>
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
              <Button type="submit">
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
