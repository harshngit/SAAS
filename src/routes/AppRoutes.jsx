import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ProtectedRoute from '../auth/ProtectedRoute'
import Login from '../features/auth/Login'
import Register from '../auth/Register'
import SuperAdminDashboard from '../features/dashboard/SuperAdminDashboard'
import AdminDashboard from '../features/dashboard/AdminDashboard'
import SalesOfficerDashboard from '../features/dashboard/SalesOfficerDashboard'
import DeliveryPartnerDashboard from '../features/dashboard/DeliveryPartnerDashboard'
import AccountantDashboard from '../features/dashboard/AccountantDashboard'
import { useAuthStore } from '../store/authStore'
import { ROLES, roleHomePath } from '../auth/roles'
import CompanySettings from '../features/company/CompanySettings'
import UserManagement from '../features/users/UserManagement'
import ProductList from '../features/products/ProductList'
import StockBoard from '../features/inventory/StockBoard'
import VehicleStockOverview from '../features/vehicleStock/VehicleStockOverview'
import PurchaseInvoiceList from '../features/purchases/PurchaseInvoiceList'
import ReportsHub from '../features/reports/ReportsHub'
import NotificationsList from '../features/notifications/NotificationsList'
import AuditLogList from '../features/auditLogs/AuditLogList'
import CustomerList from '../features/customers/CustomerList'
import CreateSalesOrder from '../features/orders/CreateSalesOrder'
import VisitCheckIn from '../features/visits/VisitCheckIn'
import FollowUpsList from '../features/followups/FollowUpsList'
import MyTargets from '../features/performance/MyTargets'
import VehicleLoading from '../features/vehicleStock/VehicleLoading'
import AssignedDeliveries from '../features/deliveries/AssignedDeliveries'
import DeliveryDetail from '../features/deliveries/DeliveryDetail'
import MyExpenses from '../features/expenses/MyExpenses'
import EndOfDayReturn from '../features/vehicleStock/EndOfDayReturn'
import MyAttendance from '../features/attendance/MyAttendance'
import PurchaseInvoices from '../features/invoices/PurchaseInvoices'
import SalesInvoices from '../features/invoices/SalesInvoices'
import RecordPayment from '../features/payments/RecordPayment'
import ExpenseApprovalQueue from '../features/expenses/ExpenseApprovalQueue'
import CashReconciliation from '../features/reconciliation/CashReconciliation'
import ReceivablesPayables from '../features/outstanding/ReceivablesPayables'
import GSTSummary from '../features/gst/GSTSummary'
import FinancialReports from '../features/reports/FinancialReports'
import OrganizationsList from '../features/superadmin/OrganizationsList'
import OrganizationDetail from '../features/superadmin/OrganizationDetail'
import SubscriptionPlans from '../features/superadmin/SubscriptionPlans'
import PlatformAnalytics from '../features/superadmin/PlatformAnalytics'
import AdminPlans from '../features/plans/AdminPlans'
import AdminDeliveries from '../features/deliveries/AdminDeliveries'
import AdminExpenses from '../features/expenses/AdminExpenses'
import AdminInvoices from '../features/invoices/AdminInvoices'
import AdminSettings from '../features/settings/AdminSettings'
import Profile from '../features/profile/Profile'

function RootRedirect() {
  const currentUser = useAuthStore((state) => state.currentUser)
  if (currentUser) return <Navigate to={roleHomePath[currentUser.role]} replace />
  return <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/superadmin/login" element={<Navigate to="/login" replace />} />

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES_OFFICER, ROLES.DELIVERY_PARTNER, ROLES.ACCOUNTANT]}>
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
          <Route path="/superadmin/plans" element={<SubscriptionPlans />} />
          <Route path="/superadmin/analytics" element={<PlatformAnalytics />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/company-settings" element={<CompanySettings />} />
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/products" element={<ProductList />} />
          <Route path="/admin/inventory" element={<StockBoard />} />
          <Route path="/admin/vehicle-stock" element={<VehicleStockOverview />} />
          <Route path="/admin/purchases" element={<PurchaseInvoiceList />} />
          <Route path="/admin/deliveries" element={<AdminDeliveries />} />
          <Route path="/admin/expenses" element={<AdminExpenses />} />
          <Route path="/admin/invoices" element={<AdminInvoices />} />
          <Route path="/admin/reports" element={<ReportsHub />} />
          <Route path="/admin/notifications" element={<NotificationsList />} />
          <Route path="/admin/audit-logs" element={<AuditLogList />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.SALES_OFFICER]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/sales/dashboard" element={<SalesOfficerDashboard />} />
          <Route path="/sales/customers" element={<CustomerList />} />
          <Route path="/sales/orders/create" element={<CreateSalesOrder />} />
          <Route path="/sales/visits" element={<VisitCheckIn />} />
          <Route path="/sales/followups" element={<FollowUpsList />} />
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
          <Route path="/delivery/vehicle-loading" element={<VehicleLoading />} />
          <Route path="/delivery/deliveries" element={<AssignedDeliveries />} />
          <Route path="/delivery/deliveries/:id" element={<DeliveryDetail />} />
          <Route path="/delivery/expenses" element={<MyExpenses />} />
          <Route path="/delivery/end-of-day" element={<EndOfDayReturn />} />
          <Route path="/delivery/attendance" element={<MyAttendance />} />
          <Route path="/delivery/vehicle-stock" element={<VehicleStockOverview />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.ACCOUNTANT]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/accounts/dashboard" element={<AccountantDashboard />} />
          <Route path="/accounts/invoices/purchases" element={<PurchaseInvoices />} />
          <Route path="/accounts/invoices/sales" element={<SalesInvoices />} />
          <Route path="/accounts/payments/record" element={<RecordPayment />} />
          <Route path="/accounts/expenses/approval" element={<ExpenseApprovalQueue />} />
          <Route path="/accounts/reconciliation/cash" element={<CashReconciliation />} />
          <Route path="/accounts/outstanding" element={<ReceivablesPayables />} />
          <Route path="/accounts/gst" element={<GSTSummary />} />
          <Route path="/accounts/reports" element={<FinancialReports />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
