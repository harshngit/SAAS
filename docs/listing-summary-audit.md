# Listing summary audit

Summary cards use the original unfiltered source within the user's existing access scope. Search, filters, date ranges, sort order and pagination apply to table rows. Record creation, edits, deletion, payments and imports may legitimately update the summaries.

| Page | Result |
| --- | --- |
| Categories | Removed API search from the source; existing local search/filter/sort still drive table rows. |
| Customers | Separate unfiltered summary, retaining sales officer scope. Mutations update both sources. |
| Leads | All card calculations use the unfiltered summary, including counts, sources and conversion. |
| Quotations | Cards use all unfiltered quotations, including demo rows under the existing demo policy. |
| Products | Separate unfiltered catalog summary; mutations update both sources. |
| Suppliers | Separate unfiltered supplier summary; mutations update both sources. Demo policy preserved. |
| Inventory | Load unfiltered inventory; apply search/category/status/sort to table rows locally. |
| Warehouses | Already independent: cards aggregate `warehouses`; table uses derived rows. Unchanged. |
| Purchases | Separate unsorted, unfiltered purchase source for cards. |
| Purchase Returns | Existing independent status-count queries retained. Removed the filtered-page fallback while counts load. |
| Orders | Raw-data aggregation was already correct for local filters. Added a full unfiltered summary to prevent server sorting changing the first-page sample used by cards. |
| Sales Returns | Removed API status filtering from the source; existing local status filtering affects the table. |
| Deliveries | Already independent: cards aggregate `deliveries`. Unchanged. |
| Vehicles | Already independent: cards aggregate `vehicles`. Unchanged. |
| Receivables | Already independent: cards aggregate the page's open-receivable source, before table controls. Unchanged. |
| Accounts Payable | Unfiltered existing summary endpoint; summary refresh is independent of table controls and follows payment refreshes. |
| Supplier Payments | Independent summary fetch across all pages, refreshed after recording/voiding payments. Removed misleading “this page” labels. |
| Expenses — admin | Already independent: cards aggregate `expenseList`. Unchanged. |
| Expenses — self-service | Separate unfiltered summary preserving `submitted_by`; creation, edits and cancellation update it. |
| Collection Reconciliation | Already independent: cards aggregate `collections`. Unchanged. |
| Supplier Invoices | Independent summary fetch across all pages. Removed misleading “this page” labels and filtered table count from cards. |
| Leaves — self-service | Already independent: counts aggregate the user's original `leaves`. Unchanged. |
| Organizations | Separate unfiltered summary, independent of status, upgrade status, plan, business type and date filters. |
| Upgrade Requests | Separate unfiltered request summary across all statuses. Organizations without an upgrade request remain excluded. |

The frontend pagination adapters now forward `page` where necessary so summaries can read all available pages through existing endpoints. No backend changes or new endpoints.

Validation: `npm run build`, `npx oxlint src/`, and `node --test scripts/test-listing-summaries.mjs` (43 checks). The checks evaluate actual summary expressions, exercise pagination through actual frontend adapters with mocked responses, retain access scope, and verify mutation updaters. They are code-level regression checks, not browser interaction or responsive visual tests.
