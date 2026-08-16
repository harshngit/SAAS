import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { createPaymentReceipt } from '../../api/paymentReceipts'
import { formatCurrency } from '../../utils/format'

const paymentMethodOptions = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function RecordPaymentDrawer({ isOpen, onClose, invoice, onSave }) {
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [amountReceived, setAmountReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPaymentDate(todayIso())
    setAmountReceived(invoice?.outstandingAmount ? String(invoice.outstandingAmount) : '')
    setPaymentMethod('bank_transfer')
    setReference('')
    setNotes('')
    setError('')
  }, [isOpen, invoice])

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !invoice) return null

  const receivedAmount = Number(amountReceived) || 0
  const newOutstanding = Math.max(0, invoice.outstandingAmount - receivedAmount)

  const handleSave = async (event) => {
    event.preventDefault()
    if (receivedAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    setIsSaving(true)
    setError('')

    const result = await createPaymentReceipt({
      invoiceReferenceId: invoice.id,
      amountReceived: receivedAmount,
      paymentMethod,
      transactionReference: reference || undefined,
      receiptDate: paymentDate,
      note: notes || undefined,
    })

    if (!result.success) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    onSave(result.receipt)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSave}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Record Payment</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Record a payment against this invoice</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
            <p className="font-semibold text-neutral-900">{invoice.invoiceNumber}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-neutral-400">Invoice Total</p>
                <p className="font-medium text-neutral-900">{formatCurrency(invoice.total)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Amount Paid</p>
                <p className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Outstanding</p>
                <p className="font-medium text-amber-600">{formatCurrency(invoice.outstandingAmount)}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-xs text-neutral-400">Customer</p>
              <p className="text-sm font-medium text-neutral-800">{invoice.customerName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Payment Date" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            <Input
              label="Amount Received"
              type="number"
              min="0"
              required
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Payment Method" options={paymentMethodOptions} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required />
            <Input label="Transaction Reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. TXN123456789" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Notes (Optional)</label>
            <textarea
              value={notes}
              maxLength={250}
              onChange={(event) => setNotes(event.target.value)}
              className="h-20 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>

          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
            <p className="text-sm font-semibold text-neutral-900">Payment Summary</p>
            <p className="text-xs text-neutral-500">This payment will update the invoice balance</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-neutral-400">Previous Outstanding</p>
                <p className="font-medium text-neutral-900">{formatCurrency(invoice.outstandingAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Amount Received</p>
                <p className="font-medium text-green-600">{formatCurrency(receivedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">New Outstanding</p>
                <p className="font-medium text-amber-600">{formatCurrency(newOutstanding)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" loading={isSaving}>
            <Upload className="size-4" />
            Save Payment
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
