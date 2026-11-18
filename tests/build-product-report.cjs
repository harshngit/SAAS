// Builds qa-test/product-creation-report.md from results.json + state.json + T8-matrix.json
const H = require('./pw-helpers.cjs'); const { fs, path } = H
const R = H.results(); const S = H.state()
const M = JSON.parse(fs.readFileSync(path.join(H.OUT, 'T8-matrix.json'), 'utf8'))

// T25 (aggregate of every session) and overrides decided after inspecting evidence
R.T25 = { id: 'T25', name: 'Browser console / network errors', status: 'FAIL',
  expected: 'No application-related uncaught JS errors or unexpected 4xx/5xx on product flows',
  actual: 'No uncaught JS error / React error in any session. Network: (a) POST /products returned the Worker 503 "Server is busy or restarting. Please retry in a few seconds." about 9 times across ~45 UI create attempts (T3 x1, T6 x3, T16 x2, T16S x1, T24 x1, one probe x1); every time exactly 1 POST was sent, nothing was saved, the UI showed the message and no duplicate appeared; the same body sent a moment later returned 201 in 2-4 s. (b) 16 x POST /products 422 are the deliberate invalid-input probes of T8 (expected). (c) 404s are the deleted QA product (T19) and its sub-resources. (d) 29 console lines "Failed to load resource: 403" are the known hosting-level GET /login noise (no API call). No failed dropdown/master request, no broken product image.' }
R.CM.status = 'FAIL'
R.CM.actual += ' ROOT CAUSES: (1) Inventory page: it calls GET /inventory once with no paging (src/api/inventory.js:40 getStockBoard, src/features/inventory/StockBoard.jsx:188) so only the first page (10 of 101 products) is loaded; the "Tracked Products 10 / Total Stock Units" cards are computed from those 10 and the search box filters only those 10 client-side, so a new product is not found there (GET /inventory?search=<name> does return it). (2) A deactivated product is still offered in Sales Order, Purchase and Quotation pickers.'
R.ATT.status = 'FAIL'
R.ATT.actual += ' DETAIL: cover image and additional image uploaded (201) and shown after refresh: OK. A PDF in "Product Datasheet" saved (product_datasheet set). A PDF chosen in "Other Attachments" was uploaded (HTTP 201) but is NOT attached: GET /products/{id}/attachments = [] and the detail page says "No attachments uploaded yet" (BUG-PROD-010). A .txt file forced into the PDF-only "Compliance Certificate" slot was uploaded and saved (compliance_certificate set; BUG-PROD-011); the image slots do refuse a non-image (message "invalid.txt is not an image file").'
R.T14.notes = 'Observation (BUG-PROD-012): with Track inventory switched OFF the Opening Stock field stays enabled and the 7 entered is stored and shown as Total Stock 7 while inventory_tracking=false.'
R.T6.notes ='Five of the seven products that now share this SKU were created by my debugging probes (all deleted at cleanup); the UI create alone produced one duplicate.'

const order = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T16S', 'T17', 'T18', 'T18b', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'VAR', 'ATT', 'CM']
const rows = order.map((id) => R[id]).filter(Boolean)
const count = (s) => rows.filter((r) => r.status === s).length
const fmt = (o) => { try { return JSON.stringify(o).slice(0, 700) } catch (e) { return '' } }
const created = S.created || []
const kept = created.filter((c) => !c.deleted)

let o = `# Product Creation QA Report

## Environment

| | |
|---|---|
| URL | ${H.BASE} (hosted app, live backend) |
| Date / time | 2026-11-18, ${new Date().toTimeString().slice(0, 5)} local (runs between 12:17 and ${new Date().toTimeString().slice(0, 5)}) |
| User / role | Rahul Sharma, Admin, organization "Sunrise Distributors Pvt. Ltd." (demo Admin account from .env.qa.local; the same 5 demo accounts are also listed in plain text in .env.example) |
| Browser | Installed Google Chrome through Playwright (channel "chrome", headed, slowMo 250 ms), viewport 1440x1000 |
| Spec | \`tests/product-creation-qa.spec.cjs\` (+ \`tests/pw-helpers.cjs\`). Note: not \`.spec.ts\`: the project has no \`@playwright/test\` runner and \`package.json\` is "type": "module", so it is plain Node + the installed \`playwright\` library, run as \`node tests/product-creation-qa.spec.cjs <ids|all>\` |
| Evidence | \`qa-test/product-creation/\` (screenshots, \`results.json\`, \`T8-matrix.json\`, \`state.json\`) |
| Rules kept | No application source changed. Every record starts with \`QA-PW-\`. Only records created by this suite were deleted (see Cleanup). |

## Summary

| Total | Passed | Failed | Blocked | Not testable |
|---|---|---|---|---|
| ${rows.length} | ${count('PASS')} | ${count('FAIL')} | ${count('BLOCKED')} | ${count('NOT TESTABLE')} |

(Rows are the 25 numbered tests plus Variants, Attachments, Cross-module, and two sub-checks: T16S spaces in name/SKU and T18b reactivate.)

**Failed:** ${rows.filter((r) => r.status === 'FAIL').map((r) => r.id).join(', ')}. Every FAIL is an application finding listed under "Bugs Found"; none is a test-script problem (script/selector problems were fixed in the test and re-run; the transient-503 re-runs are documented under Environment notes).

**Not testable from the current UI:** Minimum Stock, Maximum Stock, Reorder Level and Reorder Quantity (backend fields, but the non-variant Product form only exposes Opening Stock; they exist only per variant). They were therefore not part of T4/T8 for simple products.

## Environment notes (not product verdicts)

${(S.incidents || []).map((i) => `- **${i.test}:** ${i.what}`).join('\n')}
- Two things worth knowing about the backend while reading the results: a product create takes ~2-5 s, and the Worker answers with the clean JSON 503 above when the container is busy.

## Test Results
`
for (const r of rows) {
  o += `
### ${r.id} - ${r.name}
- **Status:** ${r.status}${r.priority ? ' (priority ' + r.priority + ')' : ''}
- **Expected:** ${r.expected}
- **Actual:** ${String(r.actual).replace(/\n/g, ' ')}
- **Evidence:** ${r.notes || ''}${r.screenshot ? ' Screenshot: `' + r.screenshot + '`' : ' (no screenshot for this check)'}
${r.api ? '- **API:** `' + fmt(r.api) + '`' : ''}
`
}
// T8 matrix
o += `
### T8 detail - numeric matrix (every field, every probe)

Verdict key: OK = blocked in the UI or rejected with a message / non-numeric text cannot be typed; OK-SERVER = the UI let it through and the backend rejected it (message shown); INFO-ACCEPTED = accepted and stored, no rule defined for it; FAIL = invalid value stored.

| Field | Input | Value left in the field after blur | Request sent | HTTP | Stored value | Verdict | Message shown |
|---|---|---|---|---|---|---|---|
`
for (const r of M) o += `| ${r.field} | \`${r.input}\` | \`${r.uiValueAfterBlur}\` | ${r.requestSent ? 'yes' : 'no (blocked in UI)'} | ${r.http == null ? '-' : r.http} | ${r.created ? r.stored : '-'} | ${r.verdict} | ${(r.message || '').replace(/\|/g, '/').slice(0, 110)} |\n`
o += `
Reading it: negative **Purchase Price / Selling Price** are blocked in the form; negative **MRP, Wholesale, Dealer, Discount %** and **Discount % = 101** are stored (BUG-PROD-001). Integer fields (**Opening Stock, Minimum Order Quantity, Download Limit**) keep \`1.5\` in the field and are only refused by the backend with a technical message (BUG-PROD-002). Letters cannot be typed (number inputs). GST/VAT Rate -5 and 101 were refused. Prices and physical sizes accept decimals and \`99999999999\` (no upper limit defined; informational).

## Bugs Found
`
const bugs = [
  { id: 'BUG-PROD-001', title: 'Negative MRP / Wholesale / Dealer price and Discount % (-5, 101) are accepted and stored', sev: 'MEDIUM', pri: 'P1', steps: 'Add Product; fill the required fields; Pricing tab: MSRP/MRP = -5 (or Wholesale, Dealer, Discount % = -5, Discount % = 101); Add Product.', exp: 'Rejected in the form (like negative Purchase/Selling Price) and by the API (0 or more; discount 0-100).', act: 'HTTP 201; product saved with mrp = -5, wholesale_price = -5, dealer_price = -5, discount_percent = -5 and 101 (T8-matrix.json). The form shows no error.', ev: 'T8 rows MSRP/MRP, Wholesale, Dealer, Discount (%) = -5 and 101. Backend: `ProductPricingIn` / `ProductPricingUpdate` in app/schemas/product.py have no ge/le, while the variant pricing model (`VariantPricingIn`) has ge=0 and discount le=100. Frontend: `validate()` in ProductForm.jsx only checks purchasePrice / sellingPrice.', who: 'BOTH (backend is the root cause; frontend does not pre-check)', notes: 'Same hole on PATCH (ProductPricingUpdate).' },
  { id: 'BUG-PROD-002', title: 'Integer quantity fields accept decimals in the UI; refusal comes late, with a technical message', sev: 'MEDIUM', pri: 'P2', steps: 'Inventory tab Opening Stock = 1.5 (also Purchase tab Minimum Order Quantity = 1.5, Digital tab Download Limit = 1.5); Add Product.', exp: 'Integer inputs: 1.5 cannot be entered / is refused next to the field with a plain message.', act: 'The field keeps 1.5; the request is sent; backend answers 422 and the banner shows "opening_stock: Input should be a valid integer, got a number with a fractional part".', ev: 'T8 rows Opening Stock, Minimum Order Quantity, Download Limit = 1.5 (OK-SERVER). The fields are `type=number step=1` with no integer enforcement in ProductForm.jsx.', who: 'FE (backend validation itself is correct)', notes: 'Nothing wrong is stored. Price/size decimals are intentionally allowed.' },
  { id: 'BUG-PROD-003', title: 'Duplicate SKU is accepted silently (no uniqueness, no warning), although SKU is also used as a lookup code', sev: 'MEDIUM', pri: 'P2', steps: 'Create a product with SKU X; create another with the same SKU X.', exp: 'Rejected with a clear message (or at least a warning) if SKU is meant to identify a product.', act: 'Second product saved (HTTP 201, new product_id); several products now share the SKU. Duplicate product NAMES are also accepted (T7) - informational.', ev: 'T6. `Product.sku` is an indexed, non-unique column; `ProductCreate.sku` is only max_length=100; `_owned()` in app/routers/products.py resolves `GET/PATCH/DELETE /products/{ref}` by UUID, product_id, **sku** or barcode, so a shared SKU makes that lookup ambiguous. The form has no duplicate check.', who: 'BOTH', notes: 'If duplicate SKUs are a deliberate business choice, this becomes a documentation item and the by-SKU lookup should be removed.' },
  { id: 'BUG-PROD-004', title: 'Two variants with the same name are accepted on one product', sev: 'MEDIUM', pri: 'P2', steps: 'Check "multiple variants"; attribute "Size"; add two variants both named "Small" with prices; Add Product.', exp: 'Duplicate variant combination rejected / prevented.', act: 'Product saved with two variants named "Small".', ev: 'VAR result (the 2-variant "Small"/"Medium" product itself saved and persisted correctly: variants card 2, total stock = sum of variant stock, unique variant codes).', who: 'BOTH (no check in `validate()` or in the backend)', notes: '' },
  { id: 'BUG-PROD-005', title: 'Intermittent HTTP 503 "Server is busy or restarting" on POST /products', sev: 'MEDIUM', pri: 'P2', steps: 'Create products repeatedly through the UI (or API).', exp: 'Create succeeds every time.', act: 'About 9 of ~45 UI creates returned 503 (T3 x1, T6 x3 in a row, T16 x2, T16S x1, T24 x1, one probe); each time 1 POST, nothing saved, message shown, retry works. The identical body replayed through the API returned 201 in 2-4 s.', ev: 'Environment notes + T25. Response header retry-after: 5, body code container_unavailable.', who: 'BE / infrastructure (Worker container availability); the frontend handles it well', notes: 'Not a product-form defect, but it makes creation look unreliable.' },
  { id: 'BUG-PROD-006', title: 'Inventory page loads only the first 10 products; its stats and search ignore the rest (new product cannot be found there)', sev: 'HIGH', pri: 'P1', steps: 'Create a product with opening stock 20; open Inventory; search for it.', exp: 'Inventory lists / finds every product; "Tracked Products" and "Total Stock Units" cover all products.', act: 'Page shows "Tracked Products 10" while the org has 101 products; search says "No stock items match these filters." GET /inventory?search=<name> returns the product (total 1).', ev: 'CM (screenshot `qa-test/product-creation/_probe-inventory-search.png`). Frontend: src/features/inventory/StockBoard.jsx:188 calls `getStockBoard()` with no page/search; src/api/inventory.js:40 sends none; the backend default page_size is 10.', who: 'FE', notes: 'Outside Product Creation proper, found by the cross-module check.' },
  { id: 'BUG-PROD-007', title: 'A deactivated product is still selectable in Sales Order, Purchase and Quotation pickers', sev: 'MEDIUM', pri: 'P3', steps: 'Deactivate a product; open Create Sales Order / Purchase / Quotation and search it.', exp: 'Inactive products are not offered for new documents (or the rule is documented).', act: 'Found in all three (status inactive, is_active false).', ev: 'CM / state.json cross.inactive.', who: 'FE (pickers do not pass is_active=true) - confirm the business rule first', notes: '' },
  { id: 'BUG-PROD-008', title: '"Primary Product Image" is marked required (*) but not enforced', sev: 'LOW', pri: 'P4', steps: 'Create a product without an image.', exp: 'Either enforced or the asterisk removed.', act: 'Product created without cover_image (T3).', ev: 'ProductForm.jsx field list has required: true for coverImage; validate() does not check it.', who: 'FE', notes: '' },
  { id: 'BUG-PROD-010', title: '"Other Attachments" on the Create form uploads the file but never attaches it to the product', sev: 'MEDIUM', pri: 'P2', steps: 'Create form > Documents tab > Other Attachments: choose a PDF; Add Product; open the product.', exp: 'The file appears under Attachments on the product.', act: 'Upload request returns 201, product is saved, but GET /products/{id}/attachments returns [] and the detail page shows "No attachments uploaded yet." (the file is silently lost).', ev: 'ATT. In ProductForm.jsx the field is otherAttachmentsName (only a name); attachments are added only from ProductDetail.jsx via addProductAttachments (api/products.js:500).', who: 'FE', notes: 'Attachments added from the detail page itself were not part of this run.' },
  { id: 'BUG-PROD-011', title: 'Document slots accept a file of the wrong type (only the picker filter protects them)', sev: 'LOW', pri: 'P4', steps: 'Documents tab > Compliance Certificate (accept .pdf): select a .txt (via "All files" or programmatically); Add Product.', exp: 'Refused like the image slots ("... is not an image file").', act: 'The .txt was uploaded (201) and saved as compliance_certificate.', ev: 'ATT; the image handlers use getImageFileError, the document handlers do not validate.', who: 'FE (and the backend upload has no type check for these)', notes: 'No dangerous file was used: a plain text file.' },
  { id: 'BUG-PROD-012', title: 'Opening Stock stays enabled and is stored when "Track inventory" is switched off', sev: 'LOW', pri: 'P4', steps: 'Inventory tab: untick Track inventory, Opening Stock 7, Add Product.', exp: 'Stock fields disabled/ignored when tracking is off, or documented.', act: 'inventory_tracking=false but opening_stock=7 and total_stock=7 are stored and shown.', ev: 'T14.', who: 'BOTH (business rule to confirm)', notes: '' },
  { id: 'BUG-PROD-009', title: 'API stores leading/trailing spaces in name and SKU (only the UI trims)', sev: 'LOW', pri: 'P4', steps: 'POST /products with name "   X   ".', exp: 'Trimmed.', act: 'Stored untrimmed through the API; the form trims before sending (T16S passes).', ev: 'Probe with direct API calls (deleted at cleanup).', who: 'BE', notes: 'Imports or other clients could create names that do not match when searched/compared.' },
]
for (const b of bugs) o += `
### ${b.id}
- **Title:** ${b.title}
- **Severity:** ${b.sev}
- **Priority:** ${b.pri}
- **Module:** Products${/Inventory/.test(b.title) ? ' / Inventory' : ''}
- **Steps to reproduce:** ${b.steps}
- **Expected:** ${b.exp}
- **Actual:** ${b.act}
- **Frontend/API evidence:** ${b.ev}
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** ${b.who}
- **Notes:** ${b.notes || '-'}
`
o += `
## What works (for the record)

- Create page, categories and sub categories load; blank form is blocked with field-level messages: mandatory = Product Name, Product Code / SKU, Category, Sub Category, Purchase Price, Selling Price (Status and UOM have defaults).
- Minimal and full products are created once, with every exposed field persisted (31 API fields + 14 detail-page fields compared), also after hard reload and navigation.
- Category to Sub Category dependency is correct and a stale sub category cannot be saved.
- GST: exclusive 100 stays 100, inclusive 118 stays 118 (tax_inclusive true, 18%); one tax-inclusive value, persists on edit.
- Opening stock 20 gives opening_stock 20 / total_inventory 20 / total_stock 20 immediately (detail page and GET /inventory); stock 0 shows 0; the inventory-tracking toggle saves.
- Margin shown is the **sales margin** (selling - purchase) / selling x 100 rounded: 50/118 -> 58% (markup would be 136%), see T23.
- Edit persists (name, prices, GST, category/sub, description; updated_at changes); Opening Stock is locked in edit mode; deactivate/reactivate/delete work with confirmations; a rapid double-click creates one product; variants (2 variants) and attachments (image + PDF) save and persist.
- UI trims leading/trailing spaces; long values (name 120, SKU 48, description 400) are intact; the name/SKU inputs stop at 150/50 characters.

## Cleanup

All ${created.length} records created by this suite start with \`QA-PW-\`. ${S.cleanup ? `The ${S.cleanup.deleted} junk records made by the T8 matrix, my debugging probes and the duplicate-SKU / duplicate-variant / double-submit extras were deleted (API DELETE, only ids created by this run).` : ''} The core test products were **kept** for your review (search "QA-PW" in Products): ${kept.map((c) => String(c.name).trim()).join(', ')}. Existing real products and the earlier QA-TEST products were not touched. Say the word and I will delete these too.

## Final Verdict

**PASS WITH MINOR ISSUES** - Product Creation itself is usable and stores correct data (including GST and opening stock). It should not be closed until BUG-PROD-001 (negative MRP/Wholesale/Dealer/Discount stored), BUG-PROD-002, BUG-PROD-003 and the intermittent 503 (BUG-PROD-005) are decided; BUG-PROD-006 (Inventory page shows 10 of 101 products) is HIGH but belongs to the Inventory screen. There is no functional blocker in the create flow, so I did not call it FAIL.
`
fs.writeFileSync(path.join(H.ROOT, 'qa-test', 'product-creation-report.md'), o)
console.log('report written', o.length, 'chars;', rows.length, 'rows;', 'pass', count('PASS'), 'fail', count('FAIL'), 'blocked', count('BLOCKED'))
