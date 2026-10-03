import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  StickyNote,
  UserRound,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Lead status vocabulary - frozen to: New -> Contacted -> Qualified -> Converted / Lost.
// The backend status value for "converted" is still `won`; the UI always shows it
// as "Converted". Visit / Follow-up / Quotation are ACTIVITIES, never statuses.
// ---------------------------------------------------------------------------

export const LEAD_STATUS_VARIANT = {
  new: 'info',
  contacted: 'warning',
  qualified: 'purple',
  won: 'success',
  lost: 'danger',
}

export const LEAD_STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Converted',
  lost: 'Lost',
}

// The linear success path shown in the Lead Journey (New -> Contacted -> Qualified
// -> Converted). "lost" is deliberately NOT in here - a lost lead is rendered as a
// separate red chip, not forced into the line.
export const LEAD_JOURNEY = ['new', 'contacted', 'qualified', 'won']
export const LEAD_JOURNEY_LABELS = ['New', 'Contacted', 'Qualified', 'Converted']

export function getLeadJourneyState(lead) {
  if (!lead) return { index: 0, isLost: false }
  if (lead.leadStatus === 'lost') return { index: 0, isLost: true }
  const index = LEAD_JOURNEY.indexOf(lead.leadStatus)
  return { index: index === -1 ? 0 : index, isLost: false }
}

export function formatLeadLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function formatLeadStatus(value = '') {
  return LEAD_STATUS_LABEL[value] || formatLeadLabel(value)
}

// ---------------------------------------------------------------------------
// Outcome vocabularies. These are FOLLOW-UP / VISIT outcomes - they never change
// the lead's status directly, they just help the user decide the next action.
// ---------------------------------------------------------------------------

export const FOLLOWUP_OUTCOME_OPTIONS = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'need_another_followup', label: 'Need Another Follow-up' },
  { value: 'ready_for_visit', label: 'Ready for Visit' },
  { value: 'ready_to_convert', label: 'Ready to Convert' },
]

// Controlled vocabulary - MUST match the backend VISIT_OUTCOMES list exactly, or the
// visit PATCH is rejected with 400.
export const VISIT_OUTCOME_OPTIONS = [
  { value: 'interested', label: 'Interested' },
  { value: 'follow_up_required', label: 'Follow-up Required' },
  { value: 'ready_to_convert', label: 'Ready to Convert' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'meeting_completed', label: 'Meeting Completed' },
  { value: 'other', label: 'Other' },
]

export function isReadyToConvertOutcome(value) {
  return value === 'ready_to_convert'
}

// "Follow-up required" outcome - accepts the canonical `follow_up_required` and the
// legacy `followup_required` value that older records may still carry.
export function isFollowUpRequiredOutcome(value) {
  return value === 'follow_up_required' || value === 'followup_required'
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_MS = 1000 * 60 * 60 * 24

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Whole-day difference: negative = past, 0 = today, positive = future.
export function dayDelta(value, from = new Date()) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.round((startOfDay(date) - startOfDay(from)) / DAY_MS)
}

export function relativeDay(value, from = new Date()) {
  const delta = dayDelta(value, from)
  if (delta === null) return '—'
  if (delta === 0) return 'Today'
  if (delta === -1) return 'Yesterday'
  if (delta === 1) return 'Tomorrow'
  if (delta < 0) return `${Math.abs(delta)} days ago`
  return `in ${delta} days`
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

// A friendly "Today, 4:00 PM" / "Tomorrow" / "03 Sep 2026" / "Overdue by 2 days" label
// for a due date-time, plus a tone so the caller can colour it.
export function describeDueDate(value, from = new Date()) {
  const delta = dayDelta(value, from)
  if (delta === null) return { label: '—', tone: 'muted', overdueDays: 0 }
  if (delta < 0) return { label: `Overdue by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'}`, tone: 'danger', overdueDays: Math.abs(delta) }
  if (delta === 0) return { label: `Today, ${formatTime(value)}`, tone: 'warning', overdueDays: 0 }
  if (delta === 1) return { label: 'Tomorrow', tone: 'default', overdueDays: 0 }
  return { label: formatShortDate(value), tone: 'default', overdueDays: 0 }
}

// ---------------------------------------------------------------------------
// Real-data-only activity summary for the Leads list "Last Activity" (CSV export)
// and "Next Follow-up" (table column) fields.
//
// Previously this whole module was a deterministic MOCK (a hash of the lead id spread
// pseudo-randomly across a few fixed outcomes, plus invented action verbs like "Called"/
// "Note added" with no real activity data behind them) - removed entirely. Next Follow-up now
// comes from the real GET /follow-ups endpoint (see LeadList.jsx, which fetches pending
// follow-ups once for the whole page and passes the earliest due date in here per lead via
// `nextFollowUpDueDate`). Last Activity only ever states what the lead record itself actually
// proves happened - it never guesses a specific action.
// ---------------------------------------------------------------------------

export function getLastActivityLabel(lead) {
  if (!lead) return { label: 'No activity', tone: 'muted' }

  if (lead.convertedAt) {
    return { label: `Converted ${relativeDay(lead.convertedAt).toLowerCase()}`, tone: 'success' }
  }

  const updatedMs = lead.updatedAt ? new Date(lead.updatedAt).getTime() : 0
  const createdMs = lead.createdAt ? new Date(lead.createdAt).getTime() : 0
  if (updatedMs && updatedMs - createdMs > 60_000) {
    // The record changed after creation, but the lead itself carries no field saying what
    // changed (no "call logged" / "note added" distinction exists on it) - say only what's
    // actually known: it was updated, and when.
    return { label: `Updated ${relativeDay(lead.updatedAt).toLowerCase()}`, tone: 'default' }
  }

  if (createdMs) {
    return { label: `Created ${relativeDay(lead.createdAt).toLowerCase()}`, tone: 'muted' }
  }

  return { label: 'No activity', tone: 'muted' }
}

// `dueDate` is the earliest PENDING follow-up due date already resolved for this lead by the
// caller (grouped from one real GET /follow-ups?status=pending call - see LeadList.jsx). `null`/
// undefined means no pending follow-up was found for this lead, which is the honest "—" case,
// not an error.
export function getNextFollowUpSummary(dueDate) {
  if (!dueDate) return { label: '—', tone: 'muted', overdueDays: 0 }
  return describeDueDate(dueDate)
}

// ---------------------------------------------------------------------------
// Activity timeline for the Lead Detail page. Merges the real lead lifecycle
// events with visit events and the locally-tracked follow-ups. Newest first.
// ---------------------------------------------------------------------------

export function buildLeadTimeline({ lead, visits = [], localFollowUps = [] }) {
  if (!lead) return []
  const events = []

  events.push({
    id: 'created',
    icon: Sparkles,
    iconClass: 'bg-primary-50 text-primary-700',
    title: 'Lead created',
    subtitle: lead.leadSource ? `Captured via ${lead.leadSource}` : 'Lead was captured',
    timestamp: lead.createdAt,
  })

  if (lead.assignedSalespersonName) {
    events.push({
      id: 'assigned',
      icon: UserRound,
      iconClass: 'bg-blue-50 text-blue-600',
      title: `Assigned to ${lead.assignedSalespersonName}`,
      subtitle: 'Lead assigned for follow-up',
      timestamp: lead.createdAt,
    })
  }

  const meaningfullyUpdated =
    lead.updatedAt && lead.createdAt && new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime() > 60_000
  if (meaningfullyUpdated && lead.leadStatus !== 'new' && lead.leadStatus !== 'won' && !lead.convertedAt) {
    events.push({
      id: 'status',
      icon: RefreshCw,
      iconClass: 'bg-amber-50 text-amber-600',
      title: `Status changed to ${formatLeadStatus(lead.leadStatus)}`,
      subtitle: 'Lead status was last changed here',
      timestamp: lead.updatedAt,
    })
  }

  const pushFollowUpEvents = (task, keyPrefix) => {
    events.push({
      id: `${keyPrefix}-${task.id}`,
      icon: ClipboardList,
      iconClass: 'bg-primary-50 text-primary-700',
      title: `Follow-up created: ${task.title}`,
      subtitle: task.description || 'Follow-up task added',
      timestamp: task.createdAt,
    })
    if (task.status === 'completed') {
      events.push({
        id: `${keyPrefix}-done-${task.id}`,
        icon: ClipboardCheck,
        iconClass: 'bg-green-50 text-green-600',
        title: `Follow-up completed: ${task.title}`,
        subtitle:
          [task.outcome && formatLeadLabel(task.outcome), task.outcomeNotes].filter(Boolean).join(' · ') || 'Marked complete',
        timestamp: task.completedAt || task.createdAt,
      })
    }
  }

  visits.forEach((visit) => {
    const visitTitle =
      visit.status === 'completed'
        ? 'Visit completed'
        : visit.status === 'cancelled'
          ? 'Visit cancelled'
          : visit.status === 'in_progress'
            ? 'Visit started'
            : 'Visit scheduled'
    events.push({
      id: `visit-${visit.id}`,
      icon: MapPin,
      iconClass: visit.status === 'completed' ? 'bg-green-50 text-green-600' : visit.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
      title: visitTitle,
      subtitle: [
        formatLeadLabel(visit.visitType),
        visit.outcome && `Outcome: ${formatLeadLabel(visit.outcome)}`,
        visit.status === 'cancelled' && visit.cancellationReason && `Reason: ${visit.cancellationReason}`,
      ].filter(Boolean).join(' · '),
      timestamp: visit.visitDate || visit.createdAt,
    })
    // Follow-ups that originate from a visit are part of this lead's activity too.
    ;(visit.followUps || []).forEach((task) => pushFollowUpEvents(task, `visit-fu-${visit.id}`))
  })

  localFollowUps.forEach((task) => pushFollowUpEvents(task, 'followup'))

  if (lead.convertedAt || lead.convertedCustomerId || lead.leadStatus === 'won') {
    events.push({
      id: 'converted',
      icon: ShoppingBag,
      iconClass: 'bg-green-50 text-green-600',
      title: 'Converted to Customer',
      subtitle: 'A customer record was created from this lead',
      timestamp: lead.convertedAt || lead.updatedAt,
    })
  }

  return events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
}

// ---------------------------------------------------------------------------
// Follow-up type is a display-only hint (backend has no `type` field yet).
// Guessed from the task title. TODO: use a real field when the API adds one.
// ---------------------------------------------------------------------------

export function deriveFollowUpType(title = '') {
  const value = title.toLowerCase()
  if (/\bcall|phone|ring\b/.test(value)) return 'Call'
  if (/\bvisit|site|meet at\b/.test(value)) return 'Visit'
  if (/\bemail|mail|send\b/.test(value)) return 'Email'
  if (/\bmeet|meeting|demo\b/.test(value)) return 'Meeting'
  if (/\bquot|quote|proposal\b/.test(value)) return 'Quotation'
  return 'Follow-up'
}

export const FOLLOWUP_TYPE_ICON = {
  Call: ClipboardList,
  Visit: MapPin,
  Email: FileText,
  Meeting: UserRound,
  Quotation: FileText,
  'Follow-up': ClipboardList,
}

export { CheckCircle2, StickyNote }
