# Beas Suite CRM — API Usage Guide (where, why, and how each endpoint is used)

Companion to **API_LIST.md**. Same 35 sections, same order. Each entry explains **where** the
web app calls it from, **why** it's needed, and the **business logic** worth replicating in the
Flutter app — not just the URL shape.

General rules that apply everywhere below (not repeated per endpoint):
- Every list endpoint returns either a bare array or `{ items / <module>: [...] }` — the frontend
  handles both shapes defensively. Expect the same from your Flutter HTTP layer.
- `snake_case` on the wire, the web app converts to `camelCase` locally — your Flutter models can
  pick whichever convention you prefer, just stay consistent.
- A 403 means "not your permission" (see **Section 5**, the `permissions` matrix) — never retried,
  always shown as an error.
- A 422 (FastAPI-style validation) returns `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`
  — the web app maps `loc` back to the form field that caused it.
- Soft "demo mode" (`VITE_DEMO_DATA=true`) exists only in the web app to let it run with no backend
  at all. **Ignore it entirely** — it's not a backend concept, and a Flutter app should always run
  in the real-mode behavior described below.

---

## 1. Authentication & Session

- **`POST /auth/login`** — `{ email, password }` → `{ access_token, refresh_token?, user, organization, permissions, full_access, data_scope }`. Called from the Login screen. The token is stored and sent as `Authorization: Bearer <token>` on every subsequent call. `permissions`/`full_access`/`data_scope` (see §5) are cached client-side so every screen can gate buttons/menus without a round trip.
- **`POST /auth/register`** — new organization + its first Admin user in one call. Used by the public sign-up flow.
- **`POST /auth/forgot-password`** / **`POST /auth/reset-password`** — email-link based password reset, two steps (request → submit new password with the token from the email link).
- **`POST /auth/change-password`** — logged-in user changing their own password from their profile page.
- **`GET /auth/me`** — refetches the current user + org + permissions. Called on app boot/refresh to re-hydrate session state (the web app also caches this in local storage so the UI doesn't flash unauthenticated on reload — replicate with a local token+profile cache in Flutter, but always treat this call as the source of truth).
- **`POST /auth/logout`** — invalidates the session server-side; the client then clears its local token.
- **`POST /auth/exchange`**, **`POST /auth/google/registration-info`**, **`POST /auth/google/complete-registration`** — Google OAuth sign-in/sign-up flow (exchange an OAuth code for a session; for a brand-new Google user, fetch prefill info then complete registration with org details). Only relevant if the Flutter app also offers "Sign in with Google".
- **`DELETE /auth/users/{id}/permanent`** — Admin-only, permanently erases a user (distinct from the soft-delete in §4). Used from User Management's "Permanently Delete" action, behind a confirmation modal.

## 2. Organization / Company Settings

- **`GET /organizations/settings`** / **`PUT /organizations/settings`** — the full Company Settings page: legal/trade name, GST/PAN, addresses, authorized person, branding, bank details, online presence, documents. One big object, PUT replaces it wholesale (the web app always sends the full merged object, never a partial patch, since this endpoint is PUT not PATCH).
- **`GET /organizations/overview`** — powers both the Company Settings dashboard widget (profile-completion %, employee/branch counts) **and** the Audit Log screen, via its `recent_activity` array (`{title, description, by, at, type}`). There's no separate `/audit-logs` endpoint — this is it, capped by `activity_limit` (default 10, web app requests 50 for the audit log view).
- **`GET /organizations/me`** — lighter-weight "current org state" (plan, trial status) used by Billing History.
- **`GET/DELETE /organizations/settings/documents/other`** — a free-form "other documents" bucket distinct from the named document slots (GST certificate, etc.) in the main settings object.
- **`POST /organizations/settings/logo`**, **`.../signature`**, **`.../upload-file`**, **`.../documents/other`** — each is a dedicated multipart upload endpoint (not the generic `/files/upload` in §31) because they also update the organization record's corresponding field server-side in one call.
- **`POST /organizations/upgrade-request`** — Admin requests a plan upgrade; creates a pending request a Super Admin later approves/rejects (§33).
- **`GET /companies`** — a *different*, simpler endpoint: `?active=true` list of companies for a dropdown filter (used only on the Admin Dashboard's company filter), not the org's own settings.
- **`GET/PUT /organizations/settings/fields`** — "Object Field Settings": which fields are mandatory per module (Customer, Supplier, Product, etc.), configured by Admins in Roles & Permissions settings.

## 3. Appearance / Theme

- **`GET /organization/theme`** — also embedded directly in `GET /auth/me`'s response, so this standalone call is mainly used to *refresh* the theme after a save, not on every page load.
- **`PATCH /organization/theme`** — `{ custom_enabled?, mode?, primary_color?, overlay_opacity? }`. Partial update — only changed fields are sent.
- **`POST /organization/theme/background`** (multipart) / **`DELETE /organization/theme/background`** — upload or remove the background image. The backend has no "pick one of our 4 bundled presets" concept — even a preset background is uploaded as a real file through this same endpoint.
- **`POST /organization/theme/reset`** — one call, reverts mode/accent/background to the plain default for the whole org.
- All of it is applied **org-wide**, not per-user — every user in the organization sees the same theme. There's a full write-up of exactly how staging/saving should work in this repo's own `src/features/settings/ThemeSettings.jsx` if you want the precise UX reference.

## 4. Users / Staff / Employees

- **`POST /users`** — create staff. Sectioned payload: `{ basic_information, contact_information, address_information, employment_information, payroll_information, ... }` (see `src/api/users.js`'s `buildSectionedUserBody` for the exact field map). `employee_id` (the business ID, e.g. `EMP-10001-2027-0001`) is **never** sent — it's entirely backend-generated.
- **`GET /users`** — Staff list (User Management). Admin-only (403 for everyone else) — that's why Delivery Partner lookups use `/users/assignable` or `/deliveries/partners` instead.
- **`GET /users/assignable`** — a non-admin-safe staff list (just id/name/role) for "assign to" dropdowns anywhere a non-admin needs to pick a colleague.
- **`GET /users/{id}`** / **`GET /users/{id}/overview`** — Staff Detail page + its KPI dashboard (delivery/sales performance depending on role).
- **`PATCH /users/{id}`** — edit; also reused for the narrower "clear one file field" and "clear a document slot" actions (just sends `{ [field]: null }`).
- **`DELETE /users/{id}`** — soft delete/deactivate (distinct from the permanent-delete in §1).
- **`POST /users/{id}/reset-password`** — Admin resets another user's password directly (no email flow).
- **`POST /users/me/location`** — a delivery partner's live location ping, polled periodically while they're on a delivery route (powers whatever "where's my driver" view exists).
- **`DELETE /users/{id}/documents/{field}`** — remove one uploaded employee document (Aadhaar, PAN, etc.) by its field name.

## 5. Roles & Permissions

This is the access-control backbone — **replicate this model exactly** in Flutter, don't invent your own.

- **`GET /roles/catalog`** — the universe of `{modules, actions}` the permission matrix can be built from (e.g. modules: `customers`, `orders`, `supplier_payments`...; actions: `view`, `create`, `edit`, `delete`, `approve`...). Used only when building/editing a role.
- **`GET /roles`** / **`GET /roles/{id}`** — list/detail for Roles & Permissions settings.
- **`POST /roles`** / **`PATCH /roles/{id}`** — `{ name, workspace, description, data_scope, permissions }`. `workspace` scopes a role to Sales/Delivery/Finance (filters which modules are even relevant). `permissions` is the **complete** matrix every time — PATCH still expects the full object, not a diff (the backend removed a plain PUT in favor of this). `data_scope` is one of `own` / `team` / `organization` — it governs which *rows* a user can see within a module they already have `view` on (e.g. a Sales Officer with `data_scope: own` only sees their own customers).
- **`DELETE /roles/{id}`** — blocked server-side if staff are still assigned to it (surfaces as a normal error).
- **How a screen actually checks access**: `GET /auth/me` returns `permissions: {module: {action: true/false}}` + `full_access: boolean` (Admin bypasses the matrix entirely) + `data_scope`. Every button, nav item, and list filter in the web app checks `fullAccess || permissions[module][action]` before rendering — build the same `can(module, action)` helper in Flutter, driven by the same cached response.

## 6. Customers

- **`POST /customers`** / **`PATCH /customers/{id}`** — sectioned payload (`basic_information`, `contact_information`, `address_information`, documents, GST/bank info, assigned sales officer, Google Maps location). `customer_id` (business ID, e.g. `CS-10001-2027-0001`) is read-only, never sent.
- **`GET /customers`** — supports `search`, `category`, `is_active`, `assigned_sales_officer_id`, `has_outstanding` (used by the "Collect Payment" flow to only show customers who owe money). Used by Customer List, and every picker that needs "choose a customer" (Order/Quotation/Invoice creation, Lead conversion, etc.).
- **`GET /customers/{id}`** — Customer Detail, prefill for Edit.
- **`DELETE /customers/{id}`** — only allowed if the customer has no orders/invoices (backend-enforced; shows as an error otherwise).
- **`GET/DELETE /customers/{id}/documents[/{docId}]`** — uploaded KYC/business documents specific to this customer.
- **`POST /customers/{id}/payments`** / **`GET /customers/{id}/payments`** — a *legacy* per-customer payment record endpoint, superseded for new work by the standalone Payment Receipts module (§23) but still read for historical data on the Customer Detail page.
- **`GET /customers/{id}/account-statement`** — a running ledger (invoices + payments) for one customer, used by the "Download Statement" action.
- **`GET /customers/{id}/payments/receipt/{paymentId}`** — a single payment's printable receipt.
- **`DELETE /customers/{id}/payments/{paymentId}`** — void a recorded payment.
- **`GET /customers/{id}/visits`** / **`GET /customers/{id}/follow-ups`** — scoped views used inside Customer Detail's activity tabs (same underlying records as §13, just filtered to one customer).
- **`POST /customer-payments/collections`** — the *current* way a sales/delivery staff member records money collected from a customer (cash/UPI/cheque), independent of any specific invoice. This is what actually moves outstanding-balance numbers today, not the legacy `/customers/{id}/payments` above.

## 7. Suppliers

- **`POST /suppliers`** / **`PUT /suppliers`** — note **PUT**, not PATCH, for edit — the web app always sends the complete supplier object. `supplier_code` (business ID, e.g. `SUP-0001`) is read-only.
- **`GET /suppliers`** — supports `search`, `category`, `is_active`, `skip`/`limit`. Used by Supplier List and every "pick a supplier" selector (Purchase creation, Product's preferred-supplier field, etc.) — those selectors show `Name · SUP-0001`.
- **`PATCH /suppliers/{id}/status`** — a narrower endpoint just for activate/deactivate, separate from the full PUT edit.
- **`POST/GET/DELETE /suppliers/{id}/payments[/{paymentId}]`** — same "legacy, superseded by §25" relationship as Customer payments above; kept for historical reads.
- **`GET/POST/DELETE /suppliers/{id}/products[/{productId}]`** and **`.../brands[/{brandId}]`** — many-to-many links: which products/brands this supplier is known to supply, used by Product Form's "Preferred Supplier → narrows Brand options" cascading dropdown.

## 8. Products

- **`POST /products`** / **`PATCH /products/{id}`** — large payload: pricing, inventory thresholds (reorder level/quantity), tax (HSN, GST rate), physical attributes (weight/dimensions — **`weight_kg` per unit is what Vehicle Loading's capacity math uses**, see §16-18), variants, and up to 8 distinct document/media upload slots (cover image, gallery images, video, catalog brochure, manual, datasheet, compliance cert, warranty doc). `product_id` (business ID, `PRD-0001`) is read-only.
- **`GET /products`** — `search`, `category_id`, `is_active`, `barcode`. Used everywhere a product needs picking: Order/Quotation/Purchase line items, Product List, Vehicle Loading's product-weight lookup.
- **`DELETE /products/{id}`** / **`POST /products/bulk-delete`** — single and multi-select delete from Product List.
- **`GET /products/{id}/batches`** / **`.../serials`** — for products with batch or serial-number tracking enabled, the actual tracked units (expiry dates, serial numbers) shown on Product Detail / used during delivery confirmation to record which batch/serial actually shipped.
- **`GET/POST/DELETE /products/{id}/attachments[/{attachmentId}]`** — a general attachments list distinct from the named document slots above.

## 9. Brands / 10. Categories

Standard CRUD pairs, both support `search`, both have `POST /{module}/bulk-delete` for multi-select delete from their List pages. Brands additionally link to Categories (`GET/POST/DELETE /brands/{id}/categories[/{categoryId}]`) — a brand can be associated with specific categories, which narrows Product Form's Category dropdown once a Brand is picked. Categories have **no** business-ID/code field at all (confirmed by inspecting the frontend — Category is pure name + description, nothing else to carry).

## 11. Warehouses, Stock & Transfers

- **`GET/POST/PATCH/DELETE /warehouses[/{id}]`** — standard CRUD. A Purchase/Order/Delivery always resolves to exactly one warehouse (see §16-19's `warehouse_id` resolution rule).
- **`GET /warehouses/stock`** — org-wide stock-by-warehouse grid (Stock Board).
- **`POST /warehouses/{id}/stock/adjust`** — manual stock correction (shrinkage, damage, recount) with a required reason, logged as a movement.
- **`GET /warehouses/{id}/movements`** — the audit trail of every stock-in/stock-out event for that warehouse (purchases received, deliveries loaded, transfers, adjustments — all flow into this one timeline).
- **`GET/POST /transfers`**, **`GET /transfers/{id}`** — move stock between two warehouses. `POST /transfers` creates a Draft; it only actually moves stock once dispatched **and** received.
- **`POST /transfers/{id}/dispatch`** → **`.../receive`** → or **`.../cancel`** — the transfer's 3-step lifecycle (draft → dispatched → received, or cancelled from either earlier state).
- **`GET/GET/POST/PATCH /inventory...`** — a second, simpler "current stock + batch expiry" view (`getStockBoard`, `getProductStock`, `recordStockAdjustment`, `getExpiringBatches`, `setExactStock`) used by the Inventory/Stock Board pages specifically; conceptually overlaps with `/warehouses/stock` but is the one the Stock Board screen actually calls.

## 12. Leads

- **`POST /leads`** / **`PATCH /leads/{id}`** — a prospect not yet a customer: name, contact, source, assigned salesperson, status (`new` → `contacted` → `qualified` → `won`/`lost`, exact vocabulary in `src/auth/roles.js`/Lead feature files).
- **`GET /leads`** — supports `search` server-side. Lead List, and "pick a lead" in Quotation/Visit/Follow-up creation.
- **`POST /leads/{id}/convert-to-customer`** — the one-way conversion: creates a real Customer record from the lead's data and returns the new Customer's business ID (`CS-...`) — the web app immediately navigates to/displays that new customer. The lead itself stays around as history, marked converted.
- **`DELETE /leads/{id}`** — removes a lead that never converted.

## 13. Visits & Follow-ups

- **`POST/GET/PATCH/DELETE /visits[/{id}]`** — a logged field visit to a lead or customer: check-in location (lat/lng), visit type, outcome notes. `GET /visits` filters by `customer_id`/`lead_id`/`user_id`/`status`. Used by Visit Check-In (field sales staff logging a visit) and the Lead/Customer Detail activity timelines.
- **`POST /visits/{id}/follow-ups`** — schedule a follow-up task directly off a specific visit (as opposed to a standalone one below).
- **`POST /follow-ups`** — a task tied to a Lead **or** Customer **or** Visit (exactly one relationship, `lead_id`/`customer_id`/`visit_id`), with `due_date`, `priority`, and an assignee (defaults to the current user if omitted).
- **`GET /follow-ups`** — supports `status`, `priority`, `due_before`/`due_after`, and real pagination (`limit` default 100 / max 500, `offset`) — **use the pagination**, don't assume the first page is everything if an org has many pending follow-ups.
- **`PATCH /follow-ups/{id}`** — edit (reschedule, reassign).
- **`POST /follow-ups/{id}/complete`** — `{ outcome?, outcome_notes? }`. `outcome` has a small fixed vocabulary (e.g. `ready_to_convert`, `need_another_followup`, `ready_for_visit`) that the UI uses to surface a contextual "next action" button (Convert Lead / Add Follow-up / Log Visit) right after completion.
- **`DELETE /follow-ups/{id}`** — remove a task that's no longer relevant.

## 14. Quotations

- **`POST /quotations`** / **`PATCH /quotations/{id}`** — line items against a Lead **or** Customer, with pricing/discount/tax per line. `PATCH` is also used for status-only transitions (e.g. marking it Sent).
- **`GET /quotations`** — **no server-side search or pagination today** — the web app loads the full list and filters client-side. If your org has a very large quotation history, raise this with the backend before assuming the same approach scales.
- **`POST /quotations/{id}/convert-to-order`** — one-way, creates a Sales Order from the quotation's lines and returns the new Order's business ID (`SO-...`).
- **`GET /quotations/{id}/pdf`** — backend-rendered PDF, matching whatever branding/typography the org configured in Invoice Settings (§22) — the frontend never generates this PDF itself.
- **`DELETE /quotations/{id}`** — only while still in an editable (not-yet-converted) state.

## 15. Sales Orders

- **`POST /orders`** / **`PATCH /orders/{id}`** — customer, line items, delivery warehouse, and either a direct order or one created from a Quotation (carries `quotation_id`).
- **`GET /orders`** — supports `status`, `fulfilment_status`, `customer_id`, `assigned_delivery_partner_id`, `search`.
- **`POST /orders/{id}/confirm`** — commits a Draft order (no stock movement yet — that only happens at delivery/pickup).
- **`PATCH /orders/{id}/assign-delivery-partner`** — pick/change which delivery partner (or vehicle) will fulfill it.
- **`POST /orders/{id}/pickup/start`** → **`/pickup/ready`** → **`/pickup/confirm`** — the walk-in/counter "pickup" fulfillment path (as opposed to a Delivery, §16) for a customer collecting their own order.
- **`PATCH /orders/{id}/cancel`** — only before it's been fulfilled.
- **`DELETE /orders/{id}`** — Draft orders only.
- **`POST /orders/{id}/invoice`** — generate a Sales Invoice directly from this order (an alternative to creating an Invoice standalone in §22); optionally carries a specific `delivery_id` when the org invoices per-delivery rather than per-order.

## 16. Deliveries

This module has the richest lifecycle in the whole system — study the status flow carefully.

- **Status flow**: `planned → accepted → picking → ready → loaded → in_transit → delivered`, with off-flow outcomes `rejected` / `partially_delivered` / `failed` / `cancelled` possible at various points. Newer records expose the exact stage directly (`internal_status`); treat the collapsed legacy `status` field as a fallback only if `internal_status` is absent.
- **`GET /deliveries/partners`** — a lightweight, non-admin-safe partner list (unlike `/users`, which 403s for non-admins) — used for "assign delivery partner" dropdowns by anyone.
- **`GET /deliveries`** — `status`, `order_id`, `delivery_partner_id`, `open_only`.
- **`GET /deliveries/by-id/{id}`** — Detail page; response includes `warehouse: {id, name} | null` and, per line, `uom`, `warehouse_available` (reservation-aware — this delivery's own stock hold counts as available; other orders' holds don't), and `weight_kg` (per-unit, `null` when unknown).
- **`POST /deliveries`** — plan a new delivery against a confirmed order.
- **`PATCH /deliveries/by-id/{id}`** — reschedule, reassign partner/vehicle.
- **`POST /deliveries/{id}/accept`** / **`.../reject`** — the assigned delivery partner's first action.
- **`POST /deliveries/{id}/pick`** — `{ items: [{delivery_item_id, picked_quantity}] }`, recording what was actually pulled from the warehouse (may be less than planned).
- **`POST /deliveries/{id}/ready`** — only call this if the delivery **isn't already** in the Ready state — calling it redundantly is a no-op error, not idempotent, so check `internal_status` first.
- **`POST /deliveries/{id}/load`** — moves this *one* delivery's picked stock onto the vehicle. Warehouse resolves as `delivery.warehouse_id → order.warehouse_id`, else a 400 (the backend never silently falls back to an org "default" warehouse).
- **`POST /deliveries/load-batch`** — `{ delivery_ids: [...] }`, loads several deliveries in one call; **always prefer this over looping single `/load` calls** when loading more than one delivery (that's exactly what Vehicle Loading's "Confirm Vehicle Load" button does — see §18). Repeating `/load` on an already-fully-loaded delivery returns a clean 400, never double-moves stock.
- **`POST /deliveries/{id}/confirm`** — the final delivery confirmation (POD): quantities actually delivered per line, signature/photo proof, failure reason if applicable. Also accepts being called again from `partially_delivered` to confirm the remaining quantity.
- **`GET /deliveries/{id}/challan/pdf`** — backend-rendered delivery challan/receipt PDF.
- **`GET /deliveries/assigned`** — "my deliveries" for the logged-in delivery partner.
- **`PATCH /deliveries/{orderId}/status`** — legacy, pre-dates the granular accept/pick/ready/load/confirm flow above; kept only for old records that never got the newer fields.

## 17. Delivery Collections (cash/UPI collected on delivery)

- **`POST /deliveries/{id}/collections`** — a delivery partner records money collected from the customer at drop-off (cash, UPI reference, etc.) — distinct from the general customer-collection endpoint in §6.
- **`GET /deliveries/{id}/collections`** — scoped to one delivery (shown on Delivery Detail).
- **`GET /deliveries/collections`** — org-wide view (Collection Reconciliation screen), supports `status`, `search`, `customer_id`, `order_id`.
- **`GET /deliveries/collections/{id}`** — detail drawer.
- **`POST /deliveries/collections/{id}/reconcile`** — Finance/Admin confirms the cash was actually received into the business — this is the step that creates the matching customer-payment record and updates the customer's outstanding balance. Response includes the created payment's reference so the UI can link to it.
- **`POST /deliveries/collections/{id}/void`** — only before reconciliation; a reconciled collection can't be voided (undo that step instead, if the backend supports one — check before assuming).

## 18. Vehicles & Vehicle Stock

- **`GET/POST/PATCH/DELETE /vehicles[/{id}]`** — fleet CRUD: registration number, type, capacity (kg), default driver.
- **`GET /vehicles/{id}/assignments`** / **`.../activity`** — which driver has/had this vehicle, and its movement/usage log.
- **`POST /vehicle-stock/loading`** — the *older*, single-session "load everything onto this vehicle for today" call — largely superseded for multi-delivery loading by `/deliveries/load-batch` (§16), but still the entry point that opens a vehicle-stock session for a driver's shift.
- **`GET /vehicle-stock/current/{deliveryPartnerId}`** — what's currently physically on this driver's vehicle (feeds the "Already on Vehicle" section of Vehicle Loading, alongside deliveries whose `internal_status` is `loaded`/`in_transit`).
- **`POST /vehicle-stock/{sessionId}/extra-load`** — add more stock to an already-open session mid-day.
- **`POST /vehicle-stock/{sessionId}/end-of-day`** — closes the session: whatever wasn't delivered gets recorded as returned to the warehouse.
- **`GET /vehicle-stock`** — session history list.
- **`POST /vehicle-stock/{sessionId}/reconcile`** / **`GET /vehicle-stock/{sessionId}/reconciliations`** — physical stock-count reconciliation against what the system thinks is on the vehicle.
- **Vehicle Loading's capacity math** (worth replicating exactly): `remainingLoadQty = picked_quantity - loaded_quantity` per line; `lineWeight = remainingLoadQty × weight_kg`; sum known-weight lines for "known load", and separately list by name any product whose `weight_kg` is `null` — **never block loading locally just because a weight is missing**; the backend is the final authority on whether the vehicle is over capacity.

## 19. Purchases & Goods Receipt (GRN)

- **Purchase lifecycle**: `draft → confirmed → closed`, or `cancelled`. Confirming a Purchase moves **zero** stock — only a **confirmed GRN** actually receives stock into a warehouse. Closing requires `confirmed` **and** `receiving_status: fully_received`.
- **`POST /purchases`** / **`PATCH /purchases/{id}`** — commercial fields only (supplier, items, prices, discount/tax, notes) — receiving fields (`received_qty`, `receiving_status`) are entirely server-managed and never sent from the client.
- **`GET /purchases`** — `supplier_id`, `warehouse_id`, `status`, `receiving_status`, `payment_status`, `search`, `skip`/`limit`.
- **`GET /purchases/{id}`** — each line includes `received_qty` already rolled up server-side from its GRNs — don't separately sum GRN lines client-side to get this number.
- **`POST /purchases/{id}/confirm`** / **`.../close`** — the two lifecycle steps above.
- **`PATCH /purchases/{id}/payment-status`** — `{ payment_status, amount_paid? }`, independent of the confirm/close lifecycle.
- **`POST /purchases/{id}/cancel`** — `{ reason? }`.
- **`POST /purchases/{id}/documents`** — attach the supplier's paper invoice/scan.
- **`POST /purchases/{id}/returns`** — a **legacy** direct-return endpoint (items + reason, nothing tracked beyond a stock-out) — new return workflows should use §20 instead; this one still exists for backward compatibility only.
- **`GET/POST/PATCH /grns[/{id}]`** — Goods Receipt Notes are the actual stock-receiving transaction against a confirmed Purchase: which items, how many accepted/damaged/rejected, which warehouse, optional batch/serial/expiry capture.
- **`POST /grns/{id}/confirm`** — this is the call that actually moves stock in. **`POST /grns/{id}/cancel`** reverses an unconfirmed draft GRN.
- **`DELETE /grns/{id}`** — draft only.
- Two distinct "invoice-looking" fields on a Purchase, never merge them: `purchase_number` (system-generated PO business ID, `PO-10001-2027-0001`) vs `invoice_number` (the supplier's own paper reference, user-typed, may be blank).

## 20. Purchase Returns

- **Lifecycle**: `draft → confirmed → dispatched → completed`, or `cancelled` from `draft`/`confirmed`.
- **`GET /purchase-returns`** — `status`, `supplier_id`, `purchase_id`, `search`, `date_from`/`date_to`, and real `page`/`page_size` pagination (response includes `total` — **use it**, don't assume one page is the whole result set).
- **`POST /purchase-returns`** — against one specific confirmed Purchase; each line's returnable quantity is `received_qty − Σ(non-cancelled previous returns for that line)` — cancelled returns must **not** reduce what's still returnable, and a return being edited must not double-count itself against its own prior quantity.
- **`PATCH /purchase-returns/{id}`** — draft only.
- **`POST /purchase-returns/{id}/confirm`** → **`.../dispatch`** → **`.../complete`** — the three forward lifecycle steps, each a no-payload POST.
- **`POST /purchase-returns/{id}/cancel`** — `{ cancel_reason }`.

## 21. Sales Returns

- **Lifecycle**: `requested → received → approved` (no separate "complete" step — approved is terminal), with `rejected`/`cancelled` possible.
- **`GET /sales-returns`** — `status`, `customer_id`, `invoice_reference_id`. **No pagination support** — full list loaded, filtered client-side; same caveat as Quotations if the list grows large.
- **`GET /sales-returns/{invoiceReferenceId}`-style lookup via `getInvoiceReturnedQuantities`** — before creating a new return against an invoice, fetch what's already been returned so you don't let a customer return the same units twice.
- **`POST /sales-returns`** — anchored to a specific sold Invoice (or Order), with per-line return quantity and reason.
- **`PATCH /sales-returns/{id}`** — draft-stage edits.
- **`PATCH /sales-returns/{id}/receive`** — warehouse confirms the physical goods came back.
- **`PATCH /sales-returns/{id}/approve`** — Finance/Admin approves the credit; this is what actually generates the credit note / adjusts the customer's balance.
- **`PATCH /sales-returns/{id}/reject`** — `{ reason }`.
- **`DELETE /sales-returns/{id}`** — requested stage only.

## 22. Sales Invoices & Payment Links

- **`POST /invoices`** — can be created directly (walk-in/manual) or via `/orders/{id}/invoice` (§15) — both land here conceptually. Line items, customer, due date.
- **`GET /invoices`** — `customer_id`, `status`, `order_id`. **No pagination** today — same full-list caveat.
- **`GET /invoices/{id}/pdf`** — backend-rendered, respecting the org's saved Invoice Settings (template, typography, thermal receipt layout if applicable) — **never** regenerate this layout client-side; always fetch the real PDF.
- **`POST /invoices/{id}/credit-note`** — issues a credit note against this invoice (distinct from a Sales Return, though often triggered by one).
- **`GET/PATCH /invoice-settings`** — org-wide invoice branding/template/typography/thermal-print configuration (one object, not per-invoice).
- **`POST /invoices/{id}/payment-link`** — generates a Razorpay-backed online payment link for this specific invoice, mailed/shared to the customer.
- **`GET /invoices/{id}/payment-links`** — history of links generated for this invoice (a 409/duplicate response when creating a new one while an active one exists points you back at the existing link via the response body).
- **`POST .../payment-links/{linkId}/cancel`** / **`GET .../payment-links/{linkId}/refresh`** — cancel an unpaid link, or re-check its live status against Razorpay.

## 23. Customer Payments (receipts ledger)

The **current** canonical record of "a customer paid us" — prefer this over the legacy per-customer endpoints in §6 for anything new.

- **`GET /payment-receipts`** — `customer_id`, `invoice_id` filters. This is what invoice detail pages and customer statements actually read to build the payment history / aging.
- **`POST /payment-receipts`** — record a payment, optionally allocated against one or more specific invoices (overpayment beyond what's owed should be guarded against client-side too, not just trusted to the backend).
- **`PATCH/DELETE /payment-receipts/{id}`** — correct or void a recorded receipt.

## 24. Supplier Invoices & Accounts Payable

- **Supplier Invoice lifecycle**: `draft → recorded → cancelled`, independently tracked against `verification_status` (`pending`/`matched`/`mismatched` — did it reconcile against the PO/GRN) and `payment_status`.
- **`POST /supplier-invoices`** / **`PUT /supplier-invoices/{id}`** (note PUT for edit, like Suppliers) — against a specific Purchase, with the supplier's own invoice number/date and amount.
- **`GET /supplier-invoices`** — `supplier_id`, `purchase_id`, `status`, `verification_status`, `payment_status`, `search`, and real `page`/`page_size`.
- **`POST /supplier-invoices/{id}/record`** — moves draft → recorded (the commitment step).
- **`POST /supplier-invoices/{id}/cancel`** — `{ reason }`.
- **`GET /accounts-payable`** — **read-only** derived view: every unpaid/partially-paid supplier invoice, aged.
- **`GET /accounts-payable/summary`** — total payable + overdue/due-soon buckets, for dashboard tiles.
- **`GET /accounts-payable/supplier/{id}`** — one supplier's own payable statement.

## 25. Supplier Payments

- **`POST /supplier-payments`** — pay a supplier, allocated across one or more of their open invoices in one call.
- **`GET /supplier-payments`** — `supplier_id`, `status`, `payment_method`, `search`, `date_from`/`date_to`, real `page`/`page_size` pagination.
- **`GET /supplier-payments/{id}`** — detail, including the per-invoice allocation breakdown.
- **`POST /supplier-payments/{id}/void`** — `{ reason }` — reverses the allocations, re-opening the invoices it had paid down.
- **`GET /supplier-invoices/{id}/payments`** — the flip side: every payment that's touched one specific supplier invoice.

## 26. Expenses

- **Lifecycle**: `pending → approved` (or `rejected`, or `clarification_requested` → back to `pending` once the submitter updates it). Reimbursement is tracked via a separate `payment_status` flag (`approved` + `payment_status: paid` reads as "Reimbursed" in the UI) — **there is no dedicated `/reimburse` endpoint**; reimbursement is just a `PATCH .../{id}` payment-status update.
- **`GET /expenses/categories`** — the org's configured expense categories (Travel, Fuel, Office Supplies, etc.).
- **`POST /expenses`** — category, amount, date, description, optional receipt.
- **`GET /expenses`** — `category`, `status`, `submitted_by`. **No date-range param** — if you need a date filter in Flutter, filter the already-fetched list client-side, same as the web app does.
- **`POST /expenses/{id}/receipt`** — attach a receipt image/PDF after the fact.
- **`PATCH /expenses/{id}/approve`** / **`.../reject`** — approver actions (gated by the `expenses:approve` permission).
- **`PATCH /expenses/{id}/request-clarification`** — `{ clarification_note }` — kicks it back to the submitter without rejecting outright.
- **`DELETE /expenses/{id}`** — submitter can withdraw their own pending expense.

## 27. Attendance

- **`POST /attendance/check-in`** — the single "clock in" / "clock out" action, called twice a day (the type of event — in vs out — is a field in the body, there's no separate check-out endpoint).
- **`GET /attendance/me`** — the logged-in user's own history, `date_from`/`date_to` supported — **always pass a bounded range**; an unbounded call pulls the user's entire attendance history.
- **`GET /attendance`** — org-wide (Admin view), `user_id`, `date_from`/`date_to` — same bounding advice applies even more strongly here.

## 28. Leaves

- **Lifecycle**: `pending → approved`/`rejected`, or `cancelled` by the requester before either happens.
- **`POST /leaves`** — `{ leave_type, start_date, end_date, reason }`; the backend computes the day count.
- **`GET /leaves/me`** — no params — the requester's own full history (self-service, so no filtering needed).
- **`GET /leaves`** — Admin/approver view: `user_id`, `status`, `leave_type`, `date_from`/`date_to`.
- **`PATCH /leaves/{id}`** — requester edits/cancels their own still-pending request.
- **`PATCH /leaves/{id}/approve`** / **`.../reject`** — `{ reason? }` on reject.

## 29. Notifications

- **`GET /notifications`** — `?unread_only=true` optional. Each notification's `title`/`body` is plain backend-authored text (the backend already formats in the relevant order/delivery/invoice number — the frontend never reconstructs a business ID from a notification's data).
- **`GET /notifications/unread-count`** — polled periodically to drive a badge count in the nav (check how aggressively — the web app does this from a layout-level Topbar component, not per-page).
- **`PATCH /notifications/{id}/read`** / **`PATCH /notifications/read-all`**.

## 30. Reports & Dashboard

- **`GET /reports/{type}`** — `type` is one of: `daily-transaction`, `sales`, `purchase`, `customer-outstanding`, `supplier-outstanding`, `payment-collection`, `expense`, `cash-collection`, `gst-summary`, `sales-return`, `purchase-return`, `profit-loss`. Common params: `date_from`/`date_to` (or a named range like `daily`/`weekly`/`monthly`/`last-month`/`fy`).
- **`GET /reports/{type}/export`** — same params, returns a downloadable file (Excel/PDF depending on report) instead of JSON.
- **`GET /dashboard/admin`** — the single call behind the whole Admin Dashboard: KPI tiles, charts, recent activity, filterable by `company_id`/`warehouse_id`/`customer_id`/`supplier_id`/period — all optional, only non-empty ones are sent.

## 31. Files

The generic upload endpoint used by **everything that isn't one of the dedicated upload endpoints
already covered above** (product images, customer documents, expense receipts, GRN attachments, etc).

- **`POST /files/upload`** (multipart, field `file`) → `{ url, file_id }`. The frontend stores the **portable path** (`/files/{id}`), not the full URL, on the owning record — then resolves it back to a full URL for display at read time by prefixing the API base. Do the same in Flutter: store the relative path, resolve it with your own base URL when rendering.
- **`GET /files/{id}`** — fetch a file's metadata/content.
- **`DELETE /files/{id}`** — used specifically to clean up an upload the user made but then cancelled before actually attaching it to a record (so it doesn't become an orphaned file server-side).

## 32. Billing (organization's own subscription) & Payment Gateway settings

- **`POST /billing/razorpay/order`** → **`POST /billing/razorpay/verify`** — the two-step Razorpay flow for the org **itself** paying for its CRM subscription (distinct from Invoice Payment Links in §22, which are the org's *customers* paying *them*). A `503` from the order-creation call means Razorpay isn't configured for this environment yet — the UI falls back to a manual "request upgrade" flow (§2's `/organizations/upgrade-request`) rather than showing a hard error.
- **`GET /billing/payments`** — this organization's own subscription payment history (Billing History screen).
- **`GET /plans`** — the catalog of subscription plans an org can choose/upgrade to.
- **`GET/PUT/DELETE /settings/payment-gateway`** — the org's **own** Razorpay credentials, for accepting payments from their customers (powers §22's payment links). **`POST .../test`** does a connectivity/credentials check without processing a real transaction.

## 33. Super Admin (platform-level, cross-organization)

Everything here requires the Super Admin role — completely separate permission tier from §5's
per-organization roles.

- **`GET /superadmin/organizations`** — every org on the platform, `status`/`upgrade_status` filterable.
- **`GET/DELETE /superadmin/organizations/{id}`** — detail / permanently remove a tenant.
- **`PATCH .../approve-upgrade`** / **`.../reject-upgrade`** — resolves a pending plan-upgrade request from §2.
- **`PATCH .../status`** — suspend/reactivate an organization's access.
- **`GET/POST/PATCH/DELETE /superadmin/admins[/{id}]`** — manage other Super Admin accounts.
- **`GET/POST/PUT /superadmin/plans[/{id}]`**, **`PATCH .../status`**, **`.../deactivate`**, **`DELETE .../{id}`** — the subscription plan catalog every organization picks from in §32.
- **`GET /superadmin/subscription-payments`** — platform-wide view of every org's subscription payments.

## 34. Bulk Import (Excel)

Only **3 modules** support this today — don't build a generic "import anything" screen expecting
more to work.

- **`GET /customers/import/template`** / **`POST /customers/import`**
- **`GET /suppliers/import/template`** / **`POST /suppliers/import`**
- **`GET /orders/import/template`** / **`POST /orders/import`**
- The template download streams a real `.xlsx` file matching the module's expected columns.
- The import POST (multipart `file`) **validates and commits in one atomic call** — there's no
  separate "preview then confirm" step. Valid rows are created immediately; invalid rows come back
  as `{ total_rows, valid_rows/success_count, failed_rows/error_count, created_ids, errors: [{row, field, message}] }`
  — show the user exactly which rows failed and why, since the valid ones are already committed.

## 35. Object Field Settings

Same two endpoints as §2's `/organizations/settings/fields` — listed again here because
conceptually it's its own feature (Admin configuring which fields are mandatory per module,
e.g. "require GST number on every new Customer") rather than part of the main company profile.

---

## A note on what's deliberately *not* here
**Cash Reconciliation** has no backend endpoint at all — the web app's screen for it exists but
openly shows "not available yet" in real mode. Don't scope Flutter work against an endpoint that
doesn't exist; if/when the backend adds one, it'll show up in the frontend's `src/api/cashReconciliation.js`
first.
