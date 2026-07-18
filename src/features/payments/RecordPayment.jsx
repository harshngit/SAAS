import { useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const paymentTypes = ['Customer Payment', 'Supplier Payment']
const paymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

export default function RecordPayment() {
  const [paymentType, setPaymentType] = useState('Customer Payment')
  const [partyName, setPartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Payment recorded successfully!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Record Payment</h1>
        <p className="mt-1 text-sm text-neutral-500">Record customer or supplier payments</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Payment Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Payment Type"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              options={paymentTypes.map(t => ({ value: t, label: t }))}
              required
            />
            <Input
              label={paymentType === 'Customer Payment' ? 'Customer Name' : 'Supplier Name'}
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              required
            />
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              required
            />
            <Select
              label="Payment Mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              options={paymentModes.map(m => ({ value: m, label: m }))}
              required
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Reference Number"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" icon={Save}>
            Record Payment
          </Button>
        </div>
      </form>
    </div>
  )
}
