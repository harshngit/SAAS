import { Fragment, useEffect, useMemo, useState } from 'react'
import { FileText, PackageSearch, ReceiptText, Trash2, UserPlus } from 'lucide-react'
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
import {
  canEditQuotation,
  getQuotationMeta,
  patchQuotationMeta,
  priceWarnings,
  quantityStepForUom,
  quotationTotals,
  quotationToDraftForm,
  setQuotationMeta,
} from './quotationHelpers'
import { demoQuotationMeta, getDemoQuotation, isDemoQuotation, patchDemoQuotation } from './quotationDemoData'

const today = new Date().toISOString().slice(0, 10)

const emptyItem = {
  productId: '', variantId: '', productName: '', sku: '', uom: '',
  quantity: '', unitPrice: '', discount: '', taxRate: '',
}

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
  items: [{ ...emptyItem }],
}

const currencyOptions = ['INR', 'USD', 'AED', 'SGD', 'GBP'].map((value) => ({ value, label: value }))
const paymentTermOptions = ['Net 15', 'Net 30', 'Advance', 'Immediate', 'Due on Receipt'].map((value) => ({ value, label: value }))
const deliveryTermOptions = ['Standard delivery', 'Express delivery', 'Customer pickup', 'Delivery within 2 business days'].map((value) => ({ value, label: value }))
const uomOptions = ['unit', 'piece', 'box', 'pack', 'bag', 'bottle', 'jar', 'case (12)', 'case (24)', 'kg', 'g', 'ltr', 'ml', 'mtr'].map((value) => ({ value, label: value }))
const taxOptions = [
  { value: '0', label: '0%' }, { value: '5', label: '5%' }, { value: '12', label: '12%' },
  { value: '18', label: '18%' }, { value: '28', label: '28%' },
]
const quotationForOptions = [
  { value: 'customer', label: 'Existing Customer' },
  { value: 'lead', label: 'Lead / Prospect' },
  { value: 'quick', label: 'Quick Add Customer' },
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
  const [activeSection, setActiveSection] = useState('quotation-details')

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
      const sourceIsDemo = isDemoQuotation(sourceId)
      // Demo quotations carry placeholder product / customer ids - clear those so a real
      // duplicate saves clean data (the user re-picks products / customer).
      if (sourceIsDemo) {
        draft.items = draft.items.map((it) => (String(it.productId).startsWith('demo-') ? { ...emptyItem } : it))
        if (draft.items.every((it) => !it.productId)) draft.items = [{ ...emptyItem }]
        if (String(draft.customerId).startsWith('demo-')) draft.customerId = ''
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

  const formSections = [
    { id: 'quotation-details', title: 'Quotation Details', description: 'Who the quote is for, dates, and sales ownership.', icon: ReceiptText,
      fields: ['quotationFor', 'entity', 'quotationDate', 'validUntil', 'billingAddress', 'shippingAddress', 'salespersonId', 'currency'] },
    { id: 'terms-details', title: 'Terms Details', description: 'Payment, delivery, internal notes, and printed terms.', icon: FileText,
      fields: ['paymentTerms', 'deliveryTerms', 'notes', 'termsConditions'] },
    { id: 'quotation-items', title: 'Quotation Items', description: 'Products, quantities, pricing, tax, and totals.', icon: PackageSearch,
      fields: ['items'] },
  ]
  const activeFormSection = formSections.find((section) => section.id === activeSection) || formSections[0]
  const activeSectionIndex = formSections.findIndex((section) => section.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === formSections.length - 1

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}`, customer })),
    [customers],
  )
  const leadOptions = useMemo(
    () => leads.map((lead) => ({ value: lead.id, label: `${lead.name || lead.leadId || 'Prospect'}${lead.mobileNumber ? ` • ${lead.mobileNumber}` : ''} · ${formatLeadStatus(lead.leadStatus)}`, lead })),
    [leads],
  )
  const salespersonOptions = useMemo(() => salespeople.map((user) => ({ value: user.id, label: user.name })), [salespeople])
  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: product.name, product })), [products])

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === formData.leadId) || null, [leads, formData.leadId])
  const totals = useMemo(() => quotationTotals(formData.items), [formData.items])

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
          next.billingAddress = selectedCustomer.billingAddress || next.billingAddress
          next.shippingAddress = selectedCustomer.shippingAddress || selectedCustomer.billingAddress || next.shippingAddress
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

  const updateItem = (index, field, value) => {
    setFormData((current) => {
      let items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, [field]: value }
        if (field === 'productId') {
          const selectedProduct = productOptions.find((option) => option.value === value)?.product
          if (selectedProduct) {
            nextItem.productName = selectedProduct.name
            nextItem.sku = selectedProduct.sku || ''
            nextItem.unitPrice = selectedProduct.price ?? ''
            nextItem.taxRate = selectedProduct.tax_rate ?? ''
            nextItem.uom = selectedProduct.sales_unit || selectedProduct.uom || nextItem.uom || 'unit'
            nextItem.variantId = ''
          }
        }
        return nextItem
      })

      // Duplicate product -> merge quantity into the first matching row, drop this one.
      if (field === 'productId' && value) {
        const firstIdx = items.findIndex((item) => item.productId === value)
        if (firstIdx !== -1 && firstIdx !== index) {
          const merged = { ...items[firstIdx] }
          const addQty = Number(items[index].quantity) || 1
          merged.quantity = String((Number(merged.quantity) || 0) + addQty)
          items = items.map((item, i) => (i === firstIdx ? merged : item)).filter((_, i) => i !== index)
          window.setTimeout(() => showToast({ title: 'Merged line', message: 'That product is already on this quotation — quantities were combined.' }), 0)
        }
      }

      return { ...current, items: items.length ? items : [{ ...emptyItem }] }
    })
    setErrors((current) => ({ ...current, items: '' }))
  }

  const addItem = () => setFormData((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }))
  const removeItem = (index) => setFormData((current) => ({
    ...current,
    items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
  }))

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

    const hasInvalidItem = formData.items.some((item) => (
      !item.productId || !item.quantity || Number(item.quantity) <= 0 || item.unitPrice === '' || Number(item.unitPrice) < 0
    ))
    const hasBadWholeQty = formData.items.some(
      (item) => item.quantity !== '' && quantityStepForUom(item.uom) === 1 && !Number.isInteger(Number(item.quantity)),
    )
    if (hasInvalidItem) nextErrors.items = 'Each item needs a product, quantity, and unit price.'
    else if (hasBadWholeQty) nextErrors.items = 'Quantity must be a whole number for this unit.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // Editing a quote that was already sent/rejected/expired re-opens it as a Draft.
  const reopensAsDraft = isEdit && sourceStatus !== 'draft'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

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

  const goToPreviousSection = () => !isFirstSection && setActiveSection(formSections[activeSectionIndex - 1].id)
  const goToNextSection = () => !isLastSection && setActiveSection(formSections[activeSectionIndex + 1].id)

  const renderField = (field) => {
    if (field === 'quotationFor') {
      return (
        <Select
          label="Quotation For"
          required
          options={quotationForOptions}
          value={formData.quotationFor}
          onChange={(event) => updateField('quotationFor', event.target.value)}
          disabled={isEdit && Boolean(formData.customerId)}
        />
      )
    }
    if (field === 'entity') {
      if (formData.quotationFor === 'lead') {
        return (
          <div className="space-y-3">
            <Select
              label="Lead / Prospect"
              required
              options={leadOptions}
              value={formData.leadId}
              onChange={(event) => updateField('leadId', event.target.value)}
              placeholder={isLoadingOptions ? 'Loading leads...' : 'Select an active lead'}
              disabled={isLoadingOptions}
              error={errors.entity}
              searchable
            />
            {selectedLead && (
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Prospect details (from lead)</p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <p><span className="text-neutral-500">Name:</span> {selectedLead.name || '—'}</p>
                  <p><span className="text-neutral-500">Contact:</span> {selectedLead.contactPerson || '—'}</p>
                  <p><span className="text-neutral-500">Phone:</span> {selectedLead.mobileNumber || '—'}</p>
                  <p><span className="text-neutral-500">Email:</span> {selectedLead.email || '—'}</p>
                </div>
                <p className="mt-2 text-xs text-neutral-400">This quotation stays linked to the lead. A customer is only needed to raise an order later.</p>
              </div>
            )}
          </div>
        )
      }
      return (
        <div className="space-y-2">
          <Select
            label="Customer"
            required
            options={customerOptions}
            value={formData.customerId}
            onChange={(event) => updateField('customerId', event.target.value)}
            placeholder={isLoadingOptions ? 'Loading...' : 'Select customer'}
            error={errors.entity}
            disabled={isLoadingOptions}
            searchable
          />
          <button type="button" onClick={() => setQuickAddOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700">
            <UserPlus className="size-3.5" aria-hidden="true" />
            Quick Add Customer
          </button>
        </div>
      )
    }
    if (field === 'quotationDate') return <Input label="Quotation Date" type="date" value={formData.quotationDate} onChange={(event) => updateField(field, event.target.value)} required error={errors.quotationDate} />
    if (field === 'validUntil') return <Input label="Valid Until" type="date" min={formData.quotationDate} value={formData.validUntil} onChange={(event) => updateField(field, event.target.value)} error={errors.validUntil} />
    if (field === 'billingAddress') return <Input label="Billing Address" value={formData.billingAddress} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'shippingAddress') return <Input label="Shipping Address" value={formData.shippingAddress} onChange={(event) => updateField(field, event.target.value)} />
    if (field === 'salespersonId') return <Select label="Salesperson" options={salespersonOptions} value={formData.salespersonId} onChange={(event) => updateField(field, event.target.value)} required placeholder={isLoadingOptions ? 'Loading...' : 'Select salesperson'} error={errors.salespersonId} disabled={isLoadingOptions || isSalesOfficer} />
    if (field === 'currency') return <Select label="Currency" options={currencyOptions} value={formData.currency} onChange={(event) => updateField(field, event.target.value)} required error={errors.currency} />
    if (field === 'paymentTerms') return <Select label="Payment Terms" options={paymentTermOptions} value={formData.paymentTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select payment terms" />
    if (field === 'deliveryTerms') return <Select label="Delivery Terms" options={deliveryTermOptions} value={formData.deliveryTerms} onChange={(event) => updateField(field, event.target.value)} placeholder="Select delivery terms" />
    if (field === 'notes') return <Input as="textarea" label="Notes" value={formData.notes} onChange={(event) => updateField(field, event.target.value)} placeholder="Internal remarks — not printed on the customer quotation" />
    if (field === 'termsConditions') return <Input as="textarea" label="Terms & Conditions" value={formData.termsConditions} onChange={(event) => updateField(field, event.target.value)} placeholder="Printed on the customer quotation PDF" />

    return (
      <div className="lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Quotation Items</p>
            <p className="mt-1 text-xs text-neutral-400">Add products for this estimate.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>Add Item</Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-100">
          <table className="w-full min-w-216 text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                <th className="px-3 py-2.5">Product <span className="text-red-500">*</span></th>
                <th className="w-20 px-2 py-2.5">Qty <span className="text-red-500">*</span></th>
                <th className="w-28 px-2 py-2.5">UOM</th>
                <th className="w-28 px-2 py-2.5">Unit Price <span className="text-red-500">*</span></th>
                <th className="w-16 px-2 py-2.5">Disc %</th>
                <th className="w-24 px-2 py-2.5">Tax %</th>
                <th className="w-28 px-2 py-2.5 text-right">Line Total</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {formData.items.map((item, index) => {
                const product = productOptions.find((option) => option.value === item.productId)?.product
                const warnings = priceWarnings(item, product)
                return (
                  <Fragment key={index}>
                    <tr className="align-top">
                      <td className="px-3 py-2">
                        <Select
                          options={productOptions}
                          value={item.productId}
                          onChange={(event) => updateItem(index, 'productId', event.target.value)}
                          placeholder={isLoadingOptions ? 'Loading...' : 'Select product'}
                          disabled={isLoadingOptions}
                          searchable
                          triggerClassName="h-8 min-w-0 py-1 pl-2.5 pr-2 text-xs"
                        />
                        {item.sku && <p className="mt-0.5 pl-1 text-[0.68rem] text-neutral-400">SKU: {item.sku}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" min="0" step={quantityStepForUom(item.uom)} value={item.quantity}
                          onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                          className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          options={uomOptions} value={item.uom}
                          onChange={(event) => updateItem(index, 'uom', event.target.value)}
                          placeholder="UOM"
                          triggerClassName="h-8 min-w-0 py-1 pl-2.5 pr-2 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" min="0" step="0.01" value={item.unitPrice}
                          onChange={(event) => updateItem(index, 'unitPrice', event.target.value)}
                          className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" min="0" max="100" step="1" value={item.discount}
                          onChange={(event) => updateItem(index, 'discount', event.target.value)}
                          onBlur={(event) => {
                            const rounded = Math.round(Number(event.target.value))
                            updateItem(index, 'discount', String(Number.isFinite(rounded) ? Math.min(Math.max(rounded, 0), 100) : 0))
                          }}
                          className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          options={taxOptions} value={String(item.taxRate ?? '')}
                          onChange={(event) => updateItem(index, 'taxRate', event.target.value)}
                          placeholder="Tax"
                          triggerClassName="h-8 min-w-0 py-1 pl-2.5 pr-2 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-medium text-neutral-900">{formatCurrency(calculateLineTotal(item))}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          disabled={formData.items.length === 1}
                          onClick={() => removeItem(index)}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                    {(warnings.lowPrice || warnings.highDiscount) && (
                      <tr>
                        <td colSpan={8} className="px-3 pb-2 text-[0.7rem] text-amber-600">
                          {[warnings.lowPrice && 'Unit price is below the usual selling price.', warnings.highDiscount && 'High discount — approval may be required.'].filter(Boolean).join(' · ')}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {errors.items && <p className="mt-3 text-xs text-red-600">{errors.items}</p>}

        <div className="mt-5 flex justify-end border-t border-neutral-100 pt-4">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between text-neutral-600"><span>Discount</span><span>− {formatCurrency(totals.discount)}</span></div>
            <div className="flex justify-between text-neutral-600"><span>Tax</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1.5 font-semibold text-neutral-900"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
          </div>
        </div>
      </div>
    )
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
    : mode === 'duplicate' ? 'Duplicate Quotation' : activeFormSection.title

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
        <div className="grid" style={{ gridTemplateColumns: '16rem minmax(0, 1fr)' }}>
          <aside className="border-b border-neutral-100 p-3 lg:border-b-0 lg:border-r lg:p-3">
            <nav className="sticky top-6 flex flex-col gap-3">
              {formSections.map((section) => {
                const Icon = section.icon
                const isActive = section.id === activeSection
                return (
                  <button key={section.id} type="button" onClick={() => setActiveSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all ${
                      isActive ? 'bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-neutral-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{section.title}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col px-4 py-4">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{pageTitle}</p>
                <p className="mt-1 text-sm text-neutral-500">{activeFormSection.description}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => navigate(basePath)}>Back to Quotations</Button>
            </div>

            {submitError && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

            <section className="border-b border-neutral-100 py-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeFormSection.fields.map((field) => (
                  <Fragment key={field}>
                    <div className={['quotationFor', 'entity', 'notes', 'termsConditions', 'items'].includes(field) ? 'lg:col-span-2' : ''}>
                      {renderField(field)}
                    </div>
                  </Fragment>
                ))}
              </div>
            </section>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={goToPreviousSection} disabled={isFirstSection}>Back</Button>
              {isLastSection ? (
                <Button type="submit" loading={isSubmitting}>{mode === 'edit' ? 'Save Changes' : 'Save Quotation'}</Button>
              ) : (
                <Button type="button" onClick={goToNextSection}>Next</Button>
              )}
            </div>
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
    </>
  )
}
