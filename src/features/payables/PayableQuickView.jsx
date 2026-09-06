import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, IndianRupee, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/format'
import { paymentStatusMeta } from '../supplierInvoices/supplierInvoiceHelpers'
import { ageingBucket, dueCondition } from './payableHelpers'
import { getDemoPayable } from './payableDemoData'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-800">{value === 0 ? '0' : value || '—'}</p>
    </div>
  )
}

export default function PayableQuickView({ invoiceId, isOpen, refreshKey = 0, onClose, onRecordPayment, onOpenInvoice }) {
  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const payable = useMemo(() => (isOpen && invoiceId ? getDemoPayable(invoiceId) : null), [isOpen, invoiceId, refreshKey])

  if (!isOpen || !payable) return null

  const payment = paymentStatusMeta(payable.paymentStatus)
  const ageing = ageingBucket(payable.dueDate, payable.outstanding)
  const due = dueCondition(payable.dueDate, payable.outstanding)

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{payable.supplierInvoiceNumber}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">{payable.supplierName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={payment.variant} dot>{payment.label}</Badge>
            {due && <Badge variant={due.variant}>{due.label}</Badge>}
            {ageing && <Badge variant={ageing.variant}>{ageing.label}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Detail label="Supplier" value={payable.supplierName} />
            <Detail label="Invoice #" value={payable.supplierInvoiceNumber} />
            <Detail label="Invoice Date" value={formatDate(payable.invoiceDate)} />
            <Detail label="Due Date" value={formatDate(payable.dueDate)} />
            <Detail label="Invoice Total" value={formatCurrency(payable.invoiceTotal)} />
            <Detail label="Paid" value={formatCurrency(payable.amountPaid)} />
            <Detail label="Outstanding" value={formatCurrency(payable.outstanding)} />
            <Detail label="Ageing" value={ageing ? ageing.label : '—'} />
            <Detail label="Purchase reference" value={payable.purchaseNumber} />
            <Detail label="GRN reference" value={payable.grnNumber} />
          </div>
        </div>

        <div className="flex gap-3 border-t border-neutral-100 px-6 py-4">
          <Button
            type="button"
            className="flex-1"
            disabled={payable.outstanding <= 0}
            title={payable.outstanding <= 0 ? 'This invoice is fully paid.' : undefined}
            onClick={() => onRecordPayment?.(payable)}
          >
            <IndianRupee className="size-4" aria-hidden="true" />
            Record Payment
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onOpenInvoice}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Open Supplier Invoice
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
