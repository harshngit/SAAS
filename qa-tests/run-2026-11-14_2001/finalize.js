// Restores the 4 R6 rows that were overwritten by a saveTagged tag collision (r4b/r4c vs r6b/r6c used the same tag),
// using the values printed by those runs, marks R9/R10 as BLOCKED, classifies the backend-caused FAIL rows.
const fs = require('fs')
const L = require('./lib')
const all = L.readResults()

const restore = [
  L.row('R6', 'Purchase Create: Purchase Date calendar', 'App calendar (not the browser one) opens; no native date input; picked date is saved',
    'native date inputs visible=0; trigger before="14-11-2026" after pick="10-11-2026" (iso 2026-11-10)', 'PASS', 'shots\\R6-purchase-create-date-picked.png', []),
  L.row('R6', 'Purchase Create: saved date', 'Detail shows 2026-11-10', 'date 10 Nov 2026 found on the purchase detail (list/detail header "Purchase Order · 10 Nov 2026")', 'PASS', 'shots\\R6-purchase-detail-date.png', []),
  L.row('R6', 'GRN modal: Receipt Date calendar', 'App calendar opens', 'custom calendar opened=true; native inputs=0; value shown="14-11-2026" (nothing saved from this check)', 'PASS', 'shots\\R6-grn-modal-calendar.png', []),
  L.row('R6', 'Purchase Return New: Return Date calendar + saved date', 'App calendar opens, native inputs 0, saved return_date = 2026-11-10',
    'native date inputs=0; picked "10-11-2026" (iso 2026-11-10); API return_date="2026-11-10"', 'PASS', 'shots\\R6-return-new-date-picked.png', []),
]
const rest = all.filter((r) => !(r.test === 'R6' && restore.some((x) => x.what === r.what)))

for (const r of rest) {
  if (r.test === 'R8' && /Console errors/.test(r.what) && /^FAIL/.test(r.status)) {
    r.classification = 'Backend (intermittent: live API answered GET /vehicle-stock/{id} without CORS headers -> net::ERR_FAILED; the page retried it and the detail loaded, see the PASS row above)'
    r.cause = 'No app/JS error. src/api/client.js retries the GET once after 2s; the console still records the first failed XHR.'
  }
}
const blocked = [
  L.row('R9', 'Delivery role: login + open /delivery/vehicle-stock', 'Same page and behaviour as before (VehicleStockOverview unchanged)',
    'NOT RUN - login impossible: live backend POST /auth/login hangs (no response for 20s+, in-page fetch got a 500 earlier, curl timed out) from the start of R10 until I stopped waiting (~25 min). Other endpoints answered normally (GET /docs 200, POST /auth/refresh 401 in 0.5s). Code check only (not a test): /delivery/vehicle-stock still renders VehicleStockOverview, whose only changes are skuVariantLabel and two added export keywords.',
    'BLOCKED', '', [], { classification: 'Backend / Environment (login endpoint down)', cause: 'POST /auth/login timeout on https://crm-saas-backend.bsmart.workers.dev' }),
  L.row('R10', 'Simulated network failures (GET retry, POST not retried, 401 + refresh unreachable, genuine 401)', 'No logout on network errors; friendly message; GET retried once; logout only on real 401',
    'NOT RUN - script r10.js is written but needs a login, and POST /auth/login was hanging on the backend (see R9).', 'BLOCKED', '', [], { classification: 'Backend / Environment (login endpoint down)', cause: 'POST /auth/login timeout' }),
  L.row('R10', 'Console errors + logout loop during the R1-R8 runs (passive evidence only)', 'No new JS errors; no logout loop',
    'During all R1-R8 sessions: no page/JS errors were recorded other than net::ERR_FAILED / CORS lines from the live backend (R1: 4 pages on pass 1, R8: one detail GET); no session was ever bounced to /login while running (every script stayed logged in).',
    'INFO', '', [], { note: 'Passive observation only - the active network-failure simulation (R10) is still open.' }),
]
fs.writeFileSync(L.DIR + '/results.json', JSON.stringify([...rest, ...restore, ...blocked], null, 2))
console.log('rows:', rest.length + restore.length + blocked.length)
