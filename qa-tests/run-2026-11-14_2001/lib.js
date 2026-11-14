// Shared helpers for the QA suite. Lives ONLY in qa-tests\. Never prints credentials.
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const DIR = __dirname
const SHOTS = path.join(DIR, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

// ---------- env (values stay in memory, never logged) ----------
function loadEnv() {
  const file = path.join(DIR, '..', '..', '.env.qa.local')
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return env
}
const ENV = loadEnv()
const BASE = (process.env.QA_LOCAL_URL || 'http://localhost:5173').replace(/\/$/, '') // retest = local dev server; backend (QA_API_URL) stays the live one
const API = (ENV.QA_API_URL || '').replace(/\/$/, '')
const ROLES = ['ADMIN', 'SALES', 'ACCOUNTANT', 'DELIVERY', 'SUPERADMIN']
function creds(role) {
  return { email: ENV[`QA_${role}_EMAIL`], password: ENV[`QA_${role}_PASSWORD`] }
}

// ---------- persistent state (stamp + ids created, shared across scripts) ----------
const STATE_FILE = path.join(DIR, 'state.json')
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return {} }
}
function writeState(patch) {
  const s = { ...readState(), ...patch }
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
  return s
}
function stamp() {
  let s = readState()
  if (!s.stamp) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    s = writeState({ stamp: `QA-TEST-${p(d.getDate())}${p(d.getMonth() + 1)}-${p(d.getHours())}${p(d.getMinutes())}` })
  }
  return s.stamp
}
function addCreated(kind, name, extra = {}) {
  const s = readState()
  const list = s.created || []
  list.push({ kind, name, ...extra, at: new Date().toISOString() })
  writeState({ created: list })
}

// ---------- results ----------
const RESULTS_FILE = path.join(DIR, 'results.json')
function readResults() {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) } catch { return [] }
}
// Replace all rows of a test id (so re-running a test does not duplicate), keep others.
function saveResults(testId, rows) {
  const all = readResults().filter((r) => r.test !== testId)
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([...all, ...rows], null, 2))
}

// several scripts can contribute rows to one test id (T6a, T6b...): replace only rows with the same tag
function saveTagged(testId, tag, rows) {
  const all = readResults().filter((r) => !(r.test === testId && r.tag === tag))
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([...all, ...rows.map((r) => ({ ...r, tag }))], null, 2))
}

// ---------- browser ----------
async function launch() {
  const opts = { headless: false, slowMo: 250 }
  try { return await chromium.launch({ ...opts, channel: 'chrome' }) } catch (e1) {
    try { return await chromium.launch({ ...opts, channel: 'msedge' }) } catch { throw e1 }
  }
}

// A session = one context + page + recorders.
async function newSession(browser, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const sess = { label, context, page, step: 'start', apis: [], consoleErrors: [] }
  page.on('response', async (res) => {
    const status = res.status()
    if (status < 400) return
    const req = res.request()
    const url = res.url()
    let body = ''
    // never capture bodies of auth endpoints (could carry tokens)
    if (!/\/auth\/|login|token/i.test(url)) {
      try { body = (await res.text()).slice(0, 500) } catch { /* ignore */ }
    }
    // the hosting-level `403 GET <base>/login` noise is recorded too, just tagged by step
    sess.apis.push({ step: sess.step, method: req.method(), url, status, body })
  })
  page.on('console', (m) => {
    if (m.type() === 'error') sess.consoleErrors.push({ step: sess.step, text: m.text().slice(0, 400) })
  })
  page.on('pageerror', (e) => sess.consoleErrors.push({ step: sess.step, text: `pageerror: ${String(e.message).slice(0, 400)}` }))
  return sess
}

async function login(sess, role) {
  const { page } = sess
  const { email, password } = creds(role)
  sess.step = 'login'
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  const respP = page.waitForResponse((r) => /login/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null)
  await page.getByRole('button', { name: /sign in/i }).click()
  const resp = await respP
  const deadline = Date.now() + 25000
  while (Date.now() < deadline && page.url().includes('/login')) await page.waitForTimeout(300)
  const ok = !page.url().includes('/login')
  if (ok) {
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    await settle(page)
  }
  let pageError = ''
  if (!ok) pageError = await page.locator('[role="alert"], .text-red-600, .text-red-700').first().innerText().catch(() => '')
  return { ok, status: resp ? resp.status() : null, url: page.url(), pageError }
}

// wait for network to go quiet (bounded) and skeletons to leave
async function settle(page, ms = 8000) {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {})
  await page.locator('.animate-pulse').first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {})
}

async function shot(sess, name) {
  const file = path.join(SHOTS, `${name}.png`)
  await sess.page.screenshot({ path: file, fullPage: false }).catch(() => {})
  return `shots\\${name}.png`
}

async function closeSession(sess) {
  // The UI Logout click was unreliable on this app, so end the session by clearing storage.
  try { await sess.context.clearCookies() } catch { /* ignore */ }
  try { await sess.page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }) } catch { /* ignore */ }
  await sess.context.close().catch(() => {})
}

// Custom Select (components/ui/Select.jsx): label is a sibling with htmlFor=id; the visible trigger
// carries aria-labelledby=id; options render as role=option in a portaled listbox.
async function selectByLabel(page, labelText, optionText, { exact = false } = {}) {
  const label = page.locator('label').filter({ hasText: labelText }).first()
  const forId = await label.getAttribute('for', { timeout: 5000 })
  // layout A: sibling label with htmlFor; layout B: label wraps the trigger (dashboard filter bar)
  const trigger = forId
    ? page.locator(`[aria-labelledby="${forId}"]:not([type="hidden"]), [aria-controls="${forId}-listbox"]`).first()
    : label.locator('[data-select-trigger="true"], [role="combobox"], [role="button"]').first()
  await trigger.click({ timeout: 5000 })
  const opt = page.getByRole('option', { name: exact ? optionText : new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first()
  await opt.click({ timeout: 5000 })
}

// components/ui/Input.jsx: <label> is a sibling BEFORE the <input>/<textarea> (no htmlFor), so take the
// first visible non-hidden input/textarea that follows the label in document order.
function fieldByLabel(root, labelText, { exact = false } = {}) {
  const t = labelText.replace(/"/g, '')
  const lab = exact ? `normalize-space(.)="${t}" or normalize-space(.)="${t} *"` : `starts-with(normalize-space(.), "${t}")`
  return root.locator(`xpath=(//label[${lab}]/following::*[(self::input and not(@type="hidden")) or self::textarea][1])`).first()
}
async function fillLabel(root, labelText, value, opts) {
  const el = fieldByLabel(root, labelText, opts)
  await el.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
  try { await el.fill(String(value), { timeout: 8000 }) } catch (e) { throw new Error(`could not fill field "${labelText}": ${String(e.message).split('\n')[0]}`) }
}
// pick the n-th (default first) option of a labelled Select
async function selectFirstByLabel(page, labelText, n = 0) {
  const label = page.locator('label').filter({ hasText: labelText }).first()
  const forId = await label.getAttribute('for', { timeout: 5000 })
  const trigger = forId ? page.locator(`[aria-labelledby="${forId}"]:not([type="hidden"]), [aria-controls="${forId}-listbox"]`).first() : label.locator('[data-select-trigger="true"]').first()
  await trigger.scrollIntoViewIfNeeded().catch(() => {})
  await trigger.click({ timeout: 5000 })
  const opts = page.getByRole('option')
  await opts.first().waitFor({ state: 'visible', timeout: 5000 })
  const text = (await opts.nth(n).innerText()).trim()
  await opts.nth(n).click({ timeout: 5000 })
  return text
}
// best-effort read of an on-screen toast / success banner
async function toastText(page, ms = 8000) {
  const sel = '[role="status"], [role="alert"], [data-sonner-toast], [class*="toast" i], [class*="Toastify"]'
  const end = Date.now() + ms
  while (Date.now() < end) {
    const t = (await page.locator(sel).allInnerTexts().catch(() => [])).map((x) => x.trim()).filter(Boolean).join(' || ')
    if (t) return t.slice(0, 300)
    await page.waitForTimeout(250)
  }
  return ''
}

// Toasts live 3.5s (components/ui/Toast.jsx, role="status"). Polling can miss them (slowMo + slow POSTs),
// so record every added role=status/alert node with a MutationObserver and read the log afterwards.
async function startToastWatch(page) {
  await page.evaluate(() => {
    window.__qaToasts = []
    if (window.__qaToastObs) window.__qaToastObs.disconnect()
    window.__qaToastObs = new MutationObserver(() => {
      document.querySelectorAll('[role="status"], [role="alert"]').forEach((n) => {
        const t = (n.innerText || '').trim().replace(/\s+/g, ' ')
        if (t && !window.__qaToasts.includes(t)) window.__qaToasts.push(t)
      })
    })
    window.__qaToastObs.observe(document.body, { childList: true, subtree: true, characterData: true })
  }).catch(() => {})
}
async function readToasts(page) {
  const all = await page.evaluate(() => window.__qaToasts || []).catch(() => [])
  // loader placeholders are role=status too - they are not messages
  return all.filter((t) => !(/loading/i.test(t) && !/(saved|confirmed|created|updated|success|dispatched|completed|cancel|deleted|added)/i.test(t))).join(' || ').slice(0, 400)
}

// small solid-colour PNG for image upload fields (created inside qa-tests only)
function ensureTestPng() {
  const file = path.join(DIR, 'qa-test-image.png')
  if (fs.existsSync(file)) return file
  const zlib = require('zlib')
  const W = 120, H = 120
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0
    for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = 30; raw[o + 1] = 140 + (x % 60); raw[o + 2] = 60 + (y % 80) }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
  return file
}

// Row builder
function row(test, what, expected, actual, status, screenshot = '', apis = [], extra = {}) {
  return { test, what, expected, actual, status, screenshot, failedApis: apis, ...extra }
}
const apiLine = (a) => `${a.method} ${a.url.replace(API, '')} -> ${a.status}`

module.exports = {
  ENV, BASE, API, ROLES, creds, stamp, readState, writeState, addCreated,
  selectByLabel, fieldByLabel, fillLabel, selectFirstByLabel, ensureTestPng, toastText, startToastWatch, readToasts, saveResults, saveTagged, readResults, launch, newSession, login, settle, shot, closeSession, row, apiLine, DIR,
}
