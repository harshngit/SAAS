import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ProtectedRoute from '../auth/ProtectedRoute'
import RequirePermissionRoute from '../auth/RequirePermission'
import Login from '../features/auth/Login'
import Register from '../auth/Register'
import GoogleAuthCallback from '../features/auth/GoogleAuthCallback'
import GoogleRegister from '../features/auth/GoogleRegister'
import SuperAdminDashboard from '../features/dashboard/SuperAdminDashboard'
import AdminDashboard from '../features/dashboard/AdminDashboard'
import SalesOfficerDashboard from '../features/dashboard/SalesOfficerDashboard'
import DeliveryPartnerDashboard from '../features/dashboard/DeliveryPartnerDashboard'
import AccountantDashboard from '../features/dashboard/AccountantDashboard'
import { useAuthStore } from '../store/authStore'
import { ROLES, resolveHomePath } from '../auth/roles'
import CompanySettings from '../features/company/CompanySettings'
import UserManagement from '../features/users/UserManagement'
import UserDetail from '../features/users/UserDetail'
import UserEdit from '../features/users/UserEdit'
import RolesList from '../features/roles/RolesList'
import RoleForm from '../features/roles/RoleForm'
import ProductList from '../features/products/ProductList'
import ProductDetail from '../features/products/ProductDetail'
import StockBoard from '../features/inventory/StockBoard'
import StockDetail from '../features/inventory/StockDetail'
import VehicleStockOverview from '../features/vehicleStock/VehicleStockOverview'
import WarehouseList from '../features/warehouses/WarehouseList'
import WarehouseDetail from '../features/warehouses/WarehouseDetail'
import VehicleList from '../features/vehicles/VehicleList'
import VehicleDetail from '../features/vehicles/VehicleDetail'
import PurchaseInvoiceList from '../features/purchases/PurchaseInvoiceList'
import PurchaseInvoiceForm from '../features/purchases/PurchaseInvoiceForm'
import PurchaseInvoiceDetail from '../features/purchases/PurchaseInvoiceDetail'
import PurchaseReturnList from '../features/purchaseReturns/PurchaseReturnList'
import PurchaseReturnDetail from '../features/purchaseReturns/PurchaseReturnDetail'
import PurchaseReturnFormPage from '../features/purchaseReturns/PurchaseReturnFormPage'
import SupplierInvoiceList from '../features/supplierInvoices/SupplierInvoiceList'
import SupplierInvoiceForm from '../features/supplierInvoices/SupplierInvoiceForm'
import SupplierInvoiceDetail from '../features/supplierInvoices/SupplierInvoiceDetail'
import PayablesList from '../features/payables/PayablesList'
import SupplierPaymentsList from '../features/supplierPayments/SupplierPaymentsList'
import ReportsHub from '../features/reports/ReportsHub'
import NotificationsList from '../features/notifications/NotificationsList'
import AuditLogList from '../features/auditLogs/AuditLogList'
import CustomerList from '../features/customers/CustomerList'
import CustomerDetail from '../features/customers/CustomerDetail'
import CustomerEdit from '../features/customers/CustomerEdit'
import LeadList from '../features/leads/LeadList'
import LeadFormPage from '../features/leads/LeadFormPage'
import LeadDetail from '../features/leads/LeadDetail'
import QuotationList from '../features/quotations/QuotationList'
import QuotationFormPage from '../features/quotations/QuotationFormPage'
import QuotationDetail from '../features/quotations/QuotationDetail'
import SupplierList from '../features/suppliers/SupplierList'
import SupplierDetail from '../features/suppliers/SupplierDetail'
import CategoryList from '../features/categories/CategoryList'
import CategoryFormPage from '../features/categories/CategoryFormPage'
import BrandList from '../features/brands/BrandList'
import CreateSalesOrder from '../features/orders/CreateSalesOrder'
import OrderList from '../features/orders/OrderList'
import OrderDetail from '../features/orders/OrderDetail'
import VisitCheckIn from '../features/visits/VisitCheckIn'
import FollowUpsList from '../features/followups/FollowUpsList'
import MyTargets from '../features/performance/MyTargets'
import VehicleLoading from '../features/vehicleStock/VehicleLoading'
import AssignedDeliveries from '../features/deliveries/AssignedDeliveries'
import DeliveryDetail from '../features/deliveries/DeliveryDetail'
import MyExpenses from '../features/expenses/MyExpenses'
import MyLeaves from '../features/leaves/MyLeaves'
import LeaveApprovalQueue from '../features/leaves/LeaveApprovalQueue'
import EndOfDayReturn from '../features/vehicleStock/EndOfDayReturn'
import MyAttendance from '../features/attendance/MyAttendance'
import PurchaseInvoices from '../features/invoices/PurchaseInvoices'
import SalesInvoices from '../features/invoices/SalesInvoices'
import RecordPayment from '../features/payments/RecordPayment'
import ExpenseApprovalQueue from '../features/expenses/ExpenseApprovalQueue'
import CashReconciliation from '../features/reconciliation/CashReconciliation'
import ReceivablesPayables from '../features/outstanding/ReceivablesPayables'
import CollectionReconciliation from '../features/collections/CollectionReconciliation'
import GSTSummary from '../features/gst/GSTSummary'
import FinancialReports from '../features/reports/FinancialReports'
import OrganizationsList from '../features/superadmin/OrganizationsList'
import OrganizationDetail from '../features/superadmin/OrganizationDetail'
import UpgradeRequests from '../features/superadmin/UpgradeRequests'
import SubscriptionPlans from '../features/superadmin/SubscriptionPlans'
import PlatformAnalytics from '../features/superadmin/PlatformAnalytics'
import SuperAdminsList from '../features/superadmin/SuperAdminsList'
import AdminPlans from '../features/plans/AdminPlans'
import AdminDeliveries from '../features/deliveries/AdminDeliveries'
import AdminExpenses from '../features/expenses/AdminExpenses'
import AdminInvoices from '../features/invoices/AdminInvoices'
import CreateSalesInvoice from '../features/invoices/CreateSalesInvoice'
import InvoiceDetail from '../features/invoices/InvoiceDetail'
import InvoicePrintView from '../features/invoices/InvoicePrintView'
import InvoiceSettings from '../features/invoices/InvoiceSettings'
import AdminSettings from '../features/settings/AdminSettings'
import ObjectFieldsSettings from '../features/settings/ObjectFieldsSettings'
import AdminAttendance from '../features/attendance/AdminAttendance'
import AttendanceDetail from '../features/attendance/AttendanceDetail'
import Profile from '../features/profile/Profile'
import SalesReturnList from '../features/salesReturns/SalesReturnList'
import SalesReturnFormPage from '../features/salesReturns/SalesReturnFormPage'
import SalesReturnDetail from '../features/salesReturns/SalesReturnDetail'

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<GoogleAuthCallback />} />
        <Route path="/auth/register/google" element={<GoogleRegister />} />
        <Route path="/superadmin/login" element={<Navigate to="/login" replace />} />
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
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/organizations" element={<OrganizationsList />} />
          <Route path="/superadmin/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/superadmin/upgrade-requests" element={<UpgradeRequests />} />
          <Route path="/superadmin/plans" element={<SubscriptionPlans />} />
          <Route path="/superadmin/analytics" element={<PlatformAnalytics />} />
          <Route path="/superadmin/admins" element={<SuperAdminsList />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
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
          <Route
            path="/admin/users"
            element={
              <RequirePermissionRoute module="users">
                <UserManagement />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/users/edit/:user_id"
            element={
              <RequirePermissionRoute module="users" action="edit">
                <UserEdit />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/users/:user_id"
            element={
              <RequirePermissionRoute module="users" action="view">
                <UserDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequirePermissionRoute module="users" action="edit">
                <RolesList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles/new"
            element={
              <RequirePermissionRoute module="users" action="edit">
                <RoleForm />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/roles/edit/:role_id"
            element={
              <RequirePermissionRoute module="users" action="edit">
                <RoleForm />
              </RequirePermissionRoute>
            }
          />
          {/* Teams removed from the current MVP - any old /admin/teams link lands on Roles. */}
          <Route path="/admin/teams" element={<Navigate to="/admin/roles" replace />} />
          <Route
            path="/admin/attendance"
            element={
              <RequirePermissionRoute module="attendance" action="view">
                <AdminAttendance />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/attendance/:userId"
            element={
              <RequirePermissionRoute module="attendance" action="view">
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
              <RequirePermissionRoute module="leads" action="view">
                <LeadList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leads/new"
            element={
              <RequirePermissionRoute module="leads" action="create">
                <LeadFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/leads/:id"
            element={
              <RequirePermissionRoute module="leads" action="view">
                <LeadDetail />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations"
            element={
              <RequirePermissionRoute module="quotations" action="view">
                <QuotationList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/new"
            element={
              <RequirePermissionRoute module="quotations" action="create">
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/:id/edit"
            element={
              <RequirePermissionRoute module="quotations" action="edit">
                <QuotationFormPage />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/quotations/:id"
            element={
              <RequirePermissionRoute module="quotations" action="view">
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
              <RequirePermissionRoute module="vehicle_stock" action="view">
                <VehicleStockOverview />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicles"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view">
                <VehicleList />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/vehicles/:id"
            element={
              <RequirePermissionRoute module="vehicle_stock" action="view">
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
          <Route
            path="/admin/reconciliation/cash"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <CashReconciliation />
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
              <RequirePermissionRoute module="reports" action="view">
                <ReportsHub />
              </RequirePermissionRoute>
            }
          />
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
              <RequirePermissionRoute module="leaves" action="view">
                <LeaveApprovalQueue />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RequirePermissionRoute module="settings" action="view">
                <AdminSettings />
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
            path="/accounts/leaves"
            element={
              <RequirePermissionRoute module="leaves" action="view">
                <MyLeaves />
              </RequirePermissionRoute>
            }
          />
          <Route
            path="/accounts/reconciliation/cash"
            element={
              <RequirePermissionRoute module="payments" action="view">
                <CashReconciliation />
              </RequirePermissionRoute>
            }
          />
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
            path="/accounts/gst"
            element={
              <RequirePermissionRoute module="gst" action="view">
                <GSTSummary />
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
    </BrowserRouter>
  )
}
