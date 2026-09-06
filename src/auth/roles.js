import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Package,
  Users,
  ShoppingCart,
  PackagePlus,
  Truck,
  Receipt,
  FileText,
  UserCog,
  Settings,
  MapPin,
  Wallet,
  Store,
  Warehouse,
  Car,
  FileSpreadsheet,
  Bell,
  History,
  UserPlus,
  ClipboardList,
  CheckSquare,
  Target,
  Calendar,
  CalendarClock,
  PackageCheck,
  PackageX,
  LogIn,
  LogOut,
  TrendingUp,
  IndianRupee,
  Check,
  XCircle,
  FileCheck,
  DollarSign,
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

export const roleProfileSettingsPath = {
  [ROLES.ADMIN]: '/admin/settings',
}

export const roleMenus = {
  [ROLES.SUPER_ADMIN]: [
    {
      section: 'Main menu',
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
      section: 'Sales Operation',
      items: [
        { label: 'Customers', path: '/admin/customers', icon: UsersRound, module: 'customers' },
        { label: 'Leads', path: '/admin/leads', icon: UserPlus, module: 'leads' },
        { label: 'Quotations', path: '/admin/quotations', icon: FileText, module: 'quotations' },
        { label: 'Suppliers', path: '/admin/suppliers', icon: Factory, module: 'suppliers' },
        { label: 'Categories', path: '/admin/categories', icon: Tags, module: 'products' },
        { label: 'Brands', path: '/admin/brands', icon: Award, module: 'products' },
        { label: 'Products', path: '/admin/products', icon: Package, module: 'products' },
      ],
    },
    {
      section: 'Operations',
      items: [
        { label: 'Inventory', path: '/admin/inventory', icon: Warehouse, module: 'inventory' },
        { label: 'Warehouses', path: '/admin/warehouses', icon: Building2, module: 'inventory' },
        { label: 'Orders', path: '/admin/orders', icon: ShoppingCart, module: 'sales_orders' },
        { label: 'Sales Returns', path: '/admin/sales-returns', icon: Undo2, module: 'sales_returns' },
        { label: 'Vehicle Stock', path: '/admin/vehicle-stock', icon: Car, module: 'vehicle_stock' },
        { label: 'Vehicles', path: '/admin/vehicles', icon: Bus, module: 'vehicle_stock' },
        { label: 'Purchases', path: '/admin/purchases', icon: PackagePlus, module: 'purchases' },
        { label: 'Purchase Returns', path: '/admin/purchase-returns', icon: Undo2, module: 'purchases' },
        { label: 'Deliveries', path: '/admin/deliveries', icon: Truck, module: 'deliveries' },
      ],
    },
    {
      section: 'Finance',
      items: [
        { label: 'Sales Invoices', path: '/admin/invoices', icon: FileText, module: 'invoices' },
        { label: 'Receivables', path: '/admin/receivables', icon: IndianRupee, module: 'invoices' },
        { label: 'Supplier Invoices', path: '/admin/supplier-invoices', icon: Receipt, module: 'invoices' },
        { label: 'Accounts Payable', path: '/admin/payables', icon: Wallet, module: 'invoices' },
        { label: 'Supplier Payments', path: '/admin/supplier-payments', icon: Wallet, module: 'invoices' },
        { label: 'Collection Reconciliation', path: '/admin/collections', icon: HandCoins, module: 'payments' },
        // Cash Reconciliation (/admin/reconciliation/cash) is FRONTEND-READY / BACKEND LATER
        // (no persisted session) - route + component kept, sidebar entry hidden for MVP.
        { label: 'Expenses', path: '/admin/expenses', icon: Receipt, module: 'expenses' },
        { label: 'Reports', path: '/admin/reports', icon: FileSpreadsheet, module: 'reports' },
      ],
    },
    {
      section: 'Administration',
      items: [
        { label: 'Company Settings', path: '/admin/company-settings', icon: Store, module: 'settings' },
        { label: 'Plans', path: '/admin/plans', icon: CreditCard },
        { label: 'Staff', path: '/admin/users', icon: Users, module: 'users' },
        { label: 'Roles & Permissions', path: '/admin/roles', icon: ShieldCheck, module: 'users', action: 'edit' },
        { label: 'Object Field Settings', path: '/admin/object-fields', icon: SlidersHorizontal, module: 'settings' },
        { label: 'Attendance', path: '/admin/attendance', icon: ClipboardCheck, module: 'attendance' },
        { label: 'Leaves', path: '/admin/leaves', icon: CalendarClock, module: 'leaves' },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: History, module: 'reports' },
      ],
    },
    {
      section: 'System',
      items: [
        { label: 'Notifications', path: '/admin/notifications', icon: Bell },
        { label: 'Sales Workflow', path: '/admin/settings', icon: Settings, module: 'settings' },
      ],
    },
  ],
  [ROLES.SALES_OFFICER]: [
    {
      section: 'Main menu',
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
        { label: 'My Performance', path: '/sales/performance', icon: Target },
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
      section: 'Main menu',
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
