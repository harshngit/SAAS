# Manual end-to-end QA — 25 October 2026

**Execution status: BLOCKED before opening the application.**

Read the complete user-provided manual QA brief. Attempted to connect the supported visible browser. Browser initialization failed before a browser/tab could be selected, the frontend could be opened, or any authentication could be attempted.

Tooling error returned:

```text
Trusted RPC dependency must resolve within a configured trusted code path:
file:///C:/Users/suraj/.codex/plugins/cache/openai-bundled/browser/26.814.41407/scripts/browser-service.mjs
```

This is a browser automation connection error, not an observed frontend console error or backend API failure. There are no browser screenshots, network traces or UI interaction results from this pass. Source inspection, API scripts and previous automated tests are not substituted for the requested visible manual QA.

## Consolidated results

| # | Requested check | Status / evidence |
| --- | --- | --- |
| 1 | Login and dashboard | NOT TESTED — visible browser could not initialize. |
| 2 | Objects & Fields screen: nine modules, labels, locked classifications and optional toggles | NOT TESTED. |
| 3 | Customer Website OFF/ON and create-form visibility | NOT TESTED. No preferences changed. |
| 4 | Hidden Website data retention through another edit | NOT TESTED. No customer created/edited. |
| 5 | Product Category/Subcategory field-settings dependency and restoration of saved preference | NOT TESTED. |
| 6 | Category/subcategory creation, type associations and duplicate rejection | NOT TESTED. No Footwear or subcategory/type records created. |
| 7 | Product Type canonical ID persistence and reopen | NOT TESTED. No product saved. |
| 8 | Product Create category/subcategory/type dependency | NOT TESTED. |
| 9 | Product Edit parent changes clear downstream selections | NOT TESTED. |
| 10 | Empty Product Type behavior | NOT OBSERVED — no browser interaction. |
| 11 | Product Variants toggle, creation, persistence and separation from Product Type | NOT TESTED. |
| 12 | Parent pricing/variant-section visibility | NOT TESTED. |
| 13 | Product PATCH excludes total_inventory | NOT TESTED in browser. No PATCH request captured. |
| 14 | Existing variant inventory excluded from PATCH; metadata/pricing edit and stock-adjust guidance | NOT TESTED in browser. |
| 15 | Purchase confirmation and Receive Goods Now → Goods Receipts | NOT TESTED. No purchase confirmation or stock-affecting action performed. |
| 16 | Staff reads effective settings, cannot modify settings, and honors visibility | NOT TESTED. No staff session opened. |
| 17 | All network/API failures | NOT CAPTURED. Do not interpret this as zero API errors. |
| 18 | All browser console errors | NOT CAPTURED. The initialization error above is tooling evidence only. |
| 19 | Screenshots/evidence | No UI screenshot available. The exact tool error is recorded above. |
| 20 | Frontend bugs requiring fixes | None established by this manual pass; untested functionality has not been classified as working or broken. |
| 21 | Backend bugs requiring fixes | None established by this manual pass. |
| 22 | Production-ready YES/NO | **NO for QA sign-off: insufficient manual acceptance evidence.** This is not a claim that production is broken. |

## Changes and next step

- No application code fixes made during this pass.
- No new unit tests/build/API probes used as a substitute for manual interaction.
- No credentials requested or entered because the browser failed before authentication.
- No records, organization settings or production data modified or deleted.
- Only this QA report was added.

The supported browser connection must be repaired/restarted before resuming. After connection, use the current frontend with its configured backend, obtain credentials securely at runtime if login requires them, create clearly identifiable QA records, capture UI/network/console evidence, and restore temporary field visibility preferences after testing. Do not mark any item PASS until that item has actually been executed in the visible browser.
