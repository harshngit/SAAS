import { useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { rejectDelivery } from '../../api/deliveries'

// Shared reject flow used by the delivery list and the delivery detail page.
// On success the parent gets the updated delivery (or just a signal) via onRejected.
export default function RejectDeliveryModal({ delivery, isOpen, onClose, onRejected }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  const close = () => {
    if (isRejecting) return
    setReason('')
    setError('')
    onClose()
  }

  const handleReject = async () => {
    if (isRejecting || !delivery?.id) return
    if (!reason.trim()) {
      setError('Enter a reason for rejecting this delivery.')
      return
    }

    setIsRejecting(true)
    setError('')

    const result = await rejectDelivery(delivery.id, reason.trim())

    if (!result.success) {
      setError(result.error)
      setIsRejecting(false)
      return
    }

    setIsRejecting(false)
    setReason('')
    onRejected?.(result.delivery || null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Reject Delivery"
      footer={
        <>
          <Button variant="secondary" disabled={isRejecting} onClick={close}>Cancel</Button>
          <Button variant="danger" loading={isRejecting} onClick={handleReject}>Reject Delivery</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-neutral-600">
          Reject {delivery?.deliveryNumber || delivery?.orderNumber || 'this delivery'}? It leaves your queue and
          the sales team is notified to reassign it.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">Reason</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why can't you take this delivery?"
            maxLength={500}
            className="h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
        </div>
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
      </div>
    </Modal>
  )
}
