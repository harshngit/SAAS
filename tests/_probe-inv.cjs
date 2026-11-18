const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const q = async (qs) => { const r = await H.api(page, '/inventory?' + qs); const b = r.body || {}; console.log(qs.padEnd(52), r.status, 'total', b.total, 'pages', b.total_pages, 'n', (b.items || []).length, 'first', ((b.items || [])[0] || {}).name, JSON.stringify(b.detail || '').slice(0, 80)) }
  await q('page=1&page_size=25'); await q('page=2&page_size=25'); await q('page=1&page_size=100'); await q('page=1&page_size=25&is_active=false'); await q('page=1&page_size=25&is_active=true')
  await q('page=1&page_size=25&status=inactive'); await q('page=1&page_size=25&status=active')
  for (const sb of ['name', 'sku', 'total_stock', 'stock', 'total_inventory', 'created_at']) await q(`page=1&page_size=5&sort_by=${sb}&sort_order=desc`)
  await q('page=1&page_size=25&search=QA-PR-SKU'); await q('page=1&page_size=25&search=Anchor')
  const p = await H.api(page, '/products?page_size=3&is_active=true'); console.log('products', p.status, p.body.total, Object.keys(p.body.items[0]).join(',').slice(0, 300))
  await H.close(h)
})()
