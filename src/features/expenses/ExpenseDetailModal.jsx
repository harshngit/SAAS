import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import ExpenseProof from './ExpenseProof'
import ExpenseHistory from './ExpenseHistory'

const STATUS_VARIANT = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Reimbursed: 'primary',
  'Clarification Required': 'info',
}

// lifecycleStatus (new source of truth) drives the displayed status; this falls back to the
// old inference only for rows that somehow don't carry it yet.
function effectiveStatus(expense) {
  if (expense.lifecycleStatus === 'reimbursed') return 'Reimbursed'
  if (expense.lifecycleStatus === 'approved' || (expense.approvalStatus === 'Approved' && expense.paymentStatus !== 'Paid')) return 'Approved'
  if (expense.lifecycleStatus === 'rejected') return 'Rejected'
  if (expense.approvalStatus === 'Approved' && expense.paymentStatus === 'Paid') return 'Reimbursed'
  return expense.approvalStatus || 'Pending'
}

function DField({ label, value }) {
  return (
    <div>
      <p className="text-[0.7rem] text-neutral-400">{label}</p>
      <div className="font-medium text-neutral-900">{value}</div>
    </div>
  )
}

// Shared by AdminExpenses and ExpenseApprovalQueue - same detail view, same Approve/Request
// Clarification/Reject/Reimburse buttons gated on the expense's actual lifecycleStatus (not
// whichever tab/filter the page happens to be showing), kept alongside each page's existing
// row-menu actions rather than replacing them. Each action is a callback prop - this component
// only decides WHICH buttons to show, the caller still owns the real approve/reject/reimburse
// API calls (and each page's own demo-mode handling).
export default function ExpenseDetailModal({
  expense,
  onClose,
  canApprove = false,
  canCancel = false,
  isActing = false,
  onApprove,
  onRequestClarification,
  onReject,
  onReimburse,
  onCancel,
  reimburseLabel = 'Reimburse',
}) {
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

          {canApprove && (expense.lifecycleStatus === 'pending_approval' || expense.lifecycleStatus === 'clarification_requested' || expense.lifecycleStatus === 'approved') && (
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              {expense.lifecycleStatus === 'pending_approval' && onApprove && (
                <Button type="button" size="sm" loading={isActing} onClick={() => onApprove(expense)}>Approve</Button>
              )}
              {expense.lifecycleStatus === 'pending_approval' && onRequestClarification && (
                <Button type="button" size="sm" variant="outline" disabled={isActing} onClick={() => onRequestClarification(expense)}>Request Clarification</Button>
              )}
              {(expense.lifecycleStatus === 'pending_approval' || expense.lifecycleStatus === 'clarification_requested') && onReject && (
                <Button type="button" size="sm" variant="danger" disabled={isActing} onClick={() => onReject(expense)}>Reject</Button>
              )}
              {expense.lifecycleStatus === 'approved' && onReimburse && (
                <Button type="button" size="sm" loading={isActing} onClick={() => onReimburse(expense)}>{reimburseLabel}</Button>
              )}
            </div>
          )}

          {canCancel && onCancel && expense.lifecycleStatus === 'pending_approval' && (
            <div className="flex items-center gap-2 border-t border-neutral-100 pt-4">
              <Button type="button" size="sm" variant="danger" disabled={isActing} onClick={() => onCancel(expense)}>Cancel Claim</Button>
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
