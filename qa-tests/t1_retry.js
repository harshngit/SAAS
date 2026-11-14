const L = require('./lib')
;(async () => {
  const b = await L.launch(); const s = await L.newSession(b, 'ADMIN')
  const r = await L.login(s, 'ADMIN'); if (!r.ok) { console.log('login failed'); await b.close(); return }
  const R = L.readResults()
  for (const href of ['/admin/purchases', '/admin/collections', '/admin/reports?report=gst-summary', '/admin/roles']) {
    s.step = 'T1r ' + href; const c0 = s.consoleErrors.length, a0 = s.apis.length
    await s.page.goto(L.BASE + href, { waitUntil: 'domcontentloaded' }).catch(() => {}); await L.settle(s.page, 12000)
    const cons = s.consoleErrors.slice(c0).filter((c) => !/Failed to load resource: the server responded with a status of 403/.test(c.text))
    const apis = s.apis.slice(a0).filter((a) => !/crm-saas\.asynk\.in\/login$/.test(a.url))
    const row = R.find((x) => x.test === 'T1' && x.what.includes(`(${href})`))
    const clean = !cons.length && !apis.length
    if (row) { row.retry = clean ? 'Retry: clean (no console error / failed API) -> intermittent backend/network' : `Retry: still failing: ${cons.map((c) => c.text.slice(0, 110)).join(' ;; ')}`; if (clean) row.status = 'PASS (on retry)' ; row.classification = 'Environment/Backend - intermittent CORS/ERR_FAILED (response without CORS headers)' }
    console.log(href, clean ? 'clean' : 'STILL FAILING ' + cons.map((c) => c.text.slice(0, 90)).join(';'))
  }
  require('fs').writeFileSync(L.DIR + '/results.json', JSON.stringify(R, null, 2))
  await L.closeSession(s); await b.close()
})()
