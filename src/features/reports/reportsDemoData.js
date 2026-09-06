// =============================================================================
// Local-only demo layer for the Reports viewer.
// -----------------------------------------------------------------------------
// Explicit switch ONLY (VITE_DEMO_DATA=true). When on, api/reports.js returns
// ONLY this derived data and NEVER calls GET /reports/* or the export endpoint.
//
// Derived from the existing demo business stores so the numbers stay coherent
// with the rest of the demo app - no second fake universe:
//   Sales               <- demo orders
//   Customer Outstanding <- demo invoices (open receivables)
//   Payment Collection   <- demo payment receipts
//   Expense              <- demo expenses
//
// Every other report type returns a truthful "not available in demo" result -
// it never falls through to the real API.
//
// TODO: remove once a demo-aware reporting aggregation exists.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { formatCurrency, toLocalDateString } from '../../utils/format'
import { demoOrdersResolved } from '../orders/orderDemoData'
import { demoInvoicesResolved, demoReceiptsResult } from '../invoices/invoiceDemoData'
import { agingBucket, daysOverdue, financialStatus, isInvoiceOverdue, isOpenReceivable } from '../invoices/invoiceHelpers'
import { DEMO_EXPENSES_ENABLED, demoExpensesResolved } from '../expenses/expenseDemo'

// Fixtures exist only for VITE_DEMO_DATA=true. Whether the REAL /reports/* API may be called
// is a separate question - that is gated on DEMO_MODE (see api/reports.js), so
// VITE_DEMO_DATA=empty gets an empty demo result, never a real call.
export const REPORTS_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export const DEMO_SUPPORTED_REPORTS = ['sales', 'customer-outstanding', 'payment-collection', 'expense']

// Only committed sales count - never Draft orders (or quotations, or cancelled).
const COMMITTED_SALE_STATUSES = new Set(['confirmed', 'completed'])
export const isCommittedSale = (order) => COMMITTED_SALE_STATUSES.has(String(order?.status || '').toLowerCase())

const inRange = (value, from, to) => {
  const day = String(value || '').slice(0, 10)
  if (!day) return false
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

const money = (value) => formatCurrency(Math.round((Number(value) || 0) * 100) / 100)

function salesReport(from, to) {
  const orders = demoOrdersResolved()
    .filter(isCommittedSale)
    .filter((order) => inRange(order.orderDate || order.createdAt, from, to))
  const total = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  return {
    summary: {
      sales_value: money(total),
      orders: String(orders.length),
      average_order_value: money(orders.length ? total / orders.length : 0),
    },
    rows: orders
      .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0))
      .map((order) => ({
        date: toLocalDateString(new Date(order.orderDate || order.createdAt)),
        order_no: order.orderNumber,
        customer: order.customerName,
        salesperson: order.salespersonName || '—',
        amount: money(order.total),
        status: order.status,
      })),
  }
}

function customerOutstandingReport() {
  const open = demoInvoicesResolved().filter(isOpenReceivable)
  const total = open.reduce((sum, invoice) => sum + (Number(invoice.outstandingAmount) || 0), 0)
  const overdue = open.filter(isInvoiceOverdue).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
  return {
    summary: {
      total_outstanding: money(total),
      overdue: money(overdue),
      customers_with_balance: String(new Set(open.map((invoice) => invoice.customerId || invoice.customerName)).size),
    },
    rows: open
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
      .map((invoice) => ({
        customer: invoice.customerName,
        invoice_no: invoice.invoiceNumber,
        due_date: invoice.dueDate ? toLocalDateString(new Date(invoice.dueDate)) : '—',
        outstanding: money(invoice.outstandingAmount),
        age: daysOverdue(invoice) > 0 ? `${agingBucket(invoice)} (${daysOverdue(invoice)}d)` : agingBucket(invoice),
        status: financialStatus(invoice),
      })),
  }
}

function paymentCollectionReport(from, to) {
  const receipts = (demoReceiptsResult().receipts || []).filter((receipt) => inRange(receipt.receiptDate || receipt.createdAt, from, to))
  const total = receipts.reduce((sum, receipt) => sum + (Number(receipt.amountReceived) || 0), 0)
  return {
    summary: {
      total_collected: money(total),
      receipts: String(receipts.length),
    },
    rows: receipts
      .sort((a, b) => new Date(b.receiptDate || 0) - new Date(a.receiptDate || 0))
      .map((receipt) => ({
        date: receipt.receiptDate ? toLocalDateString(new Date(receipt.receiptDate)) : '—',
        receipt_no: receipt.receiptNumber,
        customer: receipt.customerName || '—',
        mode: String(receipt.paymentMethod || '—').replace(/_/g, ' '),
        amount: money(receipt.amountReceived),
      })),
  }
}

function expenseReport(from, to) {
  if (!DEMO_EXPENSES_ENABLED) return { summary: {}, rows: [] }
  const expenses = demoExpensesResolved().filter((expense) => inRange(expense.expenseDate || expense.createdAt, from, to))
  const sum = (list) => list.reduce((acc, expense) => acc + (Number(expense.amount) || 0), 0)
  const approved = expenses.filter((expense) => expense.statusKey === 'approved')
  const rejected = expenses.filter((expense) => expense.statusKey === 'rejected')
  // Reimbursed only where the demo actually persisted a Paid payment status.
  const reimbursed = approved.filter((expense) => String(expense.paymentStatus).toLowerCase() === 'paid')
  return {
    summary: {
      total_submitted: money(sum(expenses)),
      total_expense: money(sum(expenses)),
      approved: money(sum(approved)),
      rejected: money(sum(rejected)),
      reimbursed: money(sum(reimbursed)),
    },
    rows: expenses
      .sort((a, b) => new Date(b.expenseDate || 0) - new Date(a.expenseDate || 0))
      .map((expense) => ({
        date: expense.expenseDate ? toLocalDateString(new Date(expense.expenseDate)) : '—',
        category: expense.category,
        description: expense.description,
        amount: money(expense.amount),
        status: expense.statusLabel || expense.approvalStatus,
        payment: expense.statusKey === 'approved' ? expense.paymentStatus : '—',
      })),
  }
}

export function getDemoReport(type, params = {}) {
  // VITE_DEMO_DATA=empty -> demo mode, zero fixtures. Truthful empty result, never a real call.
  if (DEMO_EMPTY) return { success: true, report: { summary: {}, rows: [] } }

  const from = params.date_from || null
  const to = params.date_to || null

  switch (type) {
    case 'sales':
      return { success: true, report: salesReport(from, to) }
    case 'customer-outstanding':
      return { success: true, report: customerOutstandingReport() }
    case 'payment-collection':
      return { success: true, report: paymentCollectionReport(from, to) }
    case 'expense':
      return { success: true, report: expenseReport(from, to) }
    default:
      // Truthful "not in demo" - success:true with empty data + a flag, so callers that only
      // check `success` (e.g. AccountantDashboard) degrade to zeros instead of erroring, and
      // the Reports viewer shows a clear "not available in demo mode" empty state.
      return { success: true, report: { summary: {}, rows: [], demoUnavailable: true } }
  }
}
