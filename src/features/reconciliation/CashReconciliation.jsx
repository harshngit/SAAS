import { ListHeader, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Info, RefreshCw, Scale, Trash2, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import ActionMenu from '../../components/ui/ActionMenu'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import {
  closeCashReconciliation,
  createCashReconciliation,
  deleteCashReconciliation,
  getCashReconciliationForDate,
  getCashReconciliationPreview,
  listCashReconciliations,
  updateCashReconciliation,
} from '../../api/cashReconciliation'
import { formatCurrency, toLocalDateString } from '../../utils/format'

const VARIANCE_REASONS = [
  { value: '', label: 'Select a reason…' },
  { value: 'Cash shortage', label: 'Cash shortage' },
  { value: 'Rounding', label: 'Rounding' },
  { value: 'Incorrect entry', label: 'Incorrect entry' },
  { value: 'Late bank settlement', label: 'Late bank settlement' },
  { value: 'Unrecorded expense', label: 'Unrecorded expense' },
  { value: 'Other', label: 'Other' },
]

const HISTORY_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
]

// Humanizes a backend payment_method for display only - every distinct method the backend sends
// gets its own row; this never merges/collapses one method into another (§5 of the integration
// brief - cheque and cod stay their own rows, never silently folded into bank_transfer/cash).
const PAYMENT_METHOD_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank Transfer', cheque: 'Cheque', cod: 'COD' }
function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || String(method || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

const todayIso = () => toLocalDateString()
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(value)} · ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
}

function varianceToneClass(value) {
  if (Math.abs(value) < 0.005) return 'text-neutral-900'
  return value > 0 ? 'text-primary-700' : 'text-red-600'
}
function signedCurrency(value) {
  return `${value > 0 ? '+' : ''}${formatCurrency(value)}`
}

// Controlled money input shared by every editable amount field (§14) - never step="1", never
// lets a negative value be typed, decimal-friendly on mobile keyboards.
function MoneyInput({ value, onChange, disabled, className = '' }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      disabled={disabled}
      value={value}
      onChange={(event) => {
        const next = event.target.value
        if (next.startsWith('-')) return
        onChange(next)
      }}
      placeholder="0.00"
      className={`rounded-lg border border-neutral-200 bg-surface px-2.5 py-1.5 text-right text-sm disabled:bg-neutral-50 disabled:text-neutral-500 ${className}`}
    />
  )
}

export default function CashReconciliation() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const canCreate = can('payments', 'create')
  const canEdit = can('payments', 'edit')
  const canDelete = can('payments', 'delete')

  const [date, setDate] = useState(todayIso())
  const [reconciliation, setReconciliation] = useState(null) // the real saved record for this date, or null
  const [movement, setMovement] = useState(null) // { cashSales, cashReceived, cashPaid, expensesPaid } from record or preview
  const [expectedByMethod, setExpectedByMethod] = useState({}) // paymentMethod -> expectedAmount (backend-controlled)

  const [openingBalance, setOpeningBalance] = useState('')
  const [actualCashOnHand, setActualCashOnHand] = useState('')
  const [detailRows, setDetailRows] = useState([]) // [{ paymentMethod, actualAmount }]
  const [varianceReason, setVarianceReason] = useState('')
  const [notes, setNotes] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const { sortBy: historySortBy, sortOrder: historySortOrder, toggleSort: toggleHistorySort, sortParams: historySortParams } = useSortState()

  const handleHistorySort = (field) => {
    toggleHistorySort(field)
    setHistoryPage(1)
  }
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [detailRecord, setDetailRecord] = useState(null)

  const hydrateFromRecord = (record) => {
    setOpeningBalance(String(record.openingBalance))
    setActualCashOnHand(String(record.actualCashOnHand))
    setDetailRows(record.details.map((row) => ({ paymentMethod: row.paymentMethod, actualAmount: String(row.actualAmount) })))
    setExpectedByMethod(Object.fromEntries(record.details.map((row) => [row.paymentMethod, row.expectedAmount])))
    setMovement({ cashSales: record.cashSales, cashReceived: record.cashReceived, cashPaid: record.cashPaid, expensesPaid: record.expensesPaid })
    setVarianceReason(record.varianceReason || '')
    setNotes(record.notes || '')
  }

  const hydrateFromPreview = (preview) => {
    setOpeningBalance(String(preview.openingBalance))
    setActualCashOnHand('')
    setDetailRows(preview.details.map((row) => ({ paymentMethod: row.paymentMethod, actualAmount: '' })))
    setExpectedByMethod(Object.fromEntries(preview.details.map((row) => [row.paymentMethod, row.expectedAmount])))
    setMovement({ cashSales: preview.cashSales, cashReceived: preview.cashReceived, cashPaid: preview.cashPaid, expensesPaid: preview.expensesPaid })
    setVarianceReason('')
    setNotes('')
  }

  // §4: for-date first; a 404/no-record resolves to {reconciliation: null} (never a page error),
  // and only then does the preview get loaded to populate a brand-new day's starting figures.
  const loadForDate = useCallback(async (forDate) => {
    setIsLoading(true)
    setLoadError('')
    setSaveError('')
    setCloseError('')
    const result = await getCashReconciliationForDate(forDate)
    if (!result.success) {
      setReconciliation(null)
      setMovement(null)
      setLoadError(result.error)
      setIsLoading(false)
      return
    }
    if (result.reconciliation) {
      setReconciliation(result.reconciliation)
      hydrateFromRecord(result.reconciliation)
      setIsLoading(false)
      return
    }
    const previewResult = await getCashReconciliationPreview(forDate)
    setIsLoading(false)
    if (!previewResult.success) {
      setReconciliation(null)
      setMovement(null)
      setLoadError(previewResult.error)
      return
    }
    setReconciliation(null)
    hydrateFromPreview(previewResult.preview)
  }, [])

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    setHistoryError('')
    const result = await listCashReconciliations({
      date_from: historyDateFrom || undefined,
      date_to: historyDateTo || undefined,
      status: historyStatus || undefined,
      page: historyPage,
      page_size: 10,
      ...historySortParams,
    })
    setIsLoadingHistory(false)
    if (!result.success) {
      setHistoryError(result.error)
      return
    }
    setHistory(result.reconciliations)
    setHistoryTotal(result.total)
    setHistoryTotalPages(result.totalPages || 1)
  }, [historyDateFrom, historyDateTo, historyStatus, historyPage, historySortParams])

  useEffect(() => {
    loadForDate(date)
  }, [date, loadForDate])

  // History loads independently - one history failure must never block the current-date form.
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const isExisting = Boolean(reconciliation)
  const isClosed = reconciliation?.status === 'closed'
  const canEditForm = isExisting ? !isClosed && canEdit : canCreate
  const canCloseNow = canEdit && !isClosed
  const canDeleteDraft = isExisting && !isClosed && canDelete

  const liveDetailRows = useMemo(
    () =>
      detailRows.map((row) => {
        const expected = expectedByMethod[row.paymentMethod] ?? 0
        const actual = Number(row.actualAmount) || 0
        return { ...row, expectedAmount: expected, actual, variance: round2(actual - expected) }
      }),
    [detailRows, expectedByMethod],
  )

  const liveTotalExpected = round2(liveDetailRows.reduce((sum, row) => sum + row.expectedAmount, 0))
  const liveTotalActual = round2(liveDetailRows.reduce((sum, row) => sum + row.actual, 0))
  const liveCollectionsVariance = round2(liveTotalActual - liveTotalExpected)
  const liveExpectedClosingCash = movement
    ? round2((Number(openingBalance) || 0) + movement.cashSales + movement.cashReceived - movement.cashPaid - movement.expensesPaid)
    : 0
  const liveCashBalanceVariance = round2((Number(actualCashOnHand) || 0) - liveExpectedClosingCash)

  // §6/§7: a closed record's totals are the frozen, authoritative backend snapshot - never
  // recomputed from form state. A draft (or a brand-new, not-yet-saved preview) shows the live
  // in-progress calculation, which becomes authoritative again the moment the backend responds.
  const summary = isClosed
    ? {
        totalExpectedCollections: reconciliation.totalExpectedCollections,
        totalActualCollections: reconciliation.totalActualCollections,
        collectionsVariance: reconciliation.collectionsVariance,
        expectedClosingCash: reconciliation.expectedClosingCash,
        actualCashOnHand: reconciliation.actualCashOnHand,
        cashBalanceVariance: reconciliation.cashBalanceVariance,
      }
    : {
        totalExpectedCollections: liveTotalExpected,
        totalActualCollections: liveTotalActual,
        collectionsVariance: liveCollectionsVariance,
        expectedClosingCash: liveExpectedClosingCash,
        actualCashOnHand: Number(actualCashOnHand) || 0,
        cashBalanceVariance: liveCashBalanceVariance,
      }

  const hasAnyActualEntered = detailRows.some((row) => row.actualAmount !== '') || actualCashOnHand !== ''
  const needsVarianceReason =
    !isClosed && hasAnyActualEntered && (Math.abs(summary.collectionsVariance) >= 0.005 || Math.abs(summary.cashBalanceVariance) >= 0.005)

  const statusLabel = !isExisting ? 'Not Started' : isClosed ? 'Closed' : 'Draft'
  const statusVariant = !isExisting ? 'neutral' : isClosed ? 'success' : 'warning'

  const setRowActual = (paymentMethod, value) =>
    setDetailRows((current) => current.map((row) => (row.paymentMethod === paymentMethod ? { ...row, actualAmount: value } : row)))

  const buildSavePayload = () => ({
    reconciliationDate: date,
    openingBalance: Number(openingBalance) || 0,
    actualCashOnHand: Number(actualCashOnHand) || 0,
    details: detailRows.map((row) => ({ paymentMethod: row.paymentMethod, actualAmount: Number(row.actualAmount) || 0 })),
    varianceReason: varianceReason || null,
    notes: notes.trim() || null,
  })

  const handleSaveDraft = async () => {
    if (!canEditForm || isSaving) return
    setIsSaving(true)
    setSaveError('')
    const payload = buildSavePayload()
    const result = isExisting
      ? await updateCashReconciliation(reconciliation.id, payload)
      : await createCashReconciliation(payload)
    setIsSaving(false)
    if (!result.success) {
      if (result.status === 409) {
        showToast({ title: 'Already exists', message: 'Reloading the existing reconciliation for this date.', variant: 'error' })
        await loadForDate(date)
        return
      }
      setSaveError(result.error)
      return
    }
    setReconciliation(result.reconciliation)
    hydrateFromRecord(result.reconciliation)
    showToast({ title: 'Draft saved' })
    loadHistory()
  }

  const handleClose = async () => {
    if (!canCloseNow || isClosing) return
    if (needsVarianceReason && !varianceReason) {
      setCloseError('Select a variance reason before closing - either the collections or the cash balance has a variance.')
      return
    }
    setIsClosing(true)
    setCloseError('')
    const payload = buildSavePayload()

    let targetId = reconciliation?.id
    if (!targetId) {
      const createResult = await createCashReconciliation(payload)
      if (!createResult.success) {
        setIsClosing(false)
        if (createResult.status === 409) {
          showToast({ title: 'Already exists', message: 'Reloading the existing reconciliation for this date.', variant: 'error' })
          await loadForDate(date)
          return
        }
        setCloseError(createResult.error)
        return
      }
      targetId = createResult.reconciliation.id
    }

    const result = await closeCashReconciliation(targetId, payload)
    setIsClosing(false)
    if (!result.success) {
      if (result.status === 409) {
        showToast({ title: 'Already closed', message: 'Reloading this reconciliation.', variant: 'error' })
        await loadForDate(date)
        return
      }
      setCloseError(result.error)
      return
    }
    setReconciliation(result.reconciliation)
    hydrateFromRecord(result.reconciliation)
    showToast({ title: 'Reconciliation closed', message: `${formatDate(date)} is now closed.` })
    loadHistory()
  }

  const handleRefreshExpected = async () => {
    if (!isExisting || isClosed || isRefreshing) return
    setIsRefreshing(true)
    const result = await getCashReconciliationForDate(date, true)
    setIsRefreshing(false)
    if (!result.success) {
      setLoadError(result.error)
      return
    }
    if (result.reconciliation) {
      setReconciliation(result.reconciliation)
      hydrateFromRecord(result.reconciliation)
      showToast({ title: 'Expected values refreshed' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await deleteCashReconciliation(deleteTarget.id)
    setIsDeleting(false)
    if (!result.success) {
      showToast({ title: 'Delete failed', message: result.error, variant: 'error' })
      return
    }
    setDeleteTarget(null)
    showToast({ title: 'Draft deleted' })
    await loadForDate(date)
    loadHistory()
  }

  const hasNoActivity = detailRows.length === 0 && !movement

  return (
    <div className="listing-page space-y-4">
      <ListHeader>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Cash Reconciliation</h1>
          <p className="mt-1 text-xs text-neutral-400">Close the day — reconcile recorded collections and the physical cash drawer.</p>
        </div>
      </ListHeader>

      <Card
        title="Closing day"
        actions={
          <div className="flex items-center gap-2">
            {isExisting && !isClosed && (
              <Button type="button" variant="outline" size="sm" loading={isRefreshing} onClick={handleRefreshExpected}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Refresh
              </Button>
            )}
            <DatePicker value={date} onChange={(value) => setDate(value || todayIso())} className="w-44" />
          </div>
        }
      >
        {isLoading ? (
          <LoadingSpinner label="Loading reconciliation…" />
        ) : loadError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
        ) : hasNoActivity ? (
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            No payment activity for this date.
          </p>
        ) : (
          <div className="space-y-6">
            <ListSummary className="grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Wallet} iconVariant="primary" label="Expected Collections" value={formatCurrency(summary.totalExpectedCollections)} />
              <StatCard icon={Wallet} iconVariant="info" label="Actual Collections" value={formatCurrency(summary.totalActualCollections)} />
              <StatCard
                icon={Scale}
                iconVariant={Math.abs(summary.collectionsVariance) < 0.005 ? 'success' : 'danger'}
                label="Collections Variance"
                value={signedCurrency(summary.collectionsVariance)}
              />
              <StatCard icon={BadgeCheck} iconVariant={statusVariant} label="Status" value={statusLabel} />
            </ListSummary>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-800">Collection Reconciliation</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-4 py-2.5">Payment Method</th>
                      <th className="px-4 py-2.5 text-right">Expected</th>
                      <th className="px-4 py-2.5 text-right">Actual</th>
                      <th className="px-4 py-2.5 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {liveDetailRows.map((row) => (
                      <tr key={row.paymentMethod}>
                        <td className="px-4 py-2.5 font-medium text-neutral-800">{paymentMethodLabel(row.paymentMethod)}</td>
                        <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(row.expectedAmount)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <MoneyInput value={row.actualAmount} disabled={!canEditForm} onChange={(value) => setRowActual(row.paymentMethod, value)} className="w-28" />
                        </td>
                        <td className={`px-4 py-2.5 text-right font-medium ${varianceToneClass(row.variance)}`}>{signedCurrency(row.variance)}</td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50/60 font-semibold">
                      <td className="px-4 py-2.5 text-neutral-800">Total</td>
                      <td className="px-4 py-2.5 text-right text-neutral-800">{formatCurrency(summary.totalExpectedCollections)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-800">{formatCurrency(summary.totalActualCollections)}</td>
                      <td className={`px-4 py-2.5 text-right ${varianceToneClass(summary.collectionsVariance)}`}>{signedCurrency(summary.collectionsVariance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-800">Cash Closing Balance</h3>
              <p className="mb-3 text-xs text-neutral-400">
                Expected Closing Cash = Opening Balance + Cash Sales + Cash Received − Cash Paid − Expenses Paid. This is a separate,
                physical cash/drawer check — not the same figure as the Collections Variance above.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-neutral-100 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-neutral-400">Opening Balance</p>
                  <MoneyInput value={openingBalance} disabled={!canEditForm} onChange={setOpeningBalance} className="mt-1 w-full text-left" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Cash Sales</p>
                  <p className="mt-1.5 text-sm font-medium text-neutral-700">{formatCurrency(movement?.cashSales || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Cash Received</p>
                  <p className="mt-1.5 text-sm font-medium text-neutral-700">{formatCurrency(movement?.cashReceived || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Cash Paid</p>
                  <p className="mt-1.5 text-sm font-medium text-neutral-700">{formatCurrency(movement?.cashPaid || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Expenses Paid</p>
                  <p className="mt-1.5 text-sm font-medium text-neutral-700">{formatCurrency(movement?.expensesPaid || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Expected Closing Cash</p>
                  <p className="mt-1.5 text-sm font-semibold text-neutral-900">{formatCurrency(summary.expectedClosingCash)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Actual Cash on Hand</p>
                  <MoneyInput value={actualCashOnHand} disabled={!canEditForm} onChange={setActualCashOnHand} className="mt-1 w-full text-left" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Cash Balance Variance</p>
                  <p className={`mt-1.5 text-sm font-semibold ${varianceToneClass(summary.cashBalanceVariance)}`}>{signedCurrency(summary.cashBalanceVariance)}</p>
                </div>
              </div>
            </div>

            {(needsVarianceReason || (isClosed && reconciliation?.varianceReason)) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Variance Reason" options={VARIANCE_REASONS} value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} disabled={!canEditForm} />
              </div>
            )}

            {(needsVarianceReason || (isClosed && reconciliation?.notes) || hasAnyActualEntered) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Notes {needsVarianceReason ? '' : '(optional)'}</label>
                <textarea
                  value={notes}
                  maxLength={500}
                  disabled={!canEditForm}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-70"
                  placeholder="Anything the accounts team should know about this day…"
                />
              </div>
            )}

            {saveError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}
            {closeError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{closeError}</div>}

            {isClosed ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
                  Closed on {formatDateTime(reconciliation.closedAt)}
                  {reconciliation.closedBy?.name ? ` by ${reconciliation.closedBy.name}` : ''}.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                {canDeleteDraft && (
                  <Button type="button" variant="outline" className="text-red-600" onClick={() => setDeleteTarget(reconciliation)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete Draft
                  </Button>
                )}
                {!canEditForm && !canCloseNow ? (
                  <div className="flex items-start gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500 sm:flex-1">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    You can review expected vs actual here. Saving or closing the day needs the payments &ldquo;create&rdquo;/&ldquo;edit&rdquo; permission.
                  </div>
                ) : (
                  <>
                    {canEditForm && (
                      <Button type="button" variant="outline" loading={isSaving} onClick={handleSaveDraft}>
                        Save Draft
                      </Button>
                    )}
                    {canCloseNow && (
                      <Button type="button" loading={isClosing} onClick={handleClose}>
                        <BadgeCheck className="size-4" aria-hidden="true" />
                        Close Reconciliation
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Reconciliation History"
        className="overflow-hidden p-0"
        bodyClassName="[&>p]:m-5"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={historyDateFrom} onChange={(value) => { setHistoryDateFrom(value); setHistoryPage(1) }} placeholder="From date" className="w-36" />
            <DatePicker value={historyDateTo} onChange={(value) => { setHistoryDateTo(value); setHistoryPage(1) }} placeholder="To date" className="w-36" />
            <Select options={HISTORY_STATUS_OPTIONS} value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value); setHistoryPage(1) }} className="w-36" />
          </div>
        }
      >
        {isLoadingHistory ? (
          <LoadingSpinner label="Loading history…" />
        ) : historyError ? (
          <div className="m-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{historyError}</div>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            No reconciliation history yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="listing-table w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <SortableHeaderCell label="Date" sortKey="reconciliation_date" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} className="px-4 py-2.5" />
                    <SortableHeaderCell label="Status" sortKey="status" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} className="px-4 py-2.5" />
                    <SortableHeaderCell label="Expected Collections" sortKey="total_expected_collections" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Actual Collections" sortKey="total_actual_collections" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Collections Variance" sortKey="collections_variance" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Expected Closing Cash" sortKey="expected_closing_cash" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Actual Cash" sortKey="actual_cash_on_hand" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Cash Balance Variance" sortKey="cash_balance_variance" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} align="right" className="px-4 py-2.5" />
                    <SortableHeaderCell label="Closed At" sortKey="closed_at" sortBy={historySortBy} sortOrder={historySortOrder} onSort={handleHistorySort} className="px-4 py-2.5" />
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-2.5 font-medium text-neutral-800">{formatDate(record.reconciliationDate)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={record.status === 'closed' ? 'success' : 'warning'}>{record.status === 'closed' ? 'Closed' : 'Draft'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(record.totalExpectedCollections)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(record.totalActualCollections)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${varianceToneClass(record.collectionsVariance)}`}>{signedCurrency(record.collectionsVariance)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(record.expectedClosingCash)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(record.actualCashOnHand)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${varianceToneClass(record.cashBalanceVariance)}`}>{signedCurrency(record.cashBalanceVariance)}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{record.closedAt ? formatDateTime(record.closedAt) : '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionMenu items={[{ label: 'Details', onClick: () => setDetailRecord(record) }]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyTotalPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-neutral-500">
                <span>
                  Showing <span className="font-semibold text-neutral-900">{history.length}</span> of{' '}
                  <span className="font-semibold text-neutral-900">{historyTotal}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Previous</button>
                  <span className="min-w-16 text-center font-medium text-neutral-700">{historyPage} / {historyTotalPages}</span>
                  <button type="button" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage((value) => Math.min(historyTotalPages, value + 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal isOpen={Boolean(detailRecord)} onClose={() => setDetailRecord(null)} title={detailRecord ? `Reconciliation — ${formatDate(detailRecord.reconciliationDate)}` : ''} size="lg">
        {detailRecord && (
          <div className="space-y-5 text-sm">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-800">Collections</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-3.5 py-2">Method</th>
                      <th className="px-3.5 py-2 text-right">Expected</th>
                      <th className="px-3.5 py-2 text-right">Actual</th>
                      <th className="px-3.5 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {detailRecord.details.map((row) => (
                      <tr key={row.paymentMethod}>
                        <td className="px-3.5 py-2 text-neutral-800">{paymentMethodLabel(row.paymentMethod)}</td>
                        <td className="px-3.5 py-2 text-right text-neutral-600">{formatCurrency(row.expectedAmount)}</td>
                        <td className="px-3.5 py-2 text-right text-neutral-600">{formatCurrency(row.actualAmount)}</td>
                        <td className={`px-3.5 py-2 text-right ${varianceToneClass(row.varianceAmount)}`}>{signedCurrency(row.varianceAmount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50/60 font-semibold">
                      <td className="px-3.5 py-2 text-neutral-800">Total</td>
                      <td className="px-3.5 py-2 text-right text-neutral-800">{formatCurrency(detailRecord.totalExpectedCollections)}</td>
                      <td className="px-3.5 py-2 text-right text-neutral-800">{formatCurrency(detailRecord.totalActualCollections)}</td>
                      <td className={`px-3.5 py-2 text-right ${varianceToneClass(detailRecord.collectionsVariance)}`}>{signedCurrency(detailRecord.collectionsVariance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-800">Cash Closing</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-neutral-100 p-3.5 sm:grid-cols-4">
                <div><p className="text-xs text-neutral-400">Opening Balance</p><p className="font-medium text-neutral-800">{formatCurrency(detailRecord.openingBalance)}</p></div>
                <div><p className="text-xs text-neutral-400">Cash Sales</p><p className="font-medium text-neutral-800">{formatCurrency(detailRecord.cashSales)}</p></div>
                <div><p className="text-xs text-neutral-400">Cash Received</p><p className="font-medium text-neutral-800">{formatCurrency(detailRecord.cashReceived)}</p></div>
                <div><p className="text-xs text-neutral-400">Cash Paid</p><p className="font-medium text-neutral-800">{formatCurrency(detailRecord.cashPaid)}</p></div>
                <div><p className="text-xs text-neutral-400">Expenses Paid</p><p className="font-medium text-neutral-800">{formatCurrency(detailRecord.expensesPaid)}</p></div>
                <div><p className="text-xs text-neutral-400">Expected Closing Cash</p><p className="font-semibold text-neutral-900">{formatCurrency(detailRecord.expectedClosingCash)}</p></div>
                <div><p className="text-xs text-neutral-400">Actual Cash on Hand</p><p className="font-semibold text-neutral-900">{formatCurrency(detailRecord.actualCashOnHand)}</p></div>
                <div><p className="text-xs text-neutral-400">Cash Balance Variance</p><p className={`font-semibold ${varianceToneClass(detailRecord.cashBalanceVariance)}`}>{signedCurrency(detailRecord.cashBalanceVariance)}</p></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-neutral-400">Status</p><p className="font-medium capitalize text-neutral-800">{detailRecord.status}</p></div>
              <div><p className="text-xs text-neutral-400">Variance Reason</p><p className="font-medium text-neutral-800">{detailRecord.varianceReason || '—'}</p></div>
            </div>
            {detailRecord.notes && <p><span className="text-neutral-400">Notes:</span> <span className="text-neutral-700">{detailRecord.notes}</span></p>}
            <p className="text-xs text-neutral-400">
              Created {formatDateTime(detailRecord.createdAt)}
              {detailRecord.createdBy?.name ? ` by ${detailRecord.createdBy.name}` : ''}.
              {detailRecord.closedAt && (
                <>
                  {' '}Closed {formatDateTime(detailRecord.closedAt)}
                  {detailRecord.closedBy?.name ? ` by ${detailRecord.closedBy.name}` : ''}.
                </>
              )}
            </p>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !isDeleting && setDeleteTarget(null)} title="Delete Draft">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            Delete the draft reconciliation for <span className="font-semibold text-neutral-900">{deleteTarget ? formatDate(deleteTarget.reconciliationDate) : ''}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
