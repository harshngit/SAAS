import { useCallback, useEffect, useState } from 'react'
import { Save, Plus, Upload } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { createExpense, getExpenseCategories, listExpenses } from '../../api/expenses'
import { uploadFile } from '../../api/files'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer']
const statusVariant = {
  Approved: 'success',
  Pending: 'info',
  Rejected: 'danger',
}

const emptyExpense = {
  category: '',
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  paymentMode: '',
}

export default function MyExpenses() {
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [myExpenses, setMyExpenses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [categories, setCategories] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [newExpense, setNewExpense] = useState(emptyExpense)
  const [receiptFile, setReceiptFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadExpenses = useCallback(async () => {
    if (!currentUser?.id) return

    setIsLoading(true)
    setListError('')

    const result = await listExpenses({ submitted_by: currentUser.id })

    if (!result.success) {
      setMyExpenses([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setMyExpenses(result.expenses)
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  useEffect(() => {
    getExpenseCategories().then((result) => {
      if (result.success) setCategories(result.categories)
    })
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!newExpense.category || !newExpense.amount) {
      setFormError('Category and amount are required.')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    let receiptUrl
    if (receiptFile) {
      const uploadResult = await uploadFile(receiptFile)
      if (!uploadResult.success) {
        setFormError(uploadResult.error)
        setIsSubmitting(false)
        return
      }
      receiptUrl = uploadResult.file.url
    }

    const result = await createExpense({
      category: newExpense.category,
      description: newExpense.description,
      amount: newExpense.amount,
      expenseDate: newExpense.date,
      paymentMode: newExpense.paymentMode,
      receiptUrl,
    })

    if (!result.success) {
      setFormError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Expense submitted', message: 'Your expense has been submitted for approval.' })
    setIsSubmitting(false)
    setShowModal(false)
    setNewExpense(emptyExpense)
    setReceiptFile(null)
    loadExpenses()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My Expenses</h1>
          <p className="mt-1 text-sm text-neutral-500">Track and submit your expenses</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="size-4" />
          Add Expense
        </Button>
      </div>

      <Card title="Expense History">
        {listError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
        )}
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'category', header: 'Category', sortable: true },
            { key: 'description', header: 'Description', sortable: true },
            { key: 'expenseDate', header: 'Date', sortable: true },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'approvalStatus',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.approvalStatus] || 'neutral'} dot>{row.approvalStatus}</Badge>,
            },
          ]}
          data={myExpenses}
          searchKeys={['category', 'description', 'approvalStatus']}
          searchPlaceholder="Search expenses…"
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title="Add New Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}
          <Select
            label="Category"
            value={newExpense.category}
            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
            options={categories.map((c) => ({ value: c, label: c }))}
            required
          />
          <Input
            label="Description"
            type="text"
            value={newExpense.description}
            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            placeholder="Enter expense description…"
          />
          <Input
            label="Amount"
            type="number"
            value={newExpense.amount}
            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
            min="0"
            step="0.01"
            required
          />
          <Select
            label="Payment Mode"
            value={newExpense.paymentMode}
            onChange={(e) => setNewExpense({ ...newExpense, paymentMode: e.target.value })}
            options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
          />
          <Input
            label="Date"
            type="date"
            value={newExpense.date}
            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Receipt Upload (Optional)</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 p-4 text-center hover:border-primary-500 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="text-sm text-neutral-500">{receiptFile ? receiptFile.name : 'Click to upload receipt'}</p>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save className="size-4" />
              Submit Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
