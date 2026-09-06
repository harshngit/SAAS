// =============================================================================
// FRONTEND DEMO ACCOUNTS PAYABLE - UI TESTING ONLY
// -----------------------------------------------------------------------------
// Payable rows are DERIVED from the demo Supplier Invoice records (outstanding =
// invoiceTotal - amountPaid). Recording a payment is delegated to the single
// canonical Supplier Payment ledger (features/supplierPayments) - there is no
// second payment store here.
// Real supplier invoices are never touched - real mode shows a future-state.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'
import {
  computeInvoiceTotals,
  derivePaymentStatusFromAmount,
  invoiceOutstanding,
} from '../supplierInvoices/supplierInvoiceHelpers'
import {
  SUPPLIER_INVOICES_DEMO_ENABLED,
  demoSupplierInvoicesResolved,
  getDemoSupplierInvoice,
} from '../supplierInvoices/supplierInvoiceDemoData'
import { paidThisMonth as canonicalPaidThisMonth } from '../supplierPayments/supplierPaymentDemoData'

export const PAYABLES_DEMO_ENABLED = SUPPLIER_INVOICES_DEMO_ENABLED

// "Paid This Month" comes from the canonical Supplier Payment ledger.
export const paidThisMonth = canonicalPaidThisMonth

// One payable row per Supplier Invoice, with the money + status fields the workspace needs.
function toPayable(invoice) {
  const totals = computeInvoiceTotals(invoice.items, invoice.charges)
  const amountPaid = safeNumber(invoice.amountPaid)
  const outstanding = invoiceOutstanding({ invoiceTotal: totals.invoiceTotal, amountPaid })
  return {
    id: invoice.id,
    supplierId: invoice.supplierId,
    supplierName: invoice.supplierName,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    purchaseNumber: invoice.purchaseNumber || '',
    grnNumber: invoice.grnNumber || '',
    invoiceStatus: invoice.invoiceStatus,
    invoiceTotal: totals.invoiceTotal,
    amountPaid,
    outstanding,
    paymentStatus: derivePaymentStatusFromAmount(amountPaid, totals.invoiceTotal),
    createdAt: invoice.createdAt,
  }
}

export function demoPayables() {
  return demoSupplierInvoicesResolved()
    .filter((invoice) => invoice.invoiceStatus !== 'cancelled')
    .map(toPayable)
}

export function getDemoPayable(invoiceId) {
  const invoice = getDemoSupplierInvoice(invoiceId)
  return invoice ? toPayable(invoice) : null
}
