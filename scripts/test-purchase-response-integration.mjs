import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
let server, invoices, purchases, purchaseHelpers, invoiceHelpers, client
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  invoices = await server.ssrLoadModule('/src/api/supplierInvoices.js')
  purchases = await server.ssrLoadModule('/src/api/purchases.js')
  purchaseHelpers = await server.ssrLoadModule('/src/features/purchases/purchaseHelpers.js')
  invoiceHelpers = await server.ssrLoadModule('/src/features/supplierInvoices/supplierInvoiceHelpers.js')
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
})
after(async () => server?.close())
const line = { product_id: 'product', product_name: 'TEST Everyday Sandal', sku: 'TEST-SANDAL-001', ordered_qty: 10, received_qty: 10, billed_qty: 10, unit_price: 1000, purchase_price: 1000, discount_amount: 0, tax_amount: 0, line_total: 10000, available_qty: 10, quantity_match: true, price_match: true }
const bill = { id: 'bill', supplier_invoice_number: 'TEST-PUR-002', grand_total: 10000, amount_paid: 4000, outstanding_amount: 6000, payment_status: 'partially_paid', verification_status: 'matched', quantity_match: true, price_match: true, items: [line] }

test('Purchase list and detail retain backend money and map partially_paid', async () => {
  const raw = { id: 'po', purchase_number: 'PO-10001-2026-0006', total: 10000, amount_paid: 4000, outstanding_balance: 6000, payment_status: 'partially_paid', status: 'closed', receiving_status: 'fully_received', items: [] }
  client.get = async (path) => ({ data: path === '/purchases' ? [raw] : raw })
  const list = await purchases.listPurchases()
  const detail = await purchases.getPurchase('po')
  for (const purchase of [list.purchases[0], detail.purchase]) {
    assert.equal(purchase.amountPaid, 4000)
    assert.equal(purchase.outstandingAmount, 6000)
    assert.equal(purchaseHelpers.derivePaymentStatus(purchase).label, 'Partially Paid')
    assert.equal(purchaseHelpers.derivePurchaseStatus(purchase).key, 'closed')
    assert.equal(purchaseHelpers.deriveReceivingStatus(purchase).key, 'fully_received')
  }
  client.get = async () => ({ data: { ...raw, outstanding_balance: 123, payment_status: 'unpaid' } })
  const changed = (await purchases.getPurchase('po')).purchase
  assert.equal(changed.outstandingAmount, 123, 'do not recompute total minus paid')
  assert.equal(purchaseHelpers.derivePaymentStatus(changed).label, 'Unpaid', 'do not infer from paid amount')
})
test('legacy partial and unknown/missing payment states have safe labels', () => {
  for (const helper of [key => purchaseHelpers.derivePaymentStatus({ paymentStatus: key }), invoiceHelpers.paymentStatusMeta]) {
    assert.equal(helper('partial').label, 'Partially Paid')
    assert.equal(helper('partially_paid').label, 'Partially Paid')
    assert.equal(helper('processing_review').label, 'Processing Review')
    assert.equal(helper(null).label, 'Unknown')
    assert.equal(helper('processing_review').variant, 'neutral')
  }
})
test('Supplier Invoice maps the supplied runtime example without losing zero amounts', () => {
  const invoice = invoices.normalizeSupplierInvoice(bill)
  assert.equal(invoice.amountPaid, 4000)
  assert.equal(invoice.outstandingAmount, 6000)
  assert.equal(invoiceHelpers.paymentStatusMeta(invoice.paymentStatus).label, 'Partially Paid')
  assert.deepEqual(Object.fromEntries(['productName','sku','orderedQty','receivedQty','billedQty','unitPrice','purchasePrice','discountAmount','taxAmount','lineTotal','availableQty','quantityMatch','priceMatch'].map(key => [key, invoice.items[0][key]])), { productName: line.product_name, sku: line.sku, orderedQty: 10, receivedQty: 10, billedQty: 10, unitPrice: 1000, purchasePrice: 1000, discountAmount: 0, taxAmount: 0, lineTotal: 10000, availableQty: 10, quantityMatch: true, priceMatch: true })
})
test('null numeric fields stay null and missing line totals are not calculated', () => {
  const item = invoices.normalizeSupplierInvoice({ items: [{ ...line, ordered_qty: null, received_qty: null, billed_qty: null, unit_price: null, purchase_price: null, discount_amount: null, tax_amount: null, line_total: null }] }).items[0]
  for (const field of ['orderedQty','receivedQty','billedQty','unitPrice','purchasePrice','discountAmount','taxAmount','lineTotal']) assert.equal(item[field], null, field)
  const missing = invoices.normalizeSupplierInvoice({ items: [{ billed_qty: 2, unit_price: 100 }] })
  assert.equal(missing.items[0].lineTotal, null)
  assert.equal(missing.amountPaid, null)
  assert.equal(missing.outstandingAmount, null)
})
test('top-level match booleans, including false and null, override legacy nested values', () => {
  for (const value of [true, false, null]) {
    const invoice = invoices.normalizeSupplierInvoice({ ...bill, quantity_match: value, price_match: value, matching_result: { quantity_match: true, price_match: true, overall: 'pending' } })
    assert.equal(invoice.matching.quantityMatch, value)
    assert.equal(invoice.matching.priceMatch, value)
    assert.equal(invoice.matching.overall, 'matched')
  }
})
test('pending is neutral and a subsequent backend fetch supplies updated verification', async () => {
  let received = 0
  client.get = async () => ({ data: { ...bill, verification_status: received === 10 ? 'matched' : 'pending', quantity_match: received === 10, items: [{ ...line, received_qty: received }] } })
  const pending = (await invoices.getSupplierInvoice('bill')).invoice
  assert.equal(pending.verificationStatus, 'pending')
  assert.equal(invoiceHelpers.verificationMeta(pending.verificationStatus).variant, 'neutral')
  received = 10
  const matched = (await invoices.getSupplierInvoice('bill')).invoice
  assert.equal(matched.verificationStatus, 'matched')
  assert.equal(matched.matching.quantityMatch, true)
  assert.equal(matched.items[0].receivedQty, 10)
})
test('response-only item fields never enter Supplier Invoice requests', () => {
  const normalized = invoices.normalizeSupplierInvoice(bill)
  const body = invoices.buildSupplierInvoiceBody({ supplierId: 's', purchaseId: 'po', supplierInvoiceNumber: 'TEST-PUR-002', invoiceDate: '2026-10-27', items: normalized.items })
  assert.equal(body.items[0].billed_qty, 10)
  assert.equal(body.items[0].unit_price, 1000)
  for (const field of ['ordered_qty','received_qty','purchase_price','available_qty','quantity_match','price_match','discount_amount','tax_amount','line_total']) assert.equal(Object.hasOwn(body.items[0], field), false, field)
})
