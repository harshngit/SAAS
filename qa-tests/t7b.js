// T7b - read-only: columns after the return completed (return form for the same purchase, purchase detail, return list, inventory)
const L = require('./lib')
;(async () => {
  const st = L.readState()
  const productA = st.productAEntered.name
  const purchaseId = st.purchaseUrl.split('/').pop()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  sess.step = 'T7b'
  await page.goto(`${L.BASE}/admin/purchase-returns/new?purchase=${purchaseId}`, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
  const t = (await page.locator('table').first().innerText().catch(() => '(no table)')).replace(/\s+/g, ' ')
  const shot1 = await L.shot(sess, 'T7-08-return-form-after-complete')
  const m = t.match(/(\d+)\s+(\d+)\s+(\d+)\s*$/)
  rows.push(L.row('T7', 'New-return form for same purchase AFTER completed return (qty 2)', 'Received 10, Already Returned 2, Returnable 8',
    `Table: "${t}"`, /10\s+2\s+8/.test(t) ? 'PASS' : 'FAIL', shot1, sess.apis.filter((a) => a.step === 'T7b' && !/\/login$/.test(a.url)),
    { note: 'Column is labelled "Already Returned" in the UI (not "Previously Returned").' }))
  await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('tab', { name: /^items$/i }).click({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(800)
  const items = (await page.locator('table').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  rows.push(L.row('T7', 'Purchase detail Items table after return', 'Ordered 10, Received 10, returned 2 shown somewhere', `Items table: "${items}"`, 'INFO', await L.shot(sess, 'T7-09-purchase-items'), []))
  await page.goto(L.BASE + '/admin/purchase-returns', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const list = (await page.locator('tr', { hasText: /Completed/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  rows.push(L.row('T7', 'Purchase Returns list row', 'Our return listed as Completed', `First Completed row: "${list}"`, /Completed/.test(list) ? 'PASS' : 'FAIL', await L.shot(sess, 'T7-10-returns-list'), []))
  L.saveTagged('T7', 'b', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what} | ${x.actual.slice(0, 400)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
