import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, ExternalLink, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { formatCurrency } from '../../utils/format'
import { computeInvoiceTotals, invoiceOutstanding } from '../supplierInvoices/supplierInvoiceHelpers'
import { getDemoSupplierInvoice } from '../supplierInvoices/supplierInvoiceDemoData'
import { paymentModeLabel, paymentStatusMeta } from './supplierPaymentHelpers'
import { getSupplierPayment, voidSupplierPaymentDemo } from './supplierPaymentDemoData'

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

// supplierBasePath is null when there is no valid supplier-detail route for the current
// workspace (e.g. Accountant has no /accounts/suppliers), in which case "View Supplier" is hidden.
export default function SupplierPaymentQuickView({ paymentId, isOpen, onClose, onVoided, invoiceBasePath, supplierBasePath = null }) {
  const [tick, setTick] = useState(0)
  const [mode, setMode] = useState('view')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setMode('view')
      setReason('')
      setError('')
    }
  }, [isOpen, paymentId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const payment = useMemo(() => (isOpen && paymentId ? getSupplierPayment(paymentId) : null), [isOpen, paymentId, tick])

  const allocationRows = useMemo(() => {
    if (!payment) return []
    return (payment.allocations || []).map((allocation) => {
      const invoice = getDemoSupplierInvoice(allocation.invoiceId)
      const totals = invoice ? computeInvoiceTotals(invoice.items, invoice.charges) : { invoiceTotal: 0 }
      const outstanding = invoice
        ? invoiceOutstanding({ invoiceTotal: totals.invoiceTotal, amountPaid: invoice.amountPaid })
        : 0
      return {
        invoiceId: allocation.invoiceId,
        supplierInvoiceNumber: allocation.supplierInvoiceNumber || invoice?.supplierInvoiceNumber || '—',
        allocated: allocation.amount,
        invoiceTotal: totals.invoiceTotal,
        outstandingAfter: outstanding,
      }
    })
  }, [payment])

  if (!isOpen || !payment) return null

  const status = paymentStatusMeta(payment.status)

  const handleVoid = () => {
    setError('')
    if (!reason.trim()) {
      setError('A reason is required to void a payment.')
      return
    }
    setIsVoiding(true)
    voidSupplierPaymentDemo(payment.id, reason)
    setIsVoiding(false)
    setTick((value) => value + 1)
    setMode('view')
    onVoided?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">{payment.paymentNumber}</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">{payment.supplierName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        {mode === 'view' ? (
          <>
            <div className="flex-1 space-y-6 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Payment Date" value={formatDate(payment.paymentDate)} />
                <Detail label="Amount" value={formatCurrency(payment.amount)} />
                <Detail label="Payment Mode" value={paymentModeLabel(payment.paymentMode)} />
                <Detail label="Reference" value={payment.reference} />
                <Detail label="Status" value={status.label} />
                <Detail label="Notes" value={payment.notes} />
              </div>

              {payment.status === 'voided' && payment.voidReason && (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  <span className="font-medium text-neutral-800">Void reason:</span> {payment.voidReason}
                </div>
              )}

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Allocation</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-100">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-3 py-2">Invoice #</th>
                        <th className="px-3 py-2 text-right">Allocated</th>
                        <th className="px-3 py-2 text-right">Invoice Total</th>
                        <th className="px-3 py-2 text-right">Outstanding After</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {allocationRows.map((row) => (
                        <tr key={row.invoiceId}>
                          <td className="px-3 py-2 font-medium text-primary-700">{row.supplierInvoiceNumber}</td>
                          <td className="px-3 py-2 text-right text-neutral-800">{formatCurrency(row.allocated)}</td>
                          <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(row.invoiceTotal)}</td>
                          <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(row.outstandingAfter)}</td>
                          <td className="px-3 py-2 text-right">
                            {invoiceBasePath && (
                              <a href={`${invoiceBasePath}/${row.invoiceId}`} className="text-xs font-medium text-primary-600 hover:text-primary-700">View</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-neutral-100 px-6 py-4">
              {supplierBasePath && (
                <a href={`${supplierBasePath}/${payment.supplierId}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  View Supplier
                </a>
              )}
              {payment.status === 'recorded' && (
                <Button type="button" variant="danger" className="flex-1" onClick={() => setMode('void')}>
                  <Ban className="size-4" aria-hidden="true" />
                  Void Payment
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 px-6 py-5">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <p className="text-sm leading-6 text-neutral-600">Void this supplier payment? The allocated amounts will be reversed on their invoices. The payment record stays visible as Voided.</p>
              <Input as="textarea" label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this payment being voided?" />
            </div>
            <div className="flex gap-3 border-t border-neutral-100 px-6 py-4">
              <Button type="button" variant="secondary" className="flex-1" disabled={isVoiding} onClick={() => setMode('view')}>Cancel</Button>
              <Button type="button" variant="danger" className="flex-1" loading={isVoiding} onClick={handleVoid}>Void Payment</Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
