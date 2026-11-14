// T0 login + sidebar per role, T1 smoke (admin opens every sidebar page, creates nothing)
const L = require('./lib')

const SKIP = /plan|billing|subscription|razorpay/i

async function sidebar(page) {
  // expand collapsed groups so every link is in the DOM
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
  const rows0 = []
  const rows1 = []
  const menus = {}

  // ---------- T0 ----------
  for (const role of L.ROLES) {
    const sess = await L.newSession(browser, role)
    let r = await L.login(sess, role)
    if (!r.ok) { // retry once
      await sess.page.waitForTimeout(4000)
      r = await L.login(sess, role)
    }
    if (!r.ok) {
      const s = await L.shot(sess, `T0-login-${role}-FAILED`)
      rows0.push(L.row('T0', `Login ${role}`, 'Login works', `HTTP ${r.status}, still on /login. page text: "${r.pageError}"`, 'FAIL', s, sess.apis.filter((a) => !/\/login$/.test(a.url))))
      await L.closeSession(sess)
      continue
    }
    const links = await sidebar(sess.page)
    menus[role] = links.filter((l) => l.text)
    const s = await L.shot(sess, `T0-login-${role}`)
    rows0.push(L.row('T0', `Login ${role}`, 'Login works + sidebar visible', `OK -> ${r.url.replace(L.BASE, '')}. Menus (${menus[role].length}): ${menus[role].map((m) => m.text).join(' | ')}`, 'PASS', s, []))
    if (role === 'ADMIN') {
      // keep ADMIN session for T1
      sess.step = 'T1'
      const seen = new Set()
      const pages = links.filter((l) => l.href.startsWith('/') && !SKIP.test(l.href) && !SKIP.test(l.text))
      for (const l of pages) {
        if (seen.has(l.href)) continue
        seen.add(l.href)
        const startApis = sess.apis.length
        const startCons = sess.consoleErrors.length
        sess.step = `T1 ${l.href}`
        let loadErr = ''
        await sess.page.goto(L.BASE + l.href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { loadErr = String(e.message).split('\n')[0] })
        await L.settle(sess.page, 12000)
        const h1 = await sess.page.locator('h1').first().innerText().catch(() => '')
        const bodyText = (await sess.page.locator('main, body').first().innerText().catch(() => '')).slice(0, 2000)
        const errUi = /something went wrong|unexpected error|failed to load|you do not have permission|not found/i.exec(bodyText)
        const apis = sess.apis.slice(startApis).filter((a) => !/crm-saas\.asynk\.in\/login$/.test(a.url))
        const cons = sess.consoleErrors.slice(startCons)
        const name = l.href.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
        const shot = await L.shot(sess, `T1-${name}`)
        const bad = loadErr || errUi || apis.length || cons.some((c) => !/Failed to load resource/.test(c.text))
        rows1.push(L.row('T1', `Open "${l.text}" (${l.href})`, 'Page loads, no failed API, no console error',
          `final=${sess.page.url().replace(L.BASE, '')} h1="${h1}"${loadErr ? ' LOADERR ' + loadErr : ''}${errUi ? ' UI-text: "' + errUi[0] + '"' : ''}${cons.length ? ' console: ' + cons.map((c) => c.text.slice(0, 120)).join(' ;; ') : ''}`,
          bad ? 'FAIL' : 'PASS', shot, apis))
      }
    }
    await L.closeSession(sess)
  }
  L.saveResults('T0', rows0)
  L.saveResults('T1', rows1)
  L.writeState({ menus })
  await browser.close()
  console.log('T0 rows:', rows0.map((r) => `${r.what}:${r.status}`).join(' | '))
  console.log('T1 pages:', rows1.length, 'FAIL:', rows1.filter((r) => r.status === 'FAIL').length)
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
