import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  HandCoins,
  IdCard,
  Info,
  Mail,
  Package,
  PackageSearch,
  Save,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { listProducts } from '../../api/products'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { formatCurrency } from '../../utils/format'
import { getDemoSupplierProductNames, getProductId } from './supplierProductUtils'
import { PAYMENT_TERMS_OPTIONS } from './supplierUtils'
import { demoProducts } from './supplierDemoData'

const gstNumberPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Supplier TYPE (what kind of entity this is) - the backend's single `category` string field is
// used to store this, since it's the only classification slot the Supplier model has.
const SUPPLIER_TYPE_OPTIONS = ['Company', 'Individual', 'Manufacturer', 'Distributor', 'Wholesaler', 'Retailer', 'Service Provider', 'Other']
// Supplier CATEGORY (what business categories they operate in) - a DIFFERENT concept from
// Supplier Type. There is no backend field for this yet (Supplier only has one `category`
// string, already spent on Type above), so this is demo-only / BACKEND LATER for real suppliers.
const SUPPLIER_CATEGORY_OPTIONS = ['Raw Material', 'Packaging', 'Service', 'Transport', 'Maintenance', 'Contractor', 'Other']
const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound Sterling' },
]

const emptyForm = {
  name: '',
  contactPerson: '',
  category: '',
  phone: '',
  email: '',
  gstNumber: '',
  city: '',
  address: '',
  openingBalance: '',
  status: 'active',
  gstRegistered: false,
  pan: '',
  state: '',
  pinCode: '',
  country: 'India',
  paymentTerms: '30',
  creditLimit: '',
  purchaseCurrency: 'INR',
  productsSupplied: [],
  supplierCategories: [],
}

// -----------------------------------------------------------------------------
// Small presentational-only building blocks for this page. None of them change what
// data is collected or how it is validated/saved - they only affect layout and styling.
// -----------------------------------------------------------------------------

function FormSection({ number, icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {number}
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// A compact chip multi-select for short, fixed option lists (Supplier Category). Not a
// searchable picker like Products Supplied - just toggleable pills.
function MultiToggleField({ label, value, options, onChange, helper }) {
  const toggle = (option) => {
    onChange(value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option])
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-neutral-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {helper && <p className="mt-1.5 text-xs text-neutral-400">{helper}</p>}
    </div>
  )
}

function SegmentedField({ label, value, options, onChange }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-neutral-700">{label}</p>
      <div className="flex rounded-xl bg-neutral-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              value === option.value ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Phone / Email get a purely decorative leading affix (country-dial pill / mail icon) - the
// underlying value stored in formData.phone / formData.email is untouched by this.
function PhoneField({ value, onChange, error }) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">
        Phone<span className="text-red-500"> *</span>
      </label>
      <div
        className={`mt-1.5 flex overflow-hidden rounded-xl border bg-neutral-50 transition-all focus-within:bg-white focus-within:ring-4 ${
          error ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-500/15' : 'border-neutral-200 focus-within:border-primary-400 focus-within:ring-primary-500/12'
        }`}
      >
        <span className="flex items-center gap-1.5 border-r border-neutral-200 bg-neutral-100/70 px-3 text-sm text-neutral-500">
          🇮🇳 +91
        </span>
        <input
          type="tel"
          required
          value={value}
          onChange={onChange}
          placeholder="Enter phone number"
          className="w-full bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function EmailField({ value, onChange, error }) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">
        Email<span className="text-red-500"> *</span>
      </label>
      <div className="relative mt-1.5">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          type="email"
          required
          value={value}
          onChange={onChange}
          placeholder="name@example.com"
          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15' : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          }`}
        />
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function CurrencyField({ label, value, onChange, error, helper }) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">₹</span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value}
          onChange={onChange}
          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-8 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15' : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          }`}
        />
      </div>
      {helper && !error && <p className="mt-1.5 text-xs text-neutral-400">{helper}</p>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function SummaryRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-neutral-500">
        <Icon className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-neutral-900">{children}</span>
    </div>
  )
}

export default function SupplierForm({
  isOpen,
  onClose,
  supplier,
  onSave,
  saving = false,
  formError = '',
  categoryOptions = [],
}) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFormData({
      ...emptyForm,
      ...supplier,
      gstRegistered: supplier?.gstRegistered ?? Boolean(supplier?.gstNumber),
      productsSupplied: supplier?.productsSupplied || [],
      supplierCategories: supplier?.supplierCategories || [],
    })
    setErrors({})
  }, [isOpen, supplier])

  useEffect(() => {
    if (!isOpen) return
    if (DEMO_MODE && !DEMO_EMPTY) {
      setProducts(demoProducts)
      return
    }

    listProducts().then((result) => {
      if (result.success) setProducts(result.products)
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !DEMO_MODE || DEMO_EMPTY || formData.productsSupplied.length > 0) return
    const demoNames = getDemoSupplierProductNames(formData.name)
    if (demoNames.length === 0) return
    const demoProducts = products.filter((product) => demoNames.some((name) => name.toLowerCase() === product.name?.trim().toLowerCase()))
    if (demoProducts.length > 0) {
      setFormData((current) => ({ ...current, productsSupplied: demoProducts.map((product) => ({ id: product.id, name: product.name })) }))
    }
  }, [formData.name, formData.productsSupplied.length, isOpen, products])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    return products.filter((product) => !query || `${product.name} ${product.sku || ''}`.toLowerCase().includes(query))
  }, [productSearch, products])

  if (!isOpen) return null

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.name.trim()) nextErrors.name = 'Supplier name is required.'
    if (!formData.category) nextErrors.category = 'Supplier type is required.'
    if (!formData.contactPerson.trim()) nextErrors.contactPerson = 'Contact person is required.'
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required.'
    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (formData.gstRegistered && !formData.gstNumber.trim()) nextErrors.gstNumber = 'GSTIN is required when GST is registered.'
    if (formData.gstRegistered && formData.gstNumber && !gstNumberPattern.test(formData.gstNumber.trim().toUpperCase())) {
      nextErrors.gstNumber = 'Enter a valid GST number.'
    }
    if (!formData.address.trim()) nextErrors.address = 'Address is required.'
    if (!formData.city.trim()) nextErrors.city = 'City is required.'
    if (formData.openingBalance !== '' && Number(formData.openingBalance) < 0) nextErrors.openingBalance = 'Amount cannot be negative.'
    if (formData.creditLimit !== '' && Number(formData.creditLimit) < 0) nextErrors.creditLimit = 'Amount cannot be negative.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    onSave({
      ...formData,
      gstNumber: formData.gstRegistered && formData.gstNumber ? formData.gstNumber.trim().toUpperCase() : null,
      city: formData.city.trim(),
      openingBalance: Number(formData.openingBalance) || 0,
      creditLimit: formData.creditLimit === '' ? null : Number(formData.creditLimit),
    })
  }

  const selectedProductIds = new Set(formData.productsSupplied.map(getProductId))
  const toggleProduct = (product) => {
    const productId = product.id
    setFormData((current) => ({
      ...current,
      productsSupplied: selectedProductIds.has(productId)
        ? current.productsSupplied.filter((entry) => getProductId(entry) !== productId)
        : [...current.productsSupplied, { id: productId, name: product.name }],
    }))
  }

  const paymentTermsLabel = PAYMENT_TERMS_OPTIONS.find((option) => option.value === formData.paymentTerms)?.label || '—'
  const purchaseCurrencyLabel = CURRENCY_OPTIONS.find((option) => option.value === formData.purchaseCurrency)?.label || '—'
  const isEditing = Boolean(supplier)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
            <button type="button" onClick={onClose} className="font-medium text-primary-600 hover:underline">
              Suppliers
            </button>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</h1>
          <p className="mt-1 text-sm text-neutral-500">Enter supplier details, tax information, terms and products.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Suppliers
        </Button>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500">
        <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <p>Enter supplier details, commercial terms, and products supplied.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <FormSection number="1" icon={IdCard} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Supplier Name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} error={errors.name} required />
              <Input label="Contact Person" value={formData.contactPerson} onChange={(event) => updateField('contactPerson', event.target.value)} error={errors.contactPerson} required />
              <Select
                label="Supplier Type"
                options={[...SUPPLIER_TYPE_OPTIONS, ...categoryOptions.filter((option) => !SUPPLIER_TYPE_OPTIONS.includes(option))].map((option) => ({ value: option, label: option }))}
                value={formData.category}
                onChange={(event) => updateField('category', event.target.value)}
                placeholder="Select supplier type"
                error={errors.category}
                required
              />
              <PhoneField value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} error={errors.phone} />
              <EmailField value={formData.email} onChange={(event) => updateField('email', event.target.value)} error={errors.email} />
              <Select
                label="Status"
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                value={formData.status}
                onChange={(event) => updateField('status', event.target.value)}
              />
            </div>
            <div className="mt-4">
              <MultiToggleField
                label="Supplier Category"
                value={formData.supplierCategories}
                options={SUPPLIER_CATEGORY_OPTIONS}
                onChange={(value) => setFormData((current) => ({ ...current, supplierCategories: value }))}
                helper="Business categories this supplier operates in - different from Supplier Type above."
              />
            </div>
          </FormSection>

          <FormSection number="2" icon={ShieldCheck} title="Tax & Location">
            <div className="space-y-4">
              <SegmentedField
                label="GST Registered?"
                value={formData.gstRegistered ? 'yes' : 'no'}
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                onChange={(value) => setFormData((current) => ({ ...current, gstRegistered: value === 'yes', gstNumber: value === 'yes' ? current.gstNumber : '' }))}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {formData.gstRegistered && (
                  <Input label="GSTIN" value={formData.gstNumber} onChange={(event) => updateField('gstNumber', event.target.value.toUpperCase())} error={errors.gstNumber} required />
                )}
                <Input label="PAN" value={formData.pan} onChange={(event) => updateField('pan', event.target.value.toUpperCase())} />
              </div>
              <Input label="Address" as="textarea" value={formData.address} onChange={(event) => updateField('address', event.target.value)} error={errors.address} required />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="City" value={formData.city} onChange={(event) => updateField('city', event.target.value)} error={errors.city} required />
                <Input label="State" value={formData.state} onChange={(event) => updateField('state', event.target.value)} />
                <Input label="PIN Code" value={formData.pinCode} onChange={(event) => updateField('pinCode', event.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="Country" value={formData.country} onChange={(event) => updateField('country', event.target.value)} />
              </div>
            </div>
          </FormSection>

          <FormSection number="3" icon={HandCoins} title="Commercial Terms">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyField
                label="Opening Payable Balance"
                value={formData.openingBalance}
                onChange={(event) => updateField('openingBalance', event.target.value)}
                error={errors.openingBalance}
                helper="Amount already payable to this supplier before starting in the system."
              />
              <Select label="Payment Terms" options={PAYMENT_TERMS_OPTIONS} value={formData.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} />
              <CurrencyField label="Credit Limit" value={formData.creditLimit} onChange={(event) => updateField('creditLimit', event.target.value)} error={errors.creditLimit} />
              <Select label="Purchase Currency" options={CURRENCY_OPTIONS} value={formData.purchaseCurrency} onChange={(event) => updateField('purchaseCurrency', event.target.value)} />
            </div>
          </FormSection>

          <FormSection number="4" icon={PackageSearch} title="Products Supplied">
            <p className="mb-4 text-xs text-neutral-500">
              Select the products this supplier currently provides.
            </p>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <Input placeholder="Search products..." value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.productsSupplied.length === 0 ? (
                    <p className="text-xs text-neutral-400">No products selected yet.</p>
                  ) : (
                    formData.productsSupplied.map((product) => {
                      const productId = getProductId(product)
                      const name = product.name || product.label || product
                      return (
                        <span key={productId} className="flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-1.5 text-xs font-medium text-primary-700">
                          {name}
                          <button
                            type="button"
                            onClick={() => toggleProduct({ id: productId, name })}
                            className="flex size-4 items-center justify-center rounded-full text-primary-500 hover:bg-primary-100 hover:text-primary-800"
                            aria-label={`Remove ${name}`}
                          >
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </span>
                      )
                    })
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                  <span className="font-medium text-neutral-600">{formData.productsSupplied.length} selected</span>
                  {formData.productsSupplied.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, productsSupplied: [] }))}
                      className="font-medium text-neutral-400 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">All Products</p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-neutral-400">No products found.</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() => toggleProduct(product)}
                          className="size-4 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="truncate">{product.name}</span>
                        {product.category?.name && <span className="ml-auto shrink-0 text-xs text-neutral-400">{product.category.name}</span>}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        <div className="xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <h3 className="text-sm font-semibold text-neutral-900">Supplier Summary</h3>
            <div className="mt-2 divide-y divide-neutral-50">
              <SummaryRow icon={ShieldCheck} label="Status">
                <Badge variant={formData.status === 'active' ? 'success' : 'neutral'}>
                  {formData.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </SummaryRow>
              <SummaryRow icon={IdCard} label="GST Registered">
                <Badge variant={formData.gstRegistered ? 'success' : 'neutral'}>{formData.gstRegistered ? 'Yes' : 'No'}</Badge>
              </SummaryRow>
              <SummaryRow icon={Wallet} label="Payable Balance">{formatCurrency(Number(formData.openingBalance) || 0)}</SummaryRow>
              <SummaryRow icon={Clock} label="Payment Terms">{paymentTermsLabel}</SummaryRow>
              <SummaryRow icon={CreditCard} label="Credit Limit">{formatCurrency(Number(formData.creditLimit) || 0)}</SummaryRow>
              <SummaryRow icon={Coins} label="Purchase Currency">{purchaseCurrencyLabel}</SummaryRow>
              <SummaryRow icon={Package} label="Products Selected">
                {formData.productsSupplied.length} item{formData.productsSupplied.length === 1 ? '' : 's'}
              </SummaryRow>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-800">
              Supplier will be {isEditing ? 'updated' : 'created'} with{' '}
              <span className="font-semibold">{formData.status === 'active' ? 'Active' : 'Inactive'} status</span>.
            </div>

            <div className="mt-5 space-y-2.5">
              <Button type="submit" className="w-full" loading={saving}>
                <Save className="size-4" aria-hidden="true" />
                {isEditing ? 'Save Changes' : 'Save Supplier'}
              </Button>
              <Button type="button" variant="secondary" className="w-full" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
