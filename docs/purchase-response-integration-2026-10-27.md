# Purchase / Supplier Invoice response integration — 2026-10-27

## Files changed in this pass

- src/api/purchases.js
- src/api/supplierInvoices.js
- src/features/purchases/purchaseHelpers.js
- src/features/purchases/PurchaseInvoiceDetail.jsx
- src/features/supplierInvoices/supplierInvoiceHelpers.js
- src/features/supplierInvoices/SupplierInvoiceDetail.jsx
- scripts/test-purchase-response-integration.mjs
- docs/purchase-response-integration-2026-10-27.md

Pre-existing workspace edits were preserved. PurchaseInvoiceList.jsx needs no direct edit: its desktop/mobile badges and payment filter already use the corrected shared derivePaymentStatus helper.

## Integration

Purchase payment badges use backend payment_status. Both partially_paid and legacy partial display Partially Paid; unknown states are humanized with neutral styling and missing states show Unknown. Lifecycle and receiving states remain independent. Purchase outstanding reads outstanding_balance (or the existing outstanding_amount field), not total minus amount_paid. Missing normalized payment values remain null; detail money fields show a dash.

Supplier Invoice Items read the documented canonical product_name, sku, ordered_qty, received_qty, billed_qty, unit_price, purchase_price, discount_amount, tax_amount and line_total. Zero money values remain zero; null values display a dash. Missing line totals are not calculated. No Purchase state or secondary API populates these item fields. Percentage fields remain available for the existing editor/request builder; the detail table uses the returned monetary discount/tax amounts. Demo rendering retains its existing local simulation.

Invoice-level quantity_match and price_match take precedence over legacy nested matching data, preserving true, false and null. Verification displays check/cross Matched/Mismatch, or a dash. Pending uses neutral Pending / Awaiting Goods, and recording a pending invoice no longer incorrectly announces Verification matched.

The existing onGrnChange callback increments grnRefresh after successful GRN actions. Linked Supplier Invoice loading now depends on that counter and refetches GET /supplier-invoices?purchase_id=...; stale responses are ignored by the existing effect cleanup. On failure stale linked results are cleared and an error is displayed. The full Supplier Invoice page fetches GET /supplier-invoices/{id} on navigation. No verification result is manually changed to matched.

Misleading Purchase Payments text changed: YES. It now says payment totals come from supplier payments allocated to the purchase's supplier invoices. The amount-derived status preview was removed. Existing payment submission bodies/endpoints were preserved as requested; no fake payment history was added.

No backend, Supplier Payment request contract, GRN requests/stock behavior, Accounts Payable calculations, receiving lifecycle, Category/Brand or Product hierarchy code changed.

## Verification

- node --test scripts/test-purchase-response-integration.mjs scripts/test-grn-popup-actions.mjs scripts/test-listing-summaries.mjs: 53 passed, 0 failed. Seven new response integration tests cover the supplied example, canonical money/status authority, legacy/unknown payment statuses, null/zero items, top-level verification booleans, pending-to-matched refetch responses and request-field isolation.
- npm run build: PASS; existing large bundle warning remains.
- npm run lint: 0 errors, 36 existing warnings. Targeted lint on the six changed source files emits no warnings/errors.
- git diff --check: no whitespace errors.

## Remaining gaps / manual acceptance

Live manual acceptance items 1–17 are NOT VERIFIED. Browser initialization failed before navigation: `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. This is a tooling failure, not evidence of an application failure. The real PO-10001-2026-0006 / TEST-PUR-002 records and Supplier Payment/AP UI interactions were not accessed or mutated.

The supplied 10,000 total / 4,000 paid / 6,000 outstanding and item/matching example is covered with mocked backend responses. This does not establish that production currently returns those values. No screenshots or live network evidence were captured.
