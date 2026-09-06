import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageSearch, PackageX } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import {
  PURCHASE_RETURNS_DEMO_ENABLED,
  createDemoPurchaseReturn,
  demoReturnablePurchases,
  getDemoPurchaseReturn,
  updateDemoPurchaseReturn,
} from './purchaseReturnDemoData'
import { RETURN_REASONS } from './purchaseReturnHelpers'

const basePath = '/admin/purchase-returns'
const today = new Date().toISOString().slice(0, 10)
const reasonOptions = RETURN_REASONS.map((value) => ({ value, label: value }))

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(editId)

  const purchases = useMemo(() => (PURCHASE_RETURNS_DEMO_ENABLED ? demoReturnablePurchases() : []), [])

  const [purchaseId, setPurchaseId] = useState(searchParams.get('purchase') || '')
  const [returnQty, setReturnQty] = useState({}) // purchaseItemId -> number
  const [reason, setReason] = useState(RETURN_REASONS[0])
  const [otherReason, setOtherReason] = useState('')
  const [returnDate, setReturnDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    const record = getDemoPurchaseReturn(editId)
    if (!record) return
    setEditRecord(record)
    setPurchaseId(record.purchaseId)
    setReason(RETURN_REASONS.includes(record.returnReason) ? record.returnReason : 'Other')
    if (!RETURN_REASONS.includes(record.returnReason)) setOtherReason(record.returnReason || '')
    setReturnDate((record.returnDate || today).slice(0, 10))
    setNotes(record.notes || '')
    setReturnQty(Object.fromEntries(record.items.map((item) => [item.purchaseItemId, item.returnQty])))
  }, [isEdit, editId])

  const source = useMemo(() => purchases.find((entry) => entry.id === purchaseId) || null, [purchases, purchaseId])

  // When editing, the source line's "already returned" excludes this return's own quantity.
  const lines = useMemo(() => {
    if (!source) return []
    return source.items.map((line) => {
      const ownQty = editRecord ? Number(returnQty[line.purchaseItemId]) || 0 : 0
      const alreadyOther = Math.max(line.previouslyReturned - (editRecord ? editRecord.items.find((i) => i.purchaseItemId === line.purchaseItemId)?.returnQty || 0 : 0), 0)
      return {
        ...line,
        alreadyReturned: editRecord ? alreadyOther : line.previouslyReturned,
        returnableQty: editRecord ? Math.max(line.receivedQty - alreadyOther, 0) : line.returnableQty,
        _ownQty: ownQty,
      }
    })
  }, [source, editRecord, returnQty])

  const returnableLines = useMemo(() => lines.filter((line) => line.returnableQty > 0), [lines])
  const noReturnable = Boolean(source) && returnableLines.length === 0

  const resolvedReason = reason === 'Other' ? otherReason.trim() || 'Other' : reason

  const setQty = (line, value) => {
    const numeric = Math.round(Number(value))
    const clamped = Number.isNaN(numeric) ? 0 : Math.max(0, Math.min(numeric, line.returnableQty))
    setReturnQty((current) => ({ ...current, [line.purchaseItemId]: clamped }))
  }

  const validate = () => {
    if (!source) return 'Select a purchase with received goods first.'
    if (noReturnable) return 'All received quantities on this purchase have already been returned.'
    if (!resolvedReason) return 'A return reason is required.'
    if (reason === 'Other' && !otherReason.trim()) return 'Add the details for an "Other" reason.'
    const rows = returnableLines.filter((line) => (Number(returnQty[line.purchaseItemId]) || 0) > 0)
    if (rows.length === 0) return 'Enter a return quantity for at least one item.'
    const bad = rows.some((line) => {
      const qty = Number(returnQty[line.purchaseItemId])
      return !Number.isInteger(qty) || qty <= 0 || qty > line.returnableQty
    })
    if (bad) return 'Each return quantity must be a whole number within what is still returnable.'
    return ''
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const error = validate()
    if (error) {
      setSubmitError(error)
      return
    }
    setIsSubmitting(true)
    setSubmitError('')

    const items = returnableLines
      .filter((line) => (Number(returnQty[line.purchaseItemId]) || 0) > 0)
      .map((line) => ({
        purchaseItemId: line.purchaseItemId,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        receivedQty: line.receivedQty,
        previouslyReturned: line.alreadyReturned,
        returnQty: Number(returnQty[line.purchaseItemId]) || 0,
        unitPrice: line.unitPrice,
      }))

    if (isEdit && editRecord) {
      updateDemoPurchaseReturn(editRecord.id, { returnReason: resolvedReason, returnDate, notes: notes.trim(), items })
      navigate(`${basePath}/${encodeURIComponent(editRecord.id)}`)
      return
    }

    const record = createDemoPurchaseReturn({
      supplierId: source.supplierId,
      supplierName: source.supplierName,
      purchaseId: source.id,
      purchaseNumber: source.purchaseNumber,
      grnId: source.grnId,
      grnNumber: source.grnNumber,
      warehouseId: source.warehouseId,
      warehouseName: source.warehouseName,
      returnReason: resolvedReason,
      returnDate,
      notes: notes.trim(),
      items,
    })
    navigate(`${basePath}/${encodeURIComponent(record.id)}`)
  }

  if (!PURCHASE_RETURNS_DEMO_ENABLED) {
    return (
      <Card>
        <EmptyState
          icon={PackageX}
          title="Creating purchase returns isn't available yet"
          description="Returning received goods to a supplier will be available once the Purchase Return backend is enabled."
          action={{ label: 'Back to Purchase Returns', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{isEdit ? 'Edit Purchase Return' : 'New Purchase Return'}</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Pick a purchase with received goods — supplier and warehouse are derived from it.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="Source" subtitle="Purchase / Goods Receipt this return is against">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Purchase"
              options={purchases.map((entry) => ({
                value: entry.id,
                label: `${entry.purchaseNumber} · ${entry.supplierName}${entry.hasReturnable ? '' : ' (fully returned)'}`,
              }))}
              value={purchaseId}
              onChange={(event) => {
                setPurchaseId(event.target.value)
                setReturnQty({})
              }}
              placeholder="Select a purchase"
              disabled={isEdit}
            />
            <Input label="Supplier" value={source?.supplierName || ''} readOnly placeholder="Derived from the purchase" />
            <Input label="Goods Receipt (GRN)" value={source?.grnNumber || '—'} readOnly />
            <Input label="Receiving Warehouse" value={source?.warehouseName || '—'} readOnly />
          </div>
        </Card>

        {source && (
          <Card
            title="Items"
            subtitle="Only quantities still returnable (received − already returned) can be entered"
            className="p-0"
            bodyClassName="p-0"
          >
            {noReturnable ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-500">
                No returnable goods on this receipt — every received quantity has already been returned.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="whitespace-nowrap px-5 py-3">Product</th>
                      <th className="whitespace-nowrap px-5 py-3 text-right">Received</th>
                      <th className="whitespace-nowrap px-5 py-3 text-right">Already Returned</th>
                      <th className="whitespace-nowrap px-5 py-3 text-right">Returnable</th>
                      <th className="whitespace-nowrap px-5 py-3 text-right">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {returnableLines.map((line) => (
                      <tr key={line.purchaseItemId} className="transition-colors hover:bg-primary-50/35">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-neutral-800">{line.productName}</p>
                          {line.sku && <p className="mt-0.5 text-xs text-neutral-400">{line.sku}</p>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{line.receivedQty}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{line.alreadyReturned}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{line.returnableQty}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={line.returnableQty}
                            step="1"
                            value={returnQty[line.purchaseItemId] ?? ''}
                            onChange={(event) => setQty(line, event.target.value)}
                            className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm text-neutral-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card title="Return Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Return Reason" required options={reasonOptions} value={reason} onChange={(event) => setReason(event.target.value)} />
            <Input label="Return Date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
            {reason === 'Other' && (
              <Input
                label="Reason Details"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="Describe the reason"
                maxLength={100}
                className="sm:col-span-2"
              />
            )}
            <Input
              as="textarea"
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Internal remarks"
              className="sm:col-span-2"
            />
          </div>
        </Card>

        {submitError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(basePath)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={noReturnable}>
            <PackageSearch className="size-4" aria-hidden="true" />
            {isEdit ? 'Save Changes' : 'Create Draft Return'}
          </Button>
        </div>
      </form>
    </div>
  )
}
