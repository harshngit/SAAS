import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/format'
import { DAY_END_STATUS_LABEL, DAY_END_STATUS_VARIANT } from '../../api/deliveryDayEnd'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-neutral-400">{label}</span>
      <span className="text-right font-medium text-neutral-800">{children ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      <div className="mt-2 divide-y divide-neutral-100">{children}</div>
    </div>
  )
}

// Read-only detail for one delivery partner's day-end session. `onApprove` / `onReject` are
// optional and only wired where the current admin is allowed to act (`submitted` + canReview).
export default function DayEndDetailDrawer({ dayEnd, isOpen, onClose, onApprove, onReject, canReview, busy }) {
  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !dayEnd) return null

  const showActions = canReview && dayEnd.status === 'submitted'

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">{dayEnd.deliveryPartnerName || 'Delivery Partner'}</h2>
              <Badge variant={DAY_END_STATUS_VARIANT[dayEnd.status] || 'neutral'} dot>
                {DAY_END_STATUS_LABEL[dayEnd.status] || dayEnd.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">{dayEnd.businessDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 px-6 py-5">
          <Section title="Delivery Summary">
            <Row label="Assigned">{dayEnd.deliveries.assigned}</Row>
            <Row label="Delivered">{dayEnd.deliveries.delivered}</Row>
            <Row label="Partially Delivered">{dayEnd.deliveries.partiallyDelivered}</Row>
            <Row label="Returned">{dayEnd.deliveries.returned}</Row>
            <Row label="Pending">{dayEnd.deliveries.pending}</Row>
          </Section>

          <Section title="Collection Breakdown">
            {dayEnd.breakdown.map((entry) => (
              <Row key={entry.method} label={entry.label}>
                {formatCurrency(entry.handedOver)}
                <span className="ml-1.5 text-xs text-neutral-400">/ {formatCurrency(entry.expected)} expected</span>
              </Row>
            ))}
            <Row label="Total Expected">{formatCurrency(dayEnd.expectedTotal)}</Row>
            <Row label="Total Handed Over">{formatCurrency(dayEnd.handedOverTotal)}</Row>
            <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <span className="shrink-0 text-neutral-400">Variance</span>
              <span className={`text-right font-semibold ${dayEnd.varianceTotal < 0 ? 'text-red-600' : dayEnd.varianceTotal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {dayEnd.varianceTotal === 0 ? '—' : formatCurrency(dayEnd.varianceTotal)}
              </span>
            </div>
          </Section>

          <Section title="Notes">
            <p className="py-1.5 text-sm text-neutral-700">{dayEnd.notes || 'No notes.'}</p>
          </Section>

          {dayEnd.status === 'rejected' && dayEnd.rejectionReason && (
            <Section title="Rejection Reason">
              <p className="py-1.5 text-sm text-red-700">{dayEnd.rejectionReason}</p>
            </Section>
          )}

          <Section title="Review">
            <Row label="Submitted At">{formatDateTime(dayEnd.submittedAt)}</Row>
            <Row label="Submission Count">{dayEnd.submissionCount}</Row>
            {dayEnd.reviewedAt && (
              <>
                <Row label="Reviewed At">{formatDateTime(dayEnd.reviewedAt)}</Row>
                <Row label="Reviewed By">{dayEnd.reviewedByName || '—'}</Row>
                {dayEnd.reviewNote && <Row label="Review Note">{dayEnd.reviewNote}</Row>}
              </>
            )}
          </Section>

          {dayEnd.history.length > 0 && (
            <Section title="History">
              {dayEnd.history.map((entry, index) => (
                <div key={`${entry.label}-${entry.at || index}`} className="py-2 text-sm">
                  <p className="font-medium text-neutral-800">{entry.label || 'Update'}</p>
                  <p className="text-xs text-neutral-400">
                    {formatDateTime(entry.at)}{entry.actorName ? ` · ${entry.actorName}` : ''}
                  </p>
                  {entry.note && <p className="mt-0.5 text-xs text-neutral-600">{entry.note}</p>}
                </div>
              ))}
            </Section>
          )}
        </div>

        {showActions && (
          <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => onReject?.(dayEnd)}>
              Reject
            </Button>
            <Button type="button" loading={busy} onClick={() => onApprove?.(dayEnd)}>
              Approve
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
