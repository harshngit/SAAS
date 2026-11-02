import { ListOverview, ListSummary, ListDataTable as DataTable, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Receipt, Clock, CheckCircle2, XCircle, Check, Wallet, Eye, HelpCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { usePermission } from '../../auth/usePermission'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'
import { approveExpense, listExpenses, rejectExpense, requestExpenseClarification } from '../../api/expenses'
import {
  DEMO_EXPENSES_ENABLED,
  demoExpensesResolved,
  simulateDemoApproveExpense,
  simulateDemoClarifyExpense,
  simulateDemoReimburseExpense,
  simulateDemoRejectExpense,
} from './expenseDemo'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import ExpenseProof from './ExpenseProof'
import ExpenseHistory from './ExpenseHistory'
import ReimburseExpenseModal from './ReimburseExpenseModal'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']

// lifecycleStatus (new source of truth) drives the displayed status; this falls back to the
// old inference only for rows that somehow don't carry it yet.
function effectiveStatus(expense) {
  if (expense.lifecycleStatus === 'reimbursed') return 'Reimbursed'
  if (expense.lifecycleStatus === 'approved' || (expense.approvalStatus === 'Approved' && expense.paymentStatus !== 'Paid')) return 'Approved'
  if (expense.lifecycleStatus === 'rejected') return 'Rejected'
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
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [submittedByFilter, setSubmittedByFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || submittedByFilter !== 'all' || datePreset !== 'all'
  const clearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSubmittedByFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
  }

  const [reviewTarget, setReviewTarget] = useState(null) // { row, mode: 'reject' | 'clarify' }
  const [reviewReason, setReviewReason] = useState('')
  const [reimburseTarget, setReimburseTarget] = useState(null) // real reimbursement flow
  const [demoReimburseTarget, setDemoReimburseTarget] = useState(null)
  const [demoReimburseMode, setDemoReimburseMode] = useState('Bank Transfer')
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
    if (!demoReimburseTarget) return
    setIsActing(true)
    replace(simulateDemoReimburseExpense(demoReimburseTarget.id, demoReimburseMode))
    setIsActing(false)
    showToast({ title: 'Reimbursement recorded (demo)', message: `${demoReimburseTarget.expenseNumber || demoReimburseTarget.expenseId} marked reimbursed.` })
    setDemoReimburseTarget(null)
  }

  const handleReimbursed = (updatedExpense) => {
    replace(updatedExpense)
    setReimburseTarget(null)
    showToast({ title: 'Expense reimbursed', message: `${updatedExpense.expenseNumber || updatedExpense.expenseId} has been marked reimbursed.` })
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

  const categoryOptions = useMemo(() => uniqueOptions(expenseList, 'category', 'All categories'), [expenseList])
  const submittedByOptions = useMemo(() => uniqueOptions(expenseList, 'submittedByName', 'All submitters'), [expenseList])

  const rows = useMemo(() => {
    return expenseList.filter((e) => {
      if (statusFilter !== 'all' && effectiveStatus(e) !== statusFilter) return false
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (submittedByFilter !== 'all' && e.submittedByName !== submittedByFilter) return false
      if (!isWithinDateRange(e.expenseDate, dateFrom, dateTo)) return false
      return true
    })
  }, [expenseList, statusFilter, categoryFilter, submittedByFilter, dateFrom, dateTo])

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Expenses</h1>
      </div>

      <ListOverview>
      <ListSummary loading={isLoading} className="grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} label="Total Expenses" value={formatCurrency(stats.totalAmount)} iconVariant="primary" />
        <StatCard icon={Clock} label="Pending Review" value={stats.pending.length} iconVariant="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats.approved.length} iconVariant="success" />
        <StatCard icon={Wallet} label="Reimbursed" value={formatCurrency(stats.reimbursedAmount)} iconVariant="info" />
      </ListSummary>
      </ListOverview>

      <Card className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:m-5 [&>p]:mx-5 [&>p]:mb-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          key={`${statusFilter}-${categoryFilter}-${submittedByFilter}-${datePreset}-${customFrom}-${customTo}`}
          title="All Expenses"
          subtitle="Organization-wide expenses submitted by admin, sales, delivery, and staff teams"
          toolbarActions={
            <ListFilterPanel title="Filter Expenses">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                <Select options={FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Category
                <Select options={categoryOptions} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Submitted By
                <Select options={submittedByOptions} value={submittedByFilter} onChange={(event) => setSubmittedByFilter(event.target.value)} />
              </label>
              <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Expense Date
                <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} />
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
              )}
            </ListFilterPanel>
          }
          emptyTitle={hasActiveFilters ? 'No expenses match these filters' : 'No expenses found'}
          emptyDescription={hasActiveFilters ? 'Try widening the date range or clearing filters.' : undefined}
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
          onRowClick={(row) => setDetailTarget(row)}
          actions={(row) => {
            const list = [{ label: 'Details', icon: Eye, onClick: () => setDetailTarget(row) }]
            // lifecycle_status drives which actions apply: pending_approval -> Approve/Reject
            // (+ Request Clarification, a separate pre-existing flow), approved -> Reimburse
            // only, rejected/reimbursed -> no actions (read-only final states).
            if (canApprove && row.lifecycleStatus === 'pending_approval') {
              list.push(
                { label: 'Approve', icon: Check, onClick: () => handleApprove(row) },
                { label: 'Request Clarification', icon: HelpCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'clarify' }) } },
                { label: 'Reject', icon: XCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'reject' }) }, danger: true },
              )
            }
            if (canApprove && row.lifecycleStatus === 'approved') {
              if (DEMO_EXPENSES_ENABLED) {
                list.push({ label: 'Record Reimbursement (demo)', icon: Wallet, onClick: () => { setDemoReimburseMode('Bank Transfer'); setDemoReimburseTarget(row) } })
              } else {
                list.push({ label: 'Reimburse', icon: Wallet, onClick: () => setReimburseTarget(row) })
              }
            }
            return list
          }}
        />
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
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
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

      <Modal isOpen={Boolean(demoReimburseTarget)} onClose={() => !isActing && setDemoReimburseTarget(null)} title="Record Reimbursement (demo)">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Demo simulation only. Marks
            {' '}{demoReimburseTarget?.expenseNumber || demoReimburseTarget?.expenseId} ({formatCurrency(demoReimburseTarget?.amount || 0)}) as reimbursed.
          </p>
          <Select label="Payment Mode" options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} value={demoReimburseMode} onChange={(event) => setDemoReimburseMode(event.target.value)} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDemoReimburseTarget(null)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={handleDemoReimburse}>Mark Reimbursed</Button>
          </div>
        </div>
      </Modal>

      <ReimburseExpenseModal expense={reimburseTarget} onClose={() => setReimburseTarget(null)} onReimbursed={handleReimbursed} />

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
          <div>
            <p className="text-[0.7rem] text-neutral-400">Proof</p>
            {expense.receiptUrl ? <div className="mt-1"><ExpenseProof expense={expense} /></div> : <p className="font-medium text-neutral-900">No receipt</p>}
          </div>
          {expense.lifecycleStatus === 'reimbursed' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary-100 bg-primary-50/60 p-3.5">
              <DField label="Reimbursed By" value={expense.reimbursedBy || '—'} />
              <DField label="Reimbursed On" value={expense.reimbursedAt ? formatDateTime(expense.reimbursedAt) : '—'} />
              <DField label="Method" value={expense.reimbursementMethod || '—'} />
              <DField label="Reference" value={expense.reimbursementReference || '—'} />
              {expense.reimbursementNotes && <DField label="Notes" value={expense.reimbursementNotes} />}
            </div>
          )}
          {(expense.approvalStatus === 'Rejected' || expense.approvalStatus === 'Clarification Required') && expense.rejectReason && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">{expense.approvalStatus === 'Rejected' ? 'Rejection reason:' : 'Clarification requested:'}</span>{' '}
              {expense.rejectReason}
            </div>
          )}
          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">History</p>
            <ExpenseHistory expense={expense} />
          </div>
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
