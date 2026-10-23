# Invoice integration/parity pass — 22 October 2026

**Release decision: NO — authenticated checks found live PDF parity failures.** Frontend corrections and automated integration checks are implemented. The local frontend modules successfully authenticated against the deployed backend and downloaded all 28 theme/format combinations. The PDFs use Helvetica rather than DMSans, omit the rupee symbol from extracted text, and include bank/UPI/signatory content in simple format that the corrected frontend hides. Browser visual acceptance, backend runtime packaging and backend tests remain unverified. No backend code or deployment settings were changed.

## Consolidated acceptance report

This table records the initial source-level pass. The authenticated local follow-up at the end supersedes its live-data, PDF availability, font-output and timing statuses with actual deployed endpoint results.

| # | Requirement | Result / evidence |
| --- | --- | --- |
| 1 | Both backend references and integration brief | Read completely: `Invoice PDF parity.md`, `Shared Invoice Theme Catalog & Theme-Aware Invoice PDFs.md`, and the pasted final integration brief. The later parity handoff supersedes the earlier “FPDF approximation” status; neither document proves deployment acceptance. |
| 2 | Frontend source inspection | Traced API normalization, Invoice Settings, 14-theme renderer/catalog, branding precedence, real Invoice Detail, simple/detailed preview, standalone print view, sample export and backend download wrapper before editing. |
| 3 | Backend source inspection | No backend repository exists under this workspace. Renderer implementation, font files and packaging manifests could not be inspected. The deployed public OpenAPI contract was read instead; this is contract evidence, not renderer source verification. |
| 4 | Deployment/runtime status | Configured API: `https://crm-saas-backend.bsmart.workers.dev`. Its public `/openapi.json` advertises `/invoice-templates` and the documented PDF overrides. This does not establish which renderer build is running or production parity. |
| 5 | Font packaging | **Unverified.** No image/build filesystem, Docker packaging or Cloudflare/container logs are available. Cannot confirm DMSans Regular/Bold/Italic and OFL.txt are packaged. No font files were published or dependencies upgraded. |
| 6 | Theme mapping | Existing exact 14 regular/8 thermal IDs retained. Invoice Settings reads authenticated `/invoice-templates`, intersects its choices with the existing visual catalog and warns about missing/mismatched definitions. Legacy/mismatched regular selections fall back to their base template; a thermal organization can retain its regular A4 variant. Downloads use stored selection unless an explicit download-only override is supplied. |
| 7 | Simple totals decision | **Keep the same configured Discount/Tax rows and stored values as detailed.** Remove the old hardcoded simple field preset. Simple hides payment/bank/QR, terms/footer text and signature/stamp, retaining the invoice note. Charges/round-off stay visible when nonzero. No financial rows are hidden merely because the format is simple. |
| 8 | Discount semantics | Invoice line `discount` is money. Preview and detail show currency, not `%`; legacy missing-line-total fallback subtracts the amount, not a percentage. Direct billing still accepts its existing percentage input but serializes its already-calculated `discountAmount` into the API amount field. Existing invoice records, order calculations and backend calculations are not changed. |
| 9 | Additional Charges | Mapped into preview data and displayed for every regular totals style, including inline. Values come from stored `additional_charges`; no new total calculation. |
| 10 | Round Off | Mapped from stored `round_off` and displayed with its sign for every regular totals style, including negative adjustments. |
| 11 | Historical MRP | **Still a limitation.** When the MRP column is configured, preview reads current variant MRP → current product pricing MRP → product MRP, matching the handoff. Enrichment is read-only and explicitly tagged `current-product`; the UI warns that it is not a billing-time snapshot. A historical fix needs a backend invoice-line snapshot and separate approval. |
| 12 | Ship To | InvoiceOut currently exposes only a brief customer; existing authorized customer GET supplies shipping address/contact/GST. Bill To preserves stored invoice billing address. Ship To appears beside Bill To only when the shipping address is nonblank and its visibility setting is enabled. No empty block or category-style fallback. Current customer addresses are not historical snapshots. |
| 13 | Branding | Preview uses real organization/company values, bank, UPI and website. Invoice-specific logo/signature/stamp/QR overrides still win; clearing them restores Company Settings. Letterhead remains above the header. Double Divine now honors logo/contact/PAN/website visibility too. Settings clearly labels its customer/items as a sample instead of presenting sample company/bank values as the real firm. |
| 14 | Item table | Existing order, weights, alignment, mandatory columns and IDs retained. Discount is currency; tax reads canonical stored line `tax` (legacy `tax_amount` fallback). Dedicated Product Image column now renders its image. All configured column definitions are tested. API InvoiceItemOut does not expose every PDF-derived product field; UOM/description/expiry presentation and the backend's full field enrichment still require a live comparison. No unsupported taxable-value column alias was invented. |
| 15 | Currency | Existing `money()` retained: rupee symbol, Indian grouping and two decimal places (`₹ 1,23,456.50`), including negative round-off. |
| 16 | Live data mapping | **Partially verified.** Live public API schemas inspected. Actual frontend GET wrappers → normalization → enrichment → `buildInvoicePreviewData` → real renderer tested using mocked contract-shaped responses. No authenticated live invoice was captured; do not treat these tests as live-data acceptance. Missing permissions/metadata produce preview warnings without fabricating addresses, GST or MRP. |
| 17 | Long invoices / pagination | Frontend renders 1/5/20/60-item fixtures, long names, all configured columns, missing optional data/images and stored total without crashing. **Backend page breaks/repeating headings not executed or visually inspected in this run.** |
| 18 | Production PDF performance | **Not measured.** No authenticated PDF request, concurrency run, memory/CPU measurement or container/Cloudflare log inspection. Handoff's local timings are not production measurements. |
| 19 | Manual theme comparisons | **None.** All 14 × simple/detailed combinations are automated SSR checks only. Browser connection failed before discovery with the trusted-RPC dependency error; no browser screenshot or downloaded production PDF comparison was possible. |
| 20 | Frontend build | `npm.cmd run build`: passed. Existing Vite large-chunk advisory remains. |
| 21 | Frontend lint | `npx.cmd oxlint src/`: 0 errors; 34 baseline warnings; no new warnings. |
| 22 | Backend tests | **Not run: backend source/runtime unavailable.** The supplied handoff reports invoice suites passing locally; it separately reports one pre-existing organization-theme failure and two pre-existing unique-business-ID failures. Those results are not reproduced or represented as this run's results. |
| 23 | Remaining differences | Production visual acceptance; packaged fonts/Python/fpdf2 versions; backend resource behavior; historical MRP/current-profile enrichment; restricted-role settings visibility; exact backend fields not serialized by InvoiceOut; browser/PDF font rasterization and pagination differences. A failed enrichment remains clearly unavailable, rather than being filled with sample business data. |
| 24 | Production-ready YES/NO | **NO for final production sign-off.** Frontend changes are ready for deployed acceptance testing; the requested manual/runtime checks must pass before claiming preview/PDF parity. |

## Exact files changed in this pass (12, including authenticated follow-up)

- `src/api/invoices.js`
- `src/features/invoices/CreateSalesInvoice.jsx`
- `src/features/invoices/InvoiceDetail.jsx`
- `src/features/invoices/InvoicePrintView.jsx`
- `src/features/invoices/InvoiceSettings.jsx`
- `src/features/invoices/invoiceTemplates.jsx`
- `src/features/invoices/invoiceThemePresets.js`
- `src/features/invoices/invoicePreviewSources.js` (new)
- `scripts/test-invoice-detail.mjs`
- `scripts/test-invoice-parity.mjs` (new)
- `scripts/verify-invoice-live.mjs` (new, read-only acceptance helper; credentials supplied through environment only)
- `docs/invoice-integration-parity.md` (this report)

Pre-existing edits to OrderList, Profile, OrganizationsList and UpgradeRequests were preserved and are not part of this pass.

## Validation and limits

New tests exercise the real frontend modules with mocked transport, never changing live invoices or firm settings. The new suite includes 40 checks: all 28 regular theme/format combinations plus data semantics, missing optional fields, current-MRP enrichment, access failures, branding fallback, custom light/dark colors, exact download-only overrides and long-content fixtures. Existing invoice-detail, product-variant, order-address, skeleton and listing-summary suites also passed. Final combined result: **128 tests passed, 0 failed**. `git diff --check` passed.

ThermalPreview, ThermalThemePreview, PaymentQrBlock, withDefaults and money function source was compared with the pre-pass Git version and is unchanged. No thermal redesign, PDF endpoint duplication, auth/entitlement changes, numbering, posting, payment balance, report, plan, storage or role changes were made.

## Required deployed acceptance before release

1. Connect an authenticated browser at `https://beassuite.com/`, using backend `https://crm-saas-backend.bsmart.workers.dev/`, and identify one normal, one 20-item and one 60-item invoice in the same organization. Capture its real normalized preview data and download the official backend simple and detailed PDFs.
2. Compare compact, tally, modern, gst-5, double-divine, gst-1 and gst-4 first; spot-check the remaining themes. Use the exact same saved theme/settings/branding and invoice in each pair. Exercise no GST/logo/Ship To, Ship To present, letterhead, both brand-color extremes, bank/UPI, discounts, charges, negative round-off and long terms/items.
3. Inspect the deployed image/runtime to confirm `app/assets/fonts/dm-sans/{DMSans-Regular.ttf,DMSans-Bold.ttf,DMSans-Italic.ttf,OFL.txt}`, Python/fpdf2 versions, and compatibility. Font URLs or a local copy are not proof of packaging.
4. Measure actual PDF response time and concurrent resource behavior; inspect Cloudflare/container logs. Run the backend invoice suites listed in the handoff and report any pre-existing failures separately.
5. Record actual screenshots/PDF comparisons and runtime evidence, then revisit the NO release decision. Do not infer success from the automated frontend checks or the presence of endpoints in OpenAPI.

## Live production follow-up — 22 October 2026

Used the deployment URLs supplied by the user for read-only probes:

| Request | Observed result |
| --- | --- |
| `https://beassuite.com/` | HTTP 200, HTML. |
| Public frontend entry asset `/assets/index-XYkJmtLG.js` | HTTP 200; contains the configured backend domain. The entry asset alone does not establish that these local changes are deployed, since features may reside in separate chunks. |
| Backend `/openapi.json` | HTTP 200, JSON. Confirms public contract access only. |
| Backend `/invoice-templates` without authentication | HTTP 403. No authenticated theme selection/catalog response verified. |
| Backend `/invoices/7abf6511-7940-430d-9d2e-d6b2dc4c2eab/pdf?format=detailed` without authentication | HTTP 403. No PDF downloaded, rendered or timed for acceptance. |

The in-app browser bootstrap still fails with the trusted-RPC dependency error before an authenticated browser session can be accessed. At the time of these initial unauthenticated probes, **live production acceptance was NOT VERIFIED**. The authenticated follow-up below supersedes that authentication barrier for API/PDF checks, but not for browser visual acceptance.

## Authenticated local follow-up — 22 October 2026

The user supplied demo credentials and authorized local testing. Started the current source with Vite at **http://localhost:5174/** (5173 was already occupied). The local Invoice Settings route returns HTTP 200 and the React application entry. This confirms serving, not a browser-rendered screen.

Used the actual frontend authentication, invoice, organization, customer and theme modules through Vite's module loader, connected to the deployed backend. Credentials/tokens stayed in process memory/environment; none were written to source, reports or downloaded artifacts. The helper performs login and read-only GET operations, with no invoice/settings writes.

| Check | Actual result |
| --- | --- |
| Supplied five accounts | Super Admin, Admin, Sales Officer, Delivery Partner and Accountant login succeeded. Super Admin was checked separately through the same authentication wrapper. |
| Admin dependencies | Invoice settings, organization settings, invoice list and theme catalog loaded successfully. |
| Staff role behavior | Sales, Delivery and Accountant could read invoices and the 14/8 theme catalog; invoice settings returned the existing permission error. No permissions changed. |
| Catalog parity | 14 regular and 8 thermal definitions; zero ID/axis mismatches against the local catalog. Saved selection: compact / gst-3. |
| Live invoice | `IN-10001-2026-0015`, ID `c5dc10b6-ffd3-432f-ba39-cdeda3af1ab8`, 3 items, stored total 1,410.00. No enrichment warnings. 45 invoices listed; the first 15 details inspected had 1–3 items. No 20/60-item live acceptance fixture was established. |
| Local real-data previews | All 14 × simple/detailed SSR renders succeeded and contained the real invoice number and stored total. SSR does not verify layout, image loading or interaction. |
| Live official PDFs | All 28 regular-theme/format downloads returned HTTP 200 and valid PDF headers. All parsed successfully as one-page A4 PDFs. |
| Sequential PDF timings | 3,341–6,770 ms; mean 3,742 ms across 28 requests, including network/edge time. Not a concurrency, CPU/memory or renderer-only benchmark. |
| Stored total | Extracted PDF total matched 1,410.00; frontend real-data previews retained the stored total. |
| Font/currency discrepancy | Every parsed PDF references Helvetica / Helvetica-Bold / Helvetica-Oblique. No DMSans font is referenced. Extracted PDF amounts lack `₹`; local preview markup includes it. This is a confirmed output discrepancy; container font packaging and the reason for fallback are still unknown. |
| Simple-format discrepancy | `classic-simple.pdf` contains Bank, UPI, “Scan to pay via UPI” and “Authorised signatory”; corresponding simple frontend preview excludes these detailed extras. Production output therefore fails the agreed simple-format parity behavior. |
| Browser / visual inspection | **NOT VERIFIED.** Browser connection fails before access. The temporary native PDF renderer was also blocked by Windows Application Control; a pure-Python reader was used for text/font/page checks instead. No screenshots, visual overlays or QR scan-readability claim. |
| Validation after follow-up | Build passed again. Oxlint passed with the same existing source warnings and no helper errors; helper syntax check passed. The earlier 128-test result remains valid; no application code changed during this follow-up. |

Local evidence is under `C:\Users\suraj\AppData\Local\Temp\invoice-live-acceptance-2026-10-22`: 28 official PDFs, 28 real-data preview HTML fragments, extracted PDF text, `report.json` and `pdf-inspection.json`. These contain real demo invoice data and are intentionally outside Git. The initial helper report's `stampUrl`/`paymentQrUrl` presence keys were diagnostic typos, corrected to `stampSealUrl`/`qrCodeUrl` in the helper; the old presence flags are not evidence that assets are missing.

**Overall parity acceptance: FAIL for the confirmed live output differences; visual acceptance remains NOT VERIFIED.** Investigate the deployed backend renderer/font setup and simple-format footer behavior before sign-off. Backend modifications remain outside this pass's authorization.
