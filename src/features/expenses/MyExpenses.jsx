import { useState } from 'react'
import { Save, Plus, Trash2, Upload } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { expenses } from '../../mockData/expenses'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const EXPENSE_CATEGORIES = ['Fuel', 'Vehicle Maintenance', 'Tolls', 'Food', 'Miscellaneous']
const statusVariant = {
  Approved: 'success',
  Pending: 'info',
  Rejected: 'danger',
}

export default function MyExpenses() {
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    receipt: null,
  })

  const myExpenses = expenses.filter(e => e.submittedBy === 'usr-4')

  const handleSubmit = (e) => {
    e.preventDefault()
    showToast({ title: 'Expense submitted', message: 'Your expense has been submitted for approval.' })
    setShowModal(false)
    setNewExpense({
      category: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      receipt: null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My Expenses</h1>
          <p className="mt-1 text-sm text-neutral-500">Track and submit your expenses</p>
        </div>
        <Button icon={Plus} onClick={() => setShowModal(true)}>
          Add Expense
        </Button>
      </div>

      <Card title="Expense History">
        <DataTable
          columns={[
            { key: 'category', header: 'Category', sortable: true },
            { key: 'description', header: 'Description', sortable: true },
            { key: 'date', header: 'Date', sortable: true },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
          ]}
          data={myExpenses}
          searchKeys={['category', 'description', 'status']}
          searchPlaceholder="Search expenses…"
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Category"
            value={newExpense.category}
            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
            required
          />
          <Input
            label="Description"
            type="text"
            value={newExpense.description}
            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            placeholder="Enter expense description…"
            required
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
          <Input
            label="Date"
            type="date"
            value={newExpense.date}
            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Receipt Upload</label>
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-500 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="mt-2 text-sm text-neutral-500">Click to upload receipt (optional)</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={Save}>
              Submit Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
