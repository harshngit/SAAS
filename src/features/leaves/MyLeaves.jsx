import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Eye, Plus } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { LEAVE_TYPE_OPTIONS, calculateDaysCount, createLeave, deleteLeave, getMyLeaves } from '../../api/leaves'
import { useToast } from '../../components/ui/toastContext'
import { formatDate, formatDateTime } from '../../utils/format'
import { demoLeavesResolved, simulateDemoCancelLeave, simulateDemoCreateLeave } from './leaveDemo'

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral' }
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]
const typeLabel = (value) => LEAVE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value

const emptyForm = () => ({
  leaveType: 'casual',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  reason: '',
})

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd)

function DetailModal({ leave, onClose }) {
  return (
    <Modal isOpen={Boolean(leave)} onClose={onClose} title="Leave request" size="lg">
      {leave && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leave Type" value={typeLabel(leave.leaveType)} />
            <Field label="Status" value={<Badge variant={STATUS_VARIANT[leave.status] || 'neutral'} dot>{leave.status}</Badge>} />
            <Field label="Start Date" value={formatDate(leave.startDate)} />
            <Field label="End Date" value={formatDate(leave.endDate)} />
            <Field label="Number of Days" value={leave.daysCount || calculateDaysCount(leave.startDate, leave.endDate)} />
            <Field label="Requested At" value={leave.createdAt ? formatDateTime(leave.createdAt) : '—'} />
          </div>
          <Field label="Reason" value={leave.reason || '—'} />
          {leave.status !== 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reviewed By" value={leave.approverName || '—'} />
              <Field label="Reviewed At" value={leave.updatedAt ? formatDateTime(leave.updatedAt) : '—'} />
            </div>
          )}
          {leave.status === 'rejected' && leave.rejectReason && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
              <span className="font-semibold">Rejection reason:</span> {leave.rejectReason}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[0.7rem] text-neutral-400">{label}</p>
      <div className="font-medium text-neutral-900">{value}</div>
    </div>
  )
}

export default function MyLeaves() {
  const { showToast } = useToast()

  const [leaves, setLeaves] = useState([])
  const [demo, setDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [filter, setFilter] = useState('all')

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [detailLeave, setDetailLeave] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setListError('')
    const result = await getMyLeaves()

    if (!result.success) {
      setDemo(false)
      setLeaves([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    if (result.leaves.length === 0) {
      // No real requests yet - show the demo world so the flow stays testable.
      setDemo(true)
      setLeaves(demoLeavesResolved())
      setIsLoading(false)
      return
    }

    setDemo(false)
    setLeaves(result.leaves.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(
    () => ({
      pending: leaves.filter((l) => l.status === 'pending').length,
      approved: leaves.filter((l) => l.status === 'approved').length,
      rejected: leaves.filter((l) => l.status === 'rejected').length,
    }),
    [leaves],
  )

  const filtered = useMemo(
    () => (filter === 'all' ? leaves : leaves.filter((l) => l.status === filter)),
    [leaves, filter],
  )

  const previewDays = calculateDaysCount(formData.startDate, formData.endDate)
  const overlaps = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return false
    return leaves.some(
      (l) =>
        ['pending', 'approved'].includes(l.status) &&
        rangesOverlap(formData.startDate, formData.endDate, l.startDate, l.endDate),
    )
  }, [formData.startDate, formData.endDate, leaves])

  const openForm = () => {
    setFormData(emptyForm())
    setFormError('')
    setShowForm(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formData.startDate || !formData.endDate) return setFormError('Select a start and end date.')
    if (new Date(formData.endDate) < new Date(formData.startDate)) return setFormError('End date cannot be before the start date.')
    if (!formData.reason.trim()) return setFormError('Add a reason for the leave.')

    setIsSubmitting(true)
    setFormError('')

    if (demo) {
      simulateDemoCreateLeave(formData)
      setLeaves(demoLeavesResolved())
      setIsSubmitting(false)
      setShowForm(false)
      showToast({ title: 'Leave request submitted (demo)', message: 'Your request is now pending.' })
      return
    }

    const result = await createLeave(formData)
    if (!result.success) {
      setFormError(result.error)
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    setShowForm(false)
    showToast({ title: 'Leave request submitted', message: 'Your request is now pending approval.' })
    load()
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setIsCancelling(true)

    if (demo) {
      simulateDemoCancelLeave(cancelTarget.id)
      setLeaves(demoLeavesResolved())
      setIsCancelling(false)
      setCancelTarget(null)
      showToast({ title: 'Leave request cancelled (demo)', message: 'The request has been withdrawn.' })
      return
    }

    const result = await deleteLeave(cancelTarget.id)
    setIsCancelling(false)
    if (!result.success) {
      showToast({ title: 'Cancel failed', message: result.error })
      return
    }
    setLeaves((current) => current.filter((l) => l.id !== cancelTarget.id))
    setCancelTarget(null)
    showToast({ title: 'Leave request cancelled', message: 'The request has been withdrawn.' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Leaves</h1>
          <p className="mt-1 text-sm text-neutral-500">View and manage your leave requests.</p>
        </div>
        <Button onClick={openForm}>
          <Plus className="size-4" aria-hidden="true" />
          Apply Leave
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ['Pending', counts.pending],
          ['Approved', counts.approved],
          ['Rejected', counts.rejected],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <p className="text-2xl font-semibold text-neutral-900">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="p-0" bodyClassName="p-0">
        {isLoading ? (
          <div className="p-6"><LoadingSpinner label="Loading your leave requests..." /></div>
        ) : listError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarDays}
              title={leaves.length === 0 ? 'No leave requests yet' : 'Nothing in this filter'}
              description={leaves.length === 0 ? 'Apply for leave and track its status here.' : 'Try a different status filter.'}
            />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Date Range</th>
                    <th className="px-4 py-3 text-right">Days</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Requested On</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filtered.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{typeLabel(l.leaveType)}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(l.startDate)} – {formatDate(l.endDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">{l.daysCount || calculateDaysCount(l.startDate, l.endDate)}</td>
                      <td className="max-w-64 truncate px-4 py-3 text-neutral-600" title={l.reason}>{l.reason || '—'}</td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[l.status] || 'neutral'} dot>{l.status}</Badge></td>
                      <td className="px-4 py-3 text-neutral-500">{l.createdAt ? formatDate(l.createdAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDetailLeave(l)}>
                            <Eye className="size-4" aria-hidden="true" />
                            Details
                          </Button>
                          {l.status === 'pending' && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setCancelTarget(l)}>Cancel</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="divide-y divide-neutral-100 md:hidden">
              {filtered.map((l) => (
                <div key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">{typeLabel(l.leaveType)}</p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(l.startDate)} – {formatDate(l.endDate)} · {l.daysCount || calculateDaysCount(l.startDate, l.endDate)}d
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[l.status] || 'neutral'} dot>{l.status}</Badge>
                  </div>
                  {l.reason && <p className="mt-2 text-xs text-neutral-500">{l.reason}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailLeave(l)}>Details</Button>
                    {l.status === 'pending' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCancelTarget(l)}>Cancel</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Apply Leave */}
      <Modal isOpen={showForm} onClose={() => !isSubmitting && setShowForm(false)} title="Apply Leave">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Select
            label="Leave Type"
            value={formData.leaveType}
            onChange={(e) => setFormData((c) => ({ ...c, leaveType: e.target.value }))}
            options={LEAVE_TYPE_OPTIONS}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((c) => ({ ...c, startDate: e.target.value }))}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              min={formData.startDate}
              onChange={(e) => setFormData((c) => ({ ...c, endDate: e.target.value }))}
              required
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-3.5 py-2.5 text-sm font-medium text-primary-800">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {previewDays > 0 ? `${previewDays} day${previewDays === 1 ? '' : 's'}` : 'Select valid dates'}
          </div>
          {overlaps && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              You already have a leave request covering these dates.
            </p>
          )}
          <Input
            label="Reason"
            as="textarea"
            value={formData.reason}
            onChange={(e) => setFormData((c) => ({ ...c, reason: e.target.value }))}
            placeholder="Reason for leave"
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Submit Request</Button>
          </div>
        </form>
      </Modal>

      <DetailModal leave={detailLeave} onClose={() => setDetailLeave(null)} />

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel leave request" size="md">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Withdraw this {cancelTarget ? typeLabel(cancelTarget.leaveType) : ''} leave request
            {cancelTarget ? ` (${formatDate(cancelTarget.startDate)} – ${formatDate(cancelTarget.endDate)})` : ''}?
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCancelTarget(null)}>Keep Request</Button>
            <Button type="button" variant="danger" loading={isCancelling} onClick={handleCancel}>Cancel Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
