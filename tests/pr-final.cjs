// Final cleanup (cancel only open QA-PR drafts/confirmed returns) + stock reconciliation snapshot.
const H = require('./pr-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h; const s = H.state(); const out = { cancelled: [], purchases: {}, products: {}, returns: [] }
  for (const k of ['pur1', 'pur2', 'pur3', 'pur4', 'pur5', 'pur6']) {
    const rets = (await H.listReturns(page, 'purchase_id=' + s[k].id)).items
    for (const r of rets) if (['draft', 'confirmed'].includes(r.status) && /^PR-/.test(r.return_number)) { const c = await H.post(page, `/purchase-returns/${r.id}/cancel`, { cancel_reason: 'QA-PR final cleanup' }); out.cancelled.push(`${r.return_number}:${r.status}->${c.status}`) }
    const again = (await H.listReturns(page, 'purchase_id=' + s[k].id)).items
    const by = {}; for (const r of again) by[r.status] = (by[r.status] || 0) + 1
    const net = again.filter((r) => r.status !== 'cancelled').reduce((a, r) => a + r.total_return_qty, 0)
    const p = await H.getPurchase(page, s[k].id)
    out.purchases[k] = { number: s[k].number, received: p.items.map((i) => i.received_qty), qty: p.items.map((i) => i.quantity), returnsByStatus: by, activeReturnedQty: net }
    out.returns.push(...again.map((r) => ({ n: r.return_number, p: k, st: r.status, q: r.total_return_qty })))
  }
  for (const k of ['prodA', 'prodB', 'prodC', 'prodD', 'prodE', 'prodF']) { const st = await H.stock(page, s[k].id); out.products[k] = { name: s[k].name, total_inventory: st.total_inventory, wh: st.warehouses } }
  H.setState({ final: out }); console.log(JSON.stringify(out, null, 1).slice(0, 3500))
  await H.close(h)
})()
