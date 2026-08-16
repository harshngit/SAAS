import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  IndianRupee,
  Printer,
  Truck,
  User,
  Wallet,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { downloadInvoicePdf, getInvoice } from '../../api/invoices'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { formatCurrency } from '../../utils/format'

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const invoiceStatusVariant = { Issued: 'success', Draft: 'neutral', Cancelled: 'danger' }
const paymentStatusVariant = { Paid: 'success', Partial: 'warning', Unpaid: 'danger' }

function HeaderInfoItem({ icon: Icon, iconClassName, label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <div className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{children}</div>
      </div>
    </div>
  )
}

export default function InvoiceDetail() {
  const { invoiceNumber } = useParams()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const loadInvoice = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getInvoice(invoiceNumber)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setInvoice(result.invoice)
    setIsLoading(false)
  }

  useEffect(() => {
    loadInvoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber])

  if (isLoading) {
    return (
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-10 shadow-(--shadow-card)">
        <LoadingSpinner label="Loading invoice..." />
      </div>
    )
  }

  if (loadError || !invoice) {
    return (
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-10 text-center shadow-(--shadow-card)">
        <p className="text-sm text-neutral-500">{loadError || `Invoice ${invoiceNumber} was not found.`}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/admin/invoices')}>
          Back to Invoices
        </Button>
      </div>
    )
  }

  const handleDownload = async (format) => {
    setIsDownloading(true)
    setDownloadError('')

    const result = await downloadInvoicePdf(invoice.id, invoice.invoiceNumber, format)

    if (!result.success) setDownloadError(result.error)
    setIsDownloading(false)
  }

  const handlePaymentSaved = () => {
    setIsPaymentDrawerOpen(false)
    loadInvoice()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/admin/invoices"
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-primary-700 hover:bg-primary-50/60"
        >
          <ArrowLeft className="size-3.5" />
          Invoices
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-neutral-400">Invoice Details</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-neutral-900">Invoice Details</h1>
            {invoice.isCreditNote && <Badge variant="warning">Credit Note</Badge>}
          </div>
          <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">{invoice.invoiceNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {invoice.outstandingAmount > 0 && (
            <Button type="button" onClick={() => setIsPaymentDrawerOpen(true)}>
              <Wallet className="size-4" />
              Record Payment
            </Button>
          )}
          <Button type="button" variant="outline" loading={isDownloading} onClick={() => handleDownload('simple')}>
            <Printer className="size-4" />
            Simple PDF
          </Button>
          <Button type="button" variant="outline" loading={isDownloading} onClick={() => handleDownload('detailed')}>
            <Download className="size-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {downloadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError}</div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-3">
        <HeaderInfoItem icon={User} iconClassName="bg-neutral-100 text-neutral-500" label="Customer">
          {invoice.customerName || invoice.walkInName || '—'}
        </HeaderInfoItem>
        <HeaderInfoItem icon={FileText} iconClassName="bg-green-50 text-green-600" label="Invoice Status">
          <Badge variant={invoiceStatusVariant[invoice.invoiceStatus] || 'neutral'} dot>{invoice.invoiceStatus}</Badge>
        </HeaderInfoItem>
        <HeaderInfoItem icon={IndianRupee} iconClassName="bg-amber-50 text-amber-600" label="Payment Status">
          <Badge variant={paymentStatusVariant[invoice.paymentStatus] || 'neutral'} dot>{invoice.paymentStatus}</Badge>
        </HeaderInfoItem>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Invoice Summary</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                <p className="text-sm font-semibold text-neutral-700">Bill To</p>
                <p className="mt-2 text-sm text-neutral-600">{invoice.billingAddress || invoice.customerName || invoice.walkInName || '—'}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Calendar className="size-4 text-neutral-400" aria-hidden="true" />
                  Dates
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Invoice Date</span>
                    <span className="font-medium text-neutral-800">{formatDateLabel(invoice.invoiceDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Due Date</span>
                    <span className="font-medium text-neutral-800">{formatDateLabel(invoice.dueDate)}</span>
                  </div>
                  {invoice.orderId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400">Linked Order</span>
                      <Link to={`/admin/orders/${invoice.orderId}`} className="font-medium text-primary-700 hover:underline">View Order</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3.5 py-2.5">Item</th>
                    <th className="px-3.5 py-2.5">Qty</th>
                    <th className="px-3.5 py-2.5">Rate</th>
                    <th className="px-3.5 py-2.5">Discount</th>
                    <th className="px-3.5 py-2.5">Tax</th>
                    <th className="px-3.5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {invoice.items.map((item) => (
                    <tr key={item.id || item.productId}>
                      <td className="px-3.5 py-2.5 text-neutral-800">{item.productName}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{item.quantity}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{item.discount ? `${item.discount}%` : '—'}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{item.taxRate ? `${item.taxRate}% GST` : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium text-neutral-800">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Discount</span>
                <span className="font-medium text-red-500">{formatCurrency(invoice.discount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Tax</span>
                <span className="font-medium text-neutral-800">{formatCurrency(invoice.tax)}</span>
              </div>
              {invoice.additionalCharges > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Additional Charges</span>
                  <span className="font-medium text-neutral-800">{formatCurrency(invoice.additionalCharges)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-base">
                <span className="font-semibold text-neutral-900">Grand Total</span>
                <span className="font-semibold text-primary-700">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-600">Amount Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-600">Due Amount</span>
                <span className="font-medium text-amber-600">{formatCurrency(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <FileText className="size-4 text-neutral-400" /> Notes
              </p>
              <p className="mt-2 text-sm text-neutral-600">{invoice.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Payment Summary</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
                <IndianRupee className="size-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-400">Total Amount</p>
                <p className="text-xl font-semibold text-neutral-900">{formatCurrency(invoice.total)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4 text-sm">
              <div>
                <p className="text-xs text-neutral-400">Paid Amount</p>
                <p className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Due Amount</p>
                <p className="font-medium text-amber-600">{formatCurrency(invoice.outstandingAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Due Date</p>
                <p className="font-medium text-neutral-800">{formatDateLabel(invoice.dueDate)}</p>
              </div>
            </div>
          </div>

          {invoice.deliveryId && (
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Truck className="size-4 text-neutral-400" /> Linked Delivery
              </p>
              <Link to={`/admin/deliveries/by-id/${invoice.deliveryId}`} className="mt-2 inline-block text-sm text-primary-700 hover:underline">
                View delivery
              </Link>
            </div>
          )}
        </div>
      </div>

      <RecordPaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        invoice={invoice}
        onSave={handlePaymentSaved}
      />
    </div>
  )
}
