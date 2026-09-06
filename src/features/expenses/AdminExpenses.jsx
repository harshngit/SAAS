import { useCallback, useEffect, useMemo, useState } from 'react'
import { Receipt, Clock, CheckCircle2, XCircle, Check, Wallet, Eye, HelpCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { usePermission } from '../../auth/usePermission'
import { approveExpense, listExpenses, rejectExpense, requestExpenseClarification } from '../../api/expenses'
import {
  DEMO_EXPENSES_ENABLED,
  demoExpensesResolved,
  simulateDemoApproveExpense,
  simulateDemoClarifyExpense,
  simulateDemoReimburseExpense,
  simulateDemoRejectExpense,
} from './expenseDemo'
import { formatCurrency, formatDate } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']

// A real expense reads "Reimbursed" ONLY when the backend returned payment_status = Paid.
function effectiveStatus(expense) {
  if (expense.approvalStatus === 'Approved' && expense.paymentStatus === 'Paid') return 'Reimbursed'
  return expense.approvalStatus || 'Pending'
}
const STATUS_VARIANT = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Reimbursed: 'primary',
  'Clarification Required': 'info',
}
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Clarification Required', label: 'Clarification Required' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Reimbursed', label: 'Reimbursed' },
]

export default function AdminExpenses() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const canApprove = can('expenses', 'approve')

  const [expenseList, setExpenseList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [reviewTarget, setReviewTarget] = useState(null) // { row, mode: 'reject' | 'clarify' }
  const [reviewReason, setReviewReason] = useState('')
  const [reimburseTarget, setReimburseTarget] = useState(null) // demo only
  const [reimburseMode, setReimburseMode] = useState('Bank Transfer')
  const [detailTarget, setDetailTarget] = useState(null)
  const [isActing, setIsActing] = useState(false)

  const loadExpenses = useCallback(async () => {
    setIsLoading(true)
    setError('')
    if (DEMO_EXPENSES_ENABLED) {
      setExpenseList(demoExpensesResolved())
      setIsLoading(false)
      return
    }
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

  const replace = (updated) => setExpenseList((list) => list.map((e) => (e.id === updated.id ? updated : e)))

  const handleApprove = async (row) => {
    setIsActing(true)
    if (DEMO_EXPENSES_ENABLED) {
      replace(simulateDemoApproveExpense(row.id))
      setIsActing(false)
      showToast({ title: 'Expense approved', message: `${row.expenseNumber || row.expenseId} has been approved.` })
      return
    }
    const result = await approveExpense(row.id)
    setIsActing(false)
    if (!result.success) {
      showToast({ title: 'Approval failed', message: result.error, variant: 'error' })
      return
    }
    replace(result.expense)
    showToast({ title: 'Expense approved', message: `${row.expenseNumber || row.expenseId} has been approved.` })
  }

  const submitReview = async () => {
    if (!reviewTarget) return
    if (!reviewReason.trim()) {
      showToast({ title: 'Reason required', message: 'A reason is required.', variant: 'error' })
      return
    }
    const { row, mode } = reviewTarget
    setIsActing(true)

    if (DEMO_EXPENSES_ENABLED) {
      replace(mode === 'reject'
        ? simulateDemoRejectExpense(row.id, reviewReason.trim())
        : simulateDemoClarifyExpense(row.id, reviewReason.trim()))
      setIsActing(false)
      showToast({
        title: mode === 'reject' ? 'Expense rejected' : 'Clarification requested',
        message: `${row.expenseNumber || row.expenseId}`,
      })
      setReviewTarget(null)
      setReviewReason('')
      return
    }

    const result = mode === 'reject'
      ? await rejectExpense(row.id, reviewReason.trim())
      : await requestExpenseClarification(row.id, reviewReason.trim())
    setIsActing(false)
    if (!result.success) {
      showToast({ title: 'Action failed', message: result.error, variant: 'error' })
      return
    }
    replace(result.expense)
    showToast({
      title: mode === 'reject' ? 'Expense rejected' : 'Clarification requested',
      message: `${row.expenseNumber || row.expenseId}`,
    })
    setReviewTarget(null)
    setReviewReason('')
  }

  const handleDemoReimburse = () => {
    if (!reimburseTarget) return
    setIsActing(true)
    replace(simulateDemoReimburseExpense(reimburseTarget.id, reimburseMode))
    setIsActing(false)
    showToast({ title: 'Reimbursement recorded (demo)', message: `${reimburseTarget.expenseNumber || reimburseTarget.expenseId} marked reimbursed.` })
    setReimburseTarget(null)
  }

  const stats = useMemo(() => {
    const pending = expenseList.filter((e) => e.approvalStatus === 'Pending' || e.approvalStatus === 'Clarification Required')
    const approvedRows = expenseList.filter((e) => e.approvalStatus === 'Approved')
    // §29 - never count rejected toward spend totals.
    const totalAmount = expenseList
      .filter((e) => e.approvalStatus !== 'Rejected')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const reimbursedAmount = approvedRows
      .filter((e) => e.paymentStatus === 'Paid')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    return { pending, approved: approvedRows, totalAmount, reimbursedAmount }
  }, [expenseList])

  const rows = useMemo(() => {
    if (statusFilter === 'all') return expenseList
    return expenseList.filter((e) => effectiveStatus(e) === statusFilter)
  }, [expenseList, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Expenses</h1>
        <p className="mt-1 text-sm text-neutral-500">Review and manage organization expenses.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} label="Total Expenses" value={formatCurrency(stats.totalAmount)} iconVariant="primary" />
        <StatCard icon={Clock} label="Pending Review" value={stats.pending.length} iconVariant="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats.approved.length} iconVariant="success" />
        <StatCard icon={Wallet} label="Reimbursed" value={formatCurrency(stats.reimbursedAmount)} iconVariant="info" />
      </div>

      <Card title="All Expenses" subtitle="Submitted by sales officers, delivery partners, and staff">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div className="mb-4 flex justify-end">
          <Select options={FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="sm:w-52" />
        </div>
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'expenseNumber', header: 'Expense #', sortable: true, render: (row) => row.expenseNumber || row.expenseId || '—' },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'description', header: 'Description', sortable: true },
            { key: 'submittedByName', header: 'Submitted By', sortable: true, render: (row) => row.submittedByName || '—' },
            { key: 'expenseDate', header: 'Date', sortable: true, render: (row) => formatDate(row.expenseDate) },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => {
                const s = effectiveStatus(row)
                return <Badge variant={STATUS_VARIANT[s] || 'neutral'} dot>{s}</Badge>
              },
            },
          ]}
          data={rows}
          searchKeys={['expenseNumber', 'expenseId', 'category', 'description', 'submittedByName']}
          searchPlaceholder="Search expenses…"
          actions={(row) => {
            const list = [{ label: 'Details', icon: Eye, onClick: () => setDetailTarget(row) }]
            const reviewable = row.approvalStatus === 'Pending' || row.approvalStatus === 'Clarification Required'
            if (canApprove && reviewable) {
              list.push(
                { label: 'Approve', icon: Check, onClick: () => handleApprove(row) },
                { label: 'Request Clarification', icon: HelpCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'clarify' }) } },
                { label: 'Reject', icon: XCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'reject' }) }, danger: true },
              )
            }
            // Reimbursement is demo-only - there is no real endpoint for it.
            if (DEMO_EXPENSES_ENABLED && row.approvalStatus === 'Approved' && row.paymentStatus !== 'Paid') {
              list.push({ label: 'Record Reimbursement (demo)', icon: Wallet, onClick: () => { setReimburseMode('Bank Transfer'); setReimburseTarget(row) } })
            }
            return list
          }}
        />
        {!DEMO_EXPENSES_ENABLED && (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Reimbursement processing will be available after the finance backend is added. Approved expenses stay
            <span className="font-medium"> Approved · Reimbursement Pending</span> until then.
          </p>
        )}
      </Card>

      <Modal
        isOpen={Boolean(reviewTarget)}
        onClose={() => !isActing && setReviewTarget(null)}
        title={reviewTarget?.mode === 'reject' ? 'Reject Expense' : 'Request Clarification'}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {reviewTarget?.mode === 'reject'
              ? 'The expense will be rejected and the submitter notified with this reason.'
              : 'The submitter is asked to correct or add information. The expense returns to Pending once they update it — it is not rejected.'}
          </p>
          <textarea
            value={reviewReason}
            onChange={(event) => setReviewReason(event.target.value)}
            placeholder={reviewTarget?.mode === 'reject' ? 'Reason for rejection (required)' : 'What does the submitter need to fix? (required)'}
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              type="button"
              variant={reviewTarget?.mode === 'reject' ? 'danger' : 'primary'}
              loading={isActing}
              onClick={submitReview}
            >
              {reviewTarget?.mode === 'reject' ? 'Reject' : 'Send Request'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(reimburseTarget)} onClose={() => !isActing && setReimburseTarget(null)} title="Record Reimbursement (demo)">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Demo simulation only — there is no real reimbursement endpoint. Marks
            {' '}{reimburseTarget?.expenseNumber || reimburseTarget?.expenseId} ({formatCurrency(reimburseTarget?.amount || 0)}) as reimbursed.
          </p>
          <Select label="Payment Mode" options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} value={reimburseMode} onChange={(event) => setReimburseMode(event.target.value)} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setReimburseTarget(null)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={handleDemoReimburse}>Mark Reimbursed</Button>
          </div>
        </div>
      </Modal>

      <ExpenseDetailModal expense={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  )
}

function ExpenseDetailModal({ expense, onClose }) {
  return (
    <Modal isOpen={Boolean(expense)} onClose={onClose} title="Expense" size="lg">
      {expense && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <DField label="Expense #" value={expense.expenseNumber || expense.expenseId || '—'} />
            <DField label="Status" value={<Badge variant={STATUS_VARIANT[effectiveStatus(expense)] || 'neutral'} dot>{effectiveStatus(expense)}</Badge>} />
            <DField label="Category" value={expense.category || '—'} />
            <DField label="Amount" value={formatCurrency(expense.amount)} />
            <DField label="Expense Date" value={formatDate(expense.expenseDate)} />
            <DField label="Payment Mode" value={expense.paymentMode || '—'} />
            <DField label="Submitted By" value={expense.submittedByName || '—'} />
            <DField label="Submitted On" value={formatDate(expense.createdAt)} />
          </div>
          <DField label="Description" value={expense.description || '—'} />
          <div className="grid grid-cols-2 gap-3">
            <DField label="Approval" value={expense.approvalStatus || '—'} />
            <DField label="Reimbursement" value={expense.paymentStatus === 'Paid' ? 'Paid' : 'Pending'} />
          </div>
          {(expense.approvalStatus === 'Rejected' || expense.approvalStatus === 'Clarification Required') && expense.rejectReason && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">{expense.approvalStatus === 'Rejected' ? 'Rejection reason:' : 'Clarification requested:'}</span>{' '}
              {expense.rejectReason}
            </div>
          )}
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Expense reimbursement is separate from Supplier / Customer payments and does not change inventory.
          </p>
        </div>
      )}
    </Modal>
  )
}

function DField({ label, value }) {
  return (
    <div>
      <p className="text-[0.7rem] text-neutral-400">{label}</p>
      <div className="font-medium text-neutral-900">{value}</div>
    </div>
  )
}
