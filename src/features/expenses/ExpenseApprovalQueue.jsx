import { ListHeader, ListDataTable as DataTable } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, HelpCircle, Wallet, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import { usePermission } from '../../auth/usePermission'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { approveExpense, deleteExpense, listExpenses, rejectExpense, requestExpenseClarification } from '../../api/expenses'
import {
  DEMO_EXPENSES_ENABLED,
  demoExpensesResolved,
  simulateDemoApproveExpense,
  simulateDemoCancelExpense,
  simulateDemoClarifyExpense,
  simulateDemoReimburseExpense,
  simulateDemoRejectExpense,
} from './expenseDemo'
import { formatCurrency, formatDate } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import ReimburseExpenseModal from './ReimburseExpenseModal'
import ExpenseDetailModal from './ExpenseDetailModal'
import { useAuthStore } from '../../store/authStore'

const STATUS_VARIANT = { Approved: 'success', Pending: 'warning', Rejected: 'danger', 'Clarification Required': 'info' }
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']

export default function ExpenseApprovalQueue() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const currentUser = useAuthStore((state) => state.currentUser)
  const canApprove = can('expenses', 'approve')

  const [expenseList, setExpenseList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('review')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [reviewTarget, setReviewTarget] = useState(null) // { row, mode }
  const [reviewReason, setReviewReason] = useState('')
  const [reimburseTarget, setReimburseTarget] = useState(null) // real reimbursement flow
  const [demoReimburseTarget, setDemoReimburseTarget] = useState(null)
  const [demoReimburseMode, setDemoReimburseMode] = useState('Bank Transfer')
  const [isActing, setIsActing] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

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

  // Submitter cancelling their OWN still-pending expense - this queue is review-focused, but a
  // reviewer's own submitted expense can still show up in "Awaiting Review" / "Clarification".
  const handleCancel = async () => {
    if (!cancelTarget) return
    setIsCancelling(true)
    if (DEMO_EXPENSES_ENABLED) {
      simulateDemoCancelExpense(cancelTarget.id)
      setExpenseList(demoExpensesResolved())
      setIsCancelling(false)
      setCancelTarget(null)
      return
    }
    const result = await deleteExpense(cancelTarget.id)
    setIsCancelling(false)
    if (!result.success) {
      showToast({ title: 'Cancel failed', message: result.error, variant: 'error' })
      return
    }
    setExpenseList((current) => current.filter((e) => e.id !== cancelTarget.id))
    setCancelTarget(null)
    showToast({ title: 'Expense cancelled', message: `${cancelTarget.expenseNumber || cancelTarget.expenseId} was withdrawn.` })
  }

  const handleDemoReimburse = () => {
    if (!demoReimburseTarget) return
    setIsActing(true)
    replace(simulateDemoReimburseExpense(demoReimburseTarget.id, demoReimburseMode))
    setIsActing(false)
    showToast({ title: 'Reimbursement recorded (demo)', message: `${demoReimburseTarget.expenseNumber || demoReimburseTarget.expenseId}` })
    setDemoReimburseTarget(null)
  }

  const handleReimbursed = (updatedExpense) => {
    replace(updatedExpense)
    setReimburseTarget(null)
    showToast({ title: 'Expense reimbursed', message: `${updatedExpense.expenseNumber || updatedExpense.expenseId} has been marked reimbursed.` })
  }

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const dateFiltered = useMemo(
    () => expenseList.filter((e) => isWithinDateRange(e.expenseDate, dateFrom, dateTo)),
    [expenseList, dateFrom, dateTo],
  )

  // Each tab is exactly one backend status - waiting on us vs waiting on the submitter.
  const awaitingReview = useMemo(() => dateFiltered.filter((e) => e.statusKey === 'pending'), [dateFiltered])
  const clarification = useMemo(
    () => dateFiltered.filter((e) => e.statusKey === 'clarification_requested'),
    [dateFiltered],
  )
  const approved = useMemo(() => dateFiltered.filter((e) => e.statusKey === 'approved'), [dateFiltered])
  const rows = tab === 'review' ? awaitingReview : tab === 'clarification' ? clarification : approved

  const cardTitle =
    tab === 'review' ? 'Awaiting Review' : tab === 'clarification' ? 'Waiting on the Submitter' : 'Approved Expenses'

  return (
    <div className="listing-page space-y-4">
      <ListHeader>
        <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Expense Approval</h1>
        <p className="mt-1 text-xs text-neutral-400">Review submitted expenses and track clarification requests.</p>
        </div>
      </ListHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} className="w-44" />
      </div>

      <Card title={cardTitle} className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:mx-5 [&>p]:mx-5 [&>p]:mb-5">
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
                <Badge variant={row.lifecycleStatus === 'reimbursed' ? 'primary' : STATUS_VARIANT[row.approvalStatus] || 'neutral'} dot>
                  {row.lifecycleStatus === 'reimbursed' ? 'Reimbursed' : row.approvalStatus}
                </Badge>
              ),
            },
          ]}
          data={rows}
          searchKeys={['expenseNumber', 'expenseId', 'category', 'description', 'submittedByName']}
          searchPlaceholder="Search expenses..."
          onRowClick={(row) => setDetailTarget(row)}
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
            if (row.lifecycleStatus !== 'approved') return []
            if (DEMO_EXPENSES_ENABLED) {
              return [{ label: 'Record Reimbursement (demo)', icon: Wallet, onClick: () => { setDemoReimburseMode('Bank Transfer'); setDemoReimburseTarget(row) } }]
            }
            return canApprove ? [{ label: 'Reimburse', icon: Wallet, onClick: () => setReimburseTarget(row) }] : []
          }}
        />
        {tab === 'clarification' && (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            These expenses are waiting on the submitter. They return to <span className="font-medium">Awaiting Review</span> once corrected.
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
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button type="button" variant={reviewTarget?.mode === 'reject' ? 'danger' : 'primary'} loading={isActing} onClick={submitReview}>
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

      <ExpenseDetailModal
        expense={detailTarget}
        onClose={() => setDetailTarget(null)}
        canApprove={canApprove}
        canCancel={Boolean(currentUser?.id) && detailTarget?.submittedBy === currentUser?.id}
        isActing={isActing}
        onApprove={(row) => handleApprove(row)}
        onRequestClarification={(row) => { setDetailTarget(null); setReviewReason(''); setReviewTarget({ row, mode: 'clarify' }) }}
        onReject={(row) => { setDetailTarget(null); setReviewReason(''); setReviewTarget({ row, mode: 'reject' }) }}
        onReimburse={(row) => {
          setDetailTarget(null)
          if (DEMO_EXPENSES_ENABLED) { setDemoReimburseMode('Bank Transfer'); setDemoReimburseTarget(row) }
          else setReimburseTarget(row)
        }}
        onCancel={(row) => { setDetailTarget(null); setCancelTarget(row) }}
      />

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => !isCancelling && setCancelTarget(null)} title="Cancel expense claim" size="md">
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Withdraw this {cancelTarget.category} claim for {formatCurrency(cancelTarget.amount)}? This cannot be undone.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setCancelTarget(null)}>Keep Claim</Button>
              <Button type="button" variant="danger" loading={isCancelling} onClick={handleCancel}>Cancel Claim</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
