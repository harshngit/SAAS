// Setup (API-driven, deterministic): QA supplier(s), products, purchases, GRN receipts. Everything is named QA-PR-*.
// Stages persist to qa-test/purchase-return/state.json so the script can be re-run safely (skips what exists).
const H = require('./pr-helpers.cjs')
const short = (o) => JSON.stringify(o).slice(0, 700)
;(async () => {
  const h = await H.open(); const { page } = h
  const ts = H.TS(); let s = H.state()
  const log = (...a) => console.log(...a)

  // --- environment discovery
  const wh = await H.api(page, '/warehouses')
  const whs = (wh.body && (wh.body.items || wh.body)) || []
  log('warehouses:', whs.map((w) => `${w.name} (${w.id}) active=${w.is_active} default=${w.is_default}`).join(' | '))
  const main = whs.find((w) => /main/i.test(w.name)) || whs[0]
  const other = whs.find((w) => w.id !== main.id)
  H.setState({ warehouse: { id: main.id, name: main.name }, otherWarehouse: other ? { id: other.id, name: other.name } : null })

  // template product (read-only): reuse the category + the QA image fixture of an existing QA-PW product
  const qa = (await H.B.findProducts(page, 'QA-PW-Full'))[0]
  const tpl = await H.B.getProduct(page, qa.id)
  log('template product', tpl.name, 'category_id', tpl.category_id, 'sub', tpl.sub_category_id, 'cover', tpl.cover_image)
  H.setState({ tpl: { category_id: tpl.category_id, sub_category_id: tpl.sub_category_id, cover_image: tpl.cover_image, category: tpl.category, sub_category: tpl.sub_category } })

  // --- suppliers
  async function mkSupplier(key, name) {
    s = H.state(); if (s[key]) return s[key]
    const r = await H.post(page, '/suppliers', { name, company_name: name, supplier_type: 'Wholesale', phone: '9000000000', city: 'QA City' })
    log('supplier', name, r.status, r.status < 300 ? '' : short(r.body))
    if (r.status >= 300) throw new Error('supplier create failed')
    H.track('supplier', { id: r.body.id, name }); H.setState({ [key]: { id: r.body.id, name } }); return { id: r.body.id, name }
  }
  await mkSupplier('supplier', `QA-PR-Supplier-${ts}`)
  await mkSupplier('supplier2', `QA-PR-Supplier2-${ts}`)

  // --- products (purchase price 100, opening stock 0, image from fixture)
  async function mkProduct(key, name, sku) {
    s = H.state(); if (s[key]) return s[key]
    const body = {
      name, sku, status: 'active', inventory_tracking: true, opening_stock: 0, uom: 'Piece',
      category_id: tpl.category_id, sub_category_id: tpl.sub_category_id, category: tpl.category, sub_category: tpl.sub_category,
      cover_image: tpl.cover_image, pricing: { purchase_price: 100, selling_price: 150 },
    }
    const r = await H.post(page, '/products', body)
    log('product', name, r.status, r.status < 300 ? 'stock=' + r.body.total_inventory : short(r.body))
    if (r.status >= 300) throw new Error('product create failed')
    H.track('product', { id: r.body.id, name, sku }); H.setState({ [key]: { id: r.body.id, name, sku } }); return r.body
  }
  await mkProduct('prodA', `QA-PR-Product-${ts}`, `QA-PR-SKU-${ts}`)
  await mkProduct('prodB', `QA-PR-ProductB-${ts}`, `QA-PR-SKU-B-${ts}`)
  await mkProduct('prodC', `QA-PR-ProductC-${ts}`, `QA-PR-SKU-C-${ts}`)
  await mkProduct('prodD', `QA-PR-ProductD-${ts}`, `QA-PR-SKU-D-${ts}`)
  await mkProduct('prodE', `QA-PR-ProductE-${ts}`, `QA-PR-SKU-E-${ts}`)
  await mkProduct('prodF', `QA-PR-ProductF-${ts}`, `QA-PR-SKU-F-${ts}`)
  s = H.state()

  // --- purchases
  async function mkPurchase(key, invoice, supplier, lines, { receive = true, cancel = false, confirm = true } = {}) {
    s = H.state(); if (s[key]) { log('exists', key, s[key].number); return s[key] }
    const before = {}; for (const l of lines) before[l.prod.id] = (await H.stock(page, l.prod.id)).total_inventory
    const body = {
      invoice_number: invoice, supplier_id: supplier.id, warehouse_id: s.warehouse.id, purchase_type: 'Direct Purchase',
      notes: 'QA-PR purchase for return testing',
      items: lines.map((l) => ({ product_id: l.prod.id, quantity: l.qty, ordered_qty: l.qty, purchase_price: 100, tax_rate: 0, warehouse_id: s.warehouse.id })),
    }
    const r = await H.post(page, '/purchases', body)
    log('purchase', invoice, r.status, r.status < 300 ? `${r.body.purchase_number || r.body.invoice_number} status=${r.body.status}` : short(r.body))
    if (r.status >= 300) throw new Error('purchase create failed')
    const pur = r.body; H.track('purchase', { id: pur.id, name: invoice, number: pur.purchase_number })
    const rec = { id: pur.id, number: pur.purchase_number || pur.invoice_number, invoice, supplierId: supplier.id, supplierName: supplier.name, items: pur.items.map((i) => ({ id: i.id, product_id: i.product_id, name: i.product_name, qty: i.quantity })), stockBefore: before }
    if (confirm) {
      const c = await H.post(page, `/purchases/${pur.id}/confirm`, {})
      log('  confirm', c.status, c.status < 300 ? c.body.status : short(c.body)); rec.confirmStatus = c.status
    }
    if (receive) {
      const g = await H.post(page, '/grns', {
        purchase_id: pur.id, warehouse_id: s.warehouse.id, notes: 'QA-PR GRN',
        items: pur.items.map((i) => ({ purchase_item_id: i.id, product_id: i.product_id, ordered_qty: i.quantity, received_qty: i.quantity, damaged_qty: 0, rejected_qty: 0 })),
      })
      log('  grn create', g.status, g.status < 300 ? `${g.body.grn_number} status=${g.body.status}` : short(g.body))
      if (g.status >= 300) throw new Error('grn create failed')
      H.track('grn', { id: g.body.id, name: g.body.grn_number }); rec.grnId = g.body.id; rec.grnNumber = g.body.grn_number
      const gc = await H.post(page, `/grns/${g.body.id}/confirm`, {})
      log('  grn confirm', gc.status, gc.status < 300 ? gc.body.status : short(gc.body))
      if (gc.status >= 300) throw new Error('grn confirm failed')
    }
    if (cancel) {
      const cc = await H.post(page, `/purchases/${pur.id}/cancel`, {})
      log('  cancel', cc.status, cc.status < 300 ? cc.body.status : short(cc.body)); rec.cancelStatus = cc.status
    }
    rec.stockAfter = {}; for (const l of lines) rec.stockAfter[l.prod.id] = (await H.stock(page, l.prod.id)).total_inventory
    const full = await H.getPurchase(page, pur.id)
    rec.purchaseStatus = full.status; rec.items = full.items.map((i) => ({ id: i.id, product_id: i.product_id, name: i.product_name, qty: i.quantity, received_qty: i.received_qty }))
    log('  stock before', short(rec.stockBefore), 'after', short(rec.stockAfter), 'purchase status', full.status, 'received', short(rec.items.map((i) => i.received_qty)))
    H.setState({ [key]: rec }); return rec
  }
  s = H.state()
  await mkPurchase('pur1', `QA-PR-INV1-${ts}`, s.supplier, [{ prod: s.prodA, qty: 10 }])
  await mkPurchase('pur2', `QA-PR-INV2-${ts}`, s.supplier, [{ prod: s.prodB, qty: 20 }])
  await mkPurchase('pur3', `QA-PR-INV3-${ts}`, s.supplier, [{ prod: s.prodC, qty: 5 }, { prod: s.prodD, qty: 8 }])
  await mkPurchase('pur4', `QA-PR-INV4-${ts}`, s.supplier, [{ prod: s.prodE, qty: 5 }], { receive: false })
  await mkPurchase('pur5', `QA-PR-INV5-${ts}`, s.supplier, [{ prod: s.prodE, qty: 5 }], { receive: false, confirm: false, cancel: true })
  await mkPurchase('pur6', `QA-PR-INV6-${ts}`, s.supplier, [{ prod: s.prodF, qty: 10 }])
  log('DONE')
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
