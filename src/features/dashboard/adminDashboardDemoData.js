// =============================================================================
// Local-only demo layer for the Admin Dashboard.
// -----------------------------------------------------------------------------
// api/dashboard.js routes here whenever DEMO_MODE is on (true OR empty) so
// GET /dashboard/admin is NEVER called in demo mode.
//
//   VITE_DEMO_DATA=true  -> a coherent shape derived from the existing demo
//                           stores (orders / invoices / receipts / expenses).
//   VITE_DEMO_DATA=empty -> the same shape with zero / empty values.
//
// Only the blocks AdminDashboard.jsx actually reads are populated; optional
// sections it never renders (stock_watch valuation, etc.) are empty arrays.
// Derived from the shared demo stores - no second fake universe, no circular
// import (every demo store only imports config/demoMode).
//
// TODO: remove once a demo-aware /dashboard/admin exists.
// =============================================================================

import { toLocalDateString } from '../../utils/format'
import { demoOrdersResolved } from '../orders/orderDemoData'
import { demoInvoicesResolved, demoReceiptsResult } from '../invoices/invoiceDemoData'
import { isInvoiceOverdue, isOpenReceivable } from '../invoices/invoiceHelpers'
import { DEMO_EXPENSES_ENABLED, demoExpensesResolved } from '../expenses/expenseDemo'
import { isCommittedSale } from '../reports/reportsDemoData'

const EMPTY_DASHBOARD = {
  filters: {},
  summary: {
    period_sales: 0,
    month_sales: 0,
    purchases: 0,
    expenses: 0,
    new_customers: 0,
    gross_profit: 0,
    net_profit: 0,
    sales_growth_percentage: 0,
  },
  orders: {},
  cashflow: [],
  receivables_payables: { receivables: 0, payables: 0, overdue_receivables: 0, overdue_payables: 0 },
  top_customers: [],
  top_products: [],
  expense_breakdown: [],
  sales_trend: [],
  stock_watch: [],
  recent_orders: [],
}

export function emptyDemoAdminDashboard() {
  return JSON.parse(JSON.stringify(EMPTY_DASHBOARD))
}

function byDate(map) {
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, ...value }))
}

export function buildDemoAdminDashboard() {
  const orders = demoOrdersResolved()
  const committed = orders.filter(isCommittedSale)
  const invoices = demoInvoicesResolved()
  const open = invoices.filter(isOpenReceivable)
  const receipts = demoReceiptsResult().receipts || []
  const expenses = DEMO_EXPENSES_ENABLED ? demoExpensesResolved() : []

  const periodSales = committed.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  const expenseTotal = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)

  // cashflow: inflow = demo receipts by day; outflow = demo (paid) expenses by day.
  const flow = new Map()
  const bump = (day, key, amount) => {
    if (!day) return
    const row = flow.get(day) || { inflow: 0, outflow: 0 }
    row[key] += amount
    flow.set(day, row)
  }
  receipts.forEach((r) => bump(String(r.receiptDate || '').slice(0, 10), 'inflow', Number(r.amountReceived) || 0))
  expenses
    .filter((e) => String(e.paymentStatus).toLowerCase() === 'paid')
    .forEach((e) => bump(String(e.expenseDate || '').slice(0, 10), 'outflow', Number(e.amount) || 0))

  // sales_trend: committed order value by order date.
  const trend = new Map()
  committed.forEach((order) => {
    const day = String(order.orderDate || order.createdAt || '').slice(0, 10)
    if (day) trend.set(day, { sales: (trend.get(day)?.sales || 0) + (Number(order.total) || 0) })
  })

  // top_customers by committed sales.
  const byCustomer = new Map()
  committed.forEach((order) => {
    const name = order.customerName || '—'
    byCustomer.set(name, (byCustomer.get(name) || 0) + (Number(order.total) || 0))
  })

  // top_products by committed order line value.
  const byProduct = new Map()
  committed.forEach((order) => {
    ;(order.items || []).forEach((item) => {
      const name = item.productName || item.productId
      const entry = byProduct.get(name) || { sales_amount: 0, quantity: 0 }
      entry.sales_amount += Number(item.lineTotal) || (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)
      entry.quantity += Number(item.quantity) || 0
      byProduct.set(name, entry)
    })
  })

  // expense_breakdown by category.
  const byCategory = new Map()
  expenses.forEach((e) => {
    if (e.category) byCategory.set(e.category, (byCategory.get(e.category) || 0) + (Number(e.amount) || 0))
  })

  return {
    filters: {},
    summary: {
      period_sales: periodSales,
      month_sales: periodSales,
      purchases: 0,
      expenses: expenseTotal,
      new_customers: new Set(committed.map((order) => order.customerId || order.customerName)).size,
      gross_profit: 0,
      net_profit: 0,
      sales_growth_percentage: 0,
    },
    orders: {},
    cashflow: byDate(flow),
    receivables_payables: {
      receivables: open.reduce((sum, invoice) => sum + (Number(invoice.outstandingAmount) || 0), 0),
      payables: 0,
      overdue_receivables: open.filter(isInvoiceOverdue).reduce((sum, invoice) => sum + invoice.outstandingAmount, 0),
      overdue_payables: 0,
    },
    top_customers: [...byCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([customer_name, sales]) => ({ customer_name, sales })),
    top_products: [...byProduct.entries()]
      .sort((a, b) => b[1].sales_amount - a[1].sales_amount)
      .slice(0, 5)
      .map(([product_name, value]) => ({ product_name, ...value })),
    expense_breakdown: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })),
    sales_trend: byDate(trend),
    stock_watch: [],
    recent_orders: [...orders]
      .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0))
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        order_number: order.orderNumber,
        customer_name: order.customerName,
        status: order.status,
        payment_status: order.invoiceId ? 'invoiced' : 'pending',
        total: order.total,
        date: order.orderDate ? toLocalDateString(new Date(order.orderDate)) : '',
      })),
  }
}
