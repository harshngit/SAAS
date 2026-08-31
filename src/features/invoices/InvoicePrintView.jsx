import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getInvoice, getInvoiceSettings } from '../../api/invoices'
import { getOrganizationSettings } from '../../api/organizations'
import { useAuthStore } from '../../store/authStore'
import { templateComponents, buildInvoicePreviewData } from './invoiceTemplates'

// Headless-render target for server-side PDF generation. Deliberately outside ProtectedRoute
// (see AppRoutes.jsx) - there's no logged-in browser session here, so auth comes from a
// short-lived token in the URL instead, which the backend mints when it launches the headless
// browser. This page renders the EXACT same template components as InvoiceDetail.jsx's on-screen
// preview (same buildInvoicePreviewData shaping, same templateComponents map) - the backend's
// PDF is this page's print output, not a separate fpdf implementation, so drift becomes
// structurally impossible instead of something to keep manually in sync.
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

// A short/quick-send invoice: header, who it's for, the item list, one total. None of the
// GST/HSN/tax/bank/terms detail a formal Detailed invoice carries. Hardcoded for now rather than
// org-configurable - the org's own invoiceSettings.fields (below) still fully drives the
// Detailed format, unchanged. Once the backend adds a separate "simple" settings profile, swap
// this constant for that profile's fields instead of removing the format param.
const SIMPLE_FIELDS_PRESET = {
  show_company_gstin: true,
  show_customer_gstin: false,
  show_billing_address: true,
  show_shipping_address: false,
  show_hsn_sac: false,
  show_mrp: false,
  show_discount: false,
  show_tax_rate: false,
  show_tax_amount: false,
  show_batch_number: false,
  show_expiry_date: false,
  show_bank_details: false,
  show_upi_qr: false,
  show_terms: false,
  show_signature: false,
}

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
      const [invoiceResult, orgResult, settingsResult] = await Promise.all([
        getInvoice(id),
        getOrganizationSettings(),
        getInvoiceSettings(),
      ])

      if (cancelled) return

      if (!invoiceResult.success) {
        setError(invoiceResult.error)
        return
      }

      setInvoice(invoiceResult.invoice)
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

  const template = templateOverride || invoiceSettings?.template || 'classic'
  const TemplateComponent = templateComponents[template] || templateComponents.classic
  const paperSize = invoiceSettings?.paperSize || 'A4'
  const previewData = buildInvoicePreviewData(invoice, orgSettings)
  const fields = format === 'simple' ? SIMPLE_FIELDS_PRESET : invoiceSettings?.fields || {}
  const primaryColor = (colorOverride && `#${colorOverride.replace(/^#/, '')}`) || invoiceSettings?.branding?.primaryColor || '#16A34A'

  return (
    <div
      // data-print-state="ready" is the signal the backend's headless browser waits on
      // (page.waitForSelector('[data-print-state="ready"]')) before calling page.pdf() -
      // without it, a PDF could be captured mid-fetch on a slow connection.
      data-print-state="ready"
      data-print-format={format}
      className={`mx-auto bg-white p-8 ${paperWidthClass[paperSize] || paperWidthClass.A4}`}
    >
      <style>{'@page { size: ' + (paperSize === 'thermal' ? '80mm auto' : paperSize) + '; margin: 0; } body { margin: 0; }'}</style>
      <TemplateComponent
        data={previewData}
        primaryColor={primaryColor}
        fields={fields}
        footerText={format === 'simple' ? '' : invoiceSettings?.footerText || ''}
        terms={format === 'simple' ? '' : invoiceSettings?.terms || ''}
      />
    </div>
  )
}
