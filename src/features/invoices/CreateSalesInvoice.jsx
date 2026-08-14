import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, MapPin, Pencil, Plus, Save, Trash2, Truck, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { customerPool, productPool, salesPersonPool } from '../../mockData/invoices'
import { formatCurrency } from '../../utils/format'

const templateOptions = ['Classic', 'Modern', 'Compact', 'Thermal']
const paymentTypeOptions = [
  { value: 'bank-transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
]
const customerOptions = customerPool.map((customer) => ({ value: customer.name, label: customer.name }))
const salesPersonOptions = salesPersonPool.map((name) => ({ value: name, label: name }))
const productOptions = productPool.map((product, index) => ({ value: String(index), label: product.name }))

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function emptyItem() {
  return { productIndex: '', qty: 1, discountPercent: 0 }
}

export default function CreateSalesInvoice() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customerType, setCustomerType] = useState('existing')
  const [customerName, setCustomerName] = useState(customerPool[4].name)
  const [invoiceNumber] = useState('INV-2026-1042')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState(addDaysIso(14))
  const [orderReference, setOrderReference] = useState('SO-2026-1005')
  const [salesPerson, setSalesPerson] = useState(salesPersonPool[0])
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [template, setTemplate] = useState('Classic')
  const [paymentType, setPaymentType] = useState('bank-transfer')
  const [amountPaid, setAmountPaid] = useState('0')
  const [notes, setNotes] = useState('Thank you for your business.')
  const [terms, setTerms] = useState('1. Goods once sold will not be taken back.\n2. Payment to be made within the due date.')
  const [items, setItems] = useState([
    { productIndex: '0', qty: 2, discountPercent: 0 },
    { productIndex: '1', qty: 1, discountPercent: 5 },
  ])
  const [charges, setCharges] = useState([
    { label: 'Delivery Charges', amount: 150 },
    { label: 'Packing Charges', amount: 100 },
  ])

  const selectedCustomer = customerPool.find((customer) => customer.name === customerName) || customerPool[4]

  const lineItems = useMemo(
    () =>
      items
        .filter((item) => item.productIndex !== '')
        .map((item) => {
          const product = productPool[Number(item.productIndex)]
          const qty = Number(item.qty) || 0
          const lineSubtotal = product.rate * qty
          const discountAmount = lineSubtotal * (Number(item.discountPercent) || 0) / 100
          const taxable = lineSubtotal - discountAmount
          const taxAmount = taxable * product.gstRate
          return { ...product, qty, discountAmount, taxAmount, amount: taxable + taxAmount }
        }),
    [items],
  )

  const subtotal = lineItems.reduce((sum, item) => sum + item.rate * item.qty, 0)
  const discountTotal = lineItems.reduce((sum, item) => sum + item.discountAmount, 0)
  const taxTotal = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const chargesTotal = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0)
  const rawTotal = subtotal - discountTotal + taxTotal + chargesTotal
  const grandTotal = Math.round(rawTotal)
  const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100
  const paidAmount = Number(amountPaid) || 0
  const dueAmount = Math.max(0, grandTotal - paidAmount)

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const removeItem = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const addItem = () => setItems((current) => [...current, emptyItem()])

  const updateCharge = (index, value) => {
    setCharges((current) => current.map((charge, chargeIndex) => (chargeIndex === index ? { ...charge, amount: value } : charge)))
  }

  const removeCharge = (index) => setCharges((current) => current.filter((_, chargeIndex) => chargeIndex !== index))

  const addCharge = () => setCharges((current) => [...current, { label: 'New Charge', amount: 0 }])

  const handleSaveDraft = () => {
    showToast({ title: 'Draft saved', message: `${invoiceNumber} saved as draft.` })
    navigate('/admin/invoices')
  }

  const handleIssueInvoice = () => {
    if (lineItems.length === 0) {
      showToast({ title: 'Add an item', message: 'Add at least one invoice item before issuing.', variant: 'error' })
      return
    }
    showToast({ title: 'Invoice issued', message: `${invoiceNumber} issued to ${customerName}.` })
    navigate('/admin/invoices')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/invoices')}
            aria-label="Back to invoices"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Create Sales Invoice</h1>
            <p className="mt-1 text-sm text-neutral-500">Create a new invoice for your customer</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" onClick={handleSaveDraft}>
            <Save className="size-4" />
            Save Draft
          </Button>
          <Button type="button" variant="outline">
            <Eye className="size-4" />
            Preview
          </Button>
          <Button type="button" onClick={handleIssueInvoice}>
            <Upload className="size-4" />
            Issue Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-700">
                Customer<span className="text-red-500"> *</span>
              </p>
              <div className="inline-flex rounded-full bg-neutral-100 p-1">
                {[
                  { value: 'existing', label: 'Existing Customer' },
                  { value: 'walk-in', label: 'Walk-in Customer' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCustomerType(option.value)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                      customerType === option.value ? 'bg-white text-primary-700 shadow-(--shadow-xs)' : 'text-neutral-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Select
                options={customerOptions}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="flex-1"
                disabled={customerType === 'walk-in'}
              />
              <Button type="button" variant="secondary" size="md">
                <Plus className="size-4" />
                New Customer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-3">
            <Input label="Invoice Number" value={invoiceNumber} disabled />
            <Input label="Invoice Date" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            <Input label="Due Date" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-2">
            <Input
              label="Order Reference"
              value={orderReference}
              onChange={(event) => setOrderReference(event.target.value)}
              inputClassName="pr-9"
            />
            <Select label="Salesperson" options={salesPersonOptions} value={salesPerson} onChange={(event) => setSalesPerson(event.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <MapPin className="size-4 text-neutral-400" /> Billing Address
                </p>
                <button type="button" className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                  <Pencil className="size-3.5" /> Edit
                </button>
              </div>
              <div className="mt-3 text-sm leading-6 text-neutral-600">
                <p className="font-medium text-neutral-900">{selectedCustomer.name}</p>
                <p>{selectedCustomer.address}</p>
                <p>{selectedCustomer.city}, {selectedCustomer.state} - {selectedCustomer.pincode}</p>
                <p>India</p>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <Truck className="size-4 text-neutral-400" /> Shipping Address
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <input type="checkbox" checked={sameAsBilling} onChange={(event) => setSameAsBilling(event.target.checked)} className="size-3.5 rounded border-neutral-300 text-primary-600" />
                    Same as billing
                  </label>
                  <button type="button" className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                    <Pencil className="size-3.5" /> Edit
                  </button>
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-neutral-600">
                <p className="font-medium text-neutral-900">{selectedCustomer.name}</p>
                <p>{sameAsBilling ? selectedCustomer.address : '—'}</p>
                <p>{sameAsBilling ? `${selectedCustomer.city}, ${selectedCustomer.state} - ${selectedCustomer.pincode}` : ''}</p>
                <p>{sameAsBilling ? 'India' : ''}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">Invoice Items</p>
              <Button type="button" variant="outline" size="sm">
                <Upload className="size-4" />
                Import Items
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5">Qty</th>
                    <th className="px-3 py-2.5">Unit</th>
                    <th className="px-3 py-2.5">Rate</th>
                    <th className="px-3 py-2.5">Discount %</th>
                    <th className="px-3 py-2.5">Tax</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="w-9 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {items.map((item, index) => {
                    const product = item.productIndex !== '' ? productPool[Number(item.productIndex)] : null
                    const qty = Number(item.qty) || 0
                    const lineSubtotal = product ? product.rate * qty : 0
                    const discountAmount = lineSubtotal * (Number(item.discountPercent) || 0) / 100
                    const amount = product ? lineSubtotal - discountAmount + (lineSubtotal - discountAmount) * product.gstRate : 0

                    return (
                      <tr key={index}>
                        <td className="px-3 py-2.5">
                          <Select
                            options={productOptions}
                            value={item.productIndex}
                            onChange={(event) => updateItem(index, 'productIndex', event.target.value)}
                            placeholder="Select item"
                            triggerClassName="min-w-48"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(event) => updateItem(index, 'qty', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-neutral-500">{product?.unit || '—'}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{product ? formatCurrency(product.rate) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(event) => updateItem(index, 'discountPercent', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-neutral-500">{product ? `${Math.round(product.gstRate * 100)}% GST` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(amount)}</td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => removeItem(index)} aria-label="Remove item" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addItem} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
              <Plus className="size-4" /> Add Item
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Additional Charges</p>
                <button type="button" onClick={addCharge} className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                  <Plus className="size-3.5" /> Add Charge
                </button>
              </div>
              <div className="mt-3 space-y-2.5">
                {charges.map((charge, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-neutral-600">{charge.label}</p>
                    <input
                      type="number"
                      value={charge.amount}
                      onChange={(event) => updateCharge(index, event.target.value)}
                      className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                    />
                    <button type="button" onClick={() => removeCharge(index)} aria-label="Remove charge" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-500">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Notes</p>
              <textarea
                value={notes}
                maxLength={200}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-3 h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{notes.length}/200</p>
            </div>
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Terms & Conditions</p>
              <textarea
                value={terms}
                maxLength={300}
                onChange={(event) => setTerms(event.target.value)}
                className="mt-3 h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{terms.length}/300</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Template</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {templateOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTemplate(option)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    template === option ? 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200' : 'border border-neutral-200 text-neutral-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <p className="mt-5 text-sm font-semibold text-neutral-900">Payment Type</p>
            <Select className="mt-3" options={paymentTypeOptions} value={paymentType} onChange={(event) => setPaymentType(event.target.value)} />

            <div className="mt-5 space-y-2.5 border-t border-neutral-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium text-neutral-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Discount</span>
                <span className="font-medium text-red-500">- {formatCurrency(discountTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Tax</span>
                <span className="font-medium text-neutral-800">{formatCurrency(taxTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Additional Charges</span>
                <span className="font-medium text-neutral-800">{formatCurrency(chargesTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Round Off</span>
                <span className="font-medium text-neutral-800">{formatCurrency(roundOff)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5 text-base">
                <span className="font-semibold text-neutral-900">Grand Total</span>
                <span className="font-semibold text-primary-700">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Input label="Amount Paid" type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
              <div className="rounded-xl bg-amber-50 px-3.5 py-2.5">
                <p className="text-xs text-amber-700">Due Amount</p>
                <p className="text-lg font-semibold text-amber-700">{formatCurrency(dueAmount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
                View Full Preview
              </button>
            </div>
            <div className="mt-3 space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 text-xs text-neutral-600">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-neutral-900">SAAS CRM</p>
                <p className="text-neutral-400">{invoiceNumber}</p>
              </div>
              <p>Date: {formatDateLabel(invoiceDate)}</p>
              <p>Due: {formatDateLabel(dueDate)}</p>
              <div className="border-t border-neutral-200 pt-2">
                <p className="font-medium text-neutral-700">Bill To</p>
                <p>{selectedCustomer.name}</p>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-semibold text-neutral-900">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
