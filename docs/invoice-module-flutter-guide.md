# Invoice Module — Complete Functionality & API Guide

**Audience:** the Flutter developer building the mobile app against the same backend
(`https://crm-saas-backend.bsmart.workers.dev`) that this web CRM ("Beas Suite") talks to.

Everything in this document was read directly out of the working web frontend's source
(`src/api/invoices.js`, `src/api/paymentReceipts.js`, `src/api/invoicePaymentLinks.js`,
`src/features/invoices/*.jsx`) — not guessed. Where the web app itself works around a backend
gap or quirk, that is called out explicitly so the Flutter app doesn't get surprised by the same
thing. All endpoint paths are relative to the backend base URL above; every request needs the
standard `Authorization: Bearer <access_token>` header unless stated otherwise.

---

## 1. What an "Invoice" is in this system

An **Invoice** is the customer-facing, GST-style sales document: it bills a customer (or a
walk-in/one-off buyer) for goods, carries tax/discount math, tracks how much of it has been
paid, and can be turned into a PDF, printed, emailed, or paid online via a Razorpay link.

Two separate "invoice" concepts exist in this codebase — this document covers **Sales
Invoices** (what a business issues *to* its customers). **Supplier Invoices** / **Purchase
Invoices** (bills a business receives *from* its suppliers) are a different module
(`/supplier-invoices`, `/purchases/{id}/invoices`) with its own schema and are out of scope
here.

An invoice is created in one of two ways:

1. **From a Sales Order** — the normal path. A customer places an Order, it gets delivered (in
   full or in part), and the delivered quantity is converted into an Invoice.
2. **Direct / Walk-in** — a standalone invoice typed up on the spot (e.g. a counter sale), with
   no underlying Order at all.

---

## 2. Data model — the Invoice object

`GET /invoices/{id}` (and every other invoice-returning endpoint) returns a JSON object shaped
roughly like this (snake_case on the wire; the web app's `normalizeInvoice()` maps it to
camelCase internally — use whichever the mobile app's own layer prefers, the field list is what
matters):

| Field | Type | Notes |
|---|---|---|
| `id` | string | Internal ID — use for all follow-up calls (`/invoices/{id}/...`) |
| `invoice_number` | string | Human-facing number, backend-generated, sequential. Two formats seen in the wild: `IN-<company>-<year>-<seq>` (e.g. `IN-10001-2027-0001`) and a legacy `INV-<year>-<seq>` (e.g. `INV-2026-1021`). Never generate this client-side. |
| `invoice_date` | date string | |
| `due_date` | date string | Used to compute Overdue / Due Soon (see §9) |
| `customer_id` / `customer_name` | | Null when it's a walk-in sale |
| `walk_in_customer.name` / `.mobile_number` | | Present instead of `customer_id` for walk-in sales |
| `order_id` | string\|null | Set when the invoice came from an Order |
| `delivery_id` | string\|null | Set when the invoice bills one specific Delivery, not the whole Order |
| `warehouse_id` | string | |
| `items[]` | array | See §2.1 |
| `subtotal`, `discount`, `tax`, `additional_charges`, `round_off`, `total` | numbers | |
| `amount_paid` | number | Cumulative across all payments |
| `outstanding_amount` | number | `total - amount_paid`, clamped at 0 (backend-computed; frontend also derives it as a fallback) |
| `payment_status` | string | `Paid` / `Partial` / `Unpaid` — if the backend omits this, derive it: `amount_paid >= total && total > 0 → Paid`; `amount_paid > 0 → Partial`; else `Unpaid` |
| `status` (invoice status) | string | `Issued` / `Draft` / `Cancelled` — distinct from payment status |
| `is_credit_note` | bool | True for credit notes issued against this invoice (see §7) |
| `notes` | string | |
| `billing_address` | string | |

### 2.1 Item shape (`items[]`)

| Field | Notes |
|---|---|
| `product_id`, `variant_id` | `variant_id` optional |
| `quantity` | Integer |
| `unit_price` | |
| `discount` | Percent, optional |
| `tax_rate` | Percent, optional |
| `batch_number` | Only sent if the product has batch tracking enabled |
| `serial_numbers[]` | Only sent if the product has serial-number tracking enabled |
| `line_total` | Computed |

---

## 3. Listing invoices

```
GET /invoices?page_size=100&customer_id=<id>&status=<status>&order_id=<id>
```
All query params optional. `page_size` defaults to 100 in the web app. Returns `{ invoices: [...] }`.

```
GET /invoices/{id}
```
Returns a single invoice (full shape above). Note: in this codebase, `{id}` in the route is
actually filled with either the real invoice ID *or* the invoice number depending on the call
site — `getInvoice()` is called with whichever the current screen has at hand. Treat the
backend as accepting either; if the mobile app only ever has one of them from the list response,
just use that.

---

## 4. Creating an invoice — two distinct flows

### 4.1 Flow A — Invoice an existing Sales Order (the primary, recommended path)

```
POST /orders/{orderId}/invoice
Body (all optional): { "delivery_id": "<deliveryId>" }
```

Business rules enforced by the backend, confirmed by how the web app gates its own UI:

- An order can only be invoiced once it has **delivered quantity** — `delivered_quantity > 0` on
  at least one order line. A pickup (takeaway) order is "delivered" once the customer has
  collected it; a delivery order needs at least one Delivery in status `delivered` or
  `partially_delivered`.
- **Per-delivery invoicing is always on** (not an org setting): every individual Delivery
  against an Order can get its *own* invoice (covering just that delivery's quantities), by
  passing that delivery's `delivery_id`.
- **Whole-order invoicing** is only available once the order is **fully delivered** (`status ===
  'delivered'` at the order level) and no whole-order invoice exists yet — omit `delivery_id` in
  that case to bill everything remaining in one shot.
- Both shapes (per-delivery and whole-order) can be valid at the same time for the same order,
  e.g. two deliveries already invoiced individually, and once the order is fully delivered a
  final whole-order invoice is also offered for whatever's left.
- Calling this twice for the same delivery/whole-order combination returns a **409 Conflict** —
  the backend has already invoiced it. The response identifies which invoice already exists (see
  §4.3) so the client can redirect to it instead of erroring out.
- Known error messages worth matching on and surfacing with a friendlier string:
  - contains "no delivered quantity" → nothing has been delivered yet
  - contains "pending delivery quantity" → there's a partial delivery still in progress; finish
    it before the *whole-order* invoice can be issued
  - contains "bills per delivery" → the backend wants a specific `delivery_id`, not a whole-order
    call, in the current state

Success response: the created invoice object (same shape as §2), `201`.

### 4.2 Flow B — Direct / Walk-in invoice (no Order at all)

```
POST /invoices
```

Body:
```json
{
  "items": [
    {
      "product_id": "...",
      "variant_id": "...",            // optional
      "quantity": 2,
      "unit_price": 150,
      "discount": 5,                  // percent, optional
      "tax_rate": 18,                 // percent, optional
      "batch_number": "B-2026-07",    // optional, only if product has batch tracking
      "serial_numbers": ["SN1","SN2"] // optional, only if product has serial tracking
    }
  ],
  "customer_id": "...",                  // OR walk_in_customer below — not both
  "walk_in_customer": { "name": "...", "mobile_number": "..." },
  "warehouse_id": "...",
  "invoice_date": "2026-10-21",
  "discount": 0,                        // invoice-level extra discount, absolute amount
  "tax": 0,                             // rarely used — item-level tax_rate is the normal path
  "additional_charges": 0,
  "round_off": 0,
  "notes": "...",
  "billing_address": "...",
  "payment": { ... }                    // optional — see §5.1, capture a payment at creation time
}
```

- Exactly one of `customer_id` / `walk_in_customer` must be given.
- `quantity` is always truncated to an integer before sending.
- If the chosen product has stock tracking and there isn't enough stock, the backend returns a
  structured `422` with an `INSUFFICIENT_STOCK`-style error whose detail carries a `shortages`
  array: `[{ product_id, variant_id, product_name, requested, available }]`. The web app shows
  this as a per-line "requested X, available Y" list rather than a generic error string — do the
  same in the mobile UI, it is a far better error message for the cashier/salesperson than
  "stock error."

Success: created invoice object, `201`.

### 4.3 Handling a duplicate-invoice conflict (409) on either flow

The backend's 409 body contains, in some form, a reference to the invoice that already exists.
The web app parses this defensively with a regex against **both** known invoice-number formats
(`IN-<company>-<year>-<seq>` and `INV-<year>-<seq>`) because it can't rely on a single consistent
error shape. Practical approach for the mobile app: try to pull an `invoice_id` /
`invoice_number` out of the error body; if you can't parse one, fall back to calling
`GET /invoices?order_id={orderId}` and finding the matching invoice to redirect/link to. Never
just show a bare "Conflict" error — always try to resolve and surface the existing invoice.

---

## 5. Payments — two distinct mechanisms, don't conflate them

### 5.1 Payment captured *at invoice-creation time* (COD / immediate payment)

Only relevant to Flow B (`POST /invoices`, see §4.2) via the optional `payment` object:

```json
"payment": {
  "payment_method": "cash",            // cash | bank_transfer | upi | cod | cheque | credit
  "amount": 300,
  "transaction_reference": "...",      // required for bank_transfer/upi/cheque
  "received_on": "2026-10-21",
  "upi_id": "...",                     // required if payment_method = upi
  "card_type": "...",                  // if a card payment
  "card_last_four": "....",            // 4 digits, if a card payment
  "collection_instructions": "...",    // required if payment_method = cod
  "payment_status": "pending"          // COD stays "pending" until the cash is actually collected
}
```
Use this for a till/counter sale where money changes hands in the same moment the invoice is
raised. This is **not** how an order-based invoice (Flow A) captures a payment — Flow A has no
payment body at all; use §5.2 afterward instead.

### 5.2 Recording a payment *after* the invoice exists (Payment Receipts / "Record Payment")

This is the general payment ledger — used on both freshly-issued and older invoices, regardless
of how they were created.

```
POST /payment-receipts
Body: {
  "invoice_reference_id": "<invoiceId>",
  "amount_received": 500,
  "payment_method": "bank_transfer",
  "transaction_reference": "...",      // as above, method-dependent
  "upi_id": "...", "card_type": "...", "card_last_four": "....",
  "collection_instructions": "...",
  "payment_status": "...",
  "receipt_date": "2026-10-21",
  "note": "..."
}
```
Response: the created receipt, which also carries the *updated* invoice totals
(`invoice_total`, `total_paid`, `outstanding_amount`, `payment_status`) — refresh the invoice
screen from this response rather than re-fetching the whole invoice if you want the fastest UI
update.

**Important client-side guard the web app enforces that the backend does NOT (no advance-payment
allocation exists server-side):** never let a payment amount exceed the invoice's current
`outstanding_amount` (a small +0.5 rounding tolerance is allowed). If you don't guard this
client-side, you can create an invoice that's "overpaid" with no backend concept of where the
extra money went. COD payments are exempt from this >0 check since the actual amount isn't known
until collection.

Other Payment Receipt endpoints:
```
GET    /payment-receipts?invoice_id=<id>&customer_id=<id>&page_size=100
GET    /payment-receipts/{id}
PATCH  /payment-receipts/{id}   // body: { payment_method, transaction_reference, receipt_date, receipt_number } only
DELETE /payment-receipts/{id}   // the UI calls this action "Void"
```

List the receipts for an invoice (`GET /payment-receipts?invoice_id=...`) to show a payment
history/ledger under the invoice. If that call 403s for the current role, that's expected for
some roles — don't treat it as a hard error; just fall back to showing the invoice's own
aggregate `amount_paid`/`outstanding_amount`, which is always authoritative regardless.

### 5.3 Payment status derivation (client-side helper logic worth mirroring)

The web app computes a richer status than the raw `payment_status` field for list/badge display,
combining payment state with due-date logic:

- **Cancelled** — invoice `status === 'cancelled'`
- **Paid** — `payment_status === 'Paid'` OR (`total > 0` AND `outstanding_amount <= 0`)
- **Overdue** — not cancelled, not paid, has a `due_date` in the past, AND `outstanding_amount >
  0`
- **Partially Paid** — not any of the above, and `amount_paid > 0`
- **Unpaid** — none of the above

"Due Soon" (used for a dashboard stat, not a stored status) = due within the next 7 days, not
already overdue, and still owed.

"Open Receivable" (used to decide whether an invoice counts toward Receivables totals at all) =
not a credit note, not cancelled, and `outstanding_amount > 0`.

---

## 6. PDF generation — two completely different mechanisms

This is the part most likely to surprise a new integrator, so read carefully.

### 6.1 Server-generated PDF (the real, production path)

```
GET /invoices/{id}/pdf?format=detailed     // or format=simple
```
- `responseType` must be binary/blob — this returns an actual PDF file, not JSON.
- The backend renders this natively (FPDF-based renderer in the backend's own code — confirmed
  directly in the backend repo), **not** via a headless browser. There is no screenshot/HTML
  step on the server side.
- `format=detailed` → the full GST-compliant A4 invoice (letterhead, GSTIN, HSN/SAC, tax
  breakdown, bank details, QR, signature, terms — whatever Invoice Settings has toggled on, see
  §8).
- `format=simple` → a short version: header, bill-to, item list, one total — none of the GST/
  bank/terms detail. Useful for a quick WhatsApp-style receipt send.
- On success, save/share the returned binary as a `.pdf` file named after the invoice number.

### 6.2 Client-side / on-screen PDF export (fallback mechanism — understand why it exists)

The web app *also* has a purely client-side PDF export path: it screenshots an on-screen DOM
node with `html2canvas` and assembles a paginated PDF with `jsPDF` (pixel-accurate render of
whatever template/branding the user is currently looking at). This exists for exactly two
reasons in the web app, neither of which maps directly onto a native mobile app, but both are
worth knowing about:

1. **Demo/offline mode** — when there's no real backend to call (a local testing/demo flag), the
   server PDF endpoint obviously can't be used, so the app renders the invoice template to an
   off-screen element and "prints" that element to a PDF file locally instead.
2. **"Download Sample PDF" in Invoice Settings** — lets an admin preview exactly what their
   current template/branding choices will produce, by rendering the *sample* invoice data
   through the same template components, without needing a real invoice or hitting the server at
   all.

**For the Flutter app, this entire mechanism is irrelevant — always use §6.1 (the real server
endpoint).** It's documented here only so you understand why the web app sometimes behaves as if
there are "two PDFs": there are, but only one of them (the server one) is the real, canonical
document a mobile app should ever generate or rely on.

### 6.3 The orphaned `/print/invoices/:id` route

There is a frontend route (`/print/invoices/:id?token=...&format=...`) that was originally built
on the assumption the backend would launch a headless browser against it to render PDFs
server-side. That assumption turned out to be wrong — the backend's real PDF renderer (§6.1) has
no browser dependency at all — and this route is now orphaned: nothing in the frontend links to
it, and the backend doesn't call it either. **Ignore it entirely; it is not part of the real PDF
pipeline and should not be replicated in the mobile app.**

### 6.4 "Print Receipt (Thermal)"

A separate, parallel concept from the A4 PDF above: a condensed receipt-style layout sized for a
58/80/110mm thermal printer, triggered via the browser's native print dialog (`window.print()`)
against a specially-sized, print-scoped DOM node — not a PDF file at all. For a mobile app, the
equivalent would be integrating with a physical thermal-printer SDK/plugin if that hardware is
in scope; there is no backend endpoint for it (it's a pure frontend/print-driver concern). Skip
this unless the mobile app specifically needs to drive a physical receipt printer.

### 6.5 How the Flutter app should actually implement this (step-by-step)

This is the part worth being extra explicit about, because it's easy to assume the PDF's visual
template (§8) needs to be rebuilt natively — **it does not.** In real (non-demo) mode the web
app never renders the invoice itself; it just downloads the finished file from §6.1. The
on-screen "Invoice Preview" card you can see in the web app (built from `invoiceTemplates.jsx` —
Classic/Modern/Compact/Thermal, branding, colors, column order) exists purely so a human can
eyeball the layout *before* downloading — it is a secondary convenience feature, not the thing
that actually produces the PDF. Treat it as out of scope for the mobile app entirely.

So the Flutter implementation is just "download a file and show/share it":

1. **Request the bytes** — `GET /invoices/{id}/pdf?format=detailed` (or `simple`), with
   `Authorization: Bearer <token>`, expecting a binary response (`application/pdf`). Whatever
   `dio`/`http` client you're using, set the response type to bytes, not JSON.
2. **Save to a temp file** — `path_provider` to get a writable directory, then
   `File('${dir.path}/${invoiceNumber}.pdf').writeAsBytes(bytes)`.
3. **Show it in-app** — a PDF-viewer widget (`syncfusion_flutter_pdfviewer` or `flutter_pdfview`)
   pointed at that saved file. This renders exactly what the backend produced — pixel-identical
   to what a browser would show, because it *is* that same file.
4. **Share / open externally** — `share_plus` to share the file (WhatsApp, email, etc.) or
   `open_filex` to hand it to whatever PDF app is installed on the device.
5. **Printing** (optional, only if the app needs to drive a physical printer) — the `printing`
   package can send the downloaded PDF bytes directly to a connected printer; this works for a
   normal A4 printer and, with the right driver, a thermal printer too. You do not need to
   reconstruct a separate thermal layout — just print the same PDF bytes, or request
   `format=simple` first if a shorter receipt-style version is preferred for a thermal printer.

Whatever template/branding/column choices the organization has saved in Invoice Settings (§8)
are already fully "baked into" the bytes you get back from step 1 — the mobile app never needs
to read `GET /invoice-settings` or reimplement any of the template-selection logic to make the
PDF look right. That endpoint only matters if the mobile app ever wants to let someone *edit*
those settings from the app itself, which is a separate, optional feature.

---

## 7. Credit Notes

```
POST /invoices/{id}/credit-note
Body (optional): { "items": [...], "reason": "..." }
```
- Omit `items` for a **full credit note** against the whole invoice.
- Pass a subset of `items` (with reduced quantities) for a **partial credit note**.
- The created credit note is itself returned as an invoice-shaped object with `is_credit_note:
  true` — treat it as a negative-value sibling document, not a mutation of the original invoice.

---

## 8. Invoice Settings — how the PDF actually looks

```
GET   /invoice-settings
PATCH /invoice-settings      // always send the FULL settings object, never a partial patch
```

This is an organization-wide configuration object (confirmed against the backend's own schema,
not guessed) that controls what the server-rendered PDF (§6.1) looks like. Full shape:

| Key | Shape | Purpose |
|---|---|---|
| `template` | `classic` \| `modern` \| `compact` \| `thermal` | Base layout |
| `template_variant` | string | A named theme preset layered on top of the base template (e.g. "GST Theme 3") — purely cosmetic (colors/dividers), the underlying fields are unaffected |
| `paper_size` | `A4` \| `A5` \| `thermal` | |
| `branding.logo_file_id` / `.signature_file_id` / `.stamp_file_id` / `.payment_qr_file_id` | string\|null | Each is a file ID from the Files API (§8.1); `null` clears it |
| `branding.primary_color` | hex string | Brand color used across headers/accents |
| `typography.font_family` / `.heading_size` / `.body_size` / `.table_size` | strings | |
| `business_details`, `invoice_details`, `party_details`, `item_table`, `payment_details`, `footer`, `regular_print`, `thermal_print` | nested objects | Each is a block of booleans/strings controlling which fields render in that section of the PDF |
| `fields` | flat object of ~14 booleans | **Legacy.** Kept and always sent for backward compatibility, but wherever a key exists in both this flat block and one of the nested blocks above, the **nested value wins** in the actual PDF renderer. Don't rely on this flat block alone. |

Fields that exist in the settings schema but have **no backing data yet** on the Order/Invoice
record (PO number, e-way bill number, vehicle number) will render blank even if toggled on —
that's expected; there's simply nothing to populate them with today.

### 8.1 Uploading branding assets (logo / signature / stamp / payment QR)

```
POST   /files/upload      (multipart/form-data)
GET    /files/{file_id}
DELETE /files/{file_id}
```
Upload returns a file ID; store that ID (not a base64 blob) in the relevant
`branding.*_file_id` field. To *display* an uploaded asset, build its URL as
`{API_BASE_URL}/files/{file_id}` (or use whatever path the upload response itself returns).

### 8.2 Item table columns

The item table's visible/ordered columns are configurable (`item_table.columns`, an ordered
array of column keys) — product, product image, description, HSN/SAC, quantity, UOM, rate, MRP,
discount, tax rate, tax amount, batch number, expiry date, amount. `product`, `quantity`, and
`amount` are always present and can't be turned off; everything else is optional and reorderable.

---

## 9. Online Payment Links (Razorpay)

Lets a customer pay an outstanding invoice online via a shareable link — distinct from the
subscription/billing Razorpay integration elsewhere in the system (that one uses paise; this one
uses whole rupees).

**Prerequisite:** the organization must have Razorpay connected first
(`GET /payment-gateway` → `{ configured: true/false }`; if `false`, send the user to connect it
before attempting to create a link — there's a dedicated Online Payments settings screen for
this in the web app).

```
POST /invoices/{id}/payment-link
Body (all optional — backend defaults to the full outstanding amount / a 7-day expiry):
{ "amount": 500, "expire_in_days": 7, "notify_sms": true, "notify_email": true }
```
- `amount` cannot exceed the invoice's current `outstanding_amount` — validate this client-side
  the same way as §5.2.
- `notify_sms` only makes sense if the invoice has a customer phone number on file;
  `notify_email` likewise needs an email on file.

```
GET  /invoices/{id}/payment-links                       // full history for this invoice
POST /invoices/{id}/payment-links/{linkId}/cancel
GET  /invoices/{id}/payment-links/{linkId}/refresh       // re-polls Razorpay for current status
```

Link status values: `created`, `partially_paid`, `paid`, `expired`, `cancelled`. Only one link
should normally be "active" (`created` or `partially_paid`) at a time per invoice — the web app
surfaces that one prominently with Copy / Open / Share-on-WhatsApp / Refresh / Cancel actions. A
refresh that comes back `paid` should trigger an invoice reload (the payment has landed).

**WhatsApp share** is just a `https://wa.me/<phone>?text=<url-encoded message>` deep link with a
pre-filled message containing the amount, invoice number, org name, and the payment link URL —
there's no WhatsApp Business API integration; it's a plain share-intent the user completes
themselves.

---

## 10. Entry points — every place "Invoice" appears in the app, and what each does

This section exists because it was explicitly asked for: a map of where a user actually
encounters invoice functionality, button by button, so the mobile app's navigation/IA can mirror
the same mental model.

### 10.1 Sidebar / navigation
A top-level nav group called **"Invoice Management"** contains: Sales Invoices, Purchase
Invoices, Supplier Invoices (the latter two being the out-of-scope supplier-side module, §1).

### 10.2 Sales Invoices list page
- Admin role: `/admin/invoices`. Accounts role: `/accounts/invoices/sales` (same panel/data,
  different route prefix + permission scope).
- Header actions: **"New Invoice"** button opens a small choice modal — *"From Sales Order"* vs
  *"Direct / Walk-in"* — picking one navigates to the creation screen (§10.4) in that mode.
  **"Invoice Settings"** button (gear icon) navigates to the settings screen (§8).
- Stat cards across the top: Total Receivables, Overdue, Due Soon, Paid This Month — all derived
  client-side from the listed invoices via the §5.3 logic, not separate backend endpoints.
- Table row: clicking anywhere on the row opens Invoice Detail (§10.5). The Order # cell, if
  present, is its own click target that jumps to that Order's detail page instead. Each row's
  action menu offers **"Record Payment"** (opens the Record Payment drawer directly from the
  list, §10.6) and **"View invoice."**
- Filters: free-text search (invoice #, customer name, order #), payment-status filter, customer
  filter, invoice-date range filter.

### 10.3 Order Detail page (where invoicing usually starts)
On an Order's detail screen (`/admin/orders/{id}`, or the Sales-role equivalent):
- Once the order has been delivered (fully or partially) and no invoice exists yet for that
  state, a disabled **"Invoice Pending"** button shows (invoices are created automatically by a
  backend trigger once the order reaches the right status for the *first/primary* invoice — the
  UI does not call Flow A itself for this case, it just waits and polls).
- Once an invoice exists, the button becomes **"View Invoice"** (or **"View Invoices (N)"** if
  more than one, via per-delivery invoicing) and navigates straight to Invoice Detail.
- If there's a second/third delivery on the same order that still needs its own invoice, a
  **"Generate Invoice"** button appears — this is the one manual entry point into Flow A — and
  navigates to `/admin/invoices/new?orderId={orderId}`, landing directly in the Order-Invoicing
  panel (§10.4).
- A linked Invoice is also referenced from the Order's activity timeline and from any Sales
  Return raised against it (returns are invoice-anchored, looked up by `invoice_reference_id`).

### 10.4 Create Invoice screen (`/admin/invoices/new`)
- Bare visit (no query params) shows a two-card choice: **"From Sales Order"** vs **"Direct /
  Walk-in."**
- `?mode=from-order` → pick a customer, see every one of their orders (invoiced or not) with a
  per-order action: *View Invoice(s)*, *Create Invoice*, *Create Next Invoice* (for further
  per-delivery billing), or an ineligibility badge (*Awaiting Pickup* / *Not Delivered* / *No
  Delivered Quantity*).
- `?mode=direct` → the full manual invoice form: customer (existing/walk-in toggle), invoice
  date, warehouse, a line-item table (product, qty, rate, discount%, tax%, plus
  batch-number/serial-number sub-rows when the selected product requires them), additional
  charges, extra discount, notes, and an optional payment-capture block (method + conditional
  fields + amount collected now) — this is Flow B (§4.2) end-to-end.
- `?orderId={id}` → skips the choice screen entirely and shows the **Order-Invoicing panel**:
  a preview of delivered quantities/amounts, a choice between invoicing the "whole remaining
  order" or a specific uninvoiced delivery, and an **"Issue Invoice"** button that calls Flow A
  (§4.1). This is what the Order Detail page's "Generate Invoice" button lands on.

### 10.5 Invoice Detail screen (`/admin/invoices/{invoiceNumber}`, or the Accounts-role
equivalent `/accounts/invoices/sales/{invoiceNumber}`)
The single richest screen in the module. Actions available here:
- **"Record Payment"** — opens the Record Payment drawer (§10.6); only shown while
  `outstanding_amount > 0` and the user has payment-create permission.
- **"Simple PDF"** / **"Download Detailed Invoice (A4 PDF)"** — both call the server PDF endpoint
  (§6.1) with `format=simple` / `format=detailed` respectively, except in demo/offline mode where
  the detailed one falls back to the client-side export (§6.2) and the simple one is hidden
  entirely (it has no client-side equivalent).
- **"Print Receipt (Thermal)"** — triggers the browser print dialog against a thermal-sized
  layout (§6.4); always available regardless of the org's main template choice.
- **Invoice Preview card** — a live, zoomable, fullscreen-able on-screen render of the invoice
  exactly as the PDF would look (same template components as the real PDF), with a manual
  refresh button. This preview deliberately never shows payment status/paid/due amounts inside
  the document itself — those are shown as a separate badge/tiles *outside* the printable area,
  because a real invoice document shouldn't carry "PAID/UNPAID" stamps baked into the file.
- **Payments table** — every Payment Receipt (§5.2) recorded against this invoice, newest first.
- **Online Payment Links section** (§9) — hidden entirely if there's nothing owed and no links
  exist yet.
- Cross-links: "View Order" (if `order_id` is set) and "View delivery" (if `delivery_id` is set).

### 10.6 Record Payment drawer
A slide-in form (reachable from the list's row-action-menu, the Order Detail page's "Record
Payment" button, and Invoice Detail's "Record Payment" button) that posts to
`POST /payment-receipts` (§5.2). Pre-fills the amount field with the invoice's current
`outstanding_amount`. Enforces the overpayment guard and the method-specific required-field
rules described in §5.2/§4.2.

### 10.7 Invoice Settings screen (`/admin/invoices/settings`)
Configures everything in §8: template/theme, branding uploads, business/invoice/party-detail
toggles, item-table columns, payment-details block, footer/terms, typography. Includes a
**"Download Sample PDF"** action that exports a *mock* invoice through the client-side renderer
(§6.2) so an admin can see the effect of their changes without needing a real invoice — this
button has no backend call behind it at all.

### 10.8 Receivables page (`/admin/receivables`, `/accounts/receivables`)
A read-oriented view listing every "open receivable" (§5.3 definition) sorted by soonest-due,
with aging-bucket columns (Current / 1–30 / 31–60 / 61–90 / 90+ days overdue) and the same
Record Payment action as elsewhere, reusing the same drawer (§10.6).

### 10.9 Accountant Dashboard
Surfaces invoice data read-only: an "Overdue Invoices" stat card, a GST summary computed from
sales + purchase invoices, a payment-status breakdown chart, and an "Overdue Customer Invoices"
table — no invoice actions originate from the dashboard itself, only links out to the screens
above.

---

## 11. Demo/offline mode — a frontend-only testing affordance, ignore for the mobile app

The web app has a local "demo mode" flag that, when active, short-circuits nearly every
invoice/payment API call to a fixed set of seeded sample data instead of hitting the real
backend. In that mode: invoice creation, order→invoice conversion, the server PDF download, and
credit notes are all explicitly blocked/simulated rather than attempted for real, while recording
a payment against one of the seeded sample invoices *is* fully interactive (writes to local
in-memory demo state, not the backend). **This has no backend counterpart and nothing here should
be replicated in the Flutter app** — it exists purely so the web app's QA/sales-demo flow works
without a live server. Mentioned here only so the mobile team doesn't mistake any demo-mode
behavior they might see described elsewhere as a real API contract.

---

## 12. Quick endpoint reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/invoices` | List invoices (filters: `customer_id`, `status`, `order_id`, `page_size`) |
| GET | `/invoices/{id}` | Get one invoice |
| POST | `/invoices` | Create a direct/walk-in invoice (§4.2) |
| POST | `/orders/{orderId}/invoice` | Invoice an order, optionally scoped to one delivery (§4.1) |
| GET | `/invoices/{id}/pdf?format=detailed\|simple` | Download the real server-rendered PDF (§6.1) |
| POST | `/invoices/{id}/credit-note` | Full or partial credit note (§7) |
| GET / PATCH | `/invoice-settings` | Org-wide PDF/template configuration (§8) |
| POST | `/invoices/{id}/payment-link` | Create a Razorpay payment link (§9) |
| GET | `/invoices/{id}/payment-links` | List payment links for an invoice |
| POST | `/invoices/{id}/payment-links/{linkId}/cancel` | Cancel a link |
| GET | `/invoices/{id}/payment-links/{linkId}/refresh` | Re-poll a link's status |
| GET | `/payment-gateway` | Check whether Razorpay is connected for this org |
| GET | `/payment-receipts` | List payment ledger entries (filters: `invoice_id`, `customer_id`) |
| GET | `/payment-receipts/{id}` | Get one receipt |
| POST | `/payment-receipts` | Record a payment against an invoice (§5.2) |
| PATCH | `/payment-receipts/{id}` | Edit method/reference/date/number on a receipt |
| DELETE | `/payment-receipts/{id}` | Void a receipt |
| POST | `/files/upload` | Upload a logo/signature/stamp/QR image |
| GET / DELETE | `/files/{file_id}` | Fetch / remove an uploaded file |
