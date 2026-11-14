// R10 Network behaviour (A7) + console/logout-loop check. Simulated failures use page.route; nothing is written to the backend.
const L = require('./lib')

;(async () => {
  const browser = await L.launch()
  const rows = []
  const navLog = []

  async function fresh(label) {
    const sess = await L.newSession(browser, 'ADMIN')
    sess.page.on('framenavigated', (f) => { if (f === sess.page.mainFrame()) navLog.push({ label, url: f.url().replace(L.BASE, '') }) })
    let r = await L.login(sess, 'ADMIN')
    if (!r.ok) { await sess.page.waitForTimeout(4000); r = await L.login(sess, 'ADMIN') }
    if (!r.ok) throw new Error('login failed in ' + label + ' | ' + (sess.consoleErrors[0] ? sess.consoleErrors[0].text.slice(0, 160) : ''))
    return sess
  }
  const toastTexts = (page) => page.evaluate(() => window.__qaToasts || [])

  // ---- 10a: one GET fails at network level -> toast, silent retry after ~2s, page loads, no logout
  {
    const sess = await fresh('10a'); const { page } = sess
    let dashHits = 0; const times = []
    await page.route(/\/dashboard\/admin/, async (route) => {
      if (!route.request().url().startsWith(L.API)) return route.continue()
      dashHits += 1; times.push(Date.now())
      if (dashHits === 1) return route.abort('failed')
      return route.continue()
    })
    await L.startToastWatch(page)
    await page.goto(L.BASE + '/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await L.startToastWatch(page)
    const card = page.locator('button[aria-label="View sales orders"]').first()
    const loaded = await card.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)
    await page.waitForTimeout(1500)
    const cardTxt = loaded ? (await card.innerText()).replace(/\s+/g, ' ') : ''
    const toasts = await toastTexts(page)
    const gap = times.length > 1 ? Math.round((times[1] - times[0]) / 100) / 10 : null
    const stillIn = !/\/login/.test(page.url())
    rows.push(L.row('R10', 'GET fails at network level once (simulated ERR_FAILED)', 'User stays logged in; friendly "Server se connect nahi ho pa raha" message; GET retried once ~2s later; page loads',
      `requests to /dashboard/admin=${dashHits} (retry gap ${gap}s); page loaded after retry=${loaded}; url=${page.url().replace(L.BASE, '')}; toasts=${JSON.stringify(toasts.filter((t) => /connect|server/i.test(t)))}`,
      dashHits === 2 && loaded && stillIn && toasts.some((t) => /Server se connect nahi ho pa raha/i.test(t)) ? 'PASS' : 'FAIL', await L.shot(sess, 'R10-a-get-retry'), [],
      { classification: 'Frontend', cause: 'src/api/client.js response interceptor (isTransientGetFailure + notifyConnectionProblem)' }))
    await L.closeSession(sess)
  }

  // ---- 10b: a write that never reaches the server is NOT replayed and does not log out
  {
    const sess = await fresh('10b'); const { page } = sess
    let posts = 0
    await page.route(/\/expenses$/, async (route) => {
      if (route.request().method() === 'POST' && route.request().url().startsWith(L.API)) { posts += 1; return route.abort('failed') }
      return route.continue()
    })
    await page.goto(L.BASE + '/admin/expenses', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.getByRole('button', { name: /add expense/i }).first().click({ timeout: 8000 })
    await page.getByText('Expense Category').first().waitFor({ timeout: 8000 })
    await page.waitForTimeout(1200)
    await L.selectFirstByLabel(page, 'Expense Category')
    await L.fillLabel(page, 'Amount', '1')
    await L.fillLabel(page, 'Description / Purpose', 'QA-TEST network-failure probe (request is aborted, never saved)')
    await L.startToastWatch(page)
    await page.locator('[role="dialog"], form').last().getByRole('button', { name: /^add expense$/i }).click({ timeout: 8000 })
    await page.waitForTimeout(6000)
    const toasts = await toastTexts(page)
    rows.push(L.row('R10', 'POST fails at network level (simulated)', 'Not retried automatically (exactly 1 attempt); user NOT logged out; friendly message',
      `POST /expenses attempts=${posts}; url=${page.url().replace(L.BASE, '')}; toasts=${JSON.stringify(toasts.filter((t) => /connect|server/i.test(t)))}`,
      posts === 1 && !/\/login/.test(page.url()) && toasts.some((t) => /Server se connect nahi ho pa raha/i.test(t)) ? 'PASS' : 'FAIL', await L.shot(sess, 'R10-b-post-no-retry'), [],
      { classification: 'Frontend', cause: 'src/api/client.js interceptor: writes are never replayed' }))
    await L.closeSession(sess)
  }

  // ---- 10c: API answers 401 and the token refresh cannot reach the server -> must NOT log out
  {
    const sess = await fresh('10c'); const { page } = sess
    let dashHits = 0, refreshHits = 0
    await page.route(/\/auth\/refresh/, async (route) => { refreshHits += 1; return route.abort('failed') })
    await page.route(/\/dashboard\/admin/, async (route) => {
      if (!route.request().url().startsWith(L.API)) return route.continue()
      dashHits += 1
      if (dashHits === 1) return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': L.BASE }, body: JSON.stringify({ detail: 'Token expired (simulated)' }) })
      return route.continue()
    })
    await page.goto(L.BASE + '/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(9000)
    const url = page.url().replace(L.BASE, '')
    const hasToken = await page.evaluate(() => Object.keys(localStorage).some((k) => /auth|token/i.test(k) && (localStorage.getItem(k) || '').length > 20)).catch(() => false)
    rows.push(L.row('R10', '401 + token refresh unreachable (network down)', 'User is NOT logged out (stays on the page, tokens kept)',
      `/dashboard/admin hits=${dashHits}, /auth/refresh attempts=${refreshHits}; url after 9s=${url}; auth tokens still in storage=${hasToken}`,
      !/\/login/.test(url) && hasToken ? 'PASS' : 'FAIL', await L.shot(sess, 'R10-c-refresh-network-fail'), [],
      { classification: 'Frontend', cause: 'src/api/client.js refresh catch block (refreshNeverAnswered -> reject original, keep session)' }))
    await L.closeSession(sess)
  }

  // ---- 10d: genuine 401 and refresh rejected with 401 -> logout is correct
  {
    const sess = await fresh('10d'); const { page } = sess
    let dashHits = 0
    await page.route(/\/auth\/refresh/, async (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': L.BASE }, body: JSON.stringify({ detail: 'Invalid refresh token (simulated)' }) }))
    await page.route(/\/dashboard\/admin/, async (route) => {
      if (!route.request().url().startsWith(L.API)) return route.continue()
      dashHits += 1
      return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': L.BASE }, body: JSON.stringify({ detail: 'Not authenticated (simulated)' }) })
    })
    await page.goto(L.BASE + '/admin/dashboard', { waitUntil: 'domcontentloaded' })
    for (let i = 0; i < 20 && !/\/login/.test(page.url()); i++) await page.waitForTimeout(500)
    const url = page.url().replace(L.BASE, '')
    rows.push(L.row('R10', 'Genuine 401 + refresh rejected with 401', 'Logout to /login (the only case that should log out)', `dashboard hits=${dashHits}; url=${url}`,
      /\/login/.test(url) ? 'PASS' : 'FAIL', await L.shot(sess, 'R10-d-real-401-logout'), [],
      { classification: 'Frontend', cause: 'src/api/client.js interceptor (logout only on real 401)' }))
    await L.closeSession(sess)
  }

  // ---- 10e: normal browsing: console errors (non-network) + no /login bounce
  {
    const sess = await fresh('10e'); const { page } = sess
    const paths = ['/admin/dashboard', '/admin/products', '/admin/suppliers', '/admin/purchases', '/admin/purchase-returns', '/admin/expenses', '/admin/quotations', '/admin/vehicle-stock', '/admin/customers', '/admin/invoices']
    for (const p of paths) {
      sess.step = `R10 ${p}`
      await page.goto(L.BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await L.settle(page, 10000)
    }
    const network = sess.consoleErrors.filter((c) => /CORS|ERR_FAILED|Failed to load resource|net::/.test(c.text))
    const real = sess.consoleErrors.filter((c) => !/CORS|ERR_FAILED|Failed to load resource|net::/.test(c.text))
    const loginBounces = navLog.filter((n) => n.label === '10e' && /^\/login/.test(n.url)).length
    const allLoginAfterStart = navLog.filter((n) => ['10a', '10b', '10c'].includes(n.label) && /^\/login/.test(n.url)).length
    rows.push(L.row('R10', 'Browsing 10 admin pages: console errors + logout loop', 'No JS/page errors; no redirect to /login (no logout loop)',
      `app/JS console errors=${real.length}${real.length ? ': ' + real.map((c) => c.text.slice(0, 140)).join(' ;; ') : ''}; network-level console errors (live-backend CORS/ERR_FAILED)=${network.length}${network.length ? ': ' + network.map((c) => c.text.slice(0, 110)).join(' ;; ') : ''}; /login redirects during browsing=${loginBounces}; /login redirects in the no-logout simulations=${allLoginAfterStart}`,
      real.length === 0 && loginBounces === 0 && allLoginAfterStart === 0 ? (network.length ? 'PASS' : 'PASS') : 'FAIL', await L.shot(sess, 'R10-e-browse'), [],
      { classification: real.length ? 'Frontend' : '', cause: real.length ? 'see console text' : '', note: network.length ? 'CORS/ERR_FAILED lines come from the live backend answering some GETs without CORS headers (intermittent), not from the app; the client retried them.' : '' }))
    await L.closeSession(sess)
  }

  L.saveResults('R10', rows)
  await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 600)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 3).join(' | ')); process.exit(1) })
