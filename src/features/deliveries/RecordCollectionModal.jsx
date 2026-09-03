import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { createPaymentReceipt } from '../../api/paymentReceipts'
import { isDemoDelivery } from '../orders/orderDemoData'
import { formatCurrency } from '../../utils/format'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cod', label: 'COD / Other' },
]

const CARD_TYPE_OPTIONS = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
]

const field = 'h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12'

// Collection is a financial action, NOT a delivery status. Records a payment receipt against
// the delivery's customer once goods have been handed over.
export default function RecordCollectionModal({ delivery, isOpen, onClose, onRecorded }) {
  const amountDue = Number(delivery?.amountDue) || 0
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(amountDue ? String(amountDue) : '')
  const [reference, setReference] = useState('')
  const [upiId, setUpiId] = useState('')
  const [cardType, setCardType] = useState('credit')
  const [cardLastFour, setCardLastFour] = useState('')
  const [instructions, setInstructions] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [permissionGap, setPermissionGap] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const close = () => {
    if (isSaving) return
    setError('')
    setPermissionGap(false)
    onClose()
  }

  const invalid = useMemo(() => {
    const amt = Number(amount)
    if (!(amt > 0)) return 'Enter the amount collected.'
    if (method === 'upi' && !upiId.trim()) return 'Enter the UPI ID.'
    if (method === 'upi' && !reference.trim()) return 'Enter the transaction reference.'
    if (method === 'card' && !cardLastFour.trim()) return 'Enter the last 4 digits of the card.'
    if (method === 'card' && !reference.trim()) return 'Enter the transaction reference.'
    return ''
  }, [amount, method, upiId, reference, cardLastFour])

  const handleSave = async () => {
    if (isSaving) return
    if (invalid) {
      setError(invalid)
      return
    }

    setIsSaving(true)
    setError('')
    setPermissionGap(false)

    // Demo delivery: hand the collected amount + method back so the parent can simulate it
    // locally. No payment API is ever called for a demo id.
    if (isDemoDelivery(delivery?.id)) {
      setIsSaving(false)
      onRecorded?.({ amount: Number(amount), method })
      return
    }

    const result = await createPaymentReceipt({
      customerId: delivery.customerId,
      amountReceived: Number(amount),
      paymentMethod: method,
      transactionReference: reference.trim() || undefined,
      upiId: method === 'upi' ? upiId.trim() : undefined,
      cardType: method === 'card' ? cardType : undefined,
      cardLastFour: method === 'card' ? cardLastFour.trim() : undefined,
      collectionInstructions: method === 'cod' ? instructions.trim() || undefined : undefined,
      note: note.trim() || undefined,
    })

    if (!result.success) {
      // Show the real backend error - never pretend the collection was saved. A permission /
      // 403 failure means the Delivery Partner collection endpoint isn't live yet; the amount
      // stays as due for the accounts team. Clearly isolated integration point.
      setError(result.error)
      setPermissionGap(/permission|forbidden|not allowed|403|access denied|unauthori/i.test(result.error || ''))
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    onRecorded?.(result.receipt)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Record Collection"
      footer={
        <>
          <Button variant="secondary" disabled={isSaving} onClick={close}>Cancel</Button>
          <Button variant="primary" loading={isSaving} onClick={handleSave}>Record Collection</Button>
        </>
      }
    >
      <div className="space-y-4">
        {amountDue > 0 && (
          <p className="text-sm text-neutral-500">Amount due on this order: <span className="font-semibold text-neutral-900">{formatCurrency(amountDue)}</span></p>
        )}

        <Select label="Payment Method" options={METHOD_OPTIONS} value={method} onChange={(event) => setMethod(event.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">{method === 'cod' ? 'Amount Collected (if any)' : 'Amount'}</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
        </div>

        {method === 'upi' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">UPI ID</label>
            <input type="text" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="name@bank" className={field} />
          </div>
        )}

        {method === 'card' && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Card Type" options={CARD_TYPE_OPTIONS} value={cardType} onChange={(event) => setCardType(event.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Last 4 Digits</label>
              <input type="text" inputMode="numeric" maxLength={4} value={cardLastFour} onChange={(event) => setCardLastFour(event.target.value.replace(/\D/g, ''))} className={field} />
            </div>
          </div>
        )}

        {method === 'cod' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Collection Instructions</label>
            <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={300} className="h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            {method === 'cash' || method === 'cod' ? 'Reference (optional)' : 'Transaction Reference'}
          </label>
          <input type="text" value={reference} onChange={(event) => setReference(event.target.value)} className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">Notes (optional)</label>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {permissionGap && (
          <p className="text-xs text-neutral-500">
            Recording collections from the delivery app isn&apos;t enabled for your account yet. Nothing was saved —
            the amount stays as due for the accounts team to reconcile.
          </p>
        )}
      </div>
    </Modal>
  )
}
