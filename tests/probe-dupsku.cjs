// Probe: why does the duplicate-SKU create return 503? Direct API POSTs with QA-PW names (any record created is tracked for cleanup).
const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const m = H.state().products.minimal
  const base = await H.getProduct(page, m.id)
  const body = (sku, name) => ({ name, sku, category_id: base.category_id, sub_category_id: base.sub_category_id, status: 'active', pricing: { purchase_price: 50, selling_price: 60 }, total_inventory: 0 })
  for (const [label, sku] of [['unique sku', `QA-PW-SKU-PROBE-${Date.now()}`], ['duplicate sku', base.sku], ['duplicate sku again', base.sku]]) {
    const t0 = Date.now()
    const r = await H.api(page, '/products', { method: 'POST', body: JSON.stringify(body(sku, `QA-PW-Probe-${label.replace(/ /g, '-')}-${H.TS()}`)) })
    console.log(label, '->', r.status, Date.now() - t0, 'ms', JSON.stringify(r.body).slice(0, 220))
    if (r.status < 300 && r.body && r.body.id) H.addCreated({ kind: 'product', key: 'probe', id: r.body.id, name: r.body.name, sku: r.body.sku })
  }
  const same = await H.findProducts(page, base.sku)
  console.log('products with that sku now:', same.filter((p) => p.sku === base.sku).length)
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
