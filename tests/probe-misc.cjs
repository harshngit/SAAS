// Probes: (1) spaces in name/sku via API, (2) edit form: is Opening Stock editable, (3) inventory + quotation selectors.
const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page } = h
  const m = H.state().products.minimal
  const base = await H.getProduct(page, m.id)
  const mk = (name, sku) => ({ name, sku, category_id: base.category_id, sub_category_id: base.sub_category_id, status: 'active', pricing: { purchase_price: 50, selling_price: 60 }, total_inventory: 0 })
  for (const [label, name, sku] of [['spaces name+sku', `   QA-PW-Space-${H.TS()}   `, `  QA-PW-SKU-SP-${H.TS()}  `], ['spaces name only', `  QA-PW-Space2-${H.TS()}  `, `QA-PW-SKU-SP2-${H.TS()}`]]) {
    const t0 = Date.now(); const r = await H.api(page, '/products', { method: 'POST', body: JSON.stringify(mk(name, sku)) })
    console.log(label, '->', r.status, Date.now() - t0, 'ms', r.status < 300 ? JSON.stringify({ name: r.body.name, sku: r.body.sku }) : JSON.stringify(r.body).slice(0, 200))
    if (r.status < 300) H.addCreated({ kind: 'product', key: 'probe-sp', id: r.body.id, name: r.body.name, sku: r.body.sku })
  }
  // edit form
  await H.openDetail(page, m.id)
  await page.getByRole('button', { name: /^edit/i }).first().click(); await page.waitForTimeout(2500); await L.settle(page, 10000)
  await H.tab(page, 'Inventory Information')
  const el = L.fieldByLabel(page, 'Opening Stock')
  console.log('edit: Opening Stock disabled=', await el.isDisabled().catch((e) => 'err ' + e.message.slice(0, 40)), 'readonly=', await el.getAttribute('readonly'), 'value=', await el.inputValue().catch(() => ''))
  console.log('edit: inventory tab text:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 500))
  await H.shot(page, '_probe-edit-inventory')
  // inventory page
  await page.goto(H.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map((i) => [i.type, i.placeholder, !!i.offsetParent]))
  console.log('inventory inputs', JSON.stringify(inputs))
  await H.shot(page, '_probe-inventory')
  // quotation new
  await page.goto(H.BASE + '/admin/quotations/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  await H.shot(page, '_probe-quotation', true)
  console.log('quotation text:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 600))
  console.log('quotation triggers:', await page.locator('[data-select-trigger="true"]').count(), 'buttons:', (await page.evaluate(() => Array.from(document.querySelectorAll('main button')).filter((b) => b.offsetParent).map((b) => b.innerText.trim()).filter(Boolean))).join(' | '))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
