// T2 Dashboard green sales card vs Period filter (read-only)
const L = require('./lib')

;(async () => {
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('T2', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('T2', rows); await browser.close(); return }

  sess.step = 'T2 dashboard load'
  await page.goto(L.BASE + '/admin/dashboard', { waitUntil: 'domcontentloaded' })
  await L.settle(page, 12000)
  const card = page.locator('button[aria-label="View sales orders"]').first()
  await card.waitFor({ state: 'visible', timeout: 20000 })
  const before = (await card.innerText()).replace(/\s+/g, ' ').trim()
  const shotA = await L.shot(sess, 'T2-green-card-default')
  const defaultInfo = await page.locator('text=/Showing:/').first().innerText().catch(() => '')

  sess.step = 'T2 period=Last Month'
  const startApi = sess.apis.length
  let periodErr = ''
  try {
    await L.selectByLabel(page, 'Period', 'Last Month')
    const dashResp = page.waitForResponse((x) => /\/dashboard\/admin/.test(x.url()) && x.request().method() === 'GET', { timeout: 30000 }).catch(() => null)
    await page.getByRole('button', { name: /^apply$/i }).click({ timeout: 5000 })
    const dr = await dashResp
    if (dr) { sess.lastDashUrl = dr.url().replace(L.API, ''); sess.lastDashStatus = dr.status() }
    await L.settle(page, 12000)
  } catch (e) { periodErr = String(e.message).split('\n')[0] }
  // the card re-renders after the API response; poll until its text differs (or 20s) instead of reading once
  let after = before
  for (let i = 0; i < 40 && after === before; i++) {
    await page.waitForTimeout(500)
    after = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
  }
  const shotB = await L.shot(sess, 'T2-green-card-last-month')
  const showing = await page.locator('text=/Showing:/').first().innerText().catch(() => '')
  const apis = sess.apis.slice(startApi)

  const changed = before !== after
  rows.push(L.row('T2', 'Read green card on default load', 'Shows TODAY sales', `Card text: "${before}". Filter line: "${defaultInfo.slice(0, 120)}"`, 'PASS', shotA, []))
  rows.push(L.row('T2', 'Period = Last Month, Apply', 'Green card must NOT change (client: always TODAY sales only)',
    periodErr ? `Could not drive filter: ${periodErr}` : `Card before: "${before}" | after: "${after}" | changed=${changed}. Filter line: "${showing.slice(0, 140)}". API: ${sess.lastDashUrl || '?'} -> ${sess.lastDashStatus || '?'}`,
    periodErr ? 'FAIL' : (changed ? 'FAIL' : 'PASS'), shotB, apis,
    { classification: changed ? 'Frontend (client rule violated by design: card switches to "Selected Period Sales")' : '', cause: changed ? 'src/features/dashboard/AdminDashboard.jsx:809 scopedSales, :987 salesAmount={scopedSales ? periodSales : todaysSalesAmount}, label switch in FeaturedSalesCard :331' : '' }))
  L.saveResults('T2', rows)
  await L.closeSession(sess)
  await browser.close()
  console.log(rows.map((x) => `${x.what}: ${x.status}\n  ${x.actual}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
