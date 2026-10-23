// Contract-level integration and SSR checks. Transport is mocked; no live invoices/settings are changed.
import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'

let server, client, api, templates, themes, sources
const expectedIds = ['classic', 'modern', 'compact', 'tally', 'landscape-1', 'landscape-2', 'gst-1', 'gst-2', 'gst-3', 'gst-4', 'gst-5', 'gst-6', 'double-divine', 'french-elite']
const rawInvoice = {
  id: 'invoice-1', invoice_number: 'INV-PARITY-1', order_id: 'order-1', customer_id: 'customer-1',
  customer: { id: 'customer-1', name: 'Parity Customer', business_name: 'Parity Business' },
  invoice_date: '2026-10-21', billing_address: 'Stored billing address',
  subtotal: 500, discount: 35, tax: 83.7, additional_charges: 20, round_off: -0.2, total: 568.5,
  amount_paid: 100, notes: 'Stored invoice note',
  items: [{ id: 'line-1', product_id: 'product-1', variant_id: 'variant-1', product_name: 'Stored product name',
    hsn_code: '1234', quantity: 5, unit_price: 100, discount: 35, tax: 83.7, tax_rate: 18, line_total: 548.7 }],
}
const org = { name: 'Parity Company', registered_address: 'Registered address', city: 'Mumbai', state: 'Maharashtra',
  pin_code: '400001', gst_number: '27ABCDE1234F1Z5', phone: '9000000000', email: 'billing@example.test',
  website: 'https://example.test', upi_id: 'company@upi', bank_name: 'Example Bank', bank_account_details: '123456', bank_ifsc: 'EXAMPLE',
  logo_url: '/files/company-logo', signature_url: '/files/company-signature', stamp_url: '/files/company-stamp',
  payment_qr_url: '/files/company-qr', letterhead_url: '/files/company-letterhead' }

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  api = await server.ssrLoadModule('/src/api/invoices.js')
  templates = await server.ssrLoadModule('/src/features/invoices/invoiceTemplates.jsx')
  themes = await server.ssrLoadModule('/src/features/invoices/invoiceThemePresets.js')
  sources = await server.ssrLoadModule('/src/features/invoices/invoicePreviewSources.js')
})
beforeEach(() => {
  client.get = async (url) => {
    if (url === '/invoices/invoice-1') return { data: structuredClone(rawInvoice) }
    if (url === '/invoice-settings') return { data: { template: 'modern', template_variant: 'gst-5' } }
    throw new Error(`Unexpected GET ${url}`)
  }
  for (const method of ['post', 'patch']) client[method] = async () => { throw new Error(`Unexpected ${method}`) }
})
after(async () => { await server?.close() })

async function normalizedFixture() {
  const { invoice } = await api.getInvoice('invoice-1')
  const { settings } = await api.getInvoiceSettings()
  return { invoice, settings, data: templates.buildInvoicePreviewData({ ...invoice, shippingAddress: 'Delivery address', customerGstin: 'CUSTOMER-GST' }, org, settings) }
}

test('actual InvoiceOut normalization preserves amount discount, stored tax and every stored total', async () => {
  const { invoice, data } = await normalizedFixture()
  assert.equal(invoice.items[0].discount, 35)
  assert.equal(invoice.items[0].taxAmount, 83.7)
  assert.equal(invoice.items[0].lineTotal, 548.7)
  assert.equal(data.discount, 35)
  assert.equal(data.additionalCharges, 20)
  assert.equal(data.roundOff, -0.2)
  assert.equal(data.total, 568.5)
  assert.equal(data.items[0].amount, 548.7)
  assert.equal(templates.money(123456.5), '₹ 1,23,456.50')
})

test('legacy missing line totals use amount discount and flat tax, never a discount percentage', async () => {
  client.get = async () => ({ data: { ...rawInvoice, items: [{ quantity: 2, unit_price: 100, discount: 25, tax: 7 }] } })
  const { invoice } = await api.getInvoice('invoice-1')
  assert.equal(invoice.items[0].lineTotal, 182)
  assert.equal(invoice.items[0].taxAmount, 7)
  assert.equal(invoice.total, rawInvoice.total)
})

for (const id of expectedIds) {
  for (const format of ['simple', 'detailed']) {
    test(`${id}/${format}: exact stored financial values, Ship To, branding and configured column semantics`, async () => {
      const { settings, data } = await normalizedFixture()
      const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, {
        ...settings, data, format, presetId: id, itemTable: { columns: ['product', 'discount', 'tax_amount', 'amount'] },
      }))
      for (const text of ['INV-PARITY-1', 'Stored product name', 'Parity Customer', 'Parity Company', 'Bill To', 'Ship To',
        'Delivery address', 'Additional Charges', 'Round Off', '₹ 568.50', '₹ 35.00', '₹ 83.70', '₹ 20.00', '₹ -0.20', 'Stored invoice note', 'company-logo', 'company-letterhead']) assert.ok(html.includes(text), text)
      assert.doesNotMatch(html, /35%/)
      if (format === 'simple') assert.doesNotMatch(html, /Scan to pay|Authorised Signatory|Example Bank|company-signature|company-stamp/)
      else for (const text of ['Example Bank', 'Scan to pay', 'company@upi', 'company-signature', 'company-stamp']) assert.ok(html.includes(text), text)
    })
  }
}

test('configured visibility applies equally to simple/detailed without hiding charges/round-off', async () => {
  const { data } = await normalizedFixture()
  for (const format of ['simple', 'detailed']) {
    const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, {
      data, format, presetId: 'classic', fields: { show_discount: false, show_tax_amount: false },
    }))
    assert.doesNotMatch(html, />Discount<|>Tax</)
    assert.match(html, /Additional Charges/)
    assert.match(html, /Round Off/)
  }
})

test('missing optional information creates no fake party/company data or empty Ship To', async () => {
  const { invoice } = await normalizedFixture()
  const data = templates.buildInvoicePreviewData({ ...invoice, customerName: '', shippingAddress: '' }, null, null)
  assert.equal(data.shipTo, null)
  assert.equal(data.company.name, '—')
  const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, { data, format: 'simple' }))
  assert.doesNotMatch(html, /Ship To|Hotel Grand Meridian|SAAS CRM|Your Company|Walk-in Customer|GSTIN:/)
})

test('read-only enrichment uses existing customer/order/product GETs and explicitly marks current MRP', async () => {
  const { invoice } = await api.getInvoice('invoice-1')
  const original = structuredClone(invoice), calls = []
  client.get = async (url) => {
    calls.push(url)
    if (url === '/customers/customer-1') return { data: { id: 'customer-1', address_information: { billing_address: 'Current billing', shipping_address: 'Current shipping' }, business_tax_information: { gstin_tax_id: 'CUSTOMER-GST' }, contact_information: { mobile_number: '9123456789' } } }
    if (url === '/orders/order-1') return { data: { id: 'order-1', order_number: 'SO-1', items: [] } }
    if (url === '/products/product-1') return { data: { id: 'product-1', pricing: { mrp: 200 }, variations: [{ id: 'variant-1', pricing: { mrp: 150 } }] } }
    throw new Error(url)
  }
  const result = await sources.loadInvoicePreviewSources(invoice, { includeMrp: true })
  assert.deepEqual(result.warnings, [])
  assert.equal(result.invoice.billingAddress, 'Stored billing address')
  assert.equal(result.invoice.shippingAddress, 'Current shipping')
  assert.equal(result.invoice.customerGstin, 'CUSTOMER-GST')
  assert.equal(result.invoice.orderNumber, 'SO-1')
  assert.equal(result.invoice.items[0].mrp, 150)
  assert.equal(result.invoice.items[0].mrpSource, 'current-product')
  assert.equal(result.invoice.total, invoice.total)
  assert.deepEqual(invoice, original)
  assert.equal(calls.filter((url) => url.startsWith('/products/')).length, 1)
})

test('denied metadata stays unavailable and warns; it never substitutes sample addresses/MRP', async () => {
  const { invoice } = await api.getInvoice('invoice-1')
  client.get = async () => { throw { response: { status: 403, data: { detail: 'Forbidden' } } } }
  const result = await sources.loadInvoicePreviewSources(invoice, { includeMrp: true })
  assert.equal(result.warnings.length, 3)
  assert.equal(result.invoice.shippingAddress, '')
  assert.equal(result.invoice.items[0].mrp, null)
  assert.equal(result.invoice.total, rawInvoice.total)
})

test('catalog preserves all stable IDs, detects drift and resolves legacy/base/thermal-A4 choices', async () => {
  assert.deepEqual(themes.REGULAR_THEME_PRESETS.map((preset) => preset.id), expectedIds)
  const catalog = { selected: { template: 'modern', resolved_template_variant: 'gst-5' },
    regular: themes.REGULAR_THEME_PRESETS.map(({ baseTemplate, ...preset }) => ({ ...preset, base_template: baseTemplate })),
    thermal: themes.THERMAL_THEME_PRESETS.map(({ showExtras, ...preset }) => ({ ...preset, show_extras: Boolean(showExtras) })) }
  client.get = async (url) => { assert.equal(url, '/invoice-templates'); return { data: catalog } }
  const response = await api.getInvoiceTemplates()
  assert.equal(response.catalog.selected.resolved_template_variant, 'gst-5')
  assert.deepEqual(themes.reconcileInvoiceThemeCatalog(response.catalog).issues, [])
  catalog.regular[0].header = 'wrong'
  assert.match(themes.reconcileInvoiceThemeCatalog(catalog).issues[0], /differs/)
  assert.equal(themes.resolveRegularPresetId('modern', 'old-unknown'), 'modern')
  assert.equal(themes.resolveRegularPresetId('modern', 'gst-1'), 'modern')
  assert.equal(themes.resolveRegularPresetId('thermal', 'gst-1'), 'gst-1')
})

test('official downloads use the existing backend endpoint; overrides never save settings and blob errors stay readable', async () => {
  const calls = [], names = []
  const previousDocument = globalThis.document
  globalThis.document = { createElement: () => ({ click() { names.push(this.download) }, remove() {} }), body: { appendChild() {} } }
  try {
    client.get = async (url, config) => { calls.push({ url, config }); return { data: new Blob(['%PDF-test'], { type: 'application/pdf' }) } }
    assert.equal((await api.downloadInvoicePdf('invoice-1', 'INV-1', 'simple', { templateVariant: 'gst-4' })).success, true)
    assert.equal(calls[0].url, '/invoices/invoice-1/pdf')
    assert.deepEqual(calls[0].config.params, { format: 'simple', template_variant: 'gst-4' })
    assert.deepEqual(names, ['INV-1.pdf'])
    await api.downloadInvoicePdf('invoice-1', 'INV-1', 'detailed', { thermalLayout: 'thermal-theme-2' })
    assert.equal(calls[1].config.params.thermal_layout, 'thermal-theme-2')
    assert.equal((await api.downloadInvoicePdf('invoice-1', 'INV-1', 'simple', { templateVariant: 'classic', thermalLayout: 'thermal-simple' })).success, false)
    assert.equal(calls.length, 2)
    client.get = async () => { throw { response: { status: 422, data: new Blob([JSON.stringify({ detail: 'Unknown theme' })]) } } }
    assert.equal((await api.downloadInvoicePdf('invoice-1', 'INV-1')).error, 'Unknown theme')
  } finally { globalThis.document = previousDocument }
})

test('all configured item columns and 1/5/20/60-item long-content fixtures render without changing stored total', async () => {
  const { data } = await normalizedFixture()
  const { ITEM_COLUMN_KEYS } = await server.ssrLoadModule('/src/features/invoices/invoiceColumns.js')
  for (const count of [1, 5, 20, 60]) {
    const items = Array.from({ length: count }, (_, i) => ({ ...data.items[0], name: `Line ${i} ${'long product name '.repeat(15)}`, productImage: '/files/missing-image' }))
    const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, {
      data: { ...data, items }, presetId: 'gst-4', itemTable: { columns: ITEM_COLUMN_KEYS, showProductImage: true },
    }))
    assert.equal((html.match(/long product name long product name/g) || []).length > 0, true)
    assert.match(html, /₹ 568.50/)
    assert.match(html, /mrp|MRP/)
    assert.ok(html.includes(`Line ${count - 1}`))
    assert.equal((html.match(/src="[^"]*\/files\/missing-image"/g) || []).length, count)
  }
})

test('direct invoice serialization sends its existing calculated discount amount, keeping the percent input separate', async () => {
  const source = await readFile(new URL('../src/features/invoices/CreateSalesInvoice.jsx', import.meta.url), 'utf8')
  const parsed = parseSync('CreateSalesInvoice.jsx', source)
  const nodes = []
  const walk = (value) => { if (!value || typeof value !== 'object') return; if (value.type) nodes.push(value); for (const child of Object.values(value)) { if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child) } }
  walk(parsed.program)
  const call = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'createInvoice')
  const items = call.arguments[0].properties.find((property) => property.key.name === 'items').value
  const mapped = new Function('lineItems', `return (${source.slice(items.start, items.end)})`)([{ productId: 'product-1', quantity: 5, unitPrice: 100, discount: 7, discountAmount: 35 }])
  assert.equal(mapped[0].discount, 35)
})

test('invoice branding overrides take precedence over company assets; clearing them restores company assets', async () => {
  const { invoice, settings } = await normalizedFixture()
  const data = templates.buildInvoicePreviewData(invoice, org, { ...settings, branding: {
    logoFileId: 'invoice-logo', signatureFileId: 'invoice-signature', stampFileId: 'invoice-stamp', paymentQrFileId: 'invoice-qr',
  } })
  for (const [field, id] of [['logoUrl', 'invoice-logo'], ['signatureUrl', 'invoice-signature'], ['stampSealUrl', 'invoice-stamp'], ['qrCodeUrl', 'invoice-qr']]) assert.ok(data.company[field].endsWith(`/files/${id}`))
  const cleared = templates.buildInvoicePreviewData(invoice, org, { ...settings, branding: { paymentQrFileId: null } })
  assert.ok(cleared.company.qrCodeUrl.endsWith('/files/company-qr'))
  assert.equal(cleared.company.upiId, org.upi_id)
  assert.equal(cleared.company.website, org.website)
})

test('light/dark brand colors retain theme structure and whitespace-only shipping address stays absent', async () => {
  const { invoice, settings } = await normalizedFixture()
  const data = templates.buildInvoicePreviewData({ ...invoice, shippingAddress: '   ' }, org, settings)
  assert.equal(data.shipTo, null)
  for (const primaryColor of ['#111827', '#e5e7eb']) {
    const html = renderToStaticMarkup(React.createElement(templates.RegularThemePreview, { data, primaryColor, presetId: 'gst-5' }))
    assert.ok(html.includes(primaryColor))
    assert.match(html, /INV-PARITY-1/)
    assert.match(html, /₹ 568.50/)
    assert.doesNotMatch(html, /Ship To/)
  }
})
