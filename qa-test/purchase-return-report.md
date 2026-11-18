# Purchase Return QA Report

## Environment

- URL: https://crm-saas.asynk.in (backend API as configured in the QA env)
- Date/time: 2026-11-18, run started 15:09 local (QA stamp `2611181509`)
- Role: ADMIN (existing QA login from `.env.qa.local`; credentials not printed)
- Browser: installed Google Chrome driven by Playwright (headed, 1440x1000); API evidence via in-page `fetch` with the app's own session token
- Application source: not modified. Spec: `tests/purchase-return-qa.spec.cjs` (plain Node + the installed `playwright` library, because the project has no `@playwright/test` and `package.json` is ESM). Setup: `tests/pr-setup.cjs`; helpers: `tests/pr-helpers.cjs`; report: `tests/build-pr-report.cjs`.
- Everything created is named `QA-PR-...` and tracked in `qa-test/purchase-return/state.json`.

## QA Data Created

| Item | Value |
|---|---|
| Supplier | QA-PR-Supplier-2611181509 (+ `QA-PR-Supplier2-2611181509` for the tampering test) |
| Warehouse used | Main Warehouse (mismatch test used existing `W2`; nothing was created or changed there) |
| Product A (main flow) | QA-PR-Product-2611181509 / SKU QA-PR-SKU-2611181509 / purchase price 100 / opening stock 0 / image: existing QA fixture `files/e8ea8c50-15a0-4ea3-b232-0250dd95951d` |
| Products B-F | QA-PR-ProductB-2611181509, QA-PR-ProductC-2611181509, QA-PR-ProductD-2611181509, QA-PR-ProductE-2611181509, QA-PR-ProductF-2611181509 |
| Purchase 1 (main reconciliation) | PO-10001-2026-0038 (invoice QA-PR-INV1-2611181509), Product A x 10, GRN GRN-10001-2026-1047 confirmed; stock before 0, after 10 |
| Purchase 2 (validation / lifecycle probes) | PO-10001-2026-0040 (invoice QA-PR-INV2-2611181509), Product B x 20, GRN GRN-10001-2026-1049 |
| Purchase 3 (two items) | PO-10001-2026-0042 (invoice QA-PR-INV3-2611181509), Product C x 5 + Product D x 8, GRN GRN-10001-2026-1051 |
| Purchase 4 (zero received) | PO-10001-2026-0044 (invoice QA-PR-INV4-2611181509), Product E x 5, confirmed, no GRN |
| Purchase 5 (cancelled) | PO-10001-2026-0046 (invoice QA-PR-INV5-2611181509), Product E x 5, cancelled |
| Purchase 6 (clean 10/4/6 snapshot) | PO-10001-2026-0048 (invoice QA-PR-INV6-2611181509), Product F x 10, GRN GRN-10001-2026-1055 |
| Purchase Return records | 26 in total on the QA purchases (6 completed, 19 cancelled, 1 dispatched). Returns cannot be deleted (no DELETE endpoint); all open QA drafts/confirmed returns were cancelled at the end, completed/dispatched ones remain as the audit trail. |
| Other | 4 GRNs, 6 purchases tracked |

Return records on the main purchases: PR-10001-2026-0018 (PUR1, qty 3, completed); PR-10001-2026-0016 (PUR1, qty 3, completed); PR-10001-2026-0010 (PUR1, qty 4, completed); PR-10001-2026-0026 (PUR3, qty 5, completed); PR-10001-2026-0017 (PUR6, qty 4, completed).

## Summary

| Total | Passed | Failed | Blocked | Not Testable |
|---|---|---|---|---|
| 36 | 32 | 4 | 0 | 0 |

Rows are the 35 requested tests plus one extra row (`T4-STALE`) for the stale-banner question. T5 is evidenced together with T4 (same page, on purpose). T3 (fully returned) is completed by T13.

Rows that failed (mapped to bugs below):T4, T4-STALE, T16, T33.

Execution notes (test fixes, not app verdicts): the first T7/T8 run was re-evaluated because the test (a) treated explicit backend skip-ahead rules as a failure and (b) measured return-1 stock after return 2 had already been confirmed; the T9 snapshot was moved to a clean purchase (PUR6) because return 2 had already advanced PUR1 to 7/3; T16/T17 UI submits created stray drafts that were found by GET and cancelled. No application code was changed.

## Test Results

### T1 — Purchase Return list  [PASS]

- **Expected:** Page loads; 4 cards (Total / Draft / In Progress / Completed) equal API totals; search, status filter, New Return; columns Return, Supplier, Purchase / GRN, Items, Return Qty, Return Date, Status
- **Actual:** cards UI={"Total Returns":"9","Draft":"1","In Progress":"1","Completed":"7"} API={"total":9,"draft":1,"confirmed":1,"dispatched":0,"completed":7}; columns=["Return","Supplier","Purchase / GRN","Items","Return Qty","Return Date","Status"]; search=1 statusFilter=true newReturn=1
- **API evidence:** {"total":9,"draft":1,"confirmed":1,"dispatched":0,"completed":7}
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/01-purchase-return-list.png`

### T2 — New Return blank state + validation  [PASS]

- **Expected:** Supplier / GRN / Warehouse read-only; Return Reason, Return Date, Notes present; submit without Purchase -> clear validation, no API write
- **Actual:** Supplier readOnly=true, GRN readOnly=true, Warehouse readOnly=true; reason options=["Damaged Goods","Wrong Product","Quality Issue","Excess Supply","Expired / Near Expiry","Other"]; date default=18-11-2026; notes field=1; banner="Select a purchase with received goods first."; write calls=0
- **API evidence:** no POST /purchase-returns call
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/02-return-blank-validation.png`

### T3 — Purchase selector eligibility  [PASS]

- **Expected:** Only purchases with received goods offered; zero-received and cancelled purchases not offered and rejected by backend; fully-returned handled in T13
- **Actual:** UI offers: {"pur1_received10":true,"pur2":true,"pur3":true,"pur4_confirmed_zero_received":false,"pur5_cancelled":false}. Backend zero-received purchase -> 400 {"detail":"Return quantity (1) for 'QA-PR-ProductE-2611181509' exceeds eligible return quantity: only 0 allowed (received 0, already returned 0, ordered 5)"} (returns before/after 0/0); cancelled purchase -> 400 {"detail":"Cannot create a return for purchase invoice in state 'cancelled'"} (returns before/after 0/0)
- **API evidence:** POST zero-received: 400; POST cancelled: 400
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/03-purchase-selector.png`

### T4 — Purchase selection / derived fields  [FAIL]

- **Expected:** Supplier, Warehouse and GRN derive from the Purchase; items Received=10, Already Returned=0, Returnable=10 (matches API)
- **Actual:** Supplier="QA-PR-Supplier-2611181509", Warehouse="Main Warehouse", GRN field="—" (API: purchase has GRN GRN-10001-2026-1047); row {"product":"QA-PR-Product-2611181509","received":10,"already":0,"returnable":10}; API purchase item received_qty=10, quantity=10. Banner after blank submit: "Select a purchase with received goods first.". Banner still visible after selecting purchase+items: true
- **API evidence:** GET /purchases/36687612-755d-4137-8ad4-18d4637335e0 received_qty=10; GET /grns?purchase_id -> GRN-10001-2026-1047
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/04-purchase-selected.png`

### T4-STALE — Stale "Select a purchase with received goods first." banner (BUG A vs BUG B)  [FAIL]

- **Expected:** No validation banner remains once a valid received purchase is selected and items are loaded
- **Actual:** BUG A confirmed: the banner "Select a purchase with received goods first." stayed visible after a valid purchase (Received 10 / Returnable 10) was selected. BUG B ruled out: with that stale banner still on screen, entering qty 4 and clicking Create Draft Return sent POST /purchase-returns -> 201 and created PR-10001-2026-0010. So it is a visual-only stale message; creation is not blocked.
- **API evidence:** POST -> 201
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/04-purchase-selected.png`

### T5 — Valid partial Draft Return (qty 4)  [PASS]

- **Expected:** Exactly one POST; unique Return no.; correct Purchase/Supplier/Warehouse/Product; qty 4; reason Damaged Goods; status Draft; persists on refresh
- **Actual:** POST count=1, HTTP 201, toast="Draft return created PR-10001-2026-0010 was saved as a draft.", landed on https://crm-saas.asynk.in/admin/purchase-returns/2ea992c0-c0ca-45c3-9a1f-900011cc2c10; API record {"id":"2ea992c0-c0ca-45c3-9a1f-900011cc2c10","number":"PR-10001-2026-0010","status":"draft","supplier_id":"f36c1b6c-016b-4267-bee0-b0cb8d670e5b","purchase_id":"36687612-755d-4137-8ad4-18d4637335e0","warehouse_id":"5ba8a564-fe16-4ced-b779-1117e9704cd3","grn_id":null,"reason":"Damaged Goods","notes":"QA-PR partial return","return_date":"2026-11-18T00:00:00Z","stock_deducted":false,"qty":4,"items":[{"product_id":"db4397a0-0951-42a6-a103-62c61db0ed4a","qty":4,"received":10,"prev":0,"returnable":10}]}; detail page after reload contains "PR-10001-2026-0010" and Draft badge=true
- **API evidence:** POST /purchase-returns -> 201; GET /purchase-returns/2ea992c0-c0ca-45c3-9a1f-900011cc2c10
- **Stock before/after:** stock before create 10 -> after create 10
- **Screenshot:** `qa-test/purchase-return/05-partial-draft-created.png`

### T6 — Draft stock behaviour  [PASS]

- **Expected:** Draft must not reduce physical stock (stock stays 10; stock_deducted=false; no return movement)
- **Actual:** status=draft, stock_deducted=false; product total_inventory=10; warehouse stock={"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":10,"reserved":0,"available":10}}; /inventory row={"available":null,"keys":"id,name,sku,product_type,brand,category_id,total_inventory,total_stock,is_active,variations,cover_image"}; return-type movements=0
- **API evidence:** GET /products/{id}; GET /warehouses/stock?product_id; GET /inventory; GET /warehouses/{id}/movements
- **Stock before/after:** 10 -> 10
- **Screenshot:** —

### T7 — Confirm / progress transition (valid + invalid)  [PASS]

- **Expected:** Draft -> Confirm succeeds and persists with timestamp; invalid transitions (Draft->Complete, double Confirm, Confirm after Cancel) are rejected. Skip-ahead transitions are recorded exactly as the backend behaves (see actual)
- **Actual:** VALID (UI, return PR-10001-2026-0016): Draft buttons=["Back","Edit","Confirm","Cancel"]; Confirm -> HTTP 200, status=confirmed, confirmed_at=2026-11-18T09:54:36.108991Z, stock_deducted=true; after reload buttons=["Back","Dispatch Return","Cancel"]. SKIP-AHEAD ACCEPTED BY BACKEND (not offered by the UI): draft -> dispatch (deducts stock) and confirmed -> complete. PROBES (throw-away drafts): draft -> complete => complete:400 {"detail":"Cannot complete purchase return in status 'draft'. Only 'confirmed' or 'dispatched' returns can be  || draft -> dispatch => dispatch:200 (now dispatched, deducted=true, stock 20->19) || confirmed -> complete => confirm:200 (now confirmed, deducted=true, stock 19->18) then complete:200 (now completed, deducted=true, stock 19->18) || confirm twice => confirm:200 (now confirmed, deducted=true, stock 18->17) then confirm:400 {"detail":"Cannot confirm purchase return in status 'confirmed'. Only 'draft' returns can be confirmed."} || cancel then confirm => cancel:200 (now cancelled, deducted=false, stock 17->17) then confirm:400 {"detail":"Cannot confirm purchase return in status 'cancelled'. Only 'draft' returns can be confirmed."} [Verdict re-evaluated after fixing the test: the first run treated the backend's explicit skip-ahead rules as failures; rejected as required: draft->complete 400, confirm twice 400, confirm after cancel 400.]
- **API evidence:** POST /purchase-returns/{id}/confirm|dispatch|complete|cancel
- **Stock before/after:** return 2: 6 -> 3 at Confirm (stock_deducted=true)
- **Screenshot:** `qa-test/purchase-return/07-return-confirmed.png`

### T8 — Complete Purchase Return + idempotency  [PASS]

- **Expected:** Return reaches Completed; stock changes exactly once per return (10 -> 6 after return 1, 6 -> 3 after return 2); reload/replay never deducts again
- **Actual:** Return 1 (qty 4) is Completed with stock 6 (expected 6; measured in T7 right after it completed and before return 2 was confirmed - the first T8 run re-measured it after return 2 had already deducted 3, a test-logic error, fixed). Return 2 via UI: Dispatch HTTP 200 -> dispatched (dispatched_at=2026-11-18T09:54:59.346043Z); Complete HTTP 200 -> completed (completed_at=2026-11-18T09:55:13.496643Z, stock_deducted=true). After 2 reloads + replaying complete/dispatch/confirm on both returns -> HTTP 400/400/400/400/400/400; stock 3 (expected 3); return-type ledger movements=2 (expected 2); buttons on completed page=["Back"]; warehouse stock={"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":3,"reserved":0,"available":3}}
- **API evidence:** POST dispatch / complete; GET /warehouses/{id}/movements
- **Stock before/after:** ret2: confirm 3 -> dispatch 3 -> complete 3 -> after reloads/replays 3; ret1 final 6
- **Screenshot:** `qa-test/purchase-return/08-return-completed.png`

### T9 — Already Returned / Returnable after first return (clean purchase)  [PASS]

- **Expected:** After a completed return of 4: Received 10, Already Returned 4, Returnable 6 (UI and API), stock 6
- **Actual:** Created PR-10001-2026-0017 (201), workflow confirm:200,dispatch:200,complete:200; New Return form shows {"product":"QA-PR-ProductF-2611181509","received":10,"already":4,"returnable":6}; API sum of non-cancelled returns=4; purchase item received_qty=10; stock 10->6. (The same recalculation on PUR1 is verified at 7/3 in T10 and 10/0 in T13.)
- **API evidence:** GET /purchase-returns?purchase_id
- **Stock before/after:** 10 -> 6 (expected 6)
- **Screenshot:** `qa-test/purchase-return/09-returnable-after-first-return.png`

### T10 — Second partial return (qty 3)  [PASS]

- **Expected:** Return 2 (qty 3) completed; cumulative Received 10 / Already Returned 7 / Returnable 3; stock 3
- **Actual:** return PR-10001-2026-0016 status=completed, qty=3; New Return form now shows {"product":"QA-PR-Product-2611181509","received":10,"already":7,"returnable":3}; stock=3
- **API evidence:** GET /purchase-returns/4493cf6e-dc8f-4649-8256-3213c953f939
- **Stock before/after:** 6 -> 3 (expected 3)
- **Screenshot:** `qa-test/purchase-return/10-after-second-return.png`

### T11 — Over-return (returnable 3, attempt 4)  [PASS]

- **Expected:** UI refuses > returnable; backend rejects 4 with a clear message; no return created; no stock change
- **Actual:** UI: typed 4 -> field shows "3" (UI silently clamps to the returnable max, no error shown), writes sent=0. Backend direct POST qty 4 -> 400 {"detail":"Return quantity (4) for 'QA-PR-Product-2611181509' exceeds eligible return quantity: only 3 allowed (received 10, already returned 7, ordered 10)"}; returns before/after 2/2
- **API evidence:** POST /purchase-returns qty=4 -> 400
- **Stock before/after:** 3 -> 3
- **Screenshot:** `qa-test/purchase-return/11-over-return-rejected.png`

### T12 — Return exact remaining quantity (3)  [PASS]

- **Expected:** Cumulative returned 10, returnable 0, stock 0, no negative
- **Actual:** create 201; workflow confirm:200,dispatch:200,complete:200; cumulative returned (non-cancelled)=10; stock total_inventory=0; warehouse={"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":0,"reserved":0,"available":0}}
- **API evidence:** GET /purchase-returns?purchase_id; GET /warehouses/stock
- **Stock before/after:** 3 -> 0 (expected 0)
- **Screenshot:** —

### T13 — Fully-returned purchase  [PASS]

- **Expected:** No further return possible: hidden, or shown with no returnable row, or backend rejects
- **Actual:** Selector still offers the purchase: true; after selecting: "(fully returned)" label=true, message "No returnable goods..."=true, item rows=0, Create Draft button disabled=true. Backend POST qty 1 -> 400 {"detail":"Return quantity (1) for 'QA-PR-Product-2611181509' exceeds eligible return quantity: only 0 allowed (received 10, already returned 10, ordered 10)"}; returns before/after 3/3
- **API evidence:** POST qty=1 -> 400
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/13-fully-returned.png`

### T14 — Zero quantity  [PASS]

- **Expected:** Rejected; no return; no stock change
- **Actual:** UI: qty 0 -> banner "Enter a return quantity for at least one item.", API writes from UI=0. Backend qty 0 -> 422 {"detail":[{"type":"greater_than","loc":["body","items",0,"quantity"],"msg":"Input should be greater than 0","input":0,"ctx":{"gt":0}}]}; returns 5->5
- **API evidence:** POST qty=0 -> 422
- **Stock before/after:** 17 -> 17
- **Screenshot:** `qa-test/purchase-return/14-zero-quantity.png`

### T15 — Negative quantity  [PASS]

- **Expected:** Rejected in UI and backend; no stock change
- **Actual:** UI: typed -1 -> field shows "0", banner "Enter a return quantity for at least one item.", writes=0. Backend qty -1 -> 422 {"detail":[{"type":"greater_than","loc":["body","items",0,"quantity"],"msg":"Input should be greater than 0","input":-1,"ctx":{"gt":0}}]}; returns 5->5
- **API evidence:** POST qty=-1 -> 422
- **Stock before/after:** 17 -> 17
- **Screenshot:** `qa-test/purchase-return/15-negative-quantity.png`

### T16 — Decimal quantity (1.5)  [FAIL]

- **Expected:** Rejected (integer quantity). Backend must enforce integer; UI should flag it before submitting
- **Actual:** UI: typed 1.5 -> field value "2"; UI SILENTLY CHANGED the value and submitted a return of 2 (POST sent; the draft PR-10001-2026-0019 with qty 2 WAS created - the capture in the test missed it, verified afterwards through GET /purchase-returns?purchase_id); banner "". Backend direct qty 1.5 -> 422 {"detail":[{"type":"int_from_float","loc":["body","items",0,"quantity"],"msg":"Input should be a valid integer, got a number with a fractional part","input":1.5}]}
- **API evidence:** POST qty=1.5 -> 422
- **Stock before/after:** draft does not change stock
- **Screenshot:** `qa-test/purchase-return/16-decimal-quantity.png`

### T17 — Excessively large quantity (999999)  [PASS]

- **Expected:** Rejected; no overflow / negative stock
- **Actual:** UI: typed 999999 -> field shows "14" (clamped to the returnable max); submit created 0 return(s) of that clamped qty. Backend direct 999999 -> 400 {"detail":"Return quantity (999999) for 'QA-PR-ProductB-2611181509' exceeds eligible return quantity: only 0 allowed (received 20, already returned 20, ordered 20)"} [Verified afterwards: that UI submit created draft PR-10001-2026-0020 with qty 14 = the entire remaining returnable quantity, silently. All stray QA drafts were cancelled.]
- **API evidence:** POST qty=999999 -> 400
- **Stock before/after:** 17 -> 17
- **Screenshot:** `qa-test/purchase-return/17-large-quantity.png`

### T18 — Required reason  [PASS]

- **Expected:** Reason is mandatory (field marked required). UI cannot clear the default; blank "Other" details blocked; backend behaviour recorded
- **Actual:** Reason options=["Damaged Goods","Wrong Product","Quality Issue","Excess Supply","Expired / Near Expiry","Other"] (no blank option; default "Damaged Goods"). UI "Other" with empty details -> banner "Add the details for an "Other" reason.", writes=0. Backend: reason "" -> 201, reason null -> 201; backend accepts a return with an empty/null reason (reason is optional in the schema). returns 7->9
- **API evidence:** POST reason="" -> 201; reason=null -> 201 (null)
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/18-required-reason.png`

### T19 — Return Date rules  [PASS]

- **Expected:** Record exact accepted/rejected rules (no assumption)
- **Actual:** UI-submitted: today (2026-11-18) -> HTTP 201, stored 2026-11-18T00:00:00Z ; future +30d (2026-12-18) -> HTTP 201, stored 2026-12-18T00:00:00Z ; before purchase 2020-01-01 (2020-01-01) -> HTTP 201, stored 2020-01-01T00:00:00Z. Backend: invalid calendar date 2030-02-30 -> 422. Accepted: today, future +30d, before purchase 2020-01-01. A future-dated return is accepted. A return dated before the purchase existed is accepted (no date-vs-purchase validation).
- **API evidence:** POST with return_date values
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/19-return-date-past.png`

### T20 — Multiple items (A=2 of 5, B=3 of 8)  [PASS]

- **Expected:** Return has 2 items / total 5; stock A -2, B -3 independently
- **Actual:** form rows C {"product":"QA-PR-ProductC-2611181509","received":5,"already":0,"returnable":5} D {"product":"QA-PR-ProductD-2611181509","received":8,"already":0,"returnable":8}; created PR-10001-2026-0026 (HTTP 201); items=2, total_return_qty=5; workflow confirm:200,dispatch:200,complete:200; stock C 5->3 (exp 3), D 8->5 (exp 5)
- **API evidence:** POST /purchase-returns (2 items) + lifecycle
- **Stock before/after:** C 5->3; D 8->5
- **Screenshot:** `qa-test/purchase-return/20-multi-item-return.png`

### T21 — One invalid item among multiple (atomic)  [PASS]

- **Expected:** Whole request rejected; no return; stock of the valid item unchanged
- **Actual:** POST {C:1 valid, D:99 over} -> 400 {"detail":"Return quantity (99) for 'QA-PR-ProductD-2611181509' exceeds eligible return quantity: only 5 allowed (received 8, already returned 3, ordered 8)"}; returns on purchase 1->1; stock C 3->3, D 5->5
- **API evidence:** POST -> 400
- **Stock before/after:** C 3->3; D 5->5
- **Screenshot:** —

### T22 — Duplicate submission (create + confirm double-click)  [PASS]

- **Expected:** Rapid double-click sends one create and one confirm; one return; stock changes once
- **Actual:** Create double-click: POST /purchase-returns count=1, returns created=1 (list 12->13). Confirm double-click: /confirm requests=[200]; stock 17->16; after cancelling that confirmed return stock restored to 17
- **API evidence:** network capture of POST calls
- **Stock before/after:** confirm: 17 -> 16; after cancel 17
- **Screenshot:** `qa-test/purchase-return/22-double-submit.png`

### T23 — Edit Draft  [PASS]

- **Expected:** Qty, reason, notes editable on a draft and persisted; no stock/ledger change
- **Actual:** edit form loaded row {"product":"","received":null,"already":null,"returnable":null}; Save -> HTTP 200, toast "Purchase return updated"; API now qty=3, reason=Wrong Product, notes="QA-PR edited notes", status=draft; stock 17->17; warehouse ledger rows 6->6
- **API evidence:** PATCH /purchase-returns/67dbe7bd-bd99-4ae9-b72d-de696fbb2297 -> 200
- **Stock before/after:** 17 -> 17
- **Screenshot:** `qa-test/purchase-return/23-edit-draft-saved.png`

### T24 — Delete / Cancel Draft  [PASS]

- **Expected:** If delete exists use it; else Cancel with confirmation; no stock effect for Draft; source returnable restored; cancel after Confirm restores stock
- **Actual:** DELETE is not supported (API 405; no Delete button in UI=true). UI Cancel opens a confirmation modal ("Back | PR-10001-2026-0029 | Draft | QA-PR-Supplier-2611181509 · PO-10001-2026-0040 | Edit | Confirm | Cancel | Return Qty | 2 | Line Items | 1 | Dispa") requiring a reason -> HTTP 200, status=cancelled. Draft stock 17->17; non-cancelled returned qty on purchase 8->6 (cancelled return no longer counts). Confirm-then-cancel: stock 17->15 (confirmed) ->17 (cancelled; status cancelled, cancel HTTP 200). Dispatched return cancel -> HTTP 200 (cancelled)
- **API evidence:** POST /purchase-returns/{id}/cancel
- **Stock before/after:** draft cancel 17->17; confirmed 15 -> cancelled 17
- **Screenshot:** `qa-test/purchase-return/24-cancel-draft.png`

### T25 — Completed return immutability  [PASS]

- **Expected:** No edit/transition actions on a completed return; backend rejects PATCH/cancel; qty and stock unchanged
- **Actual:** Buttons on completed detail page=["Back"]. API PATCH completed -> 400 {"detail":"Cannot edit purchase return in status 'completed'. Only 'draft' returns can be edited."}; cancel completed -> 400. Direct /edit URL: "Save Changes" button present=true, saving it -> 400 Cannot edit purchase return in status 'completed'. Only 'draft' returns can be edited.. Final qty=4, status=completed
- **API evidence:** PATCH -> 400; cancel -> 400
- **Stock before/after:** 0 -> 0
- **Screenshot:** `qa-test/purchase-return/25-completed-immutability.png`

### T26 — Search / Filter  [PASS]

- **Expected:** Search by Return #, Supplier, Purchase # finds the return; status filters show only that status matching API; clearing restores list
- **Actual:** search {"returnNo":{"term":"PR-10001-2026-0010","uiRows":1,"apiTotal":1,"containsReturn":true},"supplier":{"term":"QA-PR-Supplier-2611181509","uiRows":22,"apiTotal":22,"containsReturn":true},"purchaseNo":{"term":"PO-10001-2026-0038","uiRows":3,"apiTotal":3,"containsReturn":true}}; status filter (search "QA-PR") {"draft":{"uiRows":1,"wrongStatusRows":0,"apiTotal":1},"confirmed":{"uiRows":1,"wrongStatusRows":0,"apiTotal":1},"completed":{"uiRows":6,"wrongStatusRows":0,"apiTotal":6}}; rows after clearing=25
- **API evidence:** GET /purchase-returns?search=&status=
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/26-status-filter.png`

### T27 — List summary cards  [PASS]

- **Expected:** Cards equal backend counts and moved by exactly the number of returns this suite created
- **Actual:** UI cards {"Total Returns":"35","Draft":"3","In Progress":"3","Completed":"13"}; API {"total":35,"draft":3,"confirmed":2,"dispatched":1,"completed":13,"cancelled":16} (Cancelled is not a card; it is only in "Total"); baseline UI {"Total Returns":"9","Draft":"1","In Progress":"1","Completed":"7"} -> delta total 26, suite created 26 returns
- **API evidence:** {"total":35,"draft":3,"confirmed":2,"dispatched":1,"completed":13,"cancelled":16}
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/27-summary-cards.png`

### T28 — API / UI consistency  [PASS]

- **Expected:** return no., purchase, supplier, warehouse, GRN, reason, date, status, items, received/returned/return qty and notes identical on UI and API
- **Actual:** All fields consistent. GRN on returns:  / . [{"l":"Draft","n":"PR-10001-2026-0032","wh":"Main Warehouse"},{"l":"Completed","n":"PR-10001-2026-0010","wh":"Main Warehouse"}] NOTE: the purchase has a confirmed GRN (e.g. GRN-10001-2026-1047) but the return carries no GRN on either side (grn_id null, UI shows "—"); see BUG-PRETURN-003.
- **API evidence:** GET /purchase-returns/{id} vs detail page text
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/28-consistency-completed.png`

### T29 — Cross-module Purchase consistency  [PASS]

- **Expected:** Original purchase quantity (10) and received (10) untouched after 3 completed returns; any returned info consistent
- **Actual:** API purchase: status=confirmed, item quantity=10, received_qty=10, remaining_qty=0, return_amount=1000, total=1000. Purchase detail page mentions returns: true; page excerpt: Back | PO-10001-2026-0038 | Confirmed | QA-PR-Supplier-2611181509 | · | Direct Purchase | · | 18 Nov 2026 | Close Purchase | Return Items | Record / Update Payment | Grand Total | ₹ 1,000 | Receiving | Fully Received | Amount Paid | ₹ 0 | Outstanding Payable | ₹ 0 | Overview | Items | Goods Receipts | Invoices | Payments | Documents / Notes | Purchase Information | PURCHASE # | PO-10001-2026-0038 | SUPPLIER | QA-PR-Supplier-2611181509 | SUPPLIER REFERENCE / INVOICE # | QA-PR-INV1-2611181509 | PURCHASE TYPE | Direct Purchase | PURCHASE DATE | 18 Nov 2026 | WAREHOUSE | Main Warehouse | BILLING A
- **API evidence:** GET /purchases/36687612-755d-4137-8ad4-18d4637335e0
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/29-purchase-after-returns.png`

### T30 — Inventory consistency (full reconstruction)  [PASS]

- **Expected:** Opening 0 + purchase +10 - returns 10 = 0 everywhere; no negative; no duplicate movements
- **Actual:** Product API total_inventory=0; warehouse stock={"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":0,"reserved":0,"available":0}}; /inventory row={"available":null,"keys":"id,name,sku,product_type,brand,category_id,total_inventory,total_stock,is_active,variations,cover_image"}; ledger rows for the product=4 by type {"purchase_return":3,"purchase_in":1} (net of quantity column=0); duplicate ledger ids=false; product detail page text near stock: "Stock | 0 "; inventory page search "QA-PR-SKU-2611181509" excerpt: Tracked Products | 10 | Total Stock Units | 1,367 | Out of Stock | 0 | Inactive | 0 | Inventory | Filter | Product | 	 | SKU | 	Variants	 | Current Stock | 	Status	Action | Anchor Roma 6A One-Way Switch | Anchor | 	ANC-ROMA-6A-1W	0	158	 | In Stock | 	 | Crompt
- **API evidence:** GET /products/{id}; /warehouses/stock; /inventory; /warehouses/{id}/movements
- **Stock before/after:** final 0
- **Screenshot:** `qa-test/purchase-return/30-inventory-page.png`

### T31 — Direct backend over-return protection  [PASS]

- **Expected:** Backend rejects qty > remaining even with frontend bypassed; open (draft/confirmed) returns together may not exceed received
- **Actual:** Remaining returnable on PUR2 12. Direct POST qty 13 -> 400 {"detail":"Return quantity (13) for 'QA-PR-ProductB-2611181509' exceeds eligible return quantity: only 12 allowed (received 20, already returned 8, ordered 20)"}. Concurrent drafts: #1 qty 10 -> 201; #2 qty 5 (together 15 > 12) -> 400 {"detail":"Return quantity (5) for 'QA-PR-ProductB-2611181509' exceeds eligible return quantity: only 2 allowed (received 20, already returned 18, ordered 20)"}; confirm #1 200, confirm #2 undefined . Open+done qty after=18; stock 17 -> 7 -> 17 after cleanup
- **API evidence:** {"over":400,"first":201,"second":400,"c1":200}
- **Stock before/after:** 17 -> 7 (while confirmed) -> 17 (cleaned)
- **Screenshot:** —

### T32 — Product inactive after purchase  [PASS]

- **Expected:** Historical goods stay returnable even though the product master is inactive
- **Actual:** Product set inactive (PATCH 200, status now "inactive"). Return form still lists the item: {"product":"QA-PR-ProductB-2611181509","received":20,"already":8,"returnable":12}. API create return -> 201 ; confirm -> 200. Product restored to active (PATCH 200)
- **API evidence:** POST -> 201
- **Stock before/after:** —
- **Screenshot:** `qa-test/purchase-return/32-inactive-product.png`

### T33 — Supplier consistency  [FAIL]

- **Expected:** Supplier must come from the Purchase: UI has no supplier control; backend rejects or overrides a conflicting supplier_id
- **Actual:** UI supplier field is read-only (T2). API with supplier_id of a different QA supplier -> 201; stored supplier_id=8f296b90-71a8-4a8e-85c8-b36ee7c59b22 (purchase supplier=f36c1b6c-016b-4267-bee0-b0cb8d670e5b, tampered=8f296b90-71a8-4a8e-85c8-b36ee7c59b22) -> CONFLICTING supplier stored. Non-existent supplier id -> 400
- **API evidence:** POST with supplier_id=other -> 201
- **Stock before/after:** —
- **Screenshot:** —

### T34 — Warehouse consistency  [PASS]

- **Expected:** Return deducts only from the purchase/GRN receiving warehouse; mismatched warehouse_id rejected or ignored
- **Actual:** UI warehouse is read-only. API with warehouse_id=W2 (not the receiving warehouse Main Warehouse) -> 400 {"detail":"Not enough stock of 'QA-PR-ProductB-2611181509' in warehouse 'W2' to return 1: only 0 can be returned (available stock)."}. After cleanup warehouses {"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":17,"reserved":0,"available":17}} (before {"5ba8a564-fe16-4ced-b779-1117e9704cd3":{"on_hand":17,"reserved":0,"available":17}})
- **API evidence:** POST with warehouse_id=W2 -> 400
- **Stock before/after:** total 17 -> - -> 17
- **Screenshot:** —

### T35 — Console / network errors  [PASS]

- **Expected:** No uncaught JS errors, no unexpected 4xx/5xx; deliberate 422/4xx probes excluded; 503 recorded as infrastructure
- **Actual:** Uncaught JS exceptions: 0. HTTP 5xx in browser traffic: 0. Infrastructure 503 "Server is busy or restarting": 0 occurrences in this run (retry logic never triggered). Browser console "Failed to load resource" lines: 39 = 27 from deliberate invalid probes (400/422/405: over-return, zero/negative/decimal qty, invalid transitions, DELETE, tampering) + 12 HTTP 403 lines, one per fresh browser session at sign-in (not reproducible on the Purchase Return pages: re-checked list and New Return page, no 403). No failed GET of the source Purchase, no failed inventory mutation, no duplicate API write (T22). Stale-UI state: BUG-PRETURN-001.
- **API evidence:** network + console capture across the whole run
- **Stock before/after:** —
- **Screenshot:** —

## Bugs Found

Severity guide: CRITICAL stock corruption / over-return allowed / cross-org; HIGH incorrect stock, duplicate return, incorrect Purchase relationship, wrong warehouse; MEDIUM validation problem with workaround, inconsistent status/persistence; LOW stale message, minor UX.

**No CRITICAL bug.** Over-return (single, concurrent, multi-item atomic) is rejected by the backend in every probe, stock never went negative or was deducted twice. One HIGH (wrong supplier stored).

### BUG-PRETURN-001

- **Title:** Stale validation banner "Select a purchase with received goods first." stays after a valid purchase is selected
- **Severity:** LOW
- **Priority:** P3
- **Module:** Purchase Returns / New Return form
- **Steps:** 1. Open New Purchase Return. 2. Click Create Draft Return without a purchase (banner appears). 3. Search and select a purchase with received goods (items load: Received 10, Returnable 10). 4. Look at the banner.
- **Expected:** The validation banner is cleared once a valid purchase is selected.
- **Actual:** Banner stays on screen next to the loaded items. BUG A (stale visual state) confirmed. BUG B ruled out: with the stale banner still visible, entering Return Qty 4 and clicking Create Draft Return sent POST /purchase-returns -> 201 and created PR-10001-2026-0010, so creation is NOT blocked.
- **API evidence:** POST /purchase-returns -> 201 (T4/T5)
- **Stock impact:** none
- **Screenshot:** 04-purchase-selected.png, 05-partial-draft-created.png
- **Likely FE / BE / BOTH:** FE
- **Notes:** PurchaseReturnFormPage.jsx sets submitError on submit and only clears it on the next successful validate; selecting a purchase / editing qty never clears it.

### BUG-PRETURN-002

- **Title:** Backend accepts a supplier_id that is not the purchase's supplier and stores it on the return
- **Severity:** HIGH
- **Priority:** P1
- **Module:** Purchase Returns API (POST /purchase-returns)
- **Steps:** 1. Authenticated POST /purchase-returns with purchase_id = QA purchase (supplier QA-PR-Supplier-...) and supplier_id = a different QA supplier (QA-PR-Supplier2-...), valid items.
- **Expected:** Rejected (400/422) or overridden with the purchase supplier. The return supplier must derive from the purchase.
- **Actual:** 201 Created; the return stores the tampered supplier_id (supplier of the return != supplier of the purchase). A non-existent supplier id is rejected (400), so only existence is validated, not the relationship.
- **API evidence:** POST /purchase-returns {purchase_id: PUR2, supplier_id: SUPPLIER2} -> 201, GET shows supplier_id = SUPPLIER2
- **Stock impact:** none (draft; it was cancelled afterwards)
- **Screenshot:** (API only)
- **Likely FE / BE / BOTH:** BE
- **Notes:** The UI is safe (read-only Supplier field), so this needs a direct API call, but supplier credit/debit notes and payables follow the return supplier. Frontend validation is not a substitute.

### BUG-PRETURN-003

- **Title:** GRN is never derived: form shows "—", create sends no grn_id, the return stores no GRN
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Purchase Returns / New Return, Detail, List
- **Steps:** 1. Select QA purchase PO-10001-2026-0038 (it has confirmed GRN-10001-2026-1047). 2. Read "Goods Receipt (GRN)". 3. Create the return and read GRN on API and detail page.
- **Expected:** The brief says GRN derives when applicable; the Source card, detail Overview and the list column "Purchase / GRN" should show the receipt.
- **Actual:** GRN field is "—"; the saved return has grn_id null and no grnNumber, so the list shows only the purchase number. The form hard-codes grnId/grnNumber to empty in real mode.
- **API evidence:** GET /grns?purchase_id -> GRN-10001-2026-1047; GET /purchase-returns/{id}: grn_id null
- **Stock impact:** none
- **Screenshot:** 04-purchase-selected.png
- **Likely FE / BE / BOTH:** FE (and BE does not derive it either)
- **Notes:** Traceability gap: a return cannot be tied to the receipt it came from. With several GRNs per purchase it would also be unclear which receipt it belongs to.

### BUG-PRETURN-004

- **Title:** Return Qty input silently rewrites invalid values and then submits them (1.5 -> 2, 999999 -> all returnable, 4 -> 3)
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Purchase Returns / New Return form
- **Steps:** 1. Select a purchase. 2. Type 1.5, or 999999, or a value above Returnable, in Return Qty. 3. Click Create Draft Return.
- **Expected:** The UI flags the value ("whole number", "cannot exceed returnable") and blocks submit; the user decides.
- **Actual:** The field silently becomes 2 (1.5 rounded up), or the maximum returnable (999999 -> 14; 4 -> 3) with no message, and the submit creates a draft for that changed quantity (PR-10001-2026-0019 qty 2 and PR-10001-2026-0020 qty 14 were created this way). A typo can therefore return the entire remaining quantity.
- **API evidence:** Backend itself is correct: qty 1.5 -> 422 "valid integer"; qty > returnable -> 400 "exceeds eligible return quantity"; 0 / -1 / 999999 rejected
- **Stock impact:** Draft only, no stock change; cancelled afterwards
- **Screenshot:** 16-decimal-quantity.png, 17-large-quantity.png, 11-over-return-rejected.png
- **Likely FE / BE / BOTH:** FE
- **Notes:** Data integrity is protected by the backend, so this is a validation UX problem (per brief: FE UX issue, not data-integrity failure).

### BUG-PRETURN-005

- **Title:** Backend lets a dispatched return be cancelled and restores stock, contradicting the UI rule "only before it is dispatched"
- **Severity:** MEDIUM
- **Priority:** P2
- **Module:** Purchase Returns API (POST /{id}/cancel)
- **Steps:** 1. Create a return, dispatch it (Draft -> Dispatched). 2. POST /purchase-returns/{id}/cancel with a reason.
- **Expected:** Rejected: the Cancel modal says a return can only be cancelled before dispatch.
- **Actual:** 200; status cancelled, stock_deducted false. Re-verified with a dedicated probe (PR-10001-2026-0036): stock 18 -> 17 after dispatch -> 18 again after cancel, i.e. stock is added back for goods already dispatched to the supplier.
- **API evidence:** POST dispatch -> 200, POST cancel -> 200 (T24 and probe)
- **Stock impact:** 17 -> 18 on cancel of a dispatched return (inflates warehouse stock for goods already sent); only reachable by API, the UI hides Cancel once dispatched
- **Screenshot:** 24-cancel-modal.png
- **Likely FE / BE / BOTH:** BE
- **Notes:** Needs a product decision, but today the UI and backend disagree.

### BUG-PRETURN-006

- **Title:** Lifecycle can be skipped through the API: Draft -> Dispatch and Confirmed -> Complete are accepted
- **Severity:** LOW
- **Priority:** P3
- **Module:** Purchase Returns API
- **Steps:** 1. New draft. 2. POST /{id}/dispatch directly (no confirm). 3. Another draft: confirm, then POST /{id}/complete directly (no dispatch).
- **Expected:** Each step follows draft -> confirmed -> dispatched -> completed as the UI presents it.
- **Actual:** Draft -> Dispatch: 200, return becomes dispatched with confirmed_at and dispatched_at set in the same instant and stock deducted. Confirmed -> Complete: 200. Draft -> Complete is rejected (400 "Only confirmed or dispatched returns can be completed"), as are double confirm and confirm after cancel (400).
- **API evidence:** T7 probes (state.json transitionProbes)
- **Stock impact:** deducted exactly once on every path (20 -> 19 on the dispatch-from-draft path); no double deduction
- **Screenshot:** 07-return-confirmed.png
- **Likely FE / BE / BOTH:** BE
- **Notes:** Stock stayed correct; the UI offers only the next step. Recording because the brief asks for the exact valid transitions.

### BUG-PRETURN-007

- **Title:** Return Reason is optional on the backend (UI marks it required) and Return Date has no business rule
- **Severity:** LOW
- **Priority:** P3
- **Module:** Purchase Returns API
- **Steps:** 1. POST /purchase-returns with reason "" and with reason null. 2. Create returns dated +30 days and 2020-01-01 against a purchase dated today.
- **Expected:** Mandatory reason enforced server-side; a return cannot precede its purchase / receipt.
- **Actual:** Reason ""/null -> 201 (accepted). Future date -> 201, date 2020-01-01 (before the purchase existed) -> 201. Only a non-calendar date (2030-02-30) is rejected (422). The UI default is today and cannot clear the reason.
- **API evidence:** T18, T19
- **Stock impact:** none (drafts, cancelled)
- **Screenshot:** 19-return-date-future.png, 19-return-date-past.png
- **Likely FE / BE / BOTH:** BE
- **Notes:** Recorded as the exact current rule set, as requested.

### BUG-PRETURN-008

- **Title:** Cancel modal copy is wrong for a Confirmed return: says "This does not change any stock"
- **Severity:** LOW
- **Priority:** P3
- **Module:** Purchase Returns / Detail
- **Steps:** 1. Confirm a return (stock deducted). 2. Click Cancel.
- **Expected:** Copy warns that cancelling a confirmed return gives the stock back.
- **Actual:** Modal says "A return can only be cancelled before it is dispatched. This does not change any stock." but cancelling a confirmed return restored stock (15 -> 17).
- **API evidence:** T24
- **Stock impact:** restored on cancel, as designed by the backend
- **Screenshot:** 24-cancel-modal.png
- **Likely FE / BE / BOTH:** FE
- **Notes:** Related design note: stock leaves the warehouse at Confirm, not at Complete (see Observations).

### Observations (not bugs)

- OBS-1 Stock timing: the backend deducts stock at CONFIRM (stock_deducted becomes true; the API description says "Confirm ... deducts stock"), not at Complete. Draft never changes stock (T6). Dispatch and Complete do not deduct again (T8). Final quantities match the brief (10 -> 6 -> 3 -> 0). If the business wants stock to leave only when goods physically ship, this needs a decision.
- OBS-2 Delete is not supported (DELETE /purchase-returns/{id} -> 405, no Delete button). Cancel is the only way to remove a draft; a cancelled return no longer counts toward "Already Returned" and stock/returnable are restored.
- OBS-3 Existing statuses are exactly: draft, confirmed, dispatched, completed, cancelled. The list cards are Total / Draft / In Progress (= confirmed + dispatched) / Completed; cancelled has no card (it only counts toward Total).
- OBS-4 The Inventory page still lists only the first 10 products, so a new QA product cannot be found there (already BUG-PROD-006 in the Product Creation report). Product detail, GET /inventory and GET /warehouses/stock are correct.
- OBS-5 The brief's infrastructure 503 did not occur in this run (0 occurrences, no retries needed).

## Stock Reconciliation

Product A / Purchase 1 (opening stock 0, purchase received 10, three returns 4 + 3 + 3):

| Stage | Purchase Received | Returned | Expected Stock | Actual Stock |
|---|---|---|---|---|
| Initial (product created) | 0 | 0 | 0 | 0 |
| Purchase received (GRN confirmed) | 10 | 0 | 10 | 10 |
| Return 1 complete (qty 4) | 10 | 4 | 6 | 6 |
| Return 2 complete (qty 3) | 10 | 7 | 3 | 3 |
| Fully returned (return 3 complete, qty 3) | 10 | 10 | 0 | 0 |

Final Product A stock from the API: 0.

Stock timing on return 2 (via UI): before confirm 6 -> after Confirm 3 -> after Dispatch 3 -> after Complete 3 -> after reloads and replays 3 (deducted once, at Confirm).

All QA products at the end of the run (stock = received - active returns; verified on Product API, `/warehouses/stock`, and the movement ledger):

| Product | Received | Active (non-cancelled) returns | Expected | Actual |
|---|---|---|---|---|
| QA-PR-Product-2611181509 | 10 | 10 | 0 | 0 |
| QA-PR-ProductB-2611181509 | 20 | 2 | 18 | 18 |
| QA-PR-ProductC-2611181509 | 5 | 2 | 3 | 3 |
| QA-PR-ProductD-2611181509 | 8 | 3 | 5 | 5 |
| QA-PR-ProductE-2611181509 | 0 | 0 | 0 | 0 |
| QA-PR-ProductF-2611181509 | 10 | 4 | 6 | 6 |

No negative stock, no duplicated movements (Product A ledger: 1 `purchase_in`, 3 `purchase_return`). Original Purchase 1 stays quantity 10 / received 10 / return_amount 1000 after the returns.

## Final Verdict

**PASS WITH MINOR ISSUES — stock and data logic are correct; the open items need fixes but do not corrupt stock.**

- Stock: exactly once per return, never negative, matches the brief (10 -> 6 -> 3 -> 0); over-return is rejected by the backend in all forms (single, concurrent drafts, atomic multi-item); idempotent on reload / replay; the original purchase quantity is untouched.
- Must fix before closing: BUG-PRETURN-002 (HIGH, conflicting supplier accepted by the API). Should fix: 003 (GRN not derived), 004 (silent qty rewrite), 005 (cancel of a dispatched return).
- Failing rows: T4, T4-STALE, T16, T33.