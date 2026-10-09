// =============================================================================
// Central Reports configuration - the single source of truth for the report library,
// per-report filters, summary cards and fallback table columns.
// -----------------------------------------------------------------------------
// Backend contract: GET /reports/{report_type} returns
//   { type, date_from, date_to, summary, rows, pagination, meta: { columns }, chart }
// `meta.columns` (when the backend sends it) is the real schema for a report's table - the
// `columns` arrays below are FALLBACKS only, used when a response has no meta.columns, and to
// attach frontend-only display hints (type/align/reference-link) when it does. Never derive a
// table's columns from Object.keys(rows[0]) - a report's rows can be empty, or a later row can
// carry fields an earlier one doesn't, and that would both mis-render and leak raw snake_case.
//
// Status/mode vocabularies below are grounded in one of two ways, never invented:
//   (a) confirmed - handed to us directly in the finalized Reports contract (ageing buckets,
//       the inventory summary/filter keys, the supplier-payment keys), used verbatim; or
//   (b) reused from this SAME codebase's own real, already-integrated backend enum for that
//       exact domain (Purchases, Expenses, Sales/Purchase Returns, Supplier Invoices, Supplier
//       Payments, and the app-wide canonical payment-method list) - not a Reports-specific guess,
//       but the live value that module's own real API already accepts.
// Anywhere neither ground exists (no confirmed contract value AND no matching real module to
// copy from), the filter is intentionally left as free text or omitted rather than asserting a
// made-up enum - see the per-filter comments below and the integration report for the full list.
// =============================================================================

import { paymentMethodOptions } from '../payments/paymentMethodUtils'

export const REPORT_CATEGORIES = [
  { key: 'sales', label: 'Sales & Receivables' },
  { key: 'purchases', label: 'Purchases & Payables' },
  { key: 'financial', label: 'Financial' },
  { key: 'inventory', label: 'Inventory' },
]

// ---- shared filter option vocabularies ---------------------------------------------------

// Reuses the app-wide canonical payment-method list (src/features/payments/paymentMethodUtils.js)
// instead of a second, incomplete local list - same values this app's real payment flows already
// send (upi/card/cash/cod/bank_transfer/cheque). Query param stays `payment_mode`, the name the
// Reports contract itself declares for this filter across every report that has it.
export const PAYMENT_MODE_FILTER_OPTIONS = paymentMethodOptions

// Confirmed canonical backend values (underscore form, not hyphen/"+"). Labels stay the
// friendly en-dash form; only the VALUE sent to the API changed.
export const AGEING_BUCKET_OPTIONS = [
  { value: '0_30', label: '0–30 days' },
  { value: '31_60', label: '31–60 days' },
  { value: '61_90', label: '61–90 days' },
  { value: '90_plus', label: '90+ days' },
]

// Reused verbatim from Supplier Invoices' own real backend integration (verification_status is
// independent of lifecycle there too - see src/features/supplierInvoices/supplierInvoiceHelpers.js).
export const VERIFICATION_STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending Verification' },
  { value: 'matched', label: 'Matched' },
  { value: 'mismatched', label: 'Mismatch / Review' },
]

// Reused from Supplier Invoices' own real `payment_status` (unpaid/partially_paid/paid) - the
// only module in this app with a confirmed raw payment_status enum. Sales report's own
// `payment_status` filter reuses the same vocabulary for consistency; this specific reuse across
// the sales domain is not independently confirmed - see integration report.
export const INVOICE_PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]

// Reused verbatim from Purchases' own real lifecycle (src/features/purchases/purchaseHelpers.js /
// src/api/purchases.js: draft -> confirmed -> closed, or cancelled).
export const PURCHASE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Reused verbatim from Expenses' own real approval status.
export const EXPENSE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'clarification_requested', label: 'Clarification Requested' },
]

// Reused verbatim from Sales Returns' own real lifecycle (requested -> received -> approved,
// no separate "complete" step - see src/features/salesReturns).
export const SALES_RETURN_STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'received', label: 'Received' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Reused verbatim from Purchase Returns' own real lifecycle.
export const PURCHASE_RETURN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Reused verbatim from Supplier Payments' own real status (recorded / voided - see
// src/features/supplierPayments/supplierPaymentHelpers.js).
export const SUPPLIER_PAYMENT_STATUS_OPTIONS = [
  { value: 'recorded', label: 'Recorded' },
  { value: 'voided', label: 'Voided' },
]

export const SALES_GROUP_BY_OPTIONS = [
  { value: 'transaction', label: 'By Transaction' },
  { value: 'customer', label: 'By Customer' },
  { value: 'product', label: 'By Product' },
  { value: 'salesperson', label: 'By Salesperson' },
]

export const PURCHASE_GROUP_BY_OPTIONS = [
  { value: 'transaction', label: 'By Transaction' },
  { value: 'supplier', label: 'By Supplier' },
  { value: 'product', label: 'By Product' },
]

// ---- entity reference routes (only where a route definitely exists) ---------------------
// Keyed by refType; each resolves a row to a URL or null (never a guessed/invented path). The
// matching `idKey` on each column below is always a *_id field, the same UUID convention this
// backend's own confirmed filter params already use (customer_id/supplier_id/product_id/...) -
// never a business number/reference text standing in for a route that expects a UUID. A column
// whose row doesn't actually carry that id field simply renders as plain text (ReportTable's
// ReferenceCell falls back automatically) rather than building a broken link.
export const ENTITY_ROUTES = {
  customer: (id) => (id ? `/admin/customers/${id}` : null),
  supplier: (id) => (id ? `/admin/suppliers/${id}` : null),
  product: (id) => (id ? `/admin/products/${id}` : null),
  order: (id) => (id ? `/admin/orders/${id}` : null),
  purchase: (id) => (id ? `/admin/purchases/${id}` : null),
  // Invoice Detail's real route IS keyed by the business invoice number, not a UUID
  // (`/admin/invoices/:invoiceNumber` - confirmed in src/routes/AppRoutes.jsx) - this one
  // legitimately links off a business-reference field, by design, not by mistake.
  invoice: (invoiceNumber) => (invoiceNumber ? `/admin/invoices/${invoiceNumber}` : null),
  salesReturn: (id) => (id ? `/admin/sales-returns/${id}` : null),
  purchaseReturn: (id) => (id ? `/admin/purchase-returns/${id}` : null),
  delivery: (id) => (id ? `/admin/deliveries/${id}` : null),
}

// ---- column helpers -----------------------------------------------------------------------
// Exported so the bespoke Sales Overview / Cash Flow Sheet pages (which have their own custom
// layouts and aren't wired into REPORT_CONFIG/FinancialReports) can build ReportTable-compatible
// fallback columns the exact same way every report below does, instead of a second definition.
export const col = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra })
export const ref = (key, label, refType, idKey, extra = {}) => ({ key, label, type: 'reference', refType, idKey, ...extra })

// ---- per-report config --------------------------------------------------------------------
// filters[].type: 'entity' (searchable Select backed by a shared, already-loaded list),
//                 'select' (static options), 'toggle' (boolean checkbox), 'text' (free-text
//                 query param, used only where no confirmed/reusable enum exists), 'search'
//                 handled separately by the toolbar's own search box.
//
// chartKeys, where present, names the exact backend chart.data point keys this report's chart
// plots (see components/ReportChart.jsx) - confirmed examples only; a report with no chartKeys
// simply never renders a chart, rather than guessing which field in an unknown point shape is
// the value.
export const REPORT_CONFIG = {
  'daily-transaction': {
    label: 'Daily Transactions',
    category: 'financial',
    description: 'Business activity and actual cash movement for the selected day(s).',
    filters: [],
    summaryCards: [
      { keys: ['sales'], label: 'Sales', format: 'currency' },
      { keys: ['purchases'], label: 'Purchases', format: 'currency' },
      { keys: ['customer_collections'], label: 'Customer Collections', format: 'currency' },
      { keys: ['supplier_payments'], label: 'Supplier Payments', format: 'currency' },
      { keys: ['expenses'], label: 'Expenses', format: 'currency' },
      { keys: ['cash_in'], label: 'Cash In', format: 'currency' },
      { keys: ['cash_out'], label: 'Cash Out', format: 'currency' },
      { keys: ['net_cash_flow'], label: 'Net Cash Flow', format: 'currency' },
    ],
    columns: [
      col('date', 'Date', 'date'),
      col('transaction_type', 'Type', 'status'),
      // Not linked: a daily-transaction row's reference can be a sale, purchase, payment or
      // expense depending on transaction_type - there is no single safe entity type to route it
      // to, so it stays plain text rather than risk linking a purchase row to /admin/orders/....
      col('reference', 'Reference', 'text'),
      col('party', 'Party', 'text'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('cash_impact', 'Cash Impact', 'currency', { align: 'right' }),
    ],
    chartTitle: 'Cash In vs Cash Out',
  },

  sales: {
    label: 'Sales',
    category: 'sales',
    description: 'Invoice-based sales performance and collections.',
    filters: [
      { key: 'customer_id', type: 'entity', entity: 'customer', label: 'Customer' },
      { key: 'product_id', type: 'entity', entity: 'product', label: 'Product' },
      { key: 'salesperson_id', type: 'entity', entity: 'salesperson', label: 'Salesperson' },
      { key: 'warehouse_id', type: 'entity', entity: 'warehouse', label: 'Warehouse' },
      { key: 'payment_status', type: 'select', label: 'Payment Status', options: INVOICE_PAYMENT_STATUS_OPTIONS },
    ],
    groupBy: { key: 'group_by', options: SALES_GROUP_BY_OPTIONS },
    summaryCards: [
      { keys: ['net_sales', 'sales_value'], label: 'Net Sales', format: 'currency' },
      { keys: ['invoice_count', 'orders'], label: 'Invoice Count', format: 'number' },
      { keys: ['tax'], label: 'Tax', format: 'currency' },
      { keys: ['collected'], label: 'Collected', format: 'currency' },
      { keys: ['outstanding'], label: 'Outstanding', format: 'currency' },
    ],
    columns: [
      col('date', 'Date', 'date'),
      ref('order_no', 'Order / Invoice', 'order', 'order_id'),
      ref('customer', 'Customer', 'customer', 'customer_id'),
      col('salesperson', 'Salesperson', 'text'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('tax', 'Tax', 'currency', { align: 'right' }),
      col('outstanding', 'Outstanding', 'currency', { align: 'right' }),
      col('status', 'Status', 'status'),
    ],
    chartTitle: 'Sales Trend',
    chartKeys: { labelKey: 'date', valueKey: 'sales', valueType: 'currency' },
  },

  purchase: {
    label: 'Purchases',
    category: 'purchases',
    description: 'Purchase order value and supplier activity.',
    filters: [
      { key: 'supplier_id', type: 'entity', entity: 'supplier', label: 'Supplier' },
      { key: 'product_id', type: 'entity', entity: 'product', label: 'Product' },
      { key: 'warehouse_id', type: 'entity', entity: 'warehouse', label: 'Warehouse' },
      { key: 'status', type: 'select', label: 'Status', options: PURCHASE_STATUS_OPTIONS },
    ],
    groupBy: { key: 'group_by', options: PURCHASE_GROUP_BY_OPTIONS },
    summaryCards: [
      { keys: ['purchase_value'], label: 'Purchase Value', format: 'currency' },
      { keys: ['transaction_count', 'purchases'], label: 'Transaction Count', format: 'number' },
      { keys: ['tax'], label: 'Tax', format: 'currency' },
      { keys: ['supplier_count'], label: 'Supplier Count', format: 'number' },
    ],
    columns: [
      col('date', 'Date', 'date'),
      ref('purchase_no', 'Purchase', 'purchase', 'purchase_id'),
      ref('supplier', 'Supplier', 'supplier', 'supplier_id'),
      col('warehouse', 'Warehouse', 'text'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('tax', 'Tax', 'currency', { align: 'right' }),
      col('status', 'Status', 'status'),
    ],
    // No confirmed chart.data key names for this report - chart stays hidden rather than guess.
  },

  'customer-outstanding': {
    label: 'Customer Outstanding',
    category: 'sales',
    description: 'Current customer receivables and ageing.',
    noAsOfDate: true,
    filters: [
      { key: 'customer_id', type: 'entity', entity: 'customer', label: 'Customer' },
      { key: 'ageing_bucket', type: 'select', label: 'Ageing Bucket', options: AGEING_BUCKET_OPTIONS },
      { key: 'overdue_only', type: 'toggle', label: 'Overdue only' },
    ],
    summaryCards: [
      { keys: ['total_outstanding'], label: 'Total Outstanding', format: 'currency' },
      { keys: ['total_overdue'], label: 'Total Overdue', format: 'currency' },
      { keys: ['customers_with_balance'], label: 'Customers With Balance', format: 'number' },
      { keys: ['0_30'], label: '0–30 days', format: 'currency' },
      { keys: ['31_60'], label: '31–60 days', format: 'currency' },
      { keys: ['61_90'], label: '61–90 days', format: 'currency' },
      { keys: ['90_plus'], label: '90+ days', format: 'currency' },
    ],
    columns: [
      ref('customer', 'Customer', 'customer', 'customer_id'),
      ref('invoice_no', 'Invoice', 'invoice', 'invoice_number'),
      col('invoice_date', 'Invoice Date', 'date'),
      col('due_date', 'Due Date', 'date'),
      col('billed', 'Billed', 'currency', { align: 'right' }),
      col('received', 'Received', 'currency', { align: 'right' }),
      col('outstanding', 'Outstanding', 'currency', { align: 'right' }),
      col('days_overdue', 'Days Overdue', 'number', { align: 'right' }),
      col('ageing_bucket', 'Ageing Bucket', 'status'),
    ],
    chartTitle: 'Receivables Ageing',
    chartKeys: { labelKey: 'ageing_bucket', valueKey: 'amount', valueType: 'currency' },
  },

  'supplier-outstanding': {
    label: 'Supplier Outstanding',
    category: 'purchases',
    description: 'Current supplier payables and ageing.',
    noAsOfDate: true,
    filters: [
      { key: 'supplier_id', type: 'entity', entity: 'supplier', label: 'Supplier' },
      { key: 'payment_status', type: 'select', label: 'Payment Status', options: INVOICE_PAYMENT_STATUS_OPTIONS },
      { key: 'verification_status', type: 'select', label: 'Verification', options: VERIFICATION_STATUS_FILTER_OPTIONS },
      { key: 'ageing_bucket', type: 'select', label: 'Ageing Bucket', options: AGEING_BUCKET_OPTIONS },
      { key: 'overdue_only', type: 'toggle', label: 'Overdue only' },
    ],
    summaryCards: [
      { keys: ['total_payable'], label: 'Total Payable', format: 'currency' },
      { keys: ['total_overdue'], label: 'Total Overdue', format: 'currency' },
      { keys: ['suppliers_with_balance'], label: 'Suppliers With Balance', format: 'number' },
      { keys: ['0_30'], label: '0–30 days', format: 'currency' },
      { keys: ['31_60'], label: '31–60 days', format: 'currency' },
      { keys: ['61_90'], label: '61–90 days', format: 'currency' },
      { keys: ['90_plus'], label: '90+ days', format: 'currency' },
    ],
    columns: [
      ref('supplier', 'Supplier', 'supplier', 'supplier_id'),
      col('supplier_code', 'Supplier ID', 'text'),
      col('invoice_no', 'Invoice', 'text'),
      col('invoice_date', 'Invoice Date', 'date'),
      col('due_date', 'Due Date', 'date'),
      col('grand_total', 'Grand Total', 'currency', { align: 'right' }),
      col('return_amount', 'Return Amount', 'currency', { align: 'right' }),
      col('paid', 'Paid', 'currency', { align: 'right' }),
      col('outstanding', 'Outstanding', 'currency', { align: 'right' }),
      col('payment_status', 'Payment Status', 'status'),
      col('days_overdue', 'Days Overdue', 'number', { align: 'right' }),
      col('ageing_bucket', 'Ageing Bucket', 'status'),
    ],
    chartTitle: 'Payables Ageing',
    chartKeys: { labelKey: 'ageing_bucket', valueKey: 'amount', valueType: 'currency' },
  },

  'payment-collection': {
    label: 'Payment Collection',
    category: 'sales',
    description: 'Customer payments received, by mode and reference.',
    filters: [
      { key: 'customer_id', type: 'entity', entity: 'customer', label: 'Customer' },
      { key: 'payment_mode', type: 'select', label: 'Payment Mode', options: PAYMENT_MODE_FILTER_OPTIONS },
    ],
    summaryCards: [
      { keys: ['total_collected'], label: 'Total Collected', format: 'currency' },
      { keys: ['payment_count', 'receipts'], label: 'Payment Count', format: 'number' },
      { keys: ['cash'], label: 'Cash', format: 'currency' },
      { keys: ['upi'], label: 'UPI', format: 'currency' },
      { keys: ['card'], label: 'Card', format: 'currency' },
      { keys: ['other', 'unallocated'], label: 'Other / Unallocated', format: 'currency' },
    ],
    columns: [
      col('receipt_no', 'Receipt', 'text'),
      col('date', 'Date', 'date'),
      ref('customer', 'Customer', 'customer', 'customer_id'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('mode', 'Mode', 'status'),
      col('external_reference', 'External Reference', 'text'),
      ref('invoice_no', 'Allocation / Invoice', 'invoice', 'invoice_number'),
    ],
    // No confirmed chart.data key names for this report - chart stays hidden rather than guess.
  },

  'supplier-payment': {
    label: 'Supplier Payments',
    category: 'purchases',
    description: 'Payments made to suppliers and their invoice allocation.',
    filters: [
      { key: 'supplier_id', type: 'entity', entity: 'supplier', label: 'Supplier' },
      { key: 'payment_mode', type: 'select', label: 'Payment Method', options: PAYMENT_MODE_FILTER_OPTIONS },
      { key: 'status', type: 'select', label: 'Status', options: SUPPLIER_PAYMENT_STATUS_OPTIONS },
    ],
    summaryCards: [
      { keys: ['total_paid'], label: 'Total Paid', format: 'currency' },
      { keys: ['payment_count'], label: 'Payment Count', format: 'number' },
      { keys: ['allocated_amount'], label: 'Allocated', format: 'currency' },
      { keys: ['unallocated_amount'], label: 'Unallocated', format: 'currency' },
    ],
    columns: [
      col('payment_number', 'Payment Reference', 'text'),
      col('date', 'Date', 'date'),
      ref('supplier', 'Supplier', 'supplier', 'supplier_id'),
      col('supplier_code', 'Supplier ID', 'text'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('allocated_amount', 'Allocated', 'currency', { align: 'right' }),
      col('unallocated_amount', 'Unallocated', 'currency', { align: 'right' }),
      col('payment_mode', 'Payment Mode', 'status'),
      col('reference', 'Reference', 'text'),
      col('status', 'Status', 'status'),
    ],
  },

  'cash-collection': {
    label: 'Cash Collection',
    category: 'sales',
    description: 'Cash-only customer collections (including cash splits of mixed payments).',
    filters: [
      { key: 'customer_id', type: 'entity', entity: 'customer', label: 'Customer' },
    ],
    summaryCards: [
      { keys: ['total_cash'], label: 'Total Cash', format: 'currency' },
      { keys: ['entry_count'], label: 'Entry Count', format: 'number' },
      { keys: ['customer_count'], label: 'Customer Count', format: 'number' },
    ],
    columns: [
      col('date', 'Date', 'date'),
      ref('customer', 'Customer', 'customer', 'customer_id'),
      col('reference', 'Reference', 'text'),
      col('cash_amount', 'Cash Amount', 'currency', { align: 'right' }),
    ],
  },

  expense: {
    label: 'Expenses',
    category: 'financial',
    description: 'Submitted business expenses, approvals and reimbursement.',
    filters: [
      { key: 'category', type: 'entity', entity: 'expenseCategory', label: 'Category' },
      { key: 'status', type: 'select', label: 'Status', options: EXPENSE_STATUS_OPTIONS },
      { key: 'payment_mode', type: 'select', label: 'Payment Mode', options: PAYMENT_MODE_FILTER_OPTIONS },
    ],
    summaryCards: [
      { keys: ['approved_expense', 'approved'], label: 'Approved Expense', format: 'currency' },
      { keys: ['pending_expense', 'pending'], label: 'Pending Expense', format: 'currency' },
      { keys: ['rejected_expense', 'rejected'], label: 'Rejected Expense', format: 'currency' },
      { keys: ['tax'], label: 'Tax', format: 'currency' },
      { keys: ['tds'], label: 'TDS', format: 'currency' },
      { keys: ['entry_count'], label: 'Entry Count', format: 'number' },
    ],
    columns: [
      col('expense_ref', 'Expense Ref', 'text'),
      col('date', 'Date', 'date'),
      col('category', 'Category', 'text'),
      col('vendor', 'Vendor / Payee', 'text'),
      col('description', 'Description', 'text'),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('tax', 'Tax', 'currency', { align: 'right' }),
      col('tds', 'TDS', 'currency', { align: 'right' }),
      col('net_payable', 'Net Payable', 'currency', { align: 'right' }),
      col('payment_mode', 'Payment Mode', 'status'),
      col('status', 'Status', 'status'),
      col('submitted_by', 'Submitted By', 'text'),
    ],
    // No confirmed chart.data key names for this report - chart stays hidden rather than guess.
  },

  'gst-summary': {
    label: 'GST Summary',
    category: 'financial',
    // Worded to describe tax position/preparation only - this report does not file or submit
    // GSTR returns, so its description must never imply that.
    description: 'GST summary for filing preparation: output GST, input GST and net tax position.',
    filters: [],
    summaryCards: [
      { keys: ['output_gst'], label: 'Output GST', format: 'currency' },
      { keys: ['input_gst'], label: 'Input GST', format: 'currency' },
      { keys: ['adjustment'], label: 'Adjustment', format: 'currency' },
      { keys: ['net_gst'], label: 'Net GST', format: 'currency' },
    ],
    columns: [
      col('date', 'Date', 'date'),
      // Not linked: this row can be an output-side (sales invoice) or input-side (purchase)
      // entry - `type` tells which, but there's no single safe entity type to route either way.
      col('reference', 'Reference', 'text'),
      col('party', 'Party', 'text'),
      col('taxable_value', 'Taxable Value', 'currency', { align: 'right' }),
      col('tax_rate', 'Tax Rate', 'percent', { align: 'right' }),
      col('tax_amount', 'Tax Amount', 'currency', { align: 'right' }),
      col('type', 'Type', 'status'),
    ],
  },

  'sales-return': {
    label: 'Sales Returns',
    category: 'sales',
    description: 'Customer returns and credit issued against sales.',
    filters: [
      { key: 'customer_id', type: 'entity', entity: 'customer', label: 'Customer' },
      { key: 'status', type: 'select', label: 'Status', options: SALES_RETURN_STATUS_OPTIONS },
    ],
    summaryCards: [
      { keys: ['total_credit', 'credit_amount'], label: 'Total Credit', format: 'currency' },
      { keys: ['return_count'], label: 'Return Count', format: 'number' },
    ],
    columns: [
      col('return_no', 'Return No.', 'text'),
      col('date', 'Date', 'date'),
      ref('customer', 'Customer', 'customer', 'customer_id'),
      ref('invoice_no', 'Invoice / Order', 'invoice', 'invoice_number'),
      col('reason', 'Reason', 'text'),
      col('status', 'Status', 'status'),
      col('quantity', 'Quantity', 'number', { align: 'right' }),
      col('credit_amount', 'Credit Amount', 'currency', { align: 'right' }),
      col('warehouse', 'Warehouse', 'text'),
    ],
  },

  'purchase-return': {
    label: 'Purchase Returns',
    category: 'purchases',
    description: 'Returns made to suppliers against purchases.',
    filters: [
      { key: 'supplier_id', type: 'entity', entity: 'supplier', label: 'Supplier' },
      { key: 'status', type: 'select', label: 'Status', options: PURCHASE_RETURN_STATUS_OPTIONS },
    ],
    summaryCards: [
      { keys: ['total_amount'], label: 'Total Amount', format: 'currency' },
      { keys: ['return_count'], label: 'Return Count', format: 'number' },
    ],
    columns: [
      col('return_no', 'Return No.', 'text'),
      col('date', 'Date', 'date'),
      ref('supplier', 'Supplier', 'supplier', 'supplier_id'),
      ref('purchase_no', 'Purchase / Invoice', 'purchase', 'purchase_id'),
      col('quantity', 'Quantity', 'number', { align: 'right' }),
      col('amount', 'Amount', 'currency', { align: 'right' }),
      col('status', 'Status', 'status'),
      col('reason', 'Reason', 'text'),
      col('source', 'Source', 'text'),
    ],
  },

  'profit-loss': {
    label: 'Profit & Loss',
    category: 'financial',
    description: 'Revenue, cost of goods sold, expenses, and profitability.',
    filters: [],
    summaryCards: [
      { keys: ['net_sales'], label: 'Net Sales', format: 'currency' },
      { keys: ['cogs'], label: 'COGS', format: 'currency' },
      { keys: ['gross_profit'], label: 'Gross Profit', format: 'currency' },
      { keys: ['operating_expenses'], label: 'Operating Expenses', format: 'currency' },
      { keys: ['net_profit'], label: 'Net Profit', format: 'currency' },
      { keys: ['gross_margin_percent', 'gross_margin'], label: 'Gross Margin %', format: 'percent' },
      { keys: ['net_margin_percent', 'net_margin'], label: 'Net Margin %', format: 'percent' },
    ],
    columns: [],
    isSpecialView: 'pnl',
    chartTitle: 'Net Sales / COGS / Expenses / Profit',
    // No confirmed chart.data point shape for P&L (likely several numeric fields on one point,
    // exactly the ambiguous case field-guessing must not resolve on its own) - chart renders
    // only if the backend response's own point literally uses the generic label/value shape
    // (see ReportChart's explicit-only resolution), otherwise it stays hidden.
  },

  'inventory-summary': {
    label: 'Inventory Summary',
    category: 'inventory',
    description: 'Current stock position and current-cost valuation.',
    filters: [
      { key: 'warehouse_id', type: 'entity', entity: 'warehouse', label: 'Warehouse' },
      { key: 'product_id', type: 'entity', entity: 'product', label: 'Product' },
      { key: 'category_id', type: 'entity', entity: 'category', label: 'Category' },
      { key: 'brand_id', type: 'entity', entity: 'brand', label: 'Brand' },
      { key: 'low_stock_only', type: 'toggle', label: 'Low stock only' },
    ],
    summaryCards: [
      { keys: ['inventory_value'], label: 'Inventory Value', format: 'currency' },
      { keys: ['sku_count'], label: 'SKU Count', format: 'number' },
      { keys: ['total_on_hand'], label: 'On Hand', format: 'number' },
      { keys: ['total_reserved'], label: 'Reserved', format: 'number' },
      { keys: ['total_available'], label: 'Available', format: 'number' },
      { keys: ['low_stock_count'], label: 'Low Stock', format: 'number' },
    ],
    columns: [
      ref('product', 'Product', 'product', 'product_id'),
      col('sku', 'SKU', 'text'),
      col('variant', 'Variant', 'text'),
      col('warehouse', 'Warehouse', 'text'),
      col('on_hand', 'On Hand', 'number', { align: 'right' }),
      col('reserved', 'Reserved', 'number', { align: 'right' }),
      col('available', 'Available', 'number', { align: 'right' }),
      col('cost_price', 'Cost Price', 'currency', { align: 'right' }),
      col('stock_value', 'Stock Value', 'currency', { align: 'right' }),
      col('low_stock_status', 'Status', 'status'),
    ],
    chartTitle: 'Valuation by Warehouse',
    chartKeys: { labelKey: 'warehouse', valueKey: 'inventory_value', valueType: 'currency' },
    valuationNote: 'Current cost valuation.',
  },

  'stock-movement': {
    label: 'Stock Movement',
    category: 'inventory',
    description: 'Every stock-in / stock-out event across warehouses.',
    filters: [
      { key: 'warehouse_id', type: 'entity', entity: 'warehouse', label: 'Warehouse' },
      { key: 'product_id', type: 'entity', entity: 'product', label: 'Product' },
      // No confirmed/reusable movement_type enum exists anywhere else in this app (GRN receipt,
      // delivery load, transfer, manual adjustment and returns are each their own module, never
      // unified under one shared field before) - left as free text rather than a guessed select.
      { key: 'movement_type', type: 'text', label: 'Movement Type' },
    ],
    summaryCards: [
      { keys: ['stock_in'], label: 'Stock In', format: 'number' },
      { keys: ['stock_out'], label: 'Stock Out', format: 'number' },
      { keys: ['movement_count'], label: 'Movement Count', format: 'number' },
    ],
    columns: [
      col('created_at', 'Date / Time', 'datetime'),
      col('movement_type', 'Movement Type', 'status'),
      ref('product', 'Product', 'product', 'product_id'),
      col('sku', 'SKU', 'text'),
      col('warehouse', 'Warehouse', 'text'),
      col('quantity', 'Quantity', 'number', { align: 'right', signed: true }),
      col('balance_after', 'Balance After', 'number', { align: 'right' }),
      col('reference', 'Reference', 'text'),
      col('note', 'Note', 'text'),
    ],
  },
}

export function reportsByCategory() {
  const map = new Map(REPORT_CATEGORIES.map((category) => [category.key, { ...category, reports: [] }]))
  Object.entries(REPORT_CONFIG).forEach(([value, config]) => {
    const bucket = map.get(config.category)
    if (bucket) bucket.reports.push({ value, ...config })
  })
  return Array.from(map.values())
}

export function getReportConfig(type) {
  return REPORT_CONFIG[type] || null
}

// The next valid group_by for a report, given a candidate value (e.g. read from the URL on load,
// or carried over from a browser back/forward navigation): the candidate if the report supports
// grouping AND actually lists it as a valid option, the report's own default otherwise, or '' if
// the report doesn't support grouping at all. Never lets an unsupported group_by reach the API.
export function resolveValidGroupBy(config, candidate) {
  const options = config?.groupBy?.options
  if (!options || options.length === 0) return ''
  if (candidate && options.some((option) => option.value === candidate)) return candidate
  return options[0]?.value || ''
}
