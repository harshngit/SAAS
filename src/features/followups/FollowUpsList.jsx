import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightCircle, Plus, Edit, Trash2, CheckCircle, RotateCw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  completeFollowUp,
  createFollowUp,
  deleteFollowUp,
  FOLLOW_UP_PRIORITY_OPTIONS,
  listFollowUps,
  updateFollowUp,
} from '../../api/followups'
import { listCustomers } from '../../api/customers'
import { listVisits } from '../../api/visits'
import { listLeads } from '../../api/leads'
import { listAssignableStaff } from '../../api/users'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { FOLLOWUP_OUTCOME_OPTIONS, deriveFollowUpType, describeDueDate, dayDelta } from '../leads/leadActivity'
import { deriveFollowUpStatus } from '../visits/visitStatus'
import ConvertLeadModal from '../leads/ConvertLeadModal'
import { DEMO_RECORDS_ENABLED, demoFollowUps, demoLeads, isDemoRecord } from '../leads/demoData'

// The single most relevant next action for a completed follow-up, based on its outcome.
// Convert/View-Customer only apply to Leads (never Customers, never Lost/Converted leads).
function followUpNextAction(followUp, contact) {
  if (followUp.status !== 'completed') return null
  const isLead = contact.kind === 'Lead'

  if (isLead && (contact.convertedCustomerId || contact.leadStatus === 'won')) {
    return contact.convertedCustomerId
      ? { kind: 'viewCustomer', customerId: contact.convertedCustomerId }
      : null
  }
  if (isLead && contact.leadStatus === 'lost') return null

  switch (followUp.outcome) {
    case 'ready_to_convert':
      return isLead ? { kind: 'convert', leadId: contact.leadId } : null
    case 'need_another_followup':
      return { kind: 'addFollowUp' }
    case 'ready_for_visit':
      return { kind: 'logVisit' }
    default:
      return null
  }
}

const FOLLOWUP_TABS = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
]

function bucketForFollowUp(followUp) {
  if (followUp.status === 'completed') return 'completed'
  const delta = dayDelta(followUp.dueDate)
  if (delta === null) return 'upcoming'
  if (delta < 0) return 'overdue'
  if (delta === 0) return 'today'
  return 'upcoming'
}

const PRIORITY_VARIANT = { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' }

function titleCase(value = '') {
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function FollowUpRow({ followUp, contact, visitOrigin, actingId, onComplete, onEdit, onDelete }) {
  const isDone = followUp.status === 'completed'
  const due = describeDueDate(followUp.dueDate)
  const type = deriveFollowUpType(followUp.title)
  const fuStatus = deriveFollowUpStatus(followUp)

  return (
    <tr className={`transition-colors hover:bg-primary-50/30 ${isDone ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3.5">
        <p className="font-medium text-neutral-900">
          {followUp.title}
          {isDemoRecord(followUp.id) && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
          )}
        </p>
        {followUp.description && <p className="mt-0.5 max-w-md truncate text-xs text-neutral-400">{followUp.description}</p>}
        {followUp.outcome && (
          <p className="mt-0.5 text-xs text-neutral-500">Outcome: {titleCase(followUp.outcome)}</p>
        )}
        {followUp.outcomeNotes && (
          <p className="mt-0.5 text-xs text-neutral-500">Notes: {followUp.outcomeNotes}</p>
        )}
        <p className="mt-0.5 text-[0.68rem] text-neutral-400">
          {visitOrigin
            ? `Origin: visit · ${titleCase(visitOrigin.visitType)}${visitOrigin.visitDate ? ` · ${formatDueDate(visitOrigin.visitDate)}` : ''}`
            : 'Origin: direct follow-up'}
        </p>
      </td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-neutral-900">{contact.name}</p>
        {contact.kind && (
          <span className="mt-0.5 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[0.7rem] font-medium text-neutral-500">
            {contact.kind}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">{type}</span>
      </td>
      <td className={`whitespace-nowrap px-4 py-3.5 text-sm ${due.tone === 'danger' && !isDone ? 'font-medium text-red-600' : 'text-neutral-600'}`}>
        {isDone ? formatDueDate(followUp.dueDate) : due.label}
      </td>
      <td className="px-4 py-3.5">
        <Badge variant={PRIORITY_VARIANT[followUp.priority] || 'neutral'}>{titleCase(followUp.priority)}</Badge>
      </td>
      <td className="px-4 py-3.5">
        <Badge variant={fuStatus.variant}>{fuStatus.label}</Badge>
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {!isDone && (
            <button
              onClick={onComplete}
              disabled={actingId === followUp.id}
              className="rounded-lg p-2 text-neutral-500 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
              title="Complete"
            >
              <CheckCircle className="size-4" />
            </button>
          )}
          <button onClick={onEdit} className="rounded-lg p-2 text-neutral-500 hover:bg-primary-50 hover:text-primary-600" title="Edit">
            <Edit className="size-4" />
          </button>
          <button onClick={onDelete} className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600" title="Delete">
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyFormData() {
  return {
    party: 'customer',
    customerId: '',
    leadId: '',
    title: '',
    description: '',
    dueDate: todayIso(),
    dueTime: '10:00',
    priority: 'medium',
    assigneeId: '',
  }
}

function formatDueDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function FollowUpsList() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [followUps, setFollowUps] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [customers, setCustomers] = useState([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  // Visits + leads are loaded only to resolve the real Lead/Customer name (and lead
  // status) for follow-ups created from a visit - they carry no such info themselves.
  const [visits, setVisits] = useState([])
  const [leads, setLeads] = useState([])
  const [convertLeadId, setConvertLeadId] = useState(null)
  // Demo-lead status overrides after a simulated conversion (UI testing only).
  const [demoLeadOverrides, setDemoLeadOverrides] = useState({})

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actingId, setActingId] = useState('')
  const [activeTab, setActiveTab] = useState('today')
  const [completingFollowUp, setCompletingFollowUp] = useState(null)
  const [completeOutcome, setCompleteOutcome] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')

  const loadFollowUps = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listFollowUps(currentUser?.id ? { assignedToId: currentUser.id } : {})

    if (!result.success) {
      setFollowUps([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    // Demo rows (UI testing only) are appended locally - never sent to the backend.
    const rows = DEMO_RECORDS_ENABLED ? [...result.followUps, ...demoFollowUps] : result.followUps
    setFollowUps(rows.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)))
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    loadFollowUps()
  }, [loadFollowUps])

  useEffect(() => {
    listCustomers().then((result) => {
      setIsLoadingCustomers(false)
      if (result.success) setCustomers(result.customers)
    })
    listAssignableStaff().then((result) => {
      setIsLoadingStaff(false)
      if (result.success) setStaffMembers(result.users)
    })
    listVisits().then((result) => {
      if (result.success) setVisits(result.visits)
    })
    listLeads().then((result) => {
      if (result.success) setLeads(result.leads)
    })
  }, [])

  const leadIndex = useMemo(() => {
    const map = new Map()
    leads.forEach((lead) => map.set(lead.id, lead))
    if (DEMO_RECORDS_ENABLED) {
      demoLeads.forEach((lead) => map.set(lead.id, { ...lead, ...(demoLeadOverrides[lead.id] || {}) }))
    }
    return map
  }, [leads, demoLeadOverrides])

  // visit id -> { name, kind, leadId, customerId }
  const visitIndex = useMemo(() => {
    const map = new Map()
    visits.forEach((visit) => {
      map.set(visit.id, {
        name: visit.customerName || visit.leadName || (visit.leadId ? 'Lead' : 'Customer'),
        kind: visit.leadId ? 'Lead' : 'Customer',
        leadId: visit.leadId || '',
        customerId: visit.customerId || '',
        visitType: visit.visitType || '',
        visitDate: visit.visitDate || '',
      })
    })
    return map
  }, [visits])

  const resolveContact = useCallback(
    (followUp) => {
      let base
      if (followUp.customerName) {
        base = { name: followUp.customerName, kind: 'Customer', leadId: '', customerId: followUp.customerId }
      } else if (followUp.leadId) {
        base = { name: followUp.leadName || 'Lead', kind: 'Lead', leadId: followUp.leadId, customerId: '' }
      } else if (followUp.visitId && visitIndex.has(followUp.visitId)) {
        base = { ...visitIndex.get(followUp.visitId) }
      } else {
        return { name: 'Unknown contact', kind: null, leadId: '', customerId: '', leadStatus: '', convertedCustomerId: '' }
      }
      // Enrich a lead contact with its live status so eligibility rules can be applied.
      const lead = base.leadId ? leadIndex.get(base.leadId) : null
      return {
        ...base,
        name: lead?.name || base.name,
        leadStatus: lead?.leadStatus || '',
        convertedCustomerId: lead?.convertedCustomerId || '',
      }
    },
    [visitIndex, leadIndex],
  )

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )
  const assigneeOptions = useMemo(
    () => staffMembers.map((user) => ({ value: user.id, label: user.name })),
    [staffMembers],
  )
  const leadOptions = useMemo(
    () => leads.map((lead) => ({ value: lead.id, label: lead.name || lead.customerName || 'New prospect' })),
    [leads],
  )

  const buckets = useMemo(() => {
    const grouped = { today: [], upcoming: [], overdue: [], completed: [] }
    followUps.forEach((followUp) => {
      grouped[bucketForFollowUp(followUp)].push(followUp)
    })
    return grouped
  }, [followUps])

  const handleAddFollowUp = () => {
    setEditingFollowUp(null)
    setFormError('')
    setFormData(emptyFormData())
    setIsModalOpen(true)
  }

  const handleEditFollowUp = (followUp) => {
    setEditingFollowUp(followUp)
    setFormError('')
    const dueDate = followUp.dueDate ? new Date(followUp.dueDate) : new Date()
    const visitOrigin = followUp.visitId ? visitIndex.get(followUp.visitId) : null
    const leadId = followUp.leadId || visitOrigin?.leadId || ''
    const customerId = followUp.customerId || visitOrigin?.customerId || ''
    setFormData({
      party: leadId ? 'lead' : 'customer',
      customerId,
      leadId,
      title: followUp.title,
      description: followUp.description,
      dueDate: dueDate.toISOString().slice(0, 10),
      dueTime: dueDate.toTimeString().slice(0, 5),
      priority: followUp.priority,
      assigneeId: followUp.assignedToId || '',
    })
    setIsModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    // Demo rows are local-only - drop them without hitting the backend.
    if (isDemoRecord(deleteTarget.id)) {
      setFollowUps((current) => current.filter((entry) => entry.id !== deleteTarget.id))
      setDeleteTarget(null)
      return
    }

    setActingId(deleteTarget.id)
    const result = await deleteFollowUp(deleteTarget.id)
    setActingId('')

    if (!result.success) {
      showToast({ title: 'Delete failed', message: result.error })
      return
    }

    setFollowUps((current) => current.filter((entry) => entry.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const handleSaveFollowUp = async (event) => {
    event.preventDefault()

    const selectedPartyId = formData.party === 'lead' ? formData.leadId : formData.customerId
    if (!editingFollowUp?.visitId && !selectedPartyId) {
      setFormError(`Select a ${formData.party} for this follow-up.`)
      return
    }
    if (!formData.title.trim()) {
      setFormError('Enter a task title.')
      return
    }

    const dueDate = `${formData.dueDate}T${formData.dueTime}:00`

    // Editing a demo row stays local - no backend PATCH.
    if (editingFollowUp && isDemoRecord(editingFollowUp.id)) {
      setFollowUps((current) =>
        current.map((entry) =>
          entry.id === editingFollowUp.id
            ? { ...entry, title: formData.title, description: formData.description, dueDate, priority: formData.priority }
            : entry,
        ),
      )
      setIsModalOpen(false)
      return
    }

    setIsSaving(true)
    setFormError('')

    const payload = {
      title: formData.title,
      description: formData.description,
      dueDate,
      priority: formData.priority,
      assigneeId: formData.assigneeId || undefined,
    }
    // Visit-linked tasks keep their existing relationship. Standalone tasks send exactly
    // one direct party relationship selected in the form.
    if (!editingFollowUp?.visitId) {
      if (formData.party === 'lead') payload.leadId = formData.leadId
      else payload.customerId = formData.customerId
    }

    const result = editingFollowUp
      ? await updateFollowUp(editingFollowUp.id, payload)
      : await createFollowUp(payload)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setFollowUps((current) =>
      editingFollowUp
        ? current.map((entry) => (entry.id === editingFollowUp.id ? result.followUp : entry))
        : [result.followUp, ...current],
    )
    setIsModalOpen(false)
  }

  const openComplete = (followUp) => {
    if (followUp.status === 'completed') return
    setCompletingFollowUp(followUp)
    setCompleteOutcome('')
    setCompleteNotes('')
  }

  const handleComplete = async () => {
    const followUp = completingFollowUp
    if (!followUp) return

    // Completing a demo row stays local - no backend call.
    const applyLocal = (base) =>
      setFollowUps((current) =>
        current.map((entry) =>
          entry.id === followUp.id
            ? { ...base, status: 'completed', completedAt: new Date().toISOString(), outcome: completeOutcome, outcomeNotes: completeNotes.trim() }
            : entry,
        ),
      )

    if (isDemoRecord(followUp.id)) {
      applyLocal(followUp)
      setCompletingFollowUp(null)
      showToast({ title: 'Follow-up completed', message: completeOutcome ? `Outcome: ${completeOutcome.replace(/_/g, ' ')}.` : 'Follow-up completed.' })
      return
    }

    setActingId(followUp.id)
    const outcome = completeOutcome.trim()
    const notes = completeNotes.trim()
    const result = await completeFollowUp(followUp.id, {
      ...(outcome ? { outcome } : {}),
      ...(notes ? { outcomeNotes: notes } : {}),
    })
    setActingId('')

    if (!result.success) {
      showToast({ title: 'Unable to complete task', message: result.error })
      return
    }

    setFollowUps((current) => current.map((entry) => (entry.id === followUp.id ? result.followUp : entry)))

    setCompletingFollowUp(null)
    // The next action (Convert / Add Follow-up / Log Visit) is surfaced inline on the
    // row itself via followUpNextAction() - no separate banner needed.
    showToast({ title: 'Follow-up completed', message: outcome ? `Outcome: ${outcome.replace(/_/g, ' ')}.` : 'Follow-up completed.' })
  }

  const runNextAction = (action, contact) => {
    if (action.kind === 'convert') {
      setConvertLeadId(action.leadId) // demo leads open a simulated modal
      return
    }

    // Demo rows shouldn't navigate to real (nonexistent) records.
    if (isDemoRecord(contact.leadId) || isDemoRecord(action.customerId)) {
      const what =
        action.kind === 'viewCustomer' ? 'open the customer record' : action.kind === 'logVisit' ? 'open Log Visit' : 'open Add Follow-up'
      showToast({ title: 'Demo record', message: `On a real lead this would ${what}.` })
      return
    }

    if (action.kind === 'viewCustomer') {
      navigate(`/sales/customers/${action.customerId}`)
    } else if (action.kind === 'logVisit') {
      navigate('/sales/visits')
    } else if (action.kind === 'addFollowUp') {
      if (contact.kind === 'Lead' && contact.leadId) {
        navigate(`/sales/leads/${contact.leadId}`)
      } else {
        handleAddFollowUp()
        if (contact.customerId) setFormData((current) => ({ ...current, customerId: contact.customerId }))
      }
    }
  }

  // Marks a lead as converted in local state so its follow-up rows immediately flip
  // Convert -> View Customer without a full refetch.
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
    showToast({ title: 'Lead converted', message: 'A customer record was created.' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Follow-ups</h1>
          <p className="text-sm text-neutral-500">Track and manage your customer follow-ups</p>
        </div>
        <Button onClick={handleAddFollowUp}>
          <Plus className="size-4 mr-2" />
          Add Follow-up
        </Button>
      </div>

      {listError ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadFollowUps}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card>
          <LoadingSpinner label="Loading follow-ups..." />
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            {FOLLOWUP_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label} ({buckets[tab.value].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {FOLLOWUP_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {buckets[tab.value].length === 0 ? (
                <Card>
                  <p className="p-8 text-center text-sm text-neutral-500">
                    {tab.value === 'completed' ? 'No completed follow-ups yet.' : `Nothing ${tab.label.toLowerCase()}.`}
                  </p>
                </Card>
              ) : (
                <Card className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-205 text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                          <th className="px-4 py-3">Follow-up</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Due</th>
                          <th className="px-4 py-3">Priority</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="w-24 px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {buckets[tab.value].map((followUp) => {
                          const contact = resolveContact(followUp)
                          const next = followUpNextAction(followUp, contact)
                          const visitOrigin = followUp.visitId ? visitIndex.get(followUp.visitId) : null
                          return (
                            <Fragment key={followUp.id}>
                              <FollowUpRow
                                followUp={followUp}
                                contact={contact}
                                visitOrigin={visitOrigin}
                                actingId={actingId}
                                onComplete={() => openComplete(followUp)}
                                onEdit={() => handleEditFollowUp(followUp)}
                                onDelete={() => setDeleteTarget(followUp)}
                              />
                              {next && (
                                <tr className="bg-primary-50/30">
                                  <td colSpan={7} className="px-4 py-2.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={next.kind === 'convert' ? undefined : 'outline'}
                                      onClick={() => runNextAction(next, contact)}
                                    >
                                      {next.kind === 'convert' && <ArrowRightCircle className="mr-2 size-4" />}
                                      {next.kind === 'convert'
                                        ? 'Convert to Customer'
                                        : next.kind === 'viewCustomer'
                                          ? 'View Customer'
                                          : next.kind === 'logVisit'
                                            ? 'Log Visit'
                                            : 'Add Follow-up'}
                                    </Button>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <ConvertLeadModal
        isOpen={Boolean(convertLeadId)}
        onClose={() => setConvertLeadId(null)}
        leadId={convertLeadId || ''}
        onConverted={applyLeadConverted}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'} size="xl">
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Follow-up For <span className="text-red-500">*</span></p>
            <div className="flex rounded-xl bg-neutral-100 p-1">
              {[{ value: 'customer', label: 'Customer' }, { value: 'lead', label: 'Lead' }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={Boolean(editingFollowUp)}
                  onClick={() => setFormData((current) => ({ ...current, party: option.value, customerId: '', leadId: '' }))}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    formData.party === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {formData.party === 'lead' ? (
            <Select
              label="Lead"
              options={leadOptions}
              value={formData.leadId}
              onChange={(event) => setFormData((current) => ({ ...current, leadId: event.target.value }))}
              placeholder={leads.length ? 'Select lead' : 'No leads available'}
              disabled={Boolean(editingFollowUp?.visitId) || leads.length === 0}
              searchable
              required={!editingFollowUp?.visitId}
            />
          ) : (
            <Select
              label="Customer"
              options={customerOptions}
              value={formData.customerId}
              onChange={(event) => setFormData((current) => ({ ...current, customerId: event.target.value }))}
              placeholder={isLoadingCustomers ? 'Loading customers...' : 'Select customer'}
              disabled={Boolean(editingFollowUp?.visitId) || isLoadingCustomers}
              searchable
              required={!editingFollowUp?.visitId}
            />
          )}
          <Input
            label="Task Title"
            value={formData.title}
            onChange={(e) => setFormData((current) => ({ ...current, title: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData((current) => ({ ...current, dueDate: e.target.value }))}
              required
            />
            <Input
              label="Due Time"
              type="time"
              value={formData.dueTime}
              onChange={(e) => setFormData((current) => ({ ...current, dueTime: e.target.value }))}
              required
            />
          </div>
          <Select
            label="Priority"
            options={FOLLOW_UP_PRIORITY_OPTIONS}
            value={formData.priority}
            onChange={(e) => setFormData((current) => ({ ...current, priority: e.target.value }))}
          />
          <Select
            label="Assignee"
            options={assigneeOptions}
            value={formData.assigneeId}
            onChange={(e) => setFormData((current) => ({ ...current, assigneeId: e.target.value }))}
            placeholder={isLoadingStaff ? 'Loading staff...' : 'Defaults to you if left blank'}
            disabled={isLoadingStaff}
          />
          <Input
            label="Description"
            as="textarea"
            value={formData.description}
            onChange={(e) => setFormData((current) => ({ ...current, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving}>{editingFollowUp ? 'Update' : 'Add'} Follow-up</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(completingFollowUp)} onClose={() => setCompletingFollowUp(null)} title="Complete Follow-up">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">{completingFollowUp?.title}</p>
          <Select
            label="Outcome"
            options={[{ value: '', label: 'No outcome' }, ...FOLLOWUP_OUTCOME_OPTIONS]}
            value={completeOutcome}
            onChange={(event) => setCompleteOutcome(event.target.value)}
          />
          <Input
            label="Notes"
            as="textarea"
            value={completeNotes}
            onChange={(event) => setCompleteNotes(event.target.value)}
            placeholder="What was the result of this follow-up?"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCompletingFollowUp(null)} disabled={actingId === completingFollowUp?.id}>Cancel</Button>
            <Button type="button" loading={actingId === completingFollowUp?.id} onClick={handleComplete}>Complete Follow-up</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Follow-up">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete the follow-up "{deleteTarget?.title}"? This cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={actingId === deleteTarget?.id} onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
