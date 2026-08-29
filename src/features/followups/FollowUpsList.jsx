import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Edit, Trash2, Calendar, CheckCircle, RotateCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import {
  completeFollowUp,
  createFollowUp,
  deleteFollowUp,
  FOLLOW_UP_PRIORITY_OPTIONS,
  listFollowUps,
  updateFollowUp,
} from '../../api/followups'
import { listCustomers } from '../../api/customers'
import { listAssignableStaff } from '../../api/users'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyFormData() {
  return {
    customerId: '',
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
  const currentUser = useAuthStore((state) => state.currentUser)

  const [followUps, setFollowUps] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [customers, setCustomers] = useState([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actingId, setActingId] = useState('')

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

    setFollowUps(result.followUps.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)))
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
  }, [])

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )
  const assigneeOptions = useMemo(
    () => staffMembers.map((user) => ({ value: user.id, label: user.name })),
    [staffMembers],
  )

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
    setFormData({
      customerId: followUp.customerId,
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

    if (!formData.customerId) {
      setFormError('Select a customer for this follow-up.')
      return
    }
    if (!formData.title.trim()) {
      setFormError('Enter a task title.')
      return
    }

    setIsSaving(true)
    setFormError('')

    const dueDate = `${formData.dueDate}T${formData.dueTime}:00`
    const payload = {
      customerId: formData.customerId,
      title: formData.title,
      description: formData.description,
      dueDate,
      priority: formData.priority,
      assigneeId: formData.assigneeId || undefined,
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

  const toggleStatus = async (followUp) => {
    if (followUp.status === 'completed') return

    setActingId(followUp.id)
    const result = await completeFollowUp(followUp.id)
    setActingId('')

    if (!result.success) {
      showToast({ title: 'Unable to complete task', message: result.error })
      return
    }

    setFollowUps((current) => current.map((entry) => (entry.id === followUp.id ? result.followUp : entry)))
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
      ) : followUps.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-sm text-neutral-500">No follow-up tasks yet. Add one above to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {followUps.map((followUp) => (
            <Card key={followUp.id} className={`hover:shadow-lg transition-all ${followUp.status === 'completed' ? 'opacity-75' : ''}`}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${followUp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {followUp.status === 'completed' ? <CheckCircle className="size-5" /> : <Calendar className="size-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">{followUp.customerName || followUp.title}</h3>
                      <p className="text-xs text-neutral-500">{formatDueDate(followUp.dueDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleStatus(followUp)}
                      disabled={actingId === followUp.id || followUp.status === 'completed'}
                      className="p-2 text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-40"
                      title="Mark completed"
                    >
                      <CheckCircle className="size-4" />
                    </button>
                    <button
                      onClick={() => handleEditFollowUp(followUp)}
                      className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <Edit className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(followUp)}
                      className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-4 font-medium text-neutral-800">{followUp.title}</p>
                {followUp.description && <p className="mt-1 text-sm text-neutral-600">{followUp.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${followUp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {followUp.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{followUp.priority}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'}>
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}
          <Select
            label="Customer"
            options={customerOptions}
            value={formData.customerId}
            onChange={(event) => setFormData((current) => ({ ...current, customerId: event.target.value }))}
            placeholder={isLoadingCustomers ? 'Loading customers...' : 'Select customer'}
            disabled={isLoadingCustomers}
            searchable
            required
          />
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
