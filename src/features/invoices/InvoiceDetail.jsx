import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Mail,
  MessageCircle,
  MoreVertical,
  Printer,
  Share2,
  Truck,
  User,
  Wallet,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import InvoicePreviewModal, { DetailedInvoicePreview, SimpleInvoicePreview, ThermalInvoicePreview } from './InvoicePreviewModal'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { getInvoiceByNumber, invoiceStatusBadgeVariant, paymentStatusBadgeVariant } from '../../mockData/invoices'
import { formatCurrency } from '../../utils/format'

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTimeLabel(dateString) {
  if (!dateString) return '—'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const previewTabs = ['Simple', 'Detailed', 'Thermal']

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

function SummaryBox({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <Icon className="size-4 text-neutral-400" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-2.5 text-sm text-neutral-500">{children}</div>
    </div>
  )
}

const thumbnailPreviewComponents = {
  Simple: SimpleInvoicePreview,
  Detailed: DetailedInvoicePreview,
  Thermal: ThermalInvoicePreview,
}

// Renders the real preview component at its natural size, then scales it down with a CSS
// transform so the thumbnail always matches what the popup actually shows (never a hand-drawn
// stand-in that can drift out of sync with the real layout).
function PreviewThumbnail({ style, invoice }) {
  const PreviewComponent = thumbnailPreviewComponents[style] || SimpleInvoicePreview
  const baseWidth = style === 'Thermal' ? 208 : 400
  const scale = 96 / baseWidth

  return (
    <div className="relative flex-1 overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: baseWidth, transform: `scale(${scale})` }}
      >
        <PreviewComponent invoice={invoice} />
      </div>
    </div>
  )
}

export default function InvoiceDetail() {
  const { invoiceNumber } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [invoice, setInvoice] = useState(() => getInvoiceByNumber(invoiceNumber))
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false)
  const [activePreviewTab, setActivePreviewTab] = useState('Simple')
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  const timeline = useMemo(() => {
    if (!invoice) return []

    const paymentEvents = invoice.payments.map((payment, index) => ({
      key: `payment-${index}`,
      status: 'done',
      title: index === invoice.payments.length - 1 && invoice.dueAmount > 0 ? 'Payment Received (Partial)' : 'Payment Received',
      detail: `${formatCurrency(payment.amount)} via ${payment.method}${payment.reference && payment.reference !== '-' ? ` • Ref: ${payment.reference}` : ''}`,
      time: formatDateTimeLabel(payment.date),
    }))

    if (invoice.dueAmount > 0) {
      paymentEvents.push({
        key: 'due',
        status: 'pending',
        title: 'Payment Due',
        detail: formatCurrency(invoice.dueAmount),
        time: formatDateLabel(invoice.dueDate),
      })
    }

    return paymentEvents
  }, [invoice])

  if (!invoice) {
    return (
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-10 text-center shadow-(--shadow-card)">
        <p className="text-sm text-neutral-500">Invoice {invoiceNumber} was not found.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/admin/invoices')}>
          Back to Invoices
        </Button>
      </div>
    )
  }

  const handleSavePayment = (payment) => {
    setInvoice((current) => {
      const paidAmount = Math.round((current.paidAmount + payment.amount) * 100) / 100
      const dueAmount = Math.max(0, Math.round((current.total - paidAmount) * 100) / 100)
      const paymentStatus = dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : current.paymentStatus

      return {
        ...current,
        paidAmount,
        dueAmount,
        paymentStatus,
        payments: [...current.payments, payment],
      }
    })
    setIsPaymentDrawerOpen(false)
    showToast({ title: 'Payment recorded', message: `${formatCurrency(payment.amount)} recorded against ${invoice.invoiceNumber}.` })
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
            <Badge variant="primary">Sales Invoice</Badge>
          </div>
          <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">{invoice.invoiceNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {invoice.dueAmount > 0 && (
            <Button type="button" onClick={() => setIsPaymentDrawerOpen(true)}>
              <Wallet className="size-4" />
              Record Payment
            </Button>
          )}
          <Button type="button" variant="outline">
            <Share2 className="size-4" />
            Share
          </Button>
          <Button type="button" variant="outline">
            <Download className="size-4" />
            Download PDF
          </Button>
          <Button type="button" variant="outline">
            <Printer className="size-4" />
            Print
          </Button>
          <button type="button" aria-label="More actions" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card) sm:grid-cols-3">
        <HeaderInfoItem icon={User} iconClassName="bg-neutral-100 text-neutral-500" label="Customer">
          {invoice.customerName}
        </HeaderInfoItem>
        <HeaderInfoItem icon={Circle} iconClassName="bg-green-50 text-green-600" label="Invoice Status">
          <Badge variant={invoiceStatusBadgeVariant(invoice.invoiceStatus)} dot>{invoice.invoiceStatus}</Badge>
        </HeaderInfoItem>
        <HeaderInfoItem icon={Circle} iconClassName="bg-amber-50 text-amber-600" label="Payment Status">
          <Badge variant={paymentStatusBadgeVariant(invoice.paymentStatus)} dot>{invoice.paymentStatus}</Badge>
        </HeaderInfoItem>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Invoice Summary</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryBox icon={User} title="Bill To">
                <p className="font-medium text-neutral-900">{invoice.billingAddress.name}</p>
                <p className="mt-1">{invoice.billingAddress.address}</p>
                <p>{invoice.billingAddress.city}, {invoice.billingAddress.state} - {invoice.billingAddress.pincode}</p>
                <p>India</p>
                {invoice.billingAddress.gstin && <p className="mt-1">GSTIN: {invoice.billingAddress.gstin}</p>}
              </SummaryBox>
              <SummaryBox icon={Truck} title="Ship To">
                <p className="font-medium text-neutral-900">{invoice.shippingAddress.name}</p>
                <p className="mt-1">{invoice.shippingAddress.address}</p>
                <p>{invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.pincode}</p>
                <p>India</p>
              </SummaryBox>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Calendar className="size-4 text-neutral-400" aria-hidden="true" />
                </p>
                <div className="mt-1 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Invoice Date</span>
                    <span className="font-medium text-neutral-800">{formatDateLabel(invoice.invoiceDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Due Date</span>
                    <span className="font-medium text-neutral-800">{formatDateLabel(invoice.dueDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Linked Order</span>
                    <span className="font-medium text-primary-700">{invoice.orderNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400">Sales Person</span>
                    <span className="font-medium text-neutral-800">{invoice.salesPerson}</span>
                  </div>
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
                    <th className="px-3.5 py-2.5">HSN</th>
                    <th className="px-3.5 py-2.5">Qty</th>
                    <th className="px-3.5 py-2.5">Rate</th>
                    <th className="px-3.5 py-2.5">Discount</th>
                    <th className="px-3.5 py-2.5">Tax</th>
                    <th className="px-3.5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {invoice.items.map((item) => (
                    <tr key={item.name}>
                      <td className="px-3.5 py-2.5 text-neutral-800">{item.name}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{item.hsn}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{item.qty} {item.unit}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{formatCurrency(item.rate)}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{formatCurrency(item.discountAmount)}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500">{Math.round(item.gstRate * 100)}% GST</td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(item.amount)}</td>
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
                <span className="text-neutral-500">Total Discount</span>
                <span className="font-medium text-red-500">{formatCurrency(invoice.discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Total Tax</span>
                <span className="font-medium text-neutral-800">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-base">
                <span className="font-semibold text-neutral-900">Grand Total</span>
                <span className="font-semibold text-primary-700">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-600">Amount Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-600">Due Amount</span>
                <span className="font-medium text-amber-600">{formatCurrency(invoice.dueAmount)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <FileText className="size-4 text-neutral-400" /> Notes
              </p>
              <p className="mt-2 text-sm text-neutral-600">{invoice.notes}</p>
            </div>
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="text-sm font-semibold text-neutral-900">Terms & Conditions</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                {invoice.termsAndConditions.map((term) => (
                  <li key={term}>• {term}</li>
                ))}
              </ul>
            </div>
          </div>
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
                <p className="font-medium text-green-600">{formatCurrency(invoice.paidAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Due Amount</p>
                <p className="font-medium text-amber-600">{formatCurrency(invoice.dueAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Due Date</p>
                <p className="font-medium text-neutral-800">{formatDateLabel(invoice.dueDate)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Payment Timeline</p>
            <div className="mt-4 space-y-5">
              {timeline.map((event, index) => (
                <div key={event.key} className="relative flex gap-3 pb-1 pl-0.5">
                  {index !== timeline.length - 1 && (
                    <span className="absolute left-[0.4375rem] top-5 h-full w-px bg-neutral-100" aria-hidden="true" />
                  )}
                  <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                    {event.status === 'done' ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <Circle className="size-3.5 text-neutral-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm font-medium ${event.status === 'done' ? 'text-neutral-900' : 'text-neutral-500'}`}>{event.title}</p>
                      <span className="shrink-0 text-xs text-neutral-400">{event.time}</span>
                    </div>
                    <p className={`text-xs ${event.status === 'done' ? 'text-neutral-500' : 'text-amber-600'}`}>{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Quick Share</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button type="button" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                <MessageCircle className="size-4" />
                Share on WhatsApp
              </Button>
              <Button type="button" variant="outline">
                <Mail className="size-4" />
                Share via Email
              </Button>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
              <p className="text-xs text-neutral-400">Click a layout to open it</p>
            </div>
            <div className="mt-3 inline-flex rounded-full bg-neutral-100 p-1">
              {previewTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivePreviewTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    activePreviewTab === tab ? 'bg-white text-primary-700 shadow-(--shadow-xs)' : 'text-neutral-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {previewTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActivePreviewTab(tab)
                    setIsPreviewModalOpen(true)
                  }}
                  className={`group relative flex aspect-3/4 flex-col overflow-hidden rounded-lg border-2 bg-white p-2 text-left transition-colors hover:border-primary-300 ${
                    activePreviewTab === tab ? 'border-primary-500' : 'border-neutral-100'
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/0 opacity-0 transition-all group-hover:bg-neutral-900/40 group-hover:opacity-100">
                    <Eye className="size-5 text-white" />
                  </div>
                  <PreviewThumbnail style={tab} invoice={invoice} />
                  <p className="mt-auto pt-1 text-[0.62rem] font-medium text-neutral-400">{tab}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={invoice}
        style={activePreviewTab}
      />

      <RecordPaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        invoice={invoice}
        onSave={handleSavePayment}
      />
    </div>
  )
}
