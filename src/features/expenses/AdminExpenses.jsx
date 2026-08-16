import { useCallback, useEffect, useMemo, useState } from 'react'
import { Receipt, Clock, CheckCircle2, XCircle, Check } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import { approveExpense, listExpenses, rejectExpense } from '../../api/expenses'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const statusVariant = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
}

export default function AdminExpenses() {
  const { showToast } = useToast()
  const [expenseList, setExpenseList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isActing, setIsActing] = useState(false)

  const loadExpenses = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listExpenses()

    if (!result.success) {
      setExpenseList([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setExpenseList(result.expenses)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const handleApprove = async (id) => {
    setIsActing(true)
    const result = await approveExpense(id)
    setIsActing(false)

    if (!result.success) {
      showToast({ title: 'Approval failed', message: result.error, variant: 'error' })
      return
    }

    setExpenseList((list) => list.map((e) => (e.id === id ? result.expense : e)))
    showToast({ title: 'Expense approved', message: `Expense ${result.expense.expenseId} has been approved.` })
  }

  const handleReject = async () => {
    if (!rejectTarget) return

    setIsActing(true)
    const result = await rejectExpense(rejectTarget.id, rejectReason)
    setIsActing(false)

    if (!result.success) {
      showToast({ title: 'Rejection failed', message: result.error, variant: 'error' })
      return
    }

    setExpenseList((list) => list.map((e) => (e.id === rejectTarget.id ? result.expense : e)))
    showToast({ title: 'Expense rejected', message: `Expense ${result.expense.expenseId} has been rejected.` })
    setRejectTarget(null)
    setRejectReason('')
  }

  const stats = useMemo(() => {
    const pending = expenseList.filter((e) => e.approvalStatus === 'Pending')
    const approved = expenseList.filter((e) => e.approvalStatus === 'Approved')
    const rejected = expenseList.filter((e) => e.approvalStatus === 'Rejected')
    const totalAmount = expenseList.reduce((sum, e) => sum + e.amount, 0)
    return { pending, approved, rejected, totalAmount }
  }, [expenseList])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Expenses</h1>
        <p className="mt-1 text-sm text-neutral-500">Review and manage expenses submitted across your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} label="Total Expenses" value={formatCurrency(stats.totalAmount)} iconVariant="primary" />
        <StatCard icon={Clock} label="Pending" value={stats.pending.length} iconVariant="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats.approved.length} iconVariant="success" />
        <StatCard icon={XCircle} label="Rejected" value={stats.rejected.length} iconVariant="danger" />
      </div>

      <Card title="All Expenses" subtitle="Submitted by sales officers, delivery partners, and staff">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'expenseId', header: 'Expense ID', sortable: true },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'description', header: 'Description', sortable: true },
            { key: 'submittedByName', header: 'Submitted By', sortable: true },
            { key: 'expenseDate', header: 'Date', sortable: true },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'approvalStatus',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.approvalStatus] || 'neutral'} dot>{row.approvalStatus}</Badge>,
            },
          ]}
          data={expenseList}
          searchKeys={['expenseId', 'category', 'description', 'submittedByName']}
          searchPlaceholder="Search expenses…"
          actions={(row) =>
            row.approvalStatus === 'Pending'
              ? [
                  { label: 'Approve', icon: Check, onClick: () => handleApprove(row.id) },
                  { label: 'Reject', icon: XCircle, onClick: () => setRejectTarget(row), danger: true },
                ]
              : []
          }
        />
      </Card>

      <Modal isOpen={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Expense">
        <div className="space-y-4">
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Reason for rejection"
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
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
