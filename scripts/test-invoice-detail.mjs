// Render the actual invoice page with loaded API data; no live requests or writes.
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import * as router from 'react-router-dom'

let server, InvoiceDetail, ToastContext, api, client, templates
const invoiceId = '7abf6511-7940-430d-9d2e-d6b2dc4c2eab'
const rawInvoice = {
  id: invoiceId, invoice_number: 'INV-TEST-1', order_id: 'order-1',
  customer: { id: 'customer-1', name: 'Test Customer' },
  invoice_date: '2026-10-19', billing_address: 'Saved address',
  invoice_status: 'Issued', total: 230, amount_paid: 0,
  items: [{ id: 'line-1', product_id: 'product-1', product_name: 'LED Small', quantity: 2, unit_price: 75 },
    { id: 'line-2', product_id: 'product-1', product_name: 'LED Medium', quantity: 1, unit_price: 80 }],
}

before(async () => {
  server = await createServer({
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent',
    plugins: [{
      name: 'invoice-test-initial-state', enforce: 'pre',
      transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/features/invoices/InvoiceDetail.jsx')) return
        // Seed the existing hooks to exercise post-load rendering without a browser.
        return code
          .replace('const [invoice, setInvoice] = useState(null)', 'const [invoice, setInvoice] = useState(globalThis.__invoiceDetailTest.invoice)')
          .replace('const [isLoading, setIsLoading] = useState(true)', 'const [isLoading, setIsLoading] = useState(globalThis.__invoiceDetailTest.isLoading)')
          .replace("const [loadError, setLoadError] = useState('')", 'const [loadError, setLoadError] = useState(globalThis.__invoiceDetailTest.loadError)')
          .replace('const [invoiceSettings, setInvoiceSettings] = useState(null)', 'const [invoiceSettings, setInvoiceSettings] = useState(globalThis.__invoiceDetailTest.settings)')
      },
    }],
  })
  ;({ default: InvoiceDetail } = await server.ssrLoadModule('/src/features/invoices/InvoiceDetail.jsx'))
  ;({ ToastContext } = await server.ssrLoadModule('/src/components/ui/toastContext.js'))
  api = await server.ssrLoadModule('/src/api/invoices.js')
  templates = await server.ssrLoadModule('/src/features/invoices/invoiceTemplates.jsx')
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  for (const method of ['get', 'post', 'patch']) client[method] = async () => { throw new Error('Unexpected API request') }
})
after(async () => { delete globalThis.__invoiceDetailTest; await server?.close() })

function render(state = {}, base = '/admin/invoices') {
  globalThis.__invoiceDetailTest = { invoice: null, isLoading: false, loadError: '', settings: null, ...state }
  return renderToStaticMarkup(React.createElement(ToastContext.Provider, { value: { showToast() {} } },
    React.createElement(router.MemoryRouter, { initialEntries: [`${base}/${invoiceId}`] },
      React.createElement(router.Routes, null,
        React.createElement(router.Route, { path: `${base}/:invoiceNumber`, element: React.createElement(InvoiceDetail) })))))
}

test('View Invoice UUID route renders loaded invoice, preview, items and download/print controls', async () => {
  client.get = async (url) => {
    assert.equal(url, `/invoices/${invoiceId}`)
    return { data: rawInvoice }
  }
  const result = await api.getInvoice(invoiceId)
  assert.equal(result.success, true)
  const html = render({ invoice: result.invoice })
  for (const text of ['INV-TEST-1', 'Test Customer', 'LED Small', 'LED Medium', 'Invoice Preview',
    'Download Detailed Invoice (A4 PDF)', 'Print Receipt (Thermal)', 'Saved address']) assert.ok(html.includes(text), text)
  assert.match(html, /href="\/admin\/orders\/order-1"/)
})

test('accounts invoice route renders with thermal settings and returns to the correct invoice list', async () => {
  const { invoice } = await api.getInvoice(invoiceId)
  const html = render({ invoice, settings: { template: 'thermal', thermalPrint: { paperWidth: '58mm' } } }, '/accounts/invoices/sales')
  assert.match(html, /Thermal template/)
  assert.match(html, /href="\/accounts\/invoices\/sales"/)
  assert.match(html, /58mm/)
})

test('loading and failed invoice requests show visible feedback instead of an empty page', () => {
  assert.match(render({ isLoading: true }), /Loading invoice/)
  const html = render({ loadError: 'Invoice could not be loaded' })
  assert.match(html, /Invoice could not be loaded/)
  assert.match(html, /Back to Invoices/)
})

test('regular and thermal QR blocks show the saved image below its label and respect the visibility setting', () => {
  const url = 'https://example.test/saved-payment-qr.png'
  const data = { ...templates.sampleInvoice, company: { ...templates.sampleInvoice.company, qrCodeUrl: url } }
  for (const Component of [templates.RegularThemePreview, templates.ThermalPreview]) {
    const html = renderToStaticMarkup(React.createElement(Component, { data }))
    const labelPosition = html.indexOf('Scan to pay via UPI')
    const imagePosition = html.indexOf('alt="Payment QR code"')
    assert.ok(labelPosition >= 0 && imagePosition > labelPosition)
    assert.ok(html.includes(`src="${url}"`))
    assert.match(html, /width:(34|28)mm/)
    const hidden = renderToStaticMarkup(React.createElement(Component, { data, paymentDetails: { showUpiQr: false } }))
    assert.doesNotMatch(hidden, /Scan to pay via UPI|alt="Payment QR code"/)
    const missing = renderToStaticMarkup(React.createElement(Component, { data: { ...data, company: { ...data.company, qrCodeUrl: '' } } }))
    if (Component === templates.ThermalPreview) assert.match(missing, /Payment QR unavailable/)
    else assert.doesNotMatch(missing, /Scan to pay|Payment QR unavailable/)
    assert.doesNotMatch(missing, /alt="Payment QR code"/)
  }
})
