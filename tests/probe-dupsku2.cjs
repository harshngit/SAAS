// Replay the exact UI request body of T6 through the API (duplicate SKU vs unique SKU) to see whether the 503 follows the SKU or the transport.
const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const req = H.results().T6.api.request
  const run = async (label, patch) => {
    const body = { ...req, ...patch }
    const t0 = Date.now()
    const r = await H.api(page, '/products', { method: 'POST', body: JSON.stringify(body) })
    console.log(label, '->', r.status, Date.now() - t0, 'ms', JSON.stringify(r.body).slice(0, 160))
    if (r.status < 300 && r.body && r.body.id) H.addCreated({ kind: 'product', key: 'probe2', id: r.body.id, name: r.body.name, sku: r.body.sku })
  }
  await run('UI body, duplicate sku', { name: 'QA-PW-Probe2-dup-' + H.TS() })
  await run('UI body, unique sku', { name: 'QA-PW-Probe2-uniq-' + H.TS(), sku: 'QA-PW-SKU-PROBE2-' + Date.now() })
  await run('UI body, duplicate sku (2nd)', { name: 'QA-PW-Probe2-dup2-' + H.TS() })
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
