import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { formatCurrency } from '../../utils/format'
import { safeNumber } from '../purchases/purchaseHelpers'
import { demoSuppliers } from '../suppliers/supplierDemoData'
import { getDemoSupplierSnapshot, getDemoPurchase, getDemoPurchasesForSupplier } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import {
  buildMatchRows,
  computeInvoiceLine,
  computeInvoiceTotals,
  validateSupplierInvoice,
} from './supplierInvoiceHelpers'
import {
  SUPPLIER_INVOICES_DEMO_ENABLED,
  createDemoSupplierInvoice,
  getDemoSupplierInvoice,
  getSupplierInvoiceNumbersForSupplier,
  isDemoSupplierInvoice,
  patchDemoSupplierInvoice,
} from './supplierInvoiceDemoData'

const REAL_MODE_NOTE = 'Supplier invoice recording will be available once the supplier invoicing backend is enabled.'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyItem() {
  return { productId: '', productName: '', sku: '', uom: 'unit', invoiceQty: 1, unitPrice: 0, discount: 0, taxRate: 0 }
}

function emptyForm() {
  return {
    supplierId: '',
    supplierInvoiceNumber: '',
    invoiceDate: todayIso(),
    dueDate: '',
    purchaseId: '',
    grnId: '',
    currency: 'INR',
    notes: '',
    items: [emptyItem()],
    charges: { freight: 0, packing: 0, insurance: 0, otherCharges: 0, roundOff: 0 },
    amountPaid: 0,
  }
}

function SnapshotField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value || '—'}</p>
    </div>
  )
}

export default function SupplierInvoiceForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditing = Boolean(id)
  const basePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const demoOn = SUPPLIER_INVOICES_DEMO_ENABLED

  const [form, setForm] = useState(emptyForm)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!isEditing || !demoOn) return
    const existing = isDemoSupplierInvoice(id) ? getDemoSupplierInvoice(id) : null
    if (!existing) {
      setNotFound(true)
      return
    }
    setForm({
      ...emptyForm(),
      ...existing,
      charges: { ...emptyForm().charges, ...(existing.charges || {}) },
      items: (existing.items || []).map((item) => ({ ...emptyItem(), ...item })),
    })
  }, [id, isEditing, demoOn])

  const supplierOptions = useMemo(
    () => [{ value: '', label: 'Select supplier' }, ...demoSuppliers.map((s) => ({ value: s.id, label: s.name }))],
    [],
  )
  const snapshot = useMemo(() => (form.supplierId ? getDemoSupplierSnapshot(form.supplierId) : null), [form.supplierId])
  const supplierPurchases = useMemo(
    () => (form.supplierId ? getDemoPurchasesForSupplier(form.supplierId) : []),
    [form.supplierId],
  )
  const purchase = useMemo(() => (form.purchaseId ? getDemoPurchase(form.purchaseId) : null), [form.purchaseId])
  const grns = useMemo(() => (form.purchaseId ? getDemoGrns(form.purchaseId) : []), [form.purchaseId])

  const totals = useMemo(() => computeInvoiceTotals(form.items, form.charges), [form.items, form.charges])
  const outstanding = Math.max(totals.invoiceTotal - safeNumber(form.amountPaid), 0)
  const matchRows = useMemo(
    () => buildMatchRows({ items: form.items }, purchase, grns),
    [form.items, purchase, grns],
  )

  const update = (patch) => setForm((current) => ({ ...current, ...patch }))
  const updateCharge = (field, value) => setForm((current) => ({ ...current, charges: { ...current.charges, [field]: value } }))
  const updateItem = (index, field, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }))

  const handleSupplierChange = (supplierId) => {
    const snap = getDemoSupplierSnapshot(supplierId)
    update({
      supplierId,
      purchaseId: '',
      grnId: '',
      currency: snap?.purchaseCurrency ? snap.purchaseCurrency.split(' ')[0] : 'INR',
      items: [emptyItem()],
    })
  }

  const handlePurchaseChange = (purchaseId) => {
    const selected = purchaseId ? getDemoPurchase(purchaseId) : null
    const purchaseGrns = purchaseId ? getDemoGrns(purchaseId) : []
    update({
      purchaseId,
      grnId: purchaseGrns[purchaseGrns.length - 1]?.id || '',
      items: selected
        ? selected.items.map((item) => ({
            productId: item.productId,
            productName: item.productName || 'Item',
            sku: item.sku || '',
            uom: item.uom || 'unit',
            invoiceQty: safeNumber(item.quantity),
            unitPrice: safeNumber(item.purchasePrice),
            discount: safeNumber(item.discount),
            taxRate: safeNumber(item.tax),
          }))
        : [emptyItem()],
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitError('')

    const existingNumbers = form.supplierId
      ? getSupplierInvoiceNumbersForSupplier(form.supplierId, isEditing ? id : undefined)
      : []
    const error = validateSupplierInvoice(form, { existingNumbersForSupplier: existingNumbers })
    if (error) {
      setSubmitError(error)
      return
    }

    setIsSubmitting(true)
    const supplierName = demoSuppliers.find((s) => s.id === form.supplierId)?.name || ''
    const selectedPurchase = form.purchaseId ? getDemoPurchase(form.purchaseId) : null
    const selectedGrn = grns.find((grn) => grn.id === form.grnId)
    const payload = {
      supplierId: form.supplierId,
      supplierName,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || '',
      purchaseId: form.purchaseId || '',
      purchaseNumber: selectedPurchase?.purchaseNumber || selectedPurchase?.invoiceNumber || '',
      grnId: form.grnId || '',
      grnNumber: selectedGrn?.grnNumber || '',
      currency: form.currency || 'INR',
      paymentTerms: snapshot?.paymentTerms || '',
      notes: form.notes.trim(),
      charges: {
        freight: safeNumber(form.charges.freight),
        packing: safeNumber(form.charges.packing),
        insurance: safeNumber(form.charges.insurance),
        otherCharges: safeNumber(form.charges.otherCharges),
        roundOff: safeNumber(form.charges.roundOff),
      },
      items: form.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          uom: item.uom,
          invoiceQty: safeNumber(item.invoiceQty),
          unitPrice: safeNumber(item.unitPrice),
          discount: safeNumber(item.discount),
          taxRate: safeNumber(item.taxRate),
        })),
    }

    const saved = isEditing
      ? (patchDemoSupplierInvoice(id, payload), { id })
      : createDemoSupplierInvoice(payload)

    setIsSubmitting(false)
    showToast({ title: isEditing ? 'Supplier invoice updated' : 'Supplier invoice recorded', message: 'Simulated locally for demo mode.' })
    navigate(`${basePath}/${saved.id}`)
  }

  if (!demoOn) {
    return (
      <Card>
        <EmptyState
          icon={Save}
          title="Supplier invoicing not enabled"
          description={REAL_MODE_NOTE}
          action={{ label: 'Back to Supplier Invoices', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  if (notFound) {
    return (
      <Card>
        <EmptyState
          icon={Save}
          title="Supplier invoice not found"
          description="This demo supplier invoice may have been removed."
          action={{ label: 'Back to Supplier Invoices', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <button type="button" onClick={() => navigate(basePath)} className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-primary-700">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Supplier Invoices
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{isEditing ? 'Edit Supplier Invoice' : 'Add Supplier Invoice'}</h1>
        <p className="mt-1 text-sm text-neutral-500">Record what the supplier billed you, and compare it against the Purchase and Goods Receipt.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

        <Card title="Invoice Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Supplier" required options={supplierOptions} value={form.supplierId} onChange={(event) => handleSupplierChange(event.target.value)} />
            <Input label="Supplier Invoice Number" required value={form.supplierInvoiceNumber} onChange={(event) => update({ supplierInvoiceNumber: event.target.value })} placeholder="Vendor's invoice number" />
            <Input label="Invoice Date" type="date" required value={form.invoiceDate} onChange={(event) => update({ invoiceDate: event.target.value })} />
            <Input label="Due Date" type="date" value={form.dueDate} onChange={(event) => update({ dueDate: event.target.value })} />
            <Select
              label="Purchase Reference"
              options={[
                { value: '', label: form.supplierId ? 'Select purchase' : 'Select a supplier first' },
                ...supplierPurchases.map((p) => ({ value: p.id, label: p.purchaseNumber || p.invoiceNumber })),
              ]}
              value={form.purchaseId}
              onChange={(event) => handlePurchaseChange(event.target.value)}
              disabled={!form.supplierId}
            />
            <Select
              label="GRN Reference"
              options={[
                { value: '', label: form.purchaseId ? 'No GRN linked' : 'Select a purchase first' },
                ...grns.map((grn) => ({ value: grn.id, label: grn.grnNumber })),
              ]}
              value={form.grnId}
              onChange={(event) => update({ grnId: event.target.value })}
              disabled={!form.purchaseId}
            />
            <Input label="Currency" value={form.currency} onChange={(event) => update({ currency: event.target.value })} />
            <Input as="textarea" label="Notes" className="sm:col-span-2 lg:col-span-3" value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
          </div>
        </Card>

        {snapshot && (
          <Card title="Supplier Snapshot" subtitle="Read-only, from the supplier master.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SnapshotField label="Contact Person" value={snapshot.contactPerson} />
              <SnapshotField label="Phone" value={snapshot.phone} />
              <SnapshotField label="Email" value={snapshot.email} />
              <SnapshotField label="GSTIN" value={snapshot.gstNumber} />
              <SnapshotField label="Address" value={snapshot.address} />
              <SnapshotField label="Payment Terms" value={snapshot.paymentTerms} />
              <SnapshotField label="Purchase Currency" value={snapshot.purchaseCurrency} />
            </div>
          </Card>
        )}

        <Card
          title="Invoice Items"
          subtitle="Auto-filled from the Purchase. Adjust quantity or price to match the supplier's bill."
          className="p-0"
          bodyClassName="p-0"
          actions={
            <Button type="button" variant="secondary" size="sm" onClick={() => update({ items: [...form.items, emptyItem()] })}>
              <Plus className="size-4" aria-hidden="true" />
              Add Item
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">UOM</th>
                  <th className="px-3 py-2.5 text-right">Invoice Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Discount %</th>
                  <th className="px-3 py-2.5 text-right">Tax %</th>
                  <th className="px-3 py-2.5 text-right">Tax Amount</th>
                  <th className="px-3 py-2.5 text-right">Line Total</th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {form.items.map((item, index) => {
                  const line = computeInvoiceLine(item)
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{item.productName || '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-500">{item.sku || '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-500">{item.uom || '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" step="1" value={item.invoiceQty} onChange={(event) => updateItem(index, 'invoiceQty', event.target.value)} className="w-20 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" step="1" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" max="100" step="1" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" max="100" step="1" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right text-neutral-600">{formatCurrency(line.taxAmount)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(line.lineTotal)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => update({ items: form.items.filter((_, i) => i !== index) })} aria-label="Remove item" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {matchRows.length > 0 && (
          <Card title="Verification Preview" subtitle="We compare what was ordered, what was received, and what the supplier billed. Review only — nothing is blocked.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 px-3 text-right">Ordered</th>
                    <th className="py-2 px-3 text-right">Received</th>
                    <th className="py-2 px-3 text-right">Billed</th>
                    <th className="py-2 px-3 text-right">Purchase Cost</th>
                    <th className="py-2 px-3 text-right">Invoice Cost</th>
                    <th className="py-2 px-3 text-right">Qty Difference</th>
                    <th className="py-2 px-3 text-right">Price Difference</th>
                    <th className="py-2 pl-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {matchRows.map((row) => (
                    <tr key={row.productId}>
                      <td className="py-2 pr-3 font-medium text-neutral-900">{row.productName}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{row.orderedQty}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{row.receivedQty}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{row.invoiceQty}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{formatCurrency(row.purchaseUnitCost)}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{formatCurrency(row.invoiceUnitCost)}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{row.qtyVariance}</td>
                      <td className="py-2 px-3 text-right text-neutral-600">{formatCurrency(row.priceVariance)}</td>
                      <td className="py-2 pl-3"><Badge variant={row.match.variant}>{row.match.label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Other Charges" subtitle="Demo only — not part of a real payable yet.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['freight', 'Freight'],
                ['packing', 'Packing'],
                ['insurance', 'Insurance'],
                ['otherCharges', 'Other Charges'],
                ['roundOff', 'Round Off'],
              ].map(([key, label]) => (
                <Input key={key} label={label} type="number" step="1" value={form.charges[key]} onChange={(event) => updateCharge(key, event.target.value)} />
              ))}
            </div>
          </Card>

          <Card title="Commercial Summary">
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <Row label="Discount" value={`- ${formatCurrency(totals.discount)}`} />
              <Row label="Taxable Amount" value={formatCurrency(totals.taxableAmount)} />
              <Row label="Tax" value={formatCurrency(totals.tax)} />
              <Row label="Freight" value={formatCurrency(totals.freight)} />
              <Row label="Packing" value={formatCurrency(totals.packing)} />
              <Row label="Insurance" value={formatCurrency(totals.insurance)} />
              <Row label="Other Charges" value={formatCurrency(totals.otherCharges)} />
              <Row label="Round Off" value={formatCurrency(totals.roundOff)} />
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-base">
                <span className="font-semibold text-neutral-900">Invoice Total</span>
                <span className="font-semibold text-primary-700">{formatCurrency(totals.invoiceTotal)}</span>
              </div>
              {isEditing && (
                <>
                  <Row label="Amount Paid" value={formatCurrency(form.amountPaid)} />
                  <Row label="Outstanding" value={formatCurrency(outstanding)} />
                </>
              )}
              <p className="pt-2 text-xs text-neutral-500">Payments are recorded through Accounts Payable / Supplier Payments — not from this form.</p>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(basePath)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" aria-hidden="true" />
            {isEditing ? 'Save Changes' : 'Record Supplier Invoice'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800">{value}</span>
    </div>
  )
}
