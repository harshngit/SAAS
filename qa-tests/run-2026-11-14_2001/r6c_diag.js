// Diagnostic for R6c: what invoice_date does the frontend actually SEND? The POST is captured and aborted -> nothing is saved.
const L = require('./lib')
const H = require('./h')
;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  let body = null
  await page.route('**/supplier-invoices', async (route) => {
    if (route.request().method() === 'POST') { body = route.request().postData(); await route.abort() } else await route.continue()
  })
  await page.goto(L.BASE + '/admin/supplier-invoices/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
  await L.selectByLabel(page, 'Supplier', stamp, { exact: false })
  await page.waitForTimeout(1500)
  await L.fillLabel(page, 'Supplier Invoice Number', `QA-TEST-DIAG-${stamp.slice(-4)}`)
  await L.selectByLabel(page, 'Purchase Reference', st.purchaseNo || 'PO-', { exact: false })
  await page.waitForTimeout(1500)
  const inv = await H.pickDay(page, 'Invoice Date', 10)
  const due = await H.pickDay(page, 'Due Date', 20)
  await page.getByRole('button', { name: /^save draft$/i }).click({ timeout: 8000 })
  await page.waitForTimeout(2500)
  let parsed = {}
  try { parsed = JSON.parse(body || '{}') } catch { /* ignore */ }
  const out = { picked: { inv: inv.iso, due: due.iso }, sent: { invoice_date: parsed.invoice_date, due_date: parsed.due_date }, rawKeys: Object.keys(parsed) }
  console.log(JSON.stringify(out))
  L.writeState({ r6cDiag: out })
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 3).join(' | ')); process.exit(1) })
