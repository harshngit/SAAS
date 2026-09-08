import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRightCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  StickyNote,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { ROLES } from '../../auth/roles'
import {
  deleteLead,
  getLead,
  manualStatusOptionsFor,
  updateLead,
} from '../../api/leads'
import { listAssignableStaff, listUsers } from '../../api/users'
import { VISIT_TYPE_OPTIONS, createVisit, createVisitFollowUp, listVisits } from '../../api/visits'
import { completeFollowUp, createFollowUp, deleteFollowUp, listFollowUps, updateFollowUp } from '../../api/followups'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { customerBasePathByRole } from '../customers/customerConstants'
import { LeadEditForm } from './LeadForms'
import ConvertLeadModal from './ConvertLeadModal'
import { deriveFollowUpStatus, deriveVisitStatus } from '../visits/visitStatus'
import {
  FOLLOWUP_OUTCOME_OPTIONS,
  LEAD_STATUS_VARIANT as statusVariant,
  buildLeadTimeline,
  describeDueDate,
  formatLeadLabel as formatLabel,
  formatLeadStatus,
  getLeadJourneyState,
  isReadyToConvertOutcome,
} from './leadActivity'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}


function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const taskPriorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function emptyVisitFormData() {
  const now = new Date()
  const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15
  now.setMinutes(roundedMinutes, 0, 0)

  return {
    visitType: 'site_visit',
    visitDate: now.toISOString().slice(0, 10),
    visitTime: now.toTimeString().slice(0, 5),
    purpose: '',
    notes: '',
    createFollowUpTask: false,
    title: '',
    description: '',
    dueDate: todayIso(),
    dueTime: '10:00',
    assigneeId: '',
    priority: 'medium',
  }
}

function emptyFollowUpFormData() {
  return {
    title: '',
    description: '',
    dueDate: todayIso(),
    dueTime: '10:00',
    assigneeId: '',
    priority: 'medium',
  }
}

// Notes are stored as one flat string (the backend has no notes-log table) - each "Add Note"
// prepends a "[timestamp] text" entry, joined by a blank line. Parse that back into individual
// entries so they render as a proper timeline instead of one raw block of bracketed text.
function parseNoteEntries(notes) {
  if (!notes) return []

  return notes
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const match = entry.match(/^\[(.+?)\]\s*([\s\S]*)$/)
      return {
        id: index,
        timestamp: match ? match[1] : null,
        text: match ? match[2] : entry,
      }
    })
}

// --- Text-hierarchy tokens (applied consistently across the page) ---------------------------
//   heading / section title / body value  -> near-black  (text-neutral-900)
//   subtitle / label / helper / timestamp -> medium grey (text-neutral-500)
//   low-priority metadata / placeholder   -> light grey  (text-neutral-400)
//   green -> actions, active/current, success/status only

// A compact icon + label/value cell used in the summary strip.
function SummaryItem({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <div className="mt-1 truncate text-sm font-medium text-neutral-900">{children}</div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, actions, children, className = '', bodyClassName = 'mt-4' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Icon className="size-4" aria-hidden="true" />
            </div>
          )}
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
        </div>
        {actions}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-neutral-900" title={value || '—'}>{value || '—'}</p>
    </div>
  )
}

function TimelineItem({ icon: Icon, iconClass, title, subtitle, timestamp, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-neutral-100" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-5'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="text-xs text-neutral-500">{formatDateTime(timestamp)}</p>
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// Green "+ Add Activity" split-style menu button used in the activity area header.
function AddActivityMenu({ items }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setPos({ top: rect.bottom + 6, left: rect.right - 208 })
    }
    place()
    const onDoc = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  return (
    <>
      <Button ref={triggerRef} type="button" size="sm" onClick={() => setOpen((v) => !v)}>
        <Plus className="size-4" aria-hidden="true" />
        Add Activity
        <ChevronDown className="size-4" aria-hidden="true" />
      </Button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: Math.max(8, pos.left), width: 208 }}
          className="z-50 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-(--shadow-popover)"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onClick?.() }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              {item.icon && <item.icon className="size-4 text-neutral-500" aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function LeadJourneyNode({ index, label, state, isLast }) {
  const circleClass =
    state === 'lost'
      ? 'bg-red-50 text-red-600 ring-2 ring-red-500'
      : state === 'done'
        ? 'bg-primary-600 text-white'
        : state === 'current'
          ? 'bg-primary-600 text-white ring-4 ring-primary-100'
          : 'bg-neutral-100 text-neutral-400'

  return (
    <div className={`flex items-start gap-0 ${isLast ? 'shrink-0' : 'flex-1'}`}>
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circleClass}`}>
          {state === 'lost' ? <X className="size-4" /> : state === 'done' ? <Check className="size-4" /> : index}
        </div>
        <p className={`mt-2 max-w-24 text-center text-xs font-semibold ${state === 'pending' ? 'text-neutral-500' : 'text-neutral-900'}`}>
          {label}
        </p>
        {/* Reserve the sub-label line on every node so all nodes stay the same height. */}
        <p className="mt-0.5 h-3.5 text-[0.65rem] font-semibold leading-none text-primary-600">
          {state === 'current' ? 'Current Stage' : ' '}
        </p>
      </div>
      {!isLast && <div className={`mt-4 h-0.5 flex-1 ${state === 'done' || state === 'lost' ? 'bg-primary-500' : 'bg-neutral-100'}`} />}
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const leadBasePath = isSalesOfficer ? '/sales/leads' : '/admin/leads'
  const customerBasePath = customerBasePathByRole[currentUser?.role] || '/sales/customers'

  const [lead, setLead] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [salespeople, setSalespeople] = useState([])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [isConvertOpen, setIsConvertOpen] = useState(false)

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusValue, setStatusValue] = useState('')
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  const [visits, setVisits] = useState([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const [visitsError, setVisitsError] = useState('')

  const [isVisitOpen, setIsVisitOpen] = useState(false)
  const [visitFormData, setVisitFormData] = useState(emptyVisitFormData)
  const [isSavingVisit, setIsSavingVisit] = useState(false)
  const [visitFormError, setVisitFormError] = useState('')
  const [assignableStaff, setAssignableStaff] = useState([])

  // Follow-ups raised directly on a lead - persisted via POST /follow-ups with lead_id
  // (the backend now supports a lead-only follow-up: no customer_id / visit_id needed).
  // These are the lead's DIRECT follow-ups; the ones that came from a visit arrive
  // through visits[].followUps instead and are filtered out of this list.
  const [directFollowUps, setDirectFollowUps] = useState([])
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(true)
  const [followUpsError, setFollowUpsError] = useState('')
  const [activitiesTab, setActivitiesTab] = useState('activity')

  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false)
  const [followUpFormData, setFollowUpFormData] = useState(emptyFollowUpFormData)
  const [editingFollowUpId, setEditingFollowUpId] = useState(null)
  const [followUpFormError, setFollowUpFormError] = useState('')
  const [savingFollowUp, setSavingFollowUp] = useState(false)

  const [completingFollowUp, setCompletingFollowUp] = useState(null)
  const [completeOutcome, setCompleteOutcome] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')
  const [readyToConvertNudge, setReadyToConvertNudge] = useState(false)

  const loadLead = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getLead(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setLead(result.lead)
    setIsLoading(false)
  }

  useEffect(() => {
    loadLead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function loadVisits() {
      setIsLoadingVisits(true)
      setVisitsError('')

      const result = await listVisits({ leadId: id })

      if (!isMounted) return

      if (!result.success) {
        setVisits([])
        setVisitsError(result.error)
        setIsLoadingVisits(false)
        return
      }

      setVisits(result.visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)))
      setIsLoadingVisits(false)
    }

    loadVisits()
    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function loadFollowUps() {
      setIsLoadingFollowUps(true)
      setFollowUpsError('')

      const result = await listFollowUps({ leadId: id })

      if (!isMounted) return

      if (!result.success) {
        setDirectFollowUps([])
        setFollowUpsError(result.error)
        setIsLoadingFollowUps(false)
        return
      }

      // GET /follow-ups?lead_id= returns visit-generated follow-ups too (they carry
      // lead_id). Those already render through the Visits tab, so keep only this lead's
      // DIRECT ones. Requiring leadId === id also guards an older backend that ignores
      // the lead_id filter.
      setDirectFollowUps(result.followUps.filter((task) => task.leadId === id && !task.visitId))
      setIsLoadingFollowUps(false)
    }

    loadFollowUps()
    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const usersPromise = currentUser?.role === ROLES.SALES_OFFICER ? Promise.resolve({ success: true, users: [] }) : listUsers()
      // GET /users/assignable is the privacy-safe picker any follow_ups:create role can call
      // (unlike admin-only GET /users) - used for the Schedule Visit follow-up task assignee field.
      const staffPromise = listAssignableStaff()
      const [usersResult, staffResult] = await Promise.all([usersPromise, staffPromise])
      if (!isMounted) return

      if (currentUser?.role === ROLES.SALES_OFFICER) {
        setSalespeople(
          currentUser?.id
            ? [{ id: currentUser.id, name: currentUser.name || 'Current user', role: currentUser.role, isActive: true }]
            : [],
        )
      } else if (usersResult.success) {
        setSalespeople(
          usersResult.users
            .map(normalizeApiUser)
            .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
        )
      }
      if (staffResult.success && staffResult.users.length > 0) {
        setAssignableStaff(staffResult.users)
      } else if (currentUser?.id) {
        setAssignableStaff([{ id: currentUser.id, name: currentUser.name || 'Me' }])
      }
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.role])

  const salespersonOptions = useMemo(
    () => salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespeople],
  )
  const assigneeOptions = useMemo(
    () => assignableStaff.map((user) => ({ value: user.id, label: user.name || 'User' })),
    [assignableStaff],
  )

  const isConverted = Boolean(lead?.convertedCustomerId)
  // A Lost lead cannot convert straight to a customer - the rep must first re-open it
  // (Edit Lead -> status Contacted / Qualified). Recovery activity stays available.
  const isLost = lead?.leadStatus === 'lost'
  // A converted lead is read-only server-side: PATCH / DELETE on the lead return 400
  // (spec §10.6). Editing, notes, status and delete are hidden; activity history stays.
  const isReadOnlyLead = isConverted || lead?.leadStatus === 'won'

  const journeyState = useMemo(() => getLeadJourneyState(lead), [lead])

  // Every follow-up that belongs to this lead THROUGH one of its visits (real, persisted).
  // Each is tagged with the visit it came from so the origin stays visible.
  const visitFollowUps = useMemo(
    () =>
      visits.flatMap((visit) =>
        (visit.followUps || []).map((task) => ({
          ...task,
          origin: { visitId: visit.id, visitType: visit.visitType, visitDate: visit.visitDate },
        })),
      ),
    [visits],
  )

  // The lead's full follow-up list = via-visit (real) + direct (real, POST /follow-ups
  // with lead_id). Direct ones are editable here; via-visit ones are managed from the visit.
  const allLeadFollowUps = useMemo(
    () => {
      const direct = directFollowUps.map((task) => ({
        ...task,
        isDirect: true,
      }))
      return [...visitFollowUps, ...direct].sort(
        (a, b) => new Date(a.dueDate || a.createdAt || 0) - new Date(b.dueDate || b.createdAt || 0),
      )
    },
    [visitFollowUps, directFollowUps],
  )

  const timelineEvents = useMemo(
    () => buildLeadTimeline({ lead, visits, localFollowUps: directFollowUps }),
    [lead, visits, directFollowUps],
  )

  const noteEntries = useMemo(() => parseNoteEntries(lead?.notes), [lead?.notes])

  // Interested products: the normalized `interestedProducts` briefs when present, else the
  // legacy free-text field split on comma / newline / bullet.
  const interestedProducts = useMemo(() => {
    if (Array.isArray(lead?.interestedProducts) && lead.interestedProducts.length > 0) {
      return lead.interestedProducts.map((product) => product.name).filter(Boolean)
    }
    return String(lead?.interestedProduct || '')
      .split(/\s*(?:,|;|\n|\||•)\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
  }, [lead?.interestedProducts, lead?.interestedProduct])

  // "A and B" for two, "A, B and N more" for longer lists - shown in the Product Interest strip.
  const productInterestSummary = useMemo(() => {
    const list = interestedProducts
    if (list.length <= 1) return list[0] || ''
    if (list.length === 2) return `${list[0]} and ${list[1]}`
    return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`
  }, [interestedProducts])

  const handleSaveLead = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateLead(id, formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    setLead(result.lead)
    setIsSaving(false)
    setIsEditOpen(false)
    showToast({ title: 'Lead updated', message: 'Changes have been saved.' })
  }

  const handleLeadConverted = async ({ customerId }) => {
    await loadLead()
    if (customerId) navigate(`${customerBasePath}/${customerId}`)
  }

  const handleDeleteLead = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteLead(id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    navigate(leadBasePath)
  }

  const openNoteModal = () => {
    setNoteText('')
    setNoteError('')
    setIsNoteOpen(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      setNoteError('Enter a note before saving.')
      return
    }

    setIsSavingNote(true)
    setNoteError('')

    const stamp = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())
    const nextNotes = [`[${stamp}] ${noteText.trim()}`, lead.notes].filter(Boolean).join('\n\n')

    const result = await updateLead(id, { ...lead, notes: nextNotes })

    if (!result.success) {
      setNoteError(result.error)
      setIsSavingNote(false)
      return
    }

    setLead(result.lead)
    setIsSavingNote(false)
    setIsNoteOpen(false)
    showToast({ title: 'Note added', message: 'Your note has been saved to this lead.' })
  }

  const openVisitModal = () => {
    setVisitFormData(emptyVisitFormData())
    setVisitFormError('')
    setIsVisitOpen(true)
  }

  const handleSaveVisit = async () => {
    if (visitFormData.createFollowUpTask && !visitFormData.title.trim()) {
      setVisitFormError('Enter a follow-up task title.')
      return
    }

    setIsSavingVisit(true)
    setVisitFormError('')

    // Lead-only visit: pass lead_id, deliberately omit customer_id (backend now allows either).
    const result = await createVisit({
      leadId: id,
      visitType: visitFormData.visitType,
      visitDate: `${visitFormData.visitDate}T${visitFormData.visitTime}:00`,
      purpose: visitFormData.purpose.trim(),
      notes: visitFormData.notes.trim(),
    })

    if (!result.success) {
      setVisitFormError(result.error)
      setIsSavingVisit(false)
      return
    }

    let visit = result.visit

    if (visitFormData.createFollowUpTask) {
      const dueDate = `${visitFormData.dueDate}T${visitFormData.dueTime}:00`
      const taskResult = await createVisitFollowUp(visit.id, {
        title: visitFormData.title,
        description: visitFormData.description,
        dueDate,
        priority: visitFormData.priority,
        assigneeId: visitFormData.assigneeId,
      })

      if (taskResult.success) {
        visit = { ...visit, followUps: [...visit.followUps, taskResult.followUp] }
      }

      setVisits((current) => [visit, ...current])
      setIsSavingVisit(false)
      setIsVisitOpen(false)
      showToast(
        taskResult.success
          ? { title: 'Visit scheduled', message: 'The visit and follow-up task have been saved.' }
          : { title: 'Visit scheduled, follow-up failed', message: taskResult.error, variant: 'error' },
      )
      return
    }

    setVisits((current) => [visit, ...current])
    setIsSavingVisit(false)
    setIsVisitOpen(false)
    showToast({ title: 'Visit scheduled', message: 'The visit has been saved to this lead.' })
  }

  const openStatusModal = () => {
    setStatusValue(lead.leadStatus)
    setStatusError('')
    setIsStatusOpen(true)
  }

  const handleSaveStatus = async () => {
    setIsSavingStatus(true)
    setStatusError('')

    const result = await updateLead(id, { ...lead, leadStatus: statusValue })

    if (!result.success) {
      setStatusError(result.error)
      setIsSavingStatus(false)
      return
    }

    setLead(result.lead)
    setIsSavingStatus(false)
    setIsStatusOpen(false)
    showToast({ title: 'Status updated', message: `Lead status set to ${formatLeadStatus(statusValue)}.` })
  }

  // --- Local (lead-scoped) follow-ups -------------------------------------------------
  const openAddFollowUp = () => {
    setEditingFollowUpId(null)
    setFollowUpFormData(emptyFollowUpFormData())
    setFollowUpFormError('')
    setIsFollowUpOpen(true)
  }

  const openEditFollowUp = (task) => {
    const due = task.dueDate ? new Date(task.dueDate) : new Date()
    setEditingFollowUpId(task.id)
    setFollowUpFormData({
      title: task.title,
      description: task.description,
      dueDate: due.toISOString().slice(0, 10),
      dueTime: due.toTimeString().slice(0, 5),
      assigneeId: task.assignedToId || '',
      priority: task.priority || 'medium',
    })
    setFollowUpFormError('')
    setIsFollowUpOpen(true)
  }

  const handleSaveFollowUp = async () => {
    if (!followUpFormData.title.trim()) {
      setFollowUpFormError('Enter a follow-up title.')
      return
    }

    const dueDate = `${followUpFormData.dueDate}T${followUpFormData.dueTime}:00`
    const payload = {
      title: followUpFormData.title.trim(),
      description: followUpFormData.description.trim(),
      dueDate,
      priority: followUpFormData.priority,
      assigneeId: followUpFormData.assigneeId || undefined,
    }

    setSavingFollowUp(true)
    setFollowUpFormError('')

    const result = editingFollowUpId
      ? await updateFollowUp(editingFollowUpId, payload)
      : await createFollowUp({ ...payload, leadId: id })

    setSavingFollowUp(false)

    if (!result.success) {
      setFollowUpFormError(result.error)
      return
    }

    setDirectFollowUps((current) =>
      editingFollowUpId
        ? current.map((task) => (task.id === editingFollowUpId ? result.followUp : task))
        : [result.followUp, ...current],
    )
    setIsFollowUpOpen(false)
    setActivitiesTab('followups')
    showToast({
      title: editingFollowUpId ? 'Follow-up updated' : 'Follow-up added',
      message: 'Saved to this lead.',
    })
  }

  const deleteDirectFollowUp = async (taskId) => {
    const result = await deleteFollowUp(taskId)
    if (!result.success) {
      showToast({ title: 'Delete failed', message: result.error, variant: 'error' })
      return
    }
    setDirectFollowUps((current) => current.filter((task) => task.id !== taskId))
  }

  const openCompleteFollowUp = (task) => {
    setCompletingFollowUp(task)
    setCompleteOutcome('')
    setCompleteNotes('')
  }

  const handleCompleteFollowUp = async () => {
    const task = completingFollowUp
    if (!task) return
    const outcome = completeOutcome.trim()
    const notes = completeNotes.trim()

    setSavingFollowUp(true)
    const result = await completeFollowUp(task.id, {
      ...(outcome ? { outcome } : {}),
      ...(notes ? { outcomeNotes: notes } : {}),
    })
    setSavingFollowUp(false)

    if (!result.success) {
      showToast({ title: 'Unable to complete follow-up', message: result.error, variant: 'error' })
      return
    }

    setDirectFollowUps((current) => current.map((entry) => (entry.id === task.id ? result.followUp : entry)))
    setCompletingFollowUp(null)
    if (isReadyToConvertOutcome(outcome) && !isConverted && !isLost) {
      setReadyToConvertNudge(true)
    }
    showToast({ title: 'Follow-up completed', message: outcome ? `Outcome: ${formatLabel(outcome)}.` : 'Follow-up completed.' })
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white">
        <LoadingSpinner label="Loading lead..." />
      </div>
    )
  }

  if (loadError || !lead) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white py-16 text-center">
        <p className="text-sm text-red-600">{loadError || 'Lead not found.'}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(leadBasePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Leads
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <button
        type="button"
        onClick={() => navigate(leadBasePath)}
        className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-primary-700"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Leads
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
              {lead.name || lead.customerName || 'New prospect'}
            </h1>
            <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLeadStatus(lead.leadStatus)}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {lead.leadId}
            {lead.createdAt ? <span className="text-neutral-400"> · Created on {formatDate(lead.createdAt)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnlyLead && (
            <Button variant="outline" size="sm" onClick={() => { setFormError(''); setIsEditOpen(true) }}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit Lead
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openAddFollowUp}>
            <ClipboardList className="size-4" aria-hidden="true" />
            Add Follow-up
          </Button>
          <Button variant="outline" size="sm" onClick={openVisitModal}>
            <MapPin className="size-4" aria-hidden="true" />
            Schedule Visit
          </Button>
          {isConverted ? (
            <Button size="sm" onClick={() => navigate(`${customerBasePath}/${lead.convertedCustomerId}`)}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              View Customer
            </Button>
          ) : isLost ? null : (
            <Button size="sm" onClick={() => setIsConvertOpen(true)}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              Convert to Customer
            </Button>
          )}
          {!isReadOnlyLead && (
            <ActionMenu
              items={[
                { label: 'Update Status', icon: RefreshCw, onClick: openStatusModal },
                // DELETE on a converted lead returns 400, so it is only offered here.
                { label: 'Delete Lead', icon: Trash2, danger: true, onClick: () => { setDeleteError(''); setIsDeleteOpen(true) } },
              ]}
            />
          )}
        </div>
      </div>

      {isReadOnlyLead && (
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-2.5 text-xs text-neutral-500">
          This lead has been converted to a customer and is read-only. Its visit and follow-up history stays available below.
        </div>
      )}

      {/* Compact summary strip - the facts a rep needs at a glance, shown once. */}
      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem icon={Phone} label="Phone">
            {lead.mobileNumber ? (
              <a href={`tel:${lead.mobileNumber}`} className="text-primary-700 hover:underline">{lead.mobileNumber}</a>
            ) : '—'}
          </SummaryItem>
          <SummaryItem icon={Tag} label="Source">{lead.leadSource || '—'}</SummaryItem>
          <SummaryItem icon={UserRound} label="Assigned To">{lead.assignedSalespersonName || 'Unassigned'}</SummaryItem>
          <SummaryItem icon={Package} label="Interested Products">
            {interestedProducts.length === 0 ? (
              '—'
            ) : isReadOnlyLead ? (
              `${interestedProducts.length} product${interestedProducts.length === 1 ? '' : 's'}`
            ) : (
              <button
                type="button"
                onClick={() => { setFormError(''); setIsEditOpen(true) }}
                className="inline-flex items-center gap-1 text-primary-700 hover:underline"
              >
                {interestedProducts.length} product{interestedProducts.length === 1 ? '' : 's'}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </SummaryItem>
          <SummaryItem icon={Calendar} label="Created Date">{formatDateTime(lead.createdAt)}</SummaryItem>
        </div>
      </div>

      {readyToConvertNudge && !isConverted && !isLost && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-primary-900">
            <CheckCircle2 className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
            A follow-up marked this lead ready — convert it to a customer.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsConvertOpen(true)}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              Convert to Customer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReadyToConvertNudge(false)}>Dismiss</Button>
          </div>
        </div>
      )}

      <Section title="Lead Journey" icon={Calendar}>
        <div className="flex items-start px-1">
          <LeadJourneyNode index={1} label="New" state={journeyState.isLost ? 'done' : journeyState.index > 0 ? 'done' : 'current'} />
          <LeadJourneyNode index={2} label="Contacted" state={journeyState.index > 1 ? 'done' : journeyState.index === 1 ? 'current' : 'pending'} />
          <LeadJourneyNode index={3} label="Qualified" state={journeyState.index > 2 ? 'done' : journeyState.index === 2 ? 'current' : 'pending'} />
          <LeadJourneyNode index={4} label="Converted" state={journeyState.index >= 3 ? 'done' : 'pending'} isLast />
        </div>
        {journeyState.isLost && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5">
            <X className="size-4 shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-medium text-red-700">This lead was marked Lost.</p>
          </div>
        )}
      </Section>

      {/* Contact Information + Lead Information side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Contact Information"
          icon={UserRound}
          actions={
            isReadOnlyLead ? null : (
              <Button type="button" variant="outline" size="sm" onClick={() => { setFormError(''); setIsEditOpen(true) }}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business / Prospect Name" value={lead.name || lead.customerName} />
            <Field label="Contact Person" value={lead.contactPerson} />
            <div className="flex items-end justify-between gap-2">
              <Field label="Phone" value={lead.mobileNumber} />
              {lead.mobileNumber && (
                <a
                  href={`tel:${lead.mobileNumber}`}
                  aria-label="Call"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  <Phone className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="flex items-end justify-between gap-2">
              <Field label="Email" value={lead.email} />
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  aria-label="Email"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  <Mail className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Lead Information"
          icon={Tag}
          actions={
            isReadOnlyLead ? null : (
              <Button type="button" variant="outline" size="sm" onClick={() => { setFormError(''); setIsEditOpen(true) }}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Source" value={lead.leadSource} />
            <Field label="Assigned Salesperson" value={lead.assignedSalespersonName} />
            <Field label="Lead Type" value={lead.leadType} />
            <Field label="Segment" value={lead.segment} />
            <div>
              <p className="text-xs font-medium text-neutral-500">Status</p>
              <div className="mt-1">
                <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLeadStatus(lead.leadStatus)}</Badge>
              </div>
            </div>
            <Field label="Created Date" value={formatDateTime(lead.createdAt)} />
          </div>
        </Section>
      </div>

      {/* Product interest - full-width strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-primary-50/40 p-5 shadow-(--shadow-card) sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary-600 ring-1 ring-primary-100">
            <Package className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-500">Product Interest</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900">
              {interestedProducts.length === 0
                ? 'No products captured for this lead'
                : `${interestedProducts.length} product${interestedProducts.length === 1 ? '' : 's'} captured for this lead`}
            </p>
            {interestedProducts.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-neutral-500">{productInterestSummary}</p>
            )}
          </div>
        </div>
        {!isReadOnlyLead && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setFormError(''); setIsEditOpen(true) }}>
            {interestedProducts.length === 0 ? 'Add Products' : 'View Products'}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Activity area (tabs) + right rail */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Section
          title="Lead Activity"
          icon={Clock}
          bodyClassName="mt-4"
          actions={
            isReadOnlyLead ? null : (
              <AddActivityMenu
                items={[
                  { label: 'Add Note', icon: StickyNote, onClick: openNoteModal },
                  { label: 'Add Follow-up', icon: ClipboardList, onClick: openAddFollowUp },
                  { label: 'Schedule Visit', icon: MapPin, onClick: openVisitModal },
                ]}
              />
            )
          }
        >
          <Tabs value={activitiesTab} onValueChange={setActivitiesTab}>
            <div className="overflow-x-auto pb-1">
              <TabsList className="mb-4">
                <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
                <TabsTrigger value="followups">Follow-ups ({allLeadFollowUps.length})</TabsTrigger>
                <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({noteEntries.length})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity">
              {timelineEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">No activity recorded yet.</p>
              ) : (
                <div>
                  {timelineEvents.map((event, index) => (
                    <TimelineItem key={event.id} {...event} isLast={index === timelineEvents.length - 1} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes">
              <div className="mb-3 flex justify-end">
                {!isReadOnlyLead && (
                  <Button type="button" variant="outline" size="sm" onClick={openNoteModal}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add Note
                  </Button>
                )}
              </div>
              {noteEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 p-6 text-center text-sm text-neutral-400">
                  No notes added yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {noteEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
                      {entry.timestamp && (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                          {entry.timestamp}
                        </p>
                      )}
                      <p className={`whitespace-pre-line text-sm text-neutral-700 ${entry.timestamp ? 'mt-1.5' : ''}`}>
                        {entry.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

          <TabsContent value="followups">
            {followUpsError ? (
              <p className="py-6 text-center text-sm text-red-600">{followUpsError}</p>
            ) : isLoadingFollowUps && directFollowUps.length === 0 ? (
              <LoadingSpinner label="Loading follow-ups..." />
            ) : allLeadFollowUps.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No follow-ups for this lead yet.</p>
            ) : (
              <div className="space-y-3">
                {allLeadFollowUps.map((task) => {
                  const due = describeDueDate(task.dueDate)
                  const fuStatus = deriveFollowUpStatus(task)
                  return (
                    <div key={task.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">{task.title}</p>
                          <p className={`mt-0.5 text-xs ${due.tone === 'danger' && task.status !== 'completed' ? 'font-medium text-red-600' : 'text-neutral-500'}`}>
                            {task.status === 'completed' ? `Completed ${formatDateTime(task.completedAt)}` : due.label}
                          </p>
                        </div>
                        <Badge variant={fuStatus.variant} dot>{fuStatus.label}</Badge>
                      </div>

                      <p className="mt-2 text-[0.7rem] font-medium text-neutral-500">
                        {task.origin
                          ? `From visit · ${formatLabel(task.origin.visitType)} · ${formatDate(task.origin.visitDate)}`
                          : 'Direct follow-up on this lead'}
                      </p>

                      {task.description && (
                        <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm text-neutral-700">{task.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                        <span>Priority: {formatLabel(task.priority)}{task.assignedToName ? ` · ${task.assignedToName}` : ''}</span>
                        {task.isDirect ? (
                          task.status === 'completed' ? (
                            <span className="flex flex-wrap gap-x-3 gap-y-1">
                              {task.outcome && <span className="font-medium text-neutral-700">Outcome: {formatLabel(task.outcome)}</span>}
                              {task.outcomeNotes && <span className="font-medium text-neutral-700">Notes: {task.outcomeNotes}</span>}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <button type="button" onClick={() => openCompleteFollowUp(task)} className="rounded-md px-2 py-1 font-medium text-primary-700 hover:bg-primary-50">Complete</button>
                              <button type="button" onClick={() => openEditFollowUp(task)} className="rounded-md px-2 py-1 font-medium text-neutral-600 hover:bg-neutral-100">Edit</button>
                              <button type="button" onClick={() => deleteDirectFollowUp(task.id)} className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50">Delete</button>
                            </span>
                          )
                        ) : (
                          <span className="text-neutral-500">Manage from the visit or Follow-ups page</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="visits">
            {visitsError ? (
              <div className="py-6 text-center">
                <p className="text-sm text-red-600">{visitsError}</p>
              </div>
            ) : isLoadingVisits ? (
              <LoadingSpinner label="Loading visits..." />
            ) : visits.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No visits recorded for this lead yet.</p>
            ) : (
              <div className="space-y-3">
                {visits.map((visit) => {
                  const vStatus = deriveVisitStatus(visit)
                  return (
                  <div key={visit.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                          <Calendar className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                          {formatDateTime(visit.visitDate)}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {formatLabel(visit.visitType)}
                          {visit.purpose ? ` · ${visit.purpose}` : ''}
                        </p>
                      </div>
                      <Badge variant={vStatus.variant} dot>{vStatus.label}</Badge>
                    </div>

                    {visit.notes && (
                      <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm text-neutral-700">{visit.notes}</p>
                    )}
                    {visit.outcome && (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="font-medium text-neutral-800">Outcome:</span> {formatLabel(visit.outcome)}
                      </p>
                    )}
                    {visit.status === 'cancelled' && visit.cancellationReason && (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="font-medium text-neutral-800">Cancellation reason:</span> {visit.cancellationReason}
                      </p>
                    )}

                    {visit.followUps.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                        {visit.followUps.map((task) => (
                          <div key={task.id} className="flex items-start gap-2.5 rounded-lg bg-white p-2.5 shadow-(--shadow-xs)">
                            <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                                <Badge variant={task.status === 'completed' ? 'success' : 'warning'}>
                                  {formatLabel(task.status)}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-xs text-neutral-500">
                                Due {formatDateTime(task.dueDate)}
                                {task.assignedToName ? ` · ${task.assignedToName}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
          </Tabs>
        </Section>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <Section
            className="flex-1"
            title="Upcoming Follow-ups"
            icon={ClipboardList}
            actions={
              <button
                type="button"
                onClick={() => setActivitiesTab('followups')}
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                View All
              </button>
            }
          >
            {(() => {
              const upcoming = allLeadFollowUps.filter((task) => task.status !== 'completed').slice(0, 3)
              if (upcoming.length === 0) {
                return <p className="text-sm text-neutral-400">No upcoming follow-ups.</p>
              }
              return (
                <div className="space-y-3">
                  {upcoming.map((task) => {
                    const due = describeDueDate(task.dueDate)
                    const fuStatus = deriveFollowUpStatus(task)
                    return (
                      <div key={task.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                          <ClipboardList className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
                            <Badge variant={fuStatus.variant} dot>{fuStatus.label}</Badge>
                          </div>
                          <p className={`mt-0.5 text-xs ${due.tone === 'danger' ? 'font-medium text-red-600' : 'text-neutral-500'}`}>
                            {formatDateTime(task.dueDate)}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            Priority: {formatLabel(task.priority)}
                            {task.assignedToName ? ` · ${task.assignedToName}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Section>

          <Section
            className="flex-1"
            title="Recent Notes"
            icon={StickyNote}
            actions={
              noteEntries.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActivitiesTab('notes')}
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  View All
                </button>
              ) : null
            }
          >
            {noteEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 p-5 text-center">
                <StickyNote className="size-5 text-neutral-400" aria-hidden="true" />
                <p className="text-sm text-neutral-400">No notes added yet.</p>
                {!isReadOnlyLead && (
                  <Button type="button" variant="outline" size="sm" onClick={openNoteModal}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add Note
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {noteEntries.slice(0, 2).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                    {entry.timestamp && (
                      <p className="text-[0.7rem] font-medium text-neutral-500">{entry.timestamp}</p>
                    )}
                    <p className={`line-clamp-3 whitespace-pre-line text-sm text-neutral-700 ${entry.timestamp ? 'mt-1' : ''}`}>
                      {entry.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      </div>

      <LeadEditForm
        isOpen={isEditOpen}
        lead={lead}
        salespersonOptions={salespersonOptions}
        saving={isSaving}
        formError={formError}
        lockAssignee={isSalesOfficer}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSaveLead}
      />

      <ConvertLeadModal
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        lead={lead}
        salespersonOptions={salespersonOptions}
        onConverted={handleLeadConverted}
      />

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => { if (!isDeleting) { setDeleteError(''); setIsDeleteOpen(false) } }}
        title="Delete Lead"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {lead.name || lead.leadId} from the lead list? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteLead}>Delete</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isNoteOpen} onClose={() => { if (!isSavingNote) setIsNoteOpen(false) }} title="Add Note">
        <div className="space-y-4">
          <Input
            as="textarea"
            label="Note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add a follow-up note or requirement..."
            inputClassName="min-h-24"
            error={noteError}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSavingNote} onClick={() => setIsNoteOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSavingNote} onClick={handleSaveNote}>Save Note</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isFollowUpOpen} onClose={() => setIsFollowUpOpen(false)} title={editingFollowUpId ? 'Edit Follow-up' : 'Add Follow-up'} className="max-w-lg">
        <div className="space-y-4">
          {followUpFormError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{followUpFormError}</div>
          )}
          <Input
            label="Follow-up Title"
            value={followUpFormData.title}
            onChange={(event) => setFollowUpFormData((current) => ({ ...current, title: event.target.value }))}
            placeholder="e.g. Call to confirm quantity"
            required
          />
          <Input
            as="textarea"
            label="Description"
            value={followUpFormData.description}
            onChange={(event) => setFollowUpFormData((current) => ({ ...current, description: event.target.value }))}
            inputClassName="min-h-20"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Due Date"
              type="date"
              value={followUpFormData.dueDate}
              onChange={(event) => setFollowUpFormData((current) => ({ ...current, dueDate: event.target.value }))}
              required
            />
            <Input
              label="Due Time"
              type="time"
              value={followUpFormData.dueTime}
              onChange={(event) => setFollowUpFormData((current) => ({ ...current, dueTime: event.target.value }))}
              required
            />
          </div>
          <Select
            label="Assignee"
            options={assigneeOptions}
            value={followUpFormData.assigneeId}
            onChange={(event) => setFollowUpFormData((current) => ({ ...current, assigneeId: event.target.value }))}
            placeholder="Defaults to you if left blank"
          />
          <Select
            label="Priority"
            options={taskPriorityOptions}
            value={followUpFormData.priority}
            onChange={(event) => setFollowUpFormData((current) => ({ ...current, priority: event.target.value }))}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={savingFollowUp} onClick={() => setIsFollowUpOpen(false)}>Cancel</Button>
            <Button type="button" loading={savingFollowUp} onClick={handleSaveFollowUp}>{editingFollowUpId ? 'Save Follow-up' : 'Add Follow-up'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(completingFollowUp)} onClose={() => { if (!savingFollowUp) setCompletingFollowUp(null) }} title="Complete Follow-up">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">{completingFollowUp?.title}</p>
          <Select
            label="Outcome"
            options={[{ value: '', label: 'No outcome' }, ...FOLLOWUP_OUTCOME_OPTIONS]}
            value={completeOutcome}
            onChange={(event) => setCompleteOutcome(event.target.value)}
          />
          <Input
            as="textarea"
            label="Notes"
            value={completeNotes}
            onChange={(event) => setCompleteNotes(event.target.value)}
            inputClassName="min-h-20"
            placeholder="What happened on this follow-up?"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={savingFollowUp} onClick={() => setCompletingFollowUp(null)}>Cancel</Button>
            <Button type="button" loading={savingFollowUp} onClick={handleCompleteFollowUp}>Complete Follow-up</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusOpen} onClose={() => { if (!isSavingStatus) setIsStatusOpen(false) }} title="Update Lead Status">
        <div className="space-y-4">
          <Select
            label="Lead Status"
            options={manualStatusOptionsFor(lead.leadStatus)}
            value={statusValue}
            onChange={(event) => setStatusValue(event.target.value)}
            error={statusError}
          />
          {isLost && (
            <p className="text-xs text-neutral-500">Reopening a lost lead moves it back to Contacted or Qualified.</p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSavingStatus} onClick={() => setIsStatusOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSavingStatus} onClick={handleSaveStatus}>Save Status</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isVisitOpen} onClose={() => { if (!isSavingVisit) setIsVisitOpen(false) }} title="Schedule Visit" className="max-w-lg">
        <div className="space-y-4">
          {visitFormError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{visitFormError}</div>
          )}
          <Select
            label="Visit Type"
            options={VISIT_TYPE_OPTIONS}
            value={visitFormData.visitType}
            onChange={(event) => setVisitFormData((current) => ({ ...current, visitType: event.target.value }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Visit Date"
              type="date"
              value={visitFormData.visitDate}
              onChange={(event) => setVisitFormData((current) => ({ ...current, visitDate: event.target.value }))}
              required
            />
            <Input
              label="Visit Time"
              type="time"
              value={visitFormData.visitTime}
              onChange={(event) => setVisitFormData((current) => ({ ...current, visitTime: event.target.value }))}
              required
            />
          </div>
          <Input
            label="Purpose"
            value={visitFormData.purpose}
            onChange={(event) => setVisitFormData((current) => ({ ...current, purpose: event.target.value }))}
            placeholder="e.g. Requirement check"
          />
          <Input
            as="textarea"
            label="Notes"
            value={visitFormData.notes}
            onChange={(event) => setVisitFormData((current) => ({ ...current, notes: event.target.value }))}
            inputClassName="min-h-20"
          />
          <label className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3.5 py-3 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={visitFormData.createFollowUpTask}
              onChange={(event) => setVisitFormData((current) => ({ ...current, createFollowUpTask: event.target.checked }))}
              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Create Follow-up Task
          </label>

          {visitFormData.createFollowUpTask && (
            <div className="space-y-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
              <Input
                label="Task Title"
                value={visitFormData.title}
                onChange={(event) => setVisitFormData((current) => ({ ...current, title: event.target.value }))}
                required
              />
              <Input
                label="Action / Notes"
                as="textarea"
                value={visitFormData.description}
                onChange={(event) => setVisitFormData((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Due Date"
                  type="date"
                  value={visitFormData.dueDate}
                  onChange={(event) => setVisitFormData((current) => ({ ...current, dueDate: event.target.value }))}
                  required
                />
                <Input
                  label="Due Time"
                  type="time"
                  value={visitFormData.dueTime}
                  onChange={(event) => setVisitFormData((current) => ({ ...current, dueTime: event.target.value }))}
                  required
                />
              </div>
              <Select
                label="Assignee"
                options={assigneeOptions}
                value={visitFormData.assigneeId}
                onChange={(event) => setVisitFormData((current) => ({ ...current, assigneeId: event.target.value }))}
                placeholder="Defaults to you if left blank"
              />
              <Select
                label="Priority"
                options={taskPriorityOptions}
                value={visitFormData.priority}
                onChange={(event) => setVisitFormData((current) => ({ ...current, priority: event.target.value }))}
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={isSavingVisit} onClick={() => setIsVisitOpen(false)}>Cancel</Button>
          <Button type="button" loading={isSavingVisit} onClick={handleSaveVisit}>Schedule Visit</Button>
        </div>
      </Modal>
    </div>
  )
}
