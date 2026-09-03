import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Info, PackageCheck, RotateCw, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  endOfDayReturn,
  getCurrentVehicleStock,
  listVehicleStockReconciliations,
  listVehicleStockSessions,
  reconcileVehicleStock,
} from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { formatDate, formatDateTime } from '../../utils/format'
import { demoDeliveriesResolved } from '../orders/orderDemoData'
import {
  buildDemoEodDraft,
  demoEodHistoryResolved,
  getDemoEodSubmission,
  goodReturnOf,
  rollupTotals,
  simulateDemoEodSubmit,
} from './eodReturnDemo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const friendly = (value) => (value && !UUID_RE.test(String(value)) ? value : '')
const toInt = (value) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.max(n, 0) : 0
}
const varianceOf = (line) => (line.physicalCount || 0) - (line.expectedRemaining || 0)
// Prefer a stored/backend-posted good-return value on saved records; derive (clamped) otherwise.
const displayGoodReturn = (line) => (Number.isFinite(line.goodReturn) ? line.goodReturn : goodReturnOf(line))
const needsReason = (line) => (line.damaged || 0) > 0 || varianceOf(line) !== 0

function VarianceBadge({ line }) {
  const v = varianceOf(line)
  if (v < 0) return <Badge variant="danger">Shortage {Math.abs(v)}</Badge>
  if (v > 0) return <Badge variant="warning">Excess {v}</Badge>
  if ((line.damaged || 0) > 0) return <Badge variant="warning">Damaged {line.damaged}</Badge>
  return <Badge variant="success">Matched</Badge>
}

function VehicleContextCard({ session, onViewStock }) {
  const rows = [
    ['Vehicle Number', friendly(session.vehicleNumber) || '—'],
    ['Vehicle Type', friendly(session.vehicleType) || '—'],
    ['Delivery Partner', friendly(session.deliveryPartnerName) || '—'],
    ['Warehouse', friendly(session.warehouseName) || '—'],
    ['Load Date', session.lastLoadedAt || session.date ? formatDate(session.lastLoadedAt || session.date) : '—'],
  ]
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Truck className="size-5" aria-hidden="true" />
          </span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <p className="text-[0.7rem] text-neutral-400">{label}</p>
                <p className="text-sm font-medium text-neutral-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewStock}>
          View Vehicle Stock
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

function SummaryTiles({ totals }) {
  const variance = totals.physical - totals.expected
  const tiles = [
    { label: 'Loaded Units', value: totals.loaded },
    { label: 'Delivered Units', value: totals.delivered },
    { label: 'Expected Remaining', value: totals.expected },
    { label: 'Physical Count', value: totals.physical },
    {
      label: 'Variance',
      value: variance === 0 ? '0' : variance > 0 ? `+${variance}` : `${variance}`,
      strong: variance !== 0,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
          <p className={`text-2xl font-semibold ${tile.strong ? 'text-amber-600' : 'text-neutral-900'}`}>{tile.value}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{tile.label}</p>
        </div>
      ))}
    </div>
  )
}

const NUM_INPUT =
  'h-9 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-center text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25 disabled:bg-neutral-50 disabled:text-neutral-400'

function ReturnLines({ lines, editable, onChange, lineErrors }) {
  return (
    <Card className="p-0" bodyClassName="p-0">
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-6xl text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">SKU / Variant</th>
              <th className="px-3 py-3">UOM</th>
              <th className="px-3 py-3 text-right">Loaded</th>
              <th className="px-3 py-3 text-right">Delivered</th>
              <th className="px-3 py-3 text-right">Expected</th>
              <th className="px-3 py-3 text-center">Physical</th>
              <th className="px-3 py-3 text-right">Good Return</th>
              <th className="px-3 py-3 text-center">Damaged</th>
              <th className="px-3 py-3">Variance</th>
              <th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {lines.map((line) => {
              const err = lineErrors[line.productId]
              return (
                <tr key={line.productId}>
                  <td className="px-3 py-3 font-medium text-neutral-900">{line.productName}</td>
                  <td className="px-3 py-3 text-neutral-500">{friendly(line.sku) || friendly(line.variantId) || '—'}</td>
                  <td className="px-3 py-3 text-neutral-500">{line.uom || '—'}</td>
                  <td className="px-3 py-3 text-right text-neutral-600">{line.loadedQuantity}</td>
                  <td className="px-3 py-3 text-right text-neutral-600">{line.deliveredQuantity}</td>
                  <td className="px-3 py-3 text-right font-medium text-neutral-900">{line.expectedRemaining}</td>
                  <td className="px-3 py-3 text-center">
                    {editable ? (
                      <input
                        className={NUM_INPUT}
                        inputMode="numeric"
                        value={line.physicalCount}
                        onChange={(e) => onChange(line.productId, 'physicalCount', e.target.value)}
                        onBlur={(e) => onChange(line.productId, 'physicalCount', toInt(e.target.value))}
                        aria-label={`Physical count for ${line.productName}`}
                      />
                    ) : (
                      <span className="font-semibold">{line.physicalCount}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-primary-700">{displayGoodReturn(line)}</td>
                  <td className="px-3 py-3 text-center">
                    {editable ? (
                      <input
                        className={NUM_INPUT}
                        inputMode="numeric"
                        value={line.damaged}
                        onChange={(e) => onChange(line.productId, 'damaged', e.target.value)}
                        onBlur={(e) => onChange(line.productId, 'damaged', toInt(e.target.value))}
                        aria-label={`Damaged quantity for ${line.productName}`}
                      />
                    ) : (
                      <span>{line.damaged || 0}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-neutral-600">
                    {varianceOf(line) === 0 ? '—' : varianceOf(line) > 0 ? `+${varianceOf(line)}` : varianceOf(line)}
                  </td>
                  <td className="px-3 py-3">
                    {editable ? (
                      <input
                        className={`h-9 w-44 rounded-lg border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/25 ${
                          err?.reason ? 'border-red-300' : 'border-neutral-200'
                        }`}
                        value={line.reason}
                        placeholder={needsReason(line) ? 'Required' : 'Optional'}
                        onChange={(e) => onChange(line.productId, 'reason', e.target.value)}
                        aria-label={`Reason for ${line.productName}`}
                      />
                    ) : (
                      <span className="text-neutral-500">{line.reason || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {err?.count ? <span className="text-[0.7rem] font-medium text-red-600">{err.count}</span> : <VarianceBadge line={line} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-neutral-100 lg:hidden">
        {lines.map((line) => {
          const err = lineErrors[line.productId]
          return (
            <div key={line.productId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{line.productName}</p>
                  <p className="text-xs text-neutral-500">
                    {friendly(line.sku) || friendly(line.variantId) || '—'}
                    {line.uom ? ` · ${line.uom}` : ''}
                  </p>
                </div>
                <VarianceBadge line={line} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Loaded', line.loadedQuantity],
                  ['Delivered', line.deliveredQuantity],
                  ['Expected', line.expectedRemaining],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm font-semibold text-neutral-900">{value}</p>
                    <p className="text-[0.65rem] uppercase tracking-wide text-neutral-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 items-end gap-2">
                <label className="text-xs text-neutral-500">
                  Physical
                  {editable ? (
                    <input
                      className={`${NUM_INPUT} mt-1 w-full`}
                      inputMode="numeric"
                      value={line.physicalCount}
                      onChange={(e) => onChange(line.productId, 'physicalCount', e.target.value)}
                      onBlur={(e) => onChange(line.productId, 'physicalCount', toInt(e.target.value))}
                    />
                  ) : (
                    <p className="mt-1 font-semibold text-neutral-900">{line.physicalCount}</p>
                  )}
                </label>
                <label className="text-xs text-neutral-500">
                  Damaged
                  {editable ? (
                    <input
                      className={`${NUM_INPUT} mt-1 w-full`}
                      inputMode="numeric"
                      value={line.damaged}
                      onChange={(e) => onChange(line.productId, 'damaged', e.target.value)}
                      onBlur={(e) => onChange(line.productId, 'damaged', toInt(e.target.value))}
                    />
                  ) : (
                    <p className="mt-1 font-semibold text-neutral-900">{line.damaged || 0}</p>
                  )}
                </label>
                <div className="text-xs text-neutral-500">
                  Good Return
                  <p className="mt-1 font-semibold text-primary-700">{displayGoodReturn(line)}</p>
                </div>
              </div>
              {editable ? (
                <input
                  className={`mt-2 h-9 w-full rounded-lg border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/25 ${
                    err?.reason ? 'border-red-300' : 'border-neutral-200'
                  }`}
                  value={line.reason}
                  placeholder={needsReason(line) ? 'Reason required' : 'Reason (optional)'}
                  onChange={(e) => onChange(line.productId, 'reason', e.target.value)}
                />
              ) : (
                line.reason && <p className="mt-2 text-xs text-neutral-500">Reason: {line.reason}</p>
              )}
              {err?.count && <p className="mt-1 text-[0.7rem] font-medium text-red-600">{err.count}</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function SubmittedSummary({ record, onViewStock }) {
  const t = record.totals
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-neutral-900">Today&apos;s return has been submitted</p>
              <p className="text-xs text-neutral-500">
                {formatDateTime(record.submittedAt)} · by {friendly(record.submittedBy) || '—'}
              </p>
            </div>
          </div>
          <Badge variant={record.status === 'verified' ? 'success' : 'info'} dot>
            {record.status === 'verified' ? 'Verified' : 'Submitted'}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Good Return', t.goodReturn],
            ['Damaged', t.damaged],
            ['Shortage', t.shortage],
            ['Excess', t.excess],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-neutral-50 p-3 text-center">
              <p className="text-lg font-semibold text-neutral-900">{value}</p>
              <p className="mt-0.5 text-[0.7rem] text-neutral-500">{label}</p>
            </div>
          ))}
        </div>
      </Card>
      <ReturnLines lines={record.lines} editable={false} onChange={() => {}} lineErrors={{}} />
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onViewStock}>
          View Vehicle Stock
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

function ReturnDetailModal({ record, onClose }) {
  return (
    <Modal isOpen={Boolean(record)} onClose={onClose} title="Return details" size="4xl">
      {record && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Vehicle', friendly(record.vehicleNumber) || '—'],
              ['Date', formatDate(record.date)],
              ['Delivery Partner', friendly(record.deliveryPartnerName) || '—'],
              ['Warehouse', friendly(record.warehouseName) || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="font-medium text-neutral-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ['Loaded', record.totals.loaded],
              ['Delivered', record.totals.delivered],
              ['Expected', record.totals.expected],
              ['Physical', record.totals.physical],
              ['Good Return', record.totals.goodReturn],
              ['Damaged', record.totals.damaged],
              ['Shortage', record.totals.shortage],
              ['Excess', record.totals.excess],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-neutral-50 p-2 text-center">
                <p className="text-sm font-semibold text-neutral-900">{value}</p>
                <p className="text-[0.65rem] text-neutral-500">{label}</p>
              </div>
            ))}
          </div>
          <ReturnLines lines={record.lines} editable={false} onChange={() => {}} lineErrors={{}} />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              Submitted {formatDateTime(record.submittedAt)} · by {friendly(record.submittedBy) || '—'}
            </span>
            <Badge variant={record.status === 'verified' ? 'success' : 'info'}>
              {record.status === 'verified' ? 'Verified' : 'Submitted'}
            </Badge>
          </div>
        </div>
      )}
    </Modal>
  )
}

function PreviousReturns({ records, isLoading, limited, onView }) {
  if (isLoading) return <Card><LoadingSpinner label="Loading previous returns..." /></Card>

  const limitedNote = limited ? (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      Showing returns linked to your current vehicle session only. Full cross-session history needs back-office support.
    </p>
  ) : null

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        {limitedNote}
        <Card>
          <EmptyState icon={RotateCw} title="No previous returns yet" description="Submitted end-of-day returns will be listed here." />
        </Card>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {limitedNote}
      <Card className="p-0" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-4xl text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Physical</th>
              <th className="px-4 py-3 text-right">Good Return</th>
              <th className="px-4 py-3 text-right">Damaged</th>
              <th className="px-4 py-3">Variance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {records.map((record) => {
              const t = record.totals
              const variance = t.physical - t.expected
              return (
                <tr key={record.id}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{formatDate(record.date)}</td>
                  <td className="px-4 py-3 text-neutral-600">{friendly(record.vehicleNumber) || '—'}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{record.lines.length}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{t.expected}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{t.physical}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary-700">{t.goodReturn}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{t.damaged}</td>
                  <td className="px-4 py-3">
                    {variance === 0 ? (
                      <Badge variant="success">Matched</Badge>
                    ) : variance < 0 ? (
                      <Badge variant="danger">Shortage {Math.abs(variance)}</Badge>
                    ) : (
                      <Badge variant="warning">Excess {variance}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={record.status === 'verified' ? 'success' : 'info'}>
                      {record.status === 'verified' ? 'Verified' : 'Submitted'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onView(record)}>
                      <Eye className="size-4" aria-hidden="true" />
                      View Details
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </Card>
    </div>
  )
}

export default function EndOfDayReturn() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [session, setSession] = useState(null)
  const [demo, setDemo] = useState(false)
  const [lines, setLines] = useState([])
  const [submittedRecord, setSubmittedRecord] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [history, setHistory] = useState([])
  const [historyLimited, setHistoryLimited] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // The stock return (endOfDayReturn) and the physical reconciliation are two separate real
  // calls. If the return posts but the reconciliation fails, `returnPosted` stays true so a
  // retry only re-sends the reconciliation - never a second return. Backend idempotency TBD.
  const [returnPosted, setReturnPosted] = useState(false)
  const [partialFailure, setPartialFailure] = useState(false)

  const mapRealReconciliation = useCallback(
    (recon, ctx) => {
      const recLines = (recon.items || []).map((it) => ({
        productId: it.productId || it.id,
        productName: friendly(it.productName) || '—',
        sku: '',
        variantId: it.variantId || '',
        uom: '',
        loadedQuantity: (it.loadedQuantity || 0) + (it.extraQuantity || 0),
        deliveredQuantity: it.deliveredQuantity || 0,
        expectedRemaining: it.expectedClosingQty || 0,
        physicalCount: it.physicalQuantity || 0,
        damaged: 0,
        reason: it.notes || '',
        goodReturn: it.returnedQuantity || 0,
        shortage: Math.max(-(it.varianceQuantity || 0), 0),
        excess: Math.max(it.varianceQuantity || 0, 0),
      }))
      return {
        id: recon.id,
        sessionId: recon.loadingId,
        date: recon.createdAt,
        vehicleNumber: ctx.vehicleNumber,
        vehicleType: ctx.vehicleType,
        deliveryPartnerName: ctx.deliveryPartnerName,
        warehouseName: ctx.warehouseName,
        status: recon.status || 'submitted',
        submittedAt: recon.createdAt,
        submittedBy: friendly(recon.reconciledById) || ctx.deliveryPartnerName,
        totals: rollupTotals(recLines),
        lines: recLines,
      }
    },
    [],
  )

  // Previous Returns from real APIs, without a new endpoint: list the partner's vehicle-stock
  // sessions, then pull each session's reconciliation record. If the sessions list isn't
  // available we can only reach the CURRENT session's reconciliations - that is NOT full
  // history, so `limited` is flagged and the UI says so (backend integration gap).
  const loadRealHistory = useCallback(
    async (currentSession) => {
      const sessionsResult = await listVehicleStockSessions({ delivery_partner_id: currentUser.id })

      if (!sessionsResult.success || !Array.isArray(sessionsResult.sessions) || sessionsResult.sessions.length === 0) {
        const recon = await listVehicleStockReconciliations(currentSession.id)
        const records = recon.success ? recon.reconciliations.map((r) => mapRealReconciliation(r, currentSession)) : []
        return { records, limited: true }
      }

      const sessions = [...sessionsResult.sessions]
        .filter((s) => s?.id)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 8) // keep the fan-out bounded

      const perSession = await Promise.all(
        sessions.map(async (s) => {
          const recon = await listVehicleStockReconciliations(s.id)
          return recon.success ? recon.reconciliations.map((r) => mapRealReconciliation(r, s)) : []
        }),
      )

      const byId = new Map()
      perSession.flat().forEach((rec) => byId.set(rec.id, rec))
      const records = [...byId.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      return { records, limited: false }
    },
    [currentUser?.id, mapRealReconciliation],
  )

  const load = useCallback(async () => {
    if (!currentUser?.id) return
    setIsLoading(true)
    setLoadError('')
    setReturnPosted(false)
    setPartialFailure(false)
    setSubmitError('')

    const result = await getCurrentVehicleStock(currentUser.id)
    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    // No real active session - fall back to the shared demo session when demo deliveries exist.
    if (!result.session) {
      if (demoDeliveriesResolved().length === 0) {
        setSession(null)
        setIsLoading(false)
        return
      }
      const { session: demoSession, lines: demoLines } = buildDemoEodDraft()
      setDemo(true)
      setSession(demoSession)
      setSubmittedRecord(getDemoEodSubmission(demoSession.id))
      setLines(demoLines)
      setHistory(demoEodHistoryResolved())
      setHistoryLimited(false)
      setIsLoading(false)
      return
    }

    setDemo(false)
    setSession(result.session)
    setLines(
      (result.session.items || []).map((item) => ({
        lineId: item.id,
        productId: item.productId,
        productName: friendly(item.productName) || '—',
        sku: '',
        variantId: item.variantId || '',
        uom: '',
        loadedQuantity: (item.loadedQuantity || 0) + (item.extraQuantity || 0),
        deliveredQuantity: item.deliveredQuantity || 0,
        expectedRemaining: Number(item.remainingQuantity) || 0,
        physicalCount: Number(item.remainingQuantity) || 0,
        damaged: 0,
        reason: '',
      })),
    )

    const { records, limited } = await loadRealHistory(result.session)
    setHistory(records)
    setHistoryLimited(limited)
    // "Already submitted today" = a reconciliation exists for THIS loading session.
    setSubmittedRecord(records.find((r) => r.sessionId === result.session.id) || null)
    setIsLoading(false)
  }, [currentUser?.id, loadRealHistory])

  useEffect(() => {
    load()
  }, [load])

  const updateLine = (productId, field, value) => {
    setLines((current) =>
      current.map((line) => {
        if (line.productId !== productId) return line
        if (field === 'reason') return { ...line, reason: value }
        return { ...line, [field]: value === '' ? '' : value }
      }),
    )
  }

  const normalisedLines = useMemo(
    () => lines.map((l) => ({ ...l, physicalCount: toInt(l.physicalCount), damaged: toInt(l.damaged) })),
    [lines],
  )
  const totals = useMemo(() => rollupTotals(normalisedLines), [normalisedLines])
  const expectedTotal = totals.expected

  const lineErrors = useMemo(() => {
    const errs = {}
    normalisedLines.forEach((line) => {
      const e = {}
      if (line.damaged > line.physicalCount) e.count = 'Damaged cannot exceed physical count'
      if (needsReason(line) && !String(line.reason || '').trim()) e.reason = true
      if (Object.keys(e).length) errs[line.productId] = e
    })
    return errs
  }, [normalisedLines])

  const canSubmit = Object.keys(lineErrors).length === 0 && normalisedLines.length > 0

  const doSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError('')

    if (demo) {
      const record = simulateDemoEodSubmit(session.id, {
        lines: normalisedLines,
        submittedBy: currentUser?.name,
      })
      setSubmittedRecord(record)
      setHistory(demoEodHistoryResolved())
      setIsSubmitting(false)
      setShowConfirm(false)
      showToast({ title: 'Return submitted (demo)', message: 'Today’s vehicle return has been recorded locally.' })
      return
    }

    // Real: record the good-return quantities, then the physical count reconciliation. The
    // damaged / variance detail (no structured backend field) is folded into the notes.
    // These are two separate calls - `returnPosted` guards against re-sending the first one
    // on a retry after the reconciliation fails.
    if (!returnPosted) {
      const returnResult = await endOfDayReturn(
        session.id,
        normalisedLines.map((l) => ({ productId: l.productId, returnedQty: goodReturnOf(l) })),
      )
      if (!returnResult.success) {
        setSubmitError(returnResult.error)
        setIsSubmitting(false)
        return
      }
      setReturnPosted(true)
    }

    const notes = normalisedLines
      .filter((l) => l.damaged > 0 || varianceOf(l) !== 0)
      .map((l) => {
        const bits = []
        if (l.damaged > 0) bits.push(`damaged ${l.damaged}`)
        const v = varianceOf(l)
        if (v < 0) bits.push(`shortage ${Math.abs(v)}`)
        if (v > 0) bits.push(`excess ${v}`)
        return `${l.productName}: ${bits.join(', ')}${l.reason ? ` (${l.reason})` : ''}`
      })
      .join(' | ')

    const reconResult = await reconcileVehicleStock(session.id, {
      notes: notes || undefined,
      items: normalisedLines.map((l) => ({
        loadingItemId: l.lineId,
        productId: l.productId,
        variantId: l.variantId,
        physicalQty: l.physicalCount,
      })),
    })
    if (!reconResult.success) {
      setPartialFailure(true)
      setSubmitError(reconResult.error)
      setIsSubmitting(false)
      setShowConfirm(false)
      return
    }

    setReturnPosted(false)
    setPartialFailure(false)
    setIsSubmitting(false)
    setShowConfirm(false)
    showToast({ title: 'Return submitted', message: 'End of day vehicle return has been recorded.' })
    load()
  }

  const goToStock = () => navigate('/delivery/vehicle-stock')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">End of Day Return</h1>
        <p className="mt-1 text-sm text-neutral-500">Count what is left on the vehicle and hand it back to the warehouse.</p>
      </div>

      <Tabs defaultValue="today" className="space-y-5">
        <TabsList>
          <TabsTrigger value="today">Today&apos;s Return</TabsTrigger>
          <TabsTrigger value="history">Previous Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-5">
          {isLoading ? (
            <Card><LoadingSpinner label="Loading active session..." /></Card>
          ) : loadError ? (
            <Card>
              <div className="py-8 text-center">
                <p className="text-sm text-red-600">{loadError}</p>
                <Button type="button" variant="outline" className="mt-4" onClick={load}>
                  <RotateCw className="size-4" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            </Card>
          ) : !session ? (
            <Card>
              <EmptyState
                icon={Truck}
                title="No active vehicle load found"
                description="Load your assigned deliveries first — the return workflow opens once a vehicle load is confirmed."
                action={{ label: 'Go to Vehicle Loading', onClick: () => navigate('/delivery/vehicle-loading') }}
              />
            </Card>
          ) : submittedRecord ? (
            <>
              <VehicleContextCard session={session} onViewStock={goToStock} />
              <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                Today&apos;s return has already been submitted. It is read-only now — the back office verifies it next.
              </p>
              <SubmittedSummary record={submittedRecord} onViewStock={goToStock} />
            </>
          ) : (
            <>
              <VehicleContextCard session={session} onViewStock={goToStock} />
              {expectedTotal === 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  No stock is expected to remain on the vehicle. Submit a nil return to close the day, or record any excess
                  found during the physical count.
                </p>
              )}
              <SummaryTiles totals={totals} />
              <ReturnLines lines={lines} editable onChange={updateLine} lineErrors={lineErrors} />

              {partialFailure ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    Stock return was recorded, but physical reconciliation could not be saved.
                  </p>
                  <p className="mt-1 text-xs text-amber-700">{submitError}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    The return itself is already posted — retry only the reconciliation. Do not re-submit the return.
                  </p>
                  <Button type="button" className="mt-3" loading={isSubmitting} onClick={doSubmit}>
                    <RotateCw className="size-4" aria-hidden="true" />
                    Retry Reconciliation
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-neutral-500">
                      Good Return {totals.goodReturn} · Damaged {totals.damaged} · Shortage {totals.shortage} · Excess{' '}
                      {totals.excess} · {totals.varianceCount} product{totals.varianceCount === 1 ? '' : 's'} with variance
                    </p>
                    <Button type="button" disabled={!canSubmit} onClick={() => setShowConfirm(true)}>
                      <PackageCheck className="size-4" aria-hidden="true" />
                      Submit End of Day Return
                    </Button>
                  </div>
                  {!canSubmit && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                      Add a reason for every damaged / short / excess product and keep damaged within the physical count.
                    </p>
                  )}
                  {submitError && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="history">
          <PreviousReturns records={history} isLoading={isLoading} limited={historyLimited} onView={setDetailRecord} />
        </TabsContent>
      </Tabs>

      <ReturnDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />

      <Modal isOpen={showConfirm} onClose={() => !isSubmitting && setShowConfirm(false)} title="Submit today's vehicle return?" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Vehicle', friendly(session?.vehicleNumber) || '—'],
              ['Products', normalisedLines.length],
              ['Good Return Units', totals.goodReturn],
              ['Damaged Units', totals.damaged],
              ['Shortage', totals.shortage],
              ['Excess', totals.excess],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="font-medium text-neutral-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            Once submitted the return is read-only. Variance and damage are recorded for the back office to verify — they
            are not written off here.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowConfirm(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" loading={isSubmitting} onClick={doSubmit}>
              Submit Return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
