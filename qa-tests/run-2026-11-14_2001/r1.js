// R1 smoke on the local dev server: ADMIN opens every sidebar page (creates nothing). Skips plan/billing/subscription/razorpay.
const L = require('./lib')

const SKIP = /plan|billing|subscription|razorpay/i

async function sidebar(page) {
  for (let i = 0; i < 3; i++) {
    const btns = page.locator('aside button[aria-expanded="false"], nav button[aria-expanded="false"]')
    const n = await btns.count().catch(() => 0)
    if (!n) break
    for (let k = 0; k < n; k++) await btns.nth(k).click({ timeout: 1500 }).catch(() => {})
  }
  return page.locator('nav a, aside a, [class*="sidebar"] a').evaluateAll((els) =>
    els.map((e) => ({ href: e.getAttribute('href'), text: (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ') })).filter((x) => x.href))
}

;(async () => {
  const browser = await L.launch()
  const rows = []
  const sess = await L.newSession(browser, 'ADMIN')
  let r = await L.login(sess, 'ADMIN')
  if (!r.ok) { await sess.page.waitForTimeout(4000); r = await L.login(sess, 'ADMIN') }
  if (!r.ok) {
    const s = await L.shot(sess, 'R1-login-FAILED')
    rows.push(L.row('R1', 'Login ADMIN on local dev server', 'Login works', `HTTP ${r.status}, still on /login. page text: "${r.pageError}". console: ${sess.consoleErrors.slice(0, 3).map((c) => c.text.slice(0, 160)).join(' ;; ')}`, 'FAIL', s, sess.apis.filter((a) => !/\/login$/.test(a.url))))
    L.saveResults('R1', rows)
    await L.closeSession(sess); await browser.close()
    console.log('LOGIN FAILED', rows[0].actual)
    return
  }
  const links = await sidebar(sess.page)
  rows.push(L.row('R1', 'Login ADMIN on local dev server', 'Login works + sidebar visible', `OK -> ${r.url.replace(L.BASE, '')}. ${links.length} sidebar links`, 'PASS', await L.shot(sess, 'R1-login'), []))
  const seen = new Set()
  const pages = links.filter((l) => l.href.startsWith('/') && !SKIP.test(l.href) && !SKIP.test(l.text))
  for (const l of pages) {
    if (seen.has(l.href)) continue
    seen.add(l.href)
    const startApis = sess.apis.length
    const startCons = sess.consoleErrors.length
    sess.step = `R1 ${l.href}`
    let loadErr = ''
    await sess.page.goto(L.BASE + l.href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { loadErr = String(e.message).split('\n')[0] })
    await L.settle(sess.page, 12000)
    const h1 = await sess.page.locator('h1').first().innerText().catch(() => '')
    const bodyText = (await sess.page.locator('main, body').first().innerText().catch(() => '')).slice(0, 2000)
    const errUi = /something went wrong|unexpected error|failed to load|you do not have permission|not found/i.exec(bodyText)
    const apis = sess.apis.slice(startApis).filter((a) => !/\/login$/.test(a.url))
    const cons = sess.consoleErrors.slice(startCons)
    const name = l.href.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
    const shot = await L.shot(sess, `R1-${name}`)
    const bad = loadErr || errUi || apis.length || cons.some((c) => !/Failed to load resource/.test(c.text))
    rows.push(L.row('R1', `Open "${l.text}" (${l.href})`, 'Page loads, no failed API, no console error',
      `final=${sess.page.url().replace(L.BASE, '')} h1="${h1}"${loadErr ? ' LOADERR ' + loadErr : ''}${errUi ? ' UI-text: "' + errUi[0] + '"' : ''}${cons.length ? ' console: ' + cons.map((c) => c.text.slice(0, 140)).join(' ;; ') : ''}`,
      bad ? 'FAIL' : 'PASS', shot, apis))
  }
  L.saveResults('R1', rows)
  L.writeState({ r1ConsoleErrors: sess.consoleErrors.length })
  await L.closeSession(sess); await browser.close()
  console.log('R1 pages:', rows.length - 1, 'FAIL:', rows.filter((x) => x.status === 'FAIL').length)
  for (const x of rows.filter((y) => y.status === 'FAIL')) console.log('FAIL', x.what, '|', x.actual.slice(0, 260), '|', (x.failedApis || []).slice(0, 2).map(L.apiLine).join('; '))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
