# Frontend Readiness & API-Consumption Audit — Beas Suite

Verification only — no code was changed. Scope: everything under `src/`, tested against `VITE_DEMO_DATA=false` and the real backend.

- **Backend:** `crm-saas-backend.bsmart.workers.dev`
- **Mode:** `VITE_DEMO_DATA=false`
- **Method:** static source audit, no live browser

## Overall verdict: READY WITH ISSUES

The large majority of modules are genuinely real-API-driven, with demo logic correctly gated behind the explicit switch. But this audit found **3 pages that show entirely fabricated business data with no API call and no demo-mode gating at all** (they run identically whether demo mode is on or off), plus one list column that silently invents data. These are concrete, nameable bugs, not architecture problems — see §3 and the Final Report for exact files.

---

## 1. API inventory

47 files under `src/api/`, ~300 distinct backend calls. Grouped by module below; method + endpoint + the function that wraps it.

### Core sales pipeline

| Module | Endpoints | Function file |
|---|---|---|
| Leads | `GET/POST /leads`, `GET/PATCH/DELETE /leads/:id`, `POST /leads/:id/convert-to-customer` | leads.js |
| Follow-ups | `GET/POST /follow-ups`, `PATCH /follow-ups/:id`, `POST /follow-ups/:id/complete`, `DELETE /follow-ups/:id` | followups.js |
| Visits | `GET/POST /visits`, `PATCH/DELETE /visits/:id`, `POST /visits/:id/follow-ups`, `GET /customers/:id/visits`, `GET /customers/:id/follow-ups` | visits.js |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`, documents, payments, account-statement | customers.js |
| Quotations | `GET/POST /quotations`, `GET/PATCH/DELETE /quotations/:id`, `POST /quotations/:id/convert-to-order`, `GET /quotations/:id/pdf` | quotations.js |
| Orders | `GET/POST /orders`, `GET/PATCH/DELETE /orders/:id`, confirm, assign-delivery-partner, pickup/start·ready·confirm, cancel | orders.js |
| Sales Returns | `GET/POST /sales-returns`, `GET/PATCH/DELETE /sales-returns/:id` (+ status-transition PATCHes) | salesReturns.js |

### Catalog & inventory

| Module | Endpoints | Function file |
|---|---|---|
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, batches, serials, attachments | products.js |
| Categories | full CRUD + `POST /categories/bulk-delete` | categories.js |
| Brands | full CRUD + brand↔category links + `POST /brands/bulk-delete` | brands.js |
| Inventory | `GET /inventory`, `GET /inventory/:id`, `POST /inventory/adjustments`, `GET /inventory/expiring`, `PATCH /inventory/:id` | inventory.js |
| Warehouses | full CRUD, `GET /warehouses/stock`, `POST .../stock/adjust`, movements, transfers | warehouses.js |
| Vehicles | full CRUD, assignments, activity | vehicles.js |
| Vehicle Stock | `POST /vehicle-stock/loading`, current-session, extra-load, end-of-day, reconcile, reconciliations | vehicleStock.js |

### Procurement

| Module | Endpoints | Function file |
|---|---|---|
| Suppliers | full CRUD, status, payments, products, brands | suppliers.js |
| Purchases | `GET/POST /purchases`, `GET/PATCH/DELETE /purchases/:id`, action-transitions, payment-status, cancel, documents, **`POST .../returns`** | purchases.js |
| GRN | full CRUD + `POST /grns/:id/:action` | grns.js |
| Supplier Invoices | `GET/POST /supplier-invoices`, `GET/PUT/DELETE /supplier-invoices/:id`, record, cancel | supplierInvoices.js |
| Supplier Payments | `GET/POST /supplier-payments`, void, `GET /supplier-invoices/:id/payments` | supplierPayments.js |
| Accounts Payable | `GET /accounts-payable`, `/summary`, `/supplier/:id` — read-only | accountsPayable.js |

### Fulfilment & cash

| Module | Endpoints | Function file |
|---|---|---|
| Deliveries | partners, list, detail, create, update, load, accept/reject/pick/ready/confirm, challan PDF, assigned, status | deliveries.js |
| Delivery Collections | `POST /deliveries/:id/collections`, list, detail, reconcile, void | deliveryCollections.js |
| Customer Payments | `POST` to a shared collection endpoint | customerPayments.js |
| Payment Receipts | full CRUD | paymentReceipts.js |
| Invoices | `GET/POST /invoices`, detail, `POST /orders/:id/invoice`, `GET /invoices/:id/pdf`, credit-note, invoice-settings GET/PATCH | invoices.js |
| Invoice Payment Links | `POST .../payment-link`, `GET .../payment-links`, cancel, refresh | invoicePaymentLinks.js |
| Expenses | categories (read-only), full CRUD, receipt upload, approve/reject/request-clarification | expenses.js |
| Reports | `GET /reports/:type`, `GET /reports/:type/export` | reports.js |
| Dashboard | `GET /dashboard/admin` | dashboard.js |

### Platform & admin

| Module | Endpoints | Function file |
|---|---|---|
| Auth | login, register, forgot/reset/change-password, `/auth/me`, logout, Google exchange/register | auth.js |
| Users / Staff | full CRUD, location, overview, permanent-delete | users.js |
| Roles | catalog, full CRUD | roles.js |
| Organizations / Company Settings | settings GET/PUT, overview, me, other-documents, upgrade-request | organizations.js |
| Object Field Settings | `GET/PUT /organizations/settings/fields` | settings.js |
| Theme / Appearance | `GET/PATCH /organization/theme`, background upload/delete, reset | theme.js |
| Attendance | check-in, me, list | attendance.js |
| Leaves | create, me, list, detail, update, approve, reject, delete | leaves.js |
| Notifications | list, unread-count, mark-read, mark-all-read | notifications.js |
| Plans | `GET /plans` | plans.js |
| Billing / Razorpay | order, verify, payments | billing.js |
| Payment Gateway | GET/PUT/DELETE settings, test | paymentGateway.js |
| Companies (lookup) | `GET /companies` | companies.js |
| Files | get, upload, delete | files.js |
| Bulk Import | template download, import upload, per-module | bulkImport.js |
| Super Admin | organizations, admins, plans — full CRUD across each | superadmin.js |
| Cash Reconciliation | (module-specific, demo-gated — see §4) | cashReconciliation.js |

Per-call request payloads and the exact response fields each component reads are listed where they materially affect the findings below (§6, §9, §10, §12). Exhaustively reproducing all ~300 call sites' field lists was out of scope for a single pass — flag any specific endpoint for its exact fields on request.

---

## 2. Page → Action → API audit

Every action traced wires to a real endpoint with a matching function, or is explicitly, visibly disclosed as demo-only / not-yet-available (never silently). The table below lists every action flagged by the brief's criteria (no API call, local-state-only, obsolete endpoint, disabled placeholder, "backend later," no error handling, no refresh after mutation).

| Page | Action | Issue | Severity |
|---|---|---|---|
| GST Summary | (whole page) | No API call anywhere in the file. `gstData` is a hardcoded object. No demo-mode gate — shows fake output/input/net GST figures unconditionally. | **P0** |
| Audit Logs | (whole page) | No API call anywhere in the file. `initialLogs` is a hardcoded array of fake users/actions/timestamps. No demo-mode gate. | **P0** |
| My Targets | (whole page) | No API call anywhere in the file. `targets` is a hardcoded array. No demo-mode gate. | **P1** |
| Lead List | (list render — "Next Follow-up" column) | `getLeadActivity()` in `leadActivity.js` generates a deterministic fake due-date from a hash of the lead id. Explicitly commented as a placeholder ("MOCK… TODO: replace"). Not demo-gated — runs in real mode too. Lead Detail, by contrast, correctly calls the real `listFollowUps` API. | **P1** |
| Admin Dashboard | Expense Breakdown legend | When fewer than 6 real categories have spend, the legend pads out with a hardcoded `DEFAULT_EXPENSE_CATEGORIES` list at ₹0. No amounts are fabricated (the ₹0 is real), and the pie chart itself filters to non-zero slices only — cosmetic, not a data-integrity issue. | P3 |
| Purchase Returns (List/Detail/Form) | everything | Correctly demo-gated. Real mode shows an honest "not available yet" empty state plus the exact list of backend work required. See §5. | P3 (not a bug) |
| Invoice Settings → Printing | Thermal theme/layout, typography sliders, auto-cut/cash-drawer/copies | Already self-disclosed in-UI via InfoNote text — saved, and reflected in the client-side Print Preview/Download Sample PDF, but not in the backend-generated PDF. Not hidden from the user. See §9. | P3 (disclosed) |

No instance found of: an action that uses localStorage as business-record storage (localStorage is used only for UI prefs — sidebar collapsed state, auth token cache, per-viewer convenience), a call to a demonstrably removed/obsolete endpoint, or a mutation that fails to refresh real state afterward.

---

## 3. Demo / mock / fake logic search

Full-tree search for the listed terms. Results split into **safe** (demo code that cannot execute when `VITE_DEMO_DATA=false`) and **live** (executes regardless of the flag).

### Confirmed demo-gated (safe, dead in real mode)

19 modules carry an explicit demo layer, every one checked against its own `*_DEMO_ENABLED`/`DEMO_MODE` constant before any fixture is used: Attendance, Dashboard, Invoices, Leaves, Orders, Payables, Purchase Returns, Purchases, Cash Reconciliation, Reports, Sales Returns, Supplier Invoices, Supplier Payments, Suppliers, Vehicle Stock, Vehicles, Warehouses, Expenses, Deliveries. Each one's real-mode branch was spot-checked (Purchase Returns in full — see §5) and shows a truthful empty/real-API state, not fixtures.

### Confirmed live in real mode (the actual issues)

**GST Summary — fully fabricated, always on**
`src/features/gst/GSTSummary.jsx`
Entire page body is 69 lines, zero API imports, zero `useEffect`. `outputGST: 25000, inputGST: 15000, netGSTPayable: 10000` are literal numbers shown as real GST figures to every user in every mode.

**Audit Logs — fully fabricated, always on**
`src/features/auditLogs/AuditLogList.jsx`
62 lines, zero API imports. `initialLogs` hardcodes 5 fake entries with invented user names, actions and timestamps, shown as the organization's actual audit trail.

**My Targets — fully fabricated, always on**
`src/features/performance/MyTargets.jsx`
87 lines, zero API imports. `targets` hardcodes 5 sales/visit/follow-up target-vs-achieved rows.

**Lead List "Next Follow-up" — deterministic mock, always on**
`src/features/leads/leadActivity.js` — function `getLeadActivity()`
Not demo-gated. The function's own comment: *"MOCK activity summary… GET /leads exposes none of this yet… TODO: replace the whole body with the real activity/follow-up feed."* See §6 for the real-data path.

### Other terms searched

`Math.random` — 2 hits, both benign: a toast notification's DOM key (`Toast.jsx`) and a client-side temp id for an unsaved product variant row (`ProductForm.jsx`). Neither touches business data. `TODO`/`FIXME` — all other hits are either the findings above or code comments about genuinely-missing backend fields (e.g. PO/E-Way Bill numbers on invoices), already disclosed in-UI. No hardcoded business records, fake generated dates, or dead "coming soon" placeholders found beyond what's listed above.

---

## 4. Module-by-module notes

Narrative notes beyond what §13's table captures. Modules not mentioned here had nothing noteworthy beyond "real API, demo correctly gated or absent."

- **Leads** — List/Detail/Activities/Follow-ups/Visits/Notes/Conversion all real-API. One mock column — §6.
- **Purchase Returns** — No real backend entity exists yet. Frontend is demo-only by design, with a truthful real-mode empty state. Full breakdown in §5.
- **GST Summary** — Entirely hardcoded, no backend connection at all. See §3.
- **Audit Logs** — Entirely hardcoded, no backend connection at all. See §3.
- **My Targets** — Entirely hardcoded, no backend connection at all. See §3.
- **Expenses** — Real CRUD + approve/reject/clarify. Categories are read-only from the backend; no category-management API exists or is expected. See §7.
- **Invoice Settings / PDF** — Real settings persistence; backend PDF honors only a subset. Already self-disclosed in-UI. See §9.
- **Online Payments / Razorpay** — All 12 expected endpoints present and wired, matching the brief's list exactly. See §10.
- **Help / FAQ / Legal** — Static content pages, no API expected — correct for their purpose.

---

## 5. Purchase Returns — high priority

Frontend files: `PurchaseReturnList.jsx`, `PurchaseReturnDetail.jsx`, `PurchaseReturnFormPage.jsx`, `purchaseReturnHelpers.js`, `purchaseReturnDemoData.js`.

### A. Does it require a dedicated list API?

**YES.** Confirmed by direct inspection of `purchaseReturnHelpers.js`'s own header comment: *"The backend has NO Purchase Return entity — only a thin fire-and-forget `POST /purchases/{id}/returns` (items + reason → PurchaseOut, nothing tracked)."* There is no `GET /purchase-returns` anywhere in the 306-call inventory in §1.

### B. Fields the list expects

`id`, `returnNumber`, `supplierName`, `purchaseNumber`, `grnNumber`, `status`, `returnDate`, `items[]` (for count + `totalReturnQty`)

### C. Fields the detail page expects

Everything in B, plus: `createdAt`, `confirmedAt`, `dispatchedAt`, `completedAt`, `cancelledAt`, `cancelReason`, per-item `returnQty`/`quantity`

### D. Status/action set the frontend expects

Statuses: `draft`, `confirmed`, `dispatched`, `completed`, `cancelled` — plus a normalization layer accepting aliases (`requested`/`open`→draft, `approved`→confirmed, `in_transit`/`sent`→dispatched, `closed`/`done`→completed, `canceled`/`void`→cancelled).

### E. Lifecycle actions expected

`draft` → edit / confirm / cancel · `confirmed` → dispatch / cancel · `dispatched` → complete · `completed`/`cancelled` → terminal, read-only. This is the frontend's own model (`prNextActions()`) — it assumes nothing about what the backend actually supports.

### Full backend gap list (verbatim from source)

- PurchaseReturn / PurchaseReturnItem entity + table
- `GET /purchase-returns` list + `GET /purchase-returns/{id}` detail
- Return number generation
- Draft → Confirmed → Dispatched → Completed lifecycle endpoints (+ Cancel)
- Purchase → Return and Goods Receipt → Return relationships
- Per-item received quantity from a real GRN
- Per-item previously-returned quantity (multiple returns against one receipt)
- Source warehouse persisted on the return
- Stock movement out of the warehouse on dispatch/completion
- Batch/lot/serial/expiry references carried onto the return
- Supplier credit note / debit note / payable adjustment on completion
- Return audit trail
- `purchase_returns` permission module (currently reuses `purchases`)

This is pre-existing, already-honest frontend engineering — not a bug to fix, a backend dependency to track.

---

## 6. Leads / Follow-up audit

Checked `LeadList.jsx` and `LeadDetail.jsx` separately, as asked.

| Page | Next Follow-up source |
|---|---|
| Lead List | **mock/generated** — `getLeadActivity()`, a per-lead deterministic hash-seeded fake date |
| Lead Detail | **real API** — calls `listFollowUps({ leadId })`, the genuine `GET /follow-ups?lead_id=…` endpoint |

**Exact file/function:** `src/features/leads/leadActivity.js`, function `getLeadActivity(lead)`. The "last activity" half of the same function is partly real (derived from `lead.updatedAt`/`createdAt`/`convertedAt`, just with a generic invented verb like "Called"/"Note added" picked by the same hash) — only the "next follow-up" half is pure fabrication.

**What real data source can replace it**, per the "don't request a new field if an existing API satisfies it" instruction: `GET /follow-ups` already supports `lead_id` and `status` query params (confirmed in `api/followups.js`'s `listFollowUps()`). A real "Next Follow-up" column does not need a new backend field — it needs either (a) one `GET /follow-ups?status=pending` call per list load, grouped client-side by `lead_id` to find each lead's earliest pending item, or (b) the backend enriching the existing `GET /leads` list response with a `next_follow_up_at` field computed server-side. Either is a legitimate option; no new entity or field is strictly required given (a) already works with what exists.

---

## 7. Expense Categories

| Question | Answer |
|---|---|
| API function | `getExpenseCategories()` → `GET /expenses/categories` |
| Pages using it | `MyExpenses.jsx`, `AdminDashboard.jsx` (for the Expense Breakdown chart) |
| Fallback categories exist? | Yes — `DEMO_EXPENSE_CATEGORIES` (demo-gated, dead in real mode) and `DEFAULT_EXPENSE_CATEGORIES` (dashboard-only, label-padding, see §3) |
| Can the fallback execute in real mode? | `DEMO_EXPENSE_CATEGORIES`: no (gated). `DEFAULT_EXPENSE_CATEGORIES`: yes, but only pads the legend with ₹0 labels when real data is thin — never fabricates an amount. |

**Separate category-management API required: NO.** Only a read endpoint exists or is called anywhere in the frontend; there is no create/update/delete category UI, so nothing is blocked waiting on one.

---

## 8. Reports + Dashboard

| Card / Page | Backend source | Flag |
|---|---|---|
| Admin Dashboard (orders, revenue, recent orders, top products) | `GET /dashboard/admin` (with company/warehouse/customer/supplier/date filters) | — |
| Admin Dashboard — Expense Breakdown | `GET /dashboard/admin` + `GET /expenses/categories` | Legend label-padding only, see §3/§7 |
| Financial / GST / other Reports pages | `GET /reports/:type`, export via `GET /reports/:type/export` | — |
| GST Summary (separate from Reports → GST) | **none** | **P0 — fully hardcoded, see §3** |

Note the naming collision: there is a real, backend-driven GST figure inside the Reports module (`reports.js`'s generic `type` param), separate from the standalone `GSTSummary.jsx` page under `src/features/gst/`, which is the hardcoded one. Worth confirming with the user which of the two is the one actually linked from navigation.

---

## 9. Invoice PDF

Backend: `GET /invoices/{id}/pdf?format=detailed|simple`. Compared against every control in Invoice Settings — this module already carries its own accurate, in-UI disclosures (added earlier this engagement), reproduced here verbatim.

| Setting group | In backend PDF? | In client Print Preview / Sample PDF? |
|---|---|---|
| Paper size, orientation, margins (regular/A4) | yes | yes |
| Font Family, Heading/Body/Table Size | no — fixed size per template | yes |
| Thermal Theme, Layout, Paper Width, Bold, Extra Lines | no | yes — incl. a real invoice's own Print Receipt (Thermal) button |
| Auto-cut, Cash Drawer, Copies | no — not a browser-issuable printer command | no — same reason, disclosed as such in-UI |
| PO / E-Way Bill / Vehicle Number toggles | n/a | n/a — real invoice records don't carry this data yet at all, toggle shows nothing either way |

No frontend option silently does nothing without disclosure — every gap above has a matching `InfoNote` in `InvoiceSettings.jsx` stating it plainly.

---

## 10. Razorpay / Billing

| Endpoint | Wired? | Function |
|---|---|---|
| `POST /billing/razorpay/order` | yes | createRazorpayOrder — billing.js |
| `POST /billing/razorpay/verify` | yes | verifyRazorpayPayment — billing.js |
| `GET /billing/payments` | yes | getPaymentHistory — billing.js |
| `GET/PUT/DELETE /settings/payment-gateway` | yes | paymentGateway.js |
| `POST /settings/payment-gateway/test` | yes | testPaymentGateway — paymentGateway.js |
| `POST /invoices/{id}/payment-link` | yes | invoicePaymentLinks.js |
| `GET /invoices/{id}/payment-links` | yes | invoicePaymentLinks.js |
| `POST /invoices/{id}/payment-links/{id}/cancel` | yes | invoicePaymentLinks.js |
| `GET /invoices/{id}/payment-links/{id}/refresh` | yes | invoicePaymentLinks.js |

No frontend-stored secret: `key_id` is read fresh from the order-creation response every time, never hardcoded or cached beyond the active checkout session. No fake success state — `verifyRazorpayPayment`'s result is what actually updates the organization's plan state; a 503 on order creation is handled as a distinct "not configured" case (hides the Pay button, falls back to manual request), not swallowed as a generic error. Invoice payment links refresh their status on demand via the dedicated refresh endpoint rather than assuming success.

---

## 11. Role / Permission audit (frontend only)

Two layers: route-level (`ProtectedRoute`, role allow-lists) and page/action-level (`RequirePermissionRoute` + the `usePermission`/`can()` hook gating individual buttons).

| Layer | Mechanism | Observed usage |
|---|---|---|
| Session gate | `ProtectedRoute` — redirects to `/login` if no `currentUser` | Wraps every authenticated route group |
| Role gate | `ProtectedRoute allowedRoles=[...]` | 5 role-scoped route groups: Super Admin, Admin, Sales Officer, Delivery Partner, Accountant |
| Permission gate | `RequirePermissionRoute` | 235 occurrences across the route tree — one per sensitive page/action route |
| Button/action visibility | `usePermission().can(module, action)` inline in components | Used throughout (e.g. Record Payment, Approve/Reject, Delete actions all gated at the button level, not just the route) |

**Unguarded routes found:** only the expected public set — `/login`, `/register`, `/auth/callback`, `/auth/register/google`, `/superadmin/login` (redirect only), the 7 Help/Legal pages (intentionally public), and `/print/invoices/:id` (deliberately public — its own code comment explains this is a short-lived signed URL token, not a session, for backend headless PDF rendering). No sensitive business route found outside a guard.

Not independently re-verified: all 235 individual `RequirePermissionRoute` module/action pairings against the actual permission matrix — that would need a dedicated pass cross-referencing Roles & Permissions' own catalog. The pattern itself is sound and consistently applied everywhere it was spot-checked.

---

## 12. API contract expectations

Fields for comparison against a backend-side audit — the ones most load-bearing for the findings above.

| Endpoint | Request fields sent | Response fields read |
|---|---|---|
| `GET /follow-ups` | `customer_id`, `lead_id`, `visit_id`, `assigned_to_id`, `status`, `priority` | array (or `.follow_ups`) of follow-up objects, normalized client-side |
| `GET /expenses/categories` | none | array of category names/objects (string or `.name`/`.label`/`.category`) |
| `POST /billing/razorpay/order` | `plan_id`, `billing_cycle` | `order_id`, `amount`, `currency`, `key_id`, `plan_name`, `billing_cycle`, `prefill.{name,email,contact}` |
| `POST /billing/razorpay/verify` | `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` | full `OrganizationOut` (plan, billing_cycle, plan_expires_at, days_left, status) |
| `GET /invoices/{id}/pdf` | `format` query param (`simple`\|`detailed`) | binary PDF blob |
| `POST /purchases/{id}/returns` | items[] + reason | not tracked/read back — fire-and-forget per source comment |

---

## 13. Functionality coverage table

| Module | List | Detail | Create | Edit | Delete/Cancel | Status Flow | Real API | Demo Dep. | Perm. Guard | Final |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | — | — | — | — | — | — | YES | YES (gated) | YES | READY |
| Customers | READY | READY | READY | READY | READY | — | YES | NO | YES | READY |
| Leads | PARTIAL | READY | READY | READY | READY | READY | YES | YES (gated) + live mock col. | YES | PARTIAL |
| Quotations | READY | READY | READY | READY | READY | READY | YES | YES (gated) | YES | READY |
| Orders | READY | READY | READY | READY | READY | READY | YES | YES (gated) | YES | READY |
| Sales Returns | READY | READY | READY | READY | READY | READY | YES | YES (gated) | YES | READY |
| Inventory / Products / Warehouses | READY | READY | READY | READY | READY | — | YES | NO / YES (warehouses gated) | YES | READY |
| Vehicle Stock / Vehicles | READY | READY | READY | READY | — | READY | YES | YES (gated) | YES | READY |
| Suppliers / Purchases / GRN | READY | READY | READY | READY | READY | READY | YES | YES (gated) | YES | READY |
| Purchase Returns | BLOCKED | BLOCKED | BLOCKED | — | — | BLOCKED | NO | YES (demo-only by design) | NO entity yet | BLOCKED (honest) |
| Deliveries / Collections | READY | READY | READY | READY | — | READY | YES | YES (gated) | YES | READY |
| Sales Invoices / Receivables | READY | READY | READY | — | — | READY | YES | YES (gated) | YES | READY |
| Supplier Invoices / AP / Payments | READY | READY | READY | READY | READY | READY | YES | NO | YES | READY |
| Expenses | READY | READY | READY | READY | READY | READY | YES | YES (gated) | YES | READY |
| Reports (Reports hub) | READY | — | — | — | — | — | YES | YES (gated) | YES | READY |
| GST Summary (standalone page) | — | — | — | — | — | — | NO | NO — always fake | ? | BLOCKED |
| Company Settings | — | READY | — | READY | — | — | YES | NO | YES | READY |
| Plans / Billing History | READY | — | — | — | — | READY | YES | NO | YES | READY |
| Staff / Roles & Permissions | READY | READY | READY | READY | READY | — | YES | NO | YES | READY |
| Object Field Settings | — | — | — | READY | — | — | YES | NO | YES | READY |
| Attendance / Leaves | READY | READY | READY | READY | READY | READY | YES | NO (explicit switch only) | YES | READY |
| Audit Logs | — | — | — | — | — | — | NO | NO — always fake | ? | BLOCKED |
| My Profile | — | READY | — | READY | — | — | YES | NO | YES | READY |
| Appearance & Branding | — | READY | — | READY | — | — | YES | NO | YES | READY |
| Online Payments / Razorpay | — | READY | — | READY | READY | — | YES | NO | YES | READY |
| Notifications | READY | — | — | — | — | — | YES | NO | YES | READY |
| My Targets (standalone page) | — | — | — | — | — | — | NO | NO — always fake | ? | BLOCKED |
| Help / FAQ / Legal | — | READY | — | — | — | — | n/a — static content | NO | n/a — public | READY |

---

## 14. Final frontend report

### Overall: READY WITH ISSUES

### 1. Fully ready

Customers, Quotations, Orders, Sales Returns, Inventory/Products/Warehouses, Vehicle Stock/Vehicles, Suppliers/Purchases/GRN, Deliveries/Collections, Sales Invoices/Receivables, Supplier Invoices/AP/Payments, Expenses, Reports hub, Company Settings, Plans/Billing History, Staff/Roles & Permissions, Object Field Settings, Attendance/Leaves, My Profile, Appearance & Branding, Online Payments/Razorpay, Notifications, Help/FAQ/Legal.

### 2. Partial

Leads — fully functional end to end, but its List view's "Next Follow-up" column shows fabricated data in real mode (§6).

### 3. Blocked

- Purchase Returns — blocked on missing backend entity, **honestly so** (truthful empty state, no fake data shown)
- GST Summary (standalone page) — blocked, but the frontend currently hides this by showing fake numbers instead of a real empty/error state
- Audit Logs — same as above
- My Targets — same as above

### 4. APIs the frontend expects but can't confirm the backend has

Everything in §5's Purchase Returns gap list. Nothing else — every other endpoint referenced by the frontend was found with a matching, non-stub implementation attempt in `src/api/`, though actual backend availability can only be confirmed by a backend-side audit or live request (this pass was frontend-source-only, per the brief).

### 5. Demo/mock logic still executable in real mode

- GST Summary — 100% fabricated, unconditional
- Audit Logs — 100% fabricated, unconditional
- My Targets — 100% fabricated, unconditional
- Lead List "Next Follow-up" — deterministic mock, unconditional
- Dashboard expense-legend category padding — labels only, not amounts, lowest severity

### 6. Local-only functionality

None found beyond the above. localStorage usage elsewhere in the app is UI-preference/session-cache only (sidebar collapsed state, cached auth profile for flash-free reload) — never a substitute for a real business record.

### 7. API payload/response assumptions worth flagging

See §12. The most consequential: `getLeadActivity`'s real "last activity" half already assumes `lead.updatedAt`/`createdAt`/`convertedAt` exist and are trustworthy — worth confirming the backend actually updates `updatedAt` on every real mutation, or that half silently degrades too.

### 8. Permission/route issues

None found. Session, role, and per-action permission guards are all present and consistently applied everywhere checked (§11). Audit Logs and My Targets have no visible permission check at all in their source — moot while they show no real data, but worth deciding their intended guard before they're ever wired to a real API.

### 9. Purchase Returns frontend requirement

See §5 in full — dedicated list/detail API, full lifecycle endpoints, and the 13-item backend gap list are all required before this module can leave demo-only status.

### 10. Lead Next Follow-up decision

No new backend field is strictly required. `GET /follow-ups?lead_id=…&status=pending` already exists and can supply this per lead. A backend-computed `next_follow_up_at` on the leads list response would be more efficient at scale, but is an optimization, not a blocker.

### 11. Expense Categories decision

No separate category-management API is required. Only reads are used anywhere in the frontend.

### 12. Exact files/components needing backend support or a fix

| File | What it needs |
|---|---|
| `src/features/gst/GSTSummary.jsx` | A real GST reporting endpoint, or point this page at the Reports module's existing `GET /reports/:type` if a GST report type already exists there |
| `src/features/auditLogs/AuditLogList.jsx` | A real audit-log endpoint — none currently called anywhere in the frontend |
| `src/features/performance/MyTargets.jsx` | A real targets/performance endpoint, or confirmation this is intentionally deferred |
| `src/features/leads/leadActivity.js` | Replace `getLeadActivity`'s next-follow-up half with a real `listFollowUps` call per §6 |
| Purchase Returns module (3 files + helpers) | Full backend entity per §5's 13-item list |

### 13. Priority

| Priority | Items |
|---|---|
| **P0** | GST Summary and Audit Logs — both show fabricated data as if real, completely unguarded, in a shipping real-mode build. These are the two most likely to mislead an actual user or auditor. |
| **P1** | Lead List "Next Follow-up" (fixable now with the existing Follow-ups API, no backend wait needed) · My Targets (same fabrication pattern as P0, lower stakes since it's personal/motivational rather than compliance data) |
| **P2** | Purchase Returns backend build-out (already honestly handled on the frontend, so not urgent from a "don't mislead users" standpoint — urgent only from a "feature is missing" standpoint) |
| **P3** | Dashboard expense-legend category padding (cosmetic) · Leads "last activity" generic-verb guessing (cosmetic, already mostly real) · confirming all 235 permission-route pairings against the live permission matrix |

---

*Verification only — no source files were modified while producing this audit. Method: full-tree grep/Read across `src/api`, `src/features`, `src/components`, `src/routes`, `src/store`, `src/auth`; no live browser or backend request was used to verify runtime behavior. Build/lint were not re-run since nothing changed.*
