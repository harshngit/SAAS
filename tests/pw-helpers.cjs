// Shared helpers for the Product Creation QA (Playwright library, no app source touched).
// Credentials come from qa-tests/.env.qa.local through the existing QA lib; they are never printed or saved.
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'qa-test', 'product-creation')
fs.mkdirSync(path.join(OUT, 'fixtures'), { recursive: true })
// reuse the existing QA lib (login, selects, labelled fields); point it at the hosted app, recorder off
const ENVFILE = path.join(ROOT, 'qa-tests', '..', '.env.qa.local')
const envText = fs.readFileSync(ENVFILE, 'utf8')
const baseUrl = (envText.match(/QA_BASE_URL\s*=\s*(\S+)/) || [])[1] || 'https://crm-saas.asynk.in'
process.env.QA_LOCAL_URL = baseUrl
process.env.QA_NO_NET = '1'
const L = require(path.join(ROOT, 'qa-tests', 'run-2026-11-16_1450', 'lib.js'))

const STATE_FILE = path.join(OUT, 'state.json')
const RESULTS_FILE = path.join(OUT, 'results.json')
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const state = () => readJson(STATE_FILE, {})
const setState = (p) => { const s = { ...state(), ...p }; fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); return s }
const TS = () => {
  const s = state(); if (s.ts) return s.ts
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  const ts = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
  setState({ ts }); return ts
}

// ---- results
function record(r) {
  const all = readJson(RESULTS_FILE, {})
  all[r.id] = { ...r, at: new Date().toISOString() }
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(all, null, 2))
  console.log(`[${r.status}] ${r.id} ${r.name}`)
  if (r.status !== 'PASS') console.log('     ' + String(r.actual).slice(0, 500))
}
const results = () => readJson(RESULTS_FILE, {})

// ---- created records (cleanup only ever touches what this suite created)
function addCreated(rec) {
  const s = state(); const list = s.created || []
  if (!list.some((x) => x.id === rec.id)) list.push({ ...rec, at: new Date().toISOString() })
  setState({ created: list })
}

// ---- browser session
async function open(role = 'ADMIN') {
  const browser = await L.launch()
  const sess = await L.newSession(browser, role)
  const page = sess.page
  await page.setViewportSize({ width: 1440, height: 1000 })
  const net = { writes: [], failures: [], consoleErrors: sess.consoleErrors, all: [] }
  sess.net = net
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(L.API)) return
    const m = r.method()
    if (m !== 'GET' && /\/products/.test(u)) net.writes.push({ method: m, url: u.replace(L.API, ''), body: r.postData() || '', t: Date.now(), status: null, res: null })
  })
  page.on('response', async (res) => {
    const u = res.url(); if (!u.startsWith(L.API)) return
    const rq = res.request(); const m = rq.method()
    net.all.push({ method: m, url: u.replace(L.API, ''), status: res.status(), step: sess.step })
    if (m !== 'GET' && /\/products/.test(u)) {
      const w = [...net.writes].reverse().find((x) => x.method === m && x.url === u.replace(L.API, '') && x.status === null)
      if (w) { w.status = res.status(); try { w.res = await res.json() } catch { w.res = null } }
    }
    if (res.status() >= 400 && !/\/auth\//.test(u)) net.failures.push({ method: m, url: u.replace(L.API, ''), status: res.status(), step: sess.step })
  })
  const r = await L.login(sess, role)
  if (!r.ok) { await browser.close(); throw new Error('login failed (' + (r.status || 'no response') + ')') }
  return { browser, sess, page, net }
}
async function close(h) {
  try { await L.closeSession(h.sess) } catch (e) { /* ignore */ }
  try { await h.browser.close() } catch (e) { /* ignore */ }
}

// ---- api via the app's own token (the token never leaves the page)
async function api(page, urlPath, init = {}) {
  return page.evaluate(async ({ apiBase, urlPath, init }) => {
    let tok = ''
    for (const store of [localStorage, sessionStorage]) {
      for (const k of Object.keys(store)) {
        try { const j = JSON.parse(store.getItem(k)); const t = j && j.state && j.state.authTokens && j.state.authTokens.access_token; if (t) tok = t } catch (e) { /* not json */ }
      }
    }
    const res = await fetch(apiBase + urlPath, { ...init, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', ...(init.headers || {}) } })
    let body = null; try { body = await res.json() } catch (e) { body = null }
    return { status: res.status, body }
  }, { apiBase: L.API, urlPath, init })
}
const getProduct = async (page, id) => (await api(page, '/products/' + id)).body
async function findProducts(page, search) {
  const r = await api(page, '/products?search=' + encodeURIComponent(search) + '&page_size=100')
  return (r.body && r.body.items) || []
}

async function shot(page, name, full = false) {
  const f = path.join(OUT, name + '.png')
  await page.screenshot({ path: f, fullPage: full }).catch(() => {})
  return 'qa-test/product-creation/' + name + '.png'
}

// ---- product form (wizard: the Add Product / Save Changes button lives on the last tab, Documents)
async function openCreate(page) {
  await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.getByRole('button', { name: /add product/i }).first().click()
  await page.getByText('Product Name').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(800)
}
async function tab(page, title) {
  await page.getByRole('button', { name: title, exact: true }).click({ timeout: 10000 })
  await page.waitForTimeout(350)
}
async function setCheckbox(page, labelRe, on) {
  const cb = page.locator('label', { hasText: labelRe }).locator('input[type=checkbox]').first()
  if ((await cb.isChecked()) !== on) await cb.setChecked(on, { force: true })
}
// custom Select located by its label; optionRe null = first option
async function pickOption(page, label, optionRe) {
  const lab = page.locator('label').filter({ hasText: label }).first()
  const forId = await lab.getAttribute('for', { timeout: 5000 })
  const trig = forId
    ? page.locator('[aria-labelledby="' + forId + '"]:not([type="hidden"]), [aria-controls="' + forId + '-listbox"]').first()
    : lab.locator('[data-select-trigger="true"]').first()
  await trig.scrollIntoViewIfNeeded().catch(() => {})
  await trig.click({ timeout: 6000 })
  const opts = page.getByRole('option'); await opts.first().waitFor({ state: 'visible', timeout: 8000 })
  const texts = (await opts.allInnerTexts()).map((t) => t.trim())
  const idx = optionRe ? texts.findIndex((t) => optionRe.test(t)) : 0
  if (idx < 0) { await page.keyboard.press('Escape'); throw new Error('option ' + optionRe + ' not in [' + texts.join(', ') + '] for ' + label) }
  await opts.nth(idx).click({ timeout: 6000 })
  return texts[idx]
}
async function listOptions(page, label) {
  const lab = page.locator('label').filter({ hasText: label }).first()
  const forId = await lab.getAttribute('for', { timeout: 5000 })
  const trig = forId
    ? page.locator('[aria-labelledby="' + forId + '"]:not([type="hidden"]), [aria-controls="' + forId + '-listbox"]').first()
    : lab.locator('[data-select-trigger="true"]').first()
  await trig.scrollIntoViewIfNeeded().catch(() => {})
  await trig.click({ timeout: 6000 })
  await page.waitForTimeout(700)
  const texts = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  return texts
}
// d: { name, sku, categoryRe, subRe, statusRe, uomRe, purchase, selling, mrp, wholesale, dealer, discount, taxIncl, gst, hsn,
//      openingStock, tracking, hasVariants, extra: { 'Tab title': { Label: value } }, skipCategory }
async function fillForm(page, d) {
  const log = []
  const f = (label, v) => L.fillLabel(page, label, v)
  if (d.name !== undefined) await f('Product Name', d.name)
  if (d.sku !== undefined) await f('Product Code / SKU', d.sku)
  if (d.shortName !== undefined) await f('Short Name', d.shortName)
  if (d.barcode !== undefined) await f('Barcode', d.barcode)
  if (!d.skipCategory) {
    log.push('category=' + await pickOption(page, 'Category', d.categoryRe || null)); await page.waitForTimeout(1200)
    log.push('sub=' + await pickOption(page, 'Sub Category', d.subRe || null)); await page.waitForTimeout(700)
  }
  if (d.status !== false) { try { log.push('status=' + await pickOption(page, 'Product Status', d.statusRe || null)) } catch (e) { log.push('status:' + e.message.split('\n')[0]) } }
  if (d.modelNumber !== undefined) await f('Model Number', d.modelNumber)
  if (d.description !== undefined) await f('Product Description', d.description)
  if (d.manufacturer !== undefined) { try { await f('Manufacturer', d.manufacturer) } catch (e) { log.push('manufacturer-not-typable') } }
  if (d.hasVariants) await setCheckbox(page, /multiple variants/i, true)
  if (d.tracking !== undefined || d.openingStock !== undefined || d.uom !== false) {
    await tab(page, 'Inventory Information')
    if (d.tracking !== undefined) await setCheckbox(page, /^\s*Track inventory\s*$/, d.tracking)
    if (d.uom !== false) {
      try { log.push('uom=' + await pickOption(page, 'Unit of Measure', d.uomRe || /piece/i)) } catch (e) {
        try { log.push('uom=' + await pickOption(page, 'Unit of Measure', null)) } catch (e2) { log.push('uom:' + e2.message.split('\n')[0]) }
      }
    }
    if (d.openingStock !== undefined) await f('Opening Stock', d.openingStock)
  }
  const anyPrice = [d.purchase, d.selling, d.mrp, d.wholesale, d.dealer, d.discount, d.taxIncl].some((x) => x !== undefined)
  if (anyPrice || !d.hasVariants) await tab(page, 'Pricing Information')
  const price = [['Purchase Price', d.purchase], ['Selling Price', d.selling], ['MSRP/MRP', d.mrp], ['Wholesale Price', d.wholesale], ['Dealer Price', d.dealer], ['Discount (%)', d.discount]]
  for (const [l, v] of price) if (v !== undefined) await f(l, v)
  if (d.taxIncl !== undefined) await setCheckbox(page, /^\s*Tax Inclusive Price\s*$/, d.taxIncl)
  if (d.gst !== undefined || d.hsn !== undefined) {
    await tab(page, 'Tax Information')
    if (d.gst !== undefined) await f('GST/VAT Rate', d.gst)
    if (d.hsn !== undefined) await f('HSN/SAC Code', d.hsn)
  }
  for (const [t, fields] of Object.entries(d.extra || {})) {
    await tab(page, t)
    for (const [l, v] of Object.entries(fields)) { try { await f(l, v) } catch (e) { log.push('extra ' + l + ': ' + e.message.split('\n')[0]) } }
  }
  return log
}
const safeJson = (s) => { try { return JSON.parse(s) } catch (e) { return s } }
// click "Add Product" (last tab) / "Save Changes" and capture the write call
async function submit(page, net, { label = /^add product$/i, wait = 14000 } = {}) {
  await tab(page, 'Documents')
  await L.startToastWatch(page)
  const n0 = net.writes.length
  await page.getByRole('button', { name: label }).last().click({ timeout: 10000 })
  const end = Date.now() + wait
  while (Date.now() < end && !(net.writes.length > n0 && net.writes[net.writes.length - 1].status !== null)) await page.waitForTimeout(250)
  await page.waitForTimeout(1500)
  const w = net.writes.slice(n0)
  const last = w[w.length - 1]
  const toast = await L.readToasts(page)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 500)
  const fieldErrors = await page.evaluate(() => Array.from(document.querySelectorAll('p.text-red-600, p.text-red-500, p.text-xs.text-red-600')).map((e) => e.innerText.trim()).filter(Boolean))
  return { writes: w.length, posts: w.filter((x) => x.method === 'POST').length, status: last ? last.status : null, req: last && last.body ? safeJson(last.body) : null, res: last ? last.res : null, toast, banner, fieldErrors }
}
async function detailText(page) { return (await page.locator('main').first().innerText().catch(() => '')).replace(/\n+/g, ' | ') }
async function openDetail(page, id) {
  await page.goto(L.BASE + '/admin/products/' + id, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1800)
}
const n2 = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

module.exports = { L, fs, path, ROOT, OUT, BASE: L.BASE, state, setState, TS, record, results, addCreated, open, close, api, getProduct, findProducts, shot, openCreate, tab, setCheckbox, pickOption, listOptions, fillForm, submit, detailText, openDetail, safeJson, n2 }
