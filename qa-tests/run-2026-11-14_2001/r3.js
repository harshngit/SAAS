// R3 Product with 2 variants ("QA-TEST Product C"): second variant has NO selling price -> expect a real message,
// red field, readable variant-name box, SKU asterisk; then fill the price and save -> success toast.
const L = require('./lib')

;(async () => {
  const stamp = L.stamp()
  const name = `QA-TEST Product C ${stamp}`
  const variants = [
    { name: 'Red', sku: `${stamp}-C-RED`, stock: '3', purchase: '80', selling: '120', mrp: '150' },
    { name: 'Blue', sku: `${stamp}-C-BLUE`, stock: '4', purchase: '85', selling: '', mrp: '155' },
  ]
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('R3', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('R3', rows); await browser.close(); return }

  const tab = async (title) => { await page.getByRole('button', { name: title, exact: true }).click({ timeout: 8000 }); await page.waitForTimeout(600) }
  const writes = []
  page.on('request', (q) => { if (q.method() === 'POST' && /\/products(\?|$)/.test(q.url()) && q.url().startsWith(L.API)) writes.push(q.url()) })
  const openList = async () => { await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000) }

  sess.step = 'R3 fill'
  await openList()
  await page.getByRole('button', { name: /add product/i }).first().click({ timeout: 8000 })
  await page.getByText('Product Name', { exact: false }).first().waitFor({ timeout: 10000 })
  // SKU asterisk: the label text includes the red "*" span
  const skuLabelHtml = await page.locator('label').filter({ hasText: 'Product Code / SKU' }).first().innerHTML().catch(() => '')
  const skuStar = /text-red-500[^>]*>\s*\*/.test(skuLabelHtml)
  await L.fillLabel(page, 'Product Name', name)
  await L.fillLabel(page, 'Product Code / SKU', `${stamp}-C`)
  await L.selectFirstByLabel(page, 'Category'); await page.waitForTimeout(1200)
  await L.selectFirstByLabel(page, 'Sub Category'); await page.waitForTimeout(800)
  await L.selectFirstByLabel(page, 'Product Status').catch(() => {})
  await page.locator('label').filter({ hasText: 'Do you have multiple variants under this Product?' }).locator('input[type="checkbox"]').check({ timeout: 5000 })
  await page.waitForTimeout(600)
  await tab('Variants & Attributes')
  for (let i = 0; i < variants.length; i++) {
    await page.getByRole('button', { name: /new variant/i }).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    const inp = page.locator('tbody tr').nth(i).locator('input:not([type="file"]):not([type="checkbox"])')
    const v = variants[i]
    await inp.nth(0).fill(v.name); await inp.nth(1).fill(v.sku); await inp.nth(2).fill(v.stock)
    await inp.nth(3).fill(v.purchase); if (v.selling) await inp.nth(4).fill(v.selling); await inp.nth(5).fill(v.mrp)
  }
  await tab('Inventory Information')
  await L.selectFirstByLabel(page, 'Unit of Measure').catch(() => {})
  await tab('Variants & Attributes')
  const nameBox = await page.locator('tbody tr').first().locator('input:not([type="file"]):not([type="checkbox"])').nth(0).boundingBox()
  const skuBox = await page.locator('tbody tr').first().locator('input:not([type="file"]):not([type="checkbox"])').nth(1).boundingBox()
  await L.shot(sess, 'R3-01-variants-filled-blue-no-price')

  // ---- first save attempt (must be blocked with a real message)
  sess.step = 'R3 invalid save'
  await tab('Documents')
  await page.getByRole('button', { name: /^add product$/i }).last().click({ timeout: 8000 })
  await page.waitForTimeout(1500)
  const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ')
  const activeTab = await page.evaluate(() => {
    const b = [...document.querySelectorAll('aside button, nav button')].find((x) => /bg-surface text-primary-700/.test(x.className))
    return b ? b.innerText.trim() : '?'
  })
  const alertTexts = await page.locator('[role="alert"]').allInnerTexts().catch(() => [])
  const listMsg = alertTexts.filter((t) => /selling price/i.test(t)).join(' | ').replace(/\s+/g, ' ')
  const invalid = await page.locator('tbody tr input[aria-invalid="true"]').count()
  const blueRow = page.locator('tbody tr').nth(1).locator('input:not([type="file"]):not([type="checkbox"])')
  const sellingCls = await blueRow.nth(4).getAttribute('class').catch(() => '')
  const redOnSelling = /border-red/.test(sellingCls || '') && (await blueRow.nth(4).getAttribute('aria-invalid')) === 'true'
  const redOthers = await page.locator('tbody tr').nth(0).locator('input[aria-invalid="true"]').count()
  const shotBad = await L.shot(sess, 'R3-02-blocked-with-message')
  const noPostYet = writes.length === 0
  rows.push(L.row('R3', 'Add Product with Blue variant missing selling price', 'Save blocked; banner + list show the real "selling price" message; Blue selling price red; tab jumps to Variants',
    `banner="${banner.slice(0, 220)}"; variant-list alert="${listMsg.slice(0, 160)}"; active tab="${activeTab}"; aria-invalid inputs=${invalid} (selling price red=${redOnSelling}, wrongly red in Red row=${redOthers}); POST /products sent=${!noPostYet}`,
    /selling price/i.test(banner) && listMsg && redOnSelling && noPostYet && redOthers === 0 ? 'PASS' : 'FAIL', shotBad, [],
    { classification: 'Frontend', cause: 'src/features/products/ProductForm.jsx validate() (variantRow.* errors), Variant List alert block, banner in handleSubmit' }))
  rows.push(L.row('R3', 'Variant name box width', 'Readable (>= ~120px)', `Name input ${Math.round(nameBox?.width || 0)}px wide; SKU input ${Math.round(skuBox?.width || 0)}px wide`,
    (nameBox?.width || 0) >= 120 ? 'PASS' : 'FAIL', shotBad, [], { classification: 'Frontend', cause: 'src/features/products/ProductForm.jsx variant name input (min-w-35) / table cell min-w-60' }))
  rows.push(L.row('R3', 'Product Code / SKU label', 'Red asterisk on the label', `asterisk present=${skuStar}`, skuStar ? 'PASS' : 'FAIL', shotBad, [],
    { classification: 'Frontend', cause: 'src/features/products/ProductForm.jsx commonProps.required (productCode)' }))

  // ---- fix the price and save
  sess.step = 'R3 valid save'
  await tab('Variants & Attributes')
  await blueRow.nth(4).fill('125')
  await page.waitForTimeout(600)
  const clearedRed = (await blueRow.nth(4).getAttribute('aria-invalid')) !== 'true'
  await tab('Documents')
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /^add product$/i }).last().click({ timeout: 8000 })
  await page.waitForTimeout(7000)
  const toast = await L.readToasts(page)
  const afterBanner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').slice(0, 250)
  await L.shot(sess, 'R3-03-after-save')
  await openList()
  const box = page.locator('input[placeholder="Search products..."]').first()
  await box.fill(name); await page.waitForTimeout(1800); await L.settle(page, 8000)
  const exists = (await page.getByText(name).locator('visible=true').count()) > 0
  if (exists) L.addCreated('Product (variants)', name, { sku: `${stamp}-C` })
  rows.push(L.row('R3', 'Fill Blue selling price and Add Product', 'Red clears; product saved; success toast',
    `red cleared=${clearedRed}; toast="${toast || 'none seen'}"; error banner="${afterBanner || 'none'}"; in list=${exists}`,
    exists && /created|saved|updated/i.test(toast) && clearedRed ? 'PASS' : 'FAIL', 'shots\\R3-03-after-save.png', sess.apis.filter((a) => /R3 valid/.test(a.step) && !/\/login$/.test(a.url)),
    { classification: 'Frontend', cause: 'src/features/products/ProductList.jsx handleSaveProduct toast' }))
  L.saveResults('R3', rows)
  L.writeState({ productCName: name })
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 700)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
