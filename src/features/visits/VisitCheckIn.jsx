import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightCircle, CheckCircle, ChevronDown, MapPin, RefreshCw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listAssignableStaff } from '../../api/users'
import { listCustomers } from '../../api/customers'
import { listLeads } from '../../api/leads'
import { createVisit, createVisitFollowUp, listVisits, updateVisit } from '../../api/visits'
import { useAuthStore } from '../../store/authStore'
import { VISIT_OUTCOME_OPTIONS, isReadyToConvertOutcome } from '../leads/leadActivity'
import ConvertLeadModal from '../leads/ConvertLeadModal'
import { DEMO_RECORDS_ENABLED, demoLeads, demoVisits, isDemoRecord } from '../leads/demoData'

const VISIT_STATUS_VARIANT = { completed: 'success', cancelled: 'neutral', planned: 'info' }

function labelize(value = '') {
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// The single most relevant next action for a completed visit, based on its outcome.
// Convert / View Customer only apply to Lead visits whose lead isn't already
// Converted or Lost.
function visitNextAction(visit, lead, readyToConvertHint) {
  if (visit.status !== 'completed' || !visit.leadId) return null

  if (lead && (lead.convertedCustomerId || lead.leadStatus === 'won')) {
    return lead.convertedCustomerId ? { kind: 'viewCustomer', customerId: lead.convertedCustomerId } : null
  }
  if (lead && lead.leadStatus === 'lost') return null

  if (isReadyToConvertOutcome(visit.outcome) || readyToConvertHint) {
    return { kind: 'convert', leadId: visit.leadId }
  }
  if (visit.outcome === 'followup_required') return { kind: 'addFollowUp' }
  return null
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyTaskFields() {
  return {
    title: '',
    description: '',
    dueDate: todayIso(),
    dueTime: '10:00',
    assigneeId: '',
    priority: 'medium',
  }
}

function emptyCheckInData() {
  return {
    visitFor: 'customer',
    customerId: '',
    leadId: '',
    notes: '',
  }
}

// Outcome + follow-up are asked at CHECK-OUT (you can't know the outcome before the
// visit happens), not at check-in.
function emptyCheckOutData() {
  return {
    outcome: '',
    notes: '',
    createFollowUpTask: false,
    ...emptyTaskFields(),
  }
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

export default function VisitCheckIn() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const navigate = useNavigate()

  const [visits, setVisits] = useState([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isCheckIn, setIsCheckIn] = useState(true)
  const [checkInData, setCheckInData] = useState(emptyCheckInData)
  const [checkOutData, setCheckOutData] = useState(emptyCheckOutData)
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [customers, setCustomers] = useState([])
  const [leads, setLeads] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [isSavingVisit, setIsSavingVisit] = useState(false)
  const [isSavingCheckout, setIsSavingCheckout] = useState(false)
  // Only tracks visits whose follow-up task creation FAILED and needs a manual retry -
  // successfully created tasks live on visit.followUps (server truth), not here.
  const [taskErrors, setTaskErrors] = useState({})
  // Visit id -> lead id, for lead visits whose check-in outcome was "Ready to Convert".
  // Lets us surface a Convert-to-Customer shortcut after the visit is done.
  const [readyToConvert, setReadyToConvert] = useState({})
  const [expandedVisitId, setExpandedVisitId] = useState(null)
  const [convertLeadId, setConvertLeadId] = useState(null)
  // Demo-lead status overrides after a simulated conversion (UI testing only).
  const [demoLeadOverrides, setDemoLeadOverrides] = useState({})

  const loadVisits = async () => {
    setIsLoadingVisits(true)
    setLoadError('')

    const result = currentUser?.id ? await listVisits({ userId: currentUser.id }) : await listVisits()

    if (!result.success) {
      setLoadError(result.error)
      setIsLoadingVisits(false)
      return
    }

    // Demo rows (UI testing only) are appended locally - never sent to the backend.
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
      // GET /users/assignable is a privacy-safe picker usable by anyone with follow_ups:create
      // permission (Admin, Sales Officer) - unlike admin-only GET /users. Falls back to
      // "assign to me" if the call fails for any reason (e.g. a role with no create permission).
      const [staffResult, customersResult, leadsResult] = await Promise.all([
        listAssignableStaff(),
        listCustomers(),
        listLeads(),
      ])

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
    return () => {
      isMounted = false
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email])

  const assigneeOptions = useMemo(
    () =>
      staffMembers.map((user) => ({
        value: user.id,
        label: user.name || user.display_name || user.full_name || user.email || 'User',
      })),
    [staffMembers],
  )

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )

  const leadOptions = useMemo(
    () => leads.map((lead) => ({
      value: lead.id,
      label: `${lead.name || lead.customerName || 'New prospect'}${lead.mobileNumber ? ` • ${lead.mobileNumber}` : ''}`,
    })),
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

  const runVisitNextAction = (action) => {
    if (action.kind === 'convert') {
      setConvertLeadId(action.leadId) // demo leads open a simulated modal
      return
    }
    if (isDemoRecord(action.customerId)) {
      setFormMessage('Demo record — on a real lead this would open the customer record.')
      return
    }
    if (action.kind === 'viewCustomer') navigate(`/sales/customers/${action.customerId}`)
    else if (action.kind === 'addFollowUp') navigate('/sales/followups')
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

  const activeVisit = visits.find((visit) => visit.id === activeVisitId)
  const isLeadVisit = checkInData.visitFor === 'lead'

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
      setFormError(result.error)
      setIsSavingVisit(false)
      return
    }

    const visit = result.visit
    setVisits((current) => [visit, ...current])
    setActiveVisitId(visit.id)
    setCheckOutData(emptyCheckOutData())
    setIsCheckIn(false)
    setIsSavingVisit(false)
    setCheckInData(emptyCheckInData())
    setFormMessage('Checked in. Complete the visit when you are done.')
  }

  const handleRetryTaskCreation = async (visitId) => {
    const entry = taskErrors[visitId]
    if (!entry) return

    setFormError('')
    setFormMessage('')

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
      setFormError(result.error)
      return
    }

    setVisits((current) =>
      current.map((visit) => (visit.id === visitId ? { ...visit, followUps: [...visit.followUps, result.followUp] } : visit)),
    )
    setTaskErrors((current) => {
      const { [visitId]: removed, ...rest } = current
      void removed
      return rest
    })
    setFormMessage('Follow-up task created successfully.')
  }

  // Check-out IS where the outcome (and optional follow-up task) is captured.
  const handleCheckOut = async (event) => {
    event.preventDefault()
    if (!activeVisit) return

    if (!checkOutData.outcome) {
      setFormError('Select the visit outcome.')
      return
    }
    if (checkOutData.createFollowUpTask && !checkOutData.title.trim()) {
      setFormError('Enter a follow-up task title.')
      return
    }

    setIsSavingCheckout(true)
    setFormError('')

    const combinedNotes = [activeVisit.notes, checkOutData.notes.trim()].filter(Boolean).join('\n\n')
    const result = await updateVisit(activeVisit.id, {
      status: 'completed',
      outcome: checkOutData.outcome,
      notes: combinedNotes,
    })

    if (!result.success) {
      setIsSavingCheckout(false)
      setFormError(result.error)
      return
    }

    const visitId = activeVisit.id
    setVisits((current) =>
      current.map((visit) => (visit.id === visitId ? { ...visit, ...result.visit, followUps: visit.followUps } : visit)),
    )

    if (activeVisit.leadId && isReadyToConvertOutcome(checkOutData.outcome)) {
      setReadyToConvert((current) => ({ ...current, [visitId]: activeVisit.leadId }))
    }

    if (checkOutData.createFollowUpTask) {
      const dueDate = `${checkOutData.dueDate}T${checkOutData.dueTime}:00`
      const taskResult = await createVisitFollowUp(visitId, {
        customerId: activeVisit.customerId || undefined,
        title: checkOutData.title,
        description: checkOutData.description,
        dueDate,
        priority: checkOutData.priority,
        assigneeId: checkOutData.assigneeId,
      })

      if (!taskResult.success) {
        setTaskErrors((current) => ({
          ...current,
          [visitId]: { draft: { customerId: activeVisit.customerId, ...checkOutData, dueDate }, error: taskResult.error },
        }))
      } else {
        setVisits((current) =>
          current.map((entry) => (entry.id === visitId ? { ...entry, followUps: [...entry.followUps, taskResult.followUp] } : entry)),
        )
      }
    }

    setIsSavingCheckout(false)
    setActiveVisitId(null)
    setIsCheckIn(true)
    setExpandedVisitId(visitId)
    setCheckOutData(emptyCheckOutData())
    setFormMessage('Visit completed.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Visits</h1>
          <p className="text-sm text-neutral-500">Check in/out of customer visits and add follow-up tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
              <h3 className="mb-6 text-lg font-semibold text-neutral-900">
                {isCheckIn ? 'Check In' : 'Check Out'}
              </h3>

              {formError && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              {formMessage && (
                <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {formMessage}
                </div>
              )}

              {isCheckIn ? (
                <form onSubmit={handleCheckIn} className="space-y-4">
                  <Select
                    label="Visit For"
                    required
                    options={[
                      { value: 'customer', label: 'Customer' },
                      { value: 'lead', label: 'Lead' },
                    ]}
                    value={checkInData.visitFor}
                    onChange={(event) =>
                      setCheckInData((current) => ({ ...current, visitFor: event.target.value, customerId: '', leadId: '' }))
                    }
                  />

                  {isLeadVisit ? (
                    <Select
                      label="Lead"
                      options={leadOptions}
                      value={checkInData.leadId}
                      onChange={(event) => setCheckInData((current) => ({ ...current, leadId: event.target.value }))}
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
                      onChange={(event) => setCheckInData((current) => ({ ...current, customerId: event.target.value }))}
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
                    onChange={(event) => setCheckInData((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="What is this visit about? (optional)"
                  />

                  <p className="text-xs text-neutral-400">You'll record the outcome after the visit, at check-out.</p>

                  <Button type="submit" className="w-full" loading={isSavingVisit} disabled={isLoadingOptions}>
                    <MapPin className="mr-2 size-4" />
                    Check In
                  </Button>
                </form>
              ) : (
                activeVisit && (
                  <form onSubmit={handleCheckOut} className="space-y-4">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle className="size-5 text-green-700" />
                        <span className="font-semibold text-green-800">Checked In</span>
                      </div>
                      <p className="mb-1 text-sm text-green-700">{activeVisit.customerName || activeVisit.leadName || 'Lead visit'}</p>
                      <p className="text-xs text-green-600">{formatVisitDateTime(activeVisit.visitDate)}</p>
                    </div>

                    <Select
                      label="Outcome"
                      required
                      options={[{ value: '', label: 'Select outcome' }, ...VISIT_OUTCOME_OPTIONS]}
                      value={checkOutData.outcome}
                      onChange={(event) => setCheckOutData((current) => ({ ...current, outcome: event.target.value }))}
                    />

                    <Input
                      label="Notes"
                      as="textarea"
                      value={checkOutData.notes}
                      onChange={(event) => setCheckOutData((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="What happened on this visit?"
                    />

                    <label className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3.5 py-3 text-sm font-medium text-neutral-800">
                      <input
                        type="checkbox"
                        checked={checkOutData.createFollowUpTask}
                        onChange={(event) =>
                          setCheckOutData((current) => ({
                            ...current,
                            createFollowUpTask: event.target.checked,
                            ...(event.target.checked ? {} : emptyTaskFields()),
                          }))
                        }
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      Create Follow-up Task
                    </label>

                    {checkOutData.createFollowUpTask && (
                      <div className="space-y-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
                        <Input
                          label="Task Title"
                          value={checkOutData.title}
                          onChange={(event) => setCheckOutData((current) => ({ ...current, title: event.target.value }))}
                          required
                        />
                        <Input
                          label="Description"
                          as="textarea"
                          value={checkOutData.description}
                          onChange={(event) => setCheckOutData((current) => ({ ...current, description: event.target.value }))}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Input
                            label="Due Date"
                            type="date"
                            value={checkOutData.dueDate}
                            onChange={(event) => setCheckOutData((current) => ({ ...current, dueDate: event.target.value }))}
                            required
                          />
                          <Input
                            label="Due Time"
                            type="time"
                            value={checkOutData.dueTime}
                            onChange={(event) => setCheckOutData((current) => ({ ...current, dueTime: event.target.value }))}
                            required
                          />
                        </div>
                        <Select
                          label="Assignee"
                          options={assigneeOptions}
                          value={checkOutData.assigneeId}
                          onChange={(event) => setCheckOutData((current) => ({ ...current, assigneeId: event.target.value }))}
                          placeholder={isLoadingOptions ? 'Loading employees...' : 'Defaults to you if left blank'}
                          disabled={isLoadingOptions}
                        />
                        <Select
                          label="Priority"
                          options={taskPriorityOptions}
                          value={checkOutData.priority}
                          onChange={(event) => setCheckOutData((current) => ({ ...current, priority: event.target.value }))}
                          required
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full" loading={isSavingCheckout}>
                      <CheckCircle className="mr-2 size-4" />
                      Complete Visit
                    </Button>
                  </form>
                )
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Visit History</h3>
            {isLoadingOptions && (
              <span className="text-xs text-neutral-400">Loading employees for task assignees...</span>
            )}
          </div>

          {loadError ? (
            <Card>
              <div className="p-6 text-center">
                <p className="text-sm text-red-600">{loadError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadVisits}>Retry</Button>
              </div>
            </Card>
          ) : isLoadingVisits ? (
            <Card>
              <LoadingSpinner label="Loading visits..." />
            </Card>
          ) : visits.length === 0 ? (
            <Card>
              <p className="p-6 text-center text-sm text-neutral-500">No visits recorded yet. Check in above to log your first visit.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-205 text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-4 py-3">Visit</th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">Follow-up</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {visits.map((visit) => {
                      const lead = visit.leadId ? leadIndex.get(visit.leadId) : null
                      const nextAction = visitNextAction(visit, lead, readyToConvert[visit.id])
                      const hasDetail = Boolean(visit.notes || visit.outcome || visit.followUps.length || taskErrors[visit.id] || nextAction)
                      const isExpanded = expandedVisitId === visit.id
                      const primaryTask = visit.followUps[0]
                      return (
                        <Fragment key={visit.id}>
                          <tr
                            className={`transition-colors hover:bg-primary-50/30 ${hasDetail ? 'cursor-pointer' : ''}`}
                            onClick={() => hasDetail && setExpandedVisitId(isExpanded ? null : visit.id)}
                          >
                            <td className="px-3 py-3.5 text-neutral-400">
                              {hasDetail && <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                            </td>
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
                            <td className="px-4 py-3.5 text-neutral-600">{visit.outcome ? labelize(visit.outcome) : '—'}</td>
                            <td className="px-4 py-3.5">
                              {primaryTask ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-neutral-600">{primaryTask.title}</span>
                                  <Badge variant={primaryTask.status === 'completed' ? 'success' : 'warning'}>
                                    {primaryTask.status === 'completed' ? 'Done' : 'Pending'}
                                  </Badge>
                                  {visit.followUps.length > 1 && <span className="text-xs text-neutral-400">+{visit.followUps.length - 1}</span>}
                                </span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <Badge variant={VISIT_STATUS_VARIANT[visit.status] || 'neutral'}>{labelize(visit.status)}</Badge>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-neutral-50/50">
                              <td />
                              <td colSpan={6} className="px-4 py-4">
                                {visit.notes && (
                                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-800">Notes:</span> {visit.notes}</p>
                                )}
                                {visit.outcome && (
                                  <p className="mt-1 text-sm text-neutral-600"><span className="font-medium text-neutral-800">Outcome:</span> {visit.outcome}</p>
                                )}

                                {nextAction && (
                                  <Button
                                    type="button"
                                    variant={nextAction.kind === 'convert' ? undefined : 'outline'}
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => runVisitNextAction(nextAction)}
                                  >
                                    {nextAction.kind === 'convert' && <ArrowRightCircle className="mr-2 size-4" />}
                                    {nextAction.kind === 'convert'
                                      ? 'Convert to Customer'
                                      : nextAction.kind === 'viewCustomer'
                                        ? 'View Customer'
                                        : 'Add Follow-up'}
                                  </Button>
                                )}

                                {visit.followUps.map((task) => (
                                  <div key={task.id} className="mt-3 rounded-xl border border-neutral-100 bg-white p-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="font-semibold text-neutral-900">{task.title}</p>
                                      <Badge variant={task.status === 'completed' ? 'success' : 'warning'}>
                                        {task.status === 'completed' ? 'Completed' : 'Pending'}
                                      </Badge>
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-neutral-600 sm:grid-cols-3">
                                      <p><span className="font-medium text-neutral-800">Assignee:</span> {task.assignedToName || 'Not assigned'}</p>
                                      <p><span className="font-medium text-neutral-800">Due:</span> {formatVisitDateTime(task.dueDate)}</p>
                                      <p><span className="font-medium text-neutral-800">Priority:</span> {task.priority.toUpperCase()}</p>
                                    </div>
                                    {task.description && <p className="mt-2 whitespace-pre-line text-xs text-neutral-600">{task.description}</p>}
                                  </div>
                                ))}

                                {taskErrors[visit.id] && (
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5">
                                    <p className="text-sm text-red-700">{taskErrors[visit.id].error}</p>
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleRetryTaskCreation(visit.id)}>
                                      <RefreshCw className="mr-2 size-4" />
                                      Retry Task
                                    </Button>
                                  </div>
                                )}
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
        </div>
      </div>

      <ConvertLeadModal
        isOpen={Boolean(convertLeadId)}
        onClose={() => setConvertLeadId(null)}
        leadId={convertLeadId || ''}
        onConverted={applyLeadConverted}
      />
    </div>
  )
}
