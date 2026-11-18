// Replay the T6 UI flow once and dump every API call near the failing POST.
const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page, net } = h
  const base = H.state().products.minimal
  await H.openCreate(page)
  await H.fillForm(page, { name: 'QA-PW-DupSku-Probe-' + Date.now(), sku: base.sku, categoryRe: /^Beverages$/, purchase: '50', selling: '60' })
  const t0 = Date.now()
  const out = await H.submit(page, net)
  console.log('submit ->', out.status, out.banner, Date.now() - t0, 'ms', 'writes', out.writes)
  console.log(net.all.slice(-12).map((x) => `${x.method} ${x.url.slice(0, 70)} ${x.status}`).join('\n'))
  if (out.res && out.res.id) H.addCreated({ kind: 'product', key: 'probe3', id: out.res.id, name: out.res.name, sku: out.res.sku })
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
