import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  Receipt,
  RefreshCw,
  Truck,
  User,
  Wallet,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { downloadInvoicePdf, getInvoice, getInvoiceSettings, getInvoiceTemplates } from '../../api/invoices'
import { listPaymentReceipts } from '../../api/paymentReceipts'
import { getOrganizationSettings } from '../../api/organizations'
import { usePermission } from '../../auth/usePermission'
import { templateComponents, RegularThemePreview, ThermalPreview, money as formatPreviewMoney, buildInvoicePreviewData } from './invoiceTemplates'
import { reconcileInvoiceThemeCatalog, resolveRegularPresetId, thermalWidthPx } from './invoiceThemePresets'
import { INVOICE_DEMO_ENABLED } from './invoiceDemoData'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import InvoicePaymentLinks from './InvoicePaymentLinks'
import { FINANCIAL_STATUS_VARIANT, financialStatus } from './invoiceHelpers'
import { formatCurrency, formatCurrencyExact } from '../../utils/format'
import { exportElementToPdf } from '../../utils/pdfExport'
import { loadInvoicePreviewSources } from './invoicePreviewSources'

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

const ZOOM_MIN = 60
const ZOOM_MAX = 150
const ZOOM_STEP = 10
const previewPaymentStatusClass = {
  Paid: 'bg-green-100 text-green-700',
  Partial: 'bg-amber-100 text-amber-700',
  Unpaid: 'bg-red-100 text-red-700',
}

function InvoicePreviewCard({ invoice, orgSettings, invoiceSettings, themeSelection, isRefreshing, onRefresh }) {
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [previewFormat, setPreviewFormat] = useState('detailed')

  const previewData = buildInvoicePreviewData(invoice, orgSettings, invoiceSettings)
  const template = invoiceSettings?.template || themeSelection?.template || 'classic'
  const isThermalTemplate = template === 'thermal'
  // Regular invoices render through the persisted `template_variant` preset (e.g. "GST Theme 3"),
  // not just the plain base `template` - RegularThemePreview + resolveRegularPresetId are the
  // same preset-aware renderer/resolver the Invoice Settings Live Preview uses, so a real invoice
  // actually looks like the theme the org selected, falling back safely to the base template card
  // if `templateVariant` is unset or names a preset no longer in the catalog.
  const TemplateComponent = isThermalTemplate ? templateComponents.thermal : RegularThemePreview
  const regularPresetId = resolveRegularPresetId(template, themeSelection?.resolved_template_variant || invoiceSettings?.templateVariant)
  const primaryColor = invoiceSettings?.branding?.primaryColor || '#00092A'
  const templateLabel = template.charAt(0).toUpperCase() + template.slice(1)

  const templateProps = {
    presetId: regularPresetId,
    format: previewFormat,
    primaryColor,
    data: previewData,
    businessDetails: invoiceSettings?.businessDetails,
    invoiceDetails: invoiceSettings?.invoiceDetails,
    partyDetails: invoiceSettings?.partyDetails,
    itemTable: invoiceSettings?.itemTable,
    paymentDetails: invoiceSettings?.paymentDetails,
    footer: invoiceSettings?.footer,
    fields: invoiceSettings?.fields,
    typography: invoiceSettings?.typography,
    thermalPresetId: invoiceSettings?.thermalPrint?.layout || themeSelection?.thermal_layout,
    thermalBoldText: invoiceSettings?.thermalPrint?.boldText,
    thermalExtraLines: invoiceSettings?.thermalPrint?.extraLines,
  }

  const previewDocument = (
    <div>
      {/* Payment-status pill on its own row above the document — an absolute overlay here
          collided with the template header ("TAX INVOICE" in Classic, "Invoice" in Modern).
          It is never part of the printable invoice itself, which must never show payment
          status (PAID/UNPAID/Paid Amount/Balance Due) — only this admin-facing page may. */}
      <div className="mb-3 flex justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide ${
            previewPaymentStatusClass[invoice.paymentStatus] || 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {invoice.paymentStatus}
        </span>
      </div>
      <TemplateComponent {...templateProps} />
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
      <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
            <p className="text-xs text-neutral-400">{templateLabel} template</p>
          </div>
          <div className="flex items-center gap-1">
            {!isThermalTemplate && <Select className="w-32" triggerClassName="h-8 py-1.5" options={[{ value: 'detailed', label: 'Detailed' }, { value: 'simple', label: 'Simple' }]} value={previewFormat} onChange={(event) => setPreviewFormat(event.target.value)} />}
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
            className="mx-auto origin-top bg-surface p-5 text-xs text-neutral-600 shadow-(--shadow-xs)"
            style={{ transform: `scale(${zoom / 100})`, width: '640px' }}
          >
            {previewDocument}
          </div>
        </div>
      </div>

      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`Invoice Preview — ${invoice.invoiceNumber}`} className="max-w-3xl">
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-neutral-100 bg-neutral-50/60 p-6">
          <div className="mx-auto max-w-xl bg-surface p-6 text-sm text-neutral-600 shadow-(--shadow-xs)">
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
  const { pathname } = useLocation()
  const invoicesBase = pathname.startsWith('/accounts') ? '/accounts/invoices/sales' : '/admin/invoices'
  const { can } = usePermission()
  // Recording a customer payment is a financial transaction - gate it on payments:create only.
  const canRecordPayment = can('payments', 'create')

  const [invoice, setInvoice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [payments, setPayments] = useState([])
  const [showVoided, setShowVoided] = useState(false)
  const showVoidedRef = useRef(false)
  const [paymentsError, setPaymentsError] = useState('')
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isExportingDetailed, setIsExportingDetailed] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [orgSettings, setOrgSettings] = useState(null)
  const [invoiceSettings, setInvoiceSettings] = useState(null)
  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false)
  const [themeSelection, setThemeSelection] = useState(null)
  const [previewWarnings, setPreviewWarnings] = useState([])
  const thermalExportRef = useRef(null)
  const detailedExportRef = useRef(null)
  const invoiceRequest = useRef(0)

  const loadInvoice = async () => {
    const requestId = ++invoiceRequest.current
    setIsLoading(true)
    setLoadError('')

    setIsRefreshingPreview(true)
    const [result, orgResult, settingsResult, catalogResult] = await Promise.all([
      getInvoice(invoiceNumber), getOrganizationSettings(), getInvoiceSettings(), getInvoiceTemplates(),
    ])
    if (requestId !== invoiceRequest.current) return
    setOrgSettings(orgResult.success ? orgResult.organization : null)
    setInvoiceSettings(settingsResult.success ? settingsResult.settings : null)
    setThemeSelection(catalogResult.success ? catalogResult.catalog.selected : null)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      setIsRefreshingPreview(false)
      return
    }

    const sources = INVOICE_DEMO_ENABLED ? { invoice: result.invoice, warnings: [] }
      : await loadInvoicePreviewSources(result.invoice, { includeMrp: settingsResult.settings?.itemTable?.columns?.includes('mrp') })
    if (requestId !== invoiceRequest.current) return
    setPreviewWarnings([
      ...sources.warnings,
      ...(sources.invoice.items.some((item) => item.mrpSource === 'current-product') ? ['MRP reflects current product data, not a billing-time snapshot.'] : []),
      ...(catalogResult.success ? reconcileInvoiceThemeCatalog(catalogResult.catalog).issues : []),
      ...(!orgResult.success ? ['Company settings could not be loaded for this preview.'] : []),
      ...(!settingsResult.success ? ['Invoice settings could not be loaded; preview visibility/branding may differ from the PDF.'] : []),
      ...(!catalogResult.success && !INVOICE_DEMO_ENABLED ? ['The live invoice theme catalog could not be verified.'] : []),
    ])
    setInvoice(sources.invoice)
    setIsLoading(false)
    setIsRefreshingPreview(false)
    loadPayments(result.invoice.id, requestId)
  }

  // Actual payment records applied to this invoice (§9). A 403 / empty response just means
  // no ledger detail is available for this role - the aggregate paid amount is still shown.
  const loadPayments = async (invoiceId, requestId) => {
    if (!invoiceId) return
    setPaymentsError('')
    // "Show voided" is OFF by default: the request is then identical to before. ON adds include_voided=true.
    const result = await listPaymentReceipts({ invoice_id: invoiceId, ...(showVoidedRef.current ? { include_voided: true } : {}) })
    if (requestId !== invoiceRequest.current) return
    if (!result.success) {
      setPayments([])
      setPaymentsError(result.error)
      return
    }
    setPayments(
      [...result.receipts].sort((a, b) => new Date(b.receiptDate || b.createdAt || 0) - new Date(a.receiptDate || a.createdAt || 0)),
    )
  }

  const handleToggleVoided = (event) => {
    showVoidedRef.current = event.target.checked
    setShowVoided(event.target.checked)
    if (invoice?.id) loadPayments(invoice.id, invoiceRequest.current)
  }

  useEffect(() => {
    loadInvoice()
    return () => { invoiceRequest.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber])

  const handleRefreshPreview = () => {
    loadInvoice()
  }

  if (isLoading) {
    return (
      <LoadingSpinner variant="detail" layout="invoice" columns={7} label="Loading invoice..." />
    )
  }

  if (loadError || !invoice) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-surface p-10 text-center shadow-(--shadow-card)">
        <p className="text-sm text-neutral-500">{loadError || `Invoice ${invoiceNumber} was not found.`}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(invoicesBase)}>
          Back to Invoices
        </Button>
      </div>
    )
  }

  // Two independent outputs for the same invoice (never gated on invoiceSettings.template - an
  // org whose primary template is Thermal can still want the full A4 GST document, and vice
  // versa), both built from the same real invoice data via buildInvoicePreviewData.
  const previewData = buildInvoicePreviewData(invoice, orgSettings, invoiceSettings)
  const detailedRegularPresetId = resolveRegularPresetId(
    invoiceSettings?.template === 'thermal' ? 'classic' : invoiceSettings?.template,
    invoiceSettings?.templateVariant,
  )
  const thermalPaperWidth = invoiceSettings?.thermalPrint?.paperWidth || '80mm'
  const sharedTemplateProps = {
    primaryColor: invoiceSettings?.branding?.primaryColor || '#00092A',
    data: previewData,
    businessDetails: invoiceSettings?.businessDetails,
    invoiceDetails: invoiceSettings?.invoiceDetails,
    partyDetails: invoiceSettings?.partyDetails,
    itemTable: invoiceSettings?.itemTable,
    paymentDetails: invoiceSettings?.paymentDetails,
    footer: invoiceSettings?.footer,
    fields: invoiceSettings?.fields,
    typography: invoiceSettings?.typography,
  }

  // Browser print, scoped to the thermal export root below, sized via @page to the actual
  // selected paper width (58/80/110mm) with minimal margins - so a thermal printer driver prints
  // at real receipt size instead of scaling down to A4. Uses the saved thermal settings exactly
  // (theme/layout, bold, extra lines) - always available, independent of the org's primary
  // invoiceSettings.template choice.
  const handlePrintThermalReceipt = () => window.print()

  // The backend PDF endpoint is the canonical, fully-branded detailed A4 GST invoice (logo,
  // signature, stamp, QR, letterhead, primary color, footer text) for a real invoice. Demo mode
  // has no backend to call, so it exports the dedicated regular/A4 export root client-side -
  // always the full regular template, never thermal, regardless of invoiceSettings.template.
  const handleDownloadDetailedInvoice = async (format) => {
    if (INVOICE_DEMO_ENABLED) {
      setIsExportingDetailed(true)
      setDownloadError('')
      try {
        await exportElementToPdf(detailedExportRef.current, `${invoice.invoiceNumber || invoice.id}.pdf`, { widthRem: 32 })
      } catch (error) {
        setDownloadError(error?.message || 'Unable to export the invoice PDF. Please try again.')
      } finally {
        setIsExportingDetailed(false)
      }
      return
    }

    setIsDownloading(true)
    setDownloadError('')
    try {
      const result = await downloadInvoicePdf(invoice.id, invoice.invoiceNumber, format,
        invoiceSettings?.template === 'thermal' || themeSelection?.template === 'thermal'
          ? { templateVariant: themeSelection?.resolved_template_variant || detailedRegularPresetId } : {})
      if (!result.success) setDownloadError(result.error)
    } catch (error) {
      setDownloadError(error?.message || 'Unable to download invoice PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePaymentSaved = () => {
    setIsPaymentDrawerOpen(false)
    loadInvoice() // reloads the invoice + its payment ledger
  }

  // GST split (backend crm_changes25): supply_type is null when the seller's or customer's state is
  // unknown - then only the total GST is shown, never a made-up CGST/SGST/IGST split.
  const isIntraState = invoice.supplyType === 'intra_state'
  const isInterState = invoice.supplyType === 'inter_state'
  const hasGstSplit = isIntraState || isInterState
  const supplyLabel = isIntraState ? 'Intra-state (CGST + SGST)' : isInterState ? 'Inter-state (IGST)' : 'Not determined (total GST only)'
  // line_total is the value BEFORE tax for a tax-inclusive product (price x qty includes GST), so a
  // line whose line_total is below qty x rate - discount is a tax-inclusive line.
  const isInclusiveLine = (item) => Number(item.taxRate) > 0 && item.lineTotal < item.quantity * item.unitPrice - (Number(item.discount) || 0) - 0.005
  const hasInclusiveLine = invoice.items.some(isInclusiveLine)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Link
          to={invoicesBase}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-primary-700 hover:bg-primary-50/60"
        >
          <ArrowLeft className="size-3.5" />
          {invoicesBase.startsWith('/accounts') ? 'Sales Invoices' : 'Invoices'}
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
          {invoice.outstandingAmount > 0 && canRecordPayment && (
            <Button type="button" onClick={() => setIsPaymentDrawerOpen(true)}>
              <Wallet className="size-4" />
              Record Payment
            </Button>
          )}
          {!INVOICE_DEMO_ENABLED && (
            <Button type="button" variant="outline" loading={isDownloading} onClick={() => handleDownloadDetailedInvoice('simple')}>
              <Printer className="size-4" />
              Simple PDF
            </Button>
          )}
          <Button type="button" variant="outline" loading={isDownloading || isExportingDetailed} onClick={() => handleDownloadDetailedInvoice('detailed')}>
            <Download className="size-4" />
            Download Detailed Invoice (A4 PDF)
          </Button>
          {/* Always available, independent of invoiceSettings.template - uses the saved thermal
              settings exactly (theme/layout, paper width, bold, extra lines) and prints via the
              browser at the real paper size (@page, scoped print CSS below). */}
          <Button type="button" variant="outline" onClick={handlePrintThermalReceipt}>
            <Receipt className="size-4" />
            Print Receipt (Thermal)
          </Button>
        </div>
      </div>

      {downloadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError}</div>
      )}
      {previewWarnings.length > 0 && <div role="status" className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">{previewWarnings.join(' ')}</div>}

      {/* Thermal export root: scoped to print only, sized + @page'd to the actual selected paper
          width so a thermal printer driver prints at real receipt size, not scaled-down A4. */}
      <style>{`
        .invoice-thermal-export-root { position: absolute; left: -10000px; top: 0; }
        @media print {
          body * { visibility: hidden; }
          .invoice-thermal-export-root, .invoice-thermal-export-root * { visibility: visible; }
          .invoice-thermal-export-root {
            position: fixed; inset: 0; left: 0; margin: 0; width: auto !important; height: auto !important;
            box-shadow: none !important;
          }
          @page { size: ${thermalPaperWidth} auto; margin: 2mm; }
        }
      `}</style>
      <div ref={thermalExportRef} aria-hidden="true" className="invoice-thermal-export-root" style={{ width: thermalWidthPx(thermalPaperWidth) }}>
        <div className="bg-surface p-3 text-xs text-neutral-600">
          <ThermalPreview {...sharedTemplateProps} thermalPresetId={invoiceSettings?.thermalPrint?.layout} thermalBoldText={invoiceSettings?.thermalPrint?.boldText} thermalExtraLines={invoiceSettings?.thermalPrint?.extraLines} />
        </div>
      </div>

      {/* Detailed/regular export root: off-screen only, never a print target (the detailed
          invoice is a downloaded PDF, not a browser print) - used by exportElementToPdf in demo
          mode. Always the full regular template, never thermal, regardless of the org's primary
          invoiceSettings.template choice. */}
      {INVOICE_DEMO_ENABLED && (
        <div ref={detailedExportRef} aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 0, width: '32rem' }}>
          <div className="bg-surface p-5 text-xs text-neutral-600">
            <RegularThemePreview {...sharedTemplateProps} presetId={detailedRegularPresetId} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card) sm:grid-cols-3">
        <HeaderInfoItem icon={User} iconClassName="bg-neutral-100 text-neutral-500" label="Customer">
          {invoice.customerName || invoice.walkInName || '—'}
        </HeaderInfoItem>
        <HeaderInfoItem icon={FileText} iconClassName="bg-green-50 text-green-600" label="Invoice Status">
          <Badge variant={invoiceStatusVariant[invoice.invoiceStatus] || 'neutral'} dot>{invoice.invoiceStatus}</Badge>
        </HeaderInfoItem>
        <HeaderInfoItem icon={IndianRupee} iconClassName="bg-amber-50 text-amber-600" label="Payment Status">
          <Badge variant={FINANCIAL_STATUS_VARIANT[financialStatus(invoice)] || 'neutral'} dot>{financialStatus(invoice)}</Badge>
        </HeaderInfoItem>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
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
                  {invoice.orderId && !invoicesBase.startsWith('/accounts') && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400">Linked Order</span>
                      <Link to={`/admin/orders/${invoice.orderId}`} className="font-medium text-primary-700 hover:underline">View Order</Link>
                    </div>
                  )}
                </div>
              </div>

              {(invoice.sellerGstin || invoice.customerGstin || invoice.supplyType || invoice.placeOfSupply) && (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 sm:col-span-2" data-testid="invoice-gst-details">
                  <p className="text-sm font-semibold text-neutral-700">GST Details</p>
                  <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400">Seller GSTIN</span>
                      <span className="font-medium text-neutral-800">{invoice.sellerGstin || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400">Customer GSTIN</span>
                      <span className="font-medium text-neutral-800">{invoice.customerGstin || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-400">Supply</span>
                      <span className="font-medium text-neutral-800">{supplyLabel}</span>
                    </div>
                    {invoice.placeOfSupply && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-neutral-400">Place of Supply</span>
                        <span className="font-medium capitalize text-neutral-800">{invoice.placeOfSupply}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
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

          <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Wallet className="size-4 text-neutral-400" aria-hidden="true" />
                Payments
              </p>
              <div className="flex items-center gap-4">
                {!INVOICE_DEMO_ENABLED && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500">
                    <input type="checkbox" checked={showVoided} onChange={handleToggleVoided} className="size-3.5 rounded border-neutral-300 text-primary-600" />
                    Show voided
                  </label>
                )}
                <span className="text-xs text-neutral-400">
                  {formatCurrency(invoice.amountPaid)} of {formatCurrency(invoice.total)} received
                </span>
              </div>
            </div>
            {paymentsError ? (
              <p className="mt-3 text-xs text-neutral-500">
                Payment ledger detail isn&apos;t available for this view. The amount paid above is authoritative.
              </p>
            ) : payments.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">
                {invoice.amountPaid > 0
                  ? 'No individual payment records — only the aggregate paid amount is available.'
                  : 'No payments recorded.'}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold text-neutral-400">
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Receipt #</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                      <th className="px-3.5 py-2.5">Mode</th>
                      <th className="px-3.5 py-2.5">Reference</th>
                      <th className="px-3.5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {payments.map((payment) => (
                      <tr key={payment.id} className={payment.isVoid ? 'bg-neutral-50/70' : undefined}>
                        <td className="px-3.5 py-2.5 text-neutral-600">{formatDateLabel(payment.receiptDate || payment.createdAt)}</td>
                        <td className="px-3.5 py-2.5 text-neutral-800">{payment.receiptNumber || '—'}</td>
                        <td className={`px-3.5 py-2.5 text-right font-medium ${payment.isVoid ? 'text-neutral-400 line-through' : 'text-green-600'}`}>{formatCurrency(payment.amountReceived)}</td>
                        <td className="px-3.5 py-2.5 text-neutral-500">{payment.paymentMethod ? String(payment.paymentMethod).replace(/_/g, ' ') : '—'}</td>
                        <td className="px-3.5 py-2.5 text-neutral-500">{payment.transactionReference || '—'}</td>
                        <td className="px-3.5 py-2.5">
                          {payment.isVoid ? (
                            <Badge variant="danger">Void</Badge>
                          ) : (
                            <Badge variant={paymentStatusVariant[String(payment.paymentStatus || '').replace(/^\w/, (c) => c.toUpperCase())] || 'neutral'}>
                              {payment.paymentStatus || 'Recorded'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!INVOICE_DEMO_ENABLED && (
            <InvoicePaymentLinks invoice={invoice} canCollectOnline={canRecordPayment} onLinkChanged={loadInvoice} />
          )}

          <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <FileText className="size-4 text-neutral-400" aria-hidden="true" />
              Invoice Items
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-[40rem] text-left text-sm" data-testid="invoice-items-table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold text-neutral-400">
                    <th className="px-2.5 py-2.5">#</th>
                    <th className="px-2.5 py-2.5">Item / HSN</th>
                    <th className="px-2.5 py-2.5">Qty × Rate</th>
                    <th className="px-2.5 py-2.5">Discount</th>
                    <th className="px-2.5 py-2.5 text-right" title="Value before tax. For tax-inclusive items this is the price excluding GST.">Line Value</th>
                    <th className="px-2.5 py-2.5 text-right" title="Amount on which GST is charged (line value minus the line's share of the invoice discount).">Taxable Value</th>
                    <th className="px-2.5 py-2.5">GST %</th>
                    <th className="px-2.5 py-2.5 text-right">GST Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || item.productId}>
                      <td className="px-2.5 py-2.5 text-neutral-400">{index + 1}</td>
                      <td className="px-2.5 py-2.5 text-neutral-800">
                        {item.productName}
                        <span className="block text-xs text-neutral-400">HSN/SAC: {item.hsnCode || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-neutral-500">
                        {item.quantity} × {formatCurrencyExact(item.unitPrice)}
                        {isInclusiveLine(item) && <span className="block text-[0.68rem] text-neutral-400">incl. GST</span>}
                      </td>
                      <td className="px-2.5 py-2.5 text-neutral-500">{item.discount != null ? formatCurrencyExact(item.discount) : '—'}</td>
                      <td className="px-2.5 py-2.5 text-right text-neutral-700">{formatCurrencyExact(item.lineTotal)}</td>
                      <td className="px-2.5 py-2.5 text-right font-medium text-neutral-900">
                        {item.taxableValue != null ? formatCurrencyExact(item.taxableValue) : '—'}
                      </td>
                      <td className="px-2.5 py-2.5 text-neutral-500">
                        {item.taxRate ? `${item.taxRate}%` : '0%'}
                        {hasGstSplit && item.taxRate > 0 && (
                          <span className="block text-[0.68rem] text-neutral-400">
                            {isIntraState ? `CGST ${item.cgstRate ?? 0}% · SGST ${item.sgstRate ?? 0}%` : `IGST ${item.igstRate ?? item.taxRate}%`}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-medium text-neutral-900">
                        {formatCurrencyExact(item.taxAmount)}
                        {hasGstSplit && item.taxRate > 0 && (
                          <span className="block text-[0.68rem] font-normal text-neutral-400">
                            {isIntraState
                              ? `${formatCurrencyExact(item.cgstAmount)} + ${formatCurrencyExact(item.sgstAmount)}`
                              : formatCurrencyExact(item.igstAmount ?? item.taxAmount)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-neutral-400" data-testid="invoice-line-value-note">
              Line Value is the value before tax{hasInclusiveLine ? ' (for tax-inclusive items this is the price excluding GST, not rate × qty)' : ''}. GST is charged on the Taxable Value.
            </p>

            <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Discount</span>
                <span className="font-medium text-red-500">{formatCurrencyExact(invoice.discount)}</span>
              </div>
              {invoice.taxableTotal != null && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Taxable Value</span>
                  <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.taxableTotal)}</span>
                </div>
              )}
              {isIntraState && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">CGST</span>
                    <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.cgstTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">SGST</span>
                    <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.sgstTotal)}</span>
                  </div>
                </>
              )}
              {isInterState && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">IGST</span>
                  <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.igstTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">{hasGstSplit ? 'Total GST' : 'GST'}</span>
                <span className="font-medium text-neutral-800">{formatCurrencyExact(invoice.tax)}</span>
              </div>
              {invoice.additionalCharges > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Additional Charges</span>
                  <span className="font-medium text-neutral-800">{formatCurrency(invoice.additionalCharges)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-base">
                <span className="font-semibold text-neutral-900">Grand Total</span>
                <span className="font-semibold text-primary-700">{formatCurrencyExact(invoice.total)}</span>
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
            <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <FileText className="size-4 text-neutral-400" /> Notes
              </p>
              <p className="mt-2 text-sm text-neutral-600">{invoice.notes}</p>
            </div>
          )}

          {invoice.deliveryId && (
            <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
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
            themeSelection={themeSelection}
            isRefreshing={isRefreshingPreview}
            onRefresh={handleRefreshPreview}
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
