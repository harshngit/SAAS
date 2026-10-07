# Beas Suite CRM — API Action Flows (what fires on each screen/button)

Companion to **API_LIST.md** (every endpoint) and **API_USAGE_GUIDE.md** (why/where/logic per
endpoint). This third document answers a different question: **when a user opens a screen or
taps a button, exactly which API calls fire, in what order, how many, and what do they actually
do (and not do)?**

This matters for a mobile rebuild because a screen is rarely "one button = one API call." Most
screens load several lists in parallel to populate dropdowns *before* the user can even act, and
some single buttons quietly fire a short chain of calls, not one. Every number and sequence below
was read directly out of the current frontend's handler/effect code — nothing here is estimated.

**How to read each entry:**
- **Trigger** — what the user does (open screen / tap button).
- **Calls** — the endpoints that fire, numbered in actual order; "parallel" means they're fired
  together (`Promise.all`) and the UI waits for all to finish; "sequential" means each call waits
  for the previous one.
- **Count** — total network calls for that one trigger.
- **Behavior notes** — what it does, what it deliberately does NOT do (no local mutation, no
  retries, no partial fallback, etc.) — the things a Flutter implementation must match to stay
  correct, not just "close enough."

---

## 0. Calls that are not tied to any button

- **App boot / token present on launch**: `GET /auth/me` once, to re-hydrate user + permissions +
  organization before rendering any protected screen.
- **Topbar notification badge**: `GET /notifications/unread-count` once on mount, then again every
  **60 seconds** on a `setInterval` for as long as the app is open (`src/components/layout/Topbar.jsx`).
  This is the only endpoint in the whole app that is polled automatically — everything else below
  is purely user-triggered. Replicate the 60s cadence; don't poll faster, it's not needed and adds
  load for no benefit.
- **My Attendance screen's live clock**: `setInterval` every 60s, but that one only re-renders the
  on-screen current time — it makes **no** API call.

## 1. Login

**Trigger:** tap "Log In" with email + password.
**Calls:** 1 — `POST /auth/login`.
**Count:** 1.
**Behavior notes:** the response already contains `user`, `organization`, `permissions`,
`full_access`, `data_scope` — there is **no** separate follow-up `GET /auth/me` call right after
login; the login response itself is the full session payload. Redirect target after success is
decided purely client-side from `user.role` (no second call needed to know where to land).

## 2. Dashboards (role-specific, all fire on screen mount)

Each role's dashboard is its own screen with its own parallel batch — there's no single shared
"dashboard" call except Admin's.

- **Admin Dashboard**:
  - Filter-dropdown options, fired once on mount, 4 parallel: `GET /companies?active=true`,
    `GET /warehouses`, `GET /customers`, `GET /suppliers`.
  - The actual KPI data, fired on mount **and** again every time a filter/Apply is changed,
    2 parallel: `GET /dashboard/admin` (with whatever filters are active) + `GET /orders`
    (for a recent-orders widget).
  - **Total on first paint: 6 calls** (4 filter-option + 2 data), then **2 calls** per subsequent
    filter change.
- **Sales Officer Dashboard**: 4 parallel on mount — `GET /customers`, `GET /orders`,
  `GET /quotations`, `GET /visits?user_id={me}`.
- **Accountant Dashboard**: 6 parallel on mount — `GET /reports/customer-outstanding`,
  `GET /reports/supplier-outstanding`, `GET /reports/expense?date_from=<1st of month>&date_to=<today>`,
  `GET /reports/gst-summary`, `GET /invoices`, `GET /payment-receipts`.
- **Delivery Partner Dashboard / Assigned Deliveries**: see §6 below — it's really "load my
  deliveries," not a separate KPI call.

**Behavior notes:** none of these dashboards retry a failed call or fall back to cached data —
each tile/widget just shows its own error state independently if its specific call fails; the
other tiles still render from whichever calls succeeded. Build dashboards the same way: don't let
one failed fetch blank the whole screen.

## 3. Leads → Convert to Customer

**Trigger:** "Convert to Customer" from Lead Detail, the Leads list, Follow-ups, or Visits.
**Calls, in order:**
1. *(only if the caller passed a bare `leadId` instead of a full lead object — i.e. from
   Follow-ups/Visits, not from Lead Detail)* `GET /leads/{id}` to fetch the full lead first.
2. *(only if the caller didn't already supply a salesperson list)* `GET /users` to populate the
   "assign to" dropdown inside the modal.
3. On submit: `POST /leads/{id}/convert-to-customer`.
**Count:** 1–3 depending on entry point; always exactly 1 on actual submit.
**Behavior notes:** this is a single shared modal component reused by 4 different screens —
whichever screen opens it either already has the lead/salesperson data in memory (0 extra calls)
or the modal fetches what's missing itself. The conversion call itself is one-way and atomic — the
new Customer's ID comes back in the same response, no second lookup needed to get the new customer.

## 4. Quotations

- **Open "Create Quotation"**: 4 parallel on mount — `GET /customers`, `GET /leads`,
  `GET /products`, and `GET /users` (skipped — resolved as an empty list with **no network call**
  — if the current user is a Sales Officer, since they can't reassign ownership anyway).
  **Count: 3 or 4** depending on role.
- **Submit (create or edit)**: 1 call — `POST /quotations` or `PATCH /quotations/{id}`.
- **"Convert to Order"** (from Quotation Detail): 1 call — `POST /quotations/{id}/convert-to-order`,
  returns the new Order directly.
- **Bulk delete from Quotation List**: **N parallel calls**, one `DELETE /quotations/{id}` per
  selected row — not a single batch-delete endpoint. Selecting and deleting 10 quotations fires
  10 simultaneous DELETE calls.

## 5. Sales Orders

- **Open "Create Order"**: 4 parallel on mount — `GET /products`, `GET /customers`,
  `GET /warehouses`, and `GET /deliveries/partners` (**skipped** — no call — if editing an
  existing order, or if this is the restricted delivery-vehicle self-order flow). Plus, **only**
  when opened in edit/duplicate/from-quotation mode, one more sequential call right after: either
  `GET /orders/{id}` or `GET /quotations/{id}` to prefill the form.
  **Count: 3–5** depending on mode.
- **Submit create**: 1 call — `POST /orders`. A delivery partner picked at creation time (Home
  Delivery) or self-assigned (delivery-vehicle app) is sent **inside this same call** — there is
  **no** separate "assign partner" call during creation; that's a different endpoint
  (`PATCH /orders/{id}/assign-delivery-partner`) only used later, from Order Detail, to *change*
  the assignment after the fact.
  **Count: 1.**
- **Submit edit**: 1 call — `PATCH /orders/{id}`.
- **Open Order Detail**: 3 parallel — `GET /orders/{id}`, `GET /deliveries?order_id={id}`,
  `GET /invoices?order_id={id}` — so the page can show linked deliveries and linked invoices
  without extra clicks.
- **Customer Detail's "Orders" tab** (showing each order's delivery/invoice status inline): after
  `GET /orders?customer_id={id}` resolves, it fires **one `GET /invoices?order_id={id}` call per
  order returned**, and then, only for orders that still need a delivery-status check, **one more
  `GET /deliveries?order_id={id}` call per order**. ⚠️ **This is an N+1 pattern** — a customer
  with 40 orders can trigger 40, then up to 80, individual calls just to render one tab. If you
  build this screen natively, strongly consider asking the backend for a batched version
  (e.g. an order list that already embeds invoice/delivery status) rather than copying the
  per-order loop as-is.

## 6. Deliveries — lifecycle buttons

Each of these is its own single button firing its own single call — there is no combined
"do everything" endpoint, so a mobile UI needs the same multi-step button sequence as the web app:

| Button | Call | Moves stock? |
|---|---|---|
| Accept | `POST /deliveries/{id}/accept` | No |
| Reject | `POST /deliveries/{id}/reject` | No |
| Start Picking / Save picked qty | `POST /deliveries/{id}/pick` | No |
| Mark Ready | `POST /deliveries/{id}/ready` | No |
| Load onto Vehicle | `POST /deliveries/{id}/load` | **Yes** — warehouse → vehicle |
| Confirm Delivery (POD) | `POST /deliveries/{id}/confirm` | **Yes** — vehicle → delivered |

**Exception — legacy "Mark Loaded" button** (only shown for older records that never went through
the granular ready/load split): this single tap fires **2 calls sequentially** —
`POST /deliveries/{id}/ready` first (only if not already ready), then
`POST /deliveries/{id}/load`. Never fire `/load` without confirming `/ready` succeeded first; the
web app aborts the chain and surfaces the error if step 1 fails.

- **Open Delivery Detail**: 1 call — `GET /deliveries/by-id/{id}` (no companion calls; everything
  needed — order info, line items, warehouse, weights — is embedded in this one response).
- **Assigned Deliveries / Delivery Partner Dashboard (list screen)**: 1 call —
  `GET /deliveries/assigned`.

## 7. Vehicle Loading screen (the batch loader)

- **Open screen**: 3 parallel — `GET /deliveries?delivery_partner_id={me}`, `GET /products`
  (to look up each product's `weight_kg` for the capacity math), `GET /vehicles?default_driver_id={me}&status=active`.
  **Count: 3.**
- **"Confirm Vehicle Load" button** (can act on several selected deliveries at once) — this is the
  one button in the whole app that fires the most calls:
  1. **Sequential, one at a time**: for every selected delivery not already in the Ready stage,
     `POST /deliveries/{id}/ready`. (Skipped entirely for deliveries already Ready.)
  2. **1 batched call**: `POST /deliveries/load-batch` with the full list of now-ready delivery
     IDs — **not** one `/load` call per delivery.
  3. **1 final refresh**: the screen's own 3-parallel reload from step "Open screen" above, so the
     list reflects the new state.
  **Count: (number of not-yet-ready deliveries) + 1 + 3.** Selecting 5 deliveries where 2 are
  already Ready fires `3 (ready) + 1 (batch load) + 3 (refresh) = 7` calls for one tap.
  **Behavior notes:** failures are tracked **per delivery** — if the batch call partially fails,
  the deliveries that succeeded are deselected and shown as loaded, the ones that failed stay
  selected with their individual error message, and the user can retry just those. Don't treat the
  batch call as all-or-nothing in the UI even though it's one HTTP request.

## 8. Customers

- **Create Customer (Customer Form / Quick Add)**: document and profile-image uploads happen
  **inline, immediately, as the user attaches each file** — each is its own
  `POST /files/upload` call (via `uploadFile`/`uploadGenericFiles`) **the moment the file is
  picked**, well before the user taps the final "Save"/"Create" button. The final submit is then
  1 call — `POST /customers` — sent with the already-returned file IDs attached to the relevant
  fields. **There is no "upload everything on submit" batching** — if a user attaches 3 documents
  while filling the form, that's 3 upload calls already completed by the time they hit Create, then
  1 more call to actually create the customer.
- **Edit an existing customer → attach a new document**: this is **not** staged like the create
  flow — attaching a document to an *already-existing* customer fires the upload
  (`POST /files/upload`) **and then immediately** `PATCH /customers/{id}` with the new file ID, in
  the same action, with no separate "Save" step required. 2 calls per document attached in edit mode.
- **List screen (Customer List)**: 1 call — `GET /customers` (search/filter params appended, not
  separate calls — typing in the search box re-fires the same `GET /customers?search=...`, debounced).

## 9. Products

- **Create/Edit Product Form**: identical inline-upload pattern to Customers — every image/
  document slot (cover image, gallery images, video, brochure, manual, datasheet, cert, warranty)
  is its own immediate `POST /files/upload` call the moment it's picked, independent of the form's
  Save button. Final submit is 1 call — `POST /products` or `PATCH /products/{id}` — carrying the
  already-uploaded file IDs.
- **Bulk delete from Product List**: 1 call — `POST /products/bulk-delete` (this one **is** a real
  batch endpoint, unlike Quotations' N-individual-DELETE pattern above — don't assume all "bulk"
  actions in this app work the same way under the hood).

## 10. Purchases + Goods Receipt (GRN)

This is a 4-step workflow across potentially 2 different screens, **each step its own explicit
button and its own single call** — never combined:
1. **Create Purchase** (Purchase Form): `POST /purchases` → status `draft`.
2. **Confirm Purchase** (Purchase Detail, separate button): `POST /purchases/{id}/confirm` →
   status `confirmed`. **No stock movement yet.**
3. **Create GRN** (GRN panel, against the confirmed purchase): `POST /grns` → a draft receiving
   record. **Still no stock movement.**
4. **Confirm GRN** (separate button on the same panel): `POST /grns/{id}/confirm` — **this is the
   only call in the entire 4-step flow that actually moves stock into the warehouse.**
**Behavior notes:** a Flutter app must not let a user believe stock has arrived after step 1, 2,
or 3 — only step 4 is real. The purchase can also be closed (`POST /purchases/{id}/close`)
afterward, a 5th, separate, optional step, only possible once fully received.

## 11. Supplier Invoices & Supplier Payments

- **Create/Edit Supplier Invoice**: 1 call — `POST /supplier-invoices` or
  `PUT /supplier-invoices/{id}`.
- **Record / Cancel / Delete** (Supplier Invoice Detail's action buttons): each its own single
  call — `POST /supplier-invoices/{id}/record`, `POST /supplier-invoices/{id}/cancel`, or
  `DELETE /supplier-invoices/{id}` — never combined, and the screen only shows whichever buttons
  are valid for the invoice's current status.
- **Record Supplier Payment**: 1 call — `POST /supplier-payments`, with the invoice allocations
  included in that same request body (not separate per-invoice calls).
- **Open the Record Payment form**: 2 parallel on mount — `GET /customers`, `GET /suppliers` (the
  same shared picker loads both lists up front, then shows only the one relevant to whichever mode
  — customer receipt or supplier payment — is active).

## 12. Customer Payments & Delivery Collections

- **Record Payment (standalone, e.g. from Customer Detail or a Record Payment screen)**: screen
  open loads 2 parallel — `GET /customers`, `GET /suppliers` (the same shared picker component is
  reused for both customer-receipt and supplier-payment recording, so it loads both lists up
  front regardless of which mode is active). Submit is 1 call — `POST /payment-receipts`.
- **Collection Reconciliation (Finance confirming a delivery partner's cash collection)**: list
  screen loads 1 call — `GET /deliveries/collections` (with filters). "Reconcile" button: 1 call —
  `POST /deliveries/collections/{id}/reconcile`. "Void": 1 call —
  `POST /deliveries/collections/{id}/void`.

## 13. Sales Invoices

- **Create Invoice directly from an Order**: loads 3 parallel first — `GET /orders/{id}`,
  `GET /deliveries?order_id={id}`, `GET /invoices?order_id={id}` (so it knows which deliveries are
  already invoiced and won't let you double-invoice one). Submit: 1 call — `POST /invoices`.
- **Create Invoice manually (no source order)**: loads 3 parallel instead —
  `GET /customers`, `GET /products`, `GET /warehouses`. Submit: same 1 call — `POST /invoices`.
- **Download PDF**: 1 call — `GET /invoices/{id}/pdf`, always backend-rendered, never built
  client-side.
- **Generate a payment link**: 1 call — `POST /invoices/{id}/payment-link`.

## 14. Sales & Purchase Returns

Both modules follow the same shape: **1 call per lifecycle step, each its own button**, no step
ever combined with another:
- Sales Return: `POST /sales-returns` (create) → `PATCH /sales-returns/{id}/receive` →
  `PATCH /sales-returns/{id}/approve` (terminal) — or `.../reject` instead of approve.
- Purchase Return: `POST /purchase-returns` (create) → `.../confirm` → `.../dispatch` →
  `.../complete` — 4 separate sequential button presses across the record's life, never one call.

## 15. Bulk Import (Excel)

Two **completely separate** user actions, never chained automatically:
1. **"Download Template" button**: 1 call — `GET /{module}/import/template` (streams the `.xlsx`
   file).
2. **"Upload & Import" button** (after the user fills the template and picks it back up): 1 call —
   `POST /{module}/import` (multipart). This single call both **validates and commits** — there is
   no separate "preview" call in between. A user cannot preview-then-cancel; whatever rows pass
   validation are already created by the time the response comes back.

## 16. Settings screens

- **Appearance / Theme Save**: 0–2 calls depending on what changed — see `API_USAGE_GUIDE.md`
  §3 for the full 4-case breakdown (plain PATCH only / upload-then-PATCH / DELETE-then-PATCH /
  nothing-to-save). Never more than 2 calls for one Save tap.
- **Roles & Permissions — Save a role**: 1 call — `POST /roles` or `PATCH /roles{id}`, always with
  the **complete** permissions matrix in the body, never a partial diff.
- **Company Settings — Save**: 1 call — `PUT /organizations/settings` with the full merged object
  (this endpoint is PUT, so partial saves aren't possible — the form always sends everything it
  currently has, not just the changed fields).

---

## Summary table — "how many calls does this one tap cause?"

| Action | Calls | Parallel or sequential |
|---|---|---|
| Login | 1 | — |
| Open Create Order | 3–5 | parallel (+1 sequential prefill if editing) |
| Submit Create Order | 1 | — |
| Open Order Detail | 3 | parallel |
| Convert Lead to Customer (submit) | 1 | — |
| Open Vehicle Loading screen | 3 | parallel |
| **Confirm Vehicle Load** (N deliveries, some not-ready) | **(not-ready count) + 1 + 3** | sequential ready calls → 1 batch call → 3 parallel refresh |
| Legacy "Mark Loaded" button | 2 | sequential |
| Create Customer with 3 attachments | 4 (3 upload + 1 create) | uploads happen as picked; create at the end |
| Edit Customer, attach 1 document | 2 | sequential (upload → patch) |
| Purchase → GRN, full 4-step flow | 4 | sequential, 4 separate button taps |
| Bulk delete 10 quotations | 10 | parallel |
| Bulk delete products | 1 | — (real batch endpoint) |
| Theme Save | 0–2 | sequential when 2 |
| Bulk Import (template + upload) | 2 | 2 separate user actions, not chained |

---

## What this document deliberately does not cover
Pure single-call CRUD screens (plain list/get/create/update/delete with nothing extra chained)
aren't repeated here if they're not interesting — those are already fully specified in
**API_LIST.md** and **API_USAGE_GUIDE.md**. This document exists only to flag the screens where
the call count or sequence is **not** the obvious "one button, one call" — so the Flutter rebuild
doesn't accidentally under- or over-call the backend, or get the ordering wrong on a multi-step
button like Vehicle Loading's batch confirm or the Purchase→GRN chain.
