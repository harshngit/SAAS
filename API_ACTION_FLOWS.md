# Beas Suite CRM — API Action Flows (what fires on each screen/button, and what it actually does)

Companion to **API_LIST.md** (every endpoint) and **API_USAGE_GUIDE.md** (why/where/logic per
endpoint). This third document answers two questions together, not one: **when a user opens a
screen or taps a button, exactly which API calls fire, in what order, how many** — AND, for every
call that actually changes something (stock, money, a status), **what it changes, on which
warehouse/customer/order, and what it does NOT do.** A call count with no business-logic
explanation is not useful for a rebuild; this version pairs both for every mutating action.

Every fact below was read directly out of this frontend's own `src/api/*.js` wrapper code and its
handler/comments — not estimated, not guessed. Where the frontend code itself doesn't fully pin
down a detail (e.g. an exact backend internal rule it only reacts to), that is said explicitly
rather than invented.

**How to read each entry:**
- **Trigger** — what the user does (open screen / tap button).
- **Calls** — the endpoints that fire, numbered in actual order; "parallel" means fired together
  (`Promise.all`); "sequential" means each call waits for the previous one.
- **What it actually does** — for any call that moves stock, money, or a status: which
  warehouse/vehicle/customer/order it acts on, what field changes, and what it deliberately does
  **not** do yet (so a rebuild doesn't assume a side effect that hasn't actually happened).

---

## 0. The cross-cutting money rule — read this before §11/§12/§14

**Nothing a field-facing action records changes a customer's or supplier's balance immediately.**
Every "money collected/paid in the field" action creates a *pending* record first; a separate
Finance/Accountant **reconcile** step is what actually moves the balance, and that reconciliation
is done **by the backend**, never computed or applied locally by the frontend:

- A Delivery Partner's **"+ Collect Payment"** (any customer, not delivery-specific) → creates a
  `Collection` via `POST /customer-payments/collections`. The customer's outstanding balance is
  **unchanged** at this point.
- A Delivery Partner's **COD collection at drop-off** → creates a *different* kind of `Collection`
  via `POST /deliveries/{id}/collections`. Same rule: balance **unchanged** yet.
- Only when an Accountant/Admin taps **Reconcile** (`POST /deliveries/collections/{id}/reconcile`)
  does the backend create exactly one real `CustomerPayment` record and move the customer's /
  invoice's balance. **Void** (`.../void`) discards a collection with no balance ever having moved.
- The frontend never computes "new outstanding = old outstanding − amount" itself anywhere in this
  flow — it always re-fetches the authoritative number from the backend after a reconcile.

Keep this in mind for every "Collect Payment" button below: the button submitting successfully
does **not** mean the customer's balance just went down.

## 1. The cross-cutting stock rule — read this before §5/§6/§7/§10/§14

Stock moves in **two separate, explicit stages** for a sale, never in one jump from "warehouse" to
"customer":

1. **Warehouse → Vehicle**, triggered by a Delivery's `/load` (or the batched `/deliveries/load-batch`)
   call. This is the **only** point stock leaves the warehouse's on-hand count.
2. **Vehicle → consumed/delivered**, triggered by a Delivery's `/confirm` call. This is the point
   the stock that was sitting on the vehicle is actually consumed against the customer's delivered
   quantity. The frontend **re-fetches** the driver's live vehicle-stock session after a confirm
   rather than decrementing it locally — the backend is the only source of truth for what's still
   on the vehicle.

Picking (`/pick`) and marking ready (`/ready`) move **no stock at all** — they're purely
sequencing gates before `/load` is allowed to run. Creating an Order checks stock availability at
the target warehouse (and can reject with a structured shortage list) but does not yet move stock
— that only happens at Load.

For purchases, the direction is the same two-stage idea in reverse: a GRN's `/confirm` is the
**only** point stock enters a warehouse's on-hand count (see §10) — never the Purchase's own
`confirm`/`close` steps.

---

## 2. Calls that are not tied to any button

- **App boot / token present on launch**: `GET /auth/me` once, to re-hydrate user + permissions +
  organization before rendering any protected screen.
- **Topbar notification badge**: `GET /notifications/unread-count` once on mount, then again every
  **60 seconds** on a `setInterval` for as long as the app is open (`src/components/layout/Topbar.jsx`).
  This is the only endpoint in the whole app that is polled automatically — everything else below
  is purely user-triggered.
- **My Attendance screen's live clock**: `setInterval` every 60s, but that one only re-renders the
  on-screen current time — it makes **no** API call.

## 3. Login

**Trigger:** tap "Log In" with email + password.
**Calls:** 1 — `POST /auth/login`.
**What it does:** creates a session; the response already contains `user`, `organization`,
`permissions`, `full_access`, `data_scope` — there is **no** separate follow-up `GET /auth/me`
call. Redirect target is decided purely client-side from `user.role`.

## 4. Dashboards (role-specific, all fire on screen mount)

- **Admin Dashboard**: 4 parallel filter-option calls on mount (`GET /companies?active=true`,
  `GET /warehouses`, `GET /customers`, `GET /suppliers`), then 2 parallel data calls
  (`GET /dashboard/admin`, `GET /orders`) on mount **and** again on every filter Apply.
  **6 calls on first paint, 2 per subsequent filter change.**
- **Sales Officer Dashboard**: ⚠️ **5 calls, not 4** — 4 parallel (`GET /customers`, `GET /orders`,
  `GET /quotations`, `GET /visits?user_id={me}`) **plus** a separate, independent effect firing
  `GET /attendance/me` for the "today's check-in status" widget. A visits-call failure only empties
  that one section; a customers/orders/quotations failure blocks the whole dashboard.
- **Accountant Dashboard**: 6 parallel — the 4 report endpoints (customer-outstanding,
  supplier-outstanding, expense, gst-summary) + `GET /invoices` + `GET /payment-receipts`.
- **Delivery Partner Dashboard**: ⚠️ **3 calls, not "just load my deliveries"** —
  `GET /deliveries/assigned`-equivalent (`GET /deliveries?delivery_partner_id={me}`) in its own
  effect, plus a second effect that fires `GET /vehicle-stock/current/{me}` and then
  **sequentially** (awaited after it, not parallel) `GET /attendance/me`, for the same check-in
  widget as the Sales Officer dashboard above. A 404 from the vehicle-stock call is treated as the
  expected "no active loading session," not an error.
- **Super Admin Dashboard**: **1 call** — `GET /superadmin/organizations` (no filter).
- **Platform Analytics**: **1 call** — `GET /superadmin/organizations` (no filter) — a separate,
  independent fetch from the Dashboard above, not a shared cache.

**Behavior notes:** no dashboard retries a failed tile or falls back to cached data — each tile
shows its own error state independently.

## 5. Leads → Convert to Customer

**Trigger:** "Convert to Customer" from Lead Detail, Leads list, Follow-ups, or Visits.
**Calls, in order:**
1. *(only from Follow-ups/Visits, which only hold a bare `leadId`)* `GET /leads/{id}`.
2. *(only if the caller didn't already supply a salesperson list)* `GET /users`.
3. On submit: `POST /leads/{id}/convert-to-customer`.
**What it does:** one-way and atomic — creates a real Customer record from the lead's data and
returns its new ID/business number in the same response (no second lookup needed). The original
Lead record is **not deleted** — it stays as history, flagged converted.

## 6. Quotations

- **Open "Create Quotation"**: 4 parallel (3 if the user is a Sales Officer, who can't reassign
  ownership so `GET /users` is skipped entirely, no network call) — `GET /customers`, `GET /leads`,
  `GET /products`, `GET /users`.
- **Submit**: 1 call — `POST /quotations` or `PATCH /quotations/{id}`. Creates/updates the
  quotation only — **no stock is checked or reserved** at this stage, since a quotation isn't a
  commitment yet.
- **"Convert to Order"**: 1 call — `POST /quotations/{id}/convert-to-order`. This is where stock
  availability first gets checked (see §7's order-creation stock check) — converting carries the
  quotation's lines into a brand-new Order in one atomic step and returns that Order directly.
- **Bulk delete**: **N parallel** `DELETE /quotations/{id}` calls, one per selected row — not a
  single batch endpoint.

## 7. Sales Orders

- **Open "Create Order"**: 4 parallel (3–5 depending on mode) — `GET /products`, `GET /customers`,
  `GET /warehouses`, `GET /deliveries/partners` (skipped if editing, or if this is the restricted
  delivery-vehicle self-order flow); +1 sequential prefill call (`GET /orders/{id}` or
  `GET /quotations/{id}`) if opened in edit/duplicate/from-quotation mode.
- **Submit create**: 1 call — `POST /orders`.
  **What it does:** creates the order at status `draft` **and checks stock availability for every
  line against the chosen `warehouse_id` in the same call.** If any line requests more than that
  warehouse's available quantity, the backend rejects the whole order with a structured
  `INSUFFICIENT_STOCK` error — a per-product list of `{product_name, requested, available}` — which
  the frontend surfaces as "Not enough stock: Product X (need 50, have 12), ...". **No stock
  actually moves yet** even on success — `draft` is a commitment to fulfil, not a stock movement; a
  delivery partner is sent inside this same create call if picked at creation time, there is no
  separate "assign partner" call for a brand-new order.
- **Submit edit**: 1 call — `PATCH /orders/{id}` — same per-line stock check applies if quantities
  changed. Blocked by the backend (400) once the order is cancelled/completed, already invoiced, or
  has an out-for-delivery/loaded delivery against it.
- **Confirm Order** (Order Detail, separate button from create): `POST /orders/{id}/confirm` — the
  **only** transition from `draft` to `confirmed`. This is a status/commitment change only, not a
  second stock check and not a stock movement.
- **Open Order Detail**: ⚠️ **Significantly more than "a few parallel calls" — corrected below**,
  one of the heaviest screens in the app. In the order the code fires them:
  1. `GET /orders/{id}` — the order itself. Its response already embeds enough for the "Order
     Progress" stepper and the Delivery Summary card (delivery number, partner, fulfilment/pickup
     status) directly — those are **not** separate calls, they're fields on this one response.
  2. `GET /products` — the **full, unfiltered** product catalogue, fetched only to look up each
     order line's image/SKU for display (the order's own line items carry neither). Real,
     wasteful over-fetching worth flagging for a native rebuild.
  3. `GET /invoices?order_id={id}` — to know which invoice(s), if any, exist for this order.
  4. `GET /deliveries?order_id={id}` — **conditional**: only fires if step 3 found at least one
     invoice *and* none of them is a "whole order" invoice — used purely to compute whether
     there's still an un-invoiced delivery (drives the "Create Invoice" button's availability).
  5. `GET /sales-returns?invoice_reference_id={invoiceId}` — ⚠️ **another N+1 pattern**: fires
     **once per invoice found in step 3, up to 5**, in parallel. Only fires at all if the viewer
     has `sales_returns:view` permission.
  6. `GET /deliveries/collections?customer_id={order.customerId}` — the customer's **entire**
     payment-collection history (collections are customer-scoped, not order-scoped).
  7. `GET /users/assignable` to resolve "Created By", then **only if still missing a name/role and
     the viewer is Admin**, one more sequential call: `GET /users/{createdById}`. Skipped entirely
     if the order already embeds the creator's name, or the viewer is the creator themselves.
  8. `GET /deliveries/partners` + `GET /vehicles` + `GET /warehouses` (parallel) — populates the
     "Plan Delivery" modal's dropdowns. **Fires unconditionally on every open**, even if the user
     never opens that modal.
  **Typical count for an order with 1 invoice: 9–11 calls**, not 3. An order with 5 invoices
  pushes step 5 alone to 5 parallel calls.
- **Customer Detail's "Orders" tab**: ⚠️ **N+1 pattern** — after `GET /orders?customer_id={id}`,
  fires one `GET /invoices?order_id={id}` call **per order returned**, then one more
  `GET /deliveries?order_id={id}` **per order still needing a delivery-status check**. A customer
  with 40 orders can trigger 40, then up to 80, individual calls for one tab. Ask the backend for a
  batched version before copying this loop as-is in a native rebuild.

## 8. Deliveries — lifecycle buttons, what each one actually moves

Each row below is its own single button, its own single call — no combined "do everything"
endpoint. A delivery is always tied to exactly **one order → one customer** (never split across
customers); its `warehouse_id` is the source warehouse for stage 1 of the stock move in §1.

| Button | Call | What it actually changes |
|---|---|---|
| Accept | `POST /deliveries/{id}/accept` | Status only (`planned`→`accepted`). No stock, no quantities touched. |
| Reject | `POST /deliveries/{id}/reject` | Status only, with an optional reason. No stock. |
| Start Picking / Save picked qty | `POST /deliveries/{id}/pick` | Records `picked_quantity` **per line** — this is what was physically pulled off the warehouse shelf, which can be *less* than the order's planned quantity (a real shortfall at pick time). **Still moves no stock** — picking is a record of intent/packing, not a warehouse-count change. |
| Mark Ready | `POST /deliveries/{id}/ready` | Status gate only — confirms picking is done and the delivery may now be loaded. No stock. |
| Load onto Vehicle | `POST /deliveries/{id}/load` | **Moves stock.** Deducts the picked quantities from the delivery's `warehouse_id` on-hand count and adds them to the assigned vehicle's stock pool. Server-side idempotent — calling it twice on an already-loaded delivery is a clean no-op/400, never double-moves stock. |
| Confirm Delivery (POD) | `POST /deliveries/{id}/confirm` | **Moves stock again.** Sends `delivered_quantity` per line (can be less than loaded, for a partial delivery); the backend consumes that quantity from the vehicle's stock pool and marks the delivery `delivered`/`partially_delivered`. Also carries POD photos/signature/receiver name. Returns `amount_due` — what the customer still owes for this delivery (COD-relevant), computed by the backend, never by the frontend. |

**Legacy "Mark Loaded" button** (older records only): fires **2 calls sequentially** —
`POST /deliveries/{id}/ready` first (skipped if already ready), then `POST /deliveries/{id}/load`.
The frontend aborts the chain and surfaces the error if step 1 fails — it never attempts `/load`
without a confirmed `/ready`.

**Cancelling a delivery**: only possible in `assigned`/`accepted`/`picking`/`ready` — i.e. before
anything has physically left the warehouse. Once `loaded`/`in_transit`, the backend rejects a plain
cancel with 400 (there is no local stock-reversal path in the frontend for this — the real
reversal, if any, happens through the delivery's own failure/return handling on the backend side).

- **Open Delivery Detail**: ⚠️ **Also more than "1 call"** — the delivery record itself is one
  call, but two always fire together on open, plus a role-dependent batch:
  1. `GET /deliveries/by-id/{id}` — order/customer/line/weight/warehouse info all embedded here.
  2. `GET /deliveries/{id}/collections` — fires in the same breath as step 1, always, regardless of
     role, to show this delivery's own collection history.
  3. **If Admin view**: `GET /deliveries/partners` + `GET /vehicles` + `GET /warehouses` (parallel)
     — for the Reassign/Edit modals' dropdowns, fired unconditionally even if never opened.
  3. **If Delivery-Partner view instead**: a different, best-effort trio fires —
     `GET /orders/{delivery.orderId}` (to read the order's locked selling prices for the live
     delivery-adjustment UI), `GET /products` (full catalogue, for "+ Add Product" pricing), and
     `GET /vehicle-stock/current/{me}` (to know what's actually still on the van to offer as
     addable stock). Each degrades independently to a quantity-only UI if it 403s — none of the
     three blocks the screen from rendering.
  **Total: 5 calls either way** (2 fixed + 3 role-dependent), never 1.
- **Record a collection at drop-off** (COD): `POST /deliveries/{id}/collections` — see §0, this is
  a *pending* collection, the customer's balance does not move yet.
- **Assigned Deliveries list**: 1 call — `GET /deliveries/assigned`.

## 9. Vehicle Loading screen (the batch loader — same `/load` action, applied to many deliveries)

- **Open screen**: 3 parallel — `GET /deliveries?delivery_partner_id={me}`, `GET /products` (to
  look up each product's `weight_kg` for the on-screen capacity math), `GET /vehicles?default_driver_id={me}&status=active`.
- **"Confirm Vehicle Load" button** (acts on several selected deliveries at once):
  1. **Sequential**: for every selected delivery not already Ready, `POST /deliveries/{id}/ready`
     (skipped for deliveries already Ready).
  2. **1 batched call**: `POST /deliveries/load-batch` with the full list of now-ready delivery
     IDs — this performs the **same warehouse→vehicle stock deduction as §8's single `/load`**, for
     every delivery in the batch, in one request — not one `/load` call per delivery.
  3. **1 final refresh**: the screen's own 3-parallel reload, so the list and the capacity math
     reflect the new vehicle stock state from the backend.
  **Count: (number of not-yet-ready deliveries) + 1 + 3.**
  **Failure handling**: tracked **per delivery** — a partial batch failure deselects/shows-loaded
  the deliveries that succeeded (their stock genuinely moved) and keeps the failed ones selected
  with their individual error, so the user can retry just those. Never treat the batch call as
  all-or-nothing even though it's one HTTP request — some deliveries in the batch can have their
  stock moved while others in the same call fail.

## 10. Customers

- **Create Customer**: file/document uploads happen inline as each is picked (`POST /files/upload`,
  immediately, not batched at submit), then **1 call** — `POST /customers` — with the already-
  uploaded file IDs attached. No stock or money logic — this is a pure record creation.
- **Edit → attach a new document**: upload (`POST /files/upload`) then immediately
  `PATCH /customers/{id}` with the new file ID — 2 calls per document, no staging.
- **List screen**: ⚠️ **2 calls, not 1** — `GET /customers` (search/filter re-fires this one,
  debounced) **plus** `GET /users`, fired once on mount to populate the Admin-only "Sales Officer"
  filter dropdown (skipped — resolved locally to just themselves, no call — if the viewer is a
  Sales Officer). See §20 for every other list screen's verified count — this same "list + one
  more per filter dropdown" shape turned out not to be universal; some lists genuinely are 1 call.

## 11. Products

- **Create/Edit Product Form**: same inline-upload pattern as Customers for every image/document
  slot. Final submit: 1 call — `POST /products` or `PATCH /products/{id}`. This sets the product's
  catalogue data (price, reorder thresholds, tax, physical attributes) — it does **not** set actual
  on-hand stock for any warehouse; that only ever changes through a GRN confirm (§12), a delivery
  load/confirm (§8), a manual stock adjustment, or a transfer.
- **Bulk delete**: 1 call — `POST /products/bulk-delete` (a real batch endpoint, unlike
  Quotations' N-individual-DELETE pattern).

## 12. Purchases + Goods Receipt (GRN) — the only path stock enters a warehouse from a supplier

A 4-5 step workflow, **each step its own explicit button and its own single call**, and critically,
**only one of these steps actually touches warehouse stock**:

1. **Create Purchase** (Purchase Form): `POST /purchases` → status `draft`. Commercial terms only
   (supplier, items, prices, tax) — no receiving fields are ever sent from the client, those are
   entirely server-managed.
2. **Confirm Purchase**: `POST /purchases/{id}/confirm` → status `confirmed`. **No stock movement.**
3. **Create GRN** (against the confirmed purchase): `POST /grns` → a draft receiving record with,
   per line, `received_qty` / `damaged_qty` / `rejected_qty` entered by whoever is receiving the
   goods. **Still no stock movement** — a draft GRN is just a record of what arrived.
4. **Confirm GRN**: `POST /grns/{id}/confirm` — **this is the only call in the entire flow that
   moves stock.** The backend computes `accepted_qty = received_qty − damaged_qty − rejected_qty`
   per line and adds **only that accepted quantity** to the GRN's target `warehouse_id` on-hand
   count (logged as a `purchase_in` stock movement) — damaged/rejected units never enter stock. It
   also rolls up the parent Purchase's own `received_qty` and `receiving_status` (e.g. partially vs
   fully received) in the same step.
5. **Close Purchase** (optional, separate button, only once fully received):
   `POST /purchases/{id}/close`.

**Behavior notes:** a Flutter rebuild must not let a user believe stock has arrived after step 1,
2, or 3 — only step 4 (GRN confirm) is real, and even then only the *accepted* portion of what was
received, never the full received quantity.

## 13. Supplier Invoices & Supplier Payments

- **Create/Edit Supplier Invoice**: 1 call — `POST /supplier-invoices` or
  `PUT /supplier-invoices/{id}`. Tied to a specific confirmed Purchase; carries the supplier's own
  invoice number/date/amount. No stock or payable-balance effect yet at this step.
- **Record** (Supplier Invoice Detail): `POST /supplier-invoices/{id}/record` — this is the
  commitment step that makes the invoice count toward Accounts Payable (§ in API_USAGE_GUIDE.md).
  **Cancel**/**Delete**: `POST /supplier-invoices/{id}/cancel` / `DELETE /supplier-invoices/{id}` —
  each its own call, the screen only shows whichever is valid for the invoice's current status.
- **Record Supplier Payment**: 1 call — `POST /supplier-payments`, with the invoice allocations
  (which invoice(s), how much against each) included in that **same** request body — there is no
  separate per-invoice allocation call. This is the step that actually reduces how much is still
  owed on each allocated invoice; voiding a payment (`POST /supplier-payments/{id}/void`) reverses
  those same allocations, re-opening the invoices it had paid down.
- **Open the Record Payment form**: 2 parallel on mount — `GET /customers`, `GET /suppliers`.

## 14. Customer Payments & Delivery Collections — see §0 first

- **Record Payment (standalone)**: screen open loads `GET /customers` + `GET /suppliers` in
  parallel (shared picker for both customer-receipt and supplier-payment modes). Submit: 1 call —
  `POST /payment-receipts`. Unlike a field Collection, this one **does** move the customer's
  balance directly — it's the Accountant/Finance-side direct recording path, not the field-collect-
  then-reconcile path.
- **Collection Reconciliation**: list screen — 1 call, `GET /deliveries/collections` (filtered).
  **Reconcile**: `POST /deliveries/collections/{id}/reconcile` — **this is the single point** a
  field-collected Collection turns into a real `CustomerPayment` and the customer's/invoice's
  balance actually moves (see §0). **Void**: `POST /deliveries/collections/{id}/void` — discards the
  pending collection, no balance was ever touched.

## 15. Sales Invoices

- **Create from an Order**: loads 3 parallel first (`GET /orders/{id}`, `GET /deliveries?order_id={id}`,
  `GET /invoices?order_id={id}` — so it knows which deliveries are already invoiced and refuses to
  double-invoice one). Submit: 1 call — `POST /invoices`. The invoice's outstanding amount starts
  as its full total; it only decreases through §14's payment-recording calls, never computed
  client-side.
- **Create manually**: loads `GET /customers` + `GET /products` + `GET /warehouses` in parallel
  instead. Same 1-call submit.
- **Download PDF**: 1 call — `GET /invoices/{id}/pdf`, always backend-rendered.
- **Generate a payment link**: 1 call — `POST /invoices/{id}/payment-link`.

## 16. Sales & Purchase Returns — the stock-reversal and credit-note rules

**Sales Return** — customer sends goods back:
1. `POST /sales-returns` (create) — anchored to a specific sold Invoice/Order, per-line return
   quantity + reason. No stock or balance change yet.
2. `PATCH /sales-returns/{id}/receive` — warehouse confirms the goods physically came back. Still
   no stock/balance change by itself.
3. `PATCH /sales-returns/{id}/approve` — **this is where stock and money both move, and each is
   explicitly opt-in per line/request:**
   - `restock` (boolean, sent per returned line) — if true, that line's quantity is added back to
     warehouse on-hand stock; if false, the backend records the return without restocking it (e.g.
     damaged goods that can't be resold).
   - `credit_note` (boolean, defaults **true**) — if true, generates a credit note / reduces the
     customer's outstanding balance by the approved credit amount; if explicitly set false, the
     return is approved with no financial credit issued.
   Instead: `PATCH /sales-returns/{id}/reject` — declines the return, no stock, no credit.

**Purchase Return** — goods sent back to a supplier:
1. `POST /purchase-returns` (create) — tied to a specific `warehouse_id` (where the stock is
   currently sitting) and optionally the originating GRN. No stock change yet.
2. `POST /purchase-returns/{id}/confirm` → 3. `.../dispatch` → 4. `.../complete` — four separate
   sequential button presses, never combined into one call. The frontend code does not expose which
   exact one of these steps the backend treats as the actual stock-out moment (unlike Sales Return,
   where `restock` makes the step explicit) — treat dispatch/complete as the stock-leaving window
   and don't assume it happens earlier.
`POST /purchase-returns/{id}/cancel` is available from draft/confirmed, with a required reason.

## 17. Bulk Import (Excel)

Two **completely separate** user actions, never chained automatically:
1. **"Download Template"**: 1 call — `GET /{module}/import/template` (streams the `.xlsx` file).
2. **"Upload & Import"**: 1 call — `POST /{module}/import` (multipart). **Validates and commits in
   the same call** — there is no separate "preview" step; whatever rows pass validation are already
   created in the database (including any stock/customer/order records those rows represent) by
   the time the response comes back. Only 3 modules support this: customers, suppliers, orders.

## 18. Settings screens

- **Appearance / Theme Save**: 0–2 calls depending on what changed — see `API_USAGE_GUIDE.md` §3
  for the full 4-case breakdown.
- **Roles & Permissions — Save a role**: 1 call — `POST /roles` or `PATCH /roles/{id}`, always with
  the **complete** permissions matrix, never a partial diff.
- **Company Settings — Save**: 1 call — `PUT /organizations/settings` with the full merged object
  (PUT, not PATCH — partial saves aren't possible).

## 19. Detail pages — every other "Open X Detail" screen, verified

This section exists because §7 and §8's Order/Delivery Detail corrections turned out not to be
isolated mistakes — **every** detail page in this app was checked against its actual loading
code, and most fire far more than "1 call." A few genuinely are simple; they're listed here too,
explicitly, so nothing is silently assumed.

- **Open Customer Detail**: **9 calls.** 7 parallel on the main load —
  `GET /customers/{id}`, `GET /customers/{id}/payments` (legacy ledger), `GET /deliveries/collections?customer_id={id}`,
  `GET /users` (skipped, no network call, if the viewer is a Sales Officer — resolved to just
  themselves locally), `GET /orders?customer_id={id}`, `GET /customers/{id}/account-statement`,
  `GET /customers/{id}/documents`. Then **2 more** — the customer's visits and follow-ups — which
  the code's own comment calls "loaded lazily the first time the tab is opened," but since
  **Overview is the default tab** and Overview's "Upcoming Activities" widget also needs this data,
  it fires immediately on first open in practice, not only when the Activities tab is clicked.
- **Open Supplier Detail**: **8 calls.** `GET /suppliers/{id}` and `GET /supplier-payments?supplier_id={id}`
  each in their own effect (both fire immediately, not staggered), plus **6 parallel** —
  `GET /products` (the full catalogue, again), the supplier's purchases, the supplier↔product link
  list, the supplier↔brand link list, `GET /brands`, `GET /categories`. All 8 fire unconditionally,
  no tab-gating.
- **Open Product Detail**: **4 parallel** — `GET /products/{id}`, the product's batches, its
  serials, and its attachments list. All fire even for a product that isn't batch/serial-tracked
  (the extras just come back empty, not errors).
- **Open Invoice Detail**: **4 calls**, mixed — `GET /invoices/{invoiceNumber}` first, then
  **sequentially** (only once the invoice resolves, using its real id) `GET /payment-receipts?invoice_id={id}`;
  **in parallel with the invoice call**, not waiting on it, 2 more best-effort calls —
  `GET /organizations/settings` + `GET /invoice-settings` — purely to render company
  letterhead/branding in the on-screen PDF preview; the invoice itself still renders correctly if
  either of these two fails or 403s.
- **Open Quotation Detail**: **2 calls** — `GET /quotations/{id}` + `GET /warehouses`.
- **Open Purchase Detail**: **1 call** — `GET /purchases/{id}`. Genuinely simple, confirmed.
- **Open Supplier Invoice Detail**: **1 call** — `GET /supplier-invoices/{id}`. Genuinely simple,
  confirmed.
- **Open Vehicle Detail**: **4 parallel** — `GET /vehicles/{id}`, `GET /deliveries/partners`
  (possible-drivers list), the vehicle's assignment history, the vehicle's activity log.
- **Open Warehouse Detail**: **7 parallel** — `GET /warehouses/{id}`, the warehouse's current stock,
  its movement history (`limit=50&offset=0`), **two separate** transfer-list calls (one filtered as
  source warehouse, one as destination — not one call with both filters), `GET /warehouses?is_active=true`
  (for a transfer-target picker), and `GET /products` (the full catalogue, a third time across
  these detail pages).
- **Open Staff/User Detail**: **4 parallel** — `GET /users/{id}`, `GET /customers?assigned_sales_officer_id={id}`
  (their customer book, if they're sales staff), `GET /attendance?user_id={id}`, and the staff
  overview/KPI endpoint. The code explicitly notes none of these 4 ever rejects the `Promise.all` —
  each resolves its own `{success, ...}` even on a failed HTTP call, so one 403ing (e.g. a
  non-admin viewer hitting a restricted sub-resource) never blocks the other three from rendering.
- **Open Lead Detail**: **5 calls** — `GET /leads/{id}`, the lead's visits, the lead's follow-ups
  (both unconditional on mount, **not** tab-gated the way Customer Detail's are), plus 2 more
  parallel calls populating the reassignment dropdown's staff/salesperson options.
- **Open Sales Return Detail**: **1 call** — `GET /sales-returns/{id}`. Genuinely simple — the
  "Approve" button's own warehouse-picker load (`GET /warehouses`) only fires when that modal is
  opened, not on page load; it belongs to the Approve action, not the detail-page open.
- **Open Purchase Return Detail**: **1 call** — `GET /purchase-returns/{id}`. Genuinely simple,
  confirmed.
- **Open Attendance Detail**: **2 parallel** — `GET /attendance?user_id={id}` + `GET /users` (to
  resolve the attendance record's own staff name).
- **Open Organization Detail** (Super Admin): **2 parallel** — `GET /superadmin/organizations/{id}`
  + `GET /superadmin/subscription-payments?organization_id={id}`-equivalent (its billing history).
  Both fire immediately, neither waits on the other.
- **`OrderDetailView.jsx` / `DeliveryDetailView.jsx`** (the components that actually render the
  Order Detail / Delivery Detail screens' markup): confirmed **purely presentational** — zero API
  calls of their own. Everything rendered there comes from props their parent (`OrderDetail.jsx` /
  `DeliveryDetail.jsx`) already loaded per §7/§8 above; nothing is missing from those counts.

### Create/Edit forms that load data dynamically, not as one fixed batch

Unlike the Detail pages above, a few forms deliberately load data **as the user interacts**, not
all at once on open — documenting them as "N calls on mount" would be misleading:

- **Create/Edit Purchase**: on open, 3 parallel (`GET /suppliers`, `GET /products`,
  `GET /warehouses`) plus, only if editing, a sequential `GET /purchases/{id}` prefill. Genuinely
  fixed-count, matches the pattern used elsewhere in this doc.
- **Create/Edit Supplier Invoice**: `GET /suppliers?is_active=true` on open; then, **only once a
  supplier is picked**, `GET /suppliers/{supplierId}/purchases`-style lookup of that supplier's
  purchases fires; then, **only once a specific purchase is picked from that list**,
  `GET /purchases/{purchaseId}` fires to pull its line items in. Three distinct calls, but spread
  across three separate user choices, not one batch.
- **Create Sales Return**: fires `GET` for previously-returned quantities
  (`getInvoiceReturnedQuantities`) once a specific invoice is selected to return against — not on
  form open.
- **Create Purchase Return**: similar shape — a searchable purchase picker queries
  `GET /purchases?search=...&limit=25` as the user types (debounced, not on open), then once a
  purchase is chosen, a parallel pair (`GET /purchases/{id}` + its already-returned quantities) and
  `GET /purchase-returns?purchaseId={id}` (that purchase's own return history) fire together.
- **Record Supplier Payment**: the drawer itself opens with no data loaded; picking a supplier
  fires `GET /accounts-payable?supplier_id={id}&page=1&page_size=100` to show their open invoices
  to allocate the payment against.

**Pattern worth calling out for a native rebuild**: `GET /products` (the entire, unfiltered product
catalogue) is independently re-fetched on at least **five** different screens above (Order Detail,
Delivery Detail's partner view, Supplier Detail, Warehouse Detail, and the Inventory Stock Board —
the last one fetches it a second time alongside `getStockBoard()` purely to backfill a
`created_at` timestamp the stock-board endpoint itself doesn't return). A rebuild should strongly
consider a local product cache, or a backend endpoint that accepts specific product IDs / embeds
`created_at` on the stock-board response, rather than copying this per-screen full-catalogue fetch
five times over.

- **Open Inventory / Stock Board**: **2 parallel** — `GET` the stock board itself (search/category
  filters applied server-side) + `GET /products` (see the pattern note above — only for the
  created_at backfill).
- **Open Vehicle Stock Overview**: **1 call, role-split, not both** — Admin gets
  `GET /vehicle-stock?status=active` (every driver's currently-open sessions); a Delivery Partner
  instead gets `GET /vehicle-stock/current/{me}` (just their own session, `null`→empty list is a
  truthful "nothing loaded," never a demo fallback).
- **Cash Reconciliation**: **0 calls, confirmed** — there is no backend endpoint for this feature
  at all; the screen honestly shows "not available" rather than faking persistence.

## 20. List screens — every "Open X List" screen, verified

Same exercise as §19, for list/index pages. The earlier assumption ("a list screen is just
`GET /{resource}`") turned out to be right for some and wrong for others — every one below was
checked against its real loading code.

**Genuinely 1 call, confirmed:**
- **Order List** — `GET /orders`.
- **Quotation List** — `GET /quotations`.
- **Purchase List** — `GET /purchases`.
- **Supplier Invoice List** — `GET /supplier-invoices`.
- **Supplier Payments List** — `GET /supplier-payments`.
- **Sales Return List** — `GET /sales-returns`.
- **Category List** — `GET /categories` (search re-fires it, debounced).
- **Brand List** — `GET /brands` (search re-fires it, debounced).

**More than 1 call:**
- **Customer List**: **2** — see §10 above (`GET /customers` + `GET /users` for the Sales-Officer
  filter, skipped for a Sales Officer viewer).
- **Product List**: **2** — `GET /products` + `GET /categories` (category filter dropdown).
- **Supplier List**: ⚠️ **3 calls, one of them genuinely wasteful** — `GET /suppliers` (filtered,
  the actual list) + a **second, unfiltered** `GET /suppliers` call whose *only* purpose is to walk
  every supplier returned and collect the distinct `category` values for the category filter
  dropdown (there is no dedicated "distinct categories" endpoint, so it re-fetches the entire
  supplier list a second time to compute this client-side) + `GET /products` (full catalogue, for
  a "Link Products" modal). A native rebuild should not copy the double-fetch — cache the first
  call's result and derive categories from it, or ask the backend for a distinct-values endpoint.
- **Lead List**: **up to 3** — `GET /leads` + `GET /follow-ups?status=pending&...` (for a pending
  follow-ups count/badge) + `GET /users` (salesperson filter, skipped — no call — for a Sales
  Officer viewer, same pattern as Customer List).
- **Payables List**: **2 parallel** — the payables list itself + a separate summary-totals call.
- **Vehicle List**: **2 parallel** — `GET /vehicles` + `GET /deliveries/partners` (driver-assignment
  filter/column).
- **Warehouse List**: **2 parallel** — `GET /warehouses` + `GET /warehouses/stock` (so the list can
  show each warehouse's stock value inline without a second trip per row).
- **Sales Invoices List** (`AdminInvoices.jsx`): **2 parallel** — `GET /invoices` + `GET /orders`
  (full order list, used only to map each invoice's `order_id` to a human order number for
  display — invoices don't carry the order number themselves).
- **Staff / User Management List**: **2, independent effects** — `GET /users` (filtered by role +
  search) + `GET /roles` (fired separately, needed to resolve the role-name filter before the user
  query can even be built). Also notable: this screen re-fetches the user list on **browser window
  focus** (a `window.addEventListener('focus', ...)` refetch) — the only list screen found with
  this behavior; a native rebuild would use an app-foreground/resume event for the same effect, not
  copy a browser-specific API.
- **Roles List**: **2 parallel** — `GET /roles` + `GET /roles/catalog`.
- **Purchase Return List**: ⚠️ **6 calls — the heaviest list screen found.** 1 for the actual
  filtered/paginated list, **plus 5 more**, fired in parallel, purely for the status-count stat
  cards: `listPurchaseReturns({pageSize:1})` once unfiltered and once more **per status**
  (draft/confirmed/dispatched/completed) — each call only reads the backend's `total` field for
  that bucket and discards everything else. A native rebuild should push hard for one backend
  endpoint that returns all 5 counts together instead of copying 5 near-identical requests.

**Pattern confirmed, not universal**: of the 19 list screens checked, 8 are genuinely a single
call, 9 fire 2, one fires 3, and one fires 6. There is no reliable rule-of-thumb — each screen
needs to be checked individually, which is what this section now does.

---

## Summary table — "how many calls, and does it move stock/money?"

| Action | Calls | Moves stock? | Moves money/balance? |
|---|---|---|---|
| Login | 1 | No | No |
| Submit Create Order | 1 | **Checked, not moved** (can reject on shortage) | No |
| Confirm Order | 1 | No | No |
| Convert Quotation → Order | 1 | **Checked, not moved** | No |
| Delivery: Accept/Reject/Pick/Ready | 1 each | No | No |
| Delivery: Load onto Vehicle | 1 | **Yes** — warehouse → vehicle | No |
| Delivery: Confirm (POD) | 1 | **Yes** — vehicle → consumed/delivered | No (returns `amount_due`, doesn't collect it) |
| Confirm Vehicle Load (batch, N deliveries) | (not-ready count) + 1 + 3 | **Yes**, per delivery in the batch | No |
| Purchase: Create/Confirm/Close | 1 each | No | No |
| GRN: Create (draft) | 1 | No | No |
| GRN: Confirm | 1 | **Yes** — `accepted_qty` → warehouse on_hand | No |
| Record Supplier Payment | 1 | No | **Yes** — directly reduces allocated invoice(s) |
| Field "Collect Payment" (any customer) | 1 | No | **No** — creates a pending Collection only |
| Delivery COD collection | 1 | No | **No** — pending Collection only |
| Collection: Reconcile | 1 | No | **Yes** — the only point balance actually moves |
| Collection: Void | 1 | No | No (discards, nothing had moved) |
| Record Payment (standalone, Finance-side) | 1 | No | **Yes** — directly |
| Sales Return: Approve | 1 | **Conditionally** (`restock` per line) | **Conditionally** (`credit_note`, default true) |
| Purchase Return: Confirm/Dispatch/Complete | 1 each | Somewhere in this chain (exact step not exposed to frontend) | No |
| Bulk delete 10 quotations | 10 | No | No |
| Bulk delete products | 1 | No | No |
| Bulk Import (template + upload) | 2 | **Yes, if rows represent stock-bearing records** | Varies by module |
| Theme Save | 0–2 | No | No |

---

## What this document deliberately does not cover
List screens' own `GET` calls (Customer List, Product List, etc. — a single `GET /{resource}` with
search/filter query params, no interesting sequencing) aren't repeated here; those are already
fully specified in **API_LIST.md** and **API_USAGE_GUIDE.md**. Every **detail/open-a-record**
screen, by contrast, has now actually been checked against its real loading code rather than
assumed — see §19 — and each one's true call count is stated, whether that turned out to be 1 or
9. Where the frontend's own code doesn't pin down an exact backend internal rule (e.g. purchase
return's precise stock-out step), that gap is called out explicitly rather than guessed at.

## A note on how this document was corrected
An earlier version of this document stated "Open Order Detail: 3 parallel calls" and "Open
Delivery Detail: 1 call" from a partial read of those files. Both were wrong — the real counts are
9–11 and 5. Every "Open X Detail" entry in this version (§7, §8, §19) was re-derived by reading
each screen's actual `useEffect`/data-loading code in full, not by pattern-matching against
similar-looking screens or trusting an earlier pass. If a future edit touches any of these
screens' loading logic, this document needs re-checking the same way, not just updated by
assumption.
