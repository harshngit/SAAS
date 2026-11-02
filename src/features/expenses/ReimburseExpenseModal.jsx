import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import { formatCurrency } from '../../utils/format'
import { REIMBURSEMENT_METHOD_OPTIONS, reimburseExpense } from '../../api/expenses'

const todayIso = () => new Date().toISOString().slice(0, 10)

// Shared by AdminExpenses and ExpenseApprovalQueue - the one real reimbursement flow
// (POST /expenses/{id}/reimburse). Amount is always read-only; only an approved expense is
// ever passed in as `expense` by the caller.
export default function ReimburseExpenseModal({ expense, onClose, onReimbursed }) {
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paidAt, setPaidAt] = useState(todayIso())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!expense) return
    setPaymentMethod('')
    setPaidAt(todayIso())
    setReference('')
    setNotes('')
    setError('')
  }, [expense])

  const handleSubmit = async () => {
    if (isSaving || !expense) return
    if (!paymentMethod) {
      setError('Select a payment method.')
      return
    }
    setIsSaving(true)
    setError('')

    const result = await reimburseExpense(expense.id, {
      paymentMethod,
      paidAt: paidAt ? `${paidAt}T00:00:00` : undefined,
      paymentReference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    setIsSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onReimbursed(result.expense)
  }

  return (
    <Modal isOpen={Boolean(expense)} onClose={() => !isSaving && onClose()} title="Reimburse Expense">
      {expense && (
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-400">Amount</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrency(expense.netPayable ?? expense.amount)}</p>
          </div>
          <Input label="Payment Date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          <Select
            label="Payment Method"
            required
            options={REIMBURSEMENT_METHOD_OPTIONS}
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            placeholder="Select payment method"
          />
          <Input label="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR / cheque number" />
          <Input label="Notes (optional)" as="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>Cancel</Button>
            <Button type="button" loading={isSaving} onClick={handleSubmit}>Mark Reimbursed</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
