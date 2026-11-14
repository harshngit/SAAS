// builds qa-report.md for this run from results.json + state.json (no secrets are ever read into the report)
const fs = require('fs')
const L = require('./lib')
const R = L.readResults()
const S = L.readState()
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
const cut = (s, n) => { const t = esc(s); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const order = (t) => parseInt(t.replace(/\D/g, ''), 10)
const tests = [...new Set(R.map((r) => r.test))].sort((a, b) => order(a) - order(b))
const apiCell = (r) => (r.failedApis || []).filter((a) => !/\/login$/.test(a.url)).slice(0, 3).map((a) => `${a.method} ${a.url.replace(L.API, '')} -> ${a.status}${a.body ? ' ' + cut(a.body, 70) : ''}`).join('; ') || '-'
const st = (r) => String(r.status)
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, INFO: 0 }
for (const r of R) { if (/^PASS/.test(st(r))) counts.PASS++; else if (/^FAIL/.test(st(r))) counts.FAIL++; else if (st(r) === 'BLOCKED') counts.BLOCKED++; else counts.INFO++ }

let md = `# QA Retest Report - ${new Date().toISOString().slice(0, 10)}\n\n`
md += `Target: **local dev server http://localhost:5173** (Vite, started by the tester with \`npm run dev\`) against the **live backend**. Run stamp for every record created: \`${S.stamp}\`. Account used: ADMIN (all tests that ran). Browser: installed Google Chrome via Playwright (headless:false, slowMo:250). Screenshots: \`shots\\\` in this folder.\n\n`
md += `**Totals:** ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.BLOCKED} BLOCKED, ${counts.INFO} INFO rows.\n\n`
md += `> **R9 and R10 could not be run.** From the start of R10 the live backend's \`POST /auth/login\` hung (no answer for 20s+; checked repeatedly for ~25 minutes; \`GET /docs\` 200 and \`POST /auth/refresh\` 401 answered in 0.5s). Without a login neither the Delivery-role check nor the simulated network-failure checks can run. \`r10.js\` is written and ready.\n\n`

md += '## Summary per test\n\n| Test | Result |\n|---|---|\n'
const sum = {
  R1: 'Smoke of 44 admin sidebar pages - all load; 4 pages logged live-backend CORS/ERR_FAILED on pass 1, 3 clean on retry, Audit Log failed again (different endpoint each time = backend intermittent).',
  R2: 'PASS - card stays "TODAY\'S SALES" and identical after Period=Last Month and after a Customer filter; numbers equal today_overall.',
  R3: 'PASS - real "selling price" message, only the Blue price field red, name box 156px, SKU asterisk, success toast after fixing.',
  R4: 'PASS - toasts on Supplier, Product, Purchase, Purchase Return create + Confirm + Dispatch + Complete.',
  R5: 'PASS - Company Name on SupplierDetail, Purchase Price (₹100) on ProductDetail.',
  R6: 'Custom calendar opens everywhere tested and saved dates are right on Purchase, Purchase Return, Expense, Quotation. FAIL on Supplier Invoice: backend stores invoice_date=today instead of the picked date (frontend sends the right value).',
  R7: 'PASS - "Return Items" hidden on draft, on confirmed-without-GRN and with only a draft GRN; visible after GRN confirm.',
  R8: 'PASS - both tables, search, status filter, pagination, sort, Export (6 rows = total), detail with SKU/UOM, "Loaded on 06 Oct". (Console row FAIL = backend CORS blip.)',
  R9: 'BLOCKED - backend login down.',
  R10: 'BLOCKED (active simulations) + passive evidence: no JS errors, no logout during R1-R8.',
}
for (const t of tests) md += `| ${t} | ${esc(sum[t] || '')} |\n`

const colHead = '| Test | What was done | Expected | Actual | PASS/FAIL | Screenshot | Failed API (URL + status) |\n|---|---|---|---|---|---|---|\n'
md += '\n## Results\n\n' + colHead
for (const t of tests) {
  for (const r of R.filter((x) => x.test === t)) {
    const n = t === 'R1' ? 170 : 650
    md += `| ${t} | ${cut(r.what, 140)} | ${cut(r.expected, 150)} | ${cut(r.actual + (r.retry ? ' [' + r.retry + ']' : ''), n)} | ${esc(st(r))} | ${esc(r.screenshot) || '-'} | ${cut(apiCell(r), 220)} |\n`
  }
}

md += '\n## Every FAIL / BLOCKED: Backend / Frontend / Data / Environment\n\n'
const bad = R.filter((r) => /^(FAIL|BLOCKED)/.test(st(r)))
for (const r of bad) {
  md += `### ${r.test} - ${esc(r.what)} (${st(r)})\n`
  md += `- **Class:** ${r.classification || '(not classified)'}\n`
  md += `- **Evidence:** ${cut(r.actual, 800)}\n`
  if (r.cause) md += `- **Cause / file + line:** ${r.cause}\n`
  md += `- **Screenshot:** ${r.screenshot || '-'}\n\n`
}

md += '## Other observations (not counted as FAIL)\n\n' + [
  '- **Quotation save shows no success toast** (R6 Quotation: toast "none seen" after Save Quotation). Not in the retest list, but same pattern as the Supplier/Product toasts that were fixed: src/features/quotations/QuotationFormPage.jsx handleSubmit.',
  '- **GRN confirm toast was not captured** (R4): the confirm succeeded (Receiving = Fully Received, Return Items appeared) but the POST was still running when the 5s toast window ended - slow write, same as the previous run.',
  '- **Live backend CORS / ERR_FAILED is still intermittent** (R1: 4 pages, R8: one detail GET). The failing endpoint changes between attempts; src/api/client.js retries the GET once after 2s and the pages did load.',
  '- **Vehicle History sorting by Vehicle No / Driver Name** could not be proven by data order: the live history has one vehicle number (MH02CJ0584) and one driver ("delivery") plus one row with no vehicle number. Requests with sort_by/sort_order are sent correctly; the row with a null vehicle number is listed last in both asc and desc (backend choice). Date and Status order were verified.',
  '- **Pagination Next/Previous** could not be exercised: history has only 6 rows (total_pages=1 even at 10 rows per page). Page-size control, request params and page indicator work.',
  '- **Native date inputs still exist** on raw `<input type="date">` fields that do not use `Input` (e.g. Order / Delivery "Scheduled Date" in OrderDetail.jsx:1050 and DeliveryDetail.jsx:1730). Not in the R6 list.',
  '- **Old Playwright scripts (t*.js) cannot fill date fields any more** - they are now calendar buttons; this run uses h.js `pickDay`.',
  '- **Tester housekeeping:** the Vite dev server started for this run is still running in the background (stop it with Ctrl+C / close its terminal); Vite may have refreshed node_modules/.vite. No source file or git state was touched.',
].join('\n') + '\n\n'

md += '## QA-TEST records created (all kept, nothing deleted or cancelled)\n\n| Kind | Name / reference | Notes |\n|---|---|---|\n'
const notes = {
  'Product (variants)': 'PRD "QA-TEST Product C" - variants Red (120) + Blue (125)',
  Supplier: 'with Company Name "QA-TEST Traders ..."',
  Product: '"QA-TEST Product D", purchase 100 / selling 150',
  Purchase: 'PO-10001-2026-0014, qty 2 x 100, purchase date 10 Nov 2026, Confirmed + Fully Received',
  GRN: 'GRN-10001-2026-1023, 2 accepted, confirmed (Receiving = Fully Received)',
  'Purchase Return': 'PR-10001-2026-0005, qty 1, return date 10 Nov 2026, Draft -> Confirmed -> Dispatched -> Completed',
  Expense: 'amount 1, expense date 10 Nov 2026',
  Customer: 'created through Quotation > Quick Add Customer (fake phone 9000000001)',
  Quotation: 'quotation date 10 Nov 2026, valid until 20 Nov 2026, Product D',
  'Supplier Invoice': 'draft; invoice date picked 10 Nov but stored 14 Nov by backend; due 20 Nov',
}
for (const c of S.created || []) md += `| ${esc(c.kind)} | ${esc(c.name)} | ${esc(notes[c.kind] || '')} |\n`
md += '\nAlso in this folder: `vehicle-load-history-2026-11-14.xlsx` (the file the Export button produced, 6 rows).\n\n'

md += '## Rules followed\n\n'
md += '- Files created/edited only inside `qa-tests\\run-2026-11-14_2001\\` (the earlier `qa-tests\\fields-*` files were not touched in this run). No source code edits, no git commands.\n'
md += '- The only process started outside qa-tests was `npm run dev` (the local dev server the task asked for).\n'
md += '- Credentials were read from `.env.qa.local` in memory only; none appear in results, state or this report.\n'
md += '- Billing / Plans / Razorpay pages were skipped. Records that existed before this run were not edited, except that the Quotation used a customer created by this run.\n'
md += '- Diagnostic request capture (r6c_diag.js) was aborted before sending - nothing was saved by it.\n'
fs.writeFileSync(L.DIR + '/qa-report.md', md)
console.log('report bytes', md.length, '| PASS', counts.PASS, 'FAIL', counts.FAIL, 'BLOCKED', counts.BLOCKED, 'INFO', counts.INFO)
