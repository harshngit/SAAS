import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Info, Scale, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { getExpectedTotals, listReconciliationSessions, saveReconciliation } from '../../api/cashReconciliation'
import { CASH_RECON_DEMO_ENABLED } from './cashReconciliationDemoData'
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

const todayIso = () => toLocalDateString()

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function varianceClass(value) {
  if (Math.abs(value) < 0.005) return 'text-neutral-900'
  return value > 0 ? 'text-primary-700' : 'text-red-600'
}
function varianceLabel(value) {
  if (Math.abs(value) < 0.005) return 'Balanced'
  return value > 0 ? 'Excess' : 'Short'
}

export default function CashReconciliation() {
  const { showToast } = useToast()
  const { can } = usePermission()
  // Viewing is gated at the route (payments:view). Reconcile / Close Day is a financial write.
  const canReconcile = can('payments', 'create')

  const [date, setDate] = useState(todayIso())
  const [expected, setExpected] = useState({ byMode: [], total: 0, reconciledSession: null, source: '' })
  const [actuals, setActuals] = useState({})
  const [varianceReason, setVarianceReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [history, setHistory] = useState([])
  const [historyAvailable, setHistoryAvailable] = useState(false)
  const [detailSession, setDetailSession] = useState(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadExpected = useCallback((forDate) => {
    setIsLoading(true)
    setLoadError('')
    setSaveError('')
    getExpectedTotals(forDate).then((result) => {
      if (!result.success) {
        setExpected({ byMode: [], total: 0, reconciledSession: null, source: '' })
        setLoadError(result.error)
        setIsLoading(false)
        return
      }
      setExpected(result)
      const session = result.reconciledSession
      if (session) {
        setActuals(Object.fromEntries(session.modes.map((row) => [row.mode, String(row.actual)])))
        setVarianceReason(session.varianceReason || '')
        setNotes(session.notes || '')
      } else {
        setActuals({})
        setVarianceReason('')
        setNotes('')
      }
      setIsLoading(false)
    })
  }, [])

  const loadHistory = useCallback(() => {
    listReconciliationSessions().then((result) => {
      setHistoryAvailable(Boolean(result.success))
      setHistory(result.success ? result.sessions : [])
    })
  }, [])

  useEffect(() => {
    loadExpected(date)
  }, [date, loadExpected])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const isReconciled = Boolean(expected.reconciledSession)

  const modeRows = useMemo(
    () =>
      expected.byMode.map((row) => {
        const raw = actuals[row.mode]
        const entered = raw !== undefined && raw !== ''
        const actual = Number(raw) || 0
        return { ...row, raw: raw ?? '', entered, actual, variance: Math.round((actual - row.expected) * 100) / 100 }
      }),
    [expected.byMode, actuals],
  )

  const anyEntered = modeRows.some((row) => row.entered)
  const expectedTotal = expected.total
  const actualTotal = modeRows.reduce((sum, row) => sum + row.actual, 0)
  const variance = Math.round((actualTotal - expectedTotal) * 100) / 100
  const status = isReconciled
    ? 'Reconciled'
    : !anyEntered
      ? 'Open'
      : Math.abs(variance) < 0.005
        ? 'Balanced'
        : 'Variance'
  const statusVariant =
    status === 'Reconciled' || status === 'Balanced' ? 'success' : status === 'Variance' ? 'danger' : 'neutral'
  const needsReason = !isReconciled && anyEntered && Math.abs(variance) >= 0.005

  const setActual = (mode, value) => setActuals((current) => ({ ...current, [mode]: value }))
  const fillExpected = () =>
    setActuals(Object.fromEntries(expected.byMode.map((row) => [row.mode, String(row.expected)])))

  const handleReconcile = async () => {
    if (isSaving || !canReconcile) return
    if (needsReason && !varianceReason) {
      setSaveError('Select a variance reason before reconciling.')
      return
    }
    setIsSaving(true)
    setSaveError('')
    const result = await saveReconciliation({
      date,
      modes: modeRows.map((row) => ({ mode: row.mode, expected: row.expected, actual: row.actual })),
      varianceReason: needsReason ? varianceReason : '',
      notes: notes.trim() || undefined,
    })
    setIsSaving(false)
    if (!result.success) {
      setSaveError(result.error)
      return
    }
    showToast({ title: 'Day reconciled', message: `${formatDate(date)} closed with ${varianceLabel(variance).toLowerCase()} variance.` })
    loadExpected(date)
    loadHistory()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Cash Reconciliation</h1>
        <p className="mt-1 text-sm text-neutral-500">Compare recorded payments with actual closing balances.</p>
      </div>

      <Card
        title="Closing day"
        actions={<DatePicker value={date} onChange={(value) => setDate(value || todayIso())} className="w-44" />}
      >
        {isLoading ? (
          <LoadingSpinner label="Loading expected totals…" />
        ) : loadError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
        ) : expected.byMode.length === 0 ? (
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            No payment activity for this date.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard icon={Wallet} iconVariant="primary" label="Expected Total" value={formatCurrency(expectedTotal)} />
              <StatCard icon={Wallet} iconVariant="info" label="Actual Total" value={anyEntered ? formatCurrency(actualTotal) : '—'} />
              <StatCard
                icon={Scale}
                iconVariant={Math.abs(variance) < 0.005 ? 'success' : 'danger'}
                label="Variance"
                value={anyEntered ? `${variance > 0 ? '+' : ''}${formatCurrency(variance)}` : '—'}
              />
              <StatCard icon={BadgeCheck} iconVariant={statusVariant} label="Status" value={status} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-4 py-2.5">Payment Mode</th>
                    <th className="px-4 py-2.5 text-right">Expected</th>
                    <th className="px-4 py-2.5 text-right">Actual</th>
                    <th className="px-4 py-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {modeRows.map((row) => (
                    <tr key={row.mode}>
                      <td className="px-4 py-2.5 font-medium text-neutral-800">{row.mode}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(row.expected)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          disabled={isReconciled}
                          value={row.raw}
                          onChange={(event) => setActual(row.mode, event.target.value)}
                          placeholder="0"
                          className="w-28 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
                        />
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${row.entered ? varianceClass(row.variance) : 'text-neutral-300'}`}>
                        {row.entered ? `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-50/60 font-semibold">
                    <td className="px-4 py-2.5 text-neutral-800">Total</td>
                    <td className="px-4 py-2.5 text-right text-neutral-800">{formatCurrency(expectedTotal)}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-800">{anyEntered ? formatCurrency(actualTotal) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right ${anyEntered ? varianceClass(variance) : 'text-neutral-300'}`}>
                      {anyEntered ? `${variance > 0 ? '+' : ''}${formatCurrency(variance)}` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!isReconciled && (
              <button type="button" onClick={fillExpected} className="text-xs font-medium text-primary-700 hover:underline">
                Match actual to expected
              </button>
            )}

            {(needsReason || (isReconciled && expected.reconciledSession?.varianceReason)) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Variance Reason"
                  options={VARIANCE_REASONS}
                  value={varianceReason}
                  onChange={(event) => setVarianceReason(event.target.value)}
                  disabled={isReconciled}
                />
              </div>
            )}

            {(needsReason || (isReconciled && expected.reconciledSession?.notes) || anyEntered) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Notes {needsReason ? '' : '(optional)'}</label>
                <textarea
                  value={notes}
                  maxLength={500}
                  disabled={isReconciled}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-70"
                  placeholder="Anything the accounts team should know about this day…"
                />
              </div>
            )}

            {saveError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
            )}

            {isReconciled ? (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
                Reconciled on {formatDate(expected.reconciledSession.reconciledAt)} by {expected.reconciledSession.reconciledByName || 'the accounts team'}.
              </div>
            ) : CASH_RECON_DEMO_ENABLED ? (
              canReconcile ? (
                <div className="flex justify-end">
                  <Button type="button" loading={isSaving} disabled={!anyEntered} onClick={handleReconcile}>
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    Reconcile &amp; Close Day
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  You can review expected vs actual here. Closing the day needs the payments &ldquo;create&rdquo; permission.
                </div>
              )
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">BACKEND LATER — persisted Cash Reconciliation session / close.</span> You can
                  review expected vs actual and note the variance here; saving the close is enabled once the backend
                  reconciliation-session endpoint ships. Nothing is stored locally.
                </span>
              </div>
            )}

            <p className="text-[0.7rem] text-neutral-400">
              Expected totals come from recorded payment receipts for this date ({expected.source || 'payment-receipts'}). Recorded
              delivery collections awaiting reconciliation and approved-but-unpaid expenses are not included.
            </p>
          </div>
        )}
      </Card>

      <Card title="Reconciliation History">
        {!historyAvailable ? (
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            No reconciliation history yet. <span className="text-neutral-400">BACKEND LATER — persisted sessions.</span>
          </p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            No reconciliation history yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Expected</th>
                  <th className="px-4 py-2.5 text-right">Actual</th>
                  <th className="px-4 py-2.5 text-right">Variance</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Reconciled By</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {history.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-800">{formatDate(session.date)}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(session.expectedTotal)}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600">{formatCurrency(session.actualTotal)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${varianceClass(session.variance)}`}>
                      {session.variance > 0 ? '+' : ''}{formatCurrency(session.variance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-neutral-600">{varianceLabel(session.variance)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{session.reconciledByName || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => setDetailSession(session)} className="text-xs font-medium text-primary-700 hover:underline">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={Boolean(detailSession)} onClose={() => setDetailSession(null)} title={detailSession ? `Reconciliation — ${formatDate(detailSession.date)}` : ''}>
        {detailSession && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-xs text-neutral-400">Expected</p><p className="font-semibold text-neutral-900">{formatCurrency(detailSession.expectedTotal)}</p></div>
              <div><p className="text-xs text-neutral-400">Actual</p><p className="font-semibold text-neutral-900">{formatCurrency(detailSession.actualTotal)}</p></div>
              <div><p className="text-xs text-neutral-400">Variance</p><p className={`font-semibold ${varianceClass(detailSession.variance)}`}>{detailSession.variance > 0 ? '+' : ''}{formatCurrency(detailSession.variance)}</p></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3.5 py-2">Mode</th>
                    <th className="px-3.5 py-2 text-right">Expected</th>
                    <th className="px-3.5 py-2 text-right">Actual</th>
                    <th className="px-3.5 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {detailSession.modes.map((row) => (
                    <tr key={row.mode}>
                      <td className="px-3.5 py-2 text-neutral-800">{row.mode}</td>
                      <td className="px-3.5 py-2 text-right text-neutral-600">{formatCurrency(row.expected)}</td>
                      <td className="px-3.5 py-2 text-right text-neutral-600">{formatCurrency(row.actual)}</td>
                      <td className={`px-3.5 py-2 text-right ${varianceClass(row.variance)}`}>{row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detailSession.varianceReason && <p><span className="text-neutral-400">Variance reason:</span> <span className="font-medium text-neutral-800">{detailSession.varianceReason}</span></p>}
            {detailSession.notes && <p><span className="text-neutral-400">Notes:</span> <span className="text-neutral-700">{detailSession.notes}</span></p>}
            <p className="text-xs text-neutral-400">
              Reconciled {formatDate(detailSession.reconciledAt)} by {detailSession.reconciledByName || 'the accounts team'}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
