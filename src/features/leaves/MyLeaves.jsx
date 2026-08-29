import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Edit, Plus, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import {
  LEAVE_TYPE_OPTIONS,
  calculateDaysCount,
  createLeave,
  deleteLeave,
  getMyLeaves,
  updateLeave,
} from '../../api/leaves'
import { useToast } from '../../components/ui/toastContext'

const statusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

function emptyLeave() {
  return {
    leaveType: 'casual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  }
}

export default function MyLeaves() {
  const { showToast } = useToast()

  const [leaves, setLeaves] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingLeave, setEditingLeave] = useState(null)
  const [formData, setFormData] = useState(emptyLeave)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadLeaves = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await getMyLeaves()

    if (!result.success) {
      setLeaves([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setLeaves(result.leaves.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadLeaves()
  }, [loadLeaves])

  const openAddModal = () => {
    setEditingLeave(null)
    setFormData(emptyLeave())
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (leave) => {
    setEditingLeave(leave)
    setFormData({
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.startDate || !formData.endDate) {
      setFormError('Select a start and end date.')
      return
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setFormError('End date cannot be before the start date.')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    const result = editingLeave
      ? await updateLeave(editingLeave.id, formData)
      : await createLeave(formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({
      title: editingLeave ? 'Leave request updated' : 'Leave request submitted',
      message: editingLeave ? 'Your changes have been saved.' : 'Your request is now pending approval.',
    })
    setIsSubmitting(false)
    setShowModal(false)
    loadLeaves()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    const result = await deleteLeave(deleteTarget.id)
    setIsDeleting(false)

    if (!result.success) {
      showToast({ title: 'Cancel failed', message: result.error })
      return
    }

    setLeaves((current) => current.filter((leave) => leave.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast({ title: 'Leave request cancelled', message: 'The request has been withdrawn.' })
  }

  const previewDays = calculateDaysCount(formData.startDate, formData.endDate)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My Leaves</h1>
          <p className="mt-1 text-sm text-neutral-500">Apply for leave and track your requests</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="size-4" />
          Apply for Leave
        </Button>
      </div>

      <Card title="Leave History">
        {listError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'leaveType', header: 'Type', sortable: true, render: (row) => LEAVE_TYPE_OPTIONS.find((option) => option.value === row.leaveType)?.label || row.leaveType },
            { key: 'startDate', header: 'From', sortable: true },
            { key: 'endDate', header: 'To', sortable: true },
            { key: 'daysCount', header: 'Days', sortable: true, align: 'right' },
            { key: 'reason', header: 'Reason', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
          ]}
          data={leaves}
          searchKeys={['leaveType', 'reason', 'status']}
          searchPlaceholder="Search leave requests…"
          actions={(row) =>
            row.status === 'pending'
              ? [
                  { label: 'Edit', icon: Edit, onClick: () => openEditModal(row) },
                  { label: 'Cancel', icon: Trash2, danger: true, onClick: () => setDeleteTarget(row) },
                ]
              : []
          }
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title={editingLeave ? 'Edit Leave Request' : 'Apply for Leave'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}
          <Select
            label="Leave Type"
            value={formData.leaveType}
            onChange={(e) => setFormData((current) => ({ ...current, leaveType: e.target.value }))}
            options={LEAVE_TYPE_OPTIONS}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((current) => ({ ...current, startDate: e.target.value }))}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((current) => ({ ...current, endDate: e.target.value }))}
              required
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-3.5 py-2.5 text-sm font-medium text-primary-800">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {previewDays > 0 ? `${previewDays} day${previewDays === 1 ? '' : 's'}` : 'Select valid dates'}
          </div>
          <Input
            label="Reason"
            as="textarea"
            value={formData.reason}
            onChange={(e) => setFormData((current) => ({ ...current, reason: e.target.value }))}
            placeholder="Reason for leave (optional)"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editingLeave ? 'Save Changes' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Cancel Leave Request">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Withdraw this {deleteTarget?.leaveType} leave request ({deleteTarget?.startDate} – {deleteTarget?.endDate})?
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Keep Request</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Cancel Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
