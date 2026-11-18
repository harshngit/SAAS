// Shared helpers for the Purchase Return QA. No application source is touched.
// Reuses the existing QA lib (login / launch) via pw-helpers.cjs; adds Purchase Return specific state + API wrappers.
const fs = require('fs')
const path = require('path')
const B = require('./pw-helpers.cjs')
const { L } = B
const ROOT = B.ROOT
const OUT = path.join(ROOT, 'qa-test', 'purchase-return')
fs.mkdirSync(OUT, { recursive: true })
const STATE_FILE = path.join(OUT, 'state.json')
const RESULTS_FILE = path.join(OUT, 'results.json')
const rj = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const state = () => rj(STATE_FILE, {})
const setState = (p) => { const s = { ...state(), ...p }; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); return s }
const TS = () => {
  const s = state(); if (s.ts) return s.ts
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  const ts = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
  setState({ ts }); return ts
}
function record(r) {
  const all = rj(RESULTS_FILE, {})
  all[r.id] = { ...r, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(all, null, 2))
  console.log(`[${r.status}] ${r.id} ${r.name}`)
  if (r.status !== 'PASS') console.log('     ' + String(r.actual).slice(0, 600))
}
const results = () => rj(RESULTS_FILE, {})
// every record created by this suite is tracked here (cleanup + report only ever touch these)
function track(kind, rec) {
  const s = state(); const list = s.created || []
  if (!list.some((x) => x.kind === kind && x.id === rec.id)) list.push({ kind, ...rec, at: new Date().toISOString() })
  setState({ created: list })
}
async function shot(page, name, full = false) {
  const f = path.join(OUT, name + '.png')
  await page.screenshot({ path: f, fullPage: full }).catch(() => {})
  return 'qa-test/purchase-return/' + name + '.png'
}

// Retry only on the infrastructure 503 (recorded separately, never counted as a business-logic result).
async function api(page, urlPath, init = {}, { retry503 = true } = {}) {
  let r
  for (let i = 0; i < 4; i++) {
    r = await B.api(page, urlPath, init)
    if (r.status === 503 && retry503) {
      const s = state(); setState({ infra503: [...(s.infra503 || []), { at: new Date().toISOString(), method: init.method || 'GET', path: urlPath.split('?')[0], attempt: i + 1 }] })
      await page.waitForTimeout(6000); continue
    }
    break
  }
  return r
}
const post = (page, p, body, o) => api(page, p, { method: 'POST', body: JSON.stringify(body) }, o)
const patch = (page, p, body, o) => api(page, p, { method: 'PATCH', body: JSON.stringify(body) }, o)

// ---- domain readers
async function stock(page, productId) {
  const p = (await api(page, '/products/' + productId)).body || {}
  const ws = await api(page, '/warehouses/stock?product_id=' + productId + '&page_size=100')
  const rows = (ws.body && (ws.body.items || ws.body)) || []
  const wh = {}
  for (const r of Array.isArray(rows) ? rows : []) { const k = r.warehouse_id || r.warehouseId || r.warehouse || 'x'; wh[k] = { on_hand: r.on_hand, reserved: r.reserved, available: r.available } }
  const inv = await api(page, '/inventory?search=' + encodeURIComponent(p.sku || p.name || '') + '&page_size=20')
  const irow = ((inv.body && inv.body.items) || []).find((x) => (x.id || x.product_id) === productId) || null
  return { total_inventory: p.total_inventory, total_stock: p.total_stock, product_status: p.status, inventory_row: irow ? { available: irow.available ?? irow.available_stock ?? irow.stock ?? null, keys: Object.keys(irow).join(',') } : null, warehouses: wh }
}
const getReturn = async (page, id) => (await api(page, '/purchase-returns/' + id)).body
async function listReturns(page, qs = '') { const r = await api(page, '/purchase-returns?page_size=100' + (qs ? '&' + qs : '')); return r.body || { items: [], total: 0 } }
const getPurchase = async (page, id) => (await api(page, '/purchases/' + id)).body

// ---- UI helpers
async function openReturns(page) { await page.goto(L.BASE + '/admin/purchase-returns', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500) }
async function openNew(page) { await page.goto(L.BASE + '/admin/purchase-returns/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1200) }
async function openReturn(page, id) { await page.goto(L.BASE + '/admin/purchase-returns/' + id, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500) }
async function pickPurchase(page, number) {
  const box = page.getByPlaceholder(/search purchase/i)
  await box.fill(number)
  const opt = page.locator('button', { hasText: number }).first()
  await opt.waitFor({ state: 'visible', timeout: 12000 })
  await opt.click()
  await page.waitForTimeout(2500)
}
async function itemRow(page, productRe) { return page.locator('tbody tr', { hasText: productRe }).first() }
async function itemCells(page, productRe) {
  const row = await itemRow(page, productRe)
  const tds = await row.locator('td').allInnerTexts()
  return { product: (tds[0] || '').replace(/\s+/g, ' ').trim(), received: Number(tds[1]), already: Number(tds[2]), returnable: Number(tds[3]) }
}
async function setQtyUI(page, productRe, value) {
  const row = await itemRow(page, productRe)
  const inp = row.locator('input').first()
  await inp.click(); await inp.fill(''); if (value !== '') await inp.type(String(value), { delay: 40 })
  await page.waitForTimeout(300)
  return inp.inputValue()
}
async function selectReason(page, re) {
  const lab = page.locator('label').filter({ hasText: /Return Reason/ }).first()
  const forId = await lab.getAttribute('for')
  const trig = forId ? page.locator('[aria-labelledby="' + forId + '"]:not([type="hidden"]), [aria-controls="' + forId + '-listbox"]').first() : lab.locator('[data-select-trigger="true"]').first()
  await trig.click(); const opts = page.getByRole('option'); await opts.first().waitFor({ state: 'visible', timeout: 8000 })
  const texts = (await opts.allInnerTexts()).map((t) => t.trim()); const i = texts.findIndex((t) => re.test(t))
  if (i < 0) throw new Error('reason not found in ' + texts.join('|'))
  await opts.nth(i).click(); return texts[i]
}
async function reasonOptions(page) {
  const lab = page.locator('label').filter({ hasText: /Return Reason/ }).first()
  const forId = await lab.getAttribute('for')
  const trig = forId ? page.locator('[aria-labelledby="' + forId + '"]:not([type="hidden"]), [aria-controls="' + forId + '-listbox"]').first() : lab.locator('[data-select-trigger="true"]').first()
  await trig.click(); await page.waitForTimeout(600)
  const texts = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
  await page.keyboard.press('Escape'); await page.waitForTimeout(250); return texts
}
// Click "Create Draft Return" and capture the POST /purchase-returns call(s)
async function submitDraft(page, net, { wait = 14000, button = /create draft return/i } = {}) {
  await L.startToastWatch(page)
  const n0 = net.prWrites.length
  await page.getByRole('button', { name: button }).last().click({ timeout: 10000 })
  const end = Date.now() + wait
  while (Date.now() < end && !(net.prWrites.length > n0 && net.prWrites[net.prWrites.length - 1].status !== null)) await page.waitForTimeout(250)
  await page.waitForTimeout(1800)
  const w = net.prWrites.slice(n0); const last = w[w.length - 1]
  const toast = await L.readToasts(page)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 500)
  return { writes: w.length, posts: w.filter((x) => x.method === 'POST').length, status: last ? last.status : null, req: last && last.body ? B.safeJson(last.body) : null, res: last ? last.res : null, toast, banner, url: page.url() }
}
// attach a purchase-returns write recorder (open() only records /products writes)
function recordPR(h) {
  const { page, net } = h
  net.prWrites = []
  page.on('request', (r) => {
    const u = r.url(); if (!u.startsWith(L.API)) return
    if (r.method() !== 'GET' && /\/purchase-returns|\/purchases|\/grns/.test(u)) net.prWrites.push({ method: r.method(), url: u.replace(L.API, ''), body: r.postData() || '', t: Date.now(), status: null, res: null })
  })
  page.on('response', async (res) => {
    const u = res.url(); if (!u.startsWith(L.API)) return
    const m = res.request().method()
    if (m !== 'GET' && /\/purchase-returns|\/purchases|\/grns/.test(u)) {
      const w = [...net.prWrites].reverse().find((x) => x.method === m && x.url === u.replace(L.API, '') && x.status === null)
      if (w) { w.status = res.status(); try { w.res = await res.json() } catch { w.res = null } }
    }
  })
}
async function open() { const h = await B.open(); recordPR(h); return h }
const close = B.close

module.exports = { B, L, fs, path, ROOT, OUT, BASE: L.BASE, state, setState, TS, record, results, track, shot, api, post, patch, stock, getReturn, listReturns, getPurchase, openReturns, openNew, openReturn, pickPurchase, itemRow, itemCells, setQtyUI, selectReason, reasonOptions, submitDraft, open, close }
