// Purchase Return QA (Playwright library, plain Node). Run:  node tests/purchase-return-qa.spec.cjs T1 T2 ...   (or "all")
// Prerequisite: node tests/pr-setup.cjs  (creates the isolated QA-PR-* supplier / products / purchases / GRN receipts)
// No application source is touched. Records created are tracked in qa-test/purchase-return/state.json (cleanup only touches those).
const H = require('./pr-helpers.cjs')
const { L } = H
const S = () => H.state()
const iso = (d = new Date()) => d.toISOString()
const day = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10) }
const J = (o) => JSON.stringify(o)
const itemOf = (pur, prodId) => pur.items.find((i) => i.product_id === prodId)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- data / api helpers
function body(pur, qtyByProd, o = {}) {
  const s = S()
  return {
    purchase_id: pur.id, supplier_id: o.supplier_id !== undefined ? o.supplier_id : pur.supplierId,
    ...(o.noWarehouse ? {} : { warehouse_id: o.warehouse_id || s.warehouse.id }),
    return_date: o.date || day(0), reason: o.reason !== undefined ? o.reason : 'Damaged Goods', notes: o.notes !== undefined ? o.notes : 'QA-PR api return',
    items: Object.entries(qtyByProd).map(([pid, q]) => ({ purchase_item_id: itemOf(pur, pid).id, quantity: q, reason: o.reason !== undefined ? o.reason : 'Damaged Goods' })),
  }
}
async function mkReturn(page, pur, qtyByProd, o = {}) {
  const r = await H.post(page, '/purchase-returns', body(pur, qtyByProd, o))
  if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: pur.id })
  return r
}
const act = (page, id, a, b = {}) => H.post(page, `/purchase-returns/${id}/${a}`, b)
async function toStatus(page, id, target) {
  const order = ['confirm', 'dispatch', 'complete']; const out = []
  for (const a of order) { const r = await act(page, id, a); out.push(a + ':' + r.status); if (r.status >= 300) break; if ({ confirm: 'confirmed', dispatch: 'dispatched', complete: 'completed' }[a] === target) break }
  return out
}
const stockOf = async (page, pid) => (await H.stock(page, pid)).total_inventory
async function movements(page, pid) {
  const s = S(); const r = await H.api(page, `/warehouses/${s.warehouse.id}/movements?product_id=${pid}&page_size=100`)
  return (r.body && (r.body.items || r.body)) || []
}
async function purchaseReturnsOf(page, purId) { return (await H.listReturns(page, 'purchase_id=' + purId)).items || [] }
const summarize = (r) => r && { id: r.id, number: r.return_number, status: r.status, supplier_id: r.supplier_id, purchase_id: r.purchase_id, warehouse_id: r.warehouse_id, grn_id: r.grn_id, reason: r.reason, notes: r.notes, return_date: r.return_date, stock_deducted: r.stock_deducted, qty: r.total_return_qty, items: (r.items || []).map((i) => ({ product_id: i.product_id, qty: i.quantity, received: i.received_qty ?? i.receivedQty, prev: i.previously_returned_qty ?? i.previouslyReturnedQty, returnable: i.returnable_qty ?? i.returnableQty })) }
async function labelValue(page, text) {
  return page.evaluate((t) => {
    const lab = Array.from(document.querySelectorAll('label')).find((l) => l.textContent.trim().replace(/\s*\*$/, '').startsWith(t))
    if (!lab) return { found: false }
    const inp = (lab.htmlFor && document.getElementById(lab.htmlFor)) || lab.parentElement.querySelector('input,textarea')
    return { found: true, value: inp ? inp.value : null, readOnly: inp ? !!inp.readOnly : null, disabled: inp ? !!inp.disabled : null, tag: inp ? inp.tagName : null }
  }, text)
}
async function cards(page) {
  return page.evaluate(() => { const out = {}; document.querySelectorAll('p.text-sm.font-medium').forEach((p) => { const l = p.textContent.trim(); const v = p.closest('.rounded-2xl') && p.closest('.rounded-2xl').querySelector('p.text-2xl'); if (v && ['Total Returns', 'Draft', 'In Progress', 'Completed'].includes(l)) out[l] = v.textContent.trim() }); return out })
}
async function uiAct(page, net, nameRe, { wait = 14000 } = {}) {
  const n0 = net.prWrites.length
  await page.getByRole('button', { name: nameRe }).first().click({ timeout: 10000 })
  const end = Date.now() + wait
  while (Date.now() < end && !(net.prWrites.length > n0 && net.prWrites[net.prWrites.length - 1].status !== null)) await page.waitForTimeout(250)
  await page.waitForTimeout(1800)
  const w = net.prWrites.slice(n0); const last = w[w.length - 1]
  return { writes: w.length, status: last ? last.status : null, res: last ? last.res : null, url: last ? last.url : null }
}
async function setDateUI(page, iso) {
  const [y, m, d] = iso.split('-').map(Number)
  await page.locator('button[data-datepicker-trigger="true"]').first().click(); await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Choose year' }).click(); await page.waitForTimeout(250)
  await page.locator('.app-calendar-popover button', { hasText: new RegExp('^' + y + '$') }).first().click(); await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Choose month' }).click(); await page.waitForTimeout(250)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  await page.locator('.app-calendar-popover button', { hasText: new RegExp('^' + mon + '$') }).first().click(); await page.waitForTimeout(250)
  const btns = page.locator('.app-calendar-popover button.app-calendar-day')
  const n = await btns.count()
  for (let i = 0; i < n; i++) { const t = (await btns.nth(i).innerText()).trim(); const cls = (await btns.nth(i).getAttribute('class')) || ''; if (t === String(d) && !/text-neutral-300/.test(cls)) { await btns.nth(i).click(); break } }
  await page.waitForTimeout(300)
}
const bodyText = async (page) => (await page.locator('main').first().innerText().catch(() => '')).replace(/\n+/g, ' | ')
const rec = (o) => H.record({ id: o.id, name: o.name, status: o.status, expected: o.expected, actual: o.actual, api: o.api || '', stock: o.stock || '', shot: o.shot || '' })

// =====================================================================================================
const TESTS = {}

// T1 — list
TESTS.T1 = async (h) => {
  const { page } = h
  await H.openReturns(page)
  const c = await cards(page)
  const heads = (await page.locator('thead th').allInnerTexts()).map((x) => x.trim().replace(/\s+/g, ' '))
  const search = await page.getByPlaceholder(/search return/i).count()
  const trig = await page.locator('[data-select-trigger="true"]').count()
  const newBtn = await page.getByRole('button', { name: /new return/i }).count()
  const shot = await H.shot(page, '01-purchase-return-list')
  const all = await H.api(page, '/purchase-returns?page_size=1'); const dr = await H.api(page, '/purchase-returns?page_size=1&status=draft')
  const cf = await H.api(page, '/purchase-returns?page_size=1&status=confirmed'); const dp = await H.api(page, '/purchase-returns?page_size=1&status=dispatched'); const cm = await H.api(page, '/purchase-returns?page_size=1&status=completed')
  const api = { total: all.body.total, draft: dr.body.total, confirmed: cf.body.total, dispatched: dp.body.total, completed: cm.body.total }
  H.setState({ baseline: { ui: c, api } })
  const expectHeads = ['Return', 'Supplier', 'Purchase / GRN', 'Items', 'Return Qty', 'Return Date', 'Status']
  const headsOk = expectHeads.every((e) => heads.some((x) => x.startsWith(e)))
  const cardsOk = String(api.total) === c['Total Returns'] && String(api.draft) === c['Draft'] && String(api.confirmed + api.dispatched) === c['In Progress'] && String(api.completed) === c['Completed']
  const empty = heads.length === 0 && Number(api.total) === 0
  const ok = (headsOk || empty) && cardsOk && search === 1 && trig >= 1 && newBtn >= 1
  rec({ id: 'T1', name: 'Purchase Return list', status: ok ? 'PASS' : 'FAIL', expected: 'Page loads; 4 cards (Total / Draft / In Progress / Completed) equal API totals; search, status filter, New Return; columns Return, Supplier, Purchase / GRN, Items, Return Qty, Return Date, Status', actual: `cards UI=${J(c)} API=${J(api)}; columns=${J(heads)}; search=${search} statusFilter=${trig > 0} newReturn=${newBtn}`, api: J(api), shot })
}

// T2 — blank state
TESTS.T2 = async (h) => {
  const { page, net } = h
  await H.openNew(page)
  const sup = await labelValue(page, 'Supplier'); const grn = await labelValue(page, 'Goods Receipt'); const wh = await labelValue(page, 'Receiving Warehouse')
  const reason = await labelValue(page, 'Return Reason'); const date = (await page.locator('button[data-datepicker-trigger="true"]').first().innerText()).trim(); const notes = await page.locator('textarea').count()
  const reasons = await H.reasonOptions(page)
  const w0 = net.prWrites.length
  await page.getByRole('button', { name: /create draft return/i }).click(); await page.waitForTimeout(1200)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').trim()
  const shot = await H.shot(page, '02-return-blank-validation')
  const writes = net.prWrites.length - w0
  const ro = sup.readOnly && wh.readOnly && grn.readOnly
  const ok = ro && !!date && notes >= 1 && writes === 0 && /select a purchase/i.test(banner) && reasons.length > 0
  rec({ id: 'T2', name: 'New Return blank state + validation', status: ok ? 'PASS' : 'FAIL', expected: 'Supplier / GRN / Warehouse read-only; Return Reason, Return Date, Notes present; submit without Purchase -> clear validation, no API write', actual: `Supplier readOnly=${sup.readOnly}, GRN readOnly=${grn.readOnly}, Warehouse readOnly=${wh.readOnly}; reason options=${J(reasons)}; date default=${date}; notes field=${notes}; banner="${banner}"; write calls=${writes}`, api: 'no POST /purchase-returns call', shot })
}

// T3 — selector eligibility
TESTS.T3 = async (h) => {
  const { page, net } = h; const s = S()
  await H.openNew(page)
  const box = page.getByPlaceholder(/search purchase/i)
  await box.fill('QA-PR-INV'); await page.waitForTimeout(3500)
  let opts = (await page.locator('button.block.w-full').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim())
  const drop = (await page.locator('.max-h-64').allInnerTexts().catch(() => [])).join(' | ')
  const shot = await H.shot(page, '03-purchase-selector')
  const mention = (p) => opts.some((o) => o.includes(p.number)) || drop.includes(p.number)
  const ui = { pur1_received10: mention(s.pur1), pur2: mention(s.pur2), pur3: mention(s.pur3), pur4_confirmed_zero_received: mention(s.pur4), pur5_cancelled: mention(s.pur5) }
  // backend: a return against zero-received / cancelled purchase must be rejected
  const before4 = (await purchaseReturnsOf(page, s.pur4.id)).length; const before5 = (await purchaseReturnsOf(page, s.pur5.id)).length
  const r4 = await H.post(page, '/purchase-returns', body(s.pur4, { [s.prodE.id]: 1 }))
  const r5 = await H.post(page, '/purchase-returns', body(s.pur5, { [s.prodE.id]: 1 }))
  for (const r of [r4, r5]) if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: '?' })
  const after4 = (await purchaseReturnsOf(page, s.pur4.id)).length; const after5 = (await purchaseReturnsOf(page, s.pur5.id)).length
  const uiOk = ui.pur1_received10 && ui.pur2 && ui.pur3 && !ui.pur4_confirmed_zero_received && !ui.pur5_cancelled
  const beOk = r4.status >= 400 && r5.status >= 400 && after4 === before4 && after5 === before5
  rec({ id: 'T3', name: 'Purchase selector eligibility', status: uiOk && beOk ? 'PASS' : 'FAIL', expected: 'Only purchases with received goods offered; zero-received and cancelled purchases not offered and rejected by backend; fully-returned handled in T13', actual: `UI offers: ${J(ui)}. Backend zero-received purchase -> ${r4.status} ${J(r4.body).slice(0, 160)} (returns before/after ${before4}/${after4}); cancelled purchase -> ${r5.status} ${J(r5.body).slice(0, 160)} (returns before/after ${before5}/${after5})`, api: `POST zero-received: ${r4.status}; POST cancelled: ${r5.status}`, shot })
}

// T4 + T5 — select purchase / stale banner / partial draft (same page, deliberately keeps the stale banner state)
TESTS.T4 = async (h) => {
  const { page, net } = h; const s = S(); const pur = s.pur1; const A = s.prodA
  await H.openNew(page)
  await page.getByRole('button', { name: /create draft return/i }).click(); await page.waitForTimeout(900)  // trigger the validation banner first
  const banner0 = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').trim()
  await H.pickPurchase(page, pur.number)
  const sup = await labelValue(page, 'Supplier'); const grn = await labelValue(page, 'Goods Receipt'); const wh = await labelValue(page, 'Receiving Warehouse')
  const cells = await H.itemCells(page, new RegExp(A.name))
  const bannerAfter = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').trim()
  const stale = /select a purchase with received goods first/i.test(bannerAfter)
  const shot = await H.shot(page, '04-purchase-selected')
  const apiPur = await H.getPurchase(page, pur.id); const apiItem = apiPur.items.find((i) => i.product_id === A.id)
  const grns = (await H.api(page, '/grns?purchase_id=' + pur.id)).body
  const grnNum = grns && grns.items && grns.items[0] && grns.items[0].grn_number
  H.setState({ t4: { stale, grnShown: grn.value, grnApi: grnNum } })
  const derived = sup.value === pur.supplierName && wh.value === S().warehouse.name
  const valuesOk = cells.received === 10 && cells.already === 0 && cells.returnable === 10 && apiItem.received_qty === 10
  rec({ id: 'T4', name: 'Purchase selection / derived fields', status: derived && valuesOk && grn.value && grn.value !== '—' ? 'PASS' : 'FAIL', expected: 'Supplier, Warehouse and GRN derive from the Purchase; items Received=10, Already Returned=0, Returnable=10 (matches API)', actual: `Supplier="${sup.value}", Warehouse="${wh.value}", GRN field="${grn.value}" (API: purchase has GRN ${grnNum}); row ${J(cells)}; API purchase item received_qty=${apiItem.received_qty}, quantity=${apiItem.quantity}. Banner after blank submit: "${banner0}". Banner still visible after selecting purchase+items: ${stale}`, api: `GET /purchases/${pur.id} received_qty=${apiItem.received_qty}; GET /grns?purchase_id -> ${grnNum}`, shot })

  // BUG A vs BUG B: continue on the SAME page (stale banner present), enter qty and create
  await H.setQtyUI(page, new RegExp(A.name), 4)
  await H.selectReason(page, /Damaged Goods/)
  await page.locator('textarea').fill('QA-PR partial return')
  const stockBefore = await stockOf(page, A.id)
  const out = await H.submitDraft(page, net)
  const stockAfter = await stockOf(page, A.id)
  const shot5 = await H.shot(page, '05-partial-draft-created')
  const created = out.res && out.res.id ? out.res : null
  if (created) { H.track('purchase_return', { id: created.id, name: created.return_number, purchaseId: pur.id }); H.setState({ ret1: { id: created.id, number: created.return_number } }) }
  const stale2 = { stale, createdDespiteStaleBanner: !!created, status: out.status }
  H.setState({ staleResult: stale2 })
  let apiRet = created ? await H.getReturn(page, created.id) : null
  // refresh persistence
  if (created) await H.openReturn(page, created.id)
  const txt = await bodyText(page)
  const fresh = created ? await H.getReturn(page, created.id) : null
  const s5 = summarize(fresh)
  const checks = fresh && fresh.status === 'draft' && fresh.purchase_id === pur.id && fresh.supplier_id === pur.supplierId && fresh.warehouse_id === S().warehouse.id && fresh.total_return_qty === 4 && fresh.reason === 'Damaged Goods' && (fresh.notes || '').includes('QA-PR partial return') && fresh.items.length === 1 && fresh.items[0].product_id === A.id
  const uniq = created ? (await H.listReturns(page, 'search=' + encodeURIComponent(created.return_number))).items.filter((x) => x.return_number === created.return_number).length : 0
  rec({ id: 'T5', name: 'Valid partial Draft Return (qty 4)', status: out.posts === 1 && checks && uniq === 1 && out.status === 201 && /draft/i.test(txt) ? 'PASS' : 'FAIL', expected: 'Exactly one POST; unique Return no.; correct Purchase/Supplier/Warehouse/Product; qty 4; reason Damaged Goods; status Draft; persists on refresh', actual: `POST count=${out.posts}, HTTP ${out.status}, toast=${J(out.toast)}, landed on ${out.url}; API record ${J(s5)}; detail page after reload contains "${(fresh && fresh.return_number) || ''}" and Draft badge=${/draft/i.test(txt)}`, api: `POST /purchase-returns -> ${out.status}; GET /purchase-returns/${created && created.id}`, stock: `stock before create ${stockBefore} -> after create ${stockAfter}`, shot: shot5 })
  rec({ id: 'T4-STALE', name: 'Stale "Select a purchase with received goods first." banner (BUG A vs BUG B)', status: stale ? 'FAIL' : 'PASS', expected: 'No validation banner remains once a valid received purchase is selected and items are loaded', actual: stale ? `BUG A confirmed: the banner "${banner0}" stayed visible after a valid purchase (Received 10 / Returnable 10) was selected. BUG B ruled out: with that stale banner still on screen, entering qty 4 and clicking Create Draft Return sent POST /purchase-returns -> ${out.status} and created ${created && created.return_number}. So it is a visual-only stale message; creation is not blocked.` : 'Banner cleared after selecting a purchase', api: `POST -> ${out.status}`, shot })
  H.setState({ recon: [{ stage: 'Initial (product created)', received: 0, returned: 0, expected: 0, actual: 0 }, { stage: 'Purchase received (GRN confirmed)', received: 10, returned: 0, expected: 10, actual: stockBefore }] })
}

// T6 — draft stock behaviour
TESTS.T6 = async (h) => {
  const { page } = h; const s = S(); const A = s.prodA
  const r = await H.getReturn(page, s.ret1.id); const st = await H.stock(page, A.id)
  const inv = st.inventory_row; const mv = await movements(page, A.id)
  const retMv = mv.filter((m) => /return/i.test(JSON.stringify(m)))
  const ok = st.total_inventory === 10 && r.stock_deducted === false
  rec({ id: 'T6', name: 'Draft stock behaviour', status: ok ? 'PASS' : 'FAIL', expected: 'Draft must not reduce physical stock (stock stays 10; stock_deducted=false; no return movement)', actual: `status=${r.status}, stock_deducted=${r.stock_deducted}; product total_inventory=${st.total_inventory}; warehouse stock=${J(st.warehouses)}; /inventory row=${J(inv)}; return-type movements=${retMv.length}`, api: 'GET /products/{id}; GET /warehouses/stock?product_id; GET /inventory; GET /warehouses/{id}/movements', stock: `10 -> ${st.total_inventory}` })
}

// T7 — transitions: (A) invalid transitions probed on throw-away drafts of PUR2, (B) valid Confirm via UI on return 2 of PUR1
TESTS.T7 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur2 = s.pur2; const A = s.prodA; const pur1 = s.pur1
  const probes = []
  async function probe(label, steps) {
    const d = await mkReturn(page, pur2, { [B.id]: 1 }, { notes: 'QA-PR transition probe: ' + label }); const id = d.body.id
    const st0 = await stockOf(page, B.id); const log = []
    for (const a of steps) { const r = await act(page, id, a, a === 'cancel' ? { cancel_reason: 'QA-PR probe' } : {}); const cur = await H.getReturn(page, id); log.push({ action: a, http: r.status, detail: r.status >= 300 ? J(r.body).slice(0, 110) : '', now: cur.status, stock_deducted: cur.stock_deducted, stock: await stockOf(page, B.id) }) }
    probes.push({ label, number: d.body.return_number, id, st0, log })
    return log
  }
  await probe('draft -> complete', ['complete'])
  await probe('draft -> dispatch', ['dispatch'])
  await probe('confirmed -> complete', ['confirm', 'complete'])
  await probe('confirm twice', ['confirm', 'confirm'])
  await probe('cancel then confirm', ['cancel', 'confirm'])
  H.setState({ transitionProbes: probes })
  const rejected = (p) => p.log[p.log.length - 1].http >= 400
  const skipAhead = probes.slice(0, 3).filter((p) => !rejected(p)).map((p) => p.label)
  const mustReject = [probes[0], probes[3], probes[4]]  // draft->complete, confirm twice, confirm after cancel
  const rejectedOk = mustReject.every(rejected)
  // part B: valid UI Confirm on return 2 of PUR1
  const r2 = await mkReturn(page, pur1, { [A.id]: 3 }, { notes: 'QA-PR second partial' }); const id = r2.body.id
  H.setState({ ret2: { id, number: r2.body.return_number } })
  const stPre = await stockOf(page, A.id)
  await H.openReturn(page, id)
  const btns0 = (await page.locator('main button').allInnerTexts()).map((x) => x.trim()).filter(Boolean)
  const out = await uiAct(page, net, /^confirm$/i)
  const r = await H.getReturn(page, id); const stPost = await stockOf(page, A.id)
  await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const btns1 = (await page.locator('main button').allInnerTexts()).map((x) => x.trim()).filter(Boolean)
  const txt = await bodyText(page); const shot = await H.shot(page, '07-return-confirmed')
  H.setState({ lifecycle: { before: stPre, afterConfirm: stPost }, ret2Confirm: { stock_deducted: r.stock_deducted, confirmed_at: r.confirmed_at } })
  const uiOk = out.status === 200 && r.status === 'confirmed' && !!r.confirmed_at && /confirmed/i.test(txt) && btns1.some((b) => /dispatch/i.test(b)) && !btns1.some((b) => /^complete/i.test(b))
  rec({ id: 'T7', name: 'Confirm / progress transition (valid + invalid)', status: uiOk && rejectedOk ? 'PASS' : 'FAIL', expected: 'Draft -> Confirm succeeds and persists with timestamp; invalid transitions (Draft->Complete, double Confirm, Confirm after Cancel) are rejected. Skip-ahead transitions are recorded exactly as the backend behaves (see actual)', actual: `VALID (UI, return ${r2.body.return_number}): Draft buttons=${J(btns0)}; Confirm -> HTTP ${out.status}, status=${r.status}, confirmed_at=${r.confirmed_at}, stock_deducted=${r.stock_deducted}; after reload buttons=${J(btns1)}. SKIP-AHEAD ACCEPTED BY BACKEND (not offered by the UI): ${skipAhead.join(' and ') || 'none'}. PROBES (throw-away drafts): ${probes.map((p) => p.label + ' => ' + p.log.map((l) => `${l.action}:${l.http}${l.http < 300 ? ' (now ' + l.now + ', deducted=' + l.stock_deducted + ', stock ' + p.st0 + '->' + l.stock + ')' : ' ' + l.detail}`).join(' then ')).join(' || ')}`, api: 'POST /purchase-returns/{id}/confirm|dispatch|complete|cancel', stock: `return 2: ${stPre} -> ${stPost} at Confirm (stock_deducted=${r.stock_deducted})`, shot })
}

// T8 — return 1 idempotency (state it reached) + return 2 dispatch / complete through the UI
TESTS.T8 = async (h) => {
  const { page, net } = h; const s = S(); const A = s.prodA; const id1 = s.ret1.id; const id2 = s.ret2.id
  // return 1 (completed earlier in T4-T7 by the direct API jump): stock must be 6 exactly once, and replays must not deduct again
  const st1 = (S().lifecycle || {}).before  // stock measured in T7 right after return 1 was completed and before return 2 was confirmed
  // return 2 through the UI: Dispatch, then Complete
  await H.openReturn(page, id2)
  const d = await uiAct(page, net, /dispatch return/i); const rD = await H.getReturn(page, id2); const sD = await stockOf(page, A.id)
  await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1200)
  const c = await uiAct(page, net, /complete return/i); const rC = await H.getReturn(page, id2); const sC = await stockOf(page, A.id)
  const shot = await H.shot(page, '08-return-completed')
  for (let i = 0; i < 2; i++) { await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1000) }
  const rep = []; for (const id of [id1, id2]) for (const a of ['complete', 'dispatch', 'confirm']) rep.push((await act(page, id, a)).status)
  const sRe = await stockOf(page, A.id); const wh = (await H.stock(page, A.id)).warehouses
  const mv = (await movements(page, A.id)).filter((m) => /return/i.test(J(m)))
  const btns = (await page.locator('main button').allInnerTexts()).map((x) => x.trim()).filter(Boolean)
  const lc = S().lifecycle || {}; H.setState({ lifecycle: { ...lc, afterDispatch: sD, afterComplete: sC, afterReplay: sRe, afterReturn1: st1 } })
  const rc = (S().recon || []).filter((x) => !/^Return [12]/.test(x.stage))
  rc.push({ stage: 'Return 1 complete (qty 4)', received: 10, returned: 4, expected: 6, actual: st1 }); rc.push({ stage: 'Return 2 complete (qty 3)', received: 10, returned: 7, expected: 3, actual: sRe }); H.setState({ recon: rc })
  const ok = d.status === 200 && c.status === 200 && rC.status === 'completed' && !!rC.completed_at && st1 === 6 && sRe === 3 && rep.every((x) => x >= 400) && mv.length === 2
  rec({ id: 'T8', name: 'Complete Purchase Return + idempotency', status: ok ? 'PASS' : 'FAIL', expected: 'Return reaches Completed; stock changes exactly once per return (10 -> 6 after return 1, 6 -> 3 after return 2); reload/replay never deducts again', actual: `Return 1 (qty 4) is Completed with stock ${st1} (expected 6; measured right after it completed). Return 2 via UI: Dispatch HTTP ${d.status} -> ${rD.status} (dispatched_at=${rD.dispatched_at}); Complete HTTP ${c.status} -> ${rC.status} (completed_at=${rC.completed_at}, stock_deducted=${rC.stock_deducted}). After 2 reloads + replaying complete/dispatch/confirm on both returns -> HTTP ${rep.join('/')}; stock ${sRe} (expected 3); return-type ledger movements=${mv.length} (expected 2); buttons on completed page=${J(btns)}; warehouse stock=${J(wh)}`, api: 'POST dispatch / complete; GET /warehouses/{id}/movements', stock: `ret2: confirm ${S().lifecycle.afterConfirm} -> dispatch ${sD} -> complete ${sC} -> after reloads/replays ${sRe}; ret1 final ${st1}`, shot })
}

// T9 — Already Returned / Returnable recalculation, on a clean purchase (PUR6: 10 received) so the 4/6 snapshot is exact
TESTS.T9 = async (h) => {
  const { page } = h; const s = S(); const F = s.prodF; const pur = s.pur6
  const st0 = await stockOf(page, F.id)
  const r = await mkReturn(page, pur, { [F.id]: 4 }, { notes: 'QA-PR T9 return 1 (4)' })
  const wf = r.status < 300 ? await toStatus(page, r.body.id, 'completed') : []
  H.setState({ ret9: r.status < 300 ? { id: r.body.id, number: r.body.return_number } : null })
  const st1 = await stockOf(page, F.id)
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const cells = await H.itemCells(page, new RegExp(F.name)); const shot = await H.shot(page, '09-returnable-after-first-return')
  const rets = await purchaseReturnsOf(page, pur.id); const sumDone = rets.filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.total_return_qty, 0)
  const apiPur = await H.getPurchase(page, pur.id)
  const ok = r.status === 201 && cells.received === 10 && cells.already === 4 && cells.returnable === 6 && sumDone === 4 && st1 === 6
  rec({ id: 'T9', name: 'Already Returned / Returnable after first return (clean purchase)', status: ok ? 'PASS' : 'FAIL', expected: 'After a completed return of 4: Received 10, Already Returned 4, Returnable 6 (UI and API), stock 6', actual: `Created ${r.body && r.body.return_number} (${r.status}), workflow ${wf.join(',')}; New Return form shows ${J(cells)}; API sum of non-cancelled returns=${sumDone}; purchase item received_qty=${apiPur.items[0].received_qty}; stock ${st0}->${st1}. (The same recalculation on PUR1 is verified at 7/3 in T10 and 10/0 in T13.)`, api: 'GET /purchase-returns?purchase_id', stock: `${st0} -> ${st1} (expected 6)`, shot })
}

// T10 — second partial return (qty 3): created + completed in T7/T8; verify cumulative figures on the form
TESTS.T10 = async (h) => {
  const { page } = h; const s = S(); const A = s.prodA; const pur = s.pur1
  const r = await H.getReturn(page, s.ret2.id); const st = await stockOf(page, A.id)
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const cells = await H.itemCells(page, new RegExp(A.name)); const shot = await H.shot(page, '10-after-second-return')
  const ok = r.status === 'completed' && r.total_return_qty === 3 && st === 3 && cells.received === 10 && cells.already === 7 && cells.returnable === 3
  rec({ id: 'T10', name: 'Second partial return (qty 3)', status: ok ? 'PASS' : 'FAIL', expected: 'Return 2 (qty 3) completed; cumulative Received 10 / Already Returned 7 / Returnable 3; stock 3', actual: `return ${r.return_number} status=${r.status}, qty=${r.total_return_qty}; New Return form now shows ${J(cells)}; stock=${st}`, api: `GET /purchase-returns/${s.ret2.id}`, stock: `6 -> ${st} (expected 3)`, shot })
}

// T11 — over-return (UI clamp + backend)
TESTS.T11 = async (h) => {
  const { page, net } = h; const s = S(); const A = s.prodA; const pur = s.pur1
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const w0 = net.prWrites.length
  const typed = await H.setQtyUI(page, new RegExp(A.name), 4)
  const shot = await H.shot(page, '11-over-return-rejected')
  const writesUI = net.prWrites.length - w0
  const before = (await purchaseReturnsOf(page, pur.id)).length; const stB = await stockOf(page, A.id)
  const r = await H.post(page, '/purchase-returns', body(pur, { [A.id]: 4 }))
  if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: pur.id })
  const after = (await purchaseReturnsOf(page, pur.id)).length; const stA = await stockOf(page, A.id)
  const ok = r.status >= 400 && after === before && stA === stB && Number(typed) <= 3
  rec({ id: 'T11', name: 'Over-return (returnable 3, attempt 4)', status: ok ? 'PASS' : 'FAIL', expected: 'UI refuses > returnable; backend rejects 4 with a clear message; no return created; no stock change', actual: `UI: typed 4 -> field shows "${typed}" (UI silently clamps to the returnable max, no error shown), writes sent=${writesUI}. Backend direct POST qty 4 -> ${r.status} ${J(r.body).slice(0, 220)}; returns before/after ${before}/${after}`, api: `POST /purchase-returns qty=4 -> ${r.status}`, stock: `${stB} -> ${stA}`, shot })
}

// T12 — exact remaining quantity
TESTS.T12 = async (h) => {
  const { page } = h; const s = S(); const A = s.prodA; const pur = s.pur1
  const r = await mkReturn(page, pur, { [A.id]: 3 }, { notes: 'QA-PR final return' })
  const wf = r.status < 300 ? await toStatus(page, r.body.id, 'completed') : []
  if (r.status < 300) H.setState({ ret3: { id: r.body.id, number: r.body.return_number } })
  const st = await H.stock(page, A.id)
  const rets = await purchaseReturnsOf(page, pur.id); const sum = rets.filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.total_return_qty, 0)
  const rc = S().recon || []; rc.push({ stage: 'Fully returned (return 3 complete, qty 3)', received: 10, returned: sum, expected: 0, actual: st.total_inventory }); H.setState({ recon: rc })
  const ok = r.status === 201 && wf.join(',') === 'confirm:200,dispatch:200,complete:200' && st.total_inventory === 0 && sum === 10 && Object.values(st.warehouses).every((w) => w.on_hand >= 0)
  rec({ id: 'T12', name: 'Return exact remaining quantity (3)', status: ok ? 'PASS' : 'FAIL', expected: 'Cumulative returned 10, returnable 0, stock 0, no negative', actual: `create ${r.status}; workflow ${wf.join(',')}; cumulative returned (non-cancelled)=${sum}; stock total_inventory=${st.total_inventory}; warehouse=${J(st.warehouses)}`, api: 'GET /purchase-returns?purchase_id; GET /warehouses/stock', stock: `3 -> ${st.total_inventory} (expected 0)` })
}

// T13 — fully-returned purchase
TESTS.T13 = async (h) => {
  const { page, net } = h; const s = S(); const A = s.prodA; const pur = s.pur1
  await H.openNew(page)
  await page.getByPlaceholder(/search purchase/i).fill(pur.number); await page.waitForTimeout(3500)
  const offered = (await page.locator('.max-h-64').allInnerTexts().catch(() => [])).join(' ').includes(pur.number)
  let selectedMsg = '', btnDisabled = null, rowsShown = null, writes = 0
  if (offered) {
    await H.pickPurchase(page, pur.number)
    selectedMsg = (await page.locator('main').innerText()).replace(/\n+/g, ' | ')
    btnDisabled = await page.getByRole('button', { name: /create draft return/i }).isDisabled()
    rowsShown = await page.locator('tbody tr').count()
  }
  const shot = await H.shot(page, '13-fully-returned')
  const before = (await purchaseReturnsOf(page, pur.id)).length
  const r = await H.post(page, '/purchase-returns', body(pur, { [A.id]: 1 }))
  if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: pur.id })
  const after = (await purchaseReturnsOf(page, pur.id)).length
  const ok = r.status >= 400 && after === before && (!offered || btnDisabled === true)
  rec({ id: 'T13', name: 'Fully-returned purchase', status: ok ? 'PASS' : 'FAIL', expected: 'No further return possible: hidden, or shown with no returnable row, or backend rejects', actual: `Selector still offers the purchase: ${offered}; after selecting: "(fully returned)" label=${/fully returned/i.test(selectedMsg)}, message "No returnable goods..."=${/no returnable goods/i.test(selectedMsg)}, item rows=${rowsShown}, Create Draft button disabled=${btnDisabled}. Backend POST qty 1 -> ${r.status} ${J(r.body).slice(0, 200)}; returns before/after ${before}/${after}`, api: `POST qty=1 -> ${r.status}`, shot })
}

// T14-T17 — invalid quantities (UI + backend) on PUR2 (20 units)
async function qtyProbe(h, id, name, uiValue, apiQty, shotName, expectUiRule) {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const w0 = net.prWrites.length
  const typed = await H.setQtyUI(page, new RegExp(B.name), uiValue)
  await page.getByRole('button', { name: /create draft return/i }).click(); await page.waitForTimeout(1500)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').trim()
  const uiWrites = net.prWrites.length - w0
  const shot = await H.shot(page, shotName)
  const created = uiWrites > 0 ? net.prWrites.slice(w0).filter((x) => x.res && x.res.id) : []
  for (const c of created) H.track('purchase_return', { id: c.res.id, name: c.res.return_number, purchaseId: pur.id })
  const stB = await stockOf(page, B.id); const nB = (await purchaseReturnsOf(page, pur.id)).length
  const r = await H.post(page, '/purchase-returns', body(pur, { [B.id]: apiQty }))
  if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: pur.id })
  const nA = (await purchaseReturnsOf(page, pur.id)).length; const stA = await stockOf(page, B.id)
  return { typed, banner, uiWrites, created, r, stB, stA, nB, nA, shot }
}
TESTS.T14 = async (h) => {
  const x = await qtyProbe(h, 'T14', 'Zero qty', 0, 0, '14-zero-quantity')
  const ok = x.uiWrites === 0 && x.r.status >= 400 && x.nA === x.nB && x.stA === x.stB
  rec({ id: 'T14', name: 'Zero quantity', status: ok ? 'PASS' : 'FAIL', expected: 'Rejected; no return; no stock change', actual: `UI: qty 0 -> banner "${x.banner}", API writes from UI=${x.uiWrites}. Backend qty 0 -> ${x.r.status} ${J(x.r.body).slice(0, 200)}; returns ${x.nB}->${x.nA}`, api: `POST qty=0 -> ${x.r.status}`, stock: `${x.stB} -> ${x.stA}`, shot: x.shot })
}
TESTS.T15 = async (h) => {
  const x = await qtyProbe(h, 'T15', 'Negative qty', -1, -1, '15-negative-quantity')
  const ok = x.uiWrites === 0 && x.r.status >= 400 && x.nA === x.nB && x.stA === x.stB
  rec({ id: 'T15', name: 'Negative quantity', status: ok ? 'PASS' : 'FAIL', expected: 'Rejected in UI and backend; no stock change', actual: `UI: typed -1 -> field shows "${x.typed}", banner "${x.banner}", writes=${x.uiWrites}. Backend qty -1 -> ${x.r.status} ${J(x.r.body).slice(0, 200)}; returns ${x.nB}->${x.nA}`, api: `POST qty=-1 -> ${x.r.status}`, stock: `${x.stB} -> ${x.stA}`, shot: x.shot })
}
TESTS.T16 = async (h) => {
  const x = await qtyProbe(h, 'T16', 'Decimal qty', 1.5, 1.5, '16-decimal-quantity')
  const silentRound = x.uiWrites > 0
  const beOk = x.r.status >= 400
  const ok = beOk && x.nA - x.nB === x.created.length && !silentRound
  rec({ id: 'T16', name: 'Decimal quantity (1.5)', status: beOk ? (silentRound ? 'FAIL' : 'PASS') : 'FAIL', expected: 'Rejected (integer quantity). Backend must enforce integer; UI should flag it before submitting', actual: `UI: typed 1.5 -> field value "${x.typed}"; ${silentRound ? `UI SILENTLY CHANGED the value and submitted a return of ${x.typed} (POST sent, ${x.created.length} return(s) created: ${x.created.map((c) => c.res.return_number).join(',')})` : 'UI blocked it'}; banner "${x.banner}". Backend direct qty 1.5 -> ${x.r.status} ${J(x.r.body).slice(0, 220)}`, api: `POST qty=1.5 -> ${x.r.status}`, stock: `${x.stB} -> ${x.stA} (a draft does not change stock)`, shot: x.shot })
}
TESTS.T17 = async (h) => {
  const x = await qtyProbe(h, 'T17', 'Huge qty', 999999, 999999, '17-large-quantity')
  const clamp = x.typed
  const ok = x.r.status >= 400 && x.stA === x.stB
  rec({ id: 'T17', name: 'Excessively large quantity (999999)', status: ok ? 'PASS' : 'FAIL', expected: 'Rejected; no overflow / negative stock', actual: `UI: typed 999999 -> field shows "${clamp}" (clamped to the returnable max); submit created ${x.created.length} return(s) of that clamped qty. Backend direct 999999 -> ${x.r.status} ${J(x.r.body).slice(0, 200)}`, api: `POST qty=999999 -> ${x.r.status}`, stock: `${x.stB} -> ${x.stA}`, shot: x.shot })
}

// T18 — required reason
TESTS.T18 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const reasons = await H.reasonOptions(page)
  await H.selectReason(page, /^Other$/); await H.setQtyUI(page, new RegExp(B.name), 1)
  const w0 = net.prWrites.length
  await page.getByRole('button', { name: /create draft return/i }).click(); await page.waitForTimeout(1200)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').trim()
  const uiWrites = net.prWrites.length - w0; const shot = await H.shot(page, '18-required-reason')
  const before = (await purchaseReturnsOf(page, pur.id)).length
  const r0 = await H.post(page, '/purchase-returns', body(pur, { [B.id]: 1 }, { reason: '' }))
  const r1 = await H.post(page, '/purchase-returns', { ...body(pur, { [B.id]: 1 }), reason: null, items: [{ purchase_item_id: itemOf(pur, B.id).id, quantity: 1 }] })
  for (const r of [r0, r1]) if (r.status < 300 && r.body && r.body.id) H.track('purchase_return', { id: r.body.id, name: r.body.return_number, purchaseId: pur.id })
  const after = (await purchaseReturnsOf(page, pur.id)).length
  const uiOk = uiWrites === 0 && /other/i.test(banner)
  const be = r0.status < 300 || r1.status < 300 ? 'backend accepts a return with an empty/null reason (reason is optional in the schema)' : 'backend rejects missing reason'
  rec({ id: 'T18', name: 'Required reason', status: uiOk ? 'PASS' : 'FAIL', expected: 'Reason is mandatory (field marked required). UI cannot clear the default; blank "Other" details blocked; backend behaviour recorded', actual: `Reason options=${J(reasons)} (no blank option; default "Damaged Goods"). UI "Other" with empty details -> banner "${banner}", writes=${uiWrites}. Backend: reason "" -> ${r0.status}, reason null -> ${r1.status}; ${be}. returns ${before}->${after}`, api: `POST reason="" -> ${r0.status}; reason=null -> ${r1.status} (${J((r0.body && r0.body.reason) || r1.body && r1.body.reason)})`, shot })
}

// T19 — return date rules
TESTS.T19 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const res = []
  for (const [label, d] of [['today', day(0)], ['future +30d', day(30)], ['before purchase 2020-01-01', '2020-01-01']]) {
    await H.openNew(page); await H.pickPurchase(page, pur.number)
    await H.setQtyUI(page, new RegExp(B.name), 1)
    await setDateUI(page, d)
    const out = await H.submitDraft(page, net)
    if (out.res && out.res.id) H.track('purchase_return', { id: out.res.id, name: out.res.return_number, purchaseId: pur.id })
    res.push({ id: out.res && out.res.id, label, entered: d, status: out.status, stored: out.res && out.res.return_date, banner: out.banner })
    if (label.startsWith('future')) await H.shot(page, '19-return-date-future')
  }
  const shot = await H.shot(page, '19-return-date-past')
  for (const x of res) if (x.id) await act(page, x.id, 'cancel', { cancel_reason: 'QA-PR cleanup' })
  const apiDate = await H.post(page, '/purchase-returns', body(pur, { [B.id]: 1 }, { date: '2030-02-30' }))
  if (apiDate.status < 300 && apiDate.body && apiDate.body.id) H.track('purchase_return', { id: apiDate.body.id, name: apiDate.body.return_number, purchaseId: pur.id })
  const accepted = res.filter((x) => x.status === 201).map((x) => x.label)
  H.setState({ dateRules: res })
  const futureOk = res[1].status === 201, pastOk = res[2].status === 201
  rec({ id: 'T19', name: 'Return Date rules', status: res[0].status === 201 ? (futureOk || pastOk ? 'PASS' : 'PASS') : 'FAIL', expected: 'Record exact accepted/rejected rules (no assumption)', actual: `UI-submitted: ${res.map((x) => `${x.label} (${x.entered}) -> HTTP ${x.status}, stored ${x.stored}${x.banner ? ', banner ' + x.banner : ''}`).join(' ; ')}. Backend: invalid calendar date 2030-02-30 -> ${apiDate.status}. Accepted: ${accepted.join(', ') || 'none'}. ${futureOk ? 'A future-dated return is accepted. ' : ''}${pastOk ? 'A return dated before the purchase existed is accepted (no date-vs-purchase validation).' : ''}`, api: `POST with return_date values`, shot })
}

// T20 — multiple items
TESTS.T20 = async (h) => {
  const { page, net } = h; const s = S(); const C = s.prodC, D = s.prodD; const pur = s.pur3
  const sC0 = await stockOf(page, C.id), sD0 = await stockOf(page, D.id)
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const cellsC = await H.itemCells(page, new RegExp(C.name)); const cellsD = await H.itemCells(page, new RegExp(D.name))
  await H.setQtyUI(page, new RegExp(C.name), 2); await H.setQtyUI(page, new RegExp(D.name), 3)
  const out = await H.submitDraft(page, net)
  const id = out.res && out.res.id
  if (id) H.track('purchase_return', { id, name: out.res.return_number, purchaseId: pur.id })
  const shot = await H.shot(page, '20-multi-item-return')
  const wf = id ? await toStatus(page, id, 'completed') : []
  const r = id ? await H.getReturn(page, id) : null
  const sC = await stockOf(page, C.id), sD = await stockOf(page, D.id)
  H.setState({ ret20: id ? { id, number: out.res.return_number } : null })
  const ok = id && r.items.length === 2 && r.total_return_qty === 5 && sC === sC0 - 2 && sD === sD0 - 3 && wf.join(',') === 'confirm:200,dispatch:200,complete:200'
  rec({ id: 'T20', name: 'Multiple items (A=2 of 5, B=3 of 8)', status: ok ? 'PASS' : 'FAIL', expected: 'Return has 2 items / total 5; stock A -2, B -3 independently', actual: `form rows C ${J(cellsC)} D ${J(cellsD)}; created ${out.res && out.res.return_number} (HTTP ${out.status}); items=${r && r.items.length}, total_return_qty=${r && r.total_return_qty}; workflow ${wf.join(',')}; stock C ${sC0}->${sC} (exp ${sC0 - 2}), D ${sD0}->${sD} (exp ${sD0 - 3})`, api: 'POST /purchase-returns (2 items) + lifecycle', stock: `C ${sC0}->${sC}; D ${sD0}->${sD}`, shot })
}

// T21 — atomicity
TESTS.T21 = async (h) => {
  const { page } = h; const s = S(); const C = s.prodC, D = s.prodD; const pur = s.pur3
  const sC0 = await stockOf(page, C.id), sD0 = await stockOf(page, D.id); const n0 = (await purchaseReturnsOf(page, pur.id)).length
  const bad = await H.post(page, '/purchase-returns', body(pur, { [C.id]: 1, [D.id]: 99 }))
  if (bad.status < 300 && bad.body && bad.body.id) { H.track('purchase_return', { id: bad.body.id, name: bad.body.return_number, purchaseId: pur.id }); await toStatus(page, bad.body.id, 'confirmed') }
  const sC1 = await stockOf(page, C.id), sD1 = await stockOf(page, D.id); const n1 = (await purchaseReturnsOf(page, pur.id)).length
  rec({ id: 'T21', name: 'One invalid item among multiple (atomic)', status: bad.status >= 400 && n1 === n0 && sC1 === sC0 && sD1 === sD0 ? 'PASS' : 'FAIL', expected: 'Whole request rejected; no return; stock of the valid item unchanged', actual: `POST {C:1 valid, D:99 over} -> ${bad.status} ${J(bad.body).slice(0, 220)}; returns on purchase ${n0}->${n1}; stock C ${sC0}->${sC1}, D ${sD0}->${sD1}`, api: `POST -> ${bad.status}`, stock: `C ${sC0}->${sC1}; D ${sD0}->${sD1}` })
}

// T22 — duplicate submission (create + confirm)
TESTS.T22 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  await H.openNew(page); await H.pickPurchase(page, pur.number); await H.setQtyUI(page, new RegExp(B.name), 1)
  const n0 = (await purchaseReturnsOf(page, pur.id)).length; const w0 = net.prWrites.length
  const btn = page.getByRole('button', { name: /create draft return/i }).last()
  await btn.dblclick({ delay: 20 }).catch(() => {})
  await page.waitForTimeout(5000)
  const posts = net.prWrites.slice(w0).filter((x) => x.method === 'POST' && /\/purchase-returns$/.test(x.url)); const created = posts.filter((x) => x.res && x.res.id)
  for (const c of created) H.track('purchase_return', { id: c.res.id, name: c.res.return_number, purchaseId: pur.id })
  const n1 = (await purchaseReturnsOf(page, pur.id)).length
  const shot = await H.shot(page, '22-double-submit')
  // confirm double-click
  let confPosts = null, stB = null, stA = null
  if (created[0]) {
    await H.openReturn(page, created[0].res.id); stB = await stockOf(page, B.id)
    const w1 = net.prWrites.length
    await page.getByRole('button', { name: /^confirm$/i }).first().dblclick({ delay: 20 }).catch(() => {})
    await page.waitForTimeout(5000)
    confPosts = net.prWrites.slice(w1).filter((x) => /\/confirm$/.test(x.url)).map((x) => x.status)
    stA = await stockOf(page, B.id)
    await act(page, created[0].res.id, 'cancel', { cancel_reason: 'QA-PR cleanup' })
  }
  const stRestored = await stockOf(page, B.id)
  const ok = posts.length === 1 && created.length === 1 && n1 - n0 === 1 && (confPosts === null || (confPosts.length === 1 && stA === stB - 1))
  rec({ id: 'T22', name: 'Duplicate submission (create + confirm double-click)', status: ok ? 'PASS' : 'FAIL', expected: 'Rapid double-click sends one create and one confirm; one return; stock changes once', actual: `Create double-click: POST /purchase-returns count=${posts.length}, returns created=${created.length} (list ${n0}->${n1}). Confirm double-click: /confirm requests=${J(confPosts)}; stock ${stB}->${stA}; after cancelling that confirmed return stock restored to ${stRestored}`, api: 'network capture of POST calls', stock: `confirm: ${stB} -> ${stA}; after cancel ${stRestored}`, shot })
}

// T23 — edit draft
TESTS.T23 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const r = await mkReturn(page, pur, { [B.id]: 2 }, { notes: 'QA-PR before edit' })
  const id = r.body.id; const stB = await stockOf(page, B.id); const mv0 = (await movements(page, B.id)).length
  await H.openReturn(page, id)
  await page.getByRole('button', { name: /^edit$/i }).first().click(); await page.waitForTimeout(2500)
  const loaded = await H.itemCells(page, new RegExp(B.name)).catch(() => null)
  await H.setQtyUI(page, new RegExp(B.name), 3); await H.selectReason(page, /Wrong Product/); await page.locator('textarea').fill('QA-PR edited notes')
  const shotEdit = await H.shot(page, '23-edit-draft-form')
  const out = await H.submitDraft(page, net, { button: /save changes/i })
  const shot = await H.shot(page, '23-edit-draft-saved')
  const after = await H.getReturn(page, id); const stA = await stockOf(page, B.id); const mv1 = (await movements(page, B.id)).length
  const ok = out.status === 200 && after.total_return_qty === 3 && after.reason === 'Wrong Product' && /edited notes/.test(after.notes || '') && stA === stB && mv1 === mv0 && after.status === 'draft'
  rec({ id: 'T23', name: 'Edit Draft', status: ok ? 'PASS' : 'FAIL', expected: 'Qty, reason, notes editable on a draft and persisted; no stock/ledger change', actual: `edit form loaded row ${J(loaded)}; Save -> HTTP ${out.status}, toast ${J(out.toast)}; API now qty=${after.total_return_qty}, reason=${after.reason}, notes="${after.notes}", status=${after.status}; stock ${stB}->${stA}; warehouse ledger rows ${mv0}->${mv1}`, api: `PATCH /purchase-returns/${id} -> ${out.status}`, stock: `${stB} -> ${stA}`, shot })
  H.setState({ draft23: { id, number: r.body.return_number } })
}

// T24 — cancel draft (delete not supported) + cancel after confirm restores stock
TESTS.T24 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const r = await mkReturn(page, pur, { [B.id]: 2 }, { notes: 'QA-PR to cancel' }); const id = r.body.id
  const delApi = await H.api(page, '/purchase-returns/' + id, { method: 'DELETE' })
  const retBefore = (await purchaseReturnsOf(page, pur.id)).filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.total_return_qty, 0)
  await H.openReturn(page, id)
  const hasDelete = await page.getByRole('button', { name: /delete/i }).count()
  const stB = await stockOf(page, B.id)
  await page.getByRole('button', { name: /^cancel$/i }).first().click(); await page.waitForTimeout(800)
  const modal = await bodyText(page); await page.locator('textarea').last().fill('QA-PR cancel test')
  const shotModal = await H.shot(page, '24-cancel-modal')
  const out = await uiAct(page, net, /^cancel return$/i)
  const after = await H.getReturn(page, id); const stA = await stockOf(page, B.id); const shot = await H.shot(page, '24-cancel-draft')
  const retAfter = (await purchaseReturnsOf(page, pur.id)).filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.total_return_qty, 0)
  // cancel after confirm restores stock
  const r2 = await mkReturn(page, pur, { [B.id]: 2 }, { notes: 'QA-PR confirm then cancel' }); await act(page, r2.body.id, 'confirm'); const sConf = await stockOf(page, B.id)
  const c2 = await act(page, r2.body.id, 'cancel', { cancel_reason: 'QA-PR confirm then cancel' }); const sBack = await stockOf(page, B.id); const rr2 = await H.getReturn(page, r2.body.id)
  const disp = await mkReturn(page, pur, { [B.id]: 1 }, { notes: 'QA-PR dispatched cancel' }); await toStatus(page, disp.body.id, 'dispatched')
  const c3 = await act(page, disp.body.id, 'cancel', { cancel_reason: 'QA-PR dispatched' }); const rr3 = await H.getReturn(page, disp.body.id)
  rec({ id: 'T24', name: 'Delete / Cancel Draft', status: out.status === 200 && after.status === 'cancelled' && stA === stB && retAfter === retBefore - 2 && sBack === stB && hasDelete === 0 ? 'PASS' : 'FAIL', expected: 'If delete exists use it; else Cancel with confirmation; no stock effect for Draft; source returnable restored; cancel after Confirm restores stock', actual: `DELETE is not supported (API ${delApi.status}; no Delete button in UI=${hasDelete === 0}). UI Cancel opens a confirmation modal ("${modal.replace(/.*Cancel Purchase Return/, 'Cancel Purchase Return').slice(0, 150)}") requiring a reason -> HTTP ${out.status}, status=${after.status}. Draft stock ${stB}->${stA}; non-cancelled returned qty on purchase ${retBefore}->${retAfter} (cancelled return no longer counts). Confirm-then-cancel: stock ${stB}->${sConf} (confirmed) ->${sBack} (cancelled; status ${rr2.status}, cancel HTTP ${c2.status}). Dispatched return cancel -> HTTP ${c3.status} (${rr3.status})`, api: 'POST /purchase-returns/{id}/cancel', stock: `draft cancel ${stB}->${stA}; confirmed ${sConf} -> cancelled ${sBack}`, shot })
}

// T25 — completed immutability
TESTS.T25 = async (h) => {
  const { page, net } = h; const s = S(); const A = s.prodA; const id = s.ret1.id
  await H.openReturn(page, id)
  const btns = (await page.locator('main button').allInnerTexts()).map((x) => x.trim()).filter(Boolean)
  const shot = await H.shot(page, '25-completed-immutability')
  const stB = await stockOf(page, A.id)
  const p1 = await H.patch(page, '/purchase-returns/' + id, { notes: 'tampered', items: [{ purchase_item_id: itemOf(S().pur1, A.id).id, quantity: 1 }] })
  const c1 = await act(page, id, 'cancel', { cancel_reason: 'tamper' })
  // direct URL to the edit form of a completed return (UI)
  await page.goto(L.BASE + '/admin/purchase-returns/' + id + '/edit', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(2500)
  const editable = await page.getByRole('button', { name: /save changes/i }).count()
  let uiEdit = null
  if (editable) { await H.setQtyUI(page, new RegExp(A.name), 1).catch(() => {}); uiEdit = await H.submitDraft(page, net, { button: /save changes/i }).catch((e) => ({ status: 'err ' + e.message.slice(0, 80) })) }
  const shotEdit = await H.shot(page, '25-completed-edit-url')
  const after = await H.getReturn(page, id); const stA = await stockOf(page, A.id)
  const ok = p1.status >= 400 && c1.status >= 400 && after.total_return_qty === 4 && after.status === 'completed' && stA === stB && !btns.some((b) => /edit|confirm|dispatch|cancel|complete/i.test(b.replace(/Back/, '')))
  rec({ id: 'T25', name: 'Completed return immutability', status: ok ? 'PASS' : 'FAIL', expected: 'No edit/transition actions on a completed return; backend rejects PATCH/cancel; qty and stock unchanged', actual: `Buttons on completed detail page=${J(btns)}. API PATCH completed -> ${p1.status} ${J(p1.body).slice(0, 140)}; cancel completed -> ${c1.status}. Direct /edit URL: "Save Changes" button present=${editable > 0}${uiEdit ? `, saving it -> ${J(uiEdit.status)} ${uiEdit.banner || ''}` : ''}. Final qty=${after.total_return_qty}, status=${after.status}`, api: `PATCH -> ${p1.status}; cancel -> ${c1.status}`, stock: `${stB} -> ${stA}`, shot })
}

// T26 — search / filter
TESTS.T26 = async (h) => {
  const { page } = h; const s = S(); const ret = await H.getReturn(page, s.ret1.id)
  await H.openReturns(page)
  const search = page.getByPlaceholder(/search return/i)
  const rows = async () => (await page.locator('tbody tr').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim())
  const out = {}
  for (const [k, term] of [['returnNo', ret.return_number], ['supplier', s.supplier.name], ['purchaseNo', s.pur1.number]]) {
    await search.fill(''); await search.fill(term); await page.waitForTimeout(2200)
    const r = await rows(); const api = await H.listReturns(page, 'search=' + encodeURIComponent(term))
    out[k] = { term, uiRows: r.length, apiTotal: api.total, containsReturn: r.some((x) => x.includes(ret.return_number)) }
  }
  const shotS = await H.shot(page, '26-search')
  await search.fill(''); await search.fill('QA-PR'); await page.waitForTimeout(2200)
  const status = {}
  const trig = page.locator('[data-select-trigger="true"]').first()
  for (const [label, key] of [['Draft', 'draft'], ['Confirmed', 'confirmed'], ['Completed', 'completed']]) {
    await trig.click(); await page.getByRole('option', { name: label, exact: true }).click(); await page.waitForTimeout(2200)
    const r = await rows(); const txt = await page.locator('main').innerText()
    const m = txt.match(/of\s*\n?\s*(\d+)\s*$/m) || txt.match(/Showing\s*([\d-]+)\s*of\s*(\d+)/)
    const api = await H.listReturns(page, 'status=' + key + '&search=QA-PR')
    const wrong = r.filter((x) => !new RegExp(label, 'i').test(x)).length
    status[key] = { uiRows: r.length, wrongStatusRows: wrong, apiTotal: api.total }
  }
  const shot = await H.shot(page, '26-status-filter')
  await trig.click(); await page.getByRole('option', { name: 'All', exact: true }).click(); await search.fill(''); await page.waitForTimeout(2200)
  const cleared = (await rows()).length
  const okSearch = Object.values(out).every((x) => x.containsReturn && x.uiRows >= 1)
  const okStatus = Object.values(status).every((x) => x.wrongStatusRows === 0 && x.uiRows === Math.min(x.apiTotal, 25))
  rec({ id: 'T26', name: 'Search / Filter', status: okSearch && okStatus && cleared > 0 ? 'PASS' : 'FAIL', expected: 'Search by Return #, Supplier, Purchase # finds the return; status filters show only that status matching API; clearing restores list', actual: `search ${J(out)}; status filter (search "QA-PR") ${J(status)}; rows after clearing=${cleared}`, api: 'GET /purchase-returns?search=&status=', shot })
}

// T27 — summary cards
TESTS.T27 = async (h) => {
  const { page } = h; const b = S().baseline
  await H.openReturns(page); const c = await cards(page); const shot = await H.shot(page, '27-summary-cards')
  const t = async (q) => (await H.api(page, '/purchase-returns?page_size=1' + q)).body.total
  const api = { total: await t(''), draft: await t('&status=draft'), confirmed: await t('&status=confirmed'), dispatched: await t('&status=dispatched'), completed: await t('&status=completed'), cancelled: await t('&status=cancelled') }
  let created = 0; for (const k of ['pur1', 'pur2', 'pur3', 'pur4', 'pur5', 'pur6']) created += (await purchaseReturnsOf(page, S()[k].id)).length
  const ok = String(api.total) === c['Total Returns'] && String(api.draft) === c['Draft'] && String(api.confirmed + api.dispatched) === c['In Progress'] && String(api.completed) === c['Completed']
  const delta = Number(c['Total Returns']) - Number(b.ui['Total Returns'])
  rec({ id: 'T27', name: 'List summary cards', status: ok && delta === created ? 'PASS' : 'FAIL', expected: 'Cards equal backend counts and moved by exactly the number of returns this suite created', actual: `UI cards ${J(c)}; API ${J(api)} (Cancelled is not a card; it is only in "Total"); baseline UI ${J(b.ui)} -> delta total ${delta}, suite created ${created} returns`, api: J(api), shot })
}

// T28 — API/UI consistency
TESTS.T28 = async (h) => {
  const { page } = h; const s = S()
  const dr = await mkReturn(page, s.pur2, { [s.prodB.id]: 2 }, { notes: 'QA-PR compare draft', reason: 'Quality Issue' })
  H.setState({ draft28: { id: dr.body.id, number: dr.body.return_number } })
  const res = []
  for (const [label, id] of [['Draft', dr.body.id], ['Completed', s.ret1.id]]) {
    const r = await H.getReturn(page, id); await H.openReturn(page, id); const txt = await bodyText(page); const shot = await H.shot(page, '28-consistency-' + label.toLowerCase())
    const item = r.items[0]
    const checks = {
      returnNo: txt.includes(r.return_number), supplier: txt.includes(r.supplier && r.supplier.name || '__'), purchase: txt.includes(r.purchase && (r.purchase.purchase_number || r.purchase.number) || r.purchaseNumber || '__'),
      warehouse: txt.includes((r.warehouse && r.warehouse.name) || '__'), grn: r.grn_number ? txt.includes(r.grnNumber) : 'API has no GRN on the return', reason: txt.includes(r.reason), notes: txt.includes(r.notes), status: new RegExp(r.status, 'i').test(txt),
      product: txt.includes(item.product_name), received: txt.includes(String(item.received_qty ?? item.receivedQty)), returnQty: txt.includes(String(item.quantity)),
    }
    res.push({ label, id, apiNumber: r.return_number, apiGrn: r.grn_id || r.grnNumber || null, apiWarehouse: r.warehouse && r.warehouse.name, checks, shot })
  }
  const mism = res.flatMap((x) => Object.entries(x.checks).filter(([k, v]) => v === false).map(([k]) => `${x.label}.${k}`))
  rec({ id: 'T28', name: 'API / UI consistency', status: mism.length === 0 ? 'PASS' : 'FAIL', expected: 'return no., purchase, supplier, warehouse, GRN, reason, date, status, items, received/returned/return qty and notes identical on UI and API', actual: mism.length ? `MISMATCH: ${mism.join(', ')}. Detail: ${J(res)}` : `All fields consistent. GRN on returns: ${res.map((x) => x.apiGrn).join(' / ')}. ${J(res.map((x) => ({ l: x.label, n: x.apiNumber, wh: x.apiWarehouse })))}`, api: 'GET /purchase-returns/{id} vs detail page text', shot: res[1].shot })
}

// T29 — purchase consistency after returns
TESTS.T29 = async (h) => {
  const { page } = h; const s = S(); const pur = s.pur1
  const p = await H.getPurchase(page, pur.id); await H.openReturns(page)
  await page.goto(L.BASE + '/admin/purchases/' + pur.id, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(2500)
  const txt = await bodyText(page); const shot = await H.shot(page, '29-purchase-after-returns')
  const it = p.items[0]
  const ok = it.quantity === 10 && it.received_qty === 10 && p.status === 'confirmed'
  rec({ id: 'T29', name: 'Cross-module Purchase consistency', status: ok ? 'PASS' : 'FAIL', expected: 'Original purchase quantity (10) and received (10) untouched after 3 completed returns; any returned info consistent', actual: `API purchase: status=${p.status}, item quantity=${it.quantity}, received_qty=${it.received_qty}, remaining_qty=${it.remaining_qty}, return_amount=${p.return_amount}, total=${p.total}. Purchase detail page mentions returns: ${/return/i.test(txt)}; page excerpt: ${txt.slice(0, 600)}`, api: `GET /purchases/${pur.id}`, shot })
}

// T30 — inventory consistency (product A full history)
TESTS.T30 = async (h) => {
  const { page } = h; const s = S(); const A = s.prodA
  const st = await H.stock(page, A.id); const mv = await movements(page, A.id)
  await H.B.openDetail(page, A.id); const txt = await bodyText(page); const shotP = await H.shot(page, '30-product-detail-stock')
  await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const box = page.getByPlaceholder(/search/i).first(); await box.fill(A.sku).catch(() => {}); await page.waitForTimeout(2500)
  const invTxt = await bodyText(page); const shot = await H.shot(page, '30-inventory-page')
  const net = mv.reduce((a, m) => a + (Number(m.quantity ?? m.qty ?? m.quantity_change ?? 0) || 0), 0)
  const byType = {}; for (const m of mv) { const k = m.movement_type || m.type || '?'; byType[k] = (byType[k] || 0) + 1 }
  const ids = mv.map((m) => m.id); const dup = ids.length !== new Set(ids).size
  const stockText = (txt.match(/Stock[^|]*\|\s*[^|]*/i) || [''])[0]
  const ok = st.total_inventory === 0 && Object.values(st.warehouses).every((w) => w.on_hand >= 0) && !dup
  rec({ id: 'T30', name: 'Inventory consistency (full reconstruction)', status: ok ? 'PASS' : 'FAIL', expected: 'Opening 0 + purchase +10 - returns 10 = 0 everywhere; no negative; no duplicate movements', actual: `Product API total_inventory=${st.total_inventory}; warehouse stock=${J(st.warehouses)}; /inventory row=${J(st.inventory_row)}; ledger rows for the product=${mv.length} by type ${J(byType)} (net of quantity column=${net}); duplicate ledger ids=${dup}; product detail page text near stock: "${stockText}"; inventory page search "${A.sku}" excerpt: ${invTxt.slice(0, 260)}`, api: 'GET /products/{id}; /warehouses/stock; /inventory; /warehouses/{id}/movements', stock: `final ${st.total_inventory}`, shot })
  H.setState({ ledgerA: mv.map((m) => ({ type: m.movement_type || m.type, qty: m.quantity ?? m.qty, ref: m.reference_type || m.reference || m.source || null })) })
}

// T31 — direct backend over-return protection (incl. concurrent drafts)
TESTS.T31 = async (h) => {
  const { page } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const stat = async () => (await purchaseReturnsOf(page, pur.id)).filter((x) => x.status !== 'cancelled').reduce((a, x) => a + x.total_return_qty, 0)
  const open0 = await stat(); const remaining = 20 - open0; const st0 = await stockOf(page, B.id)
  const over = await H.post(page, '/purchase-returns', body(pur, { [B.id]: remaining + 1 }))
  if (over.status < 300 && over.body && over.body.id) H.track('purchase_return', { id: over.body.id, name: over.body.return_number, purchaseId: pur.id })
  // two open drafts that together exceed the received qty: first takes (remaining-2), second asks 5
  const first = await mkReturn(page, pur, { [B.id]: remaining - 2 }, { notes: 'QA-PR concurrent #1' })
  const second = await mkReturn(page, pur, { [B.id]: 5 }, { notes: 'QA-PR concurrent #2' })
  let c1, c2
  if (first.status < 300) c1 = await act(page, first.body.id, 'confirm')
  if (second.status < 300) c2 = await act(page, second.body.id, 'confirm')
  const st1 = await stockOf(page, B.id); const openAfter = await stat()
  const orig = { over: over.status, first: first.status, second: second.status, c1: c1 && c1.status, c2: c2 && c2.status }
  // cleanup (cancel restores stock)
  for (const r of [first, second]) if (r.status < 300) await act(page, r.body.id, 'cancel', { cancel_reason: 'QA-PR cleanup' })
  const st2 = await stockOf(page, B.id)
  const hard = over.status >= 400
  const concurrentBug = second.status < 300 && openAfter > 20
  rec({ id: 'T31', name: 'Direct backend over-return protection', status: hard && !concurrentBug ? 'PASS' : 'FAIL', expected: 'Backend rejects qty > remaining even with frontend bypassed; open (draft/confirmed) returns together may not exceed received', actual: `Remaining returnable on PUR2 ${remaining}. Direct POST qty ${remaining + 1} -> ${over.status} ${J(over.body).slice(0, 200)}. Concurrent drafts: #1 qty ${remaining - 2} -> ${first.status}; #2 qty 5 (together ${remaining + 3} > ${remaining}) -> ${second.status} ${second.status >= 300 ? J(second.body).slice(0, 160) : ''}; confirm #1 ${c1 && c1.status}, confirm #2 ${c2 && c2.status} ${c2 && c2.status >= 300 ? J(c2.body).slice(0, 160) : ''}. Open+done qty after=${openAfter}; stock ${st0} -> ${st1} -> ${st2} after cleanup`, api: J(orig), stock: `${st0} -> ${st1} (while confirmed) -> ${st2} (cleaned)` })
}

// T32 — product inactive after purchase
TESTS.T32 = async (h) => {
  const { page, net } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const d = await H.patch(page, '/products/' + B.id, { status: 'inactive' }); const prod = await H.B.getProduct(page, B.id)
  await H.openNew(page); await H.pickPurchase(page, pur.number)
  const offered = await H.itemCells(page, new RegExp(B.name)).catch(() => null)
  const shot = await H.shot(page, '32-inactive-product')
  const r = await mkReturn(page, pur, { [B.id]: 1 }, { notes: 'QA-PR inactive product' })
  let conf = null; if (r.status < 300) { conf = await act(page, r.body.id, 'confirm'); await act(page, r.body.id, 'cancel', { cancel_reason: 'QA-PR cleanup' }) }
  const back = await H.patch(page, '/products/' + B.id, { status: 'active' })
  rec({ id: 'T32', name: 'Product inactive after purchase', status: offered && r.status === 201 ? 'PASS' : 'FAIL', expected: 'Historical goods stay returnable even though the product master is inactive', actual: `Product set inactive (PATCH ${d.status}, status now "${prod.status}"). Return form still lists the item: ${J(offered)}. API create return -> ${r.status} ${r.status >= 300 ? J(r.body).slice(0, 160) : ''}; confirm -> ${conf && conf.status}. Product restored to active (PATCH ${back.status})`, api: `POST -> ${r.status}`, shot })
}

// T33 — supplier consistency (tampering)
TESTS.T33 = async (h) => {
  const { page } = h; const s = S(); const B = s.prodB; const pur = s.pur2
  const r = await mkReturn(page, pur, { [B.id]: 1 }, { supplier_id: s.supplier2.id, notes: 'QA-PR supplier tamper' })
  let stored = null
  if (r.status < 300) { stored = await H.getReturn(page, r.body.id); await act(page, r.body.id, 'cancel', { cancel_reason: 'QA-PR cleanup' }) }
  const bogus = await H.post(page, '/purchase-returns', body(pur, { [B.id]: 1 }, { supplier_id: '00000000-0000-0000-0000-000000000000' }))
  if (bogus.status < 300 && bogus.body && bogus.body.id) { H.track('purchase_return', { id: bogus.body.id, name: bogus.body.return_number, purchaseId: pur.id }); await act(page, bogus.body.id, 'cancel', { cancel_reason: 'QA-PR cleanup' }) }
  const derived = stored && stored.supplier_id === pur.supplierId
  rec({ id: 'T33', name: 'Supplier consistency', status: r.status >= 400 || derived ? 'PASS' : 'FAIL', expected: 'Supplier must come from the Purchase: UI has no supplier control; backend rejects or overrides a conflicting supplier_id', actual: `UI supplier field is read-only (T2). API with supplier_id of a different QA supplier -> ${r.status}${stored ? `; stored supplier_id=${stored.supplier_id} (purchase supplier=${pur.supplierId}, tampered=${s.supplier2.id}) -> ${derived ? 'overridden to the purchase supplier' : 'CONFLICTING supplier stored'}` : ' ' + J(r.body).slice(0, 160)}. Non-existent supplier id -> ${bogus.status}`, api: `POST with supplier_id=other -> ${r.status}` })
}

// T34 — warehouse consistency (tampering)
TESTS.T34 = async (h) => {
  const { page } = h; const s = S(); const B = s.prodB; const pur = s.pur2; const W2 = s.otherWarehouse
  const before = await H.stock(page, B.id)
  const r = await mkReturn(page, pur, { [B.id]: 1 }, { warehouse_id: W2.id, notes: 'QA-PR warehouse tamper' })
  let stored = null, conf = null, mid = null
  if (r.status < 300) {
    stored = await H.getReturn(page, r.body.id)
    conf = await act(page, r.body.id, 'confirm'); mid = await H.stock(page, B.id)
    await act(page, r.body.id, 'cancel', { cancel_reason: 'QA-PR cleanup' })
  }
  const after = await H.stock(page, B.id)
  const derived = stored && stored.warehouse_id === s.warehouse.id
  rec({ id: 'T34', name: 'Warehouse consistency', status: r.status >= 400 || derived ? 'PASS' : 'FAIL', expected: 'Return deducts only from the purchase/GRN receiving warehouse; mismatched warehouse_id rejected or ignored', actual: `UI warehouse is read-only. API with warehouse_id=${W2.name} (not the receiving warehouse ${s.warehouse.name}) -> ${r.status}${stored ? `; stored warehouse_id=${stored.warehouse_id} (${stored.warehouse && stored.warehouse.name}) -> ${derived ? 'overridden to receiving warehouse' : 'MISMATCHED WAREHOUSE STORED'}; confirm -> ${conf.status} ${conf.status >= 300 ? J(conf.body).slice(0, 160) : ''}; stock per warehouse during confirm ${J(mid.warehouses)}` : ' ' + J(r.body).slice(0, 160)}. After cleanup warehouses ${J(after.warehouses)} (before ${J(before.warehouses)})`, api: `POST with warehouse_id=W2 -> ${r.status}`, stock: `total ${before.total_inventory} -> ${mid ? mid.total_inventory : '-'} -> ${after.total_inventory}` })
}

// T35 — console / network
TESTS.T35 = async () => {
  const s = S(); const n = s.netlog || []
  const bad = n.filter((x) => x.status >= 500); const c503 = (s.infra503 || [])
  const consoleErr = (s.consolelog || [])
  const bizBad = n.filter((x) => x.status >= 400 && x.status < 500 && !/\/purchase-returns|\/purchases|\/products/.test(x.url))
  rec({ id: 'T35', name: 'Console / network errors', status: bad.length + consoleErr.length + bizBad.length === 0 && c503.length === 0 ? 'PASS' : 'FAIL', expected: 'No uncaught JS errors, no unexpected 4xx/5xx; deliberate 422/4xx probes excluded; 503 recorded as infrastructure', actual: `5xx seen in browser traffic: ${J(bad.slice(0, 6))}; infrastructure 503 retries (API probes): ${c503.length} ${J(c503.slice(0, 6))}; unexpected 4xx on unrelated endpoints: ${J(bizBad.slice(0, 6))}; uncaught console errors: ${consoleErr.length} ${J(consoleErr.slice(0, 5))}`, api: 'network + console capture across the whole run' })
}

// =====================================================================================================
const ORDER = ['T1', 'T2', 'T3', 'T4', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32', 'T33', 'T34', 'T35']
;(async () => {
  const want = process.argv.slice(2); const run = want.length === 0 || want[0] === 'all' ? ORDER : want
  const h = await H.open()
  let seen = 0, seenC = 0
  for (const id of run) {
    const fn = TESTS[id]; if (!fn) { console.log('unknown', id); continue }
    try { await fn(h) } catch (e) {
      console.log('SCRIPT ERROR in', id, e.message.split('\n')[0])
      H.record({ id, name: id + ' (script error)', status: 'BLOCKED', expected: '-', actual: 'Script/selector problem, not an app verdict: ' + e.message.split('\n').slice(0, 2).join(' | ').slice(0, 400), api: '', shot: await H.shot(h.page, 'err-' + id) })
    }
    // collect network + console
    const f = h.net.failures.slice(seen); seen = h.net.failures.length
    const c = (h.net.consoleErrors || []).slice(seenC); seenC = (h.net.consoleErrors || []).length
    const st = H.state()
    H.setState({ netlog: [...(st.netlog || []), ...f.map((x) => ({ ...x, test: id }))], consolelog: [...(st.consolelog || []), ...c.map((x) => ({ test: id, text: String(x.text || x).slice(0, 200) }))] })
  }
  await H.close(h)
})().catch((e) => { console.error('FATAL', e.message.split('\n')[0]); process.exit(1) })
