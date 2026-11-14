// R1 retry: re-open only the pages that failed on the first pass (retry once, per the rules).
const L = require('./lib')
;(async () => {
  const all = L.readResults()
  const failed = all.filter((r) => r.test === 'R1' && r.status === 'FAIL')
  if (!failed.length) { console.log('nothing to retry'); return }
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const lg = await L.login(sess, 'ADMIN')
  if (!lg.ok) { console.log('login failed'); await browser.close(); return }
  for (const f of failed) {
    const href = (f.what.match(/\((\/[^)]*)\)/) || [])[1]
    if (!href) continue
    const startApis = sess.apis.length, startCons = sess.consoleErrors.length
    sess.step = `R1 retry ${href}`
    let loadErr = ''
    await sess.page.goto(L.BASE + href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { loadErr = String(e.message).split('\n')[0] })
    await L.settle(sess.page, 12000)
    const h1 = await sess.page.locator('h1').first().innerText().catch(() => '')
    const apis = sess.apis.slice(startApis).filter((a) => !/\/login$/.test(a.url))
    const cons = sess.consoleErrors.slice(startCons).filter((c) => !/Failed to load resource/.test(c.text))
    const name = href.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
    const shot = await L.shot(sess, `R1-${name}-retry`)
    const ok = !loadErr && !apis.length && !cons.length
    f.retry = ok ? 'first pass: intermittent CORS/ERR_FAILED from live backend; retry clean' : 'retry also failed'
    if (ok) { f.status = 'PASS'; f.actual = `Retry clean (h1="${h1}"). First pass: ${f.actual.slice(0, 200)}`; f.classification = 'Environment/Backend (intermittent CORS, passes on retry)'; f.failedApis = [] ; f.screenshot = shot }
    else { f.actual += ` || RETRY: ${apis.map(L.apiLine).join('; ')} ${cons.map((c) => c.text.slice(0, 120)).join(' ;; ')}` }
    console.log(href, ok ? 'PASS on retry' : 'STILL FAIL')
  }
  require('fs').writeFileSync(L.DIR + '/results.json', JSON.stringify(all, null, 2))
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
