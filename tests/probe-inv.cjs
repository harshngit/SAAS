const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page } = h
  const a = H.state().products.stock20
  await page.goto(H.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  const box = page.locator('input[type=search]').first()
  await box.click(); await box.pressSequentially(a.name, { delay: 30 }); await page.waitForTimeout(3000)
  const txt = (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ')
  console.log('found after typing:', txt.includes(a.name), '| sku:', txt.includes(a.sku))
  console.log(txt.slice(0, 600))
  await H.shot(page, '_probe-inventory-search')
  await box.fill(''); await box.pressSequentially(a.sku, { delay: 30 }); await page.waitForTimeout(3000)
  console.log('by sku:', (await page.locator('main').first().innerText()).includes(a.name))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
