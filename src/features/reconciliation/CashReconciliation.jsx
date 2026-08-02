import { useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

export default function CashReconciliation() {
  const { showToast } = useToast()
  const [openingBalance, setOpeningBalance] = useState(50000)
  const [cashSales, setCashSales] = useState(25000)
  const [cashReceived, setCashReceived] = useState(15000)
  const [cashPaid, setCashPaid] = useState(10000)
  const [expensesPaid, setExpensesPaid] = useState(5000)
  const [actualCash, setActualCash] = useState(75000)

  const expectedClosingBalance = openingBalance + cashSales + cashReceived - cashPaid - expensesPaid
  const difference = actualCash - expectedClosingBalance

  const handleSubmit = (e) => {
    e.preventDefault()
    showToast({ title: 'Reconciliation saved', message: 'Cash reconciliation saved successfully.' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Cash Reconciliation</h1>
        <p className="mt-1 text-sm text-neutral-500">Reconcile cash on hand with expected balance</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Cash Flow Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Opening Cash Balance"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
              min="0"
              step="0.01"
            />
            <Input
              label="Cash Sales"
              type="number"
              value={cashSales}
              onChange={(e) => setCashSales(Number(e.target.value))}
              min="0"
              step="0.01"
            />
            <Input
              label="Cash Received from Customers"
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(Number(e.target.value))}
              min="0"
              step="0.01"
            />
            <Input
              label="Cash Paid to Suppliers"
              type="number"
              value={cashPaid}
              onChange={(e) => setCashPaid(Number(e.target.value))}
              min="0"
              step="0.01"
            />
            <Input
              label="Cash Expenses Paid"
              type="number"
              value={expensesPaid}
              onChange={(e) => setExpensesPaid(Number(e.target.value))}
              min="0"
              step="0.01"
            />
            <Input
              label="Actual Cash on Hand"
              type="number"
              value={actualCash}
              onChange={(e) => setActualCash(Number(e.target.value))}
              min="0"
              step="0.01"
            />
          </div>
        </Card>

        <Card title="Reconciliation Summary">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-neutral-600">Expected Closing Balance:</span>
              <span className="font-semibold">{formatCurrency(expectedClosingBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Actual Cash on Hand:</span>
              <span className="font-semibold">{formatCurrency(actualCash)}</span>
            </div>
            <div className={`flex justify-between pt-2 border-t ${difference === 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span className="font-semibold">Difference:</span>
              <span className="font-semibold">{formatCurrency(difference)}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" icon={Save}>
            Save Reconciliation
          </Button>
        </div>
      </form>
    </div>
  )
}
