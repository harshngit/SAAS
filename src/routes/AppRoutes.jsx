import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import StorageLimitModal from '../components/ui/StorageLimitModal'
import ProtectedRoute from '../auth/ProtectedRoute'
import RequirePermissionRoute, { RequireFullOrgDashboardRoute } from '../auth/RequirePermission'
import PlatformGuard from '../auth/PlatformGuard'
import { ENTITLEMENT_KEYS } from '../entitlements/entitlementKeys'
import { useAuthStore } from '../store/authStore'
import { ROLES, resolveHomePath } from '../auth/roles'
import { PageSkeleton } from '../components/ui/Skeleton'
import Login from '../features/auth/Login'
// InvoicePrintView stays eager - it's the headless-render target a backend job (Puppeteer or
// similar) navigates to directly to generate a PDF, with no human-driven navigation beforehand
// to have already warmed a lazy chunk. Every other route below is on-demand: route-level code
// splitting cut the 3.66MB single-bundle initial load down to only what the current page needs.
import InvoicePrintView from '../features/invoices/InvoicePrintView'

const ResetPassword = lazy(() => import('../features/auth/ResetPassword'))
const Register = lazy(() => import('../auth/Register'))
const GoogleAuthCallback = lazy(() => import('../features/auth/GoogleAuthCallback'))
const GoogleRegister = lazy(() => import('../features/auth/GoogleRegister'))
const SuperAdminDashboard = lazy(() => import('../features/dashboard/SuperAdminDashboard'))
const AdminDashboard = lazy(() => import('../features/dashboard/AdminDashboard'))
const SalesOfficerDashboard = lazy(() => import('../features/dashboard/SalesOfficerDashboard'))
const DeliveryPartnerDashboard = lazy(() => import('../features/dashboard/DeliveryPartnerDashboard'))
const AccountantDashboard = lazy(() => import('../features/dashboard/AccountantDashboard'))
const CompanySettings = lazy(() => import('../features/company/CompanySettings'))
const UserManagement = lazy(() => import('../features/users/UserManagement'))
const UserDetail = lazy(() => import('../features/users/UserDetail'))
const UserEdit = lazy(() => import('../features/users/UserEdit'))
const RolesList = lazy(() => import('../features/roles/RolesList'))
const RoleForm = lazy(() => import('../features/roles/RoleForm'))
const ProductList = lazy(() => import('../features/products/ProductList'))
const ProductDetail = lazy(() => import('../features/products/ProductDetail'))
const StockBoard = lazy(() => import('../features/inventory/StockBoard'))
const StockDetail = lazy(() => import('../features/inventory/StockDetail'))
const VehicleStockOverview = lazy(() => import('../features/vehicleStock/VehicleStockOverview'))
const VehicleStockList = lazy(() => import('../features/vehicleStock/VehicleStockList'))
const VehicleStockDetail = lazy(() => import('../features/vehicleStock/VehicleStockDetail'))
const WarehouseList = lazy(() => import('../features/warehouses/WarehouseList'))
const WarehouseDetail = lazy(() => import('../features/warehouses/WarehouseDetail'))
const VehicleList = lazy(() => import('../features/vehicles/VehicleList'))
const VehicleDetail = lazy(() => import('../features/vehicles/VehicleDetail'))
const PurchaseInvoiceList = lazy(() => import('../features/purchases/PurchaseInvoiceList'))
const PurchaseInvoiceForm = lazy(() => import('../features/purchases/PurchaseInvoiceForm'))
const PurchaseInvoiceDetail = lazy(() => import('../features/purchases/PurchaseInvoiceDetail'))
const PurchaseReturnList = lazy(() => import('../features/purchaseReturns/PurchaseReturnList'))
const PurchaseReturnDetail = lazy(() => import('../features/purchaseReturns/PurchaseReturnDetail'))
const PurchaseReturnFormPage = lazy(() => import('../features/purchaseReturns/PurchaseReturnFormPage'))
const SupplierInvoiceList = lazy(() => import('../features/supplierInvoices/SupplierInvoiceList'))
const SupplierInvoiceForm = lazy(() => import('../features/supplierInvoices/SupplierInvoiceForm'))
const SupplierInvoiceDetail = lazy(() => import('../features/supplierInvoices/SupplierInvoiceDetail'))
const PayablesList = lazy(() => import('../features/payables/PayablesList'))
const SupplierPaymentsList = lazy(() => import('../features/supplierPayments/SupplierPaymentsList'))
const ReportsHub = lazy(() => import('../features/reports/ReportsHub'))
const SalesOverview = lazy(() => import('../features/sales/SalesOverview'))
const NotificationsList = lazy(() => import('../features/notifications/NotificationsList'))
const AuditLogList = lazy(() => import('../features/auditLogs/AuditLogList'))
const CustomerList = lazy(() => import('../features/customers/CustomerList'))
const CustomerDetail = lazy(() => import('../features/customers/CustomerDetail'))
const CustomerEdit = lazy(() => import('../features/customers/CustomerEdit'))
const LeadList = lazy(() => import('../features/leads/LeadList'))
const LeadFormPage = lazy(() => import('../features/leads/LeadFormPage'))
const LeadDetail = lazy(() => import('../features/leads/LeadDetail'))
const QuotationList = lazy(() => import('../features/quotations/QuotationList'))
const QuotationFormPage = lazy(() => import('../features/quotations/QuotationFormPage'))
const QuotationDetail = lazy(() => import('../features/quotations/QuotationDetail'))
const SupplierList = lazy(() => import('../features/suppliers/SupplierList'))
const SupplierDetail = lazy(() => import('../features/suppliers/SupplierDetail'))
const CategoryList = lazy(() => import('../features/categories/CategoryList'))
const CategoryFormPage = lazy(() => import('../features/categories/CategoryFormPage'))
const BrandList = lazy(() => import('../features/brands/BrandList'))
const CreateSalesOrder = lazy(() => import('../features/orders/CreateSalesOrder'))
const OrderList = lazy(() => import('../features/orders/OrderList'))
const OrderDetail = lazy(() => import('../features/orders/OrderDetail'))
const VisitCheckIn = lazy(() => import('../features/visits/VisitCheckIn'))
const FollowUpsList = lazy(() => import('../features/followups/FollowUpsList'))
const MyTargets = lazy(() => import('../features/performance/MyTargets'))
const VehicleLoading = lazy(() => import('../features/vehicleStock/VehicleLoading'))
const AssignedDeliveries = lazy(() => import('../features/deliveries/AssignedDeliveries'))
const DeliveryDetail = lazy(() => import('../features/deliveries/DeliveryDetail'))
const MyExpenses = lazy(() => import('../features/expenses/MyExpenses'))
const MyLeaves = lazy(() => import('../features/leaves/MyLeaves'))
const LeaveApprovalQueue = lazy(() => import('../features/leaves/LeaveApprovalQueue'))
const EndOfDayReturn = lazy(() => import('../features/vehicleStock/EndOfDayReturn'))
const MyAttendance = lazy(() => import('../features/attendance/MyAttendance'))
const PurchaseInvoices = lazy(() => import('../features/invoices/PurchaseInvoices'))
const SalesInvoices = lazy(() => import('../features/invoices/SalesInvoices'))
const RecordPayment = lazy(() => import('../features/payments/RecordPayment'))
const ExpenseApprovalQueue = lazy(() => import('../features/expenses/ExpenseApprovalQueue'))
const ReceivablesPayables = lazy(() => import('../features/outstanding/ReceivablesPayables'))
const CollectionReconciliation = lazy(() => import('../features/collections/CollectionReconciliation'))
const DayEndClose = lazy(() => import('../features/deliveries/DayEndClose'))
const DayEndApprovals = lazy(() => import('../features/deliveries/DayEndApprovals'))
const FinancialReports = lazy(() => import('../features/reports/FinancialReports'))
const OrganizationsList = lazy(() => import('../features/superadmin/OrganizationsList'))
const OrganizationDetail = lazy(() => import('../features/superadmin/OrganizationDetail'))
const UpgradeRequests = lazy(() => import('../features/superadmin/UpgradeRequests'))
const SubscriptionPlans = lazy(() => import('../features/superadmin/SubscriptionPlans'))
const PlatformAnalytics = lazy(() => import('../features/superadmin/PlatformAnalytics'))
const SuperAdminsList = lazy(() => import('../features/superadmin/SuperAdminsList'))
const AdminPlans = lazy(() => import('../features/plans/AdminPlans'))
const BillingHistory = lazy(() => import('../features/plans/BillingHistory'))
const AdminDeliveries = lazy(() => import('../features/deliveries/AdminDeliveries'))
const AdminExpenses = lazy(() => import('../features/expenses/AdminExpenses'))
const AdminInvoices = lazy(() => import('../features/invoices/AdminInvoices'))
const CreateSalesInvoice = lazy(() => import('../features/invoices/CreateSalesInvoice'))
const InvoiceDetail = lazy(() => import('../features/invoices/InvoiceDetail'))
const InvoiceSettings = lazy(() => import('../features/invoices/InvoiceSettings'))
const ThemeSettings = lazy(() => import('../features/settings/ThemeSettings'))
const OnlinePayments = lazy(() => import('../features/settings/OnlinePayments'))
const ObjectFieldsSettings = lazy(() => import('../features/settings/ObjectFieldsSettings'))
const AdminAttendance = lazy(() => import('../features/attendance/AdminAttendance'))
const AttendanceDetail = lazy(() => import('../features/attendance/AttendanceDetail'))
const Profile = lazy(() => import('../features/profile/Profile'))
const SalesReturnList = lazy(() => import('../features/salesReturns/SalesReturnList'))
const SalesReturnFormPage = lazy(() => import('../features/salesReturns/SalesReturnFormPage'))
const SalesReturnDetail = lazy(() => import('../features/salesReturns/SalesReturnDetail'))
const HelpFaq = lazy(() => import('../features/legal/HelpFaq'))
const PrivacyPolicy = lazy(() => import('../features/legal/PrivacyPolicy'))
const TermsOfService = lazy(() => import('../features/legal/TermsOfService'))
const RefundPolicy = lazy(() => import('../features/legal/RefundPolicy'))
const AcceptableUsePolicy = lazy(() => import('../features/legal/AcceptableUsePolicy'))
const ContactSupport = lazy(() => import('../features/legal/ContactSupport'))
const LegalIndex = lazy(() => import('../features/legal/LegalIndex'))
const PlatformStaff = lazy(() => import('../features/superadmin/PlatformStaff'))
const FeatureRequests = lazy(() => import('../features/superadmin/FeatureRequests'))
const TicketDetail = lazy(() => import('../features/support/TicketDetail'))
const PlatformSupportTickets = lazy(() => import('../features/support/PlatformSupportTickets'))
const PlatformSupportTicketDetail = lazy(() => import('../features/support/PlatformSupportTicketDetail'))

function RootRedirect() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const fullAccess = useAuthStore((state) => state.fullAccess)
  const role = useAuthStore((state) => state.role)
  if (currentUser) return <Navigate to={resolveHomePath({ fullAccess, role, currentUser })} replace />
  return <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <StorageLimitModal />
      <Suspense fallback={<PageSkeleton label="Loading..." className="p-6" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<GoogleAuthCallback />} />
        <Route path="/auth/register/google" element={<GoogleRegister />} />
        <Route path="/superadmin/login" element={<Navigate to="/login" replace />} />

        {/* Help & Legal - public (reachable pre-login from the auth-page footer, and from the
            authenticated profile dropdown once signed in). Each renders its own standalone
            LegalPageLayout, not the authenticated Sidebar/Topbar. */}
        <Route path="/help" element={<HelpFaq />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/acceptable-use" element={<AcceptableUsePolicy />} />
        <Route path="/support" element={<ContactSupport />} />
        <Route path="/legal" element={<LegalIndex />} />
        {/* Public headless-render target for backend PDF generation - see InvoicePrintView.jsx.
            No ProtectedRoute: auth is a short-lived token in the URL, not a logged-in session. */}
        <Route path="/print/invoices/:id" element={<InvoicePrintView />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/profile" element={<Profile />} />
          {/* Help & FAQ (with ticket raising) and ticket detail are open to every authenticated
              role, Admin and Staff alike - unlike most /admin/* pages below, which are
              Admin-only. */}
          <Route path="/admin/settings/help" element={<HelpFaq embedded />} />
          <Route path="/support/tickets/:id" element={<TicketDetail />} />
        </Route>

        <Route
          element={
            <PlatformGuard superAdminOnly>
              <Layout />
            </PlatformGuard>
          }
        >
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/organizations" element={<OrganizationsList />} />
          <Route path="/superadmin/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/superadmin/upgrade-requests" element={<UpgradeRequests />} />
          <Route path="/superadmin/support-tickets" element={<PlatformSupportTickets />} />
          <Route path="/superadmin/support-tickets/:id" element={<PlatformSupportTicketDetail />} />
          <Route path="/superadmin/staff" element={<PlatformStaff />} />
          <Route path="/superadmin/feature-requests" element={<FeatureRequests />} />
          <Route path="/superadmin/superadmins" element={<SuperAdminsList />} />
          <Route path="/superadmin/plans" element={<SubscriptionPlans />} />
          <Route path="/superadmin/analytics" element={<PlatformAnalytics />} />
          <Route path="/superadmin/admins" element={<SuperAdminsList />} />
        </Route>

        <Route element={<PlatformGuard><Layout /></PlatformGuard>}>
          <Route path="/platform" element={<Navigate to="/platform/organizations" replace />} />
          <Route path="/platform/organizations" element={<OrganizationsList />} />
          <Route path="/platform/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/platform/upgrade-requests" element={<UpgradeRequests />} />
          <Route path="/platform/feature-requests" element={<FeatureRequests />} />
          <Route path="/platform/support-tickets" element={<PlatformSupportTickets />} />
          <Route path="/platform/support-tickets/:id" element={<PlatformSupportTicketDetail />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/admin/dashboard"
            element={
              <RequireFullOrgDashboardRoute>
                <AdminDashboard />
              </RequireFullOrgDashboardRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <RequirePermissionRoute module="sales_orders" action="view">
                <OrderList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/orders/create"
            element={
              <RequirePermissionRoute module="sales_orders" action="create">
                <CreateSalesOrder />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/orders/:id/edit"
            element={
              <RequirePermissionRoute module="sales_orders" action="create">
                <CreateSalesOrder />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/orders/:id"
            element={
              <RequirePermissionRoute module="sales_orders" action="view">
                <OrderDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/company-settings"
            element={
              <RequirePermissionRoute module="settings" action="view">
                <CompanySettings />
              </RequirePermissionRoute>
            }
          />
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/billing-history" element={<BillingHistory />} />
          <Route
            path="/admin/users"
            element={
              <RequirePermissionRoute module="users" feature={ENTITLEMENT_KEYS.EMPLOYEE_STAFF}>
                <UserManagement />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/users/edit/:user_id"
            element={
              <RequirePermissionRoute module="users" action="edit" feature={ENTITLEMENT_KEYS.EMPLOYEE_STAFF}>
                <UserEdit />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/users/:user_id"
            element={
              <RequirePermissionRoute module="users" action="view" feature={ENTITLEMENT_KEYS.EMPLOYEE_STAFF}>
                <UserDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequirePermissionRoute module="users" action="edit" feature={ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS}>
                <RolesList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles/new"
            element={
              <RequirePermissionRoute module="users" action="edit" feature={ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS}>
                <RoleForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles/edit/:role_id"
            element={
              <RequirePermissionRoute module="users" action="edit" feature={ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS}>
                <RoleForm />
              </RequirePermissionRoute>
            }
          />
          {/* Teams removed from the current MVP - any old /admin/teams link lands on Roles. */}
          <Route path="/admin/teams" element={<Navigate to="/admin/roles" replace />} />
          <Route
            path="/admin/attendance"
            element={
              <RequirePermissionRoute module="attendance" action="view" feature={ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE}>
                <AdminAttendance />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/attendance/:userId"
            element={
              <RequirePermissionRoute module="attendance" action="view" feature={ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE}>
                <AttendanceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <RequirePermissionRoute module="customers" action="view">
                <CustomerList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/customers/edit/:customer_id"
            element={
              <RequirePermissionRoute module="customers" action="edit">
                <CustomerEdit />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/customers/:id"
            element={
              <RequirePermissionRoute module="customers" action="view">
                <CustomerDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leads"
            element={
              <RequirePermissionRoute module="leads" action="view" feature={ENTITLEMENT_KEYS.CRM_LEADS}>
                <LeadList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leads/new"
            element={
              <RequirePermissionRoute module="leads" action="create" feature={ENTITLEMENT_KEYS.CRM_LEADS}>
                <LeadFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leads/:id"
            element={
              <RequirePermissionRoute module="leads" action="view" feature={ENTITLEMENT_KEYS.CRM_LEADS}>
                <LeadDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations"
            element={
              <RequirePermissionRoute module="quotations" action="view" feature={ENTITLEMENT_KEYS.CRM_QUOTATIONS}>
                <QuotationList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/new"
            element={
              <RequirePermissionRoute module="quotations" action="create" feature={ENTITLEMENT_KEYS.CRM_QUOTATIONS}>
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/:id/edit"
            element={
              <RequirePermissionRoute module="quotations" action="edit" feature={ENTITLEMENT_KEYS.CRM_QUOTATIONS}>
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/:id"
            element={
              <RequirePermissionRoute module="quotations" action="view" feature={ENTITLEMENT_KEYS.CRM_QUOTATIONS}>
                <QuotationDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/suppliers"
            element={
              <RequirePermissionRoute module="suppliers" action="view">
                <SupplierList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/suppliers/:id"
            element={
              <RequirePermissionRoute module="suppliers" action="view">
                <SupplierDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <RequirePermissionRoute module="products" action="view">
                <CategoryList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/categories/new"
            element={
              <RequirePermissionRoute module="products" action="create">
                <CategoryFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/brands"
            element={
              <RequirePermissionRoute module="products" action="view">
                <BrandList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <RequirePermissionRoute module="products" action="view">
                <ProductList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/products/:id"
            element={
              <RequirePermissionRoute module="products" action="view">
                <ProductDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <RequirePermissionRoute module="inventory" action="view">
                <StockBoard />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/inventory/:product_id"
            element={
              <RequirePermissionRoute module="inventory" action="view">
                <StockDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/warehouses"
            element={
              <RequirePermissionRoute module="inventory" action="view">
                <WarehouseList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/warehouses/:id"
            element={
              <RequirePermissionRoute module="inventory" action="view">
                <WarehouseDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicle-stock"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view" feature={ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK}>
                <VehicleStockList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicle-stock/:id"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view" feature={ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK}>
                <VehicleStockDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicles"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view" feature={ENTITLEMENT_KEYS.SALES_VEHICLES}>
                <VehicleList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicles/:id"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view" feature={ENTITLEMENT_KEYS.SALES_VEHICLES}>
                <VehicleDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchases"
            element={
              <RequirePermissionRoute module="purchases" action="view">
                <PurchaseInvoiceList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchases/create"
            element={
              <RequirePermissionRoute module="purchases" action="create">
                <PurchaseInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchases/:id/edit"
            element={
              <RequirePermissionRoute module="purchases" action="edit">
                <PurchaseInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchases/:id"
            element={
              <RequirePermissionRoute module="purchases" action="view">
                <PurchaseInvoiceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchase-returns"
            element={
              <RequirePermissionRoute module="purchases" action="view">
                <PurchaseReturnList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchase-returns/new"
            element={
              <RequirePermissionRoute module="purchases" action="create">
                <PurchaseReturnFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchase-returns/:id/edit"
            element={
              <RequirePermissionRoute module="purchases" action="create">
                <PurchaseReturnFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/purchase-returns/:id"
            element={
              <RequirePermissionRoute module="purchases" action="view">
                <PurchaseReturnDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/supplier-invoices"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierInvoiceList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/supplier-invoices/new"
            element={
              <RequirePermissionRoute module="invoices" action="create">
                <SupplierInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/supplier-invoices/:id/edit"
            element={
              <RequirePermissionRoute module="invoices" action="edit">
                <SupplierInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/supplier-invoices/:id"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierInvoiceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/payables"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <PayablesList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/supplier-payments"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierPaymentsList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/deliveries"
            element={
              <RequirePermissionRoute module="deliveries" action="view">
                <AdminDeliveries />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/deliveries/:id"
            element={
              <RequirePermissionRoute module="deliveries" action="view">
                <DeliveryDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/expenses"
            element={
              <RequirePermissionRoute module="expenses" action="view">
                <AdminExpenses />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <AdminInvoices />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/invoices/new"
            element={
              <RequirePermissionRoute module="invoices" action="create">
                <CreateSalesInvoice />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/invoices/settings"
            element={
              <RequirePermissionRoute module="invoices" action="edit">
                <InvoiceSettings />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/invoices/:invoiceNumber"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <InvoiceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/receivables"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <ReceivablesPayables />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/collections"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <CollectionReconciliation />
              </RequirePermissionRoute>
            }
          />
          {/* Cash Reconciliation superseded by the Delivery Day-End workflow (crm_changes15.md
              §V) - already removed from nav; the direct URL now redirects too instead of still
              rendering the orphaned page. */}
          <Route path="/admin/reconciliation/cash" element={<Navigate to="/admin/day-end-approvals" replace />} />
          <Route
            path="/admin/day-end-approvals"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <DayEndApprovals />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/sales-returns"
            element={
              <RequirePermissionRoute module="sales_returns" action="view">
                <SalesReturnList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/sales-returns/new"
            element={
              <RequirePermissionRoute module="sales_returns" action="create">
                <SalesReturnFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/sales-returns/:id"
            element={
              <RequirePermissionRoute module="sales_returns" action="view">
                <SalesReturnDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RequirePermissionRoute module="reports" action="view" feature={ENTITLEMENT_KEYS.FINANCE_REPORTS}>
                <ReportsHub />
              </RequirePermissionRoute>
            }
          />
          {/* Renders the same canonical Reports component as every other report - the old
              "coming soon" placeholder is gone now that the backend has a real Balance Sheet.
              Same module="reports" permission as the base Reports page, so (like Cash Flow
              Sheet) no lockReportType is needed - switching away via the dropdown is safe. */}
          <Route
            path="/admin/reports/balance-sheet"
            element={
              <RequirePermissionRoute module="reports" action="view" feature={ENTITLEMENT_KEYS.REPORT_BALANCE_SHEET}>
                <FinancialReports defaultReport="balance-sheet" />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/reports/cash-flow-sheet"
            element={
              <RequirePermissionRoute module="reports" action="view" feature={ENTITLEMENT_KEYS.REPORT_CASH_FLOW}>
                <FinancialReports defaultReport="cash-flow-sheet" />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/sales-overview"
            element={
              <RequirePermissionRoute module="reports" action="view" feature={ENTITLEMENT_KEYS.SALES_SALES}>
                <SalesOverview />
              </RequirePermissionRoute>
            }
          />
          {/* Authenticated aliases of the public legal pages (/terms, /privacy, /legal) - same
              content components, embedded=true skips their own standalone page chrome so
              they render inside this Layout's Sidebar/Topbar instead of leaving it. No module
              gate: these aren't permission-scoped anywhere else in the app either. */}
          <Route path="/admin/settings/terms" element={<TermsOfService embedded />} />
          <Route path="/admin/settings/privacy" element={<PrivacyPolicy embedded />} />
          <Route path="/admin/settings/policies" element={<LegalIndex embedded />} />
          <Route path="/admin/notifications" element={<NotificationsList />} />
          <Route
            path="/admin/audit-logs"
            element={
              <RequirePermissionRoute module="reports" action="view">
                <AuditLogList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/object-fields"
            element={
              <RequirePermissionRoute module="settings" action="view">
                <ObjectFieldsSettings />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leaves"
            element={
              <RequirePermissionRoute module="leaves" action="view" feature={ENTITLEMENT_KEYS.EMPLOYEE_LEAVES}>
                <LeaveApprovalQueue />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/theme-settings"
            element={
              <RequirePermissionRoute module="settings" action="view">
                <ThemeSettings />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/online-payments"
            element={
              <RequirePermissionRoute module="settings" action="view">
                <OnlinePayments />
              </RequirePermissionRoute>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.SALES_OFFICER]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/sales/dashboard" element={<SalesOfficerDashboard />} />
          <Route
            path="/sales/customers"
            element={
              <RequirePermissionRoute module="customers" action="view">
                <CustomerList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/customers/:id"
            element={
              <RequirePermissionRoute module="customers" action="view">
                <CustomerDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/leads"
            element={
              <RequirePermissionRoute module="leads" action="view">
                <LeadList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/leads/new"
            element={
              <RequirePermissionRoute module="leads" action="create">
                <LeadFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/leads/:id"
            element={
              <RequirePermissionRoute module="leads" action="view">
                <LeadDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/quotations"
            element={
              <RequirePermissionRoute module="quotations" action="view">
                <QuotationList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/quotations/new"
            element={
              <RequirePermissionRoute module="quotations" action="create">
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/quotations/:id/edit"
            element={
              <RequirePermissionRoute module="quotations" action="edit">
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/quotations/:id"
            element={
              <RequirePermissionRoute module="quotations" action="view">
                <QuotationDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/orders"
            element={
              <RequirePermissionRoute module="sales_orders" action="view">
                <OrderList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/orders/create"
            element={
              <RequirePermissionRoute module="sales_orders" action="create">
                <CreateSalesOrder />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/orders/:id/edit"
            element={
              <RequirePermissionRoute module="sales_orders" action="create">
                <CreateSalesOrder />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/orders/:id"
            element={
              <RequirePermissionRoute module="sales_orders" action="view">
                <OrderDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/sales-returns"
            element={
              <RequirePermissionRoute module="sales_returns" action="view">
                <SalesReturnList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/sales-returns/new"
            element={
              <RequirePermissionRoute module="sales_returns" action="create">
                <SalesReturnFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/sales-returns/:id"
            element={
              <RequirePermissionRoute module="sales_returns" action="view">
                <SalesReturnDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/stock"
            element={
              <RequirePermissionRoute module="inventory" action="view">
                <StockBoard readOnly />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/visits"
            element={
              <RequirePermissionRoute module="visits" action="view">
                <VisitCheckIn />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/followups"
            element={
              <RequirePermissionRoute module="follow_ups" action="view">
                <FollowUpsList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/attendance"
            element={
              <RequirePermissionRoute module="attendance" action="view">
                <MyAttendance />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/leaves"
            element={
              <RequirePermissionRoute module="leaves" action="view">
                <MyLeaves />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/sales/expenses"
            element={
              <RequirePermissionRoute module="expenses" action="view">
                <MyExpenses />
              </RequirePermissionRoute>
            }
          />
          <Route path="/sales/performance" element={<MyTargets />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.DELIVERY_PARTNER]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/delivery/dashboard" element={<DeliveryPartnerDashboard />} />
          {/* Delivery Partners do not create sales orders. Any old bookmark/manual URL
              lands on their Assigned Deliveries page. (CreateSalesOrder stays available
              to Sales Officer / Admin — see the /sales and /admin routes.) */}
          <Route path="/delivery/orders/create" element={<Navigate to="/delivery/deliveries" replace />} />
          <Route path="/delivery/orders/*" element={<Navigate to="/delivery/deliveries" replace />} />
          <Route
            path="/delivery/vehicle-loading"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view">
                <VehicleLoading />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/deliveries"
            element={
              <RequirePermissionRoute module="deliveries" action="view">
                <AssignedDeliveries />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/deliveries/:id"
            element={
              <RequirePermissionRoute module="deliveries" action="view">
                <DeliveryDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/expenses"
            element={
              <RequirePermissionRoute module="expenses" action="view">
                <MyExpenses />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/end-of-day"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view">
                <EndOfDayReturn />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/day-end"
            element={
              <RequirePermissionRoute module="delivery_collections" action="view">
                <DayEndClose />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/attendance"
            element={
              <RequirePermissionRoute module="attendance" action="view">
                <MyAttendance />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/leaves"
            element={
              <RequirePermissionRoute module="leaves" action="view">
                <MyLeaves />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/delivery/vehicle-stock"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view">
                <VehicleStockOverview />
              </RequirePermissionRoute>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.ACCOUNTANT]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/accounts/dashboard" element={<AccountantDashboard />} />
          <Route
            path="/accounts/invoices/purchases"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <PurchaseInvoices />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/supplier-invoices"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierInvoiceList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/supplier-invoices/new"
            element={
              <RequirePermissionRoute module="invoices" action="create">
                <SupplierInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/supplier-invoices/:id/edit"
            element={
              <RequirePermissionRoute module="invoices" action="edit">
                <SupplierInvoiceForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/supplier-invoices/:id"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierInvoiceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/payables"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <PayablesList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/supplier-payments"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SupplierPaymentsList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/invoices/sales"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <SalesInvoices />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/invoices/sales/:invoiceNumber"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <InvoiceDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/payments/record"
            element={
              <RequirePermissionRoute module="payments" action="create">
                <RecordPayment />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/expenses/approval"
            element={
              <RequirePermissionRoute module="expenses" action="approve">
                <ExpenseApprovalQueue />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/expenses"
            element={
              <RequirePermissionRoute module="expenses" action="view">
                <MyExpenses />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/leaves"
            element={
              <RequirePermissionRoute module="leaves" action="view">
                <MyLeaves />
              </RequirePermissionRoute>
            }
          />
          {/* See the matching comment on /admin/reconciliation/cash above. */}
          <Route path="/accounts/reconciliation/cash" element={<Navigate to="/accounts/day-end-approvals" replace />} />
          <Route
            path="/accounts/receivables"
            element={
              <RequirePermissionRoute module="invoices" action="view">
                <ReceivablesPayables />
              </RequirePermissionRoute>
            }
          />
          {/* Legacy path - kept as a redirect to the canonical Receivables route. */}
          <Route path="/accounts/outstanding" element={<Navigate to="/accounts/receivables" replace />} />
          <Route
            path="/accounts/collections"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <CollectionReconciliation />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/day-end-approvals"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <DayEndApprovals />
              </RequirePermissionRoute>
            }
          />
          {/* Renders the SAME canonical Reports component Admin's "GST Filing Sheet" shortcut
              uses (?report=gst-summary) - no second GST implementation. The route and its
              module="gst" permission check (distinct from "reports" - a role can be granted one
              without the other via Roles & Permissions) are both preserved exactly as before. */}
          <Route
            path="/accounts/gst"
            element={
              <RequirePermissionRoute module="gst" action="view">
                <FinancialReports defaultReport="gst-summary" lockReportType title="GST Summary" description="GST summary and detailed transaction rows for filing preparation." />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/reports"
            element={
              <RequirePermissionRoute module="reports" action="view">
                <FinancialReports />
              </RequirePermissionRoute>
            }
          />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
