import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck2, CheckCircle2, ClipboardList, PackageCheck, PackageX, Truck } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import NumericInput from '../../components/ui/NumericInput'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatCurrency } from '../../utils/format'
import {
  DAY_END_STATUS_LABEL,
  DAY_END_STATUS_VARIANT,
  getCurrentDayEnd,
  submitDayEnd,
} from '../../api/deliveryDayEnd'

function emptyHandedOver() {
  return { cash: '0', bank: '0', upi: '0', cheque: '0', other: '0' }
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Delivery Partner self-service "Close My Day" - submits today's handed-over cash/bank/upi/
// cheque/other against the backend's own expected figures. A wholly separate flow from Cash
// Reconciliation / Collection Reconciliation (per-transaction) - this is a daily SESSION with
// its own open -> submitted -> approved (or -> rejected -> resubmit) lifecycle.
export default function DayEndClose() {
  const [dayEnd, setDayEnd] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [handedOver, setHandedOver] = useState(emptyHandedOver)
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = () => {
    setIsLoading(true)
    setLoadError('')
    getCurrentDayEnd().then((result) => {
      setIsLoading(false)
      if (!result.success) {
        setLoadError(result.error)
        return
      }
      setDayEnd(result.dayEnd)
      const next = emptyHandedOver()
      result.dayEnd.breakdown.forEach((entry) => {
        next[entry.method] = String(entry.handedOver)
      })
      setHandedOver(next)
      setNotes(result.dayEnd.notes || '')
    })
  }

  useEffect(() => {
    load()
  }, [])

  const isEditable = Boolean(dayEnd) && (dayEnd.status === 'open' || dayEnd.status === 'rejected')

  const liveVariance = useMemo(() => {
    if (!dayEnd) return { perMethod: {}, total: 0, handedOverTotal: 0, anyDiffers: false }
    let total = 0
    let handedOverTotal = 0
    let anyDiffers = false
    const perMethod = {}
    dayEnd.breakdown.forEach((entry) => {
      const handed = Number(handedOver[entry.method]) || 0
      const variance = handed - entry.expected
      perMethod[entry.method] = variance
      total += variance
      handedOverTotal += handed
      if (handed !== entry.expected) anyDiffers = true
    })
    return { perMethod, total, handedOverTotal, anyDiffers }
  }, [dayEnd, handedOver])

  const handleOpenConfirm = () => {
    setFormError('')
    if (liveVariance.anyDiffers && !notes.trim()) {
      setFormError('Notes are required when a handed-over amount differs from the expected amount.')
      return
    }
    setIsConfirmOpen(true)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setFormError('')
    const result = await submitDayEnd({ businessDate: dayEnd.businessDate, handedOver, notes: notes.trim() })
    setIsSubmitting(false)
    if (!result.success) {
      setFormError(result.error)
      setIsConfirmOpen(false)
      return
    }
    setDayEnd(result.dayEnd)
    setIsConfirmOpen(false)
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner variant="form" fields={6} sections={1} label="Loading today's day-end..." />
      </Card>
    )
  }

  if (loadError || !dayEnd) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="size-8 text-amber-500" aria-hidden="true" />
          <p className="text-sm text-neutral-600">{loadError || 'Unable to load today\'s day-end.'}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      </Card>
    )
  }

  const deliveryStats = [
    { label: 'Assigned', value: dayEnd.deliveries.assigned, icon: Truck },
    { label: 'Delivered', value: dayEnd.deliveries.delivered, icon: PackageCheck },
    { label: 'Returned', value: dayEnd.deliveries.returned, icon: PackageX },
    { label: 'Pending', value: dayEnd.deliveries.pending, icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <CalendarCheck2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Close My Day</h1>
            <p className="text-sm text-neutral-500">{dayEnd.businessDate}{dayEnd.deliveryPartnerName ? ` · ${dayEnd.deliveryPartnerName}` : ''}</p>
          </div>
        </div>
        <Badge variant={DAY_END_STATUS_VARIANT[dayEnd.status] || 'neutral'} dot>
          {DAY_END_STATUS_LABEL[dayEnd.status] || dayEnd.status}
        </Badge>
      </div>

      {dayEnd.status === 'rejected' && dayEnd.rejectionReason && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">This day-end was rejected.</p>
          <p className="mt-1">{dayEnd.rejectionReason}</p>
          <p className="mt-1 text-red-600/80">Correct the amounts / notes below and submit again.</p>
        </div>
      )}

      {dayEnd.status === 'submitted' && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Submitted{dayEnd.submittedAt ? ` on ${formatDateTime(dayEnd.submittedAt)}` : ''} — awaiting admin review.
        </div>
      )}

      {dayEnd.status === 'approved' && (
        <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p className="font-medium">
            Approved{dayEnd.reviewedAt ? ` on ${formatDateTime(dayEnd.reviewedAt)}` : ''}{dayEnd.reviewedByName ? ` by ${dayEnd.reviewedByName}` : ''}.
          </p>
          {dayEnd.reviewNote && <p className="mt-1">{dayEnd.reviewNote}</p>}
        </div>
      )}

      <Card title="Delivery Summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {deliveryStats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500">{label}</p>
                <Icon className="size-4 text-neutral-400" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Collection Summary">
        {formError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4 text-right">Expected</th>
                <th className="py-2 pr-4 text-right">Handed Over</th>
                <th className="py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dayEnd.breakdown.map((entry) => {
                const variance = liveVariance.perMethod[entry.method] ?? entry.variance
                return (
                  <tr key={entry.method}>
                    <td className="py-3 pr-4 font-medium text-neutral-800">{entry.label}</td>
                    <td className="py-3 pr-4 text-right text-neutral-600">{formatCurrency(entry.expected)}</td>
                    <td className="py-3 pr-4 text-right">
                      {isEditable ? (
                        <NumericInput
                          type="number"
                          min="0"
                          value={handedOver[entry.method]}
                          onChange={(event) => setHandedOver((current) => ({ ...current, [entry.method]: event.target.value }))}
                          className="w-28 rounded-lg border border-neutral-200 bg-surface px-2.5 py-1.5 text-right text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                          aria-label={`${entry.label} handed over`}
                        />
                      ) : (
                        <span className="text-neutral-800">{formatCurrency(entry.handedOver)}</span>
                      )}
                    </td>
                    <td className={`py-3 text-right font-medium ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {variance === 0 ? '—' : formatCurrency(variance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 font-semibold text-neutral-900">
                <td className="py-3 pr-4">Total</td>
                <td className="py-3 pr-4 text-right">{formatCurrency(dayEnd.expectedTotal)}</td>
                <td className="py-3 pr-4 text-right">
                  {formatCurrency(isEditable ? liveVariance.handedOverTotal : dayEnd.handedOverTotal)}
                </td>
                <td className={`py-3 text-right ${(isEditable ? liveVariance.total : dayEnd.varianceTotal) < 0 ? 'text-red-600' : (isEditable ? liveVariance.total : dayEnd.varianceTotal) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(isEditable ? liveVariance.total : dayEnd.varianceTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-5">
          <Input
            label="Notes"
            as="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!isEditable}
            required={liveVariance.anyDiffers}
            placeholder={liveVariance.anyDiffers ? 'Required — explain the difference' : 'Optional'}
          />
        </div>

        {isEditable && (
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={handleOpenConfirm} disabled={isSubmitting}>
              <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
              Submit Day-End
            </Button>
          </div>
        )}
      </Card>

      <Modal isOpen={isConfirmOpen} onClose={() => { if (!isSubmitting) setIsConfirmOpen(false) }} title="Submit Day-End?">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            You&apos;re submitting {dayEnd.businessDate}&apos;s day-end with {formatCurrency(liveVariance.handedOverTotal)} handed over
            {liveVariance.total !== 0 && <> ({formatCurrency(liveVariance.total)} variance)</>}. Values can&apos;t be changed after
            submitting unless this is rejected.
          </p>
          {formError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSubmitting} onClick={handleSubmit}>Confirm &amp; Submit</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
