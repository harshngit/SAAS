import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
let server, ap, payments, invoices, helpers, client
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ap = await server.ssrLoadModule('/src/api/accountsPayable.js')
  payments = await server.ssrLoadModule('/src/api/supplierPayments.js')
  invoices = await server.ssrLoadModule('/src/api/supplierInvoices.js')
  helpers = await server.ssrLoadModule('/src/features/supplierInvoices/supplierInvoiceHelpers.js')
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
})
after(async () => server?.close())
const summaryResponse = {
  summary: { total_payable: 333197, total_overdue: 0, total_due_today: 0, open_invoice_count: 5, supplier_count: 3 },
  ageing: { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 },
}
test('AP reads exact nested summary fields and ignores conflicting legacy/top-level fields', async () => {
  client.get = async (path) => {
    assert.equal(path, '/accounts-payable/summary')
    return { data: { ...summaryResponse, total_payable: 999, open_invoice_count: 999, open_invoices: 999, open_suppliers: 999, total_outstanding: 999 } }
  }
  assert.deepEqual((await ap.getAccountsPayableSummary()).summary, {
    totalPayable: 333197, totalOverdue: 0, dueToday: 0, openInvoiceCount: 5, supplierCount: 3,
    ageing: { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 },
  })
})
test('each ageing bucket uses its exact canonical path; zero is not replaced by legacy values', () => {
  const response = ap.normalizePayableSummary({
    ...summaryResponse, summary: { ...summaryResponse.summary, total_due_today: 23 },
    ageing: { bucket_0_30: 0, bucket_31_60: 31, bucket_61_90: 61, bucket_90_plus: 90, '0_30': 999 },
    bucket_0_30: 999,
  })
  assert.equal(response.dueToday, 23)
  assert.deepEqual(response.ageing, { '0_30': 0, '31_60': 31, '61_90': 61, '90_plus': 90 })
})
test('no-due-date liabilities retain payable totals/counts without manufacturing ageing amounts', () => {
  const summary = ap.normalizePayableSummary(summaryResponse)
  assert.equal(summary.totalPayable, 333197)
  assert.equal(summary.openInvoiceCount, 5)
  assert.equal(summary.supplierCount, 3)
  assert.equal(summary.totalOverdue, 0)
  assert.equal(Object.values(summary.ageing).reduce((sum, amount) => sum + amount, 0), 0)
})
test('invoice history keeps voided and recorded rows and trusts status over payment_status', async () => {
  const rows = [
    { id: 'void', payment_number: 'SPAY-10001-2026-0002', allocated_amount: 6000, status: 'voided', payment_status: 'recorded', voided_at: '2026-10-27T12:00:00Z', void_reason: 'Duplicate payment' },
    { id: 'paid', payment_number: 'SPAY-10001-2026-0001', allocated_amount: 4000, status: 'recorded', payment_status: 'voided' },
  ]
  client.get = async path => {
    assert.equal(path, '/supplier-invoices/invoice/payments')
    return { data: rows }
  }
  const result = await payments.getSupplierInvoicePayments('invoice')
  assert.equal(result.payments.length, 2)
  assert.equal(result.payments[0].allocatedAmount, 6000)
  assert.equal(result.payments[0].status, 'voided')
  assert.equal(result.payments[0].voidReason, 'Duplicate payment')
  assert.equal(result.payments[0].voidedAt, rows[0].voided_at)
  assert.equal(helpers.invoicePaymentHistoryStatusMeta(result.payments[0].status).label, 'Voided')
  assert.equal(helpers.invoicePaymentHistoryStatusMeta(result.payments[1].status).label, 'Recorded')
  const invoice = invoices.normalizeSupplierInvoice({ amount_paid: 4000, outstanding_amount: 6000, payment_status: 'partially_paid', grand_total: 10000 })
  assert.equal(invoice.amountPaid, 4000)
  assert.equal(invoice.outstandingAmount, 6000)
  assert.equal(invoice.paymentStatus, 'partially_paid')
})
test('missing and unknown history states never become Recorded', async () => {
  client.get = async () => ({ data: [{ id: 'missing', payment_status: 'recorded' }, { id: 'new', status: 'under_review' }] })
  const result = await payments.getSupplierInvoicePayments('invoice')
  assert.equal(helpers.invoicePaymentHistoryStatusMeta(result.payments[0].status).label, 'Unknown')
  assert.equal(helpers.invoicePaymentHistoryStatusMeta(result.payments[1].status).label, 'Under Review')
  assert.equal(helpers.invoicePaymentHistoryStatusMeta(result.payments[1].status).variant, 'neutral')
})
test('canonical allocated zero/null does not fall back to allocation sums', async () => {
  client.get = async () => ({ data: [
    { id: 'zero', allocated_amount: 0, allocations: [{ supplier_invoice_id: 'invoice', amount: 6000 }] },
    { id: 'null', allocated_amount: null },
  ] })
  const result = await payments.getSupplierInvoicePayments('invoice')
  assert.equal(result.payments[0].allocatedAmount, 0)
  assert.equal(result.payments[1].allocatedAmount, null)
})
