// Read-only live acceptance helper. Credentials stay in environment/memory, never output.
// Run with INVOICE_CHECK_ACCOUNTS=[{role,email,password}] in the process environment.
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const accounts = JSON.parse(process.env.INVOICE_CHECK_ACCOUNTS || '[]')
if (!accounts.length) throw new Error('Supply INVOICE_CHECK_ACCOUNTS through the process environment.')
const output = process.env.INVOICE_CHECK_OUTPUT || join(tmpdir(), 'invoice-live-acceptance-2026-10-22')
await mkdir(output, { recursive: true })
const report = { checkedAt: new Date().toISOString(), output, roles: [], pdfs: [], previews: [], limitations: ['Browser interaction unavailable; SSR is not visual UI verification.'] }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const log = (value) => console.log(JSON.stringify(value))
try {
  const auth = await server.ssrLoadModule('/src/api/auth.js')
  const { apiClient, API_BASE_URL } = await server.ssrLoadModule('/src/api/client.js')
  const api = await server.ssrLoadModule('/src/api/invoices.js')
  const orgApi = await server.ssrLoadModule('/src/api/organizations.js')
  const templates = await server.ssrLoadModule('/src/features/invoices/invoiceTemplates.jsx')
  const themes = await server.ssrLoadModule('/src/features/invoices/invoiceThemePresets.js')
  const sources = await server.ssrLoadModule('/src/features/invoices/invoicePreviewSources.js')
  report.backend = API_BASE_URL
  if (API_BASE_URL !== 'https://crm-saas-backend.bsmart.workers.dev') throw new Error('Unexpected API target; refusing authentication.')
  // Staff first, admin last, so invoice checks use the firm-owner session.
  for (const account of accounts) {
    const result = await auth.login(account)
    const row = { role: account.role, login: result.success, ...(result.success ? {} : { error: result.error }) }
    if (result.success) {
      const [catalog, settings, invoices] = await Promise.all([api.getInvoiceTemplates(), api.getInvoiceSettings(), api.listInvoices()])
      Object.assign(row, { catalog: catalog.success, settings: settings.success, invoices: invoices.success,
        ...(catalog.success ? { regularCount: catalog.catalog.regular?.length, thermalCount: catalog.catalog.thermal?.length } : { catalogError: catalog.error }),
        ...(settings.success ? {} : { settingsError: settings.error }),
        ...(invoices.success ? { invoiceCount: invoices.invoices.length } : { invoicesError: invoices.error }) })
    }
    report.roles.push(row); log(row)
  }
  if (!report.roles.at(-1)?.login || accounts.at(-1)?.role !== 'Admin') throw new Error('Admin session required for invoice checks.')
  const [listing, settingsResult, orgResult, catalogResult] = await Promise.all([
    api.listInvoices(), api.getInvoiceSettings(), orgApi.getOrganizationSettings(), api.getInvoiceTemplates(),
  ])
  if (!listing.success || !settingsResult.success || !orgResult.success || !catalogResult.success) throw new Error('Admin preview dependencies unavailable.')
  report.catalogIssues = themes.reconcileInvoiceThemeCatalog(catalogResult.catalog).issues
  report.selected = catalogResult.catalog.selected
  report.invoiceCount = listing.invoices.length
  // Select actual records by size, without creating/changing records or settings.
  const detailed = []
  for (const listed of listing.invoices.slice(0, 15)) {
    const result = await api.getInvoice(listed.id)
    if (result.success) detailed.push(result.invoice)
  }
  detailed.sort((a, b) => b.items.length - a.items.length)
  report.availableItemCounts = detailed.map((invoice) => invoice.items.length)
  const invoice = detailed[0]
  if (!invoice) throw new Error('No existing invoice available.')
  report.invoiceId = invoice.id
  const settings = settingsResult.settings
  const enriched = await sources.loadInvoicePreviewSources(invoice, { includeMrp: settings.itemTable?.columns?.includes('mrp') })
  report.enrichmentWarnings = enriched.warnings
  const data = templates.buildInvoicePreviewData(enriched.invoice, orgResult.organization, settings)
  report.storedFinancials = { subtotal: invoice.subtotal, discount: invoice.discount, tax: invoice.tax, total: invoice.total,
    additionalCharges: data.additionalCharges, roundOff: data.roundOff }
  report.brandingPresence = Object.fromEntries(['logoUrl', 'signatureUrl', 'stampSealUrl', 'qrCodeUrl', 'letterheadUrl'].map((key) => [key, Boolean(data.company[key])]))
  for (const theme of catalogResult.catalog.regular) {
    for (const format of ['simple', 'detailed']) {
      const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, {
        ...settings, primaryColor: settings.branding?.primaryColor, data, presetId: theme.id, format,
      }))
      await writeFile(join(output, `${theme.id}-${format}-preview.html`), html)
      report.previews.push({ theme: theme.id, format, rendered: true, items: data.items.length,
        hasInvoiceNumber: html.includes(data.invoiceNo), hasStoredTotal: html.includes(templates.money(invoice.total)) })
      const started = performance.now()
      try {
        const response = await apiClient.get(`/invoices/${invoice.id}/pdf`, {
          params: { format, template_variant: theme.id }, responseType: 'arraybuffer',
        })
        const bytes = Buffer.from(response.data)
        const validPdf = bytes.subarray(0, 5).toString() === '%PDF-'
        const row = { theme: theme.id, format, status: response.status, milliseconds: Math.round(performance.now() - started), bytes: bytes.length, validPdf }
        if (validPdf) await writeFile(join(output, `${theme.id}-${format}.pdf`), bytes)
        report.pdfs.push(row); log(row)
      } catch (error) {
        const row = { theme: theme.id, format, status: error.response?.status || null, error: error.code || 'request failed', milliseconds: Math.round(performance.now() - started) }
        report.pdfs.push(row); log(row)
      }
    }
  }
} catch (error) {
  report.error = error.message
  log({ error: error.message })
  process.exitCode = 1
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
  await server.close()
  log({ report: join(output, 'report.json') })
}
