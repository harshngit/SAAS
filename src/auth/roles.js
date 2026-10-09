import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Users,
  ShoppingCart,
  PackagePlus,
  Truck,
  Receipt,
  FileText,
  MapPin,
  Wallet,
  Store,
  Warehouse,
  Car,
  FileSpreadsheet,
  History,
  UserPlus,
  ClipboardList,
  Calendar,
  CalendarClock,
  PackageCheck,
  PackageX,
  TrendingUp,
  IndianRupee,
  FileCheck,
  PieChart,
  UsersRound,
  Activity,
  Factory,
  Tags,
  Award,
  ShieldCheck,
  Boxes,
  ClipboardCheck,
  SlidersHorizontal,
  Undo2,
  Bus,
  HandCoins,
  Palette,
  UserCircle,
  Scale,
  HelpCircle,
} from 'lucide-react'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SALES_OFFICER: 'sales_officer',
  DELIVERY_PARTNER: 'delivery_partner',
  ACCOUNTANT: 'accountant',
}

export const roleLabels = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SALES_OFFICER]: 'Sales Officer',
  [ROLES.DELIVERY_PARTNER]: 'Delivery Partner',
  [ROLES.ACCOUNTANT]: 'Accountant',
}

export const roleHomePath = {
  [ROLES.SUPER_ADMIN]: '/superadmin/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.SALES_OFFICER]: '/sales/dashboard',
  [ROLES.DELIVERY_PARTNER]: '/delivery/dashboard',
  [ROLES.ACCOUNTANT]: '/accounts/dashboard',
}

// role.workspace (from /auth/me) is free text set by whoever created the role - admins can
// define custom roles with any workspace value via the Roles module. Only these four have an
// actual dashboard/route tree built in this app today; anything else falls back to /profile,
// which every authenticated user can reach, instead of a hardcoded case per workspace.
export const workspaceHomePath = {
  admin: '/admin/dashboard',
  sales: '/sales/dashboard',
  delivery: '/delivery/dashboard',
  accounts: '/accounts/dashboard',
}

const UNIVERSAL_FALLBACK_PATH = '/profile'

const WORKSPACE_TO_ROLE = {
  admin: ROLES.ADMIN,
  sales: ROLES.SALES_OFFICER,
  delivery: ROLES.DELIVERY_PARTNER,
  accounts: ROLES.ACCOUNTANT,
}

// The canonical role key used to pick the sidebar menu + route-tree shell. A session whose
// role string is already one of the 5 built-in roles keeps it; a CUSTOM role resolves via its
// `role.workspace` so it still lands in the right shell (permissions then filter within it).
// Falls back to the raw role string if neither is recognised. Not authorization - just shell
// selection; every screen is still permission-gated.
export function resolveWorkspaceRole({ role, currentUser } = {}) {
  const raw = currentUser?.role
  if (raw && Object.values(ROLES).includes(raw)) return raw
  return WORKSPACE_TO_ROLE[role?.workspace] || raw || null
}

// Resolves where a signed-in user should land: full_access (Admin) always goes to the admin
// dashboard; otherwise workspace drives it; falls back to the legacy role-string map for
// sessions that predate the workspace field, and finally to a page every role can reach.
export function resolveHomePath({ fullAccess, role, currentUser } = {}) {
  if (fullAccess) return roleHomePath[ROLES.ADMIN]

  const workspace = role?.workspace
  if (workspace && workspaceHomePath[workspace]) {
    return workspaceHomePath[workspace]
  }

  return roleHomePath[currentUser?.role] || UNIVERSAL_FALLBACK_PATH
}

export const roleMenus = {
  [ROLES.SUPER_ADMIN]: [
    {
      section: 'Main Menu',
      items: [
        { label: 'Dashboard', path: '/superadmin/dashboard', icon: LayoutDashboard },
        { label: 'Organizations', path: '/superadmin/organizations', icon: Building2 },
        { label: 'Upgrade Requests', path: '/superadmin/upgrade-requests', icon: TrendingUp },
        { label: 'Plans', path: '/superadmin/plans', icon: CreditCard },
        { label: 'Platform Analytics', path: '/superadmin/analytics', icon: Activity },
        { label: 'Superadmins', path: '/superadmin/admins', icon: ShieldCheck },
      ],
    },
  ],
  [ROLES.ADMIN]: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, module: 'dashboard' },
      ],
    },
    {
      section: 'CRM',
      items: [
        { label: 'Leads', path: '/admin/leads', icon: UserPlus, module: 'leads' },
        { label: 'Quotations', path: '/admin/quotations', icon: FileText, module: 'quotations' },
        { label: 'Customers', path: '/admin/customers', icon: UsersRound, module: 'customers' },
      ],
    },
    {
      section: 'ERP',
      items: [
        { label: 'Brands', path: '/admin/brands', icon: Award, module: 'products' },
        { label: 'Categories', path: '/admin/categories', icon: Tags, module: 'products' },
        { label: 'Products', path: '/admin/products', icon: Package, module: 'products' },
        { label: 'Suppliers', path: '/admin/suppliers', icon: Factory, module: 'suppliers' },
        { label: 'Inventory', path: '/admin/inventory', icon: Warehouse, module: 'inventory' },
        { label: 'Warehouses', path: '/admin/warehouses', icon: Building2, module: 'inventory' },
        { label: 'Purchases', path: '/admin/purchases', icon: PackagePlus, module: 'purchases' },
        { label: 'Purchase Returns', path: '/admin/purchase-returns', icon: Undo2, module: 'purchases' },
      ],
    },
    {
      section: 'Finance Management',
      items: [
        { label: 'Receivables', path: '/admin/receivables', icon: IndianRupee, module: 'invoices' },
        { label: 'Accounts Payable', path: '/admin/payables', icon: Wallet, module: 'invoices' },
        { label: 'Supplier Payments', path: '/admin/supplier-payments', icon: Wallet, module: 'invoices' },
        { label: 'Collection Reconciliation', path: '/admin/collections', icon: HandCoins, module: 'payments' },
        // Cash Reconciliation (/admin/reconciliation/cash) is FRONTEND-READY / BACKEND LATER
        // (no persisted session) - route + component kept, sidebar entry hidden for MVP.
        { label: 'Expenses', path: '/admin/expenses', icon: Receipt, module: 'expenses' },
        {
          label: 'Reports',
          path: '/admin/reports',
          icon: FileSpreadsheet,
          module: 'reports',
          // Active only when NOT one of the two shortcut reports below, so exactly one of the
          // three Reports-family items highlights at a time instead of all three at once (NavLink
          // only matches on pathname by default, which all three of these share).
          activeWhen: (location) =>
            location.pathname === '/admin/reports' &&
            !['profit-loss', 'gst-summary'].includes(new URLSearchParams(location.search).get('report')),
        },
        {
          label: 'Profit and Loss Sheet',
          path: '/admin/reports?report=profit-loss',
          icon: TrendingUp,
          module: 'reports',
          // Reuses the real Reports module's profit-loss report (src/features/reports/reportConfig.js) -
          // no second P&L calculation exists or is created here.
          activeWhen: (location) =>
            location.pathname === '/admin/reports' && new URLSearchParams(location.search).get('report') === 'profit-loss',
        },
        // BACKEND LATER: no balance-sheet report exists in the Reports module's confirmed report
        // types - this opens an honest "not available yet" page rather than fabricating figures.
        { label: 'Balance Sheet', path: '/admin/reports/balance-sheet', icon: Scale, module: 'reports' },
        // Real GET /reports/cash-flow-sheet report (recorded cash in/out, not a React-computed
        // statement) - distinct from Daily Transactions' same-day net_cash_flow figure.
        { label: 'Cash Flow Sheet', path: '/admin/reports/cash-flow-sheet', icon: Activity, module: 'reports' },
        {
          label: 'GST Filing Sheet',
          path: '/admin/reports?report=gst-summary',
          icon: FileCheck,
          module: 'reports',
          // Reuses the real Reports module's gst-summary report - never the old standalone GST page.
          activeWhen: (location) =>
            location.pathname === '/admin/reports' && new URLSearchParams(location.search).get('report') === 'gst-summary',
        },
      ],
    },
    {
      // Intentionally duplicates 4 items from Finance Management (client requirement) - every
      // duplicate below points at the exact same path/module as its Finance Management twin, so
      // both are the same canonical page/permission, never a second implementation.
      section: 'Invoice Management',
      items: [
        { label: 'Sales Invoices', path: '/admin/invoices', icon: FileText, module: 'invoices' },
        { label: 'Supplier Invoices', path: '/admin/supplier-invoices', icon: Receipt, module: 'invoices' },
        { label: 'Receivables', path: '/admin/receivables', icon: IndianRupee, module: 'invoices' },
        { label: 'Accounts Payable', path: '/admin/payables', icon: Wallet, module: 'invoices' },
        { label: 'Supplier Payments', path: '/admin/supplier-payments', icon: Wallet, module: 'invoices' },
        { label: 'Collection Reconciliation', path: '/admin/collections', icon: HandCoins, module: 'payments' },
      ],
    },
    {
      section: 'Sales & Delivery Management',
      items: [
        { label: 'Orders', path: '/admin/orders', icon: ShoppingCart, module: 'sales_orders' },
        { label: 'Sales Returns', path: '/admin/sales-returns', icon: Undo2, module: 'sales_returns' },
        { label: 'Deliveries', path: '/admin/deliveries', icon: Truck, module: 'deliveries' },
        // Real GET /reports/sales-overview report (one row per Sales Order, aggregated delivery
        // fields) - a genuine combined Orders + Deliveries view, not a client-side merge of the
        // two separately-paginated lists. Gated like every other report under Finance
        // Management's Reports family, since it is now part of that same backend domain.
        { label: 'Sales', path: '/admin/sales-overview', icon: PieChart, module: 'reports' },
        { label: 'Vehicle Stock', path: '/admin/vehicle-stock', icon: Car, module: 'vehicle_stock' },
        { label: 'Vehicles', path: '/admin/vehicles', icon: Bus, module: 'vehicle_stock' },
      ],
    },
    {
      section: 'Administration',
      items: [
        { label: 'Company Settings', path: '/admin/company-settings', icon: Store, module: 'settings' },
        { label: 'Plans', path: '/admin/plans', icon: CreditCard },
        { label: 'Billing History', path: '/admin/billing-history', icon: Receipt },
        { label: 'Audit Log', path: '/admin/audit-logs', icon: History, module: 'reports' },
        { label: 'My Profile', path: '/profile', icon: UserCircle },
      ],
    },
    {
      section: 'Employee Management',
      items: [
        { label: 'Staff', path: '/admin/users', icon: Users, module: 'users' },
        { label: 'Attendance', path: '/admin/attendance', icon: ClipboardCheck, module: 'attendance' },
        { label: 'Leaves', path: '/admin/leaves', icon: CalendarClock, module: 'leaves' },
        { label: 'Roles & Permissions', path: '/admin/roles', icon: ShieldCheck, module: 'users', action: 'edit' },
      ],
    },
    {
      section: 'Settings',
      items: [
        { label: 'Objects & Fields Settings', path: '/admin/object-fields', icon: SlidersHorizontal, module: 'settings' },
        { label: 'Invoice Changes', path: '/admin/invoices/settings', icon: SlidersHorizontal, module: 'invoices', action: 'edit' },
        { label: 'Appearance & Branding', path: '/admin/theme-settings', icon: Palette, module: 'settings' },
        // Authenticated aliases of the public legal pages (src/features/legal/*) - same content
        // components, rendered embedded inside this Sidebar/Topbar shell (AppRoutes.jsx) instead
        // of their own standalone page chrome, so clicking these keeps the user inside Admin.
        // The public routes (/terms, /privacy, /help, /legal) are unchanged and still work.
        { label: 'Terms & Conditions', path: '/admin/settings/terms', icon: FileText },
        { label: 'Privacy Policy', path: '/admin/settings/privacy', icon: ShieldCheck },
        { label: 'Help & FAQ', path: '/admin/settings/help', icon: HelpCircle },
        { label: 'View All Policies', path: '/admin/settings/policies', icon: ClipboardList },
      ],
    },
  ],
  [ROLES.SALES_OFFICER]: [
    {
      section: 'Main Menu',
      items: [
        { label: 'Dashboard', path: '/sales/dashboard', icon: LayoutDashboard, module: 'dashboard' },
        { label: 'Customers', path: '/sales/customers', icon: Users, module: 'customers' },
        { label: 'Leads', path: '/sales/leads', icon: UserPlus, module: 'leads' },
        { label: 'Quotations', path: '/sales/quotations', icon: FileText, module: 'quotations' },
        { label: 'Orders', path: '/sales/orders', icon: ShoppingCart, module: 'sales_orders' },
        { label: 'Create Order', path: '/sales/orders/create', icon: ShoppingCart, module: 'sales_orders', action: 'create' },
        { label: 'Sales Returns', path: '/sales/sales-returns', icon: Undo2, module: 'sales_returns' },
        { label: 'Stock', path: '/sales/stock', icon: Boxes, module: 'inventory' },
        { label: 'Visits', path: '/sales/visits', icon: MapPin, module: 'visits' },
        { label: 'Follow-ups', path: '/sales/followups', icon: ClipboardList, module: 'follow_ups' },
        { label: 'Attendance', path: '/sales/attendance', icon: ClipboardCheck, module: 'attendance' },
        { label: 'Leaves', path: '/sales/leaves', icon: CalendarClock, module: 'leaves' },
        { label: 'Expenses', path: '/sales/expenses', icon: Receipt, module: 'expenses' },
      ],
    },
  ],
  [ROLES.DELIVERY_PARTNER]: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', path: '/delivery/dashboard', icon: LayoutDashboard, module: 'dashboard' },
      ],
    },
    {
      section: 'Delivery Operations',
      items: [
        { label: 'My Deliveries', path: '/delivery/deliveries', icon: Truck, module: 'deliveries' },
        { label: 'Vehicle Loading', path: '/delivery/vehicle-loading', icon: PackageCheck, module: 'vehicle_stock' },
        { label: 'Vehicle Stock', path: '/delivery/vehicle-stock', icon: Warehouse, module: 'vehicle_stock' },
        { label: 'End of Day Return', path: '/delivery/end-of-day', icon: PackageX, module: 'vehicle_stock' },
      ],
    },
    {
      section: 'My Work',
      items: [
        { label: 'Attendance', path: '/delivery/attendance', icon: Calendar, module: 'attendance' },
        { label: 'Leaves', path: '/delivery/leaves', icon: CalendarClock, module: 'leaves' },
        { label: 'Expenses', path: '/delivery/expenses', icon: Receipt, module: 'expenses' },
      ],
    },
  ],
  [ROLES.ACCOUNTANT]: [
    {
      section: 'Main Menu',
      items: [
        { label: 'Dashboard', path: '/accounts/dashboard', icon: LayoutDashboard, module: 'dashboard' },
        { label: 'Supplier Invoices', path: '/accounts/supplier-invoices', icon: PackagePlus, module: 'invoices' },
        { label: 'Accounts Payable', path: '/accounts/payables', icon: Wallet, module: 'invoices' },
        { label: 'Supplier Payments', path: '/accounts/supplier-payments', icon: Wallet, module: 'invoices' },
        { label: 'Sales Invoices', path: '/accounts/invoices/sales', icon: ShoppingCart, module: 'invoices' },
        { label: 'Receivables', path: '/accounts/receivables', icon: TrendingUp, module: 'invoices' },
        { label: 'Collection Reconciliation', path: '/accounts/collections', icon: HandCoins, module: 'payments' },
        { label: 'Expense Approval', path: '/accounts/expenses/approval', icon: Receipt, module: 'expenses', action: 'approve' },
        { label: 'Leaves', path: '/accounts/leaves', icon: CalendarClock, module: 'leaves' },
        // Cash Reconciliation (/accounts/reconciliation/cash) is FRONTEND-READY / BACKEND LATER
        // (no persisted session) - route + component kept, sidebar entry hidden for MVP.
        { label: 'GST Summary', path: '/accounts/gst', icon: FileCheck, module: 'gst' },
        { label: 'Financial Reports', path: '/accounts/reports', icon: FileSpreadsheet, module: 'reports' },
      ],
    },
  ],
}
