// -----------------------------------------------------------------------------
// Visit status vs Follow-up status - two DIFFERENT things, never one badge.
// -----------------------------------------------------------------------------
// Visit completion status is the backend `visit.status` enum
// (`planned | in_progress | completed | cancelled` - see VISIT_STATUS_OPTIONS).
// The backend now tracks the lifecycle explicitly:
//   planned    = scheduled, not started (checked_in_at is null)
//   in_progress = checked in, not yet checked out
//   completed  = checked out / done
//   cancelled  = called off (carries cancellation_reason)
// Both `planned` and `in_progress` are still open and can be completed or cancelled.

export const VISIT_STATUS_META = {
  planned: { key: 'planned', label: 'Scheduled', variant: 'neutral' },
  in_progress: { key: 'in_progress', label: 'In Progress', variant: 'info' },
  completed: { key: 'completed', label: 'Completed', variant: 'success' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'danger' },
}

export function deriveVisitStatus(visit) {
  const raw = String(visit?.status || 'completed').toLowerCase()
  if (VISIT_STATUS_META[raw]) return VISIT_STATUS_META[raw]
  return { key: raw || 'unknown', label: raw ? raw[0].toUpperCase() + raw.slice(1) : '—', variant: 'neutral' }
}

// Explicit lifecycle checks. The PRIMARY action is chosen from these, never from a
// generic "open" flag:
//   scheduled  -> Start Visit  (planned -> in_progress)
//   inProgress -> Complete Visit (in_progress -> completed)
//   terminal   -> View Details only
export function isVisitScheduled(visit) {
  return String(visit?.status || '').toLowerCase() === 'planned'
}
export function isVisitInProgress(visit) {
  return String(visit?.status || '').toLowerCase() === 'in_progress'
}
export function isVisitTerminal(visit) {
  const raw = String(visit?.status || '').toLowerCase()
  return raw === 'completed' || raw === 'cancelled'
}

// Non-terminal = planned OR in_progress. Use only for generic "still open" logic
// (e.g. whether Cancel Visit is allowed) - NOT to pick the primary action.
export function isVisitOpen(visit) {
  return !isVisitTerminal(visit) && Boolean(String(visit?.status || '').toLowerCase())
}

// Follow-up task status - completely separate from the visit. Backend `status` is
// `pending | completed`; "Overdue" is derived from `due_date` for a still-pending task.
export function deriveFollowUpStatus(followUp) {
  if (!followUp) return null
  if (followUp.status === 'completed') return { key: 'completed', label: 'Completed', variant: 'success' }
  const due = followUp.dueDate ? new Date(followUp.dueDate) : null
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
    return { key: 'overdue', label: 'Overdue', variant: 'danger' }
  }
  return { key: 'pending', label: 'Pending', variant: 'warning' }
}
