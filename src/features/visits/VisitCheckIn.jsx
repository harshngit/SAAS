import { useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle, Clock, MapPin, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listUsers } from '../../api/users'
import { listCustomers } from '../../api/customers'
import { createVisit, createVisitFollowUp, listVisits, updateVisit } from '../../api/visits'
import { useAuthStore } from '../../store/authStore'
import { ROLES } from '../../auth/roles'

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
    customerId: '',
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

  const [visits, setVisits] = useState([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isCheckIn, setIsCheckIn] = useState(true)
  const [checkInData, setCheckInData] = useState(emptyCheckInData)
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [customers, setCustomers] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [isSavingVisit, setIsSavingVisit] = useState(false)
  const [isSavingCheckout, setIsSavingCheckout] = useState(false)
  // Only tracks visits whose follow-up task creation FAILED and needs a manual retry -
  // successfully created tasks live on visit.followUps (server truth), not here.
  const [taskErrors, setTaskErrors] = useState({})

  const loadVisits = async () => {
    setIsLoadingVisits(true)
    setLoadError('')

    const result = currentUser?.id ? await listVisits({ userId: currentUser.id }) : await listVisits()

    if (!result.success) {
      setLoadError(result.error)
      setIsLoadingVisits(false)
      return
    }

    setVisits(result.visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)))
    setIsLoadingVisits(false)
  }

  useEffect(() => {
    loadVisits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      // GET /users is admin-only and 403s for every other role - a non-admin can't list org-wide
      // staff anyway, so they just get "assign to me" instead of a doomed request.
      const usersPromise = currentUser?.role === ROLES.ADMIN ? listUsers({ is_active: true }) : Promise.resolve({ success: true, users: [] })
      const [usersResult, customersResult] = await Promise.all([
        usersPromise,
        listCustomers(),
      ])

      if (!isMounted) return

      setIsLoadingOptions(false)
      if (currentUser?.role !== ROLES.ADMIN) {
        setStaffMembers(
          currentUser?.id ? [{ id: currentUser.id, name: currentUser.name || 'Me', email: currentUser.email }] : [],
        )
      } else if (usersResult.success) {
        setStaffMembers(Array.isArray(usersResult.users) ? usersResult.users : [])
      }
      if (customersResult.success) setCustomers(customersResult.customers)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.role])

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

  const activeVisit = visits.find((visit) => visit.id === activeVisitId)

  const handleCheckIn = async (event) => {
    event.preventDefault()
    setFormError('')
    setFormMessage('')

    if (!checkInData.customerId) {
      setFormError('Select a customer for this visit.')
      return
    }

    if (checkInData.createFollowUpTask && !checkInData.title.trim()) {
      setFormError('Enter a follow-up task title.')
      return
    }

    setIsSavingVisit(true)

    const result = await createVisit({
      customerId: checkInData.customerId,
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
    setIsCheckIn(false)
    setIsSavingVisit(false)
    setFormMessage('Visit saved successfully.')

    if (checkInData.createFollowUpTask) {
      const dueDate = `${checkInData.dueDate}T${checkInData.dueTime}:00`
      const taskResult = await createVisitFollowUp(visit.id, {
        customerId: checkInData.customerId,
        title: checkInData.title,
        description: checkInData.description,
        dueDate,
        priority: checkInData.priority,
        assigneeId: checkInData.assigneeId,
      })

      if (!taskResult.success) {
        setTaskErrors((current) => ({
          ...current,
          [visit.id]: { draft: { ...checkInData, dueDate }, error: taskResult.error },
        }))
        setFormMessage('Visit saved, but the follow-up task needs a retry.')
      } else {
        setVisits((current) =>
          current.map((entry) => (entry.id === visit.id ? { ...entry, followUps: [...entry.followUps, taskResult.followUp] } : entry)),
        )
        setFormMessage('Visit saved and follow-up task created.')
      }
    }

    setCheckInData(emptyCheckInData())
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

  const handleCheckOut = async (visitId, notes) => {
    setIsSavingCheckout(true)
    setFormError('')

    const result = await updateVisit(visitId, { status: 'completed', outcome: notes || '' })

    setIsSavingCheckout(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setVisits((current) => current.map((visit) => (visit.id === visitId ? { ...visit, ...result.visit, followUps: visit.followUps } : visit)))
    setActiveVisitId(null)
    setIsCheckIn(true)
    setFormMessage('Visit checked out successfully.')
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
                    label="Customer"
                    options={customerOptions}
                    value={checkInData.customerId}
                    onChange={(event) => setCheckInData((current) => ({ ...current, customerId: event.target.value }))}
                    placeholder={isLoadingOptions ? 'Loading customers...' : 'Select customer'}
                    disabled={isLoadingOptions}
                    searchable
                    required
                  />

                  <Input
                    label="Visit Notes"
                    as="textarea"
                    value={checkInData.notes}
                    onChange={(event) => setCheckInData((current) => ({ ...current, notes: event.target.value }))}
                  />

                  <label className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3.5 py-3 text-sm font-medium text-neutral-800">
                    <input
                      type="checkbox"
                      checked={checkInData.createFollowUpTask}
                      onChange={(event) =>
                        setCheckInData((current) => ({
                          ...current,
                          createFollowUpTask: event.target.checked,
                          ...(event.target.checked ? {} : emptyTaskFields()),
                        }))
                      }
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    Create Follow-up Task
                  </label>

                  {checkInData.createFollowUpTask && (
                    <div className="space-y-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
                      <Input
                        label="Task Title"
                        value={checkInData.title}
                        onChange={(event) => setCheckInData((current) => ({ ...current, title: event.target.value }))}
                        required
                      />
                      <Input
                        label="Description"
                        as="textarea"
                        value={checkInData.description}
                        onChange={(event) => setCheckInData((current) => ({ ...current, description: event.target.value }))}
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                          label="Due Date"
                          type="date"
                          value={checkInData.dueDate}
                          onChange={(event) => setCheckInData((current) => ({ ...current, dueDate: event.target.value }))}
                          required
                        />
                        <Input
                          label="Due Time"
                          type="time"
                          value={checkInData.dueTime}
                          onChange={(event) => setCheckInData((current) => ({ ...current, dueTime: event.target.value }))}
                          required
                        />
                      </div>
                      <Select
                        label="Assignee"
                        options={assigneeOptions}
                        value={checkInData.assigneeId}
                        onChange={(event) => setCheckInData((current) => ({ ...current, assigneeId: event.target.value }))}
                        placeholder={isLoadingOptions ? 'Loading employees...' : 'Defaults to you if left blank'}
                        disabled={isLoadingOptions}
                      />
                      <Select
                        label="Priority"
                        options={taskPriorityOptions}
                        value={checkInData.priority}
                        onChange={(event) => setCheckInData((current) => ({ ...current, priority: event.target.value }))}
                        required
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full" loading={isSavingVisit} disabled={isLoadingOptions}>
                    <MapPin className="mr-2 size-4" />
                    Check In
                  </Button>
                </form>
              ) : (
                activeVisit && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle className="size-5 text-green-700" />
                        <span className="font-semibold text-green-800">Checked In</span>
                      </div>
                      <p className="mb-1 text-sm text-green-700">{activeVisit.customerName}</p>
                      <p className="text-xs text-green-600">{formatVisitDateTime(activeVisit.visitDate)}</p>
                    </div>
                    <Input
                      label="Check Out Notes / Outcome"
                      as="textarea"
                      value={activeVisit.outcome || activeVisit.notes}
                      onChange={(event) =>
                        setVisits((current) =>
                          current.map((visit) =>
                            visit.id === activeVisitId ? { ...visit, outcome: event.target.value } : visit,
                          ),
                        )
                      }
                    />
                    <Button onClick={() => handleCheckOut(activeVisit.id, activeVisit.outcome)} className="w-full" loading={isSavingCheckout}>
                      <CheckCircle className="mr-2 size-4" />
                      Check Out
                    </Button>
                  </div>
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
            visits.map((visit) => (
              <Card key={visit.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-neutral-900">{visit.customerName || 'Unknown customer'}</h4>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Visit: {formatVisitDateTime(visit.visitDate)}
                        </span>
                      </div>
                    </div>
                    {visit.status === 'completed' ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Completed
                      </span>
                    ) : visit.status === 'cancelled' ? (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
                        Cancelled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        Planned
                      </span>
                    )}
                  </div>

                  {visit.notes && (
                    <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
                      {visit.notes}
                    </p>
                  )}
                  {visit.outcome && (
                    <p className="mt-2 text-sm text-neutral-500"><span className="font-medium text-neutral-700">Outcome:</span> {visit.outcome}</p>
                  )}

                  {visit.followUps.map((task) => (
                    <div key={task.id} className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">
                            Follow-up Task
                          </p>
                          <p className="mt-1 font-semibold text-neutral-900">{task.title}</p>
                        </div>
                        {task.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle className="size-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            <Calendar className="size-3.5" />
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-neutral-600 md:grid-cols-2">
                        <p><span className="font-medium text-neutral-800">Assignee:</span> {task.assignedToName || 'Not assigned'}</p>
                        <p><span className="font-medium text-neutral-800">Due:</span> {formatVisitDateTime(task.dueDate)}</p>
                        <p><span className="font-medium text-neutral-800">Priority:</span> {task.priority.toUpperCase()}</p>
                      </div>
                      {task.description && (
                        <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm text-neutral-600">{task.description}</p>
                      )}
                    </div>
                  ))}

                  {taskErrors[visit.id] && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-red-700">{taskErrors[visit.id].error}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleRetryTaskCreation(visit.id)}>
                          <RefreshCw className="mr-2 size-4" />
                          Retry Task
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
