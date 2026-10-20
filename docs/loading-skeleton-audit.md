# Loading skeleton audit

All 118 former generic LoadingSpinner call sites now explicitly select a structural layout. No API, timeout, filter, sort, or business logic changes are part of this work.

- Table sections use their own headings/column count, minimum width, selection checkbox and avatar column where applicable. Existing DataTable loading rows reuse the actual column definitions.
- Admin dashboard reserves its filters, tall sales card, six KPI cards, quick actions, charts and table. Other dashboards use their own card counts.
- Detail, edit form, settings with preview, activity feed, map, report, plan card and repeated vehicle-stock sections use corresponding loading layouts.
- Listing summary labels remain visible while loading; temporary numeric values are replaced with placeholders on the initial load. Previously loaded values remain visible during table-only refreshes.
- Skeletons are noninteractive and hidden from screen readers; one loading status is announced. Animation respects reduced-motion preferences.

## Configured pages and sections

| File | Loading layouts |
| --- | --- |
| `src/features/attendance/AdminAttendance.jsx` | table |
| `src/features/attendance/AttendanceDetail.jsx` | detail |
| `src/features/attendance/MyAttendance.jsx` | table |
| `src/features/auditLogs/AuditLogList.jsx` | table |
| `src/features/auth/GoogleRegister.jsx` | form |
| `src/features/brands/BrandList.jsx` | table |
| `src/features/categories/CategoryList.jsx` | table, fields |
| `src/features/collections/CollectionReconciliation.jsx` | table |
| `src/features/company/CompanySettings.jsx` | detail |
| `src/features/customers/CustomerDetail.jsx` | detail, list, table, table, activity, table, cards |
| `src/features/customers/CustomerEdit.jsx` | form |
| `src/features/customers/CustomerList.jsx` | table |
| `src/features/dashboard/AccountantDashboard.jsx` | dashboard |
| `src/features/dashboard/AdminDashboard.jsx` | dashboard |
| `src/features/dashboard/DeliveryPartnerDashboard.jsx` | dashboard |
| `src/features/dashboard/SalesOfficerDashboard.jsx` | dashboard |
| `src/features/deliveries/DeliveryDetail.jsx` | detail, form |
| `src/features/expenses/MyExpenses.jsx` | table |
| `src/features/followups/FollowUpsList.jsx` | table |
| `src/features/inventory/StockBoard.jsx` | table |
| `src/features/inventory/StockDetail.jsx` | detail |
| `src/features/invoices/AdminInvoices.jsx` | table |
| `src/features/invoices/CreateSalesInvoice.jsx` | form, list |
| `src/features/invoices/InvoiceDetail.jsx` | detail |
| `src/features/invoices/InvoiceSettings.jsx` | settings |
| `src/features/invoices/PurchaseInvoices.jsx` | table |
| `src/features/leads/ConvertLeadModal.jsx` | form |
| `src/features/leads/LeadDetail.jsx` | detail, activity, activity |
| `src/features/leads/LeadList.jsx` | table |
| `src/features/leaves/MyLeaves.jsx` | table |
| `src/features/notifications/NotificationsList.jsx` | activity |
| `src/features/orders/OrderDetail.jsx` | detail, table |
| `src/features/orders/OrderList.jsx` | table |
| `src/features/payables/PayablesList.jsx` | table |
| `src/features/plans/AdminPlans.jsx` | cards |
| `src/features/plans/BillingHistory.jsx` | table |
| `src/features/products/ProductDetail.jsx` | detail |
| `src/features/products/ProductList.jsx` | table |
| `src/features/purchaseReturns/PurchaseReturnDetail.jsx` | detail |
| `src/features/purchaseReturns/PurchaseReturnFormPage.jsx` | form, table |
| `src/features/purchaseReturns/PurchaseReturnList.jsx` | table |
| `src/features/purchases/PurchaseGrnPanel.jsx` | table, table |
| `src/features/purchases/PurchaseInvoiceDetail.jsx` | detail |
| `src/features/purchases/PurchaseInvoiceForm.jsx` | form, form |
| `src/features/purchases/PurchaseInvoiceList.jsx` | table |
| `src/features/quotations/QuotationDetail.jsx` | detail |
| `src/features/quotations/QuotationFormPage.jsx` | form |
| `src/features/quotations/QuotationList.jsx` | table |
| `src/features/reconciliation/CashReconciliation.jsx` | table, table |
| `src/features/reports/FinancialReports.jsx` | report |
| `src/features/roles/RoleForm.jsx` | form |
| `src/features/roles/RolePermissionMatrix.jsx` | table |
| `src/features/roles/RolesList.jsx` | table |
| `src/features/sales/SalesOverview.jsx` | report |
| `src/features/salesReturns/SalesReturnDetail.jsx` | detail |
| `src/features/salesReturns/SalesReturnList.jsx` | table |
| `src/features/settings/ObjectFieldsSettings.jsx` | settings |
| `src/features/settings/OnlinePayments.jsx` | settings |
| `src/features/settings/ThemeSettings.jsx` | settings |
| `src/features/superadmin/OrganizationDetail.jsx` | detail, table |
| `src/features/superadmin/OrganizationPlanAccess.jsx` | form, stats |
| `src/features/superadmin/OrganizationsList.jsx` | table |
| `src/features/superadmin/PlatformAnalytics.jsx` | dashboard |
| `src/features/superadmin/SubscriptionPlans.jsx` | cards |
| `src/features/superadmin/UpgradeRequests.jsx` | table |
| `src/features/supplierInvoices/SupplierInvoiceDetail.jsx` | detail |
| `src/features/supplierInvoices/SupplierInvoiceForm.jsx` | form |
| `src/features/supplierInvoices/SupplierInvoiceList.jsx` | table |
| `src/features/supplierPayments/SupplierPaymentQuickView.jsx` | payment |
| `src/features/supplierPayments/SupplierPaymentsList.jsx` | table |
| `src/features/suppliers/SupplierDetail.jsx` | detail, activity, activity, table, table, table |
| `src/features/suppliers/SupplierList.jsx` | form, table |
| `src/features/users/DeliveryStaffOverview.jsx` | list, stats, fields |
| `src/features/users/SalesStaffOverview.jsx` | list, list |
| `src/features/users/staffOverviewShared.jsx` | activity, map |
| `src/features/users/UserDetail.jsx` | detail, table, table |
| `src/features/users/UserEdit.jsx` | form |
| `src/features/users/UserManagement.jsx` | table |
| `src/features/vehicles/VehicleDetail.jsx` | detail |
| `src/features/vehicles/VehicleList.jsx` | table |
| `src/features/vehicleStock/EndOfDayReturn.jsx` | table, form |
| `src/features/vehicleStock/VehicleLoading.jsx` | form |
| `src/features/vehicleStock/VehicleStockOverview.jsx` | vehicle-stock |
| `src/features/visits/VisitCheckIn.jsx` | table |
| `src/features/warehouses/WarehouseDetail.jsx` | detail, table |
| `src/features/warehouses/WarehouseList.jsx` | table |

## Validation

Build passed. Oxlint: 0 errors, 34 existing warnings. All 88 automated checks passed (6 new loading-layout checks and 82 existing regression checks). Automated checks render each loading layout, verify Leads column/row counts, dashboard structural slots, summary loading behavior, table markup/alignment, reduced-motion support and explicit layout selection at all 118 call sites.

Existing invoice, order-address, product-variant and listing-summary regression suites are also run. Browser screenshot comparison and interactive breakpoint checks remain unverified because the browser runtime could not connect in this session.
