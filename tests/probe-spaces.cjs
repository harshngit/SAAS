// UI create with leading/trailing spaces (3 tries) -> capture request + response headers/status/timing; replay the same body via fetch.
const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page, net } = h
  const sp = H.TS() + 'b'
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && /\/products$/.test(r.url())) {
      const hd = r.headers()
      console.log('  POST /products ->', r.status(), 'server:', hd.server, 'cf-ray:', hd['cf-ray'] ? 'yes' : 'no', 'retry-after:', hd['retry-after'], 'ct:', hd['content-type'], 'acao:', hd['access-control-allow-origin'] ? 'yes' : 'no')
    }
  })
  let lastBody = null
  for (let i = 1; i <= 3; i++) {
    await H.openCreate(page)
    await H.fillForm(page, { name: `   QA-PW-Space-${sp}-${i}   `, sku: `  QA-PW-SKU-SP-${sp}-${i}  `, categoryRe: /^Beverages$/, purchase: '50', selling: '60' })
    const t0 = Date.now(); const out = await H.submit(page, net)
    console.log('try', i, 'status', out.status, Date.now() - t0, 'ms', 'banner:', out.banner.slice(0, 80))
    lastBody = out.req
    if (out.res && out.res.id) { H.addCreated({ kind: 'product', key: 'probe-sp-ui', id: out.res.id, name: out.res.name, sku: out.res.sku }); console.log('  stored name', JSON.stringify(out.res.name), 'sku', JSON.stringify(out.res.sku)) }
    console.log('  request name/sku:', JSON.stringify(out.req && out.req.name), JSON.stringify(out.req && out.req.sku))
  }
  if (lastBody) {
    const b = { ...lastBody, name: `   QA-PW-Space-Replay-${sp}   `, sku: `  QA-PW-SKU-SP-Replay-${sp}  ` }
    const r = await H.api(page, '/products', { method: 'POST', body: JSON.stringify(b) })
    console.log('replay of the UI body via fetch ->', r.status, r.status < 300 ? 'ok' : JSON.stringify(r.body).slice(0, 150))
    if (r.status < 300) H.addCreated({ kind: 'product', key: 'probe-sp-replay', id: r.body.id, name: r.body.name, sku: r.body.sku })
  }
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
