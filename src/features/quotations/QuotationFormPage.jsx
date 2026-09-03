import { useEffect, useMemo, useState } from 'react'
import { FileText, Info, UserPlus } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { ROLES } from '../../auth/roles'
import { createQuotation, getQuotation, updateQuotation } from '../../api/quotations'
import { listCustomers } from '../../api/customers'
import { listLeads } from '../../api/leads'
import { listProducts } from '../../api/products'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import QuickAddCustomerModal from '../customers/QuickAddCustomerModal'
import { formatLeadStatus } from '../leads/leadActivity'
import { demoLeads } from '../leads/demoData'
import ProductPickerList from '../orders/ProductPickerList'
import {
  canEditQuotation,
  getQuotationMeta,
  patchQuotationMeta,
  quantityStepForUom,
  quotationToDraftForm,
  setQuotationMeta,
} from './quotationHelpers'
import { demoQuotationMeta, getDemoQuotation, isDemoQuotation, patchDemoQuotation } from './quotationDemoData'

const today = new Date().toISOString().slice(0, 10)

const emptyQuotation = {
  quotationFor: 'customer',
  quotationDate: today,
  validUntil: '',
  customerId: '',
  leadId: '',
  billingAddress: '',
  shippingAddress: '',
  salespersonId: '',
  currency: 'INR',
  paymentTerms: '',
  deliveryTerms: '',
  notes: '',
  termsConditions: '',
  items: [],
}

const currencyOptions = ['INR', 'USD', 'AED', 'SGD', 'GBP'].map((value) => ({ value, label: value }))
const paymentTermOptions = ['Net 15', 'Net 30', 'Advance', 'Immediate', 'Due on Receipt'].map((value) => ({ value, label: value }))
const deliveryTermOptions = ['Standard delivery', 'Express delivery', 'Customer pickup', 'Delivery within 2 business days'].map((value) => ({ value, label: value }))
const quotationForOptions = [
  { value: 'customer', label: 'Existing Customer' },
  { value: 'lead', label: 'Lead / Prospect' },
  { value: 'quick', label: 'Quick Add Customer' },
]
const discountTypeOptions = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'amount', label: 'Amount (₹)' },
]

function SectionBadge({ number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
      {number}
    </span>
  )
}

export default function QuotationFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const [searchParams] = useSearchParams()
  const fromId = searchParams.get('from') || ''
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const basePath = isSalesOfficer ? '/sales/quotations' : '/admin/quotations'

  const isEdit = Boolean(editId)
  const mode = isEdit ? 'edit' : fromId ? 'duplicate' : 'create'
  const [sourceStatus, setSourceStatus] = useState('draft')

  const [formData, setFormData] = useState(() => ({
    ...emptyQuotation,
    salespersonId: isSalesOfficer ? currentUser.id : '',
  }))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // One quotation-level discount (matches the Create Order design). It is distributed back
  // onto every line item as a percentage when the quotation is saved - the backend only has
  // a per-item discount field.
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState(0)

  const [customers, setCustomers] = useState([])
  const [leads, setLeads] = useState([])
  const [products, setProducts] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isLoadingSource, setIsLoadingSource] = useState(isEdit || Boolean(fromId))
  const [sourceMeta, setSourceMeta] = useState(null)
  const [lockedMessage, setLockedMessage] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadOptions() {
      const [customersResult, leadsResult, productsResult, usersResult] = await Promise.all([
        listCustomers(),
        listLeads(),
        listProducts(),
        isSalesOfficer ? Promise.resolve({ success: true, users: [] }) : listUsers(),
      ])
      if (!isMounted) return
      if (customersResult.success) setCustomers(customersResult.customers)
      if (leadsResult.success) {
        const active = leadsResult.leads.filter((lead) => ['new', 'contacted', 'qualified'].includes(lead.leadStatus))
        setLeads([...active, ...demoLeads.filter((lead) => ['new', 'contacted', 'qualified'].includes(lead.leadStatus))])
      }
      if (productsResult.success) setProducts(productsResult.products)
      if (isSalesOfficer) {
        setSalespeople(currentUser?.id ? [{ id: currentUser.id, name: currentUser.name || 'Current user' }] : [])
      } else if (usersResult.success) {
        setSalespeople(
          usersResult.users.map(normalizeApiUser).filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
        )
      }
      setIsLoadingOptions(false)
    }
    loadOptions()
    return () => { isMounted = false }
  }, [isSalesOfficer, currentUser?.id, currentUser?.name])

  // Load the source quotation for edit / duplicate.
  useEffect(() => {
    if (!isEdit && !fromId) return
    const sourceId = editId || fromId
    let alive = true
    async function loadSource() {
      const quote = isDemoQuotation(sourceId) ? getDemoQuotation(sourceId) : (await getQuotation(sourceId)).quotation
      if (!alive) return
      if (!quote) {
        setLockedMessage('Quotation not found.')
        setIsLoadingSource(false)
        return
      }
      setSourceStatus(quote.status)
      const meta = { ...(isDemoQuotation(sourceId) ? demoQuotationMeta[sourceId] || {} : {}), ...(getQuotationMeta(sourceId) || {}) }
      setSourceMeta(meta)

      if (isEdit && !canEditQuotation(quote)) {
        setLockedMessage(`This quotation is ${quote.status} and is locked. Use Duplicate to start a new quotation from it.`)
        setIsLoadingSource(false)
        return
      }

      const draft = quotationToDraftForm(quote)
      // Demo quotations carry placeholder product / customer ids - drop those so a real
      // save writes clean data (the user re-picks products / customer).
      if (isDemoQuotation(sourceId)) {
        draft.items = draft.items.filter((item) => item.productId && !String(item.productId).startsWith('demo-'))
        if (String(draft.customerId).startsWith('demo-')) draft.customerId = ''
      }

      // Seed the single discount control from whatever per-line discount the source carried.
      const seededDiscount = draft.items.reduce((sum, item) => {
        const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        return sum + gross * ((Number(item.discount) || 0) / 100)
      }, 0)
      if (seededDiscount > 0) {
        setDiscountType('amount')
        setDiscountValue(String(Math.round(seededDiscount)))
      }

      setFormData((current) => ({
        ...current,
        ...draft,
        quotationFor: draft.customerId ? 'customer' : meta.leadId ? 'lead' : 'customer',
        leadId: meta.leadId || '',
        quotationDate: isEdit ? quote.quotationDate?.slice(0, 10) || today : today,
        validUntil: isEdit ? quote.validUntil?.slice(0, 10) || '' : '',
        salespersonId: isSalesOfficer ? currentUser.id : draft.salespersonId,
      }))
      setIsLoadingSource(false)
    }
    loadSource()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, fromId])

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}`, customer })),
    [customers],
  )
  const leadOptions = useMemo(
    () => leads.map((lead) => ({ value: lead.id, label: `${lead.name || lead.leadId || 'Prospect'}${lead.mobileNumber ? ` • ${lead.mobileNumber}` : ''} · ${formatLeadStatus(lead.leadStatus)}`, lead })),
    [leads],
  )
  const salespersonOptions = useMemo(() => salespeople.map((user) => ({ value: user.id, label: user.name })), [salespeople])

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === formData.leadId) || null, [leads, formData.leadId])
  const entityIsLead = formData.quotationFor === 'lead'

  const totals = useMemo(() => {
    const lines = formData.items.map((item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      const rate = Number(item.taxRate) || 0
      return { qty, rate, gross: qty * price }
    })
    const subtotal = lines.reduce((sum, line) => sum + line.gross, 0)
    const raw = discountType === 'percentage' ? subtotal * ((Number(discountValue) || 0) / 100) : Number(discountValue) || 0
    const discountAmount = Math.min(Math.max(raw, 0), subtotal)
    const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0
    const tax = lines.reduce((sum, line) => sum + line.gross * ratio * (line.rate / 100), 0)
    const totalQuantity = lines.reduce((sum, line) => sum + line.qty, 0)
    return { subtotal, discountAmount, tax, grandTotal: subtotal - discountAmount + tax, totalQuantity }
  }, [formData.items, discountType, discountValue])

  const discountPercentForItems = totals.subtotal > 0 ? (totals.discountAmount / totals.subtotal) * 100 : 0

  const updateField = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value }

      if (field === 'quotationFor') {
        next.customerId = ''
        next.leadId = ''
        if (value === 'quick') setQuickAddOpen(true)
      }

      if (field === 'customerId') {
        const selectedCustomer = customerOptions.find((option) => option.value === value)?.customer
        if (selectedCustomer) {
          next.billingAddress = selectedCustomer.billingAddress || selectedCustomer.billing_address || next.billingAddress
          next.shippingAddress = selectedCustomer.shippingAddress || selectedCustomer.shipping_address || selectedCustomer.billingAddress || selectedCustomer.billing_address || next.shippingAddress
          if (!isSalesOfficer && selectedCustomer.assignedSalesOfficerId) next.salespersonId = selectedCustomer.assignedSalesOfficerId
        }
      }

      if (field === 'leadId') {
        const lead = leadOptions.find((option) => option.value === value)?.lead
        if (lead && !isSalesOfficer && lead.assignedSalespersonId) next.salespersonId = lead.assignedSalespersonId
      }

      return next
    })
    setErrors((current) => ({ ...current, [field]: '', entity: '' }))
  }

  const handleQuickCustomerCreated = (created) => {
    setCustomers((current) => [{ id: created.id, name: created.name, phone: created.phone, email: created.email }, ...current])
    setFormData((current) => ({ ...current, quotationFor: 'customer', customerId: created.id }))
    setQuickAddOpen(false)
    showToast({ title: 'Customer added', message: `${created.name} is selected on this quotation.` })
  }

  // Product picker adapters - the picker speaks the Create Order item shape
  // (productId / quantity / unitPrice); everything else is filled from the product.
  const setPickerQuantity = (product, nextQuantity) => {
    const qty = Math.max(0, Math.floor(Number(nextQuantity) || 0))
    setFormData((current) => {
      const index = current.items.findIndex((item) => item.productId === product.id)
      if (qty === 0) return { ...current, items: current.items.filter((item) => item.productId !== product.id) }
      if (index >= 0) {
        return { ...current, items: current.items.map((item, i) => (i === index ? { ...item, quantity: String(qty) } : item)) }
      }
      return {
        ...current,
        items: [
          ...current.items,
          {
            productId: product.id,
            variantId: '',
            productName: product.name,
            sku: product.sku || '',
            uom: product.sales_unit || product.uom || 'unit',
            quantity: String(qty),
            unitPrice: String(product.price ?? ''),
            discount: '',
            taxRate: String(product.tax_rate ?? ''),
          },
        ],
      }
    })
    setErrors((current) => ({ ...current, items: '' }))
  }

  const updateItemField = (productId, field, value) => {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item) => (item.productId === productId ? { ...item, [field]: value } : item)),
    }))
  }

  const roundItemOnBlur = (productId, field, { min = 0 } = {}) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    updateItemField(productId, field, String(Number.isFinite(rounded) ? Math.max(rounded, min) : min))
  }

  const validate = () => {
    const nextErrors = {}
    if (formData.quotationFor === 'lead') {
      if (!formData.leadId) nextErrors.entity = 'Select a lead / prospect.'
    } else if (!formData.customerId) {
      nextErrors.entity = 'Select a customer.'
    }
    if (!formData.salespersonId) nextErrors.salespersonId = 'Salesperson is required.'
    if (!formData.currency) nextErrors.currency = 'Currency is required.'
    if (formData.validUntil && formData.quotationDate && formData.validUntil < formData.quotationDate) {
      nextErrors.validUntil = 'Valid Until must be on or after the quotation date.'
    }

    if (formData.items.length === 0) {
      nextErrors.items = 'Add at least one product to this quotation.'
    } else if (formData.items.some((item) => !Number(item.quantity) || Number(item.quantity) <= 0 || item.unitPrice === '' || Number(item.unitPrice) < 0)) {
      nextErrors.items = 'Every product needs a quantity and a unit price.'
    } else if (formData.items.some((item) => quantityStepForUom(item.uom) === 1 && !Number.isInteger(Number(item.quantity)))) {
      nextErrors.items = 'Quantity must be a whole number for this unit.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // Editing a quote that was already sent/rejected/expired re-opens it as a Draft.
  const reopensAsDraft = isEdit && sourceStatus !== 'draft'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    const itemsPayload = formData.items.map((item) => ({
      ...item,
      discount: discountPercentForItems > 0 ? discountPercentForItems : Number(item.discount) || 0,
    }))

    // Editing a demo quotation stays local - no backend PATCH with a demo id.
    if (isEdit && isDemoQuotation(editId)) {
      if (reopensAsDraft) {
        patchDemoQuotation(editId, { status: 'draft' })
        patchQuotationMeta(editId, { updatedAfterSend: true })
      }
      showToast({ title: 'Changes saved', message: reopensAsDraft ? 'Quotation is back to Draft — you can send it again.' : 'Draft updated.' })
      navigate(`${basePath}/${encodeURIComponent(editId)}`)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    // A lead quotation carries no customer_id (backend has no lead_id field) - the link
    // is stored in quotation meta after we have the new id.
    const payload = {
      ...formData,
      items: itemsPayload,
      customerId: formData.quotationFor === 'lead' ? '' : formData.customerId,
      ...(reopensAsDraft ? { status: 'draft' } : {}),
    }

    const result = isEdit
      ? await updateQuotation(editId, payload)
      : await createQuotation(payload)

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    const savedId = result.quotation?.id || editId
    if (formData.quotationFor === 'lead' && formData.leadId && savedId) {
      setQuotationMeta(savedId, {
        leadId: formData.leadId,
        leadName: selectedLead?.name || sourceMeta?.leadName || 'Prospect',
        leadStatus: selectedLead?.leadStatus || sourceMeta?.leadStatus || '',
        convertedCustomerId: '',
      })
    }
    if (reopensAsDraft) patchQuotationMeta(editId, { updatedAfterSend: true })

    navigate(savedId ? `${basePath}/${encodeURIComponent(savedId)}` : basePath)
  }

  if (isLoadingSource) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-10">
        <LoadingSpinner label="Loading quotation..." />
      </div>
    )
  }

  if (lockedMessage) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center">
        <p className="text-sm text-amber-800">{lockedMessage}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(basePath)}>Back to Quotations</Button>
          {isEdit && (
            <Button type="button" onClick={() => navigate(`${basePath}/new?from=${encodeURIComponent(editId)}`)}>Duplicate</Button>
          )}
        </div>
      </div>
    )
  }

  const pageTitle = mode === 'edit'
    ? (reopensAsDraft ? 'Edit & Resend Quotation' : 'Edit Quotation')
    : mode === 'duplicate' ? 'Duplicate Quotation' : 'Create Quotation'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold text-neutral-900">{pageTitle}</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(basePath)}>Back to Quotations</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* 1 - Quotation Details */}
        <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <SectionBadge number={1} />
            <h3 className="text-sm font-semibold text-neutral-900">Quotation Details</h3>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:items-start">
            <Select
              label="Quotation For"
              required
              options={quotationForOptions}
              value={formData.quotationFor}
              onChange={(event) => updateField('quotationFor', event.target.value)}
              disabled={isEdit && Boolean(formData.customerId)}
            />
            <Select label="Currency" required options={currencyOptions} value={formData.currency} onChange={(event) => updateField('currency', event.target.value)} error={errors.currency} />

            {entityIsLead ? (
              <div className="space-y-1.5">
                <Select
                  label="Lead / Prospect"
                  required
                  searchable
                  options={leadOptions}
                  value={formData.leadId}
                  onChange={(event) => updateField('leadId', event.target.value)}
                  placeholder={isLoadingOptions ? 'Loading leads...' : 'Select an active lead'}
                  disabled={isLoadingOptions}
                  error={errors.entity}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Select
                  label="Customer"
                  required
                  searchable
                  options={customerOptions}
                  value={formData.customerId}
                  onChange={(event) => updateField('customerId', event.target.value)}
                  placeholder={isLoadingOptions ? 'Loading...' : 'Select customer'}
                  error={errors.entity}
                  disabled={isLoadingOptions}
                />
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Quick Add Customer
                </button>
              </div>
            )}
            <Select label="Salesperson" required options={salespersonOptions} value={formData.salespersonId} onChange={(event) => updateField('salespersonId', event.target.value)} placeholder={isLoadingOptions ? 'Loading...' : 'Select salesperson'} error={errors.salespersonId} disabled={isLoadingOptions || isSalesOfficer} />

            {entityIsLead && selectedLead && (
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 text-sm sm:col-span-2">
                <p className="text-[0.68rem] font-medium uppercase tracking-wide text-neutral-400">Prospect details (from lead)</p>
                <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  <p><span className="text-neutral-500">Name:</span> {selectedLead.name || '—'}</p>
                  <p><span className="text-neutral-500">Contact:</span> {selectedLead.contactPerson || '—'}</p>
                  <p><span className="text-neutral-500">Phone:</span> {selectedLead.mobileNumber || '—'}</p>
                  <p><span className="text-neutral-500">Email:</span> {selectedLead.email || '—'}</p>
                </div>
                <p className="mt-1.5 text-[0.7rem] text-neutral-400">Stays linked to the lead — a customer is only needed to raise an order later.</p>
              </div>
            )}

            <Input label="Quotation Date" type="date" required value={formData.quotationDate} onChange={(event) => updateField('quotationDate', event.target.value)} error={errors.quotationDate} />
            <Input label="Valid Until" type="date" min={formData.quotationDate} value={formData.validUntil} onChange={(event) => updateField('validUntil', event.target.value)} error={errors.validUntil} />
            <Input label="Billing Address" value={formData.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} />
            <Input label="Shipping Address" value={formData.shippingAddress} onChange={(event) => updateField('shippingAddress', event.target.value)} />
          </div>
        </div>

        {/* 2 - Terms Details */}
        <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <SectionBadge number={2} />
            <h3 className="text-sm font-semibold text-neutral-900">Terms Details</h3>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Select label="Payment Terms" options={paymentTermOptions} value={formData.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} placeholder="Select payment terms" />
            <Select label="Delivery Terms" options={deliveryTermOptions} value={formData.deliveryTerms} onChange={(event) => updateField('deliveryTerms', event.target.value)} placeholder="Select delivery terms" />
            <Input as="textarea" label="Notes" value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} inputClassName="min-h-16" placeholder="Internal remarks — not printed on the quotation" />
            <Input as="textarea" label="Terms & Conditions" value={formData.termsConditions} onChange={(event) => updateField('termsConditions', event.target.value)} inputClassName="min-h-16" placeholder="Printed on the customer quotation PDF" />
          </div>
        </div>
        </div>

        {/* 3 - Quotation Items */}
        <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <SectionBadge number={3} />
            <h3 className="text-sm font-semibold text-neutral-900">Quotation Items</h3>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
            <div>
              <ProductPickerList
                products={products}
                orderItems={formData.items}
                isLoading={isLoadingOptions}
                onSetQuantity={setPickerQuantity}
                onUpdateItem={updateItemField}
                onRoundBlur={roundItemOnBlur}
                listMaxHeightClass="max-h-80"
              />
              {errors.items && <p className="pt-3 text-sm text-red-600">{errors.items}</p>}
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(totals.subtotal)}</span>
                </div>

                <div>
                  <span className="text-xs text-neutral-500">Discount</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Select options={discountTypeOptions} value={discountType} onChange={(event) => setDiscountType(event.target.value)} className="flex-1" />
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
                      className="h-9 w-14 shrink-0 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                    />
                    <span className="shrink-0 text-xs font-medium text-neutral-500">{discountType === 'percentage' ? '%' : '₹'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Discount Amount</span>
                  <span className={`font-semibold ${totals.discountAmount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                    {totals.discountAmount > 0 ? `-${formatCurrency(totals.discountAmount)}` : formatCurrency(0)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">Tax</span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(totals.tax)}</span>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5">
                  <span className="font-semibold text-neutral-900">Grand Total</span>
                  <span className="font-bold text-primary-700">{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-neutral-400">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            {reopensAsDraft
              ? 'Saving moves this quotation back to Draft so you can send it again.'
              : 'Saved as a draft — send it from the quotation page.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(basePath)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              <FileText className="size-4" aria-hidden="true" />
              {mode === 'edit' ? 'Save Changes' : 'Save Quotation'}
            </Button>
          </div>
        </div>
      </form>

      <QuickAddCustomerModal
        isOpen={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false)
          setFormData((current) => (current.quotationFor === 'quick' ? { ...current, quotationFor: 'customer' } : current))
        }}
        onCreated={handleQuickCustomerCreated}
      />
    </div>
  )
}
