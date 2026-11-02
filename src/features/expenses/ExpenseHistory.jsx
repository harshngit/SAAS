import { CheckCircle2, Circle, Wallet, XCircle } from 'lucide-react'
import { formatDateTime } from '../../utils/format'

// Only renders events that actually happened (a non-null timestamp from the backend) - never
// fabricates intermediate steps.
export default function ExpenseHistory({ expense }) {
  if (!expense) return null

  const events = [{ icon: Circle, label: 'Submitted', timestamp: expense.createdAt, note: '' }]

  if (expense.lifecycleStatus === 'rejected' && expense.reviewedAt) {
    events.push({ icon: XCircle, label: 'Rejected', timestamp: expense.reviewedAt, actor: expense.approverName, note: expense.rejectReason })
  } else if (expense.reviewedAt) {
    events.push({ icon: CheckCircle2, label: 'Approved', timestamp: expense.reviewedAt, actor: expense.approverName })
  }

  if (expense.lifecycleStatus === 'reimbursed' && expense.reimbursedAt) {
    events.push({
      icon: Wallet,
      label: 'Reimbursed',
      timestamp: expense.reimbursedAt,
      actor: expense.reimbursedBy,
      note: [expense.reimbursementMethod, expense.reimbursementReference].filter(Boolean).join(' · ') || expense.reimbursementNotes,
    })
  }

  const ordered = events.filter((event) => event.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  return (
    <div className="space-y-3">
      {ordered.map((event, index) => {
        const Icon = event.icon
        return (
          <div key={`${event.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              {index < ordered.length - 1 && <span className="mt-1 w-px flex-1 bg-neutral-200" />}
            </div>
            <div className="pb-3">
              <p className="text-sm font-medium text-neutral-900">
                {event.label}
                {event.actor ? ` by ${event.actor}` : ''}
              </p>
              <p className="text-xs text-neutral-400">{formatDateTime(event.timestamp)}</p>
              {event.note && <p className="mt-0.5 text-xs text-neutral-600">{event.note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
