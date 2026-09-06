import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, FileText, Plus, Upload } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  createExpense,
  deleteExpense,
  getExpenseCategories,
  listExpenses,
  updateExpense,
  uploadExpenseReceipt,
} from '../../api/expenses'
import { getFileUrl } from '../../api/files'
import { usePermission } from '../../auth/usePermission'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import {
  DEMO_EXPENSES_ENABLED,
  DEMO_EXPENSE_CATEGORIES,
  demoExpensesResolved,
  simulateDemoCancelExpense,
  simulateDemoCreateExpense,
  simulateDemoUpdateExpense,
} from './expenseDemo'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']
const STATUS_VARIANT = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Reimbursed: 'primary',
  'Clarification Required': 'info',
}
// An approved claim that has been paid reads as "Reimbursed" to the employee.
const claimStatus = (expense) =>
  expense.approvalStatus === 'Approved' && expense.paymentStatus === 'Paid' ? 'Reimbursed' : expense.approvalStatus
const needsClarification = (expense) =>
  expense.statusKey === 'clarification_requested' || expense.approvalStatus === 'Clarification Required'
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Clarification Required', label: 'Clarification Required' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Reimbursed', label: 'Reimbursed' },
  { key: 'Rejected', label: 'Rejected' },
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const friendly = (value) => (value && !UUID_RE.test(String(value)) ? value : '')
const todayIso = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => ({
  category: '',
  description: '',
  amount: '',
  expenseDate: todayIso(),
  paymentMode: '',
})

function receiptHrefOf(expense) {
  if (!expense.receiptUrl) return ''
  return expense.isDemo ? expense.receiptUrl : getFileUrl(expense.receiptUrl)
}

function DetailModal({ expense, onClose, onUpdate, canEdit }) {
  const showUpdate = expense && needsClarification(expense) && canEdit
  return (
    <Modal
      isOpen={Boolean(expense)}
      onClose={onClose}
      title="Expense claim"
      size="lg"
      footer={
        showUpdate ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
            <Button type="button" onClick={() => onUpdate(expense)}>Update Expense</Button>
          </>
        ) : undefined
      }
    >
      {expense && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" value={expense.category || '—'} />
            <Field
              label="Status"
              value={<Badge variant={STATUS_VARIANT[claimStatus(expense)] || 'neutral'} dot>{claimStatus(expense)}</Badge>}
            />
            <Field label="Amount" value={formatCurrency(expense.amount)} />
            <Field label="Payment Mode" value={expense.paymentMode || '—'} />
            <Field label="Expense Date" value={formatDate(expense.expenseDate)} />
            <Field label="Submitted At" value={expense.createdAt ? formatDateTime(expense.createdAt) : '—'} />
          </div>
          <Field label="Description" value={expense.description || '—'} />
          <Field
            label="Receipt"
            value={
              receiptHrefOf(expense) ? (
                <a
                  href={receiptHrefOf(expense)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  View receipt
                </a>
              ) : (
                'No receipt'
              )
            }
          />
          {expense.approvalStatus !== 'Pending' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reviewed By" value={friendly(expense.approverName) || '—'} />
              <Field label="Reviewed At" value={expense.reviewedAt ? formatDateTime(expense.reviewedAt) : expense.updatedAt ? formatDateTime(expense.updatedAt) : '—'} />
            </div>
          )}
          {expense.approvalStatus === 'Approved' && (
            <Field label="Reimbursement" value={expense.paymentStatus === 'Paid' ? 'Paid' : 'Pending'} />
          )}
          {needsClarification(expense) && expense.clarificationNote && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">Clarification requested:</span> {expense.clarificationNote}
            </div>
          )}
          {expense.approvalStatus === 'Rejected' && expense.clarificationNote && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
              <span className="font-semibold">Rejection reason:</span> {expense.clarificationNote}
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

export default function MyExpenses() {
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const { can } = usePermission()
  const canCreate = can('expenses', 'create')
  const canEdit = can('expenses', 'edit')
  const canDelete = can('expenses', 'delete')

  const demo = DEMO_EXPENSES_ENABLED
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryNotice, setCategoryNotice] = useState('') // real mode: categories unavailable / error
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [receiptFile, setReceiptFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [detailExpense, setDetailExpense] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Explicit demo mode (VITE_DEMO_DATA=true): local fixtures only, no API call.
    if (DEMO_EXPENSES_ENABLED) {
      setExpenses(demoExpensesResolved())
      setIsLoading(false)
      return
    }

    if (!currentUser?.id) {
      setIsLoading(false)
      return
    }

    // Real mode: the API is the only source. An empty list is a truthful empty state; a
    // failure shows the real error - neither falls back to demo data.
    const result = await listExpenses({ submitted_by: currentUser.id })
    if (!result.success) {
      setExpenses([])
      setListError(result.error)
      setIsLoading(false)
      return
    }
    setExpenses(result.expenses)
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    // Demo mode: demo categories only. Real mode: ONLY API categories - no demo fallback,
    // and a missing/empty list blocks real submission.
    if (demo) {
      setCategories(DEMO_EXPENSE_CATEGORIES)
      setCategoryNotice('')
      return
    }
    getExpenseCategories().then((result) => {
      if (!result.success) {
        setCategories([])
        setCategoryNotice(result.error)
        return
      }
      if (result.categories.length === 0) {
        setCategories([])
        setCategoryNotice('Expense categories are not available. Please try again later.')
        return
      }
      setCategories(result.categories)
      setCategoryNotice('')
    })
  }, [demo])

  const counts = useMemo(
    () => ({
      pending: expenses.filter((e) => e.approvalStatus === 'Pending').length,
      approved: expenses.filter((e) => e.approvalStatus === 'Approved').length,
      rejected: expenses.filter((e) => e.approvalStatus === 'Rejected').length,
      total: expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    }),
    [expenses],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter((e) => {
      if (filter !== 'all' && claimStatus(e) !== filter) return false
      if (!q) return true
      return `${e.category} ${e.description}`.toLowerCase().includes(q)
    })
  }, [expenses, filter, search])

  const duplicate = useMemo(() => {
    const amount = Math.round(Number(formData.amount)) || 0
    if (!formData.category || amount <= 0 || !formData.expenseDate) return false
    return expenses.some(
      (e) =>
        e.approvalStatus === 'Pending' &&
        e.category === formData.category &&
        Math.round(Number(e.amount)) === amount &&
        (e.expenseDate || '').slice(0, 10) === formData.expenseDate &&
        (e.description || '').trim() === formData.description.trim(),
    )
  }, [expenses, formData])

  const openForm = () => {
    setEditTarget(null)
    setFormData(emptyForm())
    setReceiptFile(null)
    setFormError('')
    setShowForm(true)
  }

  // Correct a clarification-requested claim - backend PATCH /expenses/{id} accepts this and
  // flips the status back to pending.
  const openEditForm = (expense) => {
    setEditTarget(expense)
    setFormData({
      category: expense.category || '',
      description: expense.description || '',
      amount: expense.amount ? String(Math.round(Number(expense.amount))) : '',
      expenseDate: (expense.expenseDate || todayIso()).slice(0, 10),
      paymentMode: expense.paymentMode || '',
    })
    setReceiptFile(null)
    setFormError('')
    setShowForm(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amount = Math.round(Number(formData.amount))
    if (!formData.category) return setFormError('Choose an expense category.')
    if (!(amount > 0)) return setFormError('Enter an amount greater than zero.')
    if (!formData.expenseDate) return setFormError('Choose the expense date.')
    if (formData.expenseDate > todayIso()) return setFormError('The expense date cannot be in the future.')
    if (!formData.description.trim()) return setFormError('Add a short description of the expense.')

    setIsSubmitting(true)
    setFormError('')

    if (demo) {
      if (editTarget) {
        simulateDemoUpdateExpense(editTarget.id, {
          category: formData.category,
          description: formData.description,
          amount,
          expenseDate: formData.expenseDate,
          paymentMode: formData.paymentMode,
        })
        showToast({ title: 'Expense updated (demo)', message: 'The claim is back with the reviewer as Pending.' })
      } else {
        simulateDemoCreateExpense({ ...formData, amount, hasReceipt: Boolean(receiptFile) })
        showToast({ title: 'Expense submitted (demo)', message: 'Your claim is now pending approval.' })
      }
      setExpenses(demoExpensesResolved())
      setIsSubmitting(false)
      setShowForm(false)
      setEditTarget(null)
      return
    }

    if (categories.length === 0) {
      setFormError('Expense categories are not available yet — cannot submit.')
      setIsSubmitting(false)
      return
    }

    // Update an existing claim during clarification (backend flips it to pending on success).
    if (editTarget) {
      const updateResult = await updateExpense(editTarget.id, {
        category: formData.category,
        description: formData.description,
        amount,
        expenseDate: formData.expenseDate,
        paymentMode: formData.paymentMode,
      })
      if (!updateResult.success) {
        setFormError(updateResult.error)
        setIsSubmitting(false)
        return
      }
      if (receiptFile) {
        await uploadExpenseReceipt(editTarget.id, receiptFile)
      }
      setIsSubmitting(false)
      setShowForm(false)
      setEditTarget(null)
      showToast({ title: 'Expense updated', message: 'The claim has been resubmitted for review.' })
      load()
      return
    }

    // 1) Create the claim. 2) If a receipt was chosen, attach it via the dedicated
    // /expenses/{id}/receipt endpoint. A receipt failure does NOT re-create the claim -
    // it already exists - so we surface a truthful partial-success message.
    const result = await createExpense({
      category: formData.category,
      description: formData.description,
      amount,
      expenseDate: formData.expenseDate,
      paymentMode: formData.paymentMode,
    })
    if (!result.success) {
      setFormError(result.error)
      setIsSubmitting(false)
      return
    }

    if (receiptFile) {
      const receiptResult = await uploadExpenseReceipt(result.expense.id, receiptFile)
      setIsSubmitting(false)
      setShowForm(false)
      if (!receiptResult.success) {
        showToast({
          title: 'Claim submitted, receipt not attached',
          message: 'Expense claim was submitted, but the receipt could not be uploaded.',
        })
      } else {
        showToast({ title: 'Expense submitted', message: 'Your claim is now pending approval.' })
      }
      load()
      return
    }

    setIsSubmitting(false)
    setShowForm(false)
    showToast({ title: 'Expense submitted', message: 'Your claim is now pending approval.' })
    load()
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setIsCancelling(true)

    if (demo) {
      simulateDemoCancelExpense(cancelTarget.id)
      setExpenses(demoExpensesResolved())
      setIsCancelling(false)
      setCancelTarget(null)
      showToast({ title: 'Claim cancelled (demo)', message: 'The expense claim was withdrawn.' })
      return
    }

    const result = await deleteExpense(cancelTarget.id)
    setIsCancelling(false)
    if (!result.success) {
      showToast({ title: 'Cancel failed', message: result.error })
      return
    }
    setExpenses((current) => current.filter((e) => e.id !== cancelTarget.id))
    setCancelTarget(null)
    showToast({ title: 'Claim cancelled', message: 'The expense claim was withdrawn.' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">Expenses</h1>
            {demo && <Badge variant="warning">Demo data</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-500">Track and submit your work-related expenses.</p>
        </div>
        {canCreate && (
          <Button onClick={openForm}>
            <Plus className="size-4" aria-hidden="true" />
            Add Expense
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Pending Claims', counts.pending],
          ['Approved Claims', counts.approved],
          ['Rejected Claims', counts.rejected],
          ['Total Claimed', formatCurrency(counts.total)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <p className="text-2xl font-semibold text-neutral-900">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search category or description..."
          className="ml-auto h-9 w-full max-w-64 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none"
        />
      </div>

      <Card className="p-0" bodyClassName="p-0">
        {isLoading ? (
          <div className="p-6"><LoadingSpinner label="Loading your expense claims..." /></div>
        ) : listError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title={expenses.length === 0 ? 'No expense claims yet' : 'Nothing in this filter'}
              description={expenses.length === 0 ? 'Add a work-related expense and track its status here.' : 'Try a different status filter or search.'}
            />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-6xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted On</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {visible.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{formatDate(e.expenseDate)}</td>
                      <td className="px-4 py-3 text-neutral-600">{e.category || '—'}</td>
                      <td className="max-w-64 truncate px-4 py-3 text-neutral-600" title={e.description}>{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-neutral-600">{e.paymentMode || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${e.receiptUrl ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {e.receiptUrl ? 'Uploaded' : 'No receipt'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[claimStatus(e)] || 'neutral'} dot>{claimStatus(e)}</Badge></td>
                      <td className="px-4 py-3 text-neutral-500">{e.createdAt ? formatDate(e.createdAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDetailExpense(e)}>
                            <Eye className="size-4" aria-hidden="true" />
                            Details
                          </Button>
                          {needsClarification(e) && canEdit && (
                            <Button type="button" variant="outline" size="sm" onClick={() => openEditForm(e)}>Update</Button>
                          )}
                          {e.approvalStatus === 'Pending' && canDelete && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setCancelTarget(e)}>Cancel</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="divide-y divide-neutral-100 lg:hidden">
              {visible.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">{e.category || '—'}</p>
                      <p className="text-xs text-neutral-500">{formatDate(e.expenseDate)} · {e.paymentMode || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-neutral-900">{formatCurrency(e.amount)}</p>
                      <Badge variant={STATUS_VARIANT[claimStatus(e)] || 'neutral'} dot>{claimStatus(e)}</Badge>
                    </div>
                  </div>
                  {e.description && <p className="mt-2 text-xs text-neutral-500">{e.description}</p>}
                  <p className="mt-1 text-[0.7rem] text-neutral-400">{e.receiptUrl ? 'Receipt uploaded' : 'No receipt'}</p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailExpense(e)}>Details</Button>
                    {needsClarification(e) && canEdit && (
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditForm(e)}>Update</Button>
                    )}
                    {e.approvalStatus === 'Pending' && canDelete && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCancelTarget(e)}>Cancel</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Add / Update Expense */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          if (isSubmitting) return
          setShowForm(false)
          setEditTarget(null)
        }}
        title={editTarget ? 'Update Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editTarget && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {editTarget.clarificationNote
                ? `Clarification requested: ${editTarget.clarificationNote}`
                : 'Correct the details below.'}{' '}
              Saving resubmits the claim for review.
            </div>
          )}
          {formError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          {!demo && categoryNotice && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">{categoryNotice}</div>
          )}
          <Select
            label="Expense Category"
            value={formData.category}
            onChange={(e) => setFormData((c) => ({ ...c, category: e.target.value }))}
            options={categories.map((cat) => ({ value: cat, label: cat }))}
            disabled={!demo && categories.length === 0}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount (₹)"
              type="number"
              min="1"
              step="1"
              value={formData.amount}
              onChange={(e) => setFormData((c) => ({ ...c, amount: e.target.value }))}
              required
            />
            <Input
              label="Expense Date"
              type="date"
              max={todayIso()}
              value={formData.expenseDate}
              onChange={(e) => setFormData((c) => ({ ...c, expenseDate: e.target.value }))}
              required
            />
          </div>
          <Select
            label="Payment Mode"
            value={formData.paymentMode}
            onChange={(e) => setFormData((c) => ({ ...c, paymentMode: e.target.value }))}
            options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
          />
          <Input
            label="Description / Purpose"
            as="textarea"
            value={formData.description}
            onChange={(e) => setFormData((c) => ({ ...c, description: e.target.value }))}
            placeholder="What was this expense for?"
            required
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Receipt / Proof (optional)</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 p-4 text-center transition-colors hover:border-primary-500">
              <Upload className="size-7 text-neutral-400" aria-hidden="true" />
              <p className="text-sm text-neutral-500">{receiptFile ? receiptFile.name : 'Click to upload an image or PDF'}</p>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          {duplicate && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              A similar expense claim already exists.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditTarget(null) }} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} disabled={!demo && categories.length === 0}>
              {editTarget ? 'Resubmit for Review' : 'Submit Claim'}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        expense={detailExpense}
        onClose={() => setDetailExpense(null)}
        canEdit={canEdit}
        onUpdate={(expense) => {
          setDetailExpense(null)
          openEditForm(expense)
        }}
      />

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel expense claim" size="md">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Withdraw this {cancelTarget ? `${cancelTarget.category} ` : ''}claim
            {cancelTarget ? ` for ${formatCurrency(cancelTarget.amount)}` : ''}? This cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCancelTarget(null)}>Keep Claim</Button>
            <Button type="button" variant="danger" loading={isCancelling} onClick={handleCancel}>Cancel Claim</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
