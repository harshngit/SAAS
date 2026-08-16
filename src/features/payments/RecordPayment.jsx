import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { listCustomers } from '../../api/customers'
import { listSuppliers, recordSupplierPayment } from '../../api/suppliers'
import { createPaymentReceipt } from '../../api/paymentReceipts'

const paymentTypes = [
  { value: 'customer', label: 'Customer Payment' },
  { value: 'supplier', label: 'Supplier Payment' },
]
const paymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

export default function RecordPayment() {
  const { showToast } = useToast()
  const [paymentType, setPaymentType] = useState('customer')
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  const [partyId, setPartyId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listCustomers(), listSuppliers()]).then(([customersResult, suppliersResult]) => {
      if (customersResult.success) setCustomers(customersResult.customers)
      if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
      setIsLoadingOptions(false)
    })
  }, [])

  const partyOptions = useMemo(() => {
    const list = paymentType === 'customer' ? customers : suppliers
    return list.map((party) => ({ value: party.id, label: party.name }))
  }, [paymentType, customers, suppliers])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!partyId) {
      setError(`Select a ${paymentType === 'customer' ? 'customer' : 'supplier'}.`)
      return
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const result = paymentType === 'customer'
      ? await createPaymentReceipt({
          customerId: partyId,
          amountReceived: amount,
          paymentMethod: paymentMode || 'cash',
          transactionReference: reference || undefined,
          receiptDate: date,
          note: notes || undefined,
        })
      : await recordSupplierPayment(partyId, {
          amount,
          paymentMode: paymentMode || 'cash',
          reference: reference || undefined,
          note: notes || undefined,
          paidOn: date,
        })

    if (!result.success) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Payment recorded', message: 'Payment recorded successfully.' })
    setPartyId('')
    setAmount('')
    setPaymentMode('')
    setReference('')
    setNotes('')
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Record Payment</h1>
        <p className="mt-1 text-sm text-neutral-500">Record customer or supplier payments</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Payment Details">
          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Payment Type"
              value={paymentType}
              onChange={(event) => {
                setPaymentType(event.target.value)
                setPartyId('')
              }}
              options={paymentTypes}
              required
            />
            <Select
              label={paymentType === 'customer' ? 'Customer' : 'Supplier'}
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              options={partyOptions}
              placeholder={isLoadingOptions ? 'Loading...' : `Select ${paymentType === 'customer' ? 'customer' : 'supplier'}`}
              disabled={isLoadingOptions}
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
              options={paymentModes.map((m) => ({ value: m.toLowerCase().replace(' ', '_'), label: m }))}
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
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" />
            Record Payment
          </Button>
        </div>
      </form>
    </div>
  )
}
