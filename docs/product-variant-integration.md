# Product Variant and Classification frontend integration

## Focused correction pass

Rechecked the existing integration against the follow-up brief. The admin/sales routes, shared variant picker, internal UUID payloads, nested pricing, read-only variant codes and independent classification fields were already present in the working tree. They were retained rather than rewritten.

This correction pass changes exactly five files:

- `src/features/orders/CreateSalesOrder.jsx`
- `src/features/quotations/QuotationFormPage.jsx`
- `src/features/products/productUtils.js`
- `scripts/test-product-variants.mjs`
- `docs/product-variant-integration.md`

Remaining defects fixed: an unavailable variant can now be removed from a saved line; reselecting a product that no longer has variants discards its stale variant line; empty manual prices stay empty on blur rather than becoming invented zero prices; invalid/nonfinite quotation prices are rejected; and explicit null classification values returned by the backend no longer revive stale edit fallback values. Unrelated partial-response fallback behavior is retained.

Added nine checks for these cases, the actual expand control revealing both variant choices before quantity selection, and the real admin/sales route/form wiring. The final combined test run passes 73 checks: 30 variant integration checks and 43 listing-summary checks. Build passes. Oxlint has zero errors and the same 34 baseline warnings, with no new warnings.

The complete integration file list below includes work already present before this focused pass. No backend, global table layout, permissions, plans, reports, storage, reconciliation or Order lifecycle changes were made in this correction pass. Live manual browser/database persistence remains unverified for the reason documented under Remaining limitations.

## Inspection and contract sources

Before editing, traced raw product responses through `normalizeApiProduct`, Product Add/Edit hydration, form submission, Product create/PATCH payloads and Product Detail. Traced the shared `ProductPickerList` through Order and Quotation create/edit/duplicate/prefill, outgoing item serialization, incoming item normalization and detail display. Inspected existing category parent relationships, product/variant schemas and API error handling.

Contract sources: the supplied finalized Product Variant and Classification brief, `scripts/openapi.json`, existing frontend API adapters and repository API notes. The saved OpenAPI snapshot is older: it describes variant `id`, `sku`, numeric `inventory`, legacy `price`, and Order/Quotation `variant_id`, but does not describe the newly finalized `variant_code`/nested variant pricing. Those additions follow the supplied brief. Product Type remains text; no canonical Product Type lookup is documented, so none was invented.

## 1. Exact files changed (14)

- `src/api/products.js`
- `src/api/orders.js`
- `src/utils/productVariants.js` (new)
- `src/features/products/productUtils.js`
- `src/features/products/ProductForm.jsx`
- `src/features/products/ProductDetail.jsx`
- `src/features/orders/ProductPickerList.jsx`
- `src/features/orders/CreateSalesOrder.jsx`
- `src/features/orders/OrderDetail.jsx`
- `src/features/orders/OrderDetailView.jsx`
- `src/features/quotations/QuotationFormPage.jsx`
- `src/features/quotations/QuotationDetail.jsx`
- `scripts/test-product-variants.mjs` (new)
- `docs/product-variant-integration.md` (this report)

## 2–7. Product variants

- Variant Code is read from backend `variant_code` and displayed as read-only business metadata in Product Detail/Edit and selected Order/Quotation rows.
- Internal UUID remains `id`/`variantId`. New form rows receive no generated UUID or business code. Existing IDs are sent on PATCH; new variants omit both `id` and `variant_code`.
- Variant SKU always comes from that variant. Missing values show a placeholder. Clearing SKU sends `null`; parent SKU is never substituted into a variant row.
- Canonical pricing is nested `pricing`: purchase/selling price, MRP, wholesale/dealer price, discount percent, tax inclusive, currency. The form edits each separately and the API writes nested snake_case fields. Known zero values and false booleans survive. Legacy `price` is supported only as selling-price compatibility, never as a source for invented cost/tier prices.
- Numeric variant inventory is mapped independently of parent total stock. Missing stock is not replaced by parent stock or automatically written back as zero on an existing variant.
- Product Detail shows Variant Code, Variant, SKU, Purchase Price, Selling Price, MRP, Stock and Margin. Missing cost produces an unavailable margin. Product-level total stock is still shown separately.
- Product Edit retains the existing image/name/SKU/stock row layout and adds the complete pricing fields, currency and read-only code. New variants start with empty pricing/SKU; the user supplies the selling price. React row positions are UI keys, not API identifiers.

## 8–10. Orders and Quotations

Both pages reuse the existing shared picker. A multi-variant product expands into exact variant rows. Each row shows its own name, code, SKU, selling price and stock. Product-level header stock is explicitly labeled total stock. A single variant is selected automatically; non-variant products retain their simple flow.

Line editing uses the composite product/variant key only inside the UI, so two variants of the same product have independent quantities and price overrides. Order quantity changes and submission enforce the selected variant's known stock limit. Quotation stock remains a reference; it does not gain the Order stock cap. Missing catalog price stays empty until the user enters the existing manual override.

Both outgoing item contracts remain:

```text
product_id = product UUID
variant_id = selected variant's internal UUID (omitted for non-variant products)
quantity = selected line's quantity
unit_price = selected variant selling price or the user's existing override
```

Neither `variant_code` nor the UI composite key is sent as `variant_id`. Existing Order/Quotation API item builders are reused. Order prefill now retains `variantId`; Quotation edit/duplicate already retained it. Detail screens resolve metadata through the existing product GET wrapper for each distinct document product, avoiding a first-catalog-page fallback to parent SKU. Existing order lifecycle, discounts, taxes, fulfilment, warehouse and payment logic are retained.

## 11–13. Classification and legacy data

The form presents Category → Sub Category → Product Type in that order. Category uses readable top-level category options; brand-linked options are restricted to those categories. Sub Category options match the selected parent's ID. Changing Category clears the child selection. Invalid retained relationships receive a validation message; an empty child is sent as `sub_category_id: null`.

Product Type is actual text, with suggestions from real Product Types only. Category IDs/names are never copied into it. UUID-like legacy Product Types normalize to an empty value and display a placeholder until corrected. Product Detail lists Category, Sub Category and Product Type separately and resolves missing category labels through the existing category list API. Product List inherits the corrected mapper without any table layout changes.

Legacy variants with only `price` keep that selling price. Missing variant SKU, cost, tier pricing, currency and stock are not manufactured from parent data. Existing backend validation messages, including 400/422 variant/classification errors, remain readable strings; product field errors still route to the relevant form tab.

## 14. Regression results

`node --test scripts/test-product-variants.mjs`: 30 passing checks. These run actual frontend modules against mocked API transport and exercise actual form/picker handlers and rendered markup. Coverage includes:

- Nested pricing precedence, zero/false preservation, missing values, SKU clearing and legacy pricing.
- New/existing mixed-variant payloads and UUID/business-code separation.
- Actual Product submit → PATCH → fresh GET mapping for SKU/pricing/classification.
- Simple/single/multiple variants, independent line quantities, stock limits and manual overrides.
- Actual Order and Quotation item payloads, normalized responses and reopened form state.
- Category changes, invalid child relationships and UUID-like Product Types.
- Shared picker/Product Detail markup and readable backend errors.

`node --test scripts/test-listing-summaries.mjs`: all 43 existing summary regression checks pass.

## 15–16. Build and lint

`npm run build`: passes. Vite reports its existing large-chunk advisory.

`npx oxlint src/`: zero errors; the same 34 pre-existing warnings; no new warnings. Compared against a baseline recorded before this task, ignoring source line offsets and dependency-name ordering.

## 17. Remaining limitations

Live manual browser save/hard-refresh and real Order/Quotation creation were not verified. Browser bootstrap fails with a trusted RPC dependency error for `browser-service.mjs`. The save/reopen tests use mocked transport and do not prove live backend/database persistence. No live records were created or altered.

The repository OpenAPI snapshot does not yet describe the finalized additions; this integration follows the supplied final brief for those fields. Product/variant availability and metadata remain subject to the authenticated backend's access scope and responses. Backend stock/relationship validation remains authoritative.
