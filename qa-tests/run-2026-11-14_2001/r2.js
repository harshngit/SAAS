// R2 Dashboard: green card must always be TODAY'S SALES, unaffected by Period / Customer filters,
// and match GET /dashboard/admin -> today_overall. Read-only.
const L = require('./lib')

const nums = (text) => (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((t) => Number(t.replace(/,/g, '')))

;(async () => {
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const dash = [] // every /dashboard/admin response: { url, status, today_overall }
  page.on('response', async (res) => {
    if (!res.url().startsWith(L.API) || !/\/dashboard\/admin/.test(res.url()) || res.request().method() !== 'GET') return
    let body = null
    try { body = await res.json() } catch { /* ignore */ }
    dash.push({ url: res.url().replace(L.API, ''), status: res.status(), today: body && body.today_overall ? body.today_overall : null, hasKey: !!(body && 'today_overall' in body) })
  })
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('R2', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('R2', rows); await browser.close(); return }

  const card = page.locator('button[aria-label="View sales orders"]').first()
  const readCard = async () => (await card.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
  const applyAndWait = async (label) => {
    const before = dash.length
    await page.getByRole('button', { name: /^apply$/i }).click({ timeout: 5000 })
    for (let i = 0; i < 60 && dash.length === before; i++) await page.waitForTimeout(500)
    await L.settle(page, 12000)
    await page.waitForTimeout(1500)
    return dash.length > before
  }

  sess.step = 'R2 load'
  await page.goto(L.BASE + '/admin/dashboard', { waitUntil: 'domcontentloaded' })
  await L.settle(page, 12000)
  await card.waitFor({ state: 'visible', timeout: 25000 })
  await page.waitForTimeout(2000)
  const base = await readCard()
  const shot0 = await L.shot(sess, 'R2-card-default')
  const first = dash[0]
  const t = first && first.today
  // ---- label + values vs today_overall
  const labelOk = /today.?s sales/i.test(base) && !/selected period/i.test(base)
  let match = false, detail = ''
  if (t) {
    const cardNums = nums(base)
    const expect = { sales: Number(t.sales), received: Number(t.received), orders: Number(t.orders), delivered_orders: Number(t.delivered_orders), pending_orders: Number(t.pending_orders), pending_amount: Number(t.pending_amount) }
    const missing = Object.entries(expect).filter(([, v]) => !cardNums.some((n) => Math.abs(n - v) < 0.51)).map(([k, v]) => `${k}=${v}`)
    match = missing.length === 0
    detail = `today_overall=${JSON.stringify({ date: t.date, ...expect })}; card numbers=[${cardNums.join(', ')}]; missing on card: ${missing.join(', ') || 'none'}`
  } else {
    detail = `today_overall ${first && first.hasKey ? 'present but null' : 'NOT in /dashboard/admin response'} (status ${first ? first.status : 'no response'}). Card text: "${base}"`
  }
  rows.push(L.row('R2', 'Default load: card label + numbers vs /dashboard/admin today_overall', 'Label "TODAY\'S SALES"; Sales, Received, Pending amount, Orders, Delivered, Pending count equal today_overall',
    `Card: "${base}". ${detail}`, labelOk && match ? 'PASS' : 'FAIL', shot0, [],
    labelOk && match ? {} : { classification: t ? 'Frontend' : 'Backend', cause: t ? 'src/features/dashboard/AdminDashboard.jsx FeaturedSalesCard' : 'GET /dashboard/admin did not return today_overall' }))

  // ---- Period = Last Month
  sess.step = 'R2 period'
  let err = ''
  try { await L.selectByLabel(page, 'Period', 'Last Month') } catch (e) { err = String(e.message).split('\n')[0] }
  const gotA = err ? false : await applyAndWait('period')
  const afterPeriod = await readCard()
  const shot1 = await L.shot(sess, 'R2-card-last-month')
  const periodResp = dash[dash.length - 1]
  rows.push(L.row('R2', 'Period = Last Month, Apply', 'Card text identical to default (and /dashboard/admin was re-fetched with the period)',
    err ? `Could not drive filter: ${err}` : `before="${base}" after="${afterPeriod}" same=${base === afterPeriod}; re-fetched=${gotA}; request=${periodResp ? periodResp.url : '?'}`,
    err ? 'FAIL' : (base === afterPeriod && gotA ? 'PASS' : 'FAIL'), shot1, [],
    base !== afterPeriod ? { classification: 'Frontend', cause: 'src/features/dashboard/AdminDashboard.jsx FeaturedSalesCard / todayOverall' } : {}))

  // ---- Customer filter
  sess.step = 'R2 customer'
  err = ''
  let picked = ''
  try {
    picked = await L.selectFirstByLabel(page, 'Customer')
    await page.keyboard.press('Escape').catch(() => {})
  } catch (e) { err = String(e.message).split('\n')[0] }
  const gotB = err ? false : await applyAndWait('customer')
  const afterCustomer = await readCard()
  const shot2 = await L.shot(sess, 'R2-card-customer')
  const custResp = dash[dash.length - 1]
  const sameToday = dash.filter((d) => d.today).every((d) => JSON.stringify(d.today) === JSON.stringify(dash.find((x) => x.today).today))
  rows.push(L.row('R2', 'Customer filter (first customer) + Apply', 'Card text identical to default; today_overall identical in every response',
    err ? `Could not drive filter: ${err}` : `picked="${picked.slice(0, 40)}" before="${base}" after="${afterCustomer}" same=${base === afterCustomer}; re-fetched=${gotB}; request=${custResp ? custResp.url : '?'}; today_overall identical in all ${dash.length} responses=${sameToday}`,
    err ? 'FAIL' : (base === afterCustomer && gotB && sameToday ? 'PASS' : 'FAIL'), shot2, [],
    base !== afterCustomer ? { classification: 'Frontend', cause: 'src/features/dashboard/AdminDashboard.jsx FeaturedSalesCard' } : {}))

  L.saveResults('R2', rows)
  L.writeState({ r2Dash: dash.map((d) => ({ url: d.url, status: d.status, today: d.today })) })
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 600)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
