import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { formatCurrency } from '../../utils/format'
import { DEMO_MODE } from '../../config/demoMode'
import { safeNumber } from '../purchases/purchaseHelpers'
import { demoSuppliers } from '../suppliers/supplierDemoData'
import { getDemoSupplierSnapshot, getDemoPurchase, getDemoPurchasesForSupplier } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import { listSuppliers } from '../../api/suppliers'
import { listSupplierPurchases, getPurchase } from '../../api/purchases'
import {
  createSupplierInvoice,
  getSupplierInvoice,
  updateSupplierInvoice,
} from '../../api/supplierInvoices'
import {
  buildMatchRows,
  computeInvoiceLine,
  computeInvoiceTotals,
  validateSupplierInvoice,
} from './supplierInvoiceHelpers'
import {
  createDemoSupplierInvoice,
  getDemoSupplierInvoice,
  getSupplierInvoiceNumbersForSupplier,
  isDemoSupplierInvoice,
  patchDemoSupplierInvoice,
} from './supplierInvoiceDemoData'

// Only these Purchase lifecycle states can be billed against.
const BILLABLE_PURCHASE_STATUSES = new Set(['confirmed', 'closed'])

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyItem() {
  return {
    productId: '',
    variantId: '',
    purchaseItemId: '',
    productName: '',
    sku: '',
    uom: 'unit',
    invoiceQty: 1,
    unitPrice: 0,
    discount: 0,
    taxRate: 0,
    purchasePrice: null,
    remainingInvoiceableQty: null,
  }
}

function emptyForm() {
  return {
    supplierId: '',
    supplierInvoiceNumber: '',
    invoiceDate: todayIso(),
    dueDate: '',
    purchaseId: '',
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

  const [form, setForm] = useState(emptyForm)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditing)

  // Real-mode reference data
  const [realSuppliers, setRealSuppliers] = useState([])
  const [realPurchases, setRealPurchases] = useState([])
  const [realSnapshot, setRealSnapshot] = useState(null)

  // ---- load reference data / existing invoice -----------------------------
  useEffect(() => {
    let active = true
    async function boot() {
      if (DEMO_MODE) {
        if (isEditing) {
          const existing = isDemoSupplierInvoice(id) ? getDemoSupplierInvoice(id) : null
          if (!existing) {
            setNotFound(true)
          } else {
            setForm({
              ...emptyForm(),
              ...existing,
              charges: { ...emptyForm().charges, ...(existing.charges || {}) },
              items: (existing.items || []).map((item) => ({ ...emptyItem(), ...item })),
            })
          }
        }
        setIsLoading(false)
        return
      }

      // Real mode
      const suppliersResult = await listSuppliers({ is_active: true })
      if (active && suppliersResult.success) setRealSuppliers(suppliersResult.suppliers)

      if (isEditing) {
        const result = await getSupplierInvoice(id)
        if (!active) return
        if (!result.success) {
          setNotFound(true)
          setIsLoading(false)
          return
        }
        const inv = result.invoice
        // Canonical rule: only a Draft supplier invoice is editable.
        if (inv.status !== 'draft') {
          navigate(`${basePath}/${id}`, { replace: true })
          return
        }
        setForm({
          ...emptyForm(),
          supplierId: inv.supplierId,
          supplierInvoiceNumber: inv.supplierInvoiceNumber,
          invoiceDate: (inv.invoiceDate || todayIso()).slice(0, 10),
          dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
          purchaseId: inv.purchaseId || '',
          notes: inv.notes || '',
          items: (inv.items || []).map((item) => ({
            ...emptyItem(),
            productId: item.productId,
            variantId: item.variantId || '',
            purchaseItemId: item.purchaseItemId || '',
            productName: item.productName || 'Item',
            sku: item.sku || '',
            uom: item.uom || 'unit',
            invoiceQty: safeNumber(item.billedQty),
            unitPrice: safeNumber(item.unitPrice),
            discount: safeNumber(item.discount),
            taxRate: safeNumber(item.tax),
            purchasePrice: item.purchasePrice,
            remainingInvoiceableQty: item.remainingInvoiceableQty,
          })),
        })
        if (inv.supplierId) {
          const purchasesResult = await listSupplierPurchases(inv.supplierId)
          if (active && purchasesResult.success) {
            setRealPurchases(purchasesResult.purchases.filter((p) => BILLABLE_PURCHASE_STATUSES.has(String(p.status).toLowerCase())))
          }
        }
      }
      if (active) setIsLoading(false)
    }
    boot()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing])

  // ---- demo derived data --------------------------------------------------
  const demoSnapshot = useMemo(
    () => (DEMO_MODE && form.supplierId ? getDemoSupplierSnapshot(form.supplierId) : null),
    [form.supplierId],
  )
  const demoPurchases = useMemo(
    () => (DEMO_MODE && form.supplierId ? getDemoPurchasesForSupplier(form.supplierId) : []),
    [form.supplierId],
  )
  const demoPurchase = useMemo(() => (DEMO_MODE && form.purchaseId ? getDemoPurchase(form.purchaseId) : null), [form.purchaseId])
  const demoGrns = useMemo(() => (DEMO_MODE && form.purchaseId ? getDemoGrns(form.purchaseId) : []), [form.purchaseId])

  const snapshot = DEMO_MODE ? demoSnapshot : realSnapshot
  const supplierOptions = useMemo(() => {
    const base = DEMO_MODE
      ? demoSuppliers.map((s) => ({ value: s.id, label: s.name }))
      : realSuppliers.map((s) => ({ value: s.id, label: s.name }))
    return [{ value: '', label: 'Select supplier' }, ...base]
  }, [realSuppliers])

  const purchaseOptions = useMemo(() => {
    const list = DEMO_MODE
      ? demoPurchases
      : realPurchases
    return [
      { value: '', label: form.supplierId ? 'Select purchase (optional)' : 'Select a supplier first' },
      ...list.map((p) => ({ value: p.id, label: p.purchaseNumber || p.invoiceNumber })),
    ]
  }, [demoPurchases, realPurchases, form.supplierId])

  const totals = useMemo(() => computeInvoiceTotals(form.items, form.charges), [form.items, form.charges])
  const outstanding = Math.max(totals.invoiceTotal - safeNumber(form.amountPaid), 0)
  const matchRows = useMemo(
    () => (DEMO_MODE ? buildMatchRows({ items: form.items }, demoPurchase, demoGrns) : []),
    [form.items, demoPurchase, demoGrns],
  )

  // Frontend over-invoicing guard (backend is authoritative). Only fires where the remaining
  // invoiceable quantity is known.
  const overInvoiceLines = useMemo(
    () =>
      form.items
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) =>
            item.remainingInvoiceableQty != null &&
            safeNumber(item.invoiceQty) > safeNumber(item.remainingInvoiceableQty),
        ),
    [form.items],
  )

  const update = (patch) => setForm((current) => ({ ...current, ...patch }))
  const updateCharge = (field, value) => setForm((current) => ({ ...current, charges: { ...current.charges, [field]: value } }))
  const updateItem = (index, field, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }))

  const handleSupplierChange = async (supplierId) => {
    update({ supplierId, purchaseId: '', items: [emptyItem()] })
    if (DEMO_MODE) {
      const snap = getDemoSupplierSnapshot(supplierId)
      update({ supplierId, purchaseId: '', currency: snap?.purchaseCurrency ? snap.purchaseCurrency.split(' ')[0] : 'INR', items: [emptyItem()] })
      return
    }
    setRealPurchases([])
    setRealSnapshot(null)
    if (!supplierId) return
    const result = await listSupplierPurchases(supplierId)
    if (result.success) {
      setRealPurchases(result.purchases.filter((p) => BILLABLE_PURCHASE_STATUSES.has(String(p.status).toLowerCase())))
    }
  }

  const prefillFromPurchase = (purchase) => {
    if (!purchase) return [emptyItem()]
    return (purchase.items || []).map((item) => {
      const ordered = safeNumber(item.orderedQty ?? item.quantity)
      const received = safeNumber(item.receivedQty)
      const remaining =
        item.remainingInvoiceableQty != null
          ? safeNumber(item.remainingInvoiceableQty)
          : received > 0
            ? received
            : ordered
      return {
        ...emptyItem(),
        productId: item.productId,
        variantId: item.variantId || '',
        purchaseItemId: item.id || item.purchaseItemId || '',
        productName: item.productName || 'Item',
        sku: item.sku || '',
        uom: item.uom || 'unit',
        invoiceQty: remaining || 1,
        unitPrice: safeNumber(item.purchasePrice),
        discount: safeNumber(item.discount),
        taxRate: safeNumber(item.tax),
        purchasePrice: safeNumber(item.purchasePrice),
        remainingInvoiceableQty: item.remainingInvoiceableQty != null ? safeNumber(item.remainingInvoiceableQty) : null,
      }
    })
  }

  const handlePurchaseChange = async (purchaseId) => {
    if (DEMO_MODE) {
      const selected = purchaseId ? getDemoPurchase(purchaseId) : null
      update({
        purchaseId,
        items: selected
          ? selected.items.map((item) => ({
              ...emptyItem(),
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
      return
    }
    update({ purchaseId })
    if (!purchaseId) {
      update({ purchaseId: '', items: [emptyItem()] })
      return
    }
    const result = await getPurchase(purchaseId)
    if (result.success) update({ purchaseId, items: prefillFromPurchase(result.purchase) })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (DEMO_MODE) {
      const existingNumbers = form.supplierId
        ? getSupplierInvoiceNumbersForSupplier(form.supplierId, isEditing ? id : undefined)
        : []
      const error = validateSupplierInvoice(form, { existingNumbersForSupplier: existingNumbers })
      if (error) return setSubmitError(error)
      setIsSubmitting(true)
      const supplierName = demoSuppliers.find((s) => s.id === form.supplierId)?.name || ''
      const selectedPurchase = form.purchaseId ? getDemoPurchase(form.purchaseId) : null
      const payload = {
        supplierId: form.supplierId,
        supplierName,
        supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || '',
        purchaseId: form.purchaseId || '',
        purchaseNumber: selectedPurchase?.purchaseNumber || selectedPurchase?.invoiceNumber || '',
        currency: form.currency || 'INR',
        paymentTerms: demoSnapshot?.paymentTerms || '',
        notes: form.notes.trim(),
        charges: { ...form.charges },
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
      const saved = isEditing ? (patchDemoSupplierInvoice(id, payload), { id }) : createDemoSupplierInvoice(payload)
      setIsSubmitting(false)
      showToast({ title: isEditing ? 'Supplier invoice updated' : 'Supplier invoice saved as Draft', message: 'Simulated locally for demo mode.' })
      navigate(`${basePath}/${saved.id}`)
      return
    }

    // Real mode
    const localError = validateSupplierInvoice(
      { ...form, items: form.items.map((i) => ({ ...i, invoiceQty: i.invoiceQty })) },
      { existingNumbersForSupplier: [] },
    )
    if (localError) return setSubmitError(localError)

    setIsSubmitting(true)
    const body = {
      supplierId: form.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || undefined,
      purchaseId: form.purchaseId || undefined,
      notes: form.notes.trim(),
      items: form.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          variantId: item.variantId || undefined,
          purchaseItemId: item.purchaseItemId || undefined,
          billedQty: safeNumber(item.invoiceQty),
          unitPrice: safeNumber(item.unitPrice),
          discount: safeNumber(item.discount),
          tax: safeNumber(item.taxRate),
        })),
    }
    const result = isEditing ? await updateSupplierInvoice(id, body) : await createSupplierInvoice(body)
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error)
      return
    }
    showToast({ title: isEditing ? 'Supplier invoice updated.' : 'Supplier invoice saved as Draft.', message: 'Record it to run 3-way verification.' })
    navigate(`${basePath}/${result.invoice.id}`)
  }

  if (isLoading) return <LoadingSpinner label="Loading..." />

  if (notFound) {
    return (
      <Card>
        <EmptyState
          icon={Save}
          title="Supplier invoice not found"
          description="This supplier invoice may have been removed."
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
        <p className="mt-1 text-sm text-neutral-500">
          Record what the supplier billed you. Saved as a Draft — recording runs the 3-way match against confirmed received quantities for the Purchase.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

        <Card title="Invoice Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Supplier" required options={supplierOptions} value={form.supplierId} onChange={(event) => handleSupplierChange(event.target.value)} disabled={isEditing} />
            <Input label="Supplier Invoice Number" required value={form.supplierInvoiceNumber} onChange={(event) => update({ supplierInvoiceNumber: event.target.value })} placeholder="Vendor's invoice number" />
            <Input label="Invoice Date" type="date" required value={form.invoiceDate} onChange={(event) => update({ invoiceDate: event.target.value })} />
            <Input label="Due Date" type="date" value={form.dueDate} onChange={(event) => update({ dueDate: event.target.value })} />
            <Select
              label="Purchase Reference"
              options={purchaseOptions}
              value={form.purchaseId}
              onChange={(event) => handlePurchaseChange(event.target.value)}
              disabled={!form.supplierId}
            />
            <Input as="textarea" label="Notes" className="sm:col-span-2 lg:col-span-3" value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
          </div>
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
            No goods-receipt selector — 3-way matching uses the cumulative accepted quantity from <em>all</em> confirmed GRNs for this Purchase.
          </p>
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
            </div>
          </Card>
        )}

        <Card
          title="Invoice Items"
          subtitle="Auto-filled from the Purchase. Adjust quantity or price to match the supplier's bill — a price difference is allowed and flagged after recording."
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
                  <th className="px-3 py-2.5 text-right">Purchase Price</th>
                  <th className="px-3 py-2.5 text-right">Remaining Invoiceable</th>
                  <th className="px-3 py-2.5 text-right">Billed Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Discount %</th>
                  <th className="px-3 py-2.5 text-right">Tax %</th>
                  <th className="px-3 py-2.5 text-right">Line Total</th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {form.items.map((item, index) => {
                  const line = computeInvoiceLine({ ...item, invoiceQty: item.invoiceQty })
                  const over =
                    item.remainingInvoiceableQty != null &&
                    safeNumber(item.invoiceQty) > safeNumber(item.remainingInvoiceableQty)
                  const priceMismatch =
                    item.purchasePrice != null && safeNumber(item.unitPrice) !== safeNumber(item.purchasePrice)
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{item.productName || '—'}</td>
                      <td className="px-3 py-2.5 text-neutral-500">{item.sku || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-500">{item.purchasePrice != null ? formatCurrency(item.purchasePrice) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-500">{item.remainingInvoiceableQty != null ? item.remainingInvoiceableQty : '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.invoiceQty}
                          onChange={(event) => updateItem(index, 'invoiceQty', event.target.value)}
                          className={`w-20 rounded-lg border bg-white px-2.5 py-1.5 text-right text-sm ${over ? 'border-amber-400' : 'border-neutral-200'}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(index, 'unitPrice', event.target.value)}
                          className={`w-24 rounded-lg border bg-white px-2.5 py-1.5 text-right text-sm ${priceMismatch ? 'border-amber-400' : 'border-neutral-200'}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" max="100" step="1" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min="0" max="100" step="1" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                      </td>
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

        {overInvoiceLines.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Billed quantity exceeds the remaining invoiceable quantity</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {overInvoiceLines.map(({ item, index }) => (
                  <li key={index}>
                    {item.productName || 'Item'} — billing {safeNumber(item.invoiceQty)}, only {safeNumber(item.remainingInvoiceableQty)} still invoiceable.
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">The backend blocks cumulative over-invoicing against confirmed receipts — this record may be rejected.</p>
            </div>
          </div>
        )}

        {DEMO_MODE && matchRows.length > 0 && (
          <Card title="Verification Preview" subtitle="Compares ordered vs received vs billed. Review only — nothing is blocked here.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 px-3 text-right">Ordered</th>
                    <th className="py-2 px-3 text-right">Received</th>
                    <th className="py-2 px-3 text-right">Billed</th>
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

        {DEMO_MODE && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Other Charges" subtitle="Demo only.">
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
              </div>
            </Card>
          </div>
        )}

        {!DEMO_MODE && (
          <Card title="Commercial Summary" subtitle="Preview only — the backend is authoritative for every total.">
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <Row label="Discount" value={`- ${formatCurrency(totals.discount)}`} />
              <Row label="Tax" value={formatCurrency(totals.tax)} />
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-base">
                <span className="font-semibold text-neutral-900">Invoice Total (preview)</span>
                <span className="font-semibold text-primary-700">{formatCurrency(totals.invoiceTotal)}</span>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(basePath)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" aria-hidden="true" />
            {isEditing ? 'Save Changes' : 'Save Draft'}
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
