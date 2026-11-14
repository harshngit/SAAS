# QA Retest Report - 2026-11-14

Target: **local dev server http://localhost:5173** (Vite, started by the tester with `npm run dev`) against the **live backend**. Run stamp for every record created: `QA-TEST-1411-2012`. Account used: ADMIN (all tests that ran). Browser: installed Google Chrome via Playwright (headless:false, slowMo:250). Screenshots: `shots\` in this folder.

**Totals:** 82 PASS, 3 FAIL, 2 BLOCKED, 1 INFO rows.

> **R9 and R10 could not be run.** From the start of R10 the live backend's `POST /auth/login` hung (no answer for 20s+; checked repeatedly for ~25 minutes; `GET /docs` 200 and `POST /auth/refresh` 401 answered in 0.5s). Without a login neither the Delivery-role check nor the simulated network-failure checks can run. `r10.js` is written and ready.

## Summary per test

| Test | Result |
|---|---|
| R1 | Smoke of 44 admin sidebar pages - all load; 4 pages logged live-backend CORS/ERR_FAILED on pass 1, 3 clean on retry, Audit Log failed again (different endpoint each time = backend intermittent). |
| R2 | PASS - card stays "TODAY'S SALES" and identical after Period=Last Month and after a Customer filter; numbers equal today_overall. |
| R3 | PASS - real "selling price" message, only the Blue price field red, name box 156px, SKU asterisk, success toast after fixing. |
| R4 | PASS - toasts on Supplier, Product, Purchase, Purchase Return create + Confirm + Dispatch + Complete. |
| R5 | PASS - Company Name on SupplierDetail, Purchase Price (₹100) on ProductDetail. |
| R6 | Custom calendar opens everywhere tested and saved dates are right on Purchase, Purchase Return, Expense, Quotation. FAIL on Supplier Invoice: backend stores invoice_date=today instead of the picked date (frontend sends the right value). |
| R7 | PASS - "Return Items" hidden on draft, on confirmed-without-GRN and with only a draft GRN; visible after GRN confirm. |
| R8 | PASS - both tables, search, status filter, pagination, sort, Export (6 rows = total), detail with SKU/UOM, "Loaded on 06 Oct". (Console row FAIL = backend CORS blip.) |
| R9 | BLOCKED - backend login down. |
| R10 | BLOCKED (active simulations) + passive evidence: no JS errors, no logout during R1-R8. |

## Results

| Test | What was done | Expected | Actual | PASS/FAIL | Screenshot | Failed API (URL + status) |
|---|---|---|---|---|---|---|
| R1 | Login ADMIN on local dev server | Login works + sidebar visible | OK -> /admin/dashboard. 46 sidebar links | PASS | shots\R1-login.png | - |
| R1 | Open "Dashboard" (/admin/dashboard) | Page loads, no failed API, no console error | final=/admin/dashboard h1="Dashboard" | PASS | shots\R1-admin_dashboard.png | - |
| R1 | Open "Leads" (/admin/leads) | Page loads, no failed API, no console error | final=/admin/leads h1="Leads" | PASS | shots\R1-admin_leads.png | - |
| R1 | Open "Quotations" (/admin/quotations) | Page loads, no failed API, no console error | final=/admin/quotations h1="Quotations" | PASS | shots\R1-admin_quotations.png | - |
| R1 | Open "Customers" (/admin/customers) | Page loads, no failed API, no console error | final=/admin/customers h1="Customers" | PASS | shots\R1-admin_customers.png | - |
| R1 | Open "Brands" (/admin/brands) | Page loads, no failed API, no console error | final=/admin/brands h1="Brands" | PASS | shots\R1-admin_brands.png | - |
| R1 | Open "Categories" (/admin/categories) | Page loads, no failed API, no console error | final=/admin/categories h1="Categories" | PASS | shots\R1-admin_categories.png | - |
| R1 | Open "Products" (/admin/products) | Page loads, no failed API, no console error | final=/admin/products h1="Products" | PASS | shots\R1-admin_products.png | - |
| R1 | Open "Suppliers" (/admin/suppliers) | Page loads, no failed API, no console error | final=/admin/suppliers h1="Suppliers" | PASS | shots\R1-admin_suppliers.png | - |
| R1 | Open "Inventory" (/admin/inventory) | Page loads, no failed API, no console error | final=/admin/inventory h1="Inventory" | PASS | shots\R1-admin_inventory.png | - |
| R1 | Open "Warehouses" (/admin/warehouses) | Page loads, no failed API, no console error | final=/admin/warehouses h1="Warehouses" | PASS | shots\R1-admin_warehouses.png | - |
| R1 | Open "Purchases" (/admin/purchases) | Page loads, no failed API, no console error | final=/admin/purchases h1="Purchases" | PASS | shots\R1-admin_purchases.png | - |
| R1 | Open "Purchase Returns" (/admin/purchase-returns) | Page loads, no failed API, no console error | final=/admin/purchase-returns h1="Purchase Returns" | PASS | shots\R1-admin_purchase_returns.png | - |
| R1 | Open "Orders" (/admin/orders) | Page loads, no failed API, no console error | final=/admin/orders h1="Orders" | PASS | shots\R1-admin_orders.png | - |
| R1 | Open "Sales Returns" (/admin/sales-returns) | Page loads, no failed API, no console error | final=/admin/sales-returns h1="Sales Returns" | PASS | shots\R1-admin_sales_returns.png | - |
| R1 | Open "Deliveries" (/admin/deliveries) | Page loads, no failed API, no console error | final=/admin/deliveries h1="Deliveries" | PASS | shots\R1-admin_deliveries.png | - |
| R1 | Open "Sales" (/admin/sales-overview) | Page loads, no failed API, no console error | Retry clean (h1="Sales"). First pass: final=/admin/sales-overview h1="Sales" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/organizati… | PASS | shots\R1-admin_sales_overview-retry.png | - |
| R1 | Open "Vehicle Stock" (/admin/vehicle-stock) | Page loads, no failed API, no console error | final=/admin/vehicle-stock h1="Vehicle Stock" | PASS | shots\R1-admin_vehicle_stock.png | - |
| R1 | Open "Vehicles" (/admin/vehicles) | Page loads, no failed API, no console error | final=/admin/vehicles h1="Vehicles" | PASS | shots\R1-admin_vehicles.png | - |
| R1 | Open "Receivables" (/admin/receivables) | Page loads, no failed API, no console error | final=/admin/receivables h1="Receivables" | PASS | shots\R1-admin_receivables.png | - |
| R1 | Open "Accounts Payable" (/admin/payables) | Page loads, no failed API, no console error | final=/admin/payables h1="Accounts Payable" | PASS | shots\R1-admin_payables.png | - |
| R1 | Open "Supplier Payments" (/admin/supplier-payments) | Page loads, no failed API, no console error | final=/admin/supplier-payments h1="Supplier Payments" | PASS | shots\R1-admin_supplier_payments.png | - |
| R1 | Open "Collection Reconciliation" (/admin/collections) | Page loads, no failed API, no console error | Retry clean (h1="Collection Reconciliation"). First pass: final=/admin/collections h1="Collection Reconciliation" console: Access to XMLHttpRequest at 'https://crm-saas-… | PASS | shots\R1-admin_collections-retry.png | - |
| R1 | Open "Day-End Approvals" (/admin/day-end-approvals) | Page loads, no failed API, no console error | final=/admin/day-end-approvals h1="Day-End Approvals" | PASS | shots\R1-admin_day_end_approvals.png | - |
| R1 | Open "Expenses" (/admin/expenses) | Page loads, no failed API, no console error | final=/admin/expenses h1="Expenses" | PASS | shots\R1-admin_expenses.png | - |
| R1 | Open "Reports" (/admin/reports) | Page loads, no failed API, no console error | final=/admin/reports h1="Reports" | PASS | shots\R1-admin_reports.png | - |
| R1 | Open "Profit and Loss Sheet" (/admin/reports?report=profit-loss) | Page loads, no failed API, no console error | final=/admin/reports?report=profit-loss h1="Reports" | PASS | shots\R1-admin_reports_report_profit_loss.png | - |
| R1 | Open "Cash Flow Sheet" (/admin/reports?report=cash-flow-sheet) | Page loads, no failed API, no console error | final=/admin/reports?report=cash-flow-sheet h1="Reports" | PASS | shots\R1-admin_reports_report_cash_flow_sheet.png | - |
| R1 | Open "GST Filing Sheet" (/admin/reports?report=gst-summary) | Page loads, no failed API, no console error | final=/admin/reports?report=gst-summary h1="Reports" | PASS | shots\R1-admin_reports_report_gst_summary.png | - |
| R1 | Open "Sales Invoices" (/admin/invoices) | Page loads, no failed API, no console error | final=/admin/invoices h1="Sales Invoices" | PASS | shots\R1-admin_invoices.png | - |
| R1 | Open "Supplier Invoices" (/admin/supplier-invoices) | Page loads, no failed API, no console error | final=/admin/supplier-invoices h1="Supplier Invoices" | PASS | shots\R1-admin_supplier_invoices.png | - |
| R1 | Open "Company Settings" (/admin/company-settings) | Page loads, no failed API, no console error | Retry clean (h1="Company Settings"). First pass: final=/admin/company-settings h1="Company Settings" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmar… | PASS | shots\R1-admin_company_settings-retry.png | - |
| R1 | Open "Audit Log" (/admin/audit-logs) | Page loads, no failed API, no console error | final=/admin/audit-logs h1="Audit Log" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/organizations/overview?activity_limit=100' from … | FAIL | shots\R1-admin_audit_logs.png | - |
| R1 | Open "My Profile" (/profile) | Page loads, no failed API, no console error | final=/profile h1="My Profile" | PASS | shots\R1-profile.png | - |
| R1 | Open "Staff" (/admin/users) | Page loads, no failed API, no console error | final=/admin/users h1="Staff" | PASS | shots\R1-admin_users.png | - |
| R1 | Open "Attendance" (/admin/attendance) | Page loads, no failed API, no console error | final=/admin/attendance h1="Attendance" | PASS | shots\R1-admin_attendance.png | - |
| R1 | Open "Leaves" (/admin/leaves) | Page loads, no failed API, no console error | final=/admin/leaves h1="Leaves" | PASS | shots\R1-admin_leaves.png | - |
| R1 | Open "Roles & Permissions" (/admin/roles) | Page loads, no failed API, no console error | final=/admin/roles h1="Roles & Permissions" | PASS | shots\R1-admin_roles.png | - |
| R1 | Open "Objects & Fields Settings" (/admin/object-fields) | Page loads, no failed API, no console error | final=/admin/object-fields h1="Objects & Fields Settings" | PASS | shots\R1-admin_object_fields.png | - |
| R1 | Open "Invoice Changes" (/admin/invoices/settings) | Page loads, no failed API, no console error | final=/admin/invoices/settings h1="Invoice Changes" | PASS | shots\R1-admin_invoices_settings.png | - |
| R1 | Open "Appearance & Branding" (/admin/theme-settings) | Page loads, no failed API, no console error | final=/admin/theme-settings h1="Appearance & Branding" | PASS | shots\R1-admin_theme_settings.png | - |
| R1 | Open "Terms & Conditions" (/admin/settings/terms) | Page loads, no failed API, no console error | final=/admin/settings/terms h1="Terms & Conditions" | PASS | shots\R1-admin_settings_terms.png | - |
| R1 | Open "Privacy Policy" (/admin/settings/privacy) | Page loads, no failed API, no console error | final=/admin/settings/privacy h1="Privacy Policy" | PASS | shots\R1-admin_settings_privacy.png | - |
| R1 | Open "Help & FAQ" (/admin/settings/help) | Page loads, no failed API, no console error | final=/admin/settings/help h1="Help & FAQ" | PASS | shots\R1-admin_settings_help.png | - |
| R1 | Open "View All Policies" (/admin/settings/policies) | Page loads, no failed API, no console error | final=/admin/settings/policies h1="View All Policies" | PASS | shots\R1-admin_settings_policies.png | - |
| R2 | Default load: card label + numbers vs /dashboard/admin today_overall | Label "TODAY'S SALES"; Sales, Received, Pending amount, Orders, Delivered, Pending count equal today_overall | Card: "TODAY’S SALES ₹ 9,347 Received ₹ 9,197 Pending ₹ 150 Orders 2 Delivered 1 Pending 1 View Sales". today_overall={"date":"2026-11-14","sales":9347,"received":9197,"orders":2,"delivered_orders":1,"pending_orders":1,"pending_amount":150}; card numbers=[9347, 9197, 150, 2, 1, 1]; missing on card: none | PASS | shots\R2-card-default.png | - |
| R2 | Period = Last Month, Apply | Card text identical to default (and /dashboard/admin was re-fetched with the period) | before="TODAY’S SALES ₹ 9,347 Received ₹ 9,197 Pending ₹ 150 Orders 2 Delivered 1 Pending 1 View Sales" after="TODAY’S SALES ₹ 9,347 Received ₹ 9,197 Pending ₹ 150 Orders 2 Delivered 1 Pending 1 View Sales" same=true; re-fetched=true; request=/dashboard/admin?date_from=2026-10-01&date_to=2026-10-31 | PASS | shots\R2-card-last-month.png | - |
| R2 | Customer filter (first customer) + Apply | Card text identical to default; today_overall identical in every response | picked="Sai Kirana" before="TODAY’S SALES ₹ 9,347 Received ₹ 9,197 Pending ₹ 150 Orders 2 Delivered 1 Pending 1 View Sales" after="TODAY’S SALES ₹ 9,347 Received ₹ 9,197 Pending ₹ 150 Orders 2 Delivered 1 Pending 1 View Sales" same=true; re-fetched=true; request=/dashboard/admin?date_from=2026-10-01&date_to=2026-10-31&customer_id=bc41e638-f1ed-46b0-a0f2-234a657f8d86; today_overall identical in all 6 responses=true | PASS | shots\R2-card-customer.png | - |
| R3 | Add Product with Blue variant missing selling price | Save blocked; banner + list show the real "selling price" message; Blue selling price red; tab jumps to Variants | banner="Can't save yet (Variants & Attributes tab) — Variant 2 (Blue): enter a selling price. \| Variant 2 (Blue): enter a selling price."; variant-list alert="Variant 2 (Blue): enter a selling price."; active tab=""; aria-invalid inputs=1 (selling price red=true, wrongly red in Red row=0); POST /products sent=false | PASS | shots\R3-02-blocked-with-message.png | - |
| R3 | Variant name box width | Readable (>= ~120px) | Name input 156px wide; SKU input 160px wide | PASS | shots\R3-02-blocked-with-message.png | - |
| R3 | Product Code / SKU label | Red asterisk on the label | asterisk present=true | PASS | shots\R3-02-blocked-with-message.png | - |
| R3 | Fill Blue selling price and Add Product | Red clears; product saved; success toast | red cleared=true; toast="Product created QA-TEST Product C QA-TEST-1411-2012 was saved."; error banner="none"; in list=true | PASS | shots\R3-03-after-save.png | - |
| R4 | Supplier create: Save Supplier | Saved + success toast | toast="Supplier created QA-TEST supplier QA-TEST-1411-2012 was saved."; in list=true | PASS | shots\R4-01-supplier-saved.png | - |
| R4 | Product create: Add Product (simple) | Saved + success toast | toast="Product created QA-TEST Product D QA-TEST-1411-2012 was saved."; banner="none"; in list=true | PASS | shots\R4-02-product-saved.png | - |
| R4 | Purchase create: Create Purchase | Saved as Draft + success toast | toast="Purchase created PO-10001-2026-0014 was saved as a draft."; error="none"; landed on /admin/purchases/e8efe111-6ccc-402b-bef6-fc7cd421a435 | PASS | shots\R4-04-purchase-created.png | - |
| R4 | Purchase Confirm | Confirmed + toast (existing behaviour) | toast="Purchase confirmed This purchase is now Confirmed." | PASS | shots\R4-05-purchase-confirmed.png | - |
| R4 | GRN save draft (existing behaviour) | Draft GRN toast | toast="Goods receipt saved as Draft Confirm it to receive the goods into the warehouse." | PASS | shots\R4-06-grn-draft.png | - |
| R4 | GRN confirm (existing behaviour) | Confirmed toast | Toast not captured within 5s (POST was still running, same slow-write pattern as before); confirm VERIFIED afterwards: Purchase Receiving = Fully Received and Return Items button appeared. (GRN confirm toast is not part of the retest list.) | PASS | shots\R4-07-grn-confirmed.png | - |
| R4 | Purchase Return create: Create Draft Return | Draft created + success toast | toast="Draft return created PR-10001-2026-0005 was saved as a draft."; landed on /admin/purchase-returns/986d15ed-cc14-4041-88e1-c46d5d408647 | PASS | shots\R4-09-return-created.png | - |
| R4 | Purchase Return Confirm | Status moves forward + success toast | API 200; toast="Purchase return confirmed PR-10001-2026-0005"; badges now: Confirmed | PASS | shots\R4-ret-confirm.png | - |
| R4 | Purchase Return Dispatch Return | Status moves forward + success toast | API 200; toast="Purchase return dispatched PR-10001-2026-0005"; badges now: Dispatched | PASS | shots\R4-ret-dispatch.png | - |
| R4 | Purchase Return Complete Return | Status moves forward + success toast | API 200; toast="Purchase return completed PR-10001-2026-0005"; badges now: Completed | PASS | shots\R4-ret-complete.png | - |
| R5 | SupplierDetail shows Company Name | Label "Company Name" with value "QA-TEST Traders QA-TEST-1411-2012" | label shown=true; value shown=true | PASS | shots\R5-supplier-detail.png | - |
| R5 | ProductDetail shows Purchase Price | Label "Purchase Price" with ₹100 | found=true; value=100 | PASS | shots\R5-product-detail.png | - |
| R6 | Expense Add modal: Expense Date calendar + saved date | App calendar; native 0; saved date = 2026-11-10 | native date inputs=0; picked "10-11-2026" (iso 2026-11-10); API expense_date="2026-11-10" (POST 201); UI shows date=true; toast="Expense added Added and approved."; in list=true | PASS | shots\R6-expense-date-picked.png | - |
| R6 | Customer form: Customer Since calendar | App calendar opens (nothing saved) | custom calendar opened=true; native date inputs visible=0; value shown="14-11-2026" | PASS | shots\R6-customer-form-calendar.png | - |
| R6 | Quotation New: Quotation Date + Valid Until calendars + saved dates | App calendar; native 0; saved 2026-11-10 / 2026-11-20 | customer quick-added & shown=true; native date inputs=0; picked "10-11-2026" / "20-11-2026"; API quotation_date="2026-11-10", valid_until="2026-11-20"; detail shows dates: true/true; saved=true (/admin/quotations/adb4ec64-2d13-46dc-b157-781edb47db23); form error="none"; toast="none seen" | PASS | shots\R6-quotation-dates-picked.png | - |
| R6 | Supplier Invoice New: Invoice Date + Due Date calendars + saved dates | App calendar; native 0; saved 2026-11-10 / 2026-11-20 | native date inputs=0; picked "10-11-2026" / "20-11-2026"; API invoice_date="2026-11-14", due_date="2026-11-20"; detail shows dates: false/true; saved=true (/admin/supplier-invoices/f69b7180-5a14-4a62-aa72-cdcfdd32a835); form error="none"; toast="Supplier invoice saved as Draft. Record it to run 3-way verification." \| DIAG: frontend sent invoice_date=2026-11-10, backend stored 2026-11-14. | FAIL | shots\R6-supplier-invoice-dates-picked.png | - |
| R6 | Purchase Create: Purchase Date calendar | App calendar (not the browser one) opens; no native date input; picked date is saved | native date inputs visible=0; trigger before="14-11-2026" after pick="10-11-2026" (iso 2026-11-10) | PASS | shots\R6-purchase-create-date-picked.png | - |
| R6 | Purchase Create: saved date | Detail shows 2026-11-10 | date 10 Nov 2026 found on the purchase detail (list/detail header "Purchase Order · 10 Nov 2026") | PASS | shots\R6-purchase-detail-date.png | - |
| R6 | GRN modal: Receipt Date calendar | App calendar opens | custom calendar opened=true; native inputs=0; value shown="14-11-2026" (nothing saved from this check) | PASS | shots\R6-grn-modal-calendar.png | - |
| R6 | Purchase Return New: Return Date calendar + saved date | App calendar opens, native inputs 0, saved return_date = 2026-11-10 | native date inputs=0; picked "10-11-2026" (iso 2026-11-10); API return_date="2026-11-10" | PASS | shots\R6-return-new-date-picked.png | - |
| R7 | "Return Items" on a new DRAFT purchase | Not visible | visible count=0 | PASS | shots\R7-draft.png | - |
| R7 | "Return Items" on CONFIRMED purchase before any GRN | Not visible | visible count=0 | PASS | shots\R7-confirmed-no-grn.png | - |
| R7 | "Return Items" with only a DRAFT GRN | Not visible (nothing received yet) | visible count=0 | PASS | shots\R7-draft-grn.png | - |
| R7 | "Return Items" AFTER GRN confirmed | Visible | visible count=1 | PASS | shots\R7-after-grn.png | - |
| R8 | Open /admin/vehicle-stock: both tables | Two tables: Today's Vehicle Load Information + Vehicle Load History; APIs /today and /history return 200 | today heading=true, history heading=true, tables=2; GET /vehicle-stock/today -> 200 (1 rows); GET /vehicle-stock/history -> 200 (total 6); Today columns: Vehicle No \| Driver Name \| Order Units \| Loaded Units \| Delivered \| Returned \| Available \| Status \| Actions; History columns: Date \| Vehicle No \| Driver Name \| Order Units \| Loaded Units \| Delivered \| Returned \| Available \| Status \| Actions | PASS | shots\R8-01-overview.png | - |
| R8 | Today table: old active session shows "Loaded on ..." | Every row whose date is not today shows "Loaded on dd Mon" under the vehicle number | today API rows=1, rows with a non-today date=1 (MH02CJ0584@2026-10-06); "Loaded on" captions on screen=1 (Loaded on 06 Oct) | PASS | shots\R8-02-today-table.png | - |
| R8 | History search "MH02C" | Server request has search=; every visible row matches the term (vehicle no or driver) | request=/vehicle-stock/history?page=1&page_size=25&search=MH02C; API total=5; rows=5; first row="06-10-2026 05:30 MH02CJ0584 delivery 82 139 29 0 110 Active Detail View" | PASS | shots\R8-03-search.png | - |
| R8 | History status filter Active / Closed | status= sent; only that status listed | Active: request ok=true, API total=1, rows=1, wrong-status rows=0 \|\| Closed: request ok=true, API total=5, rows=5, wrong-status rows=0 | PASS | shots\R8-04-status-filter.png | - |
| R8 | History pagination (rows per page 10, Next/Previous) | page_size/page sent; page 2 shows different rows | page_size=10 -> total 6, total_pages 1, rows on page 1 = 6; only one page of data, Next cannot be exercised (page size control and indicator still work) | PASS | shots\R8-05-pagination.png | - |
| R8 | History sorting (Date, Vehicle No, Status) | sort_by + sort_order sent; rows come back ordered | Date: asc request=true, desc request=true, desc order ok=true \|\| Vehicle No: asc request=true, desc request=true, desc order ok=true (data has <2 distinct values, order not provable) \|\| Status: asc request=true, desc request=true, desc order ok=true | PASS | shots\R8-06-sort.png | - |
| R8 | Export to Excel (current filters, all pages, page_size 100) | An .xlsx downloads; rows = history total; requests use page_size=100 | download=vehicle-load-history-2026-11-14.xlsx (17887 bytes); header=["Date","Vehicle No","Driver Name","Order Units","Loaded Units","Delivered","Returned","Available","Status"]; export requests=?page=1&page_size=10 , ?page=1&page_size=100; API total=6; rows in file=6 | PASS | shots\R8-07-export.png | - |
| R8 | Row click -> detail page; SKU / UOM filled | Opens /admin/vehicle-stock/:id via GET /vehicle-stock/{id}; SKU ("SKU / variant") and UOM match the API (null -> "—") | clicked row "06-10-2026 05:30 MH02CJ0584 delivery 82 139 29 0 110 Active Detail View" -> /admin/vehicle-stock/98a5b651-b851-4d84-bd45-be713775dd0c; GET /vehicle-stock/{id} -> 200; API items=7 (with sku=7, with uom=7); screen rows=7; columns=Product \| SKU / Variant \| UOM \| Loaded \| Extra \| Delivered \| Returned \| Available \| Status \| Actions; mismatches=none | PASS | shots\R8-08-detail.png | - |
| R8 | Console errors on Vehicle Stock pages | none | Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/vehicle-stock/98a5b651-b851-4d84-bd45-be713775dd0c' from origin 'ht ;; Failed to load resource: net::ERR_FAILED | FAIL | - | - |
| R9 | Delivery role: login + open /delivery/vehicle-stock | Same page and behaviour as before (VehicleStockOverview unchanged) | NOT RUN - login impossible: live backend POST /auth/login hangs (no response for 20s+, in-page fetch got a 500 earlier, curl timed out) from the start of R10 until I stopped waiting (~25 min). Other endpoints answered normally (GET /docs 200, POST /auth/refresh 401 in 0.5s). Code check only (not a test): /delivery/vehicle-stock still renders VehicleStockOverview, whose only changes are skuVariantLabel and two added export keywords. | BLOCKED | - | - |
| R10 | Simulated network failures (GET retry, POST not retried, 401 + refresh unreachable, genuine 401) | No logout on network errors; friendly message; GET retried once; logout only on real 401 | NOT RUN - script r10.js is written but needs a login, and POST /auth/login was hanging on the backend (see R9). | BLOCKED | - | - |
| R10 | Console errors + logout loop during the R1-R8 runs (passive evidence only) | No new JS errors; no logout loop | During all R1-R8 sessions: no page/JS errors were recorded other than net::ERR_FAILED / CORS lines from the live backend (R1: 4 pages on pass 1, R8: one detail GET); no session was ever bounced to /login while running (every script stayed logged in). | INFO | - | - |

## Every FAIL / BLOCKED: Backend / Frontend / Data / Environment

### R1 - Open "Audit Log" (/admin/audit-logs) (FAIL)
- **Class:** Backend (intermittent: live API answers some requests without CORS headers -> net::ERR_FAILED; a different endpoint fails on each attempt; same pattern as the previous run)
- **Evidence:** final=/admin/audit-logs h1="Audit Log" console: Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/organizations/overview?activity_limit=100' from origin 'http://loca ;; Failed to load resource: net::ERR_FAILED \|\| RETRY:  Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/organizations/settings/fields' from origin 'htt
- **Cause / file + line:** Not a frontend defect: the failing endpoint changes between attempts (organizations/overview, organizations/settings/fields, auth/me, organization/theme). src/api/client.js retries a failed GET once after 2s.
- **Screenshot:** shots\R1-admin_audit_logs.png

### R6 - Supplier Invoice New: Invoice Date + Due Date calendars + saved dates (FAIL)
- **Class:** Backend
- **Evidence:** native date inputs=0; picked "10-11-2026" / "20-11-2026"; API invoice_date="2026-11-14", due_date="2026-11-20"; detail shows dates: false/true; saved=true (/admin/supplier-invoices/f69b7180-5a14-4a62-aa72-cdcfdd32a835); form error="none"; toast="Supplier invoice saved as Draft. Record it to run 3-way verification." \| DIAG: frontend sent invoice_date=2026-11-10, backend stored 2026-11-14.
- **Cause / file + line:** Frontend is correct: request body captured (aborted diagnostic run) = {invoice_date:"2026-11-10", due_date:"2026-11-20"} (src/api/supplierInvoices.js:204 buildSupplierInvoiceBody -> invoice_date from form.invoiceDate, SupplierInvoiceForm.jsx:378). The live API responded/stored invoice_date=2026-11-14 (today) while due_date=2026-11-20 was kept -> POST /supplier-invoices ignores or overwrites invoice_date.
- **Screenshot:** shots\R6-supplier-invoice-dates-picked.png

### R8 - Console errors on Vehicle Stock pages (FAIL)
- **Class:** Backend (intermittent: live API answered GET /vehicle-stock/{id} without CORS headers -> net::ERR_FAILED; the page retried it and the detail loaded, see the PASS row above)
- **Evidence:** Access to XMLHttpRequest at 'https://crm-saas-backend.bsmart.workers.dev/vehicle-stock/98a5b651-b851-4d84-bd45-be713775dd0c' from origin 'ht ;; Failed to load resource: net::ERR_FAILED
- **Cause / file + line:** No app/JS error. src/api/client.js retries the GET once after 2s; the console still records the first failed XHR.
- **Screenshot:** -

### R9 - Delivery role: login + open /delivery/vehicle-stock (BLOCKED)
- **Class:** Backend / Environment (login endpoint down)
- **Evidence:** NOT RUN - login impossible: live backend POST /auth/login hangs (no response for 20s+, in-page fetch got a 500 earlier, curl timed out) from the start of R10 until I stopped waiting (~25 min). Other endpoints answered normally (GET /docs 200, POST /auth/refresh 401 in 0.5s). Code check only (not a test): /delivery/vehicle-stock still renders VehicleStockOverview, whose only changes are skuVariantLabel and two added export keywords.
- **Cause / file + line:** POST /auth/login timeout on https://crm-saas-backend.bsmart.workers.dev
- **Screenshot:** -

### R10 - Simulated network failures (GET retry, POST not retried, 401 + refresh unreachable, genuine 401) (BLOCKED)
- **Class:** Backend / Environment (login endpoint down)
- **Evidence:** NOT RUN - script r10.js is written but needs a login, and POST /auth/login was hanging on the backend (see R9).
- **Cause / file + line:** POST /auth/login timeout
- **Screenshot:** -

## Other observations (not counted as FAIL)

- **Quotation save shows no success toast** (R6 Quotation: toast "none seen" after Save Quotation). Not in the retest list, but same pattern as the Supplier/Product toasts that were fixed: src/features/quotations/QuotationFormPage.jsx handleSubmit.
- **GRN confirm toast was not captured** (R4): the confirm succeeded (Receiving = Fully Received, Return Items appeared) but the POST was still running when the 5s toast window ended - slow write, same as the previous run.
- **Live backend CORS / ERR_FAILED is still intermittent** (R1: 4 pages, R8: one detail GET). The failing endpoint changes between attempts; src/api/client.js retries the GET once after 2s and the pages did load.
- **Vehicle History sorting by Vehicle No / Driver Name** could not be proven by data order: the live history has one vehicle number (MH02CJ0584) and one driver ("delivery") plus one row with no vehicle number. Requests with sort_by/sort_order are sent correctly; the row with a null vehicle number is listed last in both asc and desc (backend choice). Date and Status order were verified.
- **Pagination Next/Previous** could not be exercised: history has only 6 rows (total_pages=1 even at 10 rows per page). Page-size control, request params and page indicator work.
- **Native date inputs still exist** on raw `<input type="date">` fields that do not use `Input` (e.g. Order / Delivery "Scheduled Date" in OrderDetail.jsx:1050 and DeliveryDetail.jsx:1730). Not in the R6 list.
- **Old Playwright scripts (t*.js) cannot fill date fields any more** - they are now calendar buttons; this run uses h.js `pickDay`.
- **Tester housekeeping:** the Vite dev server started for this run is still running in the background (stop it with Ctrl+C / close its terminal); Vite may have refreshed node_modules/.vite. No source file or git state was touched.

## QA-TEST records created (all kept, nothing deleted or cancelled)

| Kind | Name / reference | Notes |
|---|---|---|
| Product (variants) | QA-TEST Product C QA-TEST-1411-2012 | PRD "QA-TEST Product C" - variants Red (120) + Blue (125) |
| Supplier | QA-TEST supplier QA-TEST-1411-2012 | with Company Name "QA-TEST Traders ..." |
| Product | QA-TEST Product D QA-TEST-1411-2012 | "QA-TEST Product D", purchase 100 / selling 150 |
| Purchase | QA-TEST-INV-2 | PO-10001-2026-0014, qty 2 x 100, purchase date 10 Nov 2026, Confirmed + Fully Received |
| GRN | GRN for PO-10001-2026-0014 | GRN-10001-2026-1023, 2 accepted, confirmed (Receiving = Fully Received) |
| Purchase Return | QA-TEST-1411-2012 qty 1 | PR-10001-2026-0005, qty 1, return date 10 Nov 2026, Draft -> Confirmed -> Dispatched -> Completed |
| Expense | QA-TEST expense QA-TEST-1411-2012 date-check | amount 1, expense date 10 Nov 2026 |
| Customer | QA-TEST customer QA-TEST-1411-2012 | created through Quotation > Quick Add Customer (fake phone 9000000001) |
| Quotation | for QA-TEST customer QA-TEST-1411-2012 | quotation date 10 Nov 2026, valid until 20 Nov 2026, Product D |
| Supplier Invoice | QA-TEST-SINV-2012 | draft; invoice date picked 10 Nov but stored 14 Nov by backend; due 20 Nov |

Also in this folder: `vehicle-load-history-2026-11-14.xlsx` (the file the Export button produced, 6 rows).

## Rules followed

- Files created/edited only inside `qa-tests\run-2026-11-14_2001\` (the earlier `qa-tests\fields-*` files were not touched in this run). No source code edits, no git commands.
- The only process started outside qa-tests was `npm run dev` (the local dev server the task asked for).
- Credentials were read from `.env.qa.local` in memory only; none appear in results, state or this report.
- Billing / Plans / Razorpay pages were skipped. Records that existed before this run were not edited, except that the Quotation used a customer created by this run.
- Diagnostic request capture (r6c_diag.js) was aborted before sending - nothing was saved by it.
