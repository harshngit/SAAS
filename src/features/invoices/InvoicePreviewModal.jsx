import { createPortal } from 'react-dom'
import { Download, Printer, QrCode, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/format'

const primaryColor = '#16A34A'

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SimpleInvoicePreview({ invoice }) {
  return (
    <div className="space-y-4 text-sm text-neutral-600">
      <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: primaryColor }}>
        <div>
          <p className="text-base font-bold" style={{ color: primaryColor }}>SAAS CRM</p>
          <p className="mt-1 text-xs text-neutral-500">123, Business Park, Koramangala<br />Bangalore, Karnataka - 560095</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-neutral-900">{invoice.invoiceNumber}</p>
          <p className="text-xs text-neutral-500">{formatDateLabel(invoice.invoiceDate)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Billed To</p>
        <p className="mt-1 font-medium text-neutral-900">{invoice.billingAddress.name}</p>
        <p className="text-xs text-neutral-500">{invoice.billingAddress.city}, {invoice.billingAddress.state}</p>
      </div>

      <div className="space-y-1.5 border-t border-neutral-100 pt-3">
        {invoice.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span>{item.name} × {item.qty}</span>
            <span className="font-medium text-neutral-900">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-base font-semibold" style={{ color: primaryColor }}>
        <span>Total</span>
        <span>{formatCurrency(invoice.total)}</span>
      </div>

      {invoice.dueAmount > 0 && (
        <p className="text-right text-xs font-medium text-amber-600">Due {formatCurrency(invoice.dueAmount)} by {formatDateLabel(invoice.dueDate)}</p>
      )}

      <p className="text-center text-xs text-neutral-400">{invoice.notes}</p>
    </div>
  )
}

export function DetailedInvoicePreview({ invoice }) {
  return (
    <div className="space-y-4 text-sm text-neutral-600">
      <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
        <div>
          <p className="text-base font-bold" style={{ color: primaryColor }}>SAAS CRM</p>
          <p className="mt-1 text-xs leading-4 text-neutral-500">123, Business Park, Koramangala<br />Bangalore, Karnataka - 560095</p>
          <p className="text-xs text-neutral-500">GSTIN: 29ABCDE1234F1Z5</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tracking-wide text-neutral-900">TAX INVOICE</p>
          <p className="mt-1 text-xs text-neutral-500">Invoice No: {invoice.invoiceNumber}</p>
          <p className="text-xs text-neutral-500">Date: {formatDateLabel(invoice.invoiceDate)}</p>
          <p className="text-xs text-neutral-500">Due: {formatDateLabel(invoice.dueDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold text-neutral-700">Bill To</p>
          <p className="mt-1 text-neutral-500">
            {invoice.billingAddress.name}<br />{invoice.billingAddress.address}<br />
            {invoice.billingAddress.city}, {invoice.billingAddress.state} - {invoice.billingAddress.pincode}
          </p>
        </div>
        <div>
          <p className="font-semibold text-neutral-700">Ship To</p>
          <p className="mt-1 text-neutral-500">
            {invoice.shippingAddress.name}<br />{invoice.shippingAddress.address}<br />
            {invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.pincode}
          </p>
        </div>
      </div>

      <table className="w-full border-t border-neutral-200 text-left text-xs">
        <thead>
          <tr className="border-b border-neutral-200 uppercase text-neutral-400">
            <th className="py-1.5">Item</th>
            <th className="py-1.5">HSN</th>
            <th className="py-1.5">Qty</th>
            <th className="py-1.5">Rate</th>
            <th className="py-1.5">Tax</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.name} className="border-b border-neutral-50">
              <td className="py-1.5">{item.name}</td>
              <td className="py-1.5">{item.hsn}</td>
              <td className="py-1.5">{item.qty} {item.unit}</td>
              <td className="py-1.5">{formatCurrency(item.rate)}</td>
              <td className="py-1.5">{Math.round(item.gstRate * 100)}%</td>
              <td className="py-1.5 text-right">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-[11rem] space-y-1 border-t border-neutral-200 pt-3 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
        <div className="flex justify-between border-t border-neutral-200 pt-1 text-sm font-semibold" style={{ color: primaryColor }}>
          <span>Grand Total</span><span>{formatCurrency(invoice.total)}</span>
        </div>
        <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(invoice.paidAmount)}</span></div>
        <div className="flex justify-between text-amber-600"><span>Due</span><span>{formatCurrency(invoice.dueAmount)}</span></div>
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
          <QrCode className="size-4.5 text-neutral-400" />
        </div>
        <p>{invoice.bankDetails.bankName} · A/C {invoice.bankDetails.accountNumber} · IFSC {invoice.bankDetails.ifsc}</p>
      </div>

      <div className="border-t border-neutral-200 pt-3 text-xs">
        <p className="font-semibold text-neutral-700">Terms & Conditions</p>
        <ul className="mt-1 space-y-0.5 text-neutral-500">
          {invoice.termsAndConditions.map((term) => <li key={term}>• {term}</li>)}
        </ul>
      </div>

      <p className="border-t border-neutral-200 pt-3 text-center text-xs text-neutral-500">{invoice.notes}</p>
    </div>
  )
}

export function ThermalInvoicePreview({ invoice }) {
  const dashedLine = '- - - - - - - - - - - - - -'

  return (
    <div className="mx-auto max-w-52 space-y-2 text-center font-mono text-[0.7rem] leading-tight text-neutral-700">
      <p className="text-sm font-bold" style={{ color: primaryColor }}>SAAS CRM</p>
      <p className="text-neutral-500">123, Business Park, Koramangala</p>
      <p className="text-neutral-500">Bangalore, Karnataka - 560095</p>
      <p className="text-neutral-300">{dashedLine}</p>
      <p>{invoice.invoiceNumber}</p>
      <p className="text-neutral-500">{formatDateLabel(invoice.invoiceDate)}</p>
      <p className="text-neutral-500">Bill To: {invoice.billingAddress.name}</p>
      <p className="text-neutral-300">{dashedLine}</p>

      <div className="space-y-1 text-left">
        {invoice.items.map((item) => (
          <div key={item.name}>
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between text-neutral-500">
              <span>{item.qty} x {formatCurrency(item.rate)}</span>
              <span>{formatCurrency(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-neutral-300">{dashedLine}</p>
      <div className="space-y-0.5 text-left">
        <div className="flex justify-between text-neutral-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
        <div className="flex justify-between text-neutral-500"><span>Tax</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
        <div className="flex justify-between text-sm font-bold" style={{ color: primaryColor }}><span>TOTAL</span><span>{formatCurrency(invoice.total)}</span></div>
      </div>
      <p className="text-neutral-300">{dashedLine}</p>
      <p className="font-semibold text-neutral-700">{invoice.notes}</p>
    </div>
  )
}

const previewComponents = {
  Simple: SimpleInvoicePreview,
  Detailed: DetailedInvoicePreview,
  Thermal: ThermalInvoicePreview,
}

export default function InvoicePreviewModal({ isOpen, onClose, invoice, style }) {
  if (!isOpen || !invoice) return null

  const PreviewComponent = previewComponents[style] || SimpleInvoicePreview

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-popover)"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900">Invoice Preview</h2>
            <p className="text-xs text-neutral-400">{style} layout · {invoice.invoiceNumber}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
            <PreviewComponent invoice={invoice} />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-neutral-100 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Download className="size-4" />
            Download PDF
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
