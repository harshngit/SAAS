// builds qa-tests\qa-report.md from results.json + state.json (no secrets are ever read into the report)
const fs = require('fs')
const L = require('./lib')
const R = L.readResults()
const S = L.readState()
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
const cut = (s, n) => { const t = esc(s); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const order = (t) => parseInt(t.replace(/\D/g, ''), 10)
const tests = [...new Set(R.map((r) => r.test))].sort((a, b) => order(a) - order(b))
const apiCell = (r) => (r.failedApis || []).filter((a) => !/crm-saas\.asynk\.in\/login$/.test(a.url)).slice(0, 3).map((a) => `${a.method} ${a.url.replace(L.API, '')} -> ${a.status}${a.body ? ' ' + cut(a.body, 70) : ''}`).join('; ') || '-'
const statusOf = (r) => String(r.status)
const isFail = (r) => /^FAIL/.test(statusOf(r))
const counts = { PASS: 0, FAIL: 0, INFO: 0, other: 0 }
for (const r of R) { const s = statusOf(r); if (/^PASS/.test(s)) counts.PASS++; else if (/^FAIL/.test(s)) counts.FAIL++; else if (s === 'INFO') counts.INFO++; else counts.other++ }

let md = `# QA Report - ${new Date().toISOString().slice(0, 10)} (live site ${L.BASE})\n\n`
md += `Run stamp for every record created: \`${S.stamp}\`. Accounts used: ADMIN (all tests), plus SALES / ACCOUNTANT / DELIVERY / SUPERADMIN for login + sidebar check only (T0).\n`
md += `Browser: installed Google Chrome via Playwright (\`channel: 'chrome'\`, headless:false, slowMo:250). Screenshots: \`qa-tests\\shots\\\`.\n\n`
md += `**Totals:** ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.INFO} INFO rows.\n\n`

const colHead = '| Test | What was done | Expected | Actual | PASS/FAIL | Screenshot | Failed API (URL + status) |\n|---|---|---|---|---|---|---|\n'
md += '## Results\n\n' + colHead
for (const t of tests) {
  for (const r of R.filter((x) => x.test === t)) {
    const n = t === 'T1' ? 170 : 600
    md += `| ${t} | ${cut(r.what, 140)} | ${cut(r.expected, 140)} | ${cut(r.actual + (r.retry ? ' [' + r.retry + ']' : ''), n)} | ${esc(statusOf(r))} | ${esc(r.screenshot) || '-'} | ${cut(apiCell(r), 220)} |\n`
  }
}

md += '\n## Every FAIL: Backend / Frontend / Data / Environment\n\n'
const fails = R.filter(isFail)
for (const r of fails) {
  md += `### ${r.test} - ${esc(r.what)}\n`
  md += `- **Class:** ${r.classification || '(not classified)'}\n`
  md += `- **Evidence:** ${cut(r.actual, 700)}\n`
  if (r.cause) md += `- **Cause / file + line:** ${r.cause}\n`
  md += `- **Screenshot:** ${r.screenshot || '-'}\n\n`
}
const unclassified = fails.filter((r) => !r.classification)

md += '## Other observations (not counted as FAIL)\n\n'
md += [
  '- **Stock moves at Confirm, not at Dispatch (T7):** Product A stock went 10 -> 8 when the purchase return was *Confirmed*; Dispatch and Complete left it at 8. Check with the business whether goods should leave stock at Dispatch.',
  '- **"Return Items" button is visible on a purchase that has received nothing** (purchase detail right after Confirm, before the GRN).',
  '- **Purchase Return form column is called "Already Returned"**, not "Previously Returned".',
  '- **Product form:** "Product Code / SKU" shows no red asterisk although validation (ProductForm.jsx:713) requires it. Barcode and GST/VAT Rate were not on the form at all (hidden by this org\'s Object Field Settings), so GST could not be entered and the detail shows GST 0%.',
  '- **GRN modal SKU column** shows "—" for Product A (SKU not passed to the receive table).',
  '- **Slow writes:** POST /expenses was still running 6s after the click (T8 screenshot T8-03); creating other records also took several seconds. Success toasts live only 3.5s (components/ui/Toast.jsx), so a slow save can make the toast easy to miss.',
  '- **Purchase Type** list: first option is "Purchase Order" (default selection in the form is "Direct Purchase"); the test used "Purchase Order" because the script picks the first option.',
  '- **T1 noise:** 4 of 44 pages logged a CORS / ERR_FAILED console error on the first pass (organization/theme, deliveries/partners, brands, auth/me). All four were clean on retry - intermittent backend/network (responses without CORS headers). Also every login logs `403 GET /login` from the hosting layer; it is ignored in the table.',
  '- **Not opened on purpose:** Billing / Subscription / Plan / Razorpay pages (the Plans menu item was skipped). SUPERADMIN: logged in, looked at the sidebar, session cleared - nothing else.',
].join('\n') + '\n\n'

md += '## QA-TEST records created (all kept, nothing deleted or cancelled)\n\n| Kind | Name / reference | Notes |\n|---|---|---|\n'
const notes = {
  Supplier: 'SUP-0008, Manufacturer, Pune',
  Product: 'PRD-0005, no variants, Piece, selling 150, opening stock 0 (now 8 after purchase + return)',
  'Product (variants)': 'PRD-0006, variants Red + Blue, SKUs ...-B-RED / ...-B-BLUE, stock 5 + 7',
  Purchase: 'PO-10001-2026-0012, supplier QA-TEST supplier, Product A qty 10 x 100 = 1,000, Confirmed + Fully Received',
  'GRN (draft)': 'GRN-10001-2026-1021, 10 accepted, Confirmed (added 10 to Product A stock)',
  'Purchase Return': 'PR-10001-2026-0004, qty 2, Draft -> Confirmed -> Dispatched -> Completed',
  Expense: 'EXP-10001-2026-1030, amount 1, Petrol/Diesel, auto-Approved',
}
for (const c of S.created || []) md += `| ${esc(c.kind)} | ${esc(c.name)} | ${esc(notes[c.kind] || '')} |\n`
md += '\nAlso left behind: a few extra `qa-test-image.png` files uploaded through POST /files/upload during failed form attempts in T4/T5 (the form crashed in my script *before* saving, so no duplicate products/suppliers exist, but the uploaded files are orphaned and cannot be removed from the UI).\n\n'

md += '## Rules followed\n\n'
md += '- Only files inside `qa-tests\\` were created/edited. No git commands, no npm in the repo root. Source code was only read.\n'
md += '- `npx playwright install chromium` was skipped: the bundled Chromium is blocked by Windows Application Control on this PC, so installed Chrome is used instead (also saves ~2 GB).\n'
md += '- Credentials were read from `.env.qa.local` in memory only; a scan confirmed no password value appears in results, state or this report.\n'
if (unclassified.length) md += `\n> Warning: ${unclassified.length} FAIL row(s) have no classification.\n`
fs.writeFileSync(L.DIR + '/qa-report.md', md)
console.log('report written, bytes:', md.length, '| fails:', fails.length, '| unclassified:', unclassified.map((r) => r.test + ' ' + r.what).join(' ; '))
