import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PackageSearch, PackageX, Search } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import {
  PURCHASE_RETURNS_DEMO_ENABLED,
  createDemoPurchaseReturn,
  demoReturnablePurchases,
  getDemoPurchaseReturn,
  updateDemoPurchaseReturn,
} from './purchaseReturnDemoData'
import { getPurchase, listPurchases } from '../../api/purchases'
import { createPurchaseReturn, getPurchaseReturn, listPurchaseReturns, updatePurchaseReturn } from '../../api/purchaseReturns'
import { RETURN_REASONS } from './purchaseReturnHelpers'

const basePath = '/admin/purchase-returns'
const today = new Date().toISOString().slice(0, 10)
const reasonOptions = RETURN_REASONS.map((value) => ({ value, label: value }))

// How many pages of this purchase's return history to walk before giving up - a safety cap, not
// an assumption that history ever gets this deep for one purchase.
const RETURN_HISTORY_PAGE_SIZE = 100
const RETURN_HISTORY_MAX_PAGES = 20

// Previously-returned qty per purchase item for exactly ONE purchase - paginates through
// GET /purchase-returns?purchase_id=... until every page is read (never assumes page 1 of 100 is
// the whole history), and excludes cancelled returns per the backend's eligibility rule
// (received_qty - sum(non-cancelled previous returns)). Only called after a purchase is
// selected - never looped across many purchases.
async function fetchPreviouslyReturnedByItem(targetPurchaseId) {
  const returnedByItem = {}
  let page = 1
  let loadedCount = 0
  let total = Infinity

  while (page <= RETURN_HISTORY_MAX_PAGES && loadedCount < total) {
    const result = await listPurchaseReturns({ purchaseId: targetPurchaseId, page, pageSize: RETURN_HISTORY_PAGE_SIZE })
    if (!result.success) return { success: false, error: result.error }

    result.purchaseReturns
      .filter((pr) => pr.status !== 'cancelled')
      .forEach((pr) => {
        pr.items.forEach((item) => {
          returnedByItem[item.purchaseItemId] = (returnedByItem[item.purchaseItemId] || 0) + (Number(item.returnQty) || 0)
        })
      })

    loadedCount += result.purchaseReturns.length
    total = result.total ?? loadedCount
    if (result.purchaseReturns.length === 0) break
    page += 1
  }

  return { success: true, returnedByItem }
}

// Real-mode equivalent of purchaseReturnDemoData.js#demoReturnablePurchases() for ONE purchase -
// same output shape, built from GET /purchases/{id} (received_qty already rolled up server-side
// per item) minus history from fetchPreviouslyReturnedByItem. Called only once a purchase has
// been selected, never for every purchase in a list.
async function buildReturnableSource(targetPurchaseId) {
  const [purchaseResult, returnedResult] = await Promise.all([
    getPurchase(targetPurchaseId),
    fetchPreviouslyReturnedByItem(targetPurchaseId),
  ])

  if (!purchaseResult.success) return { success: false, error: purchaseResult.error }
  if (!returnedResult.success) return { success: false, error: returnedResult.error }

  const purchase = purchaseResult.purchase
  const items = purchase.items
    .filter((item) => item.receivedQty > 0)
    .map((item) => {
      const already = returnedResult.returnedByItem[item.id] || 0
      return {
        purchaseItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        receivedQty: item.receivedQty,
        previouslyReturned: already,
        returnableQty: Math.max(item.receivedQty - already, 0),
        unitPrice: item.purchasePrice ?? 0,
      }
    })

  return {
    success: true,
    source: {
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber || purchase.invoiceNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      warehouseId: purchase.warehouseId,
      warehouseName: purchase.warehouseName || '',
      grnId: '',
      grnNumber: '',
      items,
      hasReturnable: items.some((line) => line.returnableQty > 0),
    },
  }
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(editId)

  // Demo mode only: the full flat list demoReturnablePurchases() already preloads (small, finite,
  // no real-backend scaling concern). Real mode never preloads a purchase list - see
  // selectedPurchase/purchase search below.
  const [purchases, setPurchases] = useState([])
  const [isLoadingDemoSource, setIsLoadingDemoSource] = useState(PURCHASE_RETURNS_DEMO_ENABLED)

  // Real mode purchase search (debounced, server-side via listPurchases({search})) - replaces a
  // preloaded, capped list so any eligible purchase can be found, not just the first N.
  const [purchaseQuery, setPurchaseQuery] = useState('')
  const [purchaseOptions, setPurchaseOptions] = useState([])
  const [isSearchingPurchases, setIsSearchingPurchases] = useState(false)
  const [purchaseSearchError, setPurchaseSearchError] = useState('')

  // Real mode: the one selected purchase's full item/return-history data, loaded only after
  // selection (never for every candidate purchase - see buildReturnableSource above).
  const [selectedPurchase, setSelectedPurchase] = useState(null)
  const [isLoadingSelected, setIsLoadingSelected] = useState(false)
  const [selectedError, setSelectedError] = useState('')

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
    if (!PURCHASE_RETURNS_DEMO_ENABLED) return
    setIsLoadingDemoSource(true)
    setPurchases(demoReturnablePurchases())
    setIsLoadingDemoSource(false)
  }, [])

  // Debounced server-side purchase search - only while picking a new purchase in real mode.
  useEffect(() => {
    if (PURCHASE_RETURNS_DEMO_ENABLED || isEdit) return
    const query = purchaseQuery.trim()
    if (!query) {
      setPurchaseOptions([])
      setPurchaseSearchError('')
      return
    }
    let isCurrent = true
    const handle = setTimeout(async () => {
      setIsSearchingPurchases(true)
      setPurchaseSearchError('')
      const result = await listPurchases({ search: query, limit: 25 })
      if (!isCurrent) return
      setIsSearchingPurchases(false)
      if (!result.success) {
        setPurchaseOptions([])
        setPurchaseSearchError(result.error)
        return
      }
      setPurchaseOptions(
        result.purchases
          .filter((purchase) => purchase.items.some((item) => item.receivedQty > 0))
          .map((purchase) => ({
            id: purchase.id,
            purchaseNumber: purchase.purchaseNumber || purchase.invoiceNumber,
            supplierName: purchase.supplierName,
          })),
      )
    }, 350)
    return () => {
      isCurrent = false
      clearTimeout(handle)
    }
  }, [purchaseQuery, isEdit])

  // Load the one selected purchase's returnable items + return history - fires on manual
  // selection and on edit-mode preload alike, since both just set purchaseId.
  const loadSelectedPurchase = useCallback(async () => {
    if (PURCHASE_RETURNS_DEMO_ENABLED || !purchaseId) {
      setSelectedPurchase(null)
      return
    }
    setIsLoadingSelected(true)
    setSelectedError('')
    const result = await buildReturnableSource(purchaseId)
    setIsLoadingSelected(false)
    if (!result.success) {
      setSelectedPurchase(null)
      setSelectedError(result.error)
      return
    }
    setSelectedPurchase(result.source)
  }, [purchaseId])

  useEffect(() => {
    loadSelectedPurchase()
  }, [loadSelectedPurchase])

  useEffect(() => {
    if (!isEdit) return
    let isMounted = true

    async function loadEditRecord() {
      if (PURCHASE_RETURNS_DEMO_ENABLED) {
        const record = getDemoPurchaseReturn(editId)
        if (!record || !isMounted) return
        applyEditRecord(record)
        return
      }
      const result = await getPurchaseReturn(editId)
      if (!isMounted || !result.success) return
      applyEditRecord(result.purchaseReturn)
    }

    function applyEditRecord(record) {
      setEditRecord(record)
      setPurchaseId(record.purchaseId)
      setReason(RETURN_REASONS.includes(record.returnReason) ? record.returnReason : 'Other')
      if (!RETURN_REASONS.includes(record.returnReason)) setOtherReason(record.returnReason || '')
      setReturnDate((record.returnDate || today).slice(0, 10))
      setNotes(record.notes || '')
      setReturnQty(Object.fromEntries(record.items.map((item) => [item.purchaseItemId, item.returnQty])))
    }

    loadEditRecord()
    return () => {
      isMounted = false
    }
  }, [isEdit, editId])

  const demoSource = useMemo(() => purchases.find((entry) => entry.id === purchaseId) || null, [purchases, purchaseId])
  const source = PURCHASE_RETURNS_DEMO_ENABLED ? demoSource : selectedPurchase

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

  const handleSubmit = async (event) => {
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
        // Backend accepts a per-item reason; this form only collects one overall reason, so the
        // same value rides on every item rather than asking the user to repeat themselves.
        reason: resolvedReason,
      }))

    if (PURCHASE_RETURNS_DEMO_ENABLED) {
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
      return
    }

    if (isEdit && editRecord) {
      const result = await updatePurchaseReturn(editRecord.id, { reason: resolvedReason, returnDate, notes: notes.trim(), items })
      setIsSubmitting(false)
      if (!result.success) {
        setSubmitError(result.error)
        return
      }
      navigate(`${basePath}/${encodeURIComponent(editRecord.id)}`)
      return
    }

    const result = await createPurchaseReturn({
      purchaseId: source.id,
      supplierId: source.supplierId,
      warehouseId: source.warehouseId,
      returnDate,
      reason: resolvedReason,
      notes: notes.trim(),
      items,
    })
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error)
      return
    }
    navigate(`${basePath}/${encodeURIComponent(result.purchaseReturn.id)}`)
  }

  if (PURCHASE_RETURNS_DEMO_ENABLED && isLoadingDemoSource) {
    return (
      <Card>
        <LoadingSpinner label="Loading purchases with received goods..." />
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
            {PURCHASE_RETURNS_DEMO_ENABLED ? (
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
            ) : (
              <div className="relative">
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Purchase</label>
                {purchaseId ? (
                  <div className="flex h-10 items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm">
                    <span className="truncate font-medium text-neutral-800">
                      {isLoadingSelected
                        ? 'Loading…'
                        : selectedPurchase
                          ? `${selectedPurchase.purchaseNumber} · ${selectedPurchase.supplierName}${selectedPurchase.hasReturnable ? '' : ' (fully returned)'}`
                          : purchaseId}
                    </span>
                    {!isEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setPurchaseId('')
                          setReturnQty({})
                          setPurchaseQuery('')
                        }}
                        className="shrink-0 pl-3 text-xs font-medium text-primary-600 hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="search"
                        value={purchaseQuery}
                        onChange={(event) => setPurchaseQuery(event.target.value)}
                        placeholder="Search purchase # or supplier"
                        className="h-10 w-full rounded-xl border border-neutral-200 bg-surface py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                      />
                    </div>
                    {purchaseQuery.trim() && (
                      <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-100 bg-(--modal-bg) py-1 shadow-lg">
                        {isSearchingPurchases ? (
                          <div className="px-3.5 py-3 text-sm text-neutral-400">Searching…</div>
                        ) : purchaseSearchError ? (
                          <div className="px-3.5 py-3 text-sm text-red-600">{purchaseSearchError}</div>
                        ) : purchaseOptions.length === 0 ? (
                          <div className="px-3.5 py-3 text-sm text-neutral-400">No purchases with received goods match.</div>
                        ) : (
                          purchaseOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setPurchaseId(option.id)
                                setPurchaseQuery('')
                                setReturnQty({})
                              }}
                              className="block w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-primary-50/50"
                            >
                              <span className="font-medium text-neutral-800">{option.purchaseNumber}</span>
                              <span className="text-neutral-500"> · {option.supplierName}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <Input label="Supplier" value={source?.supplierName || ''} readOnly placeholder="Derived from the purchase" />
            <Input label="Goods Receipt (GRN)" value={source?.grnNumber || '—'} readOnly />
            <Input label="Receiving Warehouse" value={source?.warehouseName || '—'} readOnly />
          </div>
        </Card>

        {!PURCHASE_RETURNS_DEMO_ENABLED && purchaseId && isLoadingSelected && (
          <Card>
            <LoadingSpinner label="Loading this purchase's items and return history…" />
          </Card>
        )}

        {!PURCHASE_RETURNS_DEMO_ENABLED && selectedError && (
          <Card>
            <EmptyState
              icon={PackageX}
              title="Unable to load this purchase"
              description={selectedError}
              action={{ label: 'Retry', onClick: loadSelectedPurchase }}
            />
          </Card>
        )}

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
                            className="w-24 rounded-lg border border-neutral-200 bg-surface px-2.5 py-1.5 text-right text-sm text-neutral-900"
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
