// Canonical entitlement/limit keys, exactly as given by the finalized backend contract (GET
// /organizations/me/entitlements -> features: {key: bool}, limits: {key: int|null}). These are
// NOT invented frontend aliases - every key here is copied verbatim from the contract, including
// the canonical P&L key `report.profit_loss` (never the deprecated `report.profit_and_loss`,
// and never confused with the Reports module's own report TYPE string `profit-loss` - see
// ENTITLEMENT_TO_REPORT_TYPE below for that distinct mapping).

export const ENTITLEMENT_KEYS = {
  CRM_CUSTOMERS: 'crm.customers',
  CRM_LEADS: 'crm.leads',
  CRM_QUOTATIONS: 'crm.quotations',

  ERP_BRANDS: 'erp.brands',
  ERP_CATEGORIES: 'erp.categories',
  ERP_PRODUCTS: 'erp.products',
  ERP_SUPPLIERS: 'erp.suppliers',
  ERP_INVENTORY: 'erp.inventory',
  ERP_WAREHOUSES: 'erp.warehouses',
  ERP_PURCHASES: 'erp.purchases',
  ERP_PURCHASE_RETURNS: 'erp.purchase_returns',

  FINANCE_RECEIVABLES: 'finance.receivables',
  FINANCE_ACCOUNTS_PAYABLE: 'finance.accounts_payable',
  FINANCE_SUPPLIER_PAYMENTS: 'finance.supplier_payments',
  FINANCE_COLLECTION_RECONCILIATION: 'finance.collection_reconciliation',
  FINANCE_EXPENSES: 'finance.expenses',
  FINANCE_REPORTS: 'finance.reports',

  INVOICE_SALES_INVOICES: 'invoice.sales_invoices',
  INVOICE_SUPPLIER_INVOICES: 'invoice.supplier_invoices',

  SALES_ORDERS: 'sales.orders',
  SALES_SALES_RETURNS: 'sales.sales_returns',
  SALES_DELIVERIES: 'sales.deliveries',
  SALES_SALES: 'sales.sales',
  SALES_VEHICLES: 'sales.vehicles',
  SALES_VEHICLE_STOCK: 'sales.vehicle_stock',

  EMPLOYEE_STAFF: 'employee.staff',
  EMPLOYEE_ATTENDANCE: 'employee.attendance',
  EMPLOYEE_LEAVES: 'employee.leaves',
  EMPLOYEE_ROLES_PERMISSIONS: 'employee.roles_permissions',

  NOTIFICATIONS_WHATSAPP_DELIVERY: 'notifications.whatsapp_delivery',

  REPORT_DAILY_TRANSACTION: 'report.daily_transaction',
  REPORT_SALES: 'report.sales',
  REPORT_PURCHASE: 'report.purchase',
  REPORT_CUSTOMER_OUTSTANDING: 'report.customer_outstanding',
  REPORT_SUPPLIER_OUTSTANDING: 'report.supplier_outstanding',
  REPORT_PAYMENT_COLLECTION: 'report.payment_collection',
  REPORT_SUPPLIER_PAYMENT: 'report.supplier_payment',
  REPORT_EXPENSE: 'report.expense',
  REPORT_CASH_COLLECTION: 'report.cash_collection',
  REPORT_SALES_RETURN: 'report.sales_return',
  REPORT_PURCHASE_RETURN: 'report.purchase_return',
  REPORT_INVENTORY_SUMMARY: 'report.inventory_summary',
  REPORT_STOCK_MOVEMENT: 'report.stock_movement',
  // Canonical key - NEVER report.profit_and_loss.
  REPORT_PROFIT_LOSS: 'report.profit_loss',
  REPORT_CASH_FLOW: 'report.cash_flow',
  REPORT_GST_FILING: 'report.gst_filing',
  REPORT_BALANCE_SHEET: 'report.balance_sheet',
}

export const LIMIT_KEYS = {
  MAX_USERS: 'max_users',
  MAX_WAREHOUSES: 'max_warehouses',
  MAX_ORDERS: 'max_orders',
  MAX_STORAGE_GB: 'max_storage_gb',
}

// reportConfig.js's report TYPE (the `?report=` query value / GET /reports/{type} path segment)
// is a SEPARATE concept from the entitlement key that gates it - this is the one place the two
// are deliberately bridged. `report-type` stays hyphenated (the real route param), the
// entitlement key stays dot/underscore (the real backend contract) - never conflate them.
export const REPORT_TYPE_TO_ENTITLEMENT_KEY = {
  'daily-transaction': ENTITLEMENT_KEYS.REPORT_DAILY_TRANSACTION,
  sales: ENTITLEMENT_KEYS.REPORT_SALES,
  purchase: ENTITLEMENT_KEYS.REPORT_PURCHASE,
  'customer-outstanding': ENTITLEMENT_KEYS.REPORT_CUSTOMER_OUTSTANDING,
  'supplier-outstanding': ENTITLEMENT_KEYS.REPORT_SUPPLIER_OUTSTANDING,
  'payment-collection': ENTITLEMENT_KEYS.REPORT_PAYMENT_COLLECTION,
  'supplier-payment': ENTITLEMENT_KEYS.REPORT_SUPPLIER_PAYMENT,
  expense: ENTITLEMENT_KEYS.REPORT_EXPENSE,
  'cash-collection': ENTITLEMENT_KEYS.REPORT_CASH_COLLECTION,
  'sales-return': ENTITLEMENT_KEYS.REPORT_SALES_RETURN,
  'purchase-return': ENTITLEMENT_KEYS.REPORT_PURCHASE_RETURN,
  'inventory-summary': ENTITLEMENT_KEYS.REPORT_INVENTORY_SUMMARY,
  'stock-movement': ENTITLEMENT_KEYS.REPORT_STOCK_MOVEMENT,
  'profit-loss': ENTITLEMENT_KEYS.REPORT_PROFIT_LOSS,
  'gst-summary': ENTITLEMENT_KEYS.REPORT_GST_FILING,
}

// roles.js sidebar items and RequirePermissionRoute both key off the EXISTING role-permission
// `module` string (e.g. "leads", "sales_orders") - this bridges that to the NEW, separate
// plan-entitlement key for the items the brief calls out, so one `feature:` field on a roles.js
// item composes with its existing `module:`/`action:` role check (§3: BOTH, never one replacing
// the other). Left out entirely for anything with no listed canonical key (Administration/
// Settings/Super Admin items) - absence here means "not plan-gated", not "blocked".
export const MODULE_TO_ENTITLEMENT_KEY = {
  customers: ENTITLEMENT_KEYS.CRM_CUSTOMERS,
  leads: ENTITLEMENT_KEYS.CRM_LEADS,
  quotations: ENTITLEMENT_KEYS.CRM_QUOTATIONS,

  suppliers: ENTITLEMENT_KEYS.ERP_SUPPLIERS,
  inventory: ENTITLEMENT_KEYS.ERP_INVENTORY,
  purchases: ENTITLEMENT_KEYS.ERP_PURCHASES,

  invoices: ENTITLEMENT_KEYS.INVOICE_SALES_INVOICES,
  payments: ENTITLEMENT_KEYS.FINANCE_COLLECTION_RECONCILIATION,
  expenses: ENTITLEMENT_KEYS.FINANCE_EXPENSES,
  reports: ENTITLEMENT_KEYS.FINANCE_REPORTS,

  sales_orders: ENTITLEMENT_KEYS.SALES_ORDERS,
  sales_returns: ENTITLEMENT_KEYS.SALES_SALES_RETURNS,
  deliveries: ENTITLEMENT_KEYS.SALES_DELIVERIES,
  vehicle_stock: ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK,

  users: ENTITLEMENT_KEYS.EMPLOYEE_STAFF,
  attendance: ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE,
  leaves: ENTITLEMENT_KEYS.EMPLOYEE_LEAVES,
}

// Human-readable labels for the Super Admin Plan editor / Organization override UI - canonical
// strings like "crm.leads" are never shown directly to a Super Admin (§12).
export const ENTITLEMENT_LABELS = {
  [ENTITLEMENT_KEYS.CRM_CUSTOMERS]: 'Customers',
  [ENTITLEMENT_KEYS.CRM_LEADS]: 'Leads',
  [ENTITLEMENT_KEYS.CRM_QUOTATIONS]: 'Quotations',

  [ENTITLEMENT_KEYS.ERP_BRANDS]: 'Brands',
  [ENTITLEMENT_KEYS.ERP_CATEGORIES]: 'Categories',
  [ENTITLEMENT_KEYS.ERP_PRODUCTS]: 'Products',
  [ENTITLEMENT_KEYS.ERP_SUPPLIERS]: 'Suppliers',
  [ENTITLEMENT_KEYS.ERP_INVENTORY]: 'Inventory',
  [ENTITLEMENT_KEYS.ERP_WAREHOUSES]: 'Warehouses',
  [ENTITLEMENT_KEYS.ERP_PURCHASES]: 'Purchases',
  [ENTITLEMENT_KEYS.ERP_PURCHASE_RETURNS]: 'Purchase Returns',

  [ENTITLEMENT_KEYS.FINANCE_RECEIVABLES]: 'Receivables',
  [ENTITLEMENT_KEYS.FINANCE_ACCOUNTS_PAYABLE]: 'Accounts Payable',
  [ENTITLEMENT_KEYS.FINANCE_SUPPLIER_PAYMENTS]: 'Supplier Payments',
  [ENTITLEMENT_KEYS.FINANCE_COLLECTION_RECONCILIATION]: 'Collection Reconciliation',
  [ENTITLEMENT_KEYS.FINANCE_EXPENSES]: 'Expenses',
  [ENTITLEMENT_KEYS.FINANCE_REPORTS]: 'Reports',

  [ENTITLEMENT_KEYS.INVOICE_SALES_INVOICES]: 'Sales Invoices',
  [ENTITLEMENT_KEYS.INVOICE_SUPPLIER_INVOICES]: 'Supplier Invoices',

  [ENTITLEMENT_KEYS.SALES_ORDERS]: 'Orders',
  [ENTITLEMENT_KEYS.SALES_SALES_RETURNS]: 'Sales Returns',
  [ENTITLEMENT_KEYS.SALES_DELIVERIES]: 'Deliveries',
  [ENTITLEMENT_KEYS.SALES_SALES]: 'Sales',
  [ENTITLEMENT_KEYS.SALES_VEHICLES]: 'Vehicles',
  [ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK]: 'Vehicle Stock',

  [ENTITLEMENT_KEYS.EMPLOYEE_STAFF]: 'Staff',
  [ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE]: 'Attendance',
  [ENTITLEMENT_KEYS.EMPLOYEE_LEAVES]: 'Leaves',
  [ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS]: 'Roles & Permissions',

  [ENTITLEMENT_KEYS.NOTIFICATIONS_WHATSAPP_DELIVERY]: 'WhatsApp Delivery Notifications',

  [ENTITLEMENT_KEYS.REPORT_DAILY_TRANSACTION]: 'Daily Transaction',
  [ENTITLEMENT_KEYS.REPORT_SALES]: 'Sales',
  [ENTITLEMENT_KEYS.REPORT_PURCHASE]: 'Purchase',
  [ENTITLEMENT_KEYS.REPORT_CUSTOMER_OUTSTANDING]: 'Customer Outstanding',
  [ENTITLEMENT_KEYS.REPORT_SUPPLIER_OUTSTANDING]: 'Supplier Outstanding',
  [ENTITLEMENT_KEYS.REPORT_PAYMENT_COLLECTION]: 'Payment Collection',
  [ENTITLEMENT_KEYS.REPORT_SUPPLIER_PAYMENT]: 'Supplier Payment',
  [ENTITLEMENT_KEYS.REPORT_EXPENSE]: 'Expense',
  [ENTITLEMENT_KEYS.REPORT_CASH_COLLECTION]: 'Cash Collection',
  [ENTITLEMENT_KEYS.REPORT_SALES_RETURN]: 'Sales Return',
  [ENTITLEMENT_KEYS.REPORT_PURCHASE_RETURN]: 'Purchase Return',
  [ENTITLEMENT_KEYS.REPORT_INVENTORY_SUMMARY]: 'Inventory Summary',
  [ENTITLEMENT_KEYS.REPORT_STOCK_MOVEMENT]: 'Stock Movement',
  [ENTITLEMENT_KEYS.REPORT_PROFIT_LOSS]: 'Profit & Loss',
  [ENTITLEMENT_KEYS.REPORT_CASH_FLOW]: 'Cash Flow',
  [ENTITLEMENT_KEYS.REPORT_GST_FILING]: 'GST Filing',
  [ENTITLEMENT_KEYS.REPORT_BALANCE_SHEET]: 'Balance Sheet',
}

export const LIMIT_LABELS = {
  [LIMIT_KEYS.MAX_USERS]: 'Max Users',
  [LIMIT_KEYS.MAX_WAREHOUSES]: 'Max Warehouses',
  [LIMIT_KEYS.MAX_ORDERS]: 'Max Orders',
  [LIMIT_KEYS.MAX_STORAGE_GB]: 'Max Storage (GB)',
}

export function entitlementLabel(key) {
  return ENTITLEMENT_LABELS[key] || key
}

export function limitLabel(key) {
  return LIMIT_LABELS[key] || key
}

// Super Admin Plan editor / Organization override UI grouping - mirrors the brief's own
// FEATURE ACCESS section layout exactly.
export const ENTITLEMENT_GROUPS = [
  { label: 'CRM', keys: [ENTITLEMENT_KEYS.CRM_CUSTOMERS, ENTITLEMENT_KEYS.CRM_LEADS, ENTITLEMENT_KEYS.CRM_QUOTATIONS] },
  {
    label: 'ERP',
    keys: [
      ENTITLEMENT_KEYS.ERP_BRANDS, ENTITLEMENT_KEYS.ERP_CATEGORIES, ENTITLEMENT_KEYS.ERP_PRODUCTS,
      ENTITLEMENT_KEYS.ERP_SUPPLIERS, ENTITLEMENT_KEYS.ERP_INVENTORY, ENTITLEMENT_KEYS.ERP_WAREHOUSES,
      ENTITLEMENT_KEYS.ERP_PURCHASES, ENTITLEMENT_KEYS.ERP_PURCHASE_RETURNS,
    ],
  },
  {
    label: 'Finance',
    keys: [
      ENTITLEMENT_KEYS.FINANCE_RECEIVABLES, ENTITLEMENT_KEYS.FINANCE_ACCOUNTS_PAYABLE,
      ENTITLEMENT_KEYS.FINANCE_SUPPLIER_PAYMENTS, ENTITLEMENT_KEYS.FINANCE_COLLECTION_RECONCILIATION,
      ENTITLEMENT_KEYS.FINANCE_EXPENSES, ENTITLEMENT_KEYS.FINANCE_REPORTS,
    ],
  },
  { label: 'Invoice', keys: [ENTITLEMENT_KEYS.INVOICE_SALES_INVOICES, ENTITLEMENT_KEYS.INVOICE_SUPPLIER_INVOICES] },
  {
    label: 'Sales & Delivery',
    keys: [
      ENTITLEMENT_KEYS.SALES_ORDERS, ENTITLEMENT_KEYS.SALES_SALES_RETURNS, ENTITLEMENT_KEYS.SALES_DELIVERIES,
      ENTITLEMENT_KEYS.SALES_SALES, ENTITLEMENT_KEYS.SALES_VEHICLES, ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK,
    ],
  },
  {
    label: 'Employee',
    keys: [
      ENTITLEMENT_KEYS.EMPLOYEE_STAFF, ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE,
      ENTITLEMENT_KEYS.EMPLOYEE_LEAVES, ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS,
    ],
  },
  { label: 'Other', keys: [ENTITLEMENT_KEYS.NOTIFICATIONS_WHATSAPP_DELIVERY] },
  {
    label: 'Report Access',
    keys: [
      ENTITLEMENT_KEYS.REPORT_DAILY_TRANSACTION, ENTITLEMENT_KEYS.REPORT_SALES, ENTITLEMENT_KEYS.REPORT_PURCHASE,
      ENTITLEMENT_KEYS.REPORT_CUSTOMER_OUTSTANDING, ENTITLEMENT_KEYS.REPORT_SUPPLIER_OUTSTANDING,
      ENTITLEMENT_KEYS.REPORT_PAYMENT_COLLECTION, ENTITLEMENT_KEYS.REPORT_SUPPLIER_PAYMENT,
      ENTITLEMENT_KEYS.REPORT_EXPENSE, ENTITLEMENT_KEYS.REPORT_CASH_COLLECTION, ENTITLEMENT_KEYS.REPORT_SALES_RETURN,
      ENTITLEMENT_KEYS.REPORT_PURCHASE_RETURN, ENTITLEMENT_KEYS.REPORT_INVENTORY_SUMMARY,
      ENTITLEMENT_KEYS.REPORT_STOCK_MOVEMENT, ENTITLEMENT_KEYS.REPORT_PROFIT_LOSS, ENTITLEMENT_KEYS.REPORT_CASH_FLOW,
      ENTITLEMENT_KEYS.REPORT_GST_FILING, ENTITLEMENT_KEYS.REPORT_BALANCE_SHEET,
    ],
  },
]

export const ALL_ENTITLEMENT_KEYS = Object.values(ENTITLEMENT_KEYS)
export const ALL_LIMIT_KEYS = Object.values(LIMIT_KEYS)
