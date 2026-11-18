// Read-only recon of the hosted app: create form, blank-submit validation, categories, variants tab, list columns. Creates nothing.
const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page, net } = h
  console.log('base', H.BASE, '| login ok')
  const me = await H.api(page, '/auth/me'); console.log('role:', me.body && (me.body.role || (me.body.user && me.body.user.role)), '| user:', me.body && me.body.name)
  const cats = await H.api(page, '/categories?page_size=200')
  const rows = (cats.body && (cats.body.items || cats.body)) || []
  console.log('categories:', rows.length, JSON.stringify(rows.slice(0, 40).map((c) => [c.name, c.parent_id ? 'sub' : 'top'])))
  await H.openCreate(page)
  await H.shot(page, '_recon-create')
  // blank submit
  const r = await H.submit(page, net)
  console.log('blank submit:', JSON.stringify({ writes: r.writes, banner: r.banner, fieldErrors: r.fieldErrors }))
  await H.shot(page, '_recon-blank')
  // other tabs that show error markers
  for (const t of ['Basic Information', 'Inventory Information', 'Pricing Information', 'Product Images & Media']) {
    await H.tab(page, t)
    const e = await page.evaluate(() => Array.from(document.querySelectorAll('p.text-red-600, p.text-red-500, .text-red-600')).map((x) => x.innerText.trim()).filter(Boolean))
    console.log('tab', t, 'errors:', JSON.stringify(e))
  }
  await H.tab(page, 'Basic Information')
  console.log('categories opts:', JSON.stringify(await H.listOptions(page, 'Category')))
  console.log('status opts:', JSON.stringify(await H.listOptions(page, 'Product Status')))
  await H.tab(page, 'Inventory Information'); console.log('uom opts:', JSON.stringify(await H.listOptions(page, 'Unit of Measure')))
  await H.tab(page, 'Basic Information')
  await page.locator('label', { hasText: /multiple variants/i }).locator('input[type=checkbox]').first().check({ force: true })
  await H.tab(page, 'Variants & Attributes'); await H.shot(page, '_recon-variants', true)
  console.log('variants tab text:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 700))
  console.log('buttons:', (await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent).map((b) => b.innerText.trim()).filter(Boolean))).join(' | '))
  await H.tab(page, 'Product Images & Media'); console.log('media tab:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 500))
  await H.tab(page, 'Documents'); console.log('docs tab:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 500))
  console.log('failures', JSON.stringify(net.failures), 'console', JSON.stringify(net.consoleErrors.map((c) => c.text.slice(0, 150))))
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await H.shot(page, '_recon-list')
  console.log('list header:', (await page.locator('thead').first().innerText().catch(() => '')).replace(/\s+/g, ' '))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
