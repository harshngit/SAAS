import { useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle, Clock, MapPin, RefreshCw, Users } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { listUsers } from '../../api/users'

const initialVisits = [
  {
    id: 1,
    customerName: 'Rajesh Kumar',
    checkIn: '2024-07-17 10:30 AM',
    checkOut: '2024-07-17 11:15 AM',
    notes: 'Discussed new product range, placed order for 100 units',
    followUpTaskStatus: 'not_required',
    followUpTaskError: '',
    followUpTask: null,
    followUpTaskDraft: null,
  },
  {
    id: 2,
    customerName: 'Priya Desai',
    checkIn: '2024-07-16 02:00 PM',
    checkOut: '2024-07-16 02:45 PM',
    notes: 'Follow-up on previous order, collected payment',
    followUpTaskStatus: 'not_required',
    followUpTaskError: '',
    followUpTask: null,
    followUpTaskDraft: null,
  },
]

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
    reminder: 'none',
  }
}

function emptyCheckInData() {
  return {
    customerName: '',
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

const reminderOptions = [
  { value: 'none', label: 'No reminder' },
  { value: '15m', label: '15 minutes before' },
  { value: '1h', label: '1 hour before' },
  { value: '1d', label: '1 day before' },
]

export default function VisitCheckIn() {
  const [visits, setVisits] = useState(initialVisits)
  const [isCheckIn, setIsCheckIn] = useState(true)
  const [checkInData, setCheckInData] = useState(emptyCheckInData)
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadStaff() {
      const result = await listUsers({ is_active: true })

      if (!isMounted) return

      setIsLoadingStaff(false)
      if (!result.success) {
        setStaffMembers([])
        return
      }

      const users = Array.isArray(result.users) ? result.users : []
      setStaffMembers(users)
    }

    loadStaff()

    return () => {
      isMounted = false
    }
  }, [])

  const assigneeOptions = useMemo(
    () =>
      staffMembers.map((user) => ({
        value: user.id,
        label: user.name || user.display_name || user.full_name || user.email || 'User',
      })),
    [staffMembers],
  )

  const activeVisit = visits.find((visit) => visit.id === activeVisitId)

  const createVisitTask = (visit, taskDraft) => {
    if (!taskDraft) {
      return { success: true, visit }
    }

    if (visit.followUpTask?.id) {
      return { success: true, visit }
    }

    if (!taskDraft.title.trim()) {
      return { success: false, error: 'Enter a task title.' }
    }

    if (!taskDraft.assigneeId) {
      return { success: false, error: 'Select an assignee for the follow-up task.' }
    }

    const assignee = staffMembers.find((user) => user.id === taskDraft.assigneeId)
    if (!assignee) {
      return { success: false, error: 'The selected assignee is no longer available.' }
    }

    const taskId = `visit-task-${visit.id}`
    const task = {
      id: taskId,
      visitId: visit.id,
      customerName: visit.customerName,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim(),
      dueDate: taskDraft.dueDate,
      dueTime: taskDraft.dueTime,
      assigneeId: taskDraft.assigneeId,
      assigneeName: assignee.name || assignee.display_name || assignee.email || 'Assigned user',
      priority: taskDraft.priority,
      reminder: taskDraft.reminder,
      status: 'open',
    }

    setVisits((current) =>
      current.map((entry) =>
        entry.id === visit.id
          ? {
              ...entry,
              followUpTaskStatus: 'linked',
              followUpTaskError: '',
              followUpTask: task,
              followUpTaskDraft: taskDraft,
            }
          : entry,
      ),
    )

    return { success: true, visit, task }
  }

  const handleCheckIn = (event) => {
    event.preventDefault()
    setFormError('')
    setFormMessage('')

    if (!checkInData.customerName.trim()) {
      setFormError('Enter a customer name.')
      return
    }

    const taskDraft = checkInData.createFollowUpTask
      ? {
          title: checkInData.title,
          description: checkInData.description,
          dueDate: checkInData.dueDate,
          dueTime: checkInData.dueTime,
          assigneeId: checkInData.assigneeId,
          priority: checkInData.priority,
          reminder: checkInData.reminder,
        }
      : null

    const newVisit = {
      id: Date.now(),
      customerName: checkInData.customerName.trim(),
      checkIn: new Date().toLocaleString(),
      checkOut: null,
      notes: checkInData.notes.trim(),
      followUpTaskStatus: taskDraft ? 'pending' : 'not_required',
      followUpTaskError: '',
      followUpTask: null,
      followUpTaskDraft: taskDraft,
    }

    setVisits((current) => [newVisit, ...current])
    setActiveVisitId(newVisit.id)
    setIsCheckIn(false)
    setCheckInData(emptyCheckInData())
    setFormMessage('Visit saved successfully.')

    if (taskDraft) {
      const taskResult = createVisitTask(newVisit, taskDraft)
      if (!taskResult.success) {
        setVisits((current) =>
          current.map((entry) =>
            entry.id === newVisit.id
              ? {
                  ...entry,
                  followUpTaskStatus: 'error',
                  followUpTaskError: taskResult.error,
                }
              : entry,
          ),
        )
        setFormMessage('Visit saved, but follow-up task needs a retry.')
        return
      }

      setFormMessage('Visit saved and follow-up task created.')
    }
  }

  const handleRetryTaskCreation = (visitId) => {
    const visit = visits.find((entry) => entry.id === visitId)
    if (!visit || !visit.followUpTaskDraft) return

    setFormError('')
    setFormMessage('')

    const result = createVisitTask(visit, visit.followUpTaskDraft)
    if (!result.success) {
      setVisits((current) =>
        current.map((entry) =>
          entry.id === visitId
            ? {
                ...entry,
                followUpTaskStatus: 'error',
                followUpTaskError: result.error,
              }
            : entry,
        ),
      )
      setFormError(result.error)
      return
    }

    setVisits((current) =>
      current.map((entry) =>
        entry.id === visitId
          ? {
              ...entry,
              followUpTaskStatus: 'linked',
              followUpTaskError: '',
            }
          : entry,
      ),
    )
    setFormMessage('Follow-up task created successfully.')
  }

  const handleCheckOut = (visitId, notes) => {
    setVisits((current) =>
      current.map((visit) =>
        visit.id === visitId
          ? { ...visit, checkOut: new Date().toLocaleString(), notes: notes || visit.notes }
          : visit,
      ),
    )
    setActiveVisitId(null)
    setIsCheckIn(true)
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
                  <Input
                    label="Customer Name"
                    value={checkInData.customerName}
                    onChange={(event) => setCheckInData((current) => ({ ...current, customerName: event.target.value }))}
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
                        placeholder={isLoadingStaff ? 'Loading employees...' : 'Select assignee'}
                        disabled={isLoadingStaff || !assigneeOptions.length}
                        required
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                          label="Priority"
                          options={taskPriorityOptions}
                          value={checkInData.priority}
                          onChange={(event) => setCheckInData((current) => ({ ...current, priority: event.target.value }))}
                          required
                        />
                        <Select
                          label="Reminder"
                          options={reminderOptions}
                          value={checkInData.reminder}
                          onChange={(event) => setCheckInData((current) => ({ ...current, reminder: event.target.value }))}
                        />
                      </div>
                      {!assigneeOptions.length && !isLoadingStaff && (
                        <p className="text-xs text-amber-700">No active employees are available to assign the task.</p>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoadingStaff}>
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
                      <p className="text-xs text-green-600">{activeVisit.checkIn}</p>
                    </div>
                    <Input
                      label="Check Out Notes"
                      as="textarea"
                      value={activeVisit.notes}
                      onChange={(event) =>
                        setVisits((current) =>
                          current.map((visit) =>
                            visit.id === activeVisitId ? { ...visit, notes: event.target.value } : visit,
                          ),
                        )
                      }
                    />
                    <Button onClick={() => handleCheckOut(activeVisit.id, activeVisit.notes)} className="w-full">
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
            {isLoadingStaff && (
              <span className="text-xs text-neutral-400">Loading employees for task assignees...</span>
            )}
          </div>
          {visits.map((visit) => (
            <Card key={visit.id}>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-neutral-900">{visit.customerName}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        In: {visit.checkIn}
                      </span>
                      {visit.checkOut && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Out: {visit.checkOut}
                        </span>
                      )}
                    </div>
                  </div>
                  {visit.checkOut ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      Active
                    </span>
                  )}
                </div>

                {visit.notes && (
                  <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
                    {visit.notes}
                  </p>
                )}

                {visit.followUpTaskDraft && (
                  <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">
                          Follow-up Task
                        </p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {visit.followUpTask?.title || visit.followUpTaskDraft.title}
                        </p>
                      </div>
                      {visit.followUpTaskStatus === 'linked' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle className="size-3.5" />
                          Linked
                        </span>
                      ) : visit.followUpTaskStatus === 'error' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          <Users className="size-3.5" />
                          Needs retry
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          <Calendar className="size-3.5" />
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-neutral-600 md:grid-cols-2">
                      <p>
                        <span className="font-medium text-neutral-800">Assignee:</span>{' '}
                        {visit.followUpTask?.assigneeName || 'Not assigned'}
                      </p>
                      <p>
                        <span className="font-medium text-neutral-800">Due:</span>{' '}
                        {visit.followUpTask
                          ? `${visit.followUpTask.dueDate} ${visit.followUpTask.dueTime}`
                          : `${visit.followUpTaskDraft.dueDate} ${visit.followUpTaskDraft.dueTime}`}
                      </p>
                      <p>
                        <span className="font-medium text-neutral-800">Priority:</span>{' '}
                        {(visit.followUpTask?.priority || visit.followUpTaskDraft.priority || '').toUpperCase()}
                      </p>
                      <p>
                        <span className="font-medium text-neutral-800">Reminder:</span>{' '}
                        {visit.followUpTask?.reminder || visit.followUpTaskDraft.reminder}
                      </p>
                    </div>
                    {visit.followUpTaskError && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {visit.followUpTaskError}
                      </div>
                    )}
                    {visit.followUpTaskStatus === 'error' && (
                      <div className="mt-3 flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleRetryTaskCreation(visit.id)}>
                          <RefreshCw className="mr-2 size-4" />
                          Retry Task
                        </Button>
                      </div>
                    )}
                    {visit.followUpTask?.description && (
                      <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                        {visit.followUpTask.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
