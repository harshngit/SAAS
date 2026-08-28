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
import {
  getPaymentMethodFlags,
  paymentMethodOptions,
  sanitizePaymentDetails,
} from './paymentMethodUtils'

const paymentTypes = [
  { value: 'customer', label: 'Customer Payment' },
  { value: 'supplier', label: 'Supplier Payment' },
]

export default function RecordPayment() {
  const { showToast } = useToast()
  const [paymentType, setPaymentType] = useState('customer')
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)

  const [partyId, setPartyId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [upiId, setUpiId] = useState('')
  const [cardType, setCardType] = useState('')
  const [cardLastFour, setCardLastFour] = useState('')
  const [collectionInstructions, setCollectionInstructions] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('pending')
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

  useEffect(() => {
    setReference('')
    setUpiId('')
    setCardType('')
    setCardLastFour('')
    setCollectionInstructions('')
    setPaymentStatus(paymentMode === 'cod' ? 'pending' : '')
  }, [paymentMode])

  const partyOptions = useMemo(() => {
    const list = paymentType === 'customer' ? customers : suppliers
    return list.map((party) => ({ value: party.id, label: party.name }))
  }, [paymentType, customers, suppliers])

  const paymentFlags = getPaymentMethodFlags(paymentMode)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!partyId) {
      setError(`Select a ${paymentType === 'customer' ? 'customer' : 'supplier'}.`)
      return
    }
    if (paymentMode !== 'cod' && (!amount || Number(amount) <= 0)) {
      setError('Enter an amount greater than zero.')
      return
    }

    if (paymentFlags.showUpiFields && !upiId.trim()) {
      setError('Enter a UPI ID.')
      return
    }

    if (paymentFlags.showCardFields) {
      if (!cardType.trim()) {
        setError('Enter the card type.')
        return
      }

      if (!/^\d{4}$/.test(cardLastFour.trim())) {
        setError('Enter the last 4 digits of the card.')
        return
      }
    }

    if (paymentFlags.showReferenceField && !reference.trim()) {
      setError('Enter a transaction/reference ID.')
      return
    }

    if (paymentFlags.showCodFields && !collectionInstructions.trim()) {
      setError('Add delivery or collection instructions.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const paymentDetails = sanitizePaymentDetails(paymentMode, {
      upiId: upiId.trim(),
      transactionReference: reference.trim(),
      cardType: cardType.trim(),
      cardLastFour: cardLastFour.trim(),
      collectionInstructions: collectionInstructions.trim(),
      paymentStatus,
    })

    const result = paymentType === 'customer'
      ? await createPaymentReceipt({
          customerId: partyId,
          amountReceived: amount,
          paymentMethod: paymentMode || 'cash',
          ...paymentDetails,
          receiptDate: date,
          note: notes || undefined,
        })
      : await recordSupplierPayment(partyId, {
          amount,
          paymentMode: paymentMode || 'cash',
          reference: reference || undefined,
          ...paymentDetails,
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
    setPaymentMode('cash')
    setReference('')
    setUpiId('')
    setCardType('')
    setCardLastFour('')
    setCollectionInstructions('')
    setPaymentStatus('pending')
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
              required={paymentMode !== 'cod'}
            />
            <Select
              label="Payment Mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              options={paymentMethodOptions}
              required
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paymentFlags.showUpiFields && (
              <>
                <Input
                  label="UPI ID"
                  value={upiId}
                  onChange={(event) => setUpiId(event.target.value)}
                  required
                />
                <Input
                  label="Transaction / Reference ID"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  required
                />
              </>
            )}

            {paymentFlags.showCardFields && (
              <>
                <Input
                  label="Card Type"
                  value={cardType}
                  onChange={(event) => setCardType(event.target.value)}
                  placeholder="Debit / Credit / RuPay"
                  required
                />
                <Input
                  label="Last 4 Digits"
                  value={cardLastFour}
                  onChange={(event) => setCardLastFour(event.target.value)}
                  inputClassName="tracking-[0.25em]"
                  maxLength={4}
                  required
                />
                <Input
                  label="Transaction / Reference ID"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  required
                />
              </>
            )}

            {paymentFlags.showReferenceField && !paymentFlags.showUpiFields && !paymentFlags.showCardFields && (
              <Input
                label="Reference Number"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
              />
            )}
          </div>
          {paymentFlags.showCodFields && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Collection / Delivery Instructions</label>
              <textarea
                value={collectionInstructions}
                onChange={(event) => setCollectionInstructions(event.target.value)}
                className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
              <p className="text-xs text-amber-700">Payment status stays pending until the cash is collected.</p>
            </div>
          )}
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
