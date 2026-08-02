import { useState } from 'react'
import { Check, XCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { expenses } from '../../mockData/expenses'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const statusVariant = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
}

export default function ExpenseApprovalQueue() {
  const { showToast } = useToast()
  const [expenseList, setExpenseList] = useState([...expenses])

  const handleApprove = (id) => {
    setExpenseList(expenseList.map(e =>
      e.id === id ? { ...e, status: 'Approved' } : e
    ))
    showToast({ title: 'Expense approved', message: `Expense ${id} has been approved.` })
  }

  const handleReject = (id) => {
    setExpenseList(expenseList.map(e =>
      e.id === id ? { ...e, status: 'Rejected' } : e
    ))
    showToast({ title: 'Expense rejected', message: `Expense ${id} has been rejected.` })
  }

  const pendingExpenses = expenseList.filter(e => e.status === 'Pending')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Expense Approval Queue</h1>
        <p className="mt-1 text-sm text-neutral-500">Approve or reject pending expenses from Delivery Partners</p>
      </div>

      <Card title="Pending Expenses">
        <DataTable
          columns={[
            { key: 'id', header: 'Expense ID', sortable: true },
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
          data={pendingExpenses}
          searchKeys={['id', 'category', 'description']}
          searchPlaceholder="Search pending expenses..."
          actions={(row) => [
            { label: 'Approve', icon: Check, onClick: () => handleApprove(row.id) },
            { label: 'Reject', icon: XCircle, onClick: () => handleReject(row.id), danger: true },
          ]}
        />
      </Card>
    </div>
  )
}
