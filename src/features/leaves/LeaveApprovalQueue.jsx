import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { LEAVE_TYPE_OPTIONS, approveLeave, listLeaves, rejectLeave } from '../../api/leaves'
import { useToast } from '../../components/ui/toastContext'
import { uniqueOptions } from '../../utils/filterOptions'

const statusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export default function LeaveApprovalQueue() {
  const { showToast } = useToast()
  const [leaveList, setLeaveList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState('all')

  const loadLeaves = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listLeaves({ status: 'pending' })

    if (!result.success) {
      setLeaveList([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setLeaveList(result.leaves)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadLeaves()
  }, [loadLeaves])

  const handleApprove = async (id) => {
    setIsActing(true)
    const result = await approveLeave(id)
    setIsActing(false)

    if (!result.success) {
      showToast({ title: 'Approval failed', message: result.error })
      return
    }

    setLeaveList((list) => list.filter((leave) => leave.id !== id))
    showToast({ title: 'Leave approved', message: `${result.leave.userName || 'Employee'}'s leave request has been approved.` })
  }

  const handleReject = async () => {
    if (!rejectTarget) return

    if (!rejectReason.trim()) {
      showToast({ title: 'Reason required', message: 'Enter a reason for rejecting this leave request.' })
      return
    }

    setIsActing(true)
    const result = await rejectLeave(rejectTarget.id, rejectReason.trim())
    setIsActing(false)

    if (!result.success) {
      showToast({ title: 'Rejection failed', message: result.error })
      return
    }

    setLeaveList((list) => list.filter((leave) => leave.id !== rejectTarget.id))
    showToast({ title: 'Leave rejected', message: `${result.leave.userName || 'Employee'}'s leave request has been rejected.` })
    setRejectTarget(null)
    setRejectReason('')
  }

  const employeeOptions = useMemo(() => uniqueOptions(leaveList, 'userName', 'All employees'), [leaveList])
  const filteredLeaves = useMemo(() => {
    if (employeeFilter === 'all') return leaveList
    return leaveList.filter((leave) => leave.userName === employeeFilter)
  }, [leaveList, employeeFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Leave Approval Queue</h1>
        <p className="mt-1 text-sm text-neutral-500">Approve or reject pending leave requests from staff</p>
      </div>

      <Card title="Pending Leave Requests">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          key={employeeFilter}
          renderToolbar={({ search, onSearchChange, resultCount, searchable }) => (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {searchable && (
                <div className="relative w-full max-w-xs">
                  <input
                    type="text"
                    value={search}
                    onChange={onSearchChange}
                    placeholder="Search pending leave requests..."
                    className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-4 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Select options={employeeOptions} value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="w-44" triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
                <p className="shrink-0 text-xs font-medium text-neutral-400">{resultCount} {resultCount === 1 ? 'result' : 'results'}</p>
              </div>
            </div>
          )}
          loading={isLoading}
          columns={[
            { key: 'userName', header: 'Employee', sortable: true },
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
          data={filteredLeaves}
          searchKeys={['userName', 'leaveType', 'reason']}
          searchPlaceholder="Search pending leave requests..."
          actions={(row) => [
            { label: 'Approve', icon: Check, onClick: () => handleApprove(row.id) },
            { label: 'Reject', icon: XCircle, onClick: () => setRejectTarget(row), danger: true },
          ]}
        />
      </Card>

      <Modal isOpen={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Leave Request">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Rejecting {rejectTarget?.userName || 'this employee'}'s {rejectTarget?.leaveType} leave request ({rejectTarget?.startDate} – {rejectTarget?.endDate}).
          </p>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Reason for rejection"
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={handleReject}>Reject</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
