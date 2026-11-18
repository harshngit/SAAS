const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const m = H.state().products.attach
  const a = await H.getProduct(page, m.id)
  console.log(JSON.stringify({ datasheet: a.product_datasheet, compliance: a.compliance_certificate, warranty: a.warranty_document, catalog: a.product_catalog_brochure, manual: a.product_manual }))
  await H.openDetail(page, m.id)
  const t = (await H.detailText(page)); console.log((t.match(/Attachments \|.{0,300}/) || [''])[0])
  const att = await H.api(page, '/products/' + m.id + '/attachments'); console.log(att.status, JSON.stringify(att.body))
  await H.shot(page, '_probe-att-detail', true)
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
