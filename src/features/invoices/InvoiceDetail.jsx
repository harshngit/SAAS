import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  IndianRupee,
  Maximize2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Truck,
  User,
  Wallet,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { downloadInvoicePdf, getInvoice, getInvoiceSettings } from '../../api/invoices'
import { getOrganizationSettings } from '../../api/organizations'
import { templateComponents, money as formatPreviewMoney } from './invoiceTemplates'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { formatCurrency } from '../../utils/format'

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function downloadPreviewAsPdf(element, filename) {
  if (!element) {
    throw new Error('Invoice preview is not ready yet.')
  }

  const html2pdfModule = await import('html2pdf.js')
  const html2pdf = html2pdfModule.default || html2pdfModule

  return html2pdf()
    .set({
      margin: 6,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        onclone(clonedDoc) {
          const clonedRoot = clonedDoc.querySelector('[data-invoice-export-root]')
          if (clonedRoot) {
            clonedRoot.style.transform = 'none'
            clonedRoot.style.width = '32rem'
            clonedRoot.style.maxWidth = '100%'
            clonedRoot.style.boxShadow = 'none'
          }
        },
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(element)
    .save()
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

// Shapes real invoice + organization data exactly like invoiceTemplates.jsx's sampleInvoice,
// so the same template renderers used on the Invoice Settings page work here unmodified.
function buildInvoicePreviewData(invoice, org) {
  const company = org || {}

  return {
    company: {
      name: company.name || 'Your Company',
      address: company.registered_address || company.address || '',
      cityLine: [company.city, company.state, company.pin_code].filter(Boolean).join(', '),
      gstin: company.gst_number || '',
    },
    invoiceNo: invoice.invoiceNumber,
    invoiceDate: formatDateLabel(invoice.invoiceDate),
    dueDate: formatDateLabel(invoice.dueDate),
    billTo: {
      name: invoice.customerName || invoice.walkInName || 'Walk-in Customer',
      address: invoice.billingAddress || '',
      cityLine: '',
    },
    items: (invoice.items || []).map((item) => ({
      name: item.productName,
      hsn: item.hsnCode,
      qty: item.quantity,
      unit: '',
      rate: item.unitPrice,
      taxRate: item.taxRate,
      amount: item.lineTotal,
    })),
    subtotal: invoice.subtotal,
    taxTotal: invoice.tax,
    total: invoice.total,
    bank: {
      name: company.bank_name || '',
      account: company.bank_account_details || '',
      ifsc: company.bank_ifsc || '',
    },
  }
}

const ZOOM_MIN = 60
const ZOOM_MAX = 150
const ZOOM_STEP = 10
const previewPaymentStatusClass = {
  Paid: 'bg-green-100 text-green-700',
  Partial: 'bg-amber-100 text-amber-700',
  Unpaid: 'bg-red-100 text-red-700',
}

function InvoicePreviewCard({ invoice, orgSettings, invoiceSettings, isRefreshing, onRefresh, exportRef }) {
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const previewData = buildInvoicePreviewData(invoice, orgSettings)
  const template = invoiceSettings?.template || 'classic'
  const TemplateComponent = templateComponents[template] || templateComponents.classic
  const primaryColor = invoiceSettings?.branding?.primaryColor || '#16A34A'
  const fields = invoiceSettings?.fields || {}
  const footerText = invoiceSettings?.footerText || ''
  const terms = invoiceSettings?.terms || ''
  const templateLabel = template.charAt(0).toUpperCase() + template.slice(1)

  const previewDocument = (
    <div className="relative">
      <span
        className={`absolute right-0 top-0 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide ${
          previewPaymentStatusClass[invoice.paymentStatus] || 'bg-neutral-100 text-neutral-600'
        }`}
      >
        {invoice.paymentStatus}
      </span>
      <TemplateComponent primaryColor={primaryColor} fields={fields} footerText={footerText} terms={terms} data={previewData} />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-[0.62rem] uppercase tracking-wide text-neutral-400">Amount Paid</p>
          <p className="text-sm font-semibold text-green-600">{formatPreviewMoney(invoice.amountPaid)}</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-[0.62rem] uppercase tracking-wide text-amber-600">Due Amount</p>
          <p className="text-sm font-semibold text-amber-700">{formatPreviewMoney(invoice.outstandingAmount)}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
            <p className="text-xs text-neutral-400">{templateLabel} template</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out"
              className="flex size-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="w-10 text-center text-xs font-medium tabular-nums text-neutral-500">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in"
              className="flex size-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Expand preview"
              className="flex size-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            >
              <Maximize2 className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh preview"
              className="flex size-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-neutral-100 bg-neutral-50/60 p-4" style={{ maxHeight: '38rem' }}>
          <div
            ref={exportRef}
            data-invoice-export-root
            className="mx-auto origin-top bg-white p-5 text-xs text-neutral-600 shadow-(--shadow-xs)"
            style={{ transform: `scale(${zoom / 100})`, width: '32rem' }}
          >
            {previewDocument}
          </div>
        </div>
      </div>

      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`Invoice Preview — ${invoice.invoiceNumber}`} className="max-w-3xl">
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-neutral-100 bg-neutral-50/60 p-6">
          <div className="mx-auto max-w-xl bg-white p-6 text-sm text-neutral-600 shadow-(--shadow-xs)">
            {previewDocument}
          </div>
        </div>
      </Modal>
    </>
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
  const [orgSettings, setOrgSettings] = useState(null)
  const [invoiceSettings, setInvoiceSettings] = useState(null)
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false)
  const previewExportRef = useRef(null)

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

  // Best-effort: the preview still works (just without company letterhead/branding details)
  // if either of these fails or the current role can't reach organization-level settings.
  const loadPreviewExtras = async () => {
    setIsRefreshingPreview(true)
    const [orgResult, invoiceSettingsResult] = await Promise.all([getOrganizationSettings(), getInvoiceSettings()])
    if (orgResult.success) setOrgSettings(orgResult.organization)
    if (invoiceSettingsResult.success) setInvoiceSettings(invoiceSettingsResult.settings)
    setIsRefreshingPreview(false)
  }

  useEffect(() => {
    loadInvoice()
    loadPreviewExtras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber])

  const handleRefreshPreview = () => {
    loadInvoice()
    loadPreviewExtras()
  }

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

    try {
      if (format === 'detailed') {
        await downloadPreviewAsPdf(previewExportRef.current, `${invoice.invoiceNumber || invoice.id}.pdf`)
        return
      }

      const result = await downloadInvoicePdf(invoice.id, invoice.invoiceNumber, format)
      if (!result.success) setDownloadError(result.error)
    } catch (error) {
      setDownloadError(error?.message || 'Unable to download invoice PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <FileText className="size-4 text-neutral-400" aria-hidden="true" />
              Invoice Summary
            </p>
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

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <FileText className="size-4 text-neutral-400" aria-hidden="true" />
              Invoice Items
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">Item</th>
                    <th className="px-3.5 py-2.5">Qty</th>
                    <th className="px-3.5 py-2.5">Rate</th>
                    <th className="px-3.5 py-2.5">Discount</th>
                    <th className="px-3.5 py-2.5">Tax</th>
                    <th className="px-3.5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || item.productId}>
                      <td className="px-3.5 py-2.5 text-neutral-400">{index + 1}</td>
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

          {invoice.deliveryId && (
            <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Truck className="size-4 text-neutral-400" /> Linked Delivery
              </p>
              <Link to={`/admin/deliveries/${invoice.deliveryId}`} className="mt-2 inline-block text-sm text-primary-700 hover:underline">
                View delivery
              </Link>
            </div>
          )}
        </div>

        <div>
          <InvoicePreviewCard
            invoice={invoice}
            orgSettings={orgSettings}
            invoiceSettings={invoiceSettings}
            isRefreshing={isRefreshingPreview}
            onRefresh={handleRefreshPreview}
            exportRef={previewExportRef}
          />
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
