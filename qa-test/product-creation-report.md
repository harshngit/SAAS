# Product Creation QA Report

## Environment

| | |
|---|---|
| URL | https://crm-saas.asynk.in (hosted app, live backend) |
| Date / time | 2026-11-18, 13:16 local (runs between 12:17 and 13:16) |
| User / role | Rahul Sharma, Admin, organization "Sunrise Distributors Pvt. Ltd." (demo Admin account from .env.qa.local; the same 5 demo accounts are also listed in plain text in .env.example) |
| Browser | Installed Google Chrome through Playwright (channel "chrome", headed, slowMo 250 ms), viewport 1440x1000 |
| Spec | `tests/product-creation-qa.spec.cjs` (+ `tests/pw-helpers.cjs`). Note: not `.spec.ts`: the project has no `@playwright/test` runner and `package.json` is "type": "module", so it is plain Node + the installed `playwright` library, run as `node tests/product-creation-qa.spec.cjs <ids|all>` |
| Evidence | `qa-test/product-creation/` (screenshots, `results.json`, `T8-matrix.json`, `state.json`) |
| Rules kept | No application source changed. Every record starts with `QA-PW-`. Only records created by this suite were deleted (see Cleanup). |

## Summary

| Total | Passed | Failed | Blocked | Not testable |
|---|---|---|---|---|
| 30 | 24 | 6 | 0 | 0 |

(Rows are the 25 numbered tests plus Variants, Attachments, Cross-module, and two sub-checks: T16S spaces in name/SKU and T18b reactivate.)

**Failed:** T6, T8, T25, VAR, ATT, CM. Every FAIL is an application finding listed under "Bugs Found"; none is a test-script problem (script/selector problems were fixed in the test and re-run; the transient-503 re-runs are documented under Environment notes).

**Not testable from the current UI:** Minimum Stock, Maximum Stock, Reorder Level and Reorder Quantity (backend fields, but the non-variant Product form only exposes Opening Stock; they exist only per variant). They were therefore not part of T4/T8 for simple products.

## Environment notes (not product verdicts)

- **T3 (first attempt):** POST /products returned 503 "Server is busy or restarting. Please retry in a few seconds." (clean JSON 503 from the Worker); UI showed the banner, exactly 1 POST was sent, no product was created. Re-run of T3 passed. Environment, not a product defect.
- **T6 (3 attempts):** The duplicate-SKU create through the UI returned the Worker 503 "Server is busy or restarting" three times in a row (all 1 POST, nothing saved); the identical request body replayed directly via the API and a later UI attempt both returned 201 in ~2-4 s. Treated as a transient backend/container availability problem during that window, not a SKU rule.
- Two things worth knowing about the backend while reading the results: a product create takes ~2-5 s, and the Worker answers with the clean JSON 503 above when the container is busy.

## Test Results

### T1 - Product Create page loads
- **Status:** PASS
- **Expected:** Page renders, form controls, Save button, category dropdowns load, no critical failures
- **Actual:** ok: form tabs rendered Basic Information, Product Images & Media, Inventory Information, Pricing Information, Tax Information, Purchase Information, Physical Specifications, Digital Product Information, Additional Information, Documents; ok: Product Name input ; ok: Category dropdown loads 21 options; ok: Sub Category dropdown loads after Category 2 options; ok: Add Product button available on the last tab ; ok: no failed critical API request []; ok: no unexpected console error []
- **Evidence:** The single console line "Failed to load resource: 403" is the known hosting-level GET /login noise, not an app API call. Screenshot: `qa-test/product-creation/01-product-create-page.png`


### T2 - Blank form validation
- **Status:** PASS
- **Expected:** No product created; each required field shows an error next to it; no crash
- **Actual:** API writes: 0; product total before/after: 31/31. Top banner: "Can't save yet (Basic Information tab) — Product name is required. (+5 more)". Errors on Basic tab: ["*","Product name is required.","*","Product code / SKU is required.","Category is required.","Sub Category is required.","*"]; on Pricing tab: ["Purchase price is required.","Selling price is required."]. Currently mandatory: Product Name, Product Code / SKU, Category, Sub Category, Purchase Price, Selling Price (Product Status and UOM have defaults). "Primary Product Image" is marked with * but is NOT enforced (see T3).
- **Evidence:**  Screenshot: `qa-test/product-creation/02-required-validation.png`


### T3 - Minimal valid product
- **Status:** PASS
- **Expected:** Created once; success feedback; in list; detail opens; values persist after refresh
- **Actual:** POST status 201, POST count 1, toast "Product created QA-PW-Minimal-2611181217 was saved.", landed on /admin/products; 1 product(s) named QA-PW-Minimal-2611181217; product_id PRD-0027; detail after refresh shows "₹ 50" purchase / ₹ 118 selling. Created WITHOUT a primary image although the field is marked *. 
- **Evidence:**  Screenshot: `qa-test/product-creation/03-minimal-product-created.png`
- **API:** `{"request":{"name":"QA-PW-Minimal-2611181217","description":"","price":118,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-MIN-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":0,"pricing":{"purchase_price":50,"selling_price":118,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":true,"op`

### T4 - Complete standard product
- **Status:** PASS
- **Expected:** All exposed fields persisted and shown on the detail page and after refresh
- **Actual:** All 31 API fields and 14 detail fields match; cover_image saved. Note: Minimum/Maximum Stock, Reorder Level and Reorder Quantity are not exposed on the non-variant Product form (only Opening Stock) so they could not be entered.
- **Evidence:**  Screenshot: `qa-test/product-creation/04-full-product-detail.png`
- **API:** `{"request":{"name":"QA-PW-Full-2611181217","description":"QA-PW complete product description","price":118,"cover_image":"/files/e8ea8c50-15a0-4ea3-b232-0250dd95951d","images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-FULL-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":20,"pricing":{"purchase_price":50,"selling_price":118,"mrp":150,"wholesale_price":110,"dealer_price":105,"discount_percent":5,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"QA-PW-BC-2611181217",`

### T5 - Category to Subcategory dependency
- **Status:** PASS
- **Expected:** Sub categories follow the category; stale sub category cleared; cannot be saved stale
- **Actual:** Beverages -> ["Water Bottles","Water Pouches"]; picked "Beverages › Water Bottles" (shown ""); after switching to Electronics shown ""; Electronics -> ["Fans"]; submit with cleared sub: writes=0 banner="Can't save yet (Basic Information tab) — Sub Category is required.". 
- **Evidence:**  Screenshot: `qa-test/product-creation/05-category-subcategory.png`


### T6 - Duplicate SKU
- **Status:** FAIL
- **Expected:** Duplicate SKU rejected with a clear message (if uniqueness is a system rule)
- **Actual:** ACCEPTED: a second product PRD-0036 was saved with the same SKU QA-PW-SKU-MIN-2611181217; 7 products now share it. Backend: no uniqueness rule on products.sku (ProductCreate.sku is only max_length=100; no UniqueConstraint on the model), and the form shows no warning.
- **Evidence:** Five of the seven products that now share this SKU were created by my debugging probes (all deleted at cleanup); the UI create alone produced one duplicate. Screenshot: `qa-test/product-creation/06-duplicate-sku.png`
- **API:** `{"request":{"name":"QA-PW-DupSku-2611181217","description":"","price":60,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-MIN-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":0,"pricing":{"purchase_price":50,"selling_price":60,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":true,"openi`

### T7 - Duplicate product name
- **Status:** PASS
- **Expected:** Record the actual rule (not a bug unless the business requires unique names)
- **Actual:** Duplicate names are ALLOWED: PRD-0028 saved with the same name as PRD-0027 (HTTP 201). No schema rule requires unique names.
- **Evidence:** Informational: behaviour documented, not treated as a defect. Screenshot: `qa-test/product-creation/07-duplicate-name.png`


### T8 - Numeric field validation
- **Status:** FAIL
- **Expected:** Negative / above-range / non-numeric / decimal-on-integer / huge values are blocked or normalised for every numeric field; no 5xx
- **Actual:** 60 field/value probes. Failing: MSRP/MRP=-5 -> FAIL ; Wholesale Price=-5 -> FAIL ; Dealer Price=-5 -> FAIL ; Discount (%)=-5 -> FAIL ; Discount (%)=101 -> FAIL . Matrix in qa-test/product-creation/T8-matrix.json
- **Evidence:**  Screenshot: `qa-test/product-creation/08-numeric-validation.png`


### T9 - Price relationship
- **Status:** PASS
- **Expected:** Purchase 50 / Selling 118 persist and display unswapped; selling card = persisted selling price; selling 0 behaviour recorded
- **Actual:** stored 50/118, detail purchase ₹ 50, card ₹ 118. Selling Price = 0 is ACCEPTED (product PRD-0077 created, price 0). No rule forces selling >= purchase.
- **Evidence:**  (no screenshot for this check)


### T10 - GST tax-exclusive product
- **Status:** PASS
- **Expected:** tax_rate 18, tax_inclusive false, selling price stays 100 (no double tax)
- **Actual:** API tax_rate 18, tax_inclusive false, selling_price 100; detail: Selling Price ₹ 100, GST 18%, Tax Inclusive No
- **Evidence:**  Screenshot: `qa-test/product-creation/10-gst-exclusive.png`
- **API:** `{"request":{"name":"QA-PW-GST-EXCL-2611181217","description":"","price":100,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-GSTEXCL-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":20,"pricing":{"purchase_price":50,"selling_price":100,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":tr`

### T11 - GST tax-inclusive product
- **Status:** PASS
- **Expected:** selling 118, tax 18, inclusive true; detail shows ₹118 / 18% / Yes / ₹50
- **Actual:** API selling 118, tax_rate 18, tax_inclusive true; detail Selling Price ₹ 118, Avg. GST 18%, Tax Inclusive Yes, Purchase ₹ 50. 118 not recalculated.
- **Evidence:**  Screenshot: `qa-test/product-creation/11-gst-inclusive.png`
- **API:** `{"request":{"name":"QA-PW-GST-INCL-2611181217","description":"","price":118,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-GSTINCL-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":20,"pricing":{"purchase_price":50,"selling_price":118,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":true,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":tru`

### T12 - Opening stock / inventory (new untouched product)
- **Status:** PASS
- **Expected:** opening_stock 20 and total_stock 20 immediately after creation
- **Actual:** opening_stock 20, total_inventory 20, total_stock 20; detail Total Stock 20; GET /inventory row total_stock 20. Product list has NO stock column.
- **Evidence:**  Screenshot: `qa-test/product-creation/12-opening-stock.png`
- **API:** `{"request":{"name":"QA-PW-Stock20-2611181217","description":"","price":118,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-STK20-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":20,"pricing":{"purchase_price":50,"selling_price":118,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":true,`

### T13 - Zero opening stock
- **Status:** PASS
- **Expected:** Created, Total Stock 0, active
- **Actual:** opening_stock 0, total_stock 0, active; detail Total Stock 0
- **Evidence:**  (no screenshot for this check)
- **API:** `{"request":{"name":"QA-PW-Stock0-2611181217","description":"","price":60,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-STK0-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":0,"pricing":{"purchase_price":50,"selling_price":60,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":true,"open`

### T14 - Inventory tracking toggle
- **Status:** PASS
- **Expected:** Toggle exists; saved value matches; no contradictory stock state
- **Actual:** ON: opening stock disabled=false. OFF: opening stock disabled=false (value "7"). Saved inventory_tracking=false, opening_stock=7, total_stock=7; detail Total Stock 7. 
- **Evidence:** Observation (BUG-PROD-012): with Track inventory switched OFF the Opening Stock field stays enabled and the 7 entered is stored and shown as Total Stock 7 while inventory_tracking=false. Screenshot: `qa-test/product-creation/14-tracking-off.png`
- **API:** `{"request":{"name":"QA-PW-NoTrack-2611181217","description":"","price":60,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","vendor":"","brand":"","sku":"QA-PW-SKU-NOTRACK-2611181217","category_id":"8db6aa10-5a86-4547-930a-fdd99a8e8d7a","total_inventory":7,"pricing":{"purchase_price":50,"selling_price":60,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"variations":[],"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_tracking":false,`

### T15 - Optional fields left blank
- **Status:** PASS
- **Expected:** Blank optional fields do not block, never print undefined/null; empty state is a dash; API holds null/empty
- **Actual:** Created without any optional field. Detail shows 25 dashes, no "undefined"/"null". API optional values: {"manufacturer":"","model_number":"","short_name":"","barcode":"","description":"","notes":"","hsn_code":"","supplier_product_code":"","lead_time":"","color":"","material":"","product_tags":[],"launch_date":null}
- **Evidence:**  (no screenshot for this check)
- **API:** `{"optional_fields":{"manufacturer":"","model_number":"","short_name":"","barcode":"","description":"","notes":"","hsn_code":"","supplier_product_code":"","lead_time":"","color":"","material":"","product_tags":[],"launch_date":null}}`

### T16 - Long text / boundary values
- **Status:** PASS
- **Expected:** Normal long strings saved intact; leading/trailing spaces trimmed; field limits enforced
- **Actual:** Long name(120)/sku(48)/model(80)/desc(400)/notes(300)/barcode(60): saved and equal; typing 170 chars into name keeps 150, 70 into SKU keeps 50. 
- **Evidence:**  Screenshot: `qa-test/product-creation/16-long-values.png`


### T16S - Leading/trailing spaces in name and SKU
- **Status:** PASS
- **Expected:** Spaces are trimmed before saving
- **Actual:** trimmed: name "QA-PW-Space-2611181217" sku "QA-PW-SKU-SP-2611181217"
- **Evidence:**  (no screenshot for this check)
- **API:** `{"request_name":"QA-PW-Space-2611181217","request_sku":"QA-PW-SKU-SP-2611181217"}`

### T17 - Edit product persistence
- **Status:** PASS
- **Expected:** Edited values persist (API, refresh, list, detail); updated_at changes; unchanged fields stay
- **Actual:** PATCH 200; name/prices/GST/description/category/sub updated; updated_at 2026-11-18T06:49:58.889484Z -> 2026-11-18T07:26:45.397329Z; SKU/barcode unchanged. Opening Stock field in the edit form is DISABLED (locked after creation; stock changes only through stock workflows).
- **Evidence:**  Screenshot: `qa-test/product-creation/17-product-edit.png`
- **API:** `{"request":{"name":"QA-PW-Minimal-2611181217-EDIT","description":"QA-PW edited description","price":150,"cover_image":null,"images":[],"product_video":"","product_catalog_brochure":"","product_manual":"","product_datasheet":"","compliance_certificate":"","warranty_document":"","download_file":"","product_type":"","brand":"","sku":"QA-PW-SKU-MIN-2611181217","category_id":"0a2eb82e-3a9e-4a04-8819-45709581d2a1","is_active":true,"variations":[],"pricing":{"purchase_price":60,"selling_price":150,"mrp":0,"wholesale_price":0,"dealer_price":0,"discount_percent":0,"tax_inclusive":false,"currency":"INR"},"barcode":"","short_name":"","manufacturer":"","model_number":"","status":"active","inventory_trac`

### T18 - Deactivate (QA product only)
- **Status:** PASS
- **Expected:** status inactive, detail + list reflect it, data intact
- **Actual:** status=inactive, is_active=false; detail shows Inactive; list row "QA-PW-GST-EXCL-2611181217 PRD-0078 · QA-PW-SKU-GSTEXCL-2611181217 - Beverages Beverages › "; name/sku/GST/stock/price unchanged
- **Evidence:**  Screenshot: `qa-test/product-creation/18-deactivated-list.png`


### T18b - Reactivate
- **Status:** PASS
- **Expected:** status active again
- **Actual:** status=active, is_active=true
- **Evidence:**  (no screenshot for this check)


### T19 - Delete (QA product only)
- **Status:** PASS
- **Expected:** Confirmation appears; product removed; direct access no longer an active product; list updated
- **Actual:** Confirmation "Delete Product Delete QA-PW-Minimal-2611181217? This cannot be undone."; GET /products/{id} -> 404; redirected to /admin/products; not in list; direct detail shows "Product not found | Product not found | Back to Products"
- **Evidence:**  Screenshot: `qa-test/product-creation/19-deleted-detail.png`


### T20 - Refresh / persistence
- **Status:** PASS
- **Expected:** Product, prices, category, GST, stock, SKU, status remain after reload / navigation / re-fetch
- **Actual:** ok: hard reload; ok: navigate away and back; ok: re-fetch from API equal; ok: detail values still correct
- **Evidence:**  (no screenshot for this check)


### T21 - API / UI consistency
- **Status:** PASS
- **Expected:** Every compared field equals between detail page and GET /products/{id}
- **Actual:** Compared name, product_id, sku, category, status, uom, opening/total stock, tax_rate, hsn, price, purchase/selling/mrp/wholesale/dealer/discount, tax_inclusive, is_active on minimal:PRD-0027, full:PRD-0026, gstincl:PRD-0079, gstexcl:PRD-0078, stock20:PRD-0080: no mismatch
- **Evidence:**  (no screenshot for this check)


### T22 - Product Detail UI
- **Status:** PASS
- **Expected:** Cards and sections correct, ₹ and % formatted, clean empty states
- **Actual:** Cards: Variants 0, Selling ₹ 118, Avg GST 18%, Avg Margin 58%, Total Stock 20; sections Classification/Pricing/Tax & Purchase/Physical/Additional/Attachments present; category "Beverages" / "Beverages › Water Bottles"; empty fields show a dash
- **Evidence:**  Screenshot: `qa-test/product-creation/22-product-detail.png`


### T23 - Margin display
- **Status:** PASS
- **Expected:** Formula documented; 50/118 shows 58% under the sales-margin formula (markup would be 136%)
- **Actual:** Implemented formula (src/utils/productVariants.js variantMargin): (selling - purchase) / selling x 100 = SALES MARGIN, rounded to a whole number in ProductDetail ("const avgMargin = margins.length ? Math.round(margins.reduce((sum, value) => sum + value, 0) / margins.length) : null"). 50/118 -> 58%; page shows "58%". Not markup (136%).
- **Evidence:**  (no screenshot for this check)


### T24 - No duplicate submission
- **Status:** PASS
- **Expected:** One normal click = one product; a rapid double-click still creates one
- **Actual:** T3 normal click sent exactly one POST (see T3). Rapid double-click (attempt 2, earlier attempts hit the transient 503 and saved nothing): 1 POST request(s), HTTP 201; 1 product(s) named QA-PW-Dbl-2611181217. 
- **Evidence:**  (no screenshot for this check)
- **API:** `{"posts":1}`

### T25 - Browser console / network errors
- **Status:** FAIL
- **Expected:** No application-related uncaught JS errors or unexpected 4xx/5xx on product flows
- **Actual:** No uncaught JS error / React error in any session. Network: (a) POST /products returned the Worker 503 "Server is busy or restarting. Please retry in a few seconds." about 9 times across ~45 UI create attempts (T3 x1, T6 x3, T16 x2, T16S x1, T24 x1, one probe x1); every time exactly 1 POST was sent, nothing was saved, the UI showed the message and no duplicate appeared; the same body sent a moment later returned 201 in 2-4 s. (b) 16 x POST /products 422 are the deliberate invalid-input probes of T8 (expected). (c) 404s are the deleted QA product (T19) and its sub-resources. (d) 29 console lines "Failed to load resource: 403" are the known hosting-level GET /login noise (no API call). No failed dropdown/master request, no broken product image.
- **Evidence:**  (no screenshot for this check)


### VAR - Variants (create from Product Create UI)
- **Status:** FAIL
- **Expected:** has_variants, 2 variants saved with stock/prices, Variants card = 2, persists, duplicates prevented
- **Actual:** two variants both named "Small" were accepted
- **Evidence:**  Screenshot: `qa-test/product-creation/24-variants-detail.png`
- **API:** `{"variants":[{"name":"Small","sku":null,"variant_code":"VAR-0016","inventory":10},{"name":"Medium","sku":null,"variant_code":"VAR-0017","inventory":5}]}`

### ATT - Attachments / images
- **Status:** FAIL
- **Expected:** Valid image + PDF accepted and shown after refresh; unsupported type refused
- **Actual:** cover_image https://crm-saas-backend.bsmart.workers.dev/files/ad2d6bf1-cc44-42e1-9ce0-c5d44302f763; images ["https://crm-saas-backend.bsmart.workers.dev/files/013d9bf1-b285-48eb-b696-c784493d48bf"]; attachments API 200 []; uploads status [201,201,201,201,201]; invalid .txt in image slot: invalid.txt is not an image file. Primary Product Image * PNG, JPG, JPEG, or WebP Previ;   DETAIL: cover image and additional image uploaded (201) and shown after refresh: OK. A PDF in "Product Datasheet" saved (product_datasheet set). A PDF chosen in "Other Attachments" was uploaded (HTTP 201) but is NOT attached: GET /products/{id}/attachments = [] and the detail page says "No attachments uploaded yet" (BUG-PROD-010). A .txt file forced into the PDF-only "Compliance Certificate" slot was uploaded and saved (compliance_certificate set; BUG-PROD-011); the image slots do refuse a non-image (message "invalid.txt is not an image file").
- **Evidence:**  Screenshot: `qa-test/product-creation/25-attachments-detail.png`


### CM - Cross-module discoverability
- **Status:** FAIL
- **Expected:** Active QA product is selectable in Sales Order / Purchase / Quotation / Inventory; deactivated behaviour recorded
- **Actual:** ACTIVE (PRD-0080): salesOrder found, inventory NOT found, purchase found, quotation found. DEACTIVATED (PRD-0078, status inactive): salesOrder found, inventory NOT found, purchase found, quotation found.  ROOT CAUSES: (1) Inventory page: it calls GET /inventory once with no paging (src/api/inventory.js:40 getStockBoard, src/features/inventory/StockBoard.jsx:188) so only the first page (10 of 101 products) is loaded; the "Tracked Products 10 / Total Stock Units" cards are computed from those 10 and the search box filters only those 10 client-side, so a new product is not found there (GET /inventory?search=<name> does return it). (2) A deactivated product is still offered in Sales Order, Purchase and Quotation pickers.
- **Evidence:**  Screenshot: `qa-test/product-creation/26-cross-module-active.png`


### T8 detail - numeric matrix (every field, every probe)

Verdict key: OK = blocked in the UI or rejected with a message / non-numeric text cannot be typed; OK-SERVER = the UI let it through and the backend rejected it (message shown); INFO-ACCEPTED = accepted and stored, no rule defined for it; FAIL = invalid value stored.

| Field | Input | Value left in the field after blur | Request sent | HTTP | Stored value | Verdict | Message shown |
|---|---|---|---|---|---|---|---|
| Opening Stock | `-5` | `-5` | yes | 422 | - | OK | opening_stock: Input should be greater than or equal to 0, total_inventory: Input should be greater than or eq |
| Opening Stock | `abc` | `` | yes | 201 | 0 | OK |  |
| Opening Stock | `1.5` | `1.5` | yes | 422 | - | OK-SERVER | opening_stock: Input should be a valid integer, got a number with a fractional part, total_inventory: Input sh |
| Opening Stock | `99999999999` | `99999999999` | yes | 422 | - | OK | opening_stock: Input should be less than or equal to 2147483647, total_inventory: Input should be less than or |
| Purchase Price | `-5` | `-5` | no (blocked in UI) | - | - | OK | opening_stock: Input should be less than or equal to 2147483647, total_inventory: Input should be less than or |
| Purchase Price | `abc` | `` | no (blocked in UI) | - | - | OK | opening_stock: Input should be less than or equal to 2147483647, total_inventory: Input should be less than or |
| Purchase Price | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Purchase Price | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Selling Price | `-5` | `-5` | no (blocked in UI) | - | - | OK | Can't save yet (Pricing Information tab) — Selling price cannot be negative. |
| Selling Price | `abc` | `` | no (blocked in UI) | - | - | OK | Can't save yet (Pricing Information tab) — Selling price is required. |
| Selling Price | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Selling Price | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| MSRP/MRP | `-5` | `-5` | yes | 201 | -5 | FAIL |  |
| MSRP/MRP | `abc` | `` | yes | 201 | 0 | OK |  |
| MSRP/MRP | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| MSRP/MRP | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Wholesale Price | `-5` | `-5` | yes | 201 | -5 | FAIL |  |
| Wholesale Price | `abc` | `` | yes | 201 | 0 | OK |  |
| Wholesale Price | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Wholesale Price | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Dealer Price | `-5` | `-5` | yes | 201 | -5 | FAIL |  |
| Dealer Price | `abc` | `` | yes | 201 | 0 | OK |  |
| Dealer Price | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Dealer Price | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Discount (%) | `-5` | `-5` | yes | 201 | -5 | FAIL |  |
| Discount (%) | `101` | `101` | yes | 201 | 101 | FAIL |  |
| Discount (%) | `abc` | `` | yes | 201 | 0 | OK |  |
| Discount (%) | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| GST/VAT Rate | `-5` | `-5` | yes | 422 | - | OK | tax_rate: Input should be greater than or equal to 0 |
| GST/VAT Rate | `101` | `101` | yes | 422 | - | OK | tax_rate: Input should be less than or equal to 100 |
| GST/VAT Rate | `abc` | `` | yes | 201 | 0 | OK |  |
| GST/VAT Rate | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Minimum Order Quantity | `-5` | `-5` | yes | 422 | - | OK | minimum_order_quantity: Input should be greater than or equal to 0 |
| Minimum Order Quantity | `abc` | `` | yes | 201 | 0 | OK |  |
| Minimum Order Quantity | `1.5` | `1.5` | yes | 422 | - | OK-SERVER | minimum_order_quantity: Input should be a valid integer, got a number with a fractional part |
| Minimum Order Quantity | `99999999999` | `99999999999` | yes | 422 | - | OK | minimum_order_quantity: Input should be less than or equal to 2147483647 |
| Weight | `-5` | `-5` | yes | 422 | - | OK | weight: Input should be greater than or equal to 0 |
| Weight | `abc` | `` | yes | 201 | 0 | OK |  |
| Weight | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Weight | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Length | `-5` | `-5` | yes | 422 | - | OK | length: Input should be greater than or equal to 0 |
| Length | `abc` | `` | yes | 201 | 0 | OK |  |
| Length | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Length | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Width | `-5` | `-5` | yes | 422 | - | OK | width: Input should be greater than or equal to 0 |
| Width | `abc` | `` | yes | 201 | 0 | OK |  |
| Width | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Width | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Height | `-5` | `-5` | yes | 422 | - | OK | height: Input should be greater than or equal to 0 |
| Height | `abc` | `` | yes | 201 | 0 | OK |  |
| Height | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Height | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Volume | `-5` | `-5` | yes | 422 | - | OK | volume: Input should be greater than or equal to 0 |
| Volume | `abc` | `` | yes | 201 | 0 | OK |  |
| Volume | `1.5` | `1.5` | yes | 201 | 1.5 | INFO-ACCEPTED |  |
| Volume | `99999999999` | `99999999999` | yes | 201 | 99999999999 | INFO-ACCEPTED |  |
| Download Limit | `-5` | `-5` | yes | 422 | - | OK | download_limit: Input should be greater than or equal to 0 |
| Download Limit | `abc` | `` | yes | 201 | 0 | OK |  |
| Download Limit | `1.5` | `1.5` | yes | 422 | - | OK-SERVER | download_limit: Input should be a valid integer, got a number with a fractional part |
| Download Limit | `99999999999` | `99999999999` | yes | 422 | - | OK | download_limit: Input should be less than or equal to 2147483647 |

Reading it: negative **Purchase Price / Selling Price** are blocked in the form; negative **MRP, Wholesale, Dealer, Discount %** and **Discount % = 101** are stored (BUG-PROD-001). Integer fields (**Opening Stock, Minimum Order Quantity, Download Limit**) keep `1.5` in the field and are only refused by the backend with a technical message (BUG-PROD-002). Letters cannot be typed (number inputs). GST/VAT Rate -5 and 101 were refused. Prices and physical sizes accept decimals and `99999999999` (no upper limit defined; informational).

## Bugs Found

### BUG-PROD-001
- **Title:** Negative MRP / Wholesale / Dealer price and Discount % (-5, 101) are accepted and stored
- **Severity:** MEDIUM
- **Priority:** P1
- **Module:** Products
- **Steps to reproduce:** Add Product; fill the required fields; Pricing tab: MSRP/MRP = -5 (or Wholesale, Dealer, Discount % = -5, Discount % = 101); Add Product.
- **Expected:** Rejected in the form (like negative Purchase/Selling Price) and by the API (0 or more; discount 0-100).
- **Actual:** HTTP 201; product saved with mrp = -5, wholesale_price = -5, dealer_price = -5, discount_percent = -5 and 101 (T8-matrix.json). The form shows no error.
- **Frontend/API evidence:** T8 rows MSRP/MRP, Wholesale, Dealer, Discount (%) = -5 and 101. Backend: `ProductPricingIn` / `ProductPricingUpdate` in app/schemas/product.py have no ge/le, while the variant pricing model (`VariantPricingIn`) has ge=0 and discount le=100. Frontend: `validate()` in ProductForm.jsx only checks purchasePrice / sellingPrice.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BOTH (backend is the root cause; frontend does not pre-check)
- **Notes:** Same hole on PATCH (ProductPricingUpdate).

### BUG-PROD-002
- **Title:** Integer quantity fields accept decimals in the UI; refusal comes late, with a technical message
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Products
- **Steps to reproduce:** Inventory tab Opening Stock = 1.5 (also Purchase tab Minimum Order Quantity = 1.5, Digital tab Download Limit = 1.5); Add Product.
- **Expected:** Integer inputs: 1.5 cannot be entered / is refused next to the field with a plain message.
- **Actual:** The field keeps 1.5; the request is sent; backend answers 422 and the banner shows "opening_stock: Input should be a valid integer, got a number with a fractional part".
- **Frontend/API evidence:** T8 rows Opening Stock, Minimum Order Quantity, Download Limit = 1.5 (OK-SERVER). The fields are `type=number step=1` with no integer enforcement in ProductForm.jsx.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE (backend validation itself is correct)
- **Notes:** Nothing wrong is stored. Price/size decimals are intentionally allowed.

### BUG-PROD-003
- **Title:** Duplicate SKU is accepted silently (no uniqueness, no warning), although SKU is also used as a lookup code
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Products
- **Steps to reproduce:** Create a product with SKU X; create another with the same SKU X.
- **Expected:** Rejected with a clear message (or at least a warning) if SKU is meant to identify a product.
- **Actual:** Second product saved (HTTP 201, new product_id); several products now share the SKU. Duplicate product NAMES are also accepted (T7) - informational.
- **Frontend/API evidence:** T6. `Product.sku` is an indexed, non-unique column; `ProductCreate.sku` is only max_length=100; `_owned()` in app/routers/products.py resolves `GET/PATCH/DELETE /products/{ref}` by UUID, product_id, **sku** or barcode, so a shared SKU makes that lookup ambiguous. The form has no duplicate check.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BOTH
- **Notes:** If duplicate SKUs are a deliberate business choice, this becomes a documentation item and the by-SKU lookup should be removed.

### BUG-PROD-004
- **Title:** Two variants with the same name are accepted on one product
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Products
- **Steps to reproduce:** Check "multiple variants"; attribute "Size"; add two variants both named "Small" with prices; Add Product.
- **Expected:** Duplicate variant combination rejected / prevented.
- **Actual:** Product saved with two variants named "Small".
- **Frontend/API evidence:** VAR result (the 2-variant "Small"/"Medium" product itself saved and persisted correctly: variants card 2, total stock = sum of variant stock, unique variant codes).
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BOTH (no check in `validate()` or in the backend)
- **Notes:** -

### BUG-PROD-005
- **Title:** Intermittent HTTP 503 "Server is busy or restarting" on POST /products
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Products
- **Steps to reproduce:** Create products repeatedly through the UI (or API).
- **Expected:** Create succeeds every time.
- **Actual:** About 9 of ~45 UI creates returned 503 (T3 x1, T6 x3 in a row, T16 x2, T16S x1, T24 x1, one probe); each time 1 POST, nothing saved, message shown, retry works. The identical body replayed through the API returned 201 in 2-4 s.
- **Frontend/API evidence:** Environment notes + T25. Response header retry-after: 5, body code container_unavailable.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BE / infrastructure (Worker container availability); the frontend handles it well
- **Notes:** Not a product-form defect, but it makes creation look unreliable.

### BUG-PROD-006
- **Title:** Inventory page loads only the first 10 products; its stats and search ignore the rest (new product cannot be found there)
- **Severity:** HIGH
- **Priority:** P1
- **Module:** Products / Inventory
- **Steps to reproduce:** Create a product with opening stock 20; open Inventory; search for it.
- **Expected:** Inventory lists / finds every product; "Tracked Products" and "Total Stock Units" cover all products.
- **Actual:** Page shows "Tracked Products 10" while the org has 101 products; search says "No stock items match these filters." GET /inventory?search=<name> returns the product (total 1).
- **Frontend/API evidence:** CM (screenshot `qa-test/product-creation/_probe-inventory-search.png`). Frontend: src/features/inventory/StockBoard.jsx:188 calls `getStockBoard()` with no page/search; src/api/inventory.js:40 sends none; the backend default page_size is 10.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE
- **Notes:** Outside Product Creation proper, found by the cross-module check.

### BUG-PROD-007
- **Title:** A deactivated product is still selectable in Sales Order, Purchase and Quotation pickers
- **Severity:** MEDIUM
- **Priority:** P3
- **Module:** Products
- **Steps to reproduce:** Deactivate a product; open Create Sales Order / Purchase / Quotation and search it.
- **Expected:** Inactive products are not offered for new documents (or the rule is documented).
- **Actual:** Found in all three (status inactive, is_active false).
- **Frontend/API evidence:** CM / state.json cross.inactive.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE (pickers do not pass is_active=true) - confirm the business rule first
- **Notes:** -

### BUG-PROD-008
- **Title:** "Primary Product Image" is marked required (*) but not enforced
- **Severity:** LOW
- **Priority:** P4
- **Module:** Products
- **Steps to reproduce:** Create a product without an image.
- **Expected:** Either enforced or the asterisk removed.
- **Actual:** Product created without cover_image (T3).
- **Frontend/API evidence:** ProductForm.jsx field list has required: true for coverImage; validate() does not check it.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE
- **Notes:** -

### BUG-PROD-010
- **Title:** "Other Attachments" on the Create form uploads the file but never attaches it to the product
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Products
- **Steps to reproduce:** Create form > Documents tab > Other Attachments: choose a PDF; Add Product; open the product.
- **Expected:** The file appears under Attachments on the product.
- **Actual:** Upload request returns 201, product is saved, but GET /products/{id}/attachments returns [] and the detail page shows "No attachments uploaded yet." (the file is silently lost).
- **Frontend/API evidence:** ATT. In ProductForm.jsx the field is otherAttachmentsName (only a name); attachments are added only from ProductDetail.jsx via addProductAttachments (api/products.js:500).
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE
- **Notes:** Attachments added from the detail page itself were not part of this run.

### BUG-PROD-011
- **Title:** Document slots accept a file of the wrong type (only the picker filter protects them)
- **Severity:** LOW
- **Priority:** P4
- **Module:** Products
- **Steps to reproduce:** Documents tab > Compliance Certificate (accept .pdf): select a .txt (via "All files" or programmatically); Add Product.
- **Expected:** Refused like the image slots ("... is not an image file").
- **Actual:** The .txt was uploaded (201) and saved as compliance_certificate.
- **Frontend/API evidence:** ATT; the image handlers use getImageFileError, the document handlers do not validate.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** FE (and the backend upload has no type check for these)
- **Notes:** No dangerous file was used: a plain text file.

### BUG-PROD-012
- **Title:** Opening Stock stays enabled and is stored when "Track inventory" is switched off
- **Severity:** LOW
- **Priority:** P4
- **Module:** Products
- **Steps to reproduce:** Inventory tab: untick Track inventory, Opening Stock 7, Add Product.
- **Expected:** Stock fields disabled/ignored when tracking is off, or documented.
- **Actual:** inventory_tracking=false but opening_stock=7 and total_stock=7 are stored and shown.
- **Frontend/API evidence:** T14.
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BOTH (business rule to confirm)
- **Notes:** -

### BUG-PROD-009
- **Title:** API stores leading/trailing spaces in name and SKU (only the UI trims)
- **Severity:** LOW
- **Priority:** P4
- **Module:** Products
- **Steps to reproduce:** POST /products with name "   X   ".
- **Expected:** Trimmed.
- **Actual:** Stored untrimmed through the API; the form trims before sending (T16S passes).
- **Frontend/API evidence:** Probe with direct API calls (deleted at cleanup).
- **Screenshot:** see the matching test above
- **Likely FE / BE / BOTH:** BE
- **Notes:** Imports or other clients could create names that do not match when searched/compared.

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

All 70 records created by this suite start with `QA-PW-`. The 54 junk records made by the T8 matrix, my debugging probes and the duplicate-SKU / duplicate-variant / double-submit extras were deleted (API DELETE, only ids created by this run). The core test products were **kept** for your review (search "QA-PW" in Products): QA-PW-Full-2611181217, QA-PW-Minimal-2611181217, QA-PW-Sell0-2611181217, QA-PW-GST-EXCL-2611181217, QA-PW-GST-INCL-2611181217, QA-PW-Stock20-2611181217, QA-PW-Stock0-2611181217, QA-PW-NoTrack-2611181217, QA-PW-LONG-2611181217-NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN, QA-PW-LONG-2611181217-NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN, QA-PW-LONG-2611181217-NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN, QA-PW-Space-2611181217, QA-PW-Attach-2611181217, QA-PW-Dbl-2611181217, QA-PW-Variants-2611181217. Existing real products and the earlier QA-TEST products were not touched. Say the word and I will delete these too.

## Final Verdict

**PASS WITH MINOR ISSUES** - Product Creation itself is usable and stores correct data (including GST and opening stock). It should not be closed until BUG-PROD-001 (negative MRP/Wholesale/Dealer/Discount stored), BUG-PROD-002, BUG-PROD-003 and the intermittent 503 (BUG-PROD-005) are decided; BUG-PROD-006 (Inventory page shows 10 of 101 products) is HIGH but belongs to the Inventory screen. There is no functional blocker in the create flow, so I did not call it FAIL.
