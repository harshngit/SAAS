import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { createDeliveryCollection } from '../../api/deliveryCollections'
import { formatCurrency } from '../../utils/format'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cod', label: 'Other' },
]

const field = 'h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12'

// A Collection is money the Delivery Partner physically takes - NOT a payment and NOT a
// delivery status. The Accountant later reconciles it, and the backend then creates one
// CustomerPayment. This form only records the raw collection: Amount / Mode / Reference / Notes.
export default function RecordCollectionModal({ delivery, isOpen, onClose, onRecorded }) {
  const amountDue = Number(delivery?.amountDue) || 0
  const orderTotal = Number(delivery?.orderTotal ?? delivery?.order?.total) || 0
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(amountDue ? String(amountDue) : '')
  const [reference, setReference] = useState('')
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
    if (!(Number(amount) > 0)) return 'Enter the amount collected.'
    return ''
  }, [amount])

  const handleSave = async () => {
    if (isSaving) return
    if (invalid) {
      setError(invalid)
      return
    }

    setIsSaving(true)
    setError('')
    setPermissionGap(false)

    const result = await createDeliveryCollection(delivery.id, {
      amount: Number(amount),
      paymentMode: method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      // Demo-only context so the local simulation ties the collection to this delivery/order.
      context: {
        deliveryNumber: delivery.deliveryNumber,
        orderId: delivery.orderId,
        orderNumber: delivery.orderNumber,
        customerId: delivery.customerId,
        customerName: delivery.customerName || delivery.customerBusinessName,
        deliveryPartnerId: delivery.deliveryPartnerId,
        deliveryPartnerName: delivery.deliveryPartnerName,
        orderTotal: orderTotal || null,
        outstandingAmount: amountDue || null,
      },
    })

    if (!result.success) {
      // Never pretend it saved. A 403 / "not available" means the collections endpoint isn't
      // live for this account yet - the amount stays as due for the accounts team.
      setError(result.error)
      setPermissionGap(/permission|forbidden|not allowed|403|not available|access denied|unauthori/i.test(result.error || ''))
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    onRecorded?.(result.collection)
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
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 text-sm">
          {orderTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Order Total</span>
              <span className="font-medium text-neutral-800">{formatCurrency(orderTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Amount Due</span>
            <span className="font-semibold text-neutral-900">{formatCurrency(amountDue)}</span>
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">
            Recording a collection does not mark the invoice paid — the accounts team reconciles it.
          </p>
        </div>

        <Select label="Payment Mode" options={METHOD_OPTIONS} value={method} onChange={(event) => setMethod(event.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">Amount</label>
          <input type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">Reference {method === 'cash' ? '(optional)' : ''}</label>
          <input type="text" value={reference} onChange={(event) => setReference(event.target.value)} className={field} placeholder="Txn / cheque / UPI reference" />
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
