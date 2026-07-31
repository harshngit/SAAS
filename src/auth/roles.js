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
        { label: 'Plans', path: '/superadmin/plans', icon: CreditCard },
        { label: 'Platform Analytics', path: '/superadmin/analytics', icon: Activity },
      ],
    },
  ],
  [ROLES.ADMIN]: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: 'Sales & Catalog',
      items: [
        { label: 'Customers', path: '/admin/customers', icon: UsersRound },
        { label: 'Suppliers', path: '/admin/suppliers', icon: Factory },
        { label: 'Products', path: '/admin/products', icon: Package },
      ],
    },
    {
      section: 'Operations',
      items: [
        { label: 'Orders', path: '/admin/orders', icon: ShoppingCart },
        { label: 'Inventory', path: '/admin/inventory', icon: Warehouse },
        { label: 'Vehicle Stock', path: '/admin/vehicle-stock', icon: Car },
        { label: 'Purchases', path: '/admin/purchases', icon: PackagePlus },
        { label: 'Deliveries', path: '/admin/deliveries', icon: Truck },
      ],
    },
    {
      section: 'Finance',
      items: [
        { label: 'Invoices', path: '/admin/invoices', icon: FileText },
        { label: 'Expenses', path: '/admin/expenses', icon: Receipt },
        { label: 'Reports', path: '/admin/reports', icon: FileSpreadsheet },
      ],
    },
    {
      section: 'Administration',
      items: [
        { label: 'Company Settings', path: '/admin/company-settings', icon: Store },
        { label: 'Plans', path: '/admin/plans', icon: CreditCard },
        { label: 'Staff', path: '/admin/users', icon: Users },
        { label: 'Notifications', path: '/admin/notifications', icon: Bell },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: History },
        { label: 'Settings', path: '/admin/settings', icon: Settings },
      ],
    },
  ],
  [ROLES.SALES_OFFICER]: [
    {
      section: 'Main menu',
      items: [
        { label: 'Dashboard', path: '/sales/dashboard', icon: LayoutDashboard },
        { label: 'Customers', path: '/sales/customers', icon: Users },
        { label: 'Create Order', path: '/sales/orders/create', icon: ShoppingCart },
        { label: 'Visits', path: '/sales/visits', icon: MapPin },
        { label: 'Follow-ups', path: '/sales/followups', icon: ClipboardList },
        { label: 'My Performance', path: '/sales/performance', icon: Target },
      ],
    },
  ],
  [ROLES.DELIVERY_PARTNER]: [
    {
      section: 'Main menu',
      items: [
        { label: 'Dashboard', path: '/delivery/dashboard', icon: LayoutDashboard },
        { label: 'Vehicle Loading', path: '/delivery/vehicle-loading', icon: PackageCheck },
        { label: 'Deliveries', path: '/delivery/deliveries', icon: Truck },
        { label: 'Expenses', path: '/delivery/expenses', icon: Receipt },
        { label: 'End of Day Return', path: '/delivery/end-of-day', icon: PackageX },
        { label: 'Attendance', path: '/delivery/attendance', icon: Calendar },
        { label: 'Vehicle Stock', path: '/delivery/vehicle-stock', icon: Warehouse },
      ],
    },
  ],
  [ROLES.ACCOUNTANT]: [
    {
      section: 'Main menu',
      items: [
        { label: 'Dashboard', path: '/accounts/dashboard', icon: LayoutDashboard },
        { label: 'Purchase Invoices', path: '/accounts/invoices/purchases', icon: PackagePlus },
        { label: 'Sales Invoices', path: '/accounts/invoices/sales', icon: ShoppingCart },
        { label: 'Record Payment', path: '/accounts/payments/record', icon: Wallet },
        { label: 'Expense Approval', path: '/accounts/expenses/approval', icon: Receipt },
        { label: 'Cash Reconciliation', path: '/accounts/reconciliation/cash', icon: IndianRupee },
        { label: 'Receivables/Payables', path: '/accounts/outstanding', icon: TrendingUp },
        { label: 'GST Summary', path: '/accounts/gst', icon: FileCheck },
        { label: 'Financial Reports', path: '/accounts/reports', icon: FileSpreadsheet },
      ],
    },
  ],
}
