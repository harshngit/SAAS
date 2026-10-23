import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getInvoice, getInvoiceSettings, getInvoiceTemplates } from '../../api/invoices'
import { getOrganizationSettings } from '../../api/organizations'
import { useAuthStore } from '../../store/authStore'
import { templateComponents, RegularThemePreview, buildInvoicePreviewData } from './invoiceTemplates'
import { resolveRegularPresetId } from './invoiceThemePresets'
import { loadInvoicePreviewSources } from './invoicePreviewSources'

// NOTE (found while redesigning Invoice Settings): this page's original premise - "the backend
// launches a headless browser against this route to render the PDF" - does not match the real
// backend. Inspected app/routers/invoices.py directly: GET /invoices/{id}/pdf calls
// invoice_simple_pdf/invoice_detailed_pdf from app/core/pdf_docs.py, a native FPDF renderer with
// no headless-browser/Playwright/Puppeteer dependency anywhere in the backend repo. Nothing in
// the frontend links to this route either (grepped). It is currently orphaned. Left in place and
// kept in sync with the new settings shape (not deleted - removing a route/page is a bigger call
// than this task's scope), but flagged here and in the redesign report for a decision on whether
// to remove it or repurpose it.
//
// Query params:
//   token    - short-lived bearer token scoped to this invoice (required)
//   format   - 'simple' | 'detailed' (default 'detailed') - which field preset to render, see
//              SIMPLE_FIELDS_PRESET below
//   template - override which of the 4 templateComponents to use (optional; falls back to
//              invoiceSettings.template)
//   color    - override the primary/brand color as a hex string, e.g. "2563EB" (optional; falls
//              back to invoiceSettings.branding.primaryColor) - lets the backend eventually give
//              Simple and Detailed independent colors without any settings-schema change here
const paperWidthClass = { A4: 'w-[210mm]', A5: 'w-[148mm]', thermal: 'w-[80mm]' }

// Regular simple/detailed visibility is centralized in RegularInvoiceDocument.
// Both retain the firm's configured columns and financial totals.
export default function InvoicePrintView() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const templateOverride = searchParams.get('template')
  const colorOverride = searchParams.get('color')
  const format = searchParams.get('format') === 'simple' ? 'simple' : 'detailed'

  const [invoice, setInvoice] = useState(null)
  const [orgSettings, setOrgSettings] = useState(null)
  const [invoiceSettings, setInvoiceSettings] = useState(null)
  const [themeSelection, setThemeSelection] = useState(null)
  const [error, setError] = useState('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Missing print token.')
      return
    }
    // Scopes this browser context's API calls to the token the backend minted for this render -
    // every api/*.js call already reads Authorization from this same store, so nothing else
    // about the data-fetching code needs to know this is a headless print render.
    useAuthStore.getState().setAuthTokens({ access_token: token, refresh_token: '', token_type: 'bearer' })

    let cancelled = false

    async function load() {
      const [invoiceResult, orgResult, settingsResult, catalogResult] = await Promise.all([
        getInvoice(id),
        getOrganizationSettings(),
        getInvoiceSettings(),
        getInvoiceTemplates(),
      ])

      if (cancelled) return

      if (!invoiceResult.success) {
        setError(invoiceResult.error)
        return
      }

      const sources = await loadInvoicePreviewSources(invoiceResult.invoice, { includeMrp: settingsResult.settings?.itemTable?.columns?.includes('mrp') })
      if (cancelled) return
      setInvoice(sources.invoice)
      if (catalogResult.success) setThemeSelection(catalogResult.catalog.selected)
      if (orgResult.success) setOrgSettings(orgResult.organization)
      if (settingsResult.success) setInvoiceSettings(settingsResult.settings)
      setIsReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, token])

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#b91c1c' }} data-print-state="error">
        {error}
      </div>
    )
  }

  if (!isReady || !invoice) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }} data-print-state="loading">
        Loading invoice…
      </div>
    )
  }

  const template = templateOverride || invoiceSettings?.template || themeSelection?.template || 'classic'
  const isThermalTemplate = template === 'thermal'
  // Same preset-aware rendering as InvoiceDetail.jsx (see resolveRegularPresetId) - except an
  // explicit `?template=` override means the caller wants that exact base template, not whatever
  // theme preset the org has saved, so the persisted `template_variant` is only honored when
  // nothing in the URL overrides it.
  const TemplateComponent = isThermalTemplate ? templateComponents.thermal : RegularThemePreview
  const regularPresetId = resolveRegularPresetId(template, templateOverride ? null : themeSelection?.resolved_template_variant || invoiceSettings?.templateVariant)
  const paperSize = invoiceSettings?.paperSize || 'A4'
  const previewData = buildInvoicePreviewData(invoice, orgSettings, invoiceSettings)
  const fields = invoiceSettings?.fields || {}
  const primaryColor = (colorOverride && `#${colorOverride.replace(/^#/, '')}`) || invoiceSettings?.branding?.primaryColor || '#00092A'
  const isSimple = format === 'simple'

  return (
    <div
      data-print-state="ready"
      data-print-format={format}
      className={`mx-auto bg-white p-8 ${paperWidthClass[paperSize] || paperWidthClass.A4}`}
    >
      <style>{'@page { size: ' + (paperSize === 'thermal' ? '80mm auto' : paperSize) + '; margin: 0; } body { margin: 0; }'}</style>
      <TemplateComponent
        presetId={regularPresetId}
        format={format}
        data={previewData}
        primaryColor={primaryColor}
        fields={fields}
        businessDetails={invoiceSettings?.businessDetails}
        invoiceDetails={invoiceSettings?.invoiceDetails}
        partyDetails={invoiceSettings?.partyDetails}
        itemTable={invoiceSettings?.itemTable}
        paymentDetails={isSimple ? { showBankDetails: false, showUpiQr: false } : invoiceSettings?.paymentDetails}
        footer={isSimple ? { showTerms: false, showSignature: false, showStamp: false, terms: '', footerText: '' } : invoiceSettings?.footer}
        typography={invoiceSettings?.typography}
        thermalLayout={invoiceSettings?.thermalPrint?.layout}
      />
    </div>
  )
}
