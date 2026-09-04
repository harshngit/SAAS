import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightCircle,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listAssignableStaff } from '../../api/users'
import { listCustomers } from '../../api/customers'
import { listLeads } from '../../api/leads'
import { createVisit, createVisitFollowUp, listVisits, updateVisit } from '../../api/visits'
import { useAuthStore } from '../../store/authStore'
import { VISIT_OUTCOME_OPTIONS, isFollowUpRequiredOutcome, isReadyToConvertOutcome } from '../leads/leadActivity'
import ConvertLeadModal from '../leads/ConvertLeadModal'
import { DEMO_RECORDS_ENABLED, demoLeads, demoVisits, isDemoRecord } from '../leads/demoData'
import { deriveFollowUpStatus, deriveVisitStatus, isVisitInProgress, isVisitOpen, isVisitScheduled } from './visitStatus'

function labelize(value = '') {
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// The single most relevant next action for a completed visit, based on its outcome.
function visitNextAction(visit, lead, readyToConvertHint) {
  if (visit.status !== 'completed' || !visit.leadId) return null
  if (lead && (lead.convertedCustomerId || lead.leadStatus === 'won')) {
    return lead.convertedCustomerId ? { kind: 'viewCustomer', customerId: lead.convertedCustomerId } : null
  }
  if (lead && lead.leadStatus === 'lost') return null
  if (isReadyToConvertOutcome(visit.outcome) || readyToConvertHint) return { kind: 'convert', leadId: visit.leadId }
  if (isFollowUpRequiredOutcome(visit.outcome)) return { kind: 'addFollowUp' }
  return null
}

function nextActionLabel(kind) {
  if (kind === 'convert') return 'Convert to Customer'
  if (kind === 'viewCustomer') return 'View Customer'
  return 'Add Follow-up'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyTaskFields() {
  return { title: '', description: '', dueDate: todayIso(), dueTime: '10:00', assigneeId: '', priority: 'medium' }
}
function emptyCheckInData() {
  return { visitFor: 'customer', customerId: '', leadId: '', notes: '' }
}
function emptyCheckOutData() {
  return { outcome: '', notes: '', createFollowUpTask: false, ...emptyTaskFields() }
}

const taskPriorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function formatVisitDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// --- Purely presentational date helpers for the KPI row / agenda / insights panels.
// They only bucket the already-loaded visit list; no API, no new data. ---
function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    !Number.isNaN(da.getTime()) &&
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

function isThisWeek(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // back to Monday
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d < end
}

const HISTORY_TABS = [
  { value: 'all', label: 'All Visits' },
  { value: 'today', label: 'Today' },
  { value: 'leads', label: 'Leads' },
  { value: 'customers', label: 'Customers' },
]
const PAGE_SIZE = 8

const KPI_TONES = {
  primary: 'bg-primary-50 text-primary-600',
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
}

function VisitKpiCard({ icon: Icon, tone = 'primary', label, value, hint }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card) transition-all duration-200 hover:shadow-(--shadow-card-hover)">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-neutral-500">{label}</p>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${KPI_TONES[tone]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  )
}

// The six follow-up task inputs - shared by the check-out form and "Add Follow-up".
function FollowUpFields({ data, setData, assigneeOptions, isLoadingOptions }) {
  const set = (patch) => setData((current) => ({ ...current, ...patch }))
  return (
    <div className="space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
      <Input label="Task Title" value={data.title} onChange={(e) => set({ title: e.target.value })} required />
      <Input label="Description" as="textarea" value={data.description} onChange={(e) => set({ description: e.target.value })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Due Date" type="date" value={data.dueDate} onChange={(e) => set({ dueDate: e.target.value })} required />
        <Input label="Due Time" type="time" value={data.dueTime} onChange={(e) => set({ dueTime: e.target.value })} required />
      </div>
      <Select
        label="Assignee"
        options={assigneeOptions}
        value={data.assigneeId}
        onChange={(e) => set({ assigneeId: e.target.value })}
        placeholder={isLoadingOptions ? 'Loading employees...' : 'Defaults to you if left blank'}
        disabled={isLoadingOptions}
      />
      <Select label="Priority" options={taskPriorityOptions} value={data.priority} onChange={(e) => set({ priority: e.target.value })} required />
    </div>
  )
}

// Check-out / completion form: Outcome + Notes + optional Follow-up.
function VisitCheckoutForm({ visit, assigneeOptions, isLoadingOptions, submitting, error, onSubmit, onCancel }) {
  const [data, setData] = useState(emptyCheckOutData)

  const submit = (event) => {
    event.preventDefault()
    onSubmit(data)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 text-sm">
        <p className="font-medium text-neutral-800">{visit.customerName || visit.leadName || 'Lead visit'}</p>
        <p className="text-xs text-neutral-500">Checked in {formatVisitDateTime(visit.visitDate)}</p>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Select
        label="Outcome"
        required
        options={[{ value: '', label: 'Select outcome' }, ...VISIT_OUTCOME_OPTIONS]}
        value={data.outcome}
        onChange={(e) => setData((current) => ({ ...current, outcome: e.target.value }))}
      />
      <Input
        label="Visit Result / Notes"
        as="textarea"
        value={data.notes}
        onChange={(e) => setData((current) => ({ ...current, notes: e.target.value }))}
        placeholder="What happened on this visit?"
      />

      <label className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3.5 py-3 text-sm font-medium text-neutral-800">
        <input
          type="checkbox"
          checked={data.createFollowUpTask}
          onChange={(e) =>
            setData((current) => ({
              ...current,
              createFollowUpTask: e.target.checked,
              ...(e.target.checked ? {} : emptyTaskFields()),
            }))
          }
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        Create Follow-up Task
      </label>

      {data.createFollowUpTask && (
        <FollowUpFields data={data} setData={setData} assigneeOptions={assigneeOptions} isLoadingOptions={isLoadingOptions} />
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>Back</Button>
        <Button type="submit" loading={submitting}>
          <CheckCircle className="mr-2 size-4" />
          Complete Visit
        </Button>
      </div>
    </form>
  )
}

// Read-only visit info body - used inside the Visit Detail modal.
function VisitInfoBody({ visit, visitStatus, followUpRequired, canAddFollowUp, onAddFollowUp, nextAction, taskError, onRunNextAction, onRetryTask }) {
  const facts = [
    ['Customer / Lead', visit.customerName || visit.leadName || (visit.leadId ? 'Lead visit' : '—')],
    ['Party', visit.leadId ? 'Lead' : 'Customer'],
    ['Visit Type', labelize(visit.visitType)],
    ['Visit Date / Time', formatVisitDateTime(visit.visitDate)],
    ...(visit.checkedInAt ? [['Checked In', formatVisitDateTime(visit.checkedInAt)]] : []),
    ...(visit.checkedOutAt ? [['Checked Out', formatVisitDateTime(visit.checkedOutAt)]] : []),
    ...(visit.status === 'cancelled' && visit.cancelledAt ? [['Cancelled', formatVisitDateTime(visit.cancelledAt)]] : []),
    ['Recorded', formatVisitDateTime(visit.createdAt)],
    ['Outcome', visit.outcome ? labelize(visit.outcome) : '—'],
  ]

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Visit Status</span>
        <Badge variant={visitStatus.variant} dot>{visitStatus.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-[0.7rem] text-neutral-400">{label}</p>
            <p className="font-medium text-neutral-900">{value}</p>
          </div>
        ))}
      </div>

      {visit.purpose && (
        <div>
          <p className="text-[0.7rem] text-neutral-400">Purpose</p>
          <p className="text-neutral-700">{visit.purpose}</p>
        </div>
      )}
      {visit.notes && (
        <div>
          <p className="text-[0.7rem] text-neutral-400">Notes</p>
          <p className="whitespace-pre-line text-neutral-700">{visit.notes}</p>
        </div>
      )}
      {visit.status === 'cancelled' && visit.cancellationReason && (
        <div>
          <p className="text-[0.7rem] text-neutral-400">Cancellation Reason</p>
          <p className="whitespace-pre-line text-neutral-700">{visit.cancellationReason}</p>
        </div>
      )}

      {!visit.checkedInAt && visit.status === 'completed' && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[0.7rem] text-neutral-400">
          This visit was logged as already completed, so it has no separate check-in time.
        </p>
      )}

      {/* Follow-up section */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-500">Follow-up</p>
        {visit.followUps.length === 0 ? (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
            <p className="text-xs text-neutral-500">
              {followUpRequired ? 'This visit needs a follow-up.' : 'No follow-up task for this visit.'}
            </p>
            {canAddFollowUp && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onAddFollowUp}>
                <Plus className="mr-1.5 size-3.5" />
                Add Follow-up
              </Button>
            )}
          </div>
        ) : (
          visit.followUps.map((task) => {
            const taskStatus = deriveFollowUpStatus(task)
            return (
              <div key={task.id} className="mt-2 rounded-xl border border-neutral-100 bg-white p-3.5 first:mt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-neutral-900">{task.title}</p>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={taskStatus.variant}>{taskStatus.label}</Badge>
                    <span className="text-[0.68rem] text-neutral-400">follow-up</span>
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-neutral-600 sm:grid-cols-3">
                  <p><span className="font-medium text-neutral-800">Assignee:</span> {task.assignedToName || 'Not assigned'}</p>
                  <p><span className="font-medium text-neutral-800">Due:</span> {formatVisitDateTime(task.dueDate)}</p>
                  <p><span className="font-medium text-neutral-800">Priority:</span> {task.priority.toUpperCase()}</p>
                </div>
                {task.description && <p className="mt-2 whitespace-pre-line text-xs text-neutral-600">{task.description}</p>}
              </div>
            )
          })
        )}
      </div>

      {nextAction && (
        <Button
          type="button"
          variant={nextAction.kind === 'convert' ? undefined : 'outline'}
          size="sm"
          onClick={() => onRunNextAction(nextAction)}
        >
          {nextAction.kind === 'convert' && <ArrowRightCircle className="mr-2 size-4" />}
          {nextActionLabel(nextAction.kind)}
        </Button>
      )}

      {taskError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5">
          <p className="text-sm text-red-700">{taskError.error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetryTask}>
            <RefreshCw className="mr-2 size-4" />
            Retry Task
          </Button>
        </div>
      )}
    </div>
  )
}

export default function VisitCheckIn() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const navigate = useNavigate()
  const checkInRef = useRef(null)

  const [visits, setVisits] = useState([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Visit Timeline view state - purely client-side filtering / paging of the loaded list.
  const [historyTab, setHistoryTab] = useState('all')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [checkInData, setCheckInData] = useState(emptyCheckInData)
  const [customers, setCustomers] = useState([])
  const [leads, setLeads] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [isSavingVisit, setIsSavingVisit] = useState(false)
  const [taskErrors, setTaskErrors] = useState({})
  const [readyToConvert, setReadyToConvert] = useState({})
  const [convertLeadId, setConvertLeadId] = useState(null)
  const [demoLeadOverrides, setDemoLeadOverrides] = useState({})

  // Visit Detail modal
  const [detailVisitId, setDetailVisitId] = useState(null)
  const [detailMode, setDetailMode] = useState('view') // 'view' | 'checkout' | 'addFollowUp'
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [addTaskData, setAddTaskData] = useState(emptyTaskFields)
  const [cancelReasonInput, setCancelReasonInput] = useState('')

  const loadVisits = async () => {
    setIsLoadingVisits(true)
    setLoadError('')
    const result = currentUser?.id ? await listVisits({ userId: currentUser.id }) : await listVisits()
    if (!result.success) {
      setLoadError(result.error)
      setIsLoadingVisits(false)
      return
    }
    const rows = DEMO_RECORDS_ENABLED ? [...result.visits, ...demoVisits] : result.visits
    setVisits(rows.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)))
    setIsLoadingVisits(false)
  }

  useEffect(() => {
    loadVisits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  useEffect(() => {
    let isMounted = true
    async function loadOptions() {
      const [staffResult, customersResult, leadsResult] = await Promise.all([listAssignableStaff(), listCustomers(), listLeads()])
      if (!isMounted) return
      setIsLoadingOptions(false)
      if (staffResult.success && staffResult.users.length > 0) {
        setStaffMembers(staffResult.users)
      } else if (currentUser?.id) {
        setStaffMembers([{ id: currentUser.id, name: currentUser.name || 'Me', email: currentUser.email }])
      }
      if (customersResult.success) setCustomers(customersResult.customers)
      if (leadsResult.success) setLeads(leadsResult.leads)
    }
    loadOptions()
    return () => { isMounted = false }
  }, [currentUser?.id, currentUser?.name, currentUser?.email])

  const assigneeOptions = useMemo(
    () => staffMembers.map((user) => ({ value: user.id, label: user.name || user.display_name || user.full_name || user.email || 'User' })),
    [staffMembers],
  )
  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )
  const leadOptions = useMemo(
    () => leads.map((lead) => ({ value: lead.id, label: `${lead.name || lead.customerName || 'New prospect'}${lead.mobileNumber ? ` • ${lead.mobileNumber}` : ''}` })),
    [leads],
  )
  const leadIndex = useMemo(() => {
    const map = new Map()
    leads.forEach((lead) => map.set(lead.id, lead))
    if (DEMO_RECORDS_ENABLED) {
      demoLeads.forEach((lead) => map.set(lead.id, { ...lead, ...(demoLeadOverrides[lead.id] || {}) }))
    }
    return map
  }, [leads, demoLeadOverrides])

  const visitContactName = (visit) => {
    const lead = visit.leadId ? leadIndex.get(visit.leadId) : null
    return lead?.name || visit.customerName || visit.leadName || (visit.leadId ? 'Lead visit' : 'Unknown customer')
  }

  // --- KPI row / agenda / insights: all derived from the loaded `visits` list only ---
  const kpis = useMemo(() => {
    const now = new Date()
    let today = 0
    let inProgress = 0
    let completed = 0
    let pendingFollowUps = 0
    let overdueFollowUps = 0
    visits.forEach((visit) => {
      if (isSameDay(visit.visitDate, now)) today += 1
      const status = String(visit.status || '').toLowerCase()
      if (status === 'in_progress') inProgress += 1
      if (status === 'completed') completed += 1
      ;(visit.followUps || []).forEach((task) => {
        if (task.status !== 'completed') {
          pendingFollowUps += 1
          if (deriveFollowUpStatus(task)?.key === 'overdue') overdueFollowUps += 1
        }
      })
    })
    return { today, inProgress, completed, pendingFollowUps, overdueFollowUps }
  }, [visits])

  const weekInsights = useMemo(() => {
    let total = 0
    let completed = 0
    let inProgress = 0
    let cancelled = 0
    visits.forEach((visit) => {
      if (!isThisWeek(visit.visitDate)) return
      total += 1
      const status = String(visit.status || '').toLowerCase()
      if (status === 'completed') completed += 1
      else if (status === 'in_progress') inProgress += 1
      else if (status === 'cancelled') cancelled += 1
    })
    return { total, completed, inProgress, cancelled }
  }, [visits])

  const filteredVisits = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    const now = new Date()
    return visits.filter((visit) => {
      if (historyTab === 'today' && !isSameDay(visit.visitDate, now)) return false
      if (historyTab === 'leads' && !visit.leadId) return false
      if (historyTab === 'customers' && visit.leadId) return false
      if (query) {
        const haystack = `${visitContactName(visit)} ${labelize(visit.visitType)} ${visit.outcome || ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, historyTab, historySearch, leadIndex])

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / PAGE_SIZE))
  const currentPage = Math.min(historyPage, totalPages)
  const pagedVisits = filteredVisits.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setHistoryPage(1)
  }, [historyTab, historySearch])

  const isLeadVisit = checkInData.visitFor === 'lead'
  const detailVisit = visits.find((visit) => visit.id === detailVisitId) || null

  const openDetail = (visitId, mode = 'view') => {
    setDetailVisitId(visitId)
    setDetailMode(mode)
    setActionError('')
    setAddTaskData(emptyTaskFields())
    setCancelReasonInput('')
  }
  const closeDetail = () => {
    setDetailVisitId(null)
    setDetailMode('view')
    setActionError('')
    setCancelReasonInput('')
  }

  const runVisitNextAction = (action) => {
    if (action.kind === 'convert') {
      setConvertLeadId(action.leadId)
      return
    }
    if (action.kind === 'addFollowUp') {
      setDetailMode('addFollowUp')
      return
    }
    if (isDemoRecord(action.customerId)) {
      setFormMessage('Demo record — on a real lead this would open the customer record.')
      closeDetail()
      return
    }
    if (action.kind === 'viewCustomer') navigate(`/sales/customers/${action.customerId}`)
  }

  const applyLeadConverted = ({ leadId, customerId }) => {
    if (isDemoRecord(leadId)) {
      setDemoLeadOverrides((current) => ({ ...current, [leadId]: { leadStatus: 'won', convertedCustomerId: customerId } }))
    } else {
      setLeads((current) =>
        current.map((lead) =>
          lead.id === leadId ? { ...lead, leadStatus: 'won', convertedCustomerId: customerId || lead.convertedCustomerId } : lead,
        ),
      )
    }
    setConvertLeadId(null)
    setFormMessage('Lead converted — a customer record was created.')
  }

  const handleCheckIn = async (event) => {
    event.preventDefault()
    setFormError('')
    setFormMessage('')

    if (isLeadVisit ? !checkInData.leadId : !checkInData.customerId) {
      setFormError(isLeadVisit ? 'Select a lead for this visit.' : 'Select a customer for this visit.')
      return
    }

    setIsSavingVisit(true)
    const result = await createVisit({
      customerId: isLeadVisit ? undefined : checkInData.customerId,
      leadId: isLeadVisit ? checkInData.leadId : undefined,
      visitType: 'site_visit',
      status: 'planned',
      notes: checkInData.notes.trim(),
    })

    if (!result.success) {
      setIsSavingVisit(false)
      setFormError(result.error)
      return
    }

    // Transition planned -> in_progress so the backend stamps checked_in_at. If this
    // second call fails (older backend), keep the planned visit - it is still completable.
    let visit = result.visit
    const startResult = await updateVisit(visit.id, { status: 'in_progress' })
    if (startResult.success) visit = { ...visit, ...startResult.visit, followUps: visit.followUps }
    setIsSavingVisit(false)

    setVisits((current) => [visit, ...current])
    setCheckInData(emptyCheckInData())
    setFormMessage(
      visit.status === 'in_progress'
        ? 'Checked in. Complete the visit from Visit Details when you are done.'
        : 'Visit scheduled. Open it and choose Start Visit when you begin.',
    )
    openDetail(visit.id, 'view') // land on the new visit's detail
  }

  // Complete an In Progress visit: record outcome (+ optional follow-up task).
  const completeVisit = async (visit, checkOutData) => {
    if (!checkOutData.outcome) {
      setActionError('Select the visit outcome.')
      return
    }
    if (checkOutData.createFollowUpTask && !checkOutData.title.trim()) {
      setActionError('Enter a follow-up task title.')
      return
    }

    setIsActing(true)
    setActionError('')

    const combinedNotes = [visit.notes, checkOutData.notes.trim()].filter(Boolean).join('\n\n')
    const isDemo = isDemoRecord(visit.id)

    let updatedVisit
    if (isDemo) {
      updatedVisit = { ...visit, status: 'completed', outcome: checkOutData.outcome, notes: combinedNotes }
    } else {
      const result = await updateVisit(visit.id, { status: 'completed', outcome: checkOutData.outcome, notes: combinedNotes })
      if (!result.success) {
        setIsActing(false)
        setActionError(result.error)
        return
      }
      updatedVisit = { ...visit, ...result.visit, followUps: visit.followUps }
    }

    setVisits((current) => current.map((entry) => (entry.id === visit.id ? updatedVisit : entry)))

    if (visit.leadId && isReadyToConvertOutcome(checkOutData.outcome)) {
      setReadyToConvert((current) => ({ ...current, [visit.id]: visit.leadId }))
    }

    if (checkOutData.createFollowUpTask) {
      const dueDate = `${checkOutData.dueDate}T${checkOutData.dueTime}:00`
      if (isDemo) {
        setVisits((current) =>
          current.map((entry) =>
            entry.id === visit.id
              ? {
                  ...entry,
                  followUps: [
                    ...entry.followUps,
                    {
                      id: `demo-vft-${Date.now().toString(36)}`,
                      title: checkOutData.title,
                      description: checkOutData.description,
                      dueDate,
                      priority: checkOutData.priority,
                      status: 'pending',
                      assignedToName: 'You',
                    },
                  ],
                }
              : entry,
          ),
        )
      } else {
        const taskResult = await createVisitFollowUp(visit.id, {
          customerId: visit.customerId || undefined,
          title: checkOutData.title,
          description: checkOutData.description,
          dueDate,
          priority: checkOutData.priority,
          assigneeId: checkOutData.assigneeId,
        })
        if (!taskResult.success) {
          setTaskErrors((current) => ({
            ...current,
            [visit.id]: { draft: { customerId: visit.customerId, ...checkOutData, dueDate }, error: taskResult.error },
          }))
        } else {
          setVisits((current) =>
            current.map((entry) => (entry.id === visit.id ? { ...entry, followUps: [...entry.followUps, taskResult.followUp] } : entry)),
          )
        }
      }
    }

    setIsActing(false)
    setDetailMode('view')
    setFormMessage('Visit completed.')
    if (!isDemo) loadVisits()
  }

  // Start a Scheduled visit: planned -> in_progress (backend stamps checked_in_at).
  const startVisit = async (visit) => {
    setIsActing(true)
    setActionError('')

    const isDemo = isDemoRecord(visit.id)
    let updatedVisit
    if (isDemo) {
      updatedVisit = { ...visit, status: 'in_progress', checkedInAt: new Date().toISOString() }
    } else {
      const result = await updateVisit(visit.id, { status: 'in_progress' })
      if (!result.success) {
        setIsActing(false)
        setActionError(result.error)
        return
      }
      updatedVisit = { ...visit, ...result.visit, followUps: visit.followUps }
    }

    setVisits((current) => current.map((entry) => (entry.id === visit.id ? updatedVisit : entry)))
    setIsActing(false)
    setFormMessage('Visit started.')
    if (!isDemo) loadVisits()
  }

  // Cancel an open (planned / in-progress) visit with a reason.
  const cancelVisit = async (visit, reason) => {
    if (!reason.trim()) {
      setActionError('Enter a reason for cancelling this visit.')
      return
    }
    setIsActing(true)
    setActionError('')

    const isDemo = isDemoRecord(visit.id)
    let updatedVisit
    if (isDemo) {
      updatedVisit = { ...visit, status: 'cancelled', cancellationReason: reason.trim(), cancelledAt: new Date().toISOString() }
    } else {
      const result = await updateVisit(visit.id, { status: 'cancelled', cancellationReason: reason.trim() })
      if (!result.success) {
        setIsActing(false)
        setActionError(result.error)
        return
      }
      updatedVisit = { ...visit, ...result.visit, followUps: visit.followUps }
    }

    setVisits((current) => current.map((entry) => (entry.id === visit.id ? updatedVisit : entry)))
    setIsActing(false)
    setCancelReasonInput('')
    setDetailMode('view')
    setFormMessage('Visit cancelled.')
    if (!isDemo) loadVisits()
  }

  // Add a follow-up task to an already-completed visit.
  const addFollowUp = async (visit, task) => {
    if (!task.title.trim()) {
      setActionError('Enter a follow-up task title.')
      return
    }
    setIsActing(true)
    setActionError('')
    const dueDate = `${task.dueDate}T${task.dueTime}:00`

    if (isDemoRecord(visit.id)) {
      setVisits((current) =>
        current.map((entry) =>
          entry.id === visit.id
            ? { ...entry, followUps: [...entry.followUps, { id: `demo-vft-${Date.now().toString(36)}`, ...task, dueDate, status: 'pending', assignedToName: 'You' }] }
            : entry,
        ),
      )
      setIsActing(false)
      setDetailMode('view')
      return
    }

    const result = await createVisitFollowUp(visit.id, {
      customerId: visit.customerId || undefined,
      title: task.title,
      description: task.description,
      dueDate,
      priority: task.priority,
      assigneeId: task.assigneeId,
    })
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setVisits((current) => current.map((entry) => (entry.id === visit.id ? { ...entry, followUps: [...entry.followUps, result.followUp] } : entry)))
    setDetailMode('view')
  }

  const handleRetryTaskCreation = async (visitId) => {
    const entry = taskErrors[visitId]
    if (!entry) return
    const result = await createVisitFollowUp(visitId, {
      customerId: entry.draft.customerId,
      title: entry.draft.title,
      description: entry.draft.description,
      dueDate: entry.draft.dueDate,
      priority: entry.draft.priority,
      assigneeId: entry.draft.assigneeId,
    })
    if (!result.success) {
      setTaskErrors((current) => ({ ...current, [visitId]: { ...entry, error: result.error } }))
      return
    }
    setVisits((current) => current.map((visit) => (visit.id === visitId ? { ...visit, followUps: [...visit.followUps, result.followUp] } : visit)))
    setTaskErrors((current) => {
      const { [visitId]: removed, ...rest } = current
      void removed
      return rest
    })
  }

  // ---- Visit Detail modal content ----
  const detailStatus = detailVisit ? deriveVisitStatus(detailVisit) : null
  const detailLead = detailVisit?.leadId ? leadIndex.get(detailVisit.leadId) : null
  const detailNextAction = detailVisit ? visitNextAction(detailVisit, detailLead, readyToConvert[detailVisit.id]) : null
  const detailScheduled = detailVisit ? isVisitScheduled(detailVisit) : false
  const detailInProgress = detailVisit ? isVisitInProgress(detailVisit) : false
  const detailCancellable = detailVisit ? isVisitOpen(detailVisit) : false // planned OR in_progress
  const detailFollowUpRequired = isFollowUpRequiredOutcome(detailVisit?.outcome)
  const detailCanAddFollowUp = Boolean(
    detailVisit && detailStatus?.key === 'completed' && detailVisit.followUps.length === 0,
  )

  const modalTitle =
    detailMode === 'checkout'
      ? 'Complete Visit'
      : detailMode === 'addFollowUp'
        ? 'Add Follow-up'
        : detailMode === 'cancel'
          ? 'Cancel Visit'
          : 'Visit Details'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <CalendarDays className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Visits</h1>
          <p className="text-sm text-neutral-500">Check in to a customer / lead visit, then complete it from Visit Details.</p>
        </div>
      </div>

      {/* KPI summary row - derived from the loaded visit list */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <VisitKpiCard
          icon={CalendarDays}
          tone="primary"
          label="Total Visits Today"
          value={kpis.today}
          hint={`${weekInsights.total} this week`}
        />
        <VisitKpiCard icon={Clock} tone="info" label="In Progress" value={kpis.inProgress} hint="Open visits" />
        <VisitKpiCard icon={CheckCircle2} tone="success" label="Completed" value={kpis.completed} hint="All time" />
        <VisitKpiCard
          icon={Bell}
          tone="warning"
          label="Pending Follow-ups"
          value={kpis.pendingFollowUps}
          hint={kpis.overdueFollowUps > 0 ? `${kpis.overdueFollowUps} overdue` : 'Action required'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Left: New Visit / Check In */}
        <div ref={checkInRef} className="lg:col-span-1 xl:col-span-1">
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
              <MapPin className="size-4 text-primary-600" aria-hidden="true" />
              <h3 className="text-base font-semibold text-neutral-900">New Visit / Check In</h3>
            </div>
            <div className="p-5">
              {formError && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
              )}
              {formMessage && (
                <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formMessage}</div>
              )}

              <form onSubmit={handleCheckIn} className="space-y-4">
                {/* Visit For - same field / values, shown as a segmented control */}
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-neutral-700">Visit For</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
                    {[{ value: 'customer', label: 'Customer' }, { value: 'lead', label: 'Lead' }].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCheckInData((current) => ({ ...current, visitFor: opt.value, customerId: '', leadId: '' }))}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          checkInData.visitFor === opt.value
                            ? 'bg-white text-primary-700 shadow-(--shadow-xs)'
                            : 'text-neutral-500 hover:text-neutral-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {isLeadVisit ? (
                  <Select
                    label="Lead"
                    options={leadOptions}
                    value={checkInData.leadId}
                    onChange={(e) => setCheckInData((current) => ({ ...current, leadId: e.target.value }))}
                    placeholder={isLoadingOptions ? 'Loading leads...' : 'Select lead'}
                    disabled={isLoadingOptions}
                    searchable
                    required
                  />
                ) : (
                  <Select
                    label="Customer"
                    options={customerOptions}
                    value={checkInData.customerId}
                    onChange={(e) => setCheckInData((current) => ({ ...current, customerId: e.target.value }))}
                    placeholder={isLoadingOptions ? 'Loading customers...' : 'Select customer'}
                    disabled={isLoadingOptions}
                    searchable
                    required
                  />
                )}
                <Input
                  label="Visit Notes / Purpose"
                  as="textarea"
                  value={checkInData.notes}
                  onChange={(e) => setCheckInData((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="What is this visit about? (optional)"
                />
                <Button type="submit" className="w-full" loading={isSavingVisit} disabled={isLoadingOptions}>
                  <MapPin className="mr-2 size-4" />
                  Check In
                </Button>
              </form>
            </div>
          </Card>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500">
            <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary-500" aria-hidden="true" />
            <p>
              <span className="font-medium text-neutral-700">Tip:</span> Add notes and outcomes after the visit from Visit
              Details.
            </p>
          </div>
        </div>

        {/* Center: Visit Timeline */}
        <div className="lg:col-span-1">
          {loadError ? (
            <Card>
              <div className="p-6 text-center">
                <p className="text-sm text-red-600">{loadError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadVisits}>Retry</Button>
              </div>
            </Card>
          ) : isLoadingVisits ? (
            <Card><LoadingSpinner label="Loading visits..." /></Card>
          ) : visits.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                  <CalendarClock className="size-5" aria-hidden="true" />
                </div>
                <p className="text-sm text-neutral-500">No visits recorded yet. Check in to log your first visit.</p>
              </div>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary-600" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-neutral-900">Visit Timeline</h3>
                </div>
                <div className="relative w-full lg:w-64">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Search visits..."
                    className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2 pl-10 pr-3 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 px-5 py-3">
                {HISTORY_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setHistoryTab(tab.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      historyTab === tab.value
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredVisits.length === 0 ? (
                <p className="p-8 text-center text-sm text-neutral-500">No visits match this filter.</p>
              ) : (
              <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      <th className="px-4 py-3">Visit</th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Visit Status</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">Follow-up</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {pagedVisits.map((visit) => {
                      const lead = visit.leadId ? leadIndex.get(visit.leadId) : null
                      const primaryTask = visit.followUps[0]
                      const visitStatus = deriveVisitStatus(visit)
                      const followUpStatus = deriveFollowUpStatus(primaryTask)
                      const scheduled = isVisitScheduled(visit)
                      const inProgress = isVisitInProgress(visit)
                      return (
                        <tr
                          key={visit.id}
                          className="cursor-pointer transition-colors hover:bg-primary-50/30"
                          onClick={() => openDetail(visit.id, 'view')}
                        >
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-neutral-900">
                              {lead?.name || visit.customerName || visit.leadName || (visit.leadId ? 'Lead visit' : 'Unknown customer')}
                              {isDemoRecord(visit.id) && (
                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                              )}
                            </p>
                            <span className="mt-0.5 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[0.7rem] font-medium text-neutral-500">
                              {visit.leadId ? 'Lead' : 'Customer'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{formatVisitDateTime(visit.visitDate)}</td>
                          <td className="px-4 py-3.5 text-neutral-600">{labelize(visit.visitType)}</td>
                          <td className="px-4 py-3.5"><Badge variant={visitStatus.variant} dot>{visitStatus.label}</Badge></td>
                          <td className="px-4 py-3.5 text-neutral-600">{visit.outcome ? labelize(visit.outcome) : '—'}</td>
                          <td className="px-4 py-3.5">
                            {primaryTask ? (
                              <div className="flex flex-col gap-1">
                                <span className="truncate text-neutral-700">{primaryTask.title}</span>
                                <span className="flex items-center gap-1.5">
                                  <Badge variant={followUpStatus.variant}>{followUpStatus.label}</Badge>
                                  <span className="text-[0.68rem] text-neutral-400">follow-up</span>
                                  {visit.followUps.length > 1 && <span className="text-xs text-neutral-400">+{visit.followUps.length - 1}</span>}
                                </span>
                              </div>
                            ) : (
                              <span className="text-neutral-400">No follow-up</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {scheduled ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                loading={isActing}
                                onClick={(event) => { event.stopPropagation(); startVisit(visit) }}
                              >
                                Start Visit
                              </Button>
                            ) : inProgress ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={(event) => { event.stopPropagation(); openDetail(visit.id, 'checkout') }}
                              >
                                Complete Visit
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                                View Details <ChevronRight className="size-4" aria-hidden="true" />
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-neutral-100 md:hidden">
                {pagedVisits.map((visit) => {
                  const lead = visit.leadId ? leadIndex.get(visit.leadId) : null
                  const primaryTask = visit.followUps[0]
                  const visitStatus = deriveVisitStatus(visit)
                  const followUpStatus = deriveFollowUpStatus(primaryTask)
                  const scheduled = isVisitScheduled(visit)
                  const inProgress = isVisitInProgress(visit)
                  return (
                    <div
                      key={visit.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(visit.id, 'view')}
                      onKeyDown={(event) => { if (event.key === 'Enter') openDetail(visit.id, 'view') }}
                      className="w-full cursor-pointer p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900">
                            {lead?.name || visit.customerName || visit.leadName || (visit.leadId ? 'Lead visit' : 'Unknown customer')}
                            {isDemoRecord(visit.id) && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                            )}
                          </p>
                          <p className="text-xs text-neutral-500">{formatVisitDateTime(visit.visitDate)} · {labelize(visit.visitType)} · {visit.leadId ? 'Lead' : 'Customer'}</p>
                        </div>
                        <Badge variant={visitStatus.variant} dot>{visitStatus.label}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-neutral-400">Outcome</span>
                          <span className="text-neutral-600">{visit.outcome ? labelize(visit.outcome) : '—'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-neutral-400">Follow-up</span>
                          {primaryTask ? <Badge variant={followUpStatus.variant}>{followUpStatus.label}</Badge> : <span className="text-neutral-500">None</span>}
                        </span>
                      </div>
                      {scheduled && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={(event) => { event.stopPropagation(); startVisit(visit) }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-700 disabled:opacity-50"
                        >
                          <ArrowRightCircle className="size-3.5" /> Start Visit
                        </button>
                      )}
                      {inProgress && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openDetail(visit.id, 'checkout') }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <CheckCircle className="size-3.5" /> Complete Visit
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
              )}

              {filteredVisits.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3.5">
                  <p className="text-xs text-neutral-400">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredVisits.length)} of {filteredVisits.length} visits
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                      className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="px-2 text-sm text-neutral-600">{currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))}
                      className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Visit Detail modal */}
      <Modal isOpen={Boolean(detailVisit)} onClose={closeDetail} title={modalTitle} size="lg">
        {detailVisit && (
          detailMode === 'checkout' ? (
            <VisitCheckoutForm
              visit={detailVisit}
              assigneeOptions={assigneeOptions}
              isLoadingOptions={isLoadingOptions}
              submitting={isActing}
              error={actionError}
              onSubmit={(data) => completeVisit(detailVisit, data)}
              onCancel={() => { setDetailMode('view'); setActionError('') }}
            />
          ) : detailMode === 'addFollowUp' ? (
            <div className="space-y-4">
              {actionError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
              <FollowUpFields data={addTaskData} setData={setAddTaskData} assigneeOptions={assigneeOptions} isLoadingOptions={isLoadingOptions} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" disabled={isActing} onClick={() => { setDetailMode('view'); setActionError('') }}>Back</Button>
                <Button type="button" loading={isActing} onClick={() => addFollowUp(detailVisit, addTaskData)}>
                  <Plus className="mr-1.5 size-4" /> Create Follow-up
                </Button>
              </div>
            </div>
          ) : detailMode === 'cancel' ? (
            <div className="space-y-4">
              {actionError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
              <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 text-sm">
                <p className="font-medium text-neutral-800">{detailVisit.customerName || detailVisit.leadName || 'Lead visit'}</p>
                <p className="text-xs text-neutral-500">{formatVisitDateTime(detailVisit.visitDate)}</p>
              </div>
              <Input
                label="Reason for cancelling"
                as="textarea"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Client rescheduled to next week"
                required
              />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" disabled={isActing} onClick={() => { setDetailMode('view'); setActionError('') }}>Back</Button>
                <Button type="button" variant="danger" loading={isActing} onClick={() => cancelVisit(detailVisit, cancelReasonInput)}>
                  Cancel Visit
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {actionError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
              <VisitInfoBody
                visit={detailVisit}
                visitStatus={detailStatus}
                followUpRequired={detailFollowUpRequired}
                canAddFollowUp={detailCanAddFollowUp}
                onAddFollowUp={() => { setActionError(''); setAddTaskData(emptyTaskFields()); setDetailMode('addFollowUp') }}
                nextAction={detailNextAction}
                taskError={taskErrors[detailVisit.id]}
                onRunNextAction={runVisitNextAction}
                onRetryTask={() => handleRetryTaskCreation(detailVisit.id)}
              />
              {detailCancellable && (
                <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={isActing} onClick={() => { setActionError(''); setCancelReasonInput(''); setDetailMode('cancel') }}>
                    Cancel Visit
                  </Button>
                  {detailScheduled && (
                    <Button type="button" loading={isActing} onClick={() => startVisit(detailVisit)}>
                      <ArrowRightCircle className="mr-2 size-4" />
                      Start Visit
                    </Button>
                  )}
                  {detailInProgress && (
                    <Button type="button" onClick={() => { setActionError(''); setDetailMode('checkout') }}>
                      <CheckCircle className="mr-2 size-4" />
                      Complete Visit
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </Modal>

      <ConvertLeadModal
        isOpen={Boolean(convertLeadId)}
        onClose={() => setConvertLeadId(null)}
        leadId={convertLeadId || ''}
        onConverted={applyLeadConverted}
      />
    </div>
  )
}
