// Recon (read-only): OpenAPI paths + schemas relevant to Purchase Returns / Purchases / GRN / Suppliers / Warehouses.
const H = require('./pw-helpers.cjs')
const fs = require('fs')
;(async () => {
  const h = await H.open(); const { page } = h
  const r = await H.api(page, '/openapi.json')
  console.log('openapi status', r.status)
  if (r.status !== 200) { await H.close(h); return }
  const spec = r.body
  fs.writeFileSync(require('path').join(H.ROOT, 'qa-test', 'pr-openapi.json'), JSON.stringify(spec, null, 1))
  const paths = Object.keys(spec.paths).filter((p) => /purchase|grn|supplier|warehouse|inventory|stock/i.test(p))
  for (const p of paths) console.log(Object.keys(spec.paths[p]).map((m) => m.toUpperCase()).join(',').padEnd(18), p)
  const want = ['PurchaseReturnCreate', 'PurchaseReturnItemCreate', 'PurchaseReturnUpdate', 'PurchaseReturnOut', 'PurchaseReturnItemOut', 'PurchaseCreate', 'PurchaseItemCreate', 'SupplierCreate', 'GrnCreate', 'GRNCreate', 'PurchaseOut']
  const names = Object.keys(spec.components.schemas)
  console.log('SCHEMAS matching:', names.filter((n) => /return|grn|purchase/i.test(n)).join(', '))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
