import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, HelpCircle, Wallet, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
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

const STATUS_VARIANT = { Approved: 'success', Pending: 'warning', Rejected: 'danger', 'Clarification Required': 'info' }
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']

export default function ExpenseApprovalQueue() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const canApprove = can('expenses', 'approve')

  const [expenseList, setExpenseList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('review')

  const [reviewTarget, setReviewTarget] = useState(null) // { row, mode }
  const [reviewReason, setReviewReason] = useState('')
  const [reimburseTarget, setReimburseTarget] = useState(null) // demo only
  const [reimburseMode, setReimburseMode] = useState('Bank Transfer')
  const [isActing, setIsActing] = useState(false)

  const loadExpenses = useCallback(async () => {
    setIsLoading(true)
    setError('')
    if (DEMO_EXPENSES_ENABLED) {
      setExpenseList(demoExpensesResolved())
      setIsLoading(false)
      return
    }
    // Lowercase status params are normalized at the API boundary (toExpenseStatusParam).
    const [pendingRes, clarifyRes, approvedRes] = await Promise.all([
      listExpenses({ status: 'pending' }),
      listExpenses({ status: 'clarification_requested' }),
      listExpenses({ status: 'approved' }),
    ])
    if (!pendingRes.success && !clarifyRes.success && !approvedRes.success) {
      setExpenseList([])
      setError(pendingRes.error || approvedRes.error)
      setIsLoading(false)
      return
    }
    const byId = new Map()
    ;[...(pendingRes.expenses || []), ...(clarifyRes.expenses || []), ...(approvedRes.expenses || [])].forEach((e) =>
      byId.set(e.id, e),
    )
    setExpenseList([...byId.values()])
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
      showToast({ title: 'Expense approved', message: `${row.expenseNumber || row.expenseId} approved.` })
      return
    }
    const result = await approveExpense(row.id)
    setIsActing(false)
    if (!result.success) {
      showToast({ title: 'Approval failed', message: result.error, variant: 'error' })
      return
    }
    replace(result.expense)
    showToast({ title: 'Expense approved', message: `${row.expenseNumber || row.expenseId} approved.` })
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
      showToast({ title: mode === 'reject' ? 'Expense rejected' : 'Clarification requested', message: `${row.expenseNumber || row.expenseId}` })
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
    showToast({ title: mode === 'reject' ? 'Expense rejected' : 'Clarification requested', message: `${row.expenseNumber || row.expenseId}` })
    setReviewTarget(null)
    setReviewReason('')
  }

  const handleDemoReimburse = () => {
    if (!reimburseTarget) return
    setIsActing(true)
    replace(simulateDemoReimburseExpense(reimburseTarget.id, reimburseMode))
    setIsActing(false)
    showToast({ title: 'Reimbursement recorded (demo)', message: `${reimburseTarget.expenseNumber || reimburseTarget.expenseId}` })
    setReimburseTarget(null)
  }

  // Each tab is exactly one backend status - waiting on us vs waiting on the submitter.
  const awaitingReview = useMemo(() => expenseList.filter((e) => e.statusKey === 'pending'), [expenseList])
  const clarification = useMemo(
    () => expenseList.filter((e) => e.statusKey === 'clarification_requested'),
    [expenseList],
  )
  const approved = useMemo(() => expenseList.filter((e) => e.statusKey === 'approved'), [expenseList])
  const rows = tab === 'review' ? awaitingReview : tab === 'clarification' ? clarification : approved

  const cardTitle =
    tab === 'review' ? 'Awaiting Review' : tab === 'clarification' ? 'Waiting on the Submitter' : 'Approved Expenses'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Expense Approval</h1>
        <p className="mt-1 text-sm text-neutral-500">Review submitted expenses and track clarification requests.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: 'review', label: 'Awaiting Review', count: awaitingReview.length },
          { value: 'clarification', label: 'Clarification Required', count: clarification.length },
          { value: 'approved', label: 'Approved', count: approved.length },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <Card title={cardTitle}>
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'expenseNumber', header: 'Expense #', sortable: true, render: (row) => row.expenseNumber || row.expenseId || '—' },
            { key: 'submittedByName', header: 'Submitted By', sortable: true, render: (row) => row.submittedByName || '—' },
            { key: 'category', header: 'Category', sortable: true },
            {
              key: 'description',
              header: tab === 'clarification' ? 'Clarification Asked' : 'Description',
              sortable: true,
              render: (row) =>
                tab === 'clarification' ? row.clarificationNote || row.rejectReason || '—' : row.description || '—',
            },
            { key: 'expenseDate', header: 'Date', sortable: true, render: (row) => formatDate(row.expenseDate) },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'approvalStatus',
              header: 'Status',
              sortable: true,
              render: (row) => (
                <Badge variant={STATUS_VARIANT[row.approvalStatus] || 'neutral'} dot>
                  {row.approvalStatus}
                  {tab === 'approved' && row.paymentStatus === 'Paid' ? ' · Reimbursed' : ''}
                </Badge>
              ),
            },
          ]}
          data={rows}
          searchKeys={['expenseNumber', 'expenseId', 'category', 'description', 'submittedByName']}
          searchPlaceholder="Search expenses..."
          emptyTitle={
            tab === 'review'
              ? 'No expenses waiting for approval.'
              : tab === 'clarification'
                ? 'No open clarification requests.'
                : 'No approved expenses.'
          }
          actions={(row) => {
            if (tab === 'review') {
              return canApprove
                ? [
                    { label: 'Approve', icon: Check, onClick: () => handleApprove(row) },
                    { label: 'Request Clarification', icon: HelpCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'clarify' }) } },
                    { label: 'Reject', icon: XCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'reject' }) }, danger: true },
                  ]
                : []
            }
            if (tab === 'clarification') {
              // Waiting on the submitter to correct the expense. The reviewer can still reject
              // it if they never respond.
              return canApprove
                ? [{ label: 'Reject', icon: XCircle, onClick: () => { setReviewReason(''); setReviewTarget({ row, mode: 'reject' }) }, danger: true }]
                : []
            }
            if (DEMO_EXPENSES_ENABLED && row.paymentStatus !== 'Paid') {
              return [{ label: 'Record Reimbursement (demo)', icon: Wallet, onClick: () => { setReimburseMode('Bank Transfer'); setReimburseTarget(row) } }]
            }
            return []
          }}
        />
        {tab === 'clarification' && (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            These expenses are waiting on the submitter. They return to <span className="font-medium">Awaiting Review</span> once corrected.
          </p>
        )}
        {tab === 'approved' && !DEMO_EXPENSES_ENABLED && (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Reimbursement processing will be available after the finance backend is added. These expenses stay
            <span className="font-medium"> Approved · Reimbursement Pending</span>.
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
              ? 'The expense is rejected and the submitter is notified with this reason.'
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
            <Button type="button" variant={reviewTarget?.mode === 'reject' ? 'danger' : 'primary'} loading={isActing} onClick={submitReview}>
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
    </div>
  )
}
