// diagnostic: what request does each History header click send and what order comes back? (read-only)
const L = require('./lib')
;(async () => {
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const log = []
  page.on('response', async (res) => {
    if (!res.url().startsWith(L.API) || !/\/vehicle-stock\/history/.test(res.url())) return
    let j = null; try { j = await res.json() } catch { /* ignore */ }
    log.push({ url: res.url().replace(L.API, ''), status: res.status(), items: (j?.items || []).map((x) => `${String(x.date).slice(0, 16)}|${x.vehicle_number}|${x.driver_name}|${x.status}`) })
  })
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  await page.goto(L.BASE + '/admin/vehicle-stock', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(2500)
  const t = page.locator('table').nth(1)
  for (const col of ['Date', 'Date', 'Date', 'Vehicle No', 'Vehicle No', 'Driver Name', 'Status', 'Status']) {
    const n0 = log.length
    await t.locator('thead th', { hasText: col }).first().click()
    await page.waitForTimeout(2500)
    const l = log.slice(n0)
    console.log(`click ${col}:`, l.length ? l.map((x) => x.url + ' -> ' + x.status).join(' ; ') : 'NO REQUEST')
    if (l.length) console.log('   order:', l[l.length - 1].items.join('  ||  '))
    const shown = (await t.locator('tbody tr').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').slice(0, 40))
    console.log('   screen:', shown.join('  ||  '))
  }
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 3).join(' | ')); process.exit(1) })
