import { CheckCircle2, Circle, HelpCircle, RotateCcw, Wallet, XCircle } from 'lucide-react'
import { formatDateTime } from '../../utils/format'

// Only renders events that actually happened (a non-null timestamp from the backend) - never
// fabricates intermediate steps.
//
// The backend has no separate history/events array - `reviewed_at` is a single field that gets
// overwritten by whichever review action happened most recently, so a clarification request or
// a resubmission can only be shown here while they're still the CURRENT state (statusKey);
// once the expense moves on to a later decision, that single field belongs to the new action
// and the earlier one is no longer reconstructable - this never guesses at it.
export default function ExpenseHistory({ expense }) {
  if (!expense) return null

  const events = [{ icon: Circle, label: 'Submitted', timestamp: expense.createdAt, actor: expense.submittedByName, note: '' }]

  if (expense.statusKey === 'rejected' && expense.reviewedAt) {
    events.push({ icon: XCircle, label: 'Rejected', timestamp: expense.reviewedAt, actor: expense.approverName, note: expense.rejectReason })
  } else if (expense.statusKey === 'clarification_requested' && expense.reviewedAt) {
    events.push({ icon: HelpCircle, label: 'Clarification Requested', timestamp: expense.reviewedAt, actor: expense.approverName, note: expense.clarificationNote })
  } else if (expense.reviewedAt) {
    events.push({ icon: CheckCircle2, label: 'Approved', timestamp: expense.reviewedAt, actor: expense.approverName })
  }

  // Edited and sent back after a clarification request, inferred from the only two fields
  // available for it: a clarification note on file, and an edit (updatedAt) newer than that
  // review - while the expense is pending again (not still awaiting that same clarification).
  if (
    expense.statusKey === 'pending' &&
    expense.clarificationNote &&
    expense.reviewedAt &&
    expense.updatedAt &&
    new Date(expense.updatedAt) > new Date(expense.reviewedAt)
  ) {
    events.push({
      icon: RotateCcw,
      label: 'Resubmitted',
      timestamp: expense.updatedAt,
      actor: expense.submittedByName,
      note: 'Edited and resubmitted after a clarification request.',
    })
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
