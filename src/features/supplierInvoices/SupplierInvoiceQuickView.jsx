import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/format'
import { getDemoPurchase } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import {
  buildMatchRows,
  computeInvoiceLine,
  computeInvoiceTotals,
  derivePaymentStatusFromAmount,
  invoiceOutstanding,
  invoiceStatusMeta,
  paymentStatusMeta,
  summarizeMatch,
} from './supplierInvoiceHelpers'
import { getDemoSupplierInvoice } from './supplierInvoiceDemoData'

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

// Read-only quick look at a Supplier Invoice from inside Supplier Detail. No mutations here -
// the full detail page owns editing / payments / dispute. Demo-mode only (the tab that opens
// this is empty in real mode).
export default function SupplierInvoiceQuickView({ invoiceId, isOpen, onClose, onOpenFull }) {
  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const invoice = useMemo(() => (isOpen && invoiceId ? getDemoSupplierInvoice(invoiceId) : null), [isOpen, invoiceId])
  const derived = useMemo(() => {
    if (!invoice) return null
    const purchase = invoice.purchaseId ? getDemoPurchase(invoice.purchaseId) : null
    const grns = invoice.purchaseId ? getDemoGrns(invoice.purchaseId) : []
    const totals = computeInvoiceTotals(invoice.items, invoice.charges)
    const outstanding = invoiceOutstanding({ invoiceTotal: totals.invoiceTotal, amountPaid: invoice.amountPaid })
    const paymentStatus = derivePaymentStatusFromAmount(invoice.amountPaid, totals.invoiceTotal)
    const matchRows = purchase ? buildMatchRows(invoice, purchase, grns) : []
    const matchSummary = matchRows.length > 0 ? summarizeMatch(matchRows) : null
    return { totals, outstanding, paymentStatus, matchSummary }
  }, [invoice])

  if (!isOpen || !invoice || !derived) return null

  const status = invoiceStatusMeta(invoice.invoiceStatus)
  const payment = paymentStatusMeta(derived.paymentStatus)
  const { totals, outstanding, matchSummary } = derived

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{invoice.supplierInvoiceNumber}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant={payment.variant} dot>{payment.label}</Badge>
              {matchSummary && <Badge variant={matchSummary.overall.variant}>{matchSummary.overall.label}</Badge>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
            <Detail label="Due Date" value={formatDate(invoice.dueDate)} />
            <Detail label="Purchase #" value={invoice.purchaseNumber} />
            <Detail label="GRN #" value={invoice.grnNumber} />
            <Detail label="Invoice Total" value={formatCurrency(totals.invoiceTotal)} />
            <Detail label="Paid" value={formatCurrency(invoice.amountPaid)} />
            <Detail label="Outstanding" value={formatCurrency(outstanding)} />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Items</p>
            <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(invoice.items || []).map((item, index) => {
                    const line = computeInvoiceLine(item)
                    return (
                      <tr key={item.productId || index}>
                        <td className="px-3 py-2 font-medium text-neutral-900">{item.productName || 'Item'}</td>
                        <td className="px-3 py-2 text-right text-neutral-600">{line.quantity}</td>
                        <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium text-neutral-900">{formatCurrency(line.lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {matchSummary && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Verification</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Detail label="Ordered" value={formatCurrency(matchSummary.orderedValue)} />
                <Detail label="Received" value={formatCurrency(matchSummary.receivedValue)} />
                <Detail label="Billed" value={formatCurrency(matchSummary.invoicedValue)} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Result</p>
                  <div className="mt-1"><Badge variant={matchSummary.overall.variant}>{matchSummary.overall.label}</Badge></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="outline" className="w-full" onClick={onOpenFull}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Open Full Invoice
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
