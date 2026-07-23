import { useState } from 'react'
import { Receipt, Clock, CheckCircle2, XCircle, Check } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import { expenses } from '../../mockData/expenses'
import { users } from '../../mockData/users'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
}

const userName = (id) => users.find((user) => user.id === id)?.name || 'Unknown'

export default function AdminExpenses() {
  const [expenseList, setExpenseList] = useState(
    expenses.map((expense) => ({ ...expense, submittedByName: userName(expense.submittedBy) })),
  )

  const handleApprove = (id) => {
    setExpenseList((list) => list.map((e) => (e.id === id ? { ...e, status: 'Approved' } : e)))
  }

  const handleReject = (id) => {
    setExpenseList((list) => list.map((e) => (e.id === id ? { ...e, status: 'Rejected' } : e)))
  }

  const pending = expenseList.filter((e) => e.status === 'Pending')
  const approved = expenseList.filter((e) => e.status === 'Approved')
  const rejected = expenseList.filter((e) => e.status === 'Rejected')
  const totalAmount = expenseList.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Expenses</h1>
        <p className="mt-1 text-sm text-neutral-500">Review and manage expenses submitted across your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} label="Total Expenses" value={formatCurrency(totalAmount)} iconVariant="primary" />
        <StatCard icon={Clock} label="Pending" value={pending.length} iconVariant="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={approved.length} iconVariant="success" />
        <StatCard icon={XCircle} label="Rejected" value={rejected.length} iconVariant="danger" />
      </div>

      <Card title="All Expenses" subtitle="Submitted by sales officers, delivery partners, and staff">
        <DataTable
          columns={[
            { key: 'id', header: 'Expense ID', sortable: true },
            { key: 'category', header: 'Category', sortable: true },
            { key: 'description', header: 'Description', sortable: true },
            { key: 'submittedByName', header: 'Submitted By', sortable: true },
            { key: 'date', header: 'Date', sortable: true },
            { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount) },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
          ]}
          data={expenseList}
          searchKeys={['id', 'category', 'description', 'submittedByName']}
          searchPlaceholder="Search expenses…"
          actions={(row) =>
            row.status === 'Pending'
              ? [
                  { label: 'Approve', icon: Check, onClick: () => handleApprove(row.id) },
                  { label: 'Reject', icon: XCircle, onClick: () => handleReject(row.id), danger: true },
                ]
              : []
          }
        />
      </Card>
    </div>
  )
}
