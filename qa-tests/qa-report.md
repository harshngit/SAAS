# QA Report - 2026-11-14 (live site https://crm-saas.asynk.in)

Run stamp for every record created: `QA-TEST-1411-1436`. Accounts used: ADMIN (all tests), plus SALES / ACCOUNTANT / DELIVERY / SUPERADMIN for login + sidebar check only (T0).
Browser: installed Google Chrome via Playwright (`channel: 'chrome'`, headless:false, slowMo:250). Screenshots: `qa-tests\shots\`.

**Totals:** 69 PASS, 15 FAIL, 2 INFO rows.

## Results

| Test | What was done | Expected | Actual | PASS/FAIL | Screenshot | Failed API (URL + status) |
|---|---|---|---|---|---|---|
| T0 | Login ADMIN | Login works + sidebar visible | OK -> /admin/dashboard. Menus (46): Dashboard \| Leads \| Quotations \| Customers \| Brands \| Categories \| Products \| Suppliers \| Inventory \| Warehouses \| Purchases \| Purchase Returns \| Orders \| Sales Returns \| Deliveries \| Sales \| Vehicle Stock \| Vehicles \| Receivables \| Accounts Payable \| Supplier Payments \| Collection Reconciliation \| Day-End Approvals \| Expenses \| Reports \| Profit and Loss Sheet \| Cash Flow Sheet \| GST Filing Sheet \| Sales Invoices \| Supplier Invoices \| Company Settings \| Plans \| Billing History \| Audit Log \| My Profile \| Staff \| Attendance… | PASS | shots\T0-login-ADMIN.png | - |
| T0 | Login SALES | Login works + sidebar visible | OK -> /sales/dashboard. Menus (13): Dashboard \| Customers \| Leads \| Quotations \| Orders \| Create Order \| Sales Returns \| Stock \| Visits \| Follow-ups \| Attendance \| Leaves \| Expenses | PASS | shots\T0-login-SALES.png | - |
| T0 | Login ACCOUNTANT | Login works + sidebar visible | OK -> /accounts/dashboard. Menus (12): Dashboard \| Supplier Invoices \| Accounts Payable \| Supplier Payments \| Sales Invoices \| Receivables \| Collection Reconciliation \| Day-End Approvals \| Expense Approval \| My Expenses \| GST Summary \| Financial Reports | PASS | shots\T0-login-ACCOUNTANT.png | - |
| T0 | Login DELIVERY | Login works + sidebar visible | OK -> /delivery/dashboard. Menus (8): Dashboard \| My Deliveries \| Vehicle Loading \| Vehicle Stock \| End of Day Return \| Attendance \| Leaves \| Expenses | PASS | shots\T0-login-DELIVERY.png | - |
| T0 | Login SUPERADMIN | Login works + sidebar visible | OK -> /superadmin/dashboard. Menus (9): Dashboard \| Organizations \| Upgrade Requests \| Feature Requests \| Support Tickets \| Platform Staff \| Plans \| Platform Analytics \| Superadmins | PASS | shots\T0-login-SUPERADMIN.png | - |
| T1 | Open "Dashboard" (/admin/dashboard) | Page loads, no failed API, no console error | final=/admin/dashboard h1="Dashboard" | PASS | shots\T1-admin_dashboard.png | - |
| T1 | Open "Leads" (/admin/leads) | Page loads, no failed API, no console error | final=/admin/leads h1="Leads" | PASS | shots\T1-admin_leads.png | - |
| T1 | Open "Quotations" (/admin/quotations) | Page loads, no failed API, no console error | final=/admin/quotations h1="Quotations" | PASS | shots\T1-admin_quotations.png | - |
| T1 | Open "Customers" (/admin/customers) | Page loads, no failed API, no console error | final=/admin/customers h1="Customers" | PASS | shots\T1-admin_customers.png | - |
| T1 | Open "Brands" (/admin/brands) | Page loads, no failed API, no console error | final=/admin/brands h1="Brands" | PASS | shots\T1-admin_brands.png | - |
| T1 | Open "Categories" (/admin/categories) | Page loads, no failed API, no console error | final=/admin/categories h1="Categories" | PASS | shots\T1-admin_categories.png | - |
| T1 | Open "Products" (/admin/products) | Page loads, no failed API, no console error | final=/admin/products h1="Products" | PASS | shots\T1-admin_products.png | - |
| T1 | Open "Suppliers" (/admin/suppliers) | Page loads, no failed API, no console error | final=/admin/suppliers h1="Suppliers" | PASS | shots\T1-admin_suppliers.png | - |
| T1 | Open "Inventory" (/admin/inventory) | Page loads, no failed API, no console error | final=/admin/inventory h1="Inventory" | PASS | shots\T1-admin_inventory.png | - |
| T1 | Open "Warehouses" (/admin/warehouses) | Page loads, no failed API, no console error | final=/admin/warehouses h1="Warehouses" | PASS | shots\T1-admin_warehouses.png | - |
| T1 | Open "Purchases" (/admin/purchases) | Page loads, no failed API, no console error | final=/admin/purchases h1="Purchases" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/organization/theme' from origin 'https://crm-sa ;… | PASS (on retry) | shots\T1-admin_purchases.png | - |
| T1 | Open "Purchase Returns" (/admin/purchase-returns) | Page loads, no failed API, no console error | final=/admin/purchase-returns h1="Purchase Returns" | PASS | shots\T1-admin_purchase_returns.png | - |
| T1 | Open "Orders" (/admin/orders) | Page loads, no failed API, no console error | final=/admin/orders h1="Orders" | PASS | shots\T1-admin_orders.png | - |
| T1 | Open "Sales Returns" (/admin/sales-returns) | Page loads, no failed API, no console error | final=/admin/sales-returns h1="Sales Returns" | PASS | shots\T1-admin_sales_returns.png | - |
| T1 | Open "Deliveries" (/admin/deliveries) | Page loads, no failed API, no console error | final=/admin/deliveries h1="Deliveries" | PASS | shots\T1-admin_deliveries.png | - |
| T1 | Open "Sales" (/admin/sales-overview) | Page loads, no failed API, no console error | final=/admin/sales-overview h1="Sales" | PASS | shots\T1-admin_sales_overview.png | - |
| T1 | Open "Vehicle Stock" (/admin/vehicle-stock) | Page loads, no failed API, no console error | final=/admin/vehicle-stock h1="Vehicle Stock" | PASS | shots\T1-admin_vehicle_stock.png | - |
| T1 | Open "Vehicles" (/admin/vehicles) | Page loads, no failed API, no console error | final=/admin/vehicles h1="Vehicles" | PASS | shots\T1-admin_vehicles.png | - |
| T1 | Open "Receivables" (/admin/receivables) | Page loads, no failed API, no console error | final=/admin/receivables h1="Receivables" | PASS | shots\T1-admin_receivables.png | - |
| T1 | Open "Accounts Payable" (/admin/payables) | Page loads, no failed API, no console error | final=/admin/payables h1="Accounts Payable" | PASS | shots\T1-admin_payables.png | - |
| T1 | Open "Supplier Payments" (/admin/supplier-payments) | Page loads, no failed API, no console error | final=/admin/supplier-payments h1="Supplier Payments" | PASS | shots\T1-admin_supplier_payments.png | - |
| T1 | Open "Collection Reconciliation" (/admin/collections) | Page loads, no failed API, no console error | final=/admin/collections h1="Collection Reconciliation" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/deliveries/partners' from origi… | PASS (on retry) | shots\T1-admin_collections.png | - |
| T1 | Open "Day-End Approvals" (/admin/day-end-approvals) | Page loads, no failed API, no console error | final=/admin/day-end-approvals h1="Day-End Approvals" | PASS | shots\T1-admin_day_end_approvals.png | - |
| T1 | Open "Expenses" (/admin/expenses) | Page loads, no failed API, no console error | final=/admin/expenses h1="Expenses" | PASS | shots\T1-admin_expenses.png | - |
| T1 | Open "Reports" (/admin/reports) | Page loads, no failed API, no console error | final=/admin/reports h1="Reports" | PASS | shots\T1-admin_reports.png | - |
| T1 | Open "Profit and Loss Sheet" (/admin/reports?report=profit-loss) | Page loads, no failed API, no console error | final=/admin/reports?report=profit-loss h1="Reports" | PASS | shots\T1-admin_reports_report_profit_loss.png | - |
| T1 | Open "Cash Flow Sheet" (/admin/reports?report=cash-flow-sheet) | Page loads, no failed API, no console error | final=/admin/reports?report=cash-flow-sheet h1="Reports" | PASS | shots\T1-admin_reports_report_cash_flow_sheet.png | - |
| T1 | Open "GST Filing Sheet" (/admin/reports?report=gst-summary) | Page loads, no failed API, no console error | final=/admin/reports?report=gst-summary h1="Reports" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/brands' from origin 'https://crm-s… | PASS (on retry) | shots\T1-admin_reports_report_gst_summary.png | - |
| T1 | Open "Sales Invoices" (/admin/invoices) | Page loads, no failed API, no console error | final=/admin/invoices h1="Sales Invoices" | PASS | shots\T1-admin_invoices.png | - |
| T1 | Open "Supplier Invoices" (/admin/supplier-invoices) | Page loads, no failed API, no console error | final=/admin/supplier-invoices h1="Supplier Invoices" | PASS | shots\T1-admin_supplier_invoices.png | - |
| T1 | Open "Company Settings" (/admin/company-settings) | Page loads, no failed API, no console error | final=/admin/company-settings h1="Company Settings" | PASS | shots\T1-admin_company_settings.png | - |
| T1 | Open "Audit Log" (/admin/audit-logs) | Page loads, no failed API, no console error | final=/admin/audit-logs h1="Audit Log" | PASS | shots\T1-admin_audit_logs.png | - |
| T1 | Open "My Profile" (/profile) | Page loads, no failed API, no console error | final=/profile h1="My Profile" | PASS | shots\T1-profile.png | - |
| T1 | Open "Staff" (/admin/users) | Page loads, no failed API, no console error | final=/admin/users h1="Staff" | PASS | shots\T1-admin_users.png | - |
| T1 | Open "Attendance" (/admin/attendance) | Page loads, no failed API, no console error | final=/admin/attendance h1="Attendance" | PASS | shots\T1-admin_attendance.png | - |
| T1 | Open "Leaves" (/admin/leaves) | Page loads, no failed API, no console error | final=/admin/leaves h1="Leaves" | PASS | shots\T1-admin_leaves.png | - |
| T1 | Open "Roles & Permissions" (/admin/roles) | Page loads, no failed API, no console error | final=/admin/roles h1="Roles & Permissions" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/auth/me' from origin 'https://crm-saas.asyn… | PASS (on retry) | shots\T1-admin_roles.png | - |
| T1 | Open "Objects & Fields Settings" (/admin/object-fields) | Page loads, no failed API, no console error | final=/admin/object-fields h1="Objects & Fields Settings" | PASS | shots\T1-admin_object_fields.png | - |
| T1 | Open "Invoice Changes" (/admin/invoices/settings) | Page loads, no failed API, no console error | final=/admin/invoices/settings h1="Invoice Changes" | PASS | shots\T1-admin_invoices_settings.png | - |
| T1 | Open "Appearance & Branding" (/admin/theme-settings) | Page loads, no failed API, no console error | final=/admin/theme-settings h1="Appearance & Branding" | PASS | shots\T1-admin_theme_settings.png | - |
| T1 | Open "Terms & Conditions" (/admin/settings/terms) | Page loads, no failed API, no console error | final=/admin/settings/terms h1="Terms & Conditions" | PASS | shots\T1-admin_settings_terms.png | - |
| T1 | Open "Privacy Policy" (/admin/settings/privacy) | Page loads, no failed API, no console error | final=/admin/settings/privacy h1="Privacy Policy" | PASS | shots\T1-admin_settings_privacy.png | - |
| T1 | Open "Help & FAQ" (/admin/settings/help) | Page loads, no failed API, no console error | final=/admin/settings/help h1="Help & FAQ" | PASS | shots\T1-admin_settings_help.png | - |
| T1 | Open "View All Policies" (/admin/settings/policies) | Page loads, no failed API, no console error | final=/admin/settings/policies h1="View All Policies" | PASS | shots\T1-admin_settings_policies.png | - |
| T2 | Read green card on default load | Shows TODAY sales | Card text: "TODAY’S SALES ₹ 0 Received ₹ 0 Pending ₹ 0 Orders 0 Delivered 0 Pending 0 View Sales". Filter line: "Showing: This Month. Select filters, then press Apply." | PASS | shots\T2-green-card-default.png | - |
| T2 | Period = Last Month, Apply | Green card must NOT change (client: always TODAY sales only) | Card before: "TODAY’S SALES ₹ 0 Received ₹ 0 Pending ₹ 0 Orders 0 Delivered 0 Pending 0 View Sales" \| after: "SELECTED PERIOD SALES ₹ 47,821 Applied filters Across the whole organization - no company, warehouse, customer or supplier filter applied. Period Last Month View Sales" \| changed=true. Filter line: "Showing: Last Month. Select filters, then press Apply.". API: /dashboard/admin?date_from=2026-10-01&date_to=2026-10-31 -> 200 | FAIL | shots\T2-green-card-last-month.png | - |
| T3 | Fill supplier form + Save Supplier | Success message, supplier saved | Saved: drawer closed and SUP-0008 appears in list, but NO success message was seen (screenshot T3-03). Code check: SupplierList.jsx only calls showToast for errors (:273, :355), never after a successful save. | FAIL | shotsT3-03-after-save-a1.png | - |
| T3 | Supplier appears in list | Row with the QA-TEST name | Found in list after search | PASS | shots\T3-04-list-search.png | - |
| T3 | Open detail, compare every entered field | All entered values visible on detail | Not shown on detail (Overview + Documents/Notes tabs): Company Name: MISSING ("QA-TEST Traders QA-TEST-1411-1436"). API GET /suppliers/{id}: company_name="QA-TEST Traders QA-TEST-1411-1436", notes="QA-TEST QA-TEST-1411-1436 supplier notes", city="Pune" | FAIL | shots\T3-05-detail.png | - |
| T3 | Console errors during T3 | none | Failed to load resource: the server responded with a status of 403 () | PASS | - | - |
| T4 | Fill all tabs + Add Product | Success message, product saved | Saved (PRD-0005): form closed, product in list and detail. NO success message seen: toast watcher recorded nothing during the save; image upload POST /files/upload -> 201. Fields NOT shown on the form (hidden by org field settings): Barcode, GST/VAT Rate. | FAIL | shotsT4-13-after-save-a1.png | - |
| T4 | Product appears in list | Row with QA-TEST name | Found after search | PASS | shots\T4-14-list.png | - |
| T4 | Open detail, compare entered fields | All entered values visible on detail | Not shown on detail: purchase 100. (GST/VAT Rate was not on the form - hidden by org field settings - so not entered; detail shows GST 0%.) Detail URL /admin/products/e2f52362-8ff8-4637-b30e-c6d2d6f79364 | FAIL | shots\T4-15-detail.png | - |
| T5 | Fill tabs + 2 variants + Add Product | Success message, product saved with Red/Blue variants | Saved. Toast: "none seen". banner: "none" | FAIL | shots\T5-07-after-save-a1.png | - |
| T5 | Variant product appears in list | Row with QA-TEST name | Found after search | PASS | shots\T5-08-list.png | - |
| T5 | Open detail, compare variants | Red + Blue variants with SKU/stock/prices visible | Both variants, SKUs, selling prices and attribute Color visible | PASS | shots\T5-09-detail.png | - |
| T5 | Validation repro: variant saved without selling price (nothing saved) | Clear message on the variant row / field highlighted | Banner only: "Can't save yet — 1 field needs attention on the "Variants & Attributes" tab.". Exact variant message ("...enter a selling price") visible on screen: NO. Red-bordered fields: 1. Product write requests sent: 0. | FAIL | shotsT5b-02-after-click-add-product.png | - |
| T5 | Variant name input visible/usable in Variant List | Variant name box readable | Name input collapses to a ~20px pill next to the image icon (typed "Red" is not readable); SKU box is truncated to ~12 chars (w-28). | FAIL | shotsT5b-01-variant-no-selling-price.png | - |
| T6 | Inventory: Product A stock BEFORE purchase | Row for Product A (opening stock 0) | QA-TEST Product A QA-TEST-1411-1436 QA-TEST-1411-1436-A 0 0 Out of Stock | PASS | shots\T6-01-before-inventory.png | - |
| T6 | Create purchase: Product A qty 10 x 100, invoice QA-TEST-INV-1 | Totals 1000, saved as Draft, success message | Form totals: Subtotal ₹ 1,000 Item Discount - ₹ 0 Extra Discount - ₹ 0 Tax ₹ 0 Grand Total ₹ 1,000. Redirected to /admin/purchases/605c071b-7a7d-413d-83b3-80a1cc6d1f42. Row text: "QA-TEST-1411-1436-A Piece ₹ 1,000". Purchase Type chosen: Purchase Order, warehouse Main Warehouse, date 2026-11-14. Success message seen: NONE (only loader text: "Loading... \|\| Loading purchase...") | FAIL | shots\T6-04-after-create.png | - |
| T6 | Purchase detail vs entered | Supplier, invoice no, totals 1,000, Draft, Not Received | All match. Purchase # PO-10001-2026-0012 | PASS | shots\T6-05-detail-draft.png | - |
| T6 | Purchase appears in list | Row PO + QA-TEST-INV-1 | Found | PASS | shots\T6-06-list.png | - |
| T6 | Confirm Purchase | Status Confirmed, toast, prompt to receive goods, stock still 0 (no stock on confirm) | Toast: "Purchase confirmed This purchase is now Confirmed.". Prompt shown: true. Status now: Confirmed. Product A inventory row: "QA-TEST Product A QA-TEST-1411-1436 QA-TEST-1411-1436-A 0 0 Out of Stock" | PASS | shots\T6-08-after-confirm-inventory.png | - |
| T6 | Save Draft GRN (received 10) | Draft GRN created, toast, stock unchanged | Toast: "GRN # Receipt Date Warehouse Accepted Qty Damaged Qty Rejected Qty Received By Status Action Loading goods receipts... \|\| Goods receipt saved as Draft Confirm it to receive the goods into the warehouse." | PASS | shots\T6-11-grn-draft-saved.png | - |
| T6 | Product A stock after DRAFT GRN | Still 0 (draft must not add stock) | QA-TEST Product A QA-TEST-1411-1436 QA-TEST-1411-1436-A 0 0 Out of Stock | PASS | shots\T6-12-after-draft-grn-inventory.png | - |
| T6 | Confirm GRN (10 accepted) | GRN Confirmed, purchase Fully Received, Product A stock = 10 | Toast: "GRN # Receipt Date Warehouse Accepted Qty Damaged Qty Rejected Qty Received By Status Action Loading goods receipts... \|\| Goods receipt confirmed. Warehouse inventory updated. GRN-10001-2026-1021 accepted quantity has been added to stock.". GRN status text: Confirmed. Purchase receiving card: Fully Received. Product A inventory row: "QA-TEST Product A QA-TEST-1411-1436 QA-TEST-1411-1436-A 0 10 In Stock" | PASS | shots\T6-17-after-grn-confirm-inventory.png | - |
| T7 | Create return qty 2 from T6 purchase | Form shows Received 10 / Already Returned 0 / Returnable 10; draft created with success message | Table before: "Product Received Already Returned Returnable Return Qty QA-TEST Product A QA-TEST-1411-1436 10 0 10 ". Success message: NONE (only loader text seen). Landed on /admin/purchase-returns/296ac53b-bb2a-423e-aeba-bba7750040e1 | FAIL | shots\T7-03-after-create.png | - |
| T7 | Draft return state | Status Draft, stock unchanged (10) | Badges before: [Draft] after: [Draft]. Toast: "none seen". Product A inventory (variants / stock / status): "0 10 In Stock" | PASS | shots\T7-04-draft.png | - |
| T7 | Action: confirm | Status moves forward; stock check after confirm | Badges before: [Draft] after: [Confirmed]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock" | FAIL | shots\T7-05-confirm.png | - |
| T7 | Action: dispatch | Status moves forward; stock check after dispatch | Badges before: [Confirmed] after: [Dispatched]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock" | FAIL | shots\T7-06-dispatch.png | - |
| T7 | Action: complete | Status moves forward; stock check after complete | Badges before: [Dispatched] after: [Completed]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock" | FAIL | shots\T7-07-complete.png | - |
| T7 | New-return form for same purchase AFTER completed return (qty 2) | Received 10, Already Returned 2, Returnable 8 | Table: "Product Received Already Returned Returnable Return Qty QA-TEST Product A QA-TEST-1411-1436 10 2 8 " | PASS | shots\T7-08-return-form-after-complete.png | - |
| T7 | Purchase detail Items table after return | Ordered 10, Received 10, returned 2 shown somewhere | Items table: "" | INFO | shots\T7-09-purchase-items.png | - |
| T7 | Purchase Returns list row | Our return listed as Completed | First Completed row: "PR-10001-2026-0004 QA-TEST supplier QA-TEST-1411-1436 PO-10001-2026-0012 1 2 14 Nov 2026 Completed" | PASS | shots\T7-10-returns-list.png | - |
| T8 | Add Expense button position | Visible, sensible place (top-right of table header) | Button at x=1262, y=297, 131x36 on a 1440x900 viewport (right edge 1393px) | INFO | shots\T8-01-expenses-list-add-button.png | - |
| T8 | Add expense "QA-TEST expense" amount 1 | Saved, success message | Saved as EXP-10001-2026-1030 (Approved, amount 1). Success toast NOT observed: 6s after clicking Add the modal button was still spinning (screenshot T8-03), so the script read toasts before the backend answered - POST /expenses is slow. Code does call showToast("Expense added") after a successful create (AdminExpenses.jsx ~:232), so this is a slow-backend observation, not a missing message. | PASS | shots\T8-03-after-save-a1.png | - |
| T8 | Expense appears in list with amount 1 | Row with description, ₹1, category | Row: "EXP-10001-2026-1030 Petrol/Diesel QA-TEST expense QA-TEST-1411-1436 Rahul Sharma 14 Nov 2026 ₹ 1 Approved " | PASS | shots\T8-04-list-search.png | - |
| T8 | Open expense detail, compare | Category, amount, date, description match | Matches. Detail: "Expense Expense # EXP-10001-2026-1030 Status Approved Category Petrol/Diesel Amount ₹ 1 Expense Date 14 Nov 2026 Payment Mode Cash Submitted By Rahul Sharma Submitted On 14 Nov 2026 Description QA-TEST expense QA-TEST-1411-1436 Proof No receipt Reimburse HISTORY Submitted by Rahul Sharma 14 Nov 2026" | PASS | shots\T8-05-detail.png | - |
| T9 | Open Vehicle Stock page | Page loads with stock or a clean empty state, no errors | Header/text: "Overview CRM ERP Sales & Delivery Management Finance Management Invoice Management Administration Employee Management Settings Vehicle Stock Rahul Sharma Admin Vehicle Stock Stock currently loaded on delivery vehicles. Active session MH02CJ0584 Truck · Driver: delivery Last loaded: 06 Oct 2026 · 5:30 AM Products On Vehicle 6 products with available stock Loaded Units 135 openin" | PASS | shots\T9-01-vehicle-stock.png | - |
| T9 | Vehicle Stock table: SKU / Variant and UOM columns | SKU/variant and UOM filled for each product | Every row (6 of 6) shows "—" in both columns. API GET /vehicle-stock items only contain: id, product_id, variant_id, product_name, loaded_qty, extra_qty, returned_qty, delivered_qty, remaining_qty, expected_closing_qty - no sku, no uom, no variant name. One line is named just "Electronics" (a product_name of that value in the data). | FAIL | shotsT9-01-vehicle-stock.png | - |
| T10 | Pages where a date field is the plain browser calendar (live check, read-only) | Custom DatePicker everywhere (consistent look) | Purchase - Create [/admin/purchases/create]: Purchase Date \|\| Purchase Return - New [/admin/purchase-returns/new]: Return Date \|\| Supplier Invoice - New [/admin/supplier-invoices/new]: Invoice Date, Due Date \|\| Quotation - New [/admin/quotations/new]: Quotation Date, Valid Until \|\| Sales Return - New [/admin/sales-returns/new]: Return Date \|\| Expenses - Add modal [/admin/expenses (Add Expense modal)]: Expense Date \|\| ALSO native date inputs in code (modals/drawers not opened live): Customer form (Customer Since, Date of Birth, Anniversary), CustomerDetail, Collect Payment drawer, … | FAIL | shots\T10-expense-modal-native-date.png | - |

## Every FAIL: Backend / Frontend / Data / Environment

### T2 - Period = Last Month, Apply
- **Class:** Frontend (client rule violated by design: card switches to "Selected Period Sales")
- **Evidence:** Card before: "TODAY’S SALES ₹ 0 Received ₹ 0 Pending ₹ 0 Orders 0 Delivered 0 Pending 0 View Sales" \| after: "SELECTED PERIOD SALES ₹ 47,821 Applied filters Across the whole organization - no company, warehouse, customer or supplier filter applied. Period Last Month View Sales" \| changed=true. Filter line: "Showing: Last Month. Select filters, then press Apply.". API: /dashboard/admin?date_from=2026-10-01&date_to=2026-10-31 -> 200
- **Cause / file + line:** src/features/dashboard/AdminDashboard.jsx:809 scopedSales, :987 salesAmount={scopedSales ? periodSales : todaysSalesAmount}, label switch in FeaturedSalesCard :331
- **Screenshot:** shots\T2-green-card-last-month.png

### T3 - Fill supplier form + Save Supplier
- **Class:** Frontend
- **Evidence:** Saved: drawer closed and SUP-0008 appears in list, but NO success message was seen (screenshot T3-03). Code check: SupplierList.jsx only calls showToast for errors (:273, :355), never after a successful save.
- **Cause / file + line:** src/features/suppliers/SupplierList.jsx save handler (~:340-362) shows no success toast; only error toasts exist (:273, :355).
- **Screenshot:** shotsT3-03-after-save-a1.png

### T3 - Open detail, compare every entered field
- **Class:** Frontend
- **Evidence:** Not shown on detail (Overview + Documents/Notes tabs): Company Name: MISSING ("QA-TEST Traders QA-TEST-1411-1436"). API GET /suppliers/{id}: company_name="QA-TEST Traders QA-TEST-1411-1436", notes="QA-TEST QA-TEST-1411-1436 supplier notes", city="Pune"
- **Cause / file + line:** API returns company_name correctly, but src/features/suppliers/SupplierDetail.jsx never renders companyName (only notes at :1148). Data is saved and mapped (supplierUtils.js:64) - just not displayed.
- **Screenshot:** shots\T3-05-detail.png

### T4 - Fill all tabs + Add Product
- **Class:** Frontend
- **Evidence:** Saved (PRD-0005): form closed, product in list and detail. NO success message seen: toast watcher recorded nothing during the save; image upload POST /files/upload -> 201. Fields NOT shown on the form (hidden by org field settings): Barcode, GST/VAT Rate.
- **Cause / file + line:** src/features/products/ProductList.jsx:275 handleSaveProduct - no showToast/success message at all (file has zero toast usage).
- **Screenshot:** shotsT4-13-after-save-a1.png

### T4 - Open detail, compare entered fields
- **Class:** Frontend (minor / maybe by design)
- **Evidence:** Not shown on detail: purchase 100. (GST/VAT Rate was not on the form - hidden by org field settings - so not entered; detail shows GST 0%.) Detail URL /admin/products/e2f52362-8ff8-4637-b30e-c6d2d6f79364
- **Cause / file + line:** Product detail (src/features/products/ProductDetail.jsx) Pricing block lists MRP, Wholesale, Dealer, Discount and Selling Price but never the Purchase Price (100) that was entered; only Avg. Margin 33% hints at it. GST: not entered (field hidden by org Object Field Settings), so GST 0% is expected - not a bug.
- **Screenshot:** shots\T4-15-detail.png

### T5 - Fill tabs + 2 variants + Add Product
- **Class:** Frontend
- **Evidence:** Saved. Toast: "none seen". banner: "none"
- **Cause / file + line:** src/features/products/ProductList.jsx:275 handleSaveProduct - no success message
- **Screenshot:** shots\T5-07-after-save-a1.png

### T5 - Validation repro: variant saved without selling price (nothing saved)
- **Class:** Frontend
- **Evidence:** Banner only: "Can't save yet — 1 field needs attention on the "Variants & Attributes" tab.". Exact variant message ("...enter a selling price") visible on screen: NO. Red-bordered fields: 1. Product write requests sent: 0.
- **Cause / file + line:** src/features/products/ProductForm.jsx - validate() puts every variant problem into nextErrors.variants (:725 no variants, :729 "Every variant needs a name.", :730 "enter a selling price.", :734 "enter valid pricing"), banner built at :852-854 only counts it ("1 field needs attention on the Variants & Attributes tab"), but NOTHING renders errors.variants (grep finds no usage; the field renderer for input "variants" :1288-1420 has no error output and no red border). So the real message is never shown and no field is highlighted.
- **Screenshot:** shotsT5b-02-after-click-add-product.png

### T5 - Variant name input visible/usable in Variant List
- **Class:** Frontend
- **Evidence:** Name input collapses to a ~20px pill next to the image icon (typed "Red" is not readable); SKU box is truncated to ~12 chars (w-28).
- **Cause / file + line:** src/features/products/ProductForm.jsx:1342-1388 - name <input className="h-9 w-full min-w-0"> sits in a flex row (gap-3) inside a td with no min-width, so it shrinks to nothing; SKU input fixed w-28 at :1396.
- **Screenshot:** shotsT5b-01-variant-no-selling-price.png

### T6 - Create purchase: Product A qty 10 x 100, invoice QA-TEST-INV-1
- **Class:** Frontend
- **Evidence:** Form totals: Subtotal ₹ 1,000 Item Discount - ₹ 0 Extra Discount - ₹ 0 Tax ₹ 0 Grand Total ₹ 1,000. Redirected to /admin/purchases/605c071b-7a7d-413d-83b3-80a1cc6d1f42. Row text: "QA-TEST-1411-1436-A Piece ₹ 1,000". Purchase Type chosen: Purchase Order, warehouse Main Warehouse, date 2026-11-14. Success message seen: NONE (only loader text: "Loading... \|\| Loading purchase...")
- **Cause / file + line:** src/features/purchases/PurchaseInvoiceForm.jsx - the only showToast call is "Product already added" (:269); a successful Create Purchase just navigates to the detail page with no success message.
- **Screenshot:** shots\T6-04-after-create.png

### T7 - Create return qty 2 from T6 purchase
- **Class:** Frontend
- **Evidence:** Table before: "Product Received Already Returned Returnable Return Qty QA-TEST Product A QA-TEST-1411-1436 10 0 10 ". Success message: NONE (only loader text seen). Landed on /admin/purchase-returns/296ac53b-bb2a-423e-aeba-bba7750040e1
- **Cause / file + line:** src/features/purchaseReturns/PurchaseReturnFormPage.jsx - no showToast usage at all (file has zero toast calls); create just navigates.
- **Screenshot:** shots\T7-03-after-create.png

### T7 - Action: confirm
- **Class:** Frontend
- **Evidence:** Badges before: [Draft] after: [Confirmed]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock"
- **Cause / file + line:** src/features/purchaseReturns/PurchaseReturnDetail.jsx - runRealAction (:120) only sets errors; there is no showToast anywhere in the purchase-returns module (0 calls in Detail, Form, List).
- **Screenshot:** shots\T7-05-confirm.png

### T7 - Action: dispatch
- **Class:** Frontend
- **Evidence:** Badges before: [Confirmed] after: [Dispatched]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock"
- **Cause / file + line:** src/features/purchaseReturns/PurchaseReturnDetail.jsx - runRealAction (:120) only sets errors; there is no showToast anywhere in the purchase-returns module (0 calls in Detail, Form, List).
- **Screenshot:** shots\T7-06-dispatch.png

### T7 - Action: complete
- **Class:** Frontend
- **Evidence:** Badges before: [Dispatched] after: [Completed]. Success message: NONE (the only status text seen was the page loader "Loading purchase return..."). Product A inventory (variants / stock / status): "0 8 In Stock"
- **Cause / file + line:** src/features/purchaseReturns/PurchaseReturnDetail.jsx - runRealAction (:120) only sets errors; there is no showToast anywhere in the purchase-returns module (0 calls in Detail, Form, List).
- **Screenshot:** shots\T7-07-complete.png

### T9 - Vehicle Stock table: SKU / Variant and UOM columns
- **Class:** Backend (response lacks sku/uom/variant name); Frontend does not enrich
- **Evidence:** Every row (6 of 6) shows "—" in both columns. API GET /vehicle-stock items only contain: id, product_id, variant_id, product_name, loaded_qty, extra_qty, returned_qty, delivered_qty, remaining_qty, expected_closing_qty - no sku, no uom, no variant name. One line is named just "Electronics" (a product_name of that value in the data).
- **Cause / file + line:** GET /vehicle-stock items have no sku/uom fields. UI table renders them blank. Fix either in backend response or by looking up product sku/uom from product_id in the vehicle stock page.
- **Screenshot:** shotsT9-01-vehicle-stock.png

### T10 - Pages where a date field is the plain browser calendar (live check, read-only)
- **Class:** Frontend
- **Evidence:** Purchase - Create [/admin/purchases/create]: Purchase Date \|\| Purchase Return - New [/admin/purchase-returns/new]: Return Date \|\| Supplier Invoice - New [/admin/supplier-invoices/new]: Invoice Date, Due Date \|\| Quotation - New [/admin/quotations/new]: Quotation Date, Valid Until \|\| Sales Return - New [/admin/sales-returns/new]: Return Date \|\| Expenses - Add modal [/admin/expenses (Add Expense modal)]: Expense Date \|\| ALSO native date inputs in code (modals/drawers not opened live): Customer form (Customer Since, Date of Birth, Anniversary), CustomerDetail, Collect Payment drawer, Record Payment drawers (invoices, supplier payments, payments), GRN modal (Receipt Date, Expiry Date…
- **Cause / file + line:** src/components/ui/Input.jsx has NO date handling - every <Input type="date"> renders a native <input type="date"> (browser calendar). Only src/components/ui/DatePicker.jsx is the custom calendar, and it is used just in DateRangeFilter, AdminDashboard, CreateSalesOrder, SalesOverview, FinancialReports, CashReconciliation, CustomerDetail, customers/RecordPaymentDrawer, PlatformSupportTickets.
- **Screenshot:** shots\T10-expense-modal-native-date.png

## Other observations (not counted as FAIL)

- **Stock moves at Confirm, not at Dispatch (T7):** Product A stock went 10 -> 8 when the purchase return was *Confirmed*; Dispatch and Complete left it at 8. Check with the business whether goods should leave stock at Dispatch.
- **"Return Items" button is visible on a purchase that has received nothing** (purchase detail right after Confirm, before the GRN).
- **Purchase Return form column is called "Already Returned"**, not "Previously Returned".
- **Product form:** "Product Code / SKU" shows no red asterisk although validation (ProductForm.jsx:713) requires it. Barcode and GST/VAT Rate were not on the form at all (hidden by this org's Object Field Settings), so GST could not be entered and the detail shows GST 0%.
- **GRN modal SKU column** shows "—" for Product A (SKU not passed to the receive table).
- **Slow writes:** POST /expenses was still running 6s after the click (T8 screenshot T8-03); creating other records also took several seconds. Success toasts live only 3.5s (components/ui/Toast.jsx), so a slow save can make the toast easy to miss.
- **Purchase Type** list: first option is "Purchase Order" (default selection in the form is "Direct Purchase"); the test used "Purchase Order" because the script picks the first option.
- **T1 noise:** 4 of 44 pages logged a CORS / ERR_FAILED console error on the first pass (organization/theme, deliveries/partners, brands, auth/me). All four were clean on retry - intermittent backend/network (responses without CORS headers). Also every login logs `403 GET /login` from the hosting layer; it is ignored in the table.
- **Not opened on purpose:** Billing / Subscription / Plan / Razorpay pages (the Plans menu item was skipped). SUPERADMIN: logged in, looked at the sidebar, session cleared - nothing else.

## QA-TEST records created (all kept, nothing deleted or cancelled)

| Kind | Name / reference | Notes |
|---|---|---|
| Supplier | QA-TEST supplier QA-TEST-1411-1436 | SUP-0008, Manufacturer, Pune |
| Product | QA-TEST Product A QA-TEST-1411-1436 | PRD-0005, no variants, Piece, selling 150, opening stock 0 (now 8 after purchase + return) |
| Product (variants) | QA-TEST Product B QA-TEST-1411-1436 | PRD-0006, variants Red + Blue, SKUs ...-B-RED / ...-B-BLUE, stock 5 + 7 |
| Purchase | QA-TEST-INV-1 | PO-10001-2026-0012, supplier QA-TEST supplier, Product A qty 10 x 100 = 1,000, Confirmed + Fully Received |
| GRN (draft) | PO-10001-2026-0012 | GRN-10001-2026-1021, 10 accepted, Confirmed (added 10 to Product A stock) |
| Purchase Return | QA-TEST-1411-1436 qty 2 | PR-10001-2026-0004, qty 2, Draft -> Confirmed -> Dispatched -> Completed |
| Expense | QA-TEST expense QA-TEST-1411-1436 | EXP-10001-2026-1030, amount 1, Petrol/Diesel, auto-Approved |

Also left behind: a few extra `qa-test-image.png` files uploaded through POST /files/upload during failed form attempts in T4/T5 (the form crashed in my script *before* saving, so no duplicate products/suppliers exist, but the uploaded files are orphaned and cannot be removed from the UI).

## Rules followed

- Only files inside `qa-tests\` were created/edited. No git commands, no npm in the repo root. Source code was only read.
- `npx playwright install chromium` was skipped: the bundled Chromium is blocked by Windows Application Control on this PC, so installed Chrome is used instead (also saves ~2 GB).
- Credentials were read from `.env.qa.local` in memory only; a scan confirmed no password value appears in results, state or this report.
