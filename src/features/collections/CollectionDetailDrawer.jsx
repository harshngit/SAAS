import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { getFileUrl } from '../../api/files'
import { formatCurrency } from '../../utils/format'
import {
  COLLECTION_STATUS_VARIANT,
  formatCollectionSource,
  formatBusinessDate,
  formatCollectorRole,
  formatPaymentMode,
  formatStatus,
  isReconcilable,
  isVoidable,
  linkedValue,
  nameOrNotAvailable,
} from './collectionHelpers'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-neutral-400">{label}</span>
      <span className="text-right font-medium text-neutral-800">{children ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      <div className="mt-2 divide-y divide-neutral-100">{children}</div>
    </div>
  )
}

// Read-only detail for one collection. `onReconcile` / `onVoid` are optional and only
// wired where the current role is allowed to act. Lifecycle wording everywhere: Collected -> Confirm Payment -> Completed.
export default function CollectionDetailDrawer({ collection, isOpen, onClose, onReconcile, onVoid, canReconcile, busy }) {
  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !collection) return null

  const showActions = canReconcile && (isReconcilable(collection) || isVoidable(collection))
  const statusText = formatStatus(collection)
  const proofUrl = getFileUrl(collection.paymentProofUrl)

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* No real collection number exists on this record (the backend doesn't send
                  one) - the customer's name is the meaningful thing to lead with instead of
                  this collection's own raw id. */}
              <h2 className="truncate text-lg font-semibold text-neutral-900">{nameOrNotAvailable(collection.customerName)}</h2>
              <Badge variant={COLLECTION_STATUS_VARIANT[collection.status] || 'neutral'} dot>
                {statusText}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {formatCurrency(collection.amount)} · {formatDateTime(collection.recordedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 px-6 py-5">
          <Section title="Collection Details">
            <Row label="Amount">{formatCurrency(collection.amount)}</Row>
            <Row label="Payment Mode">{formatPaymentMode(collection.paymentMode)}</Row>
            <Row label="Reference">{collection.reference || '—'}</Row>
            <Row label="Payment Proof">
              {proofUrl ? (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                >
                  View proof
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Notes">{collection.note || '—'}</Row>
            <Row label="Collected By">{nameOrNotAvailable(collection.recordedByName)}</Row>
            {collection.recordedByRole && <Row label="Role">{formatCollectorRole(collection.recordedByRole)}</Row>}
            <Row label="Payment Date">{formatBusinessDate(collection.paymentDate)}</Row>
            <Row label="Collected At">{formatDateTime(collection.recordedAt)}</Row>
          </Section>

          <Section title="Source Delivery / Order">
            {collection.source && <Row label="Source">{formatCollectionSource(collection.source)}</Row>}
            <Row label="Delivery #">{linkedValue(collection.deliveryNumber, collection.deliveryId)}</Row>
            <Row label="Order #">{linkedValue(collection.orderNumber, collection.orderId)}</Row>
            <Row label="Customer">{nameOrNotAvailable(collection.customerName)}</Row>
            {collection.deliveryPartnerName && <Row label="Delivery Partner">{collection.deliveryPartnerName}</Row>}
            <Row label="Invoice">{collection.invoiceNumber || 'Not linked'}</Row>
            {collection.orderTotal != null && <Row label="Order Total">{formatCurrency(collection.orderTotal)}</Row>}
            {collection.outstandingAtRecording != null ? (
              <Row label="Outstanding at Recording">{formatCurrency(collection.outstandingAtRecording)}</Row>
            ) : collection.outstandingAmount != null ? (
              <Row label="Current Outstanding">{formatCurrency(collection.outstandingAmount)}</Row>
            ) : null}
          </Section>

          <Section title="Payment Confirmation">
            <Row label="Status">{statusText}</Row>
            {collection.status === 'reconciled' && (
              <>
                <Row label="Customer Payment #">{collection.customerPaymentNumber || '—'}</Row>
                <Row label="Completed At">{formatDateTime(collection.reconciledAt)}</Row>
                <Row label="Completed By">{nameOrNotAvailable(collection.reconciledByName)}</Row>
              </>
            )}
            {collection.status === 'voided' && (
              <>
                <Row label="Void Reason">{collection.voidReason || '—'}</Row>
                <Row label="Voided At">{formatDateTime(collection.voidedAt)}</Row>
                <Row label="Voided By">{collection.voidedByName || '—'}</Row>
              </>
            )}
            {collection.status === 'recorded' && (
              <p className="py-1.5 text-xs text-neutral-500">
                Money received, not completed yet. Check the amount, proof and handover, then Confirm Payment to complete it and update the customer balance.
              </p>
            )}
          </Section>
        </div>

        {showActions && (
          <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
            {isVoidable(collection) && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => onVoid?.(collection)}>
                Void
              </Button>
            )}
            {isReconcilable(collection) && (
              <Button type="button" loading={busy} onClick={() => onReconcile?.(collection)}>
                Confirm Payment
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
