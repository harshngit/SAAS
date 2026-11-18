const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const a = H.state().products.stock20
  for (const q of ['/inventory', '/inventory?search=' + encodeURIComponent(a.name), '/inventory?search=' + encodeURIComponent(a.name) + '&page_size=20', '/inventory?page_size=200']) {
    const r = await H.api(page, q)
    const items = (r.body && (r.body.items || r.body)) || []
    console.log(q.slice(0, 60), '->', r.status, 'items', items.length, 'total', r.body && r.body.total, 'page_size', r.body && r.body.page_size, 'has stock20', items.some((x) => x.id === a.id))
  }
  const w = await H.api(page, '/warehouses'); const wh = (w.body.items || w.body)[0]
  const st = await H.api(page, '/warehouses/' + wh.id + '/stock?search=' + encodeURIComponent(a.name)); console.log('warehouse stock:', st.status, JSON.stringify(st.body).slice(0, 300))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
