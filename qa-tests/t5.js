// T5 Product with variants "QA-TEST Product B": attribute "Color", variants Red + Blue (SKU, stock, prices)
const L = require('./lib')

;(async () => {
  const stamp = L.stamp()
  const name = `QA-TEST Product B ${stamp}`
  const sku = `${stamp}-B`
  const png = L.ensureTestPng()
  const variants = [
    { name: 'Red', sku: `${stamp}-B-RED`, stock: '5', purchase: '80', selling: '120', mrp: '150' },
    { name: 'Blue', sku: `${stamp}-B-BLUE`, stock: '7', purchase: '85', selling: '125', mrp: '155' },
  ]
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('T5', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('T5', rows); await browser.close(); return }

  const openList = async () => { await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000) }
  const listSearch = async (q) => { const box = page.locator('input[placeholder="Search products..."]').first(); await box.fill(q); await page.waitForTimeout(1500); await L.settle(page, 8000) }
  const tab = async (title) => { await page.getByRole('button', { name: title, exact: true }).click({ timeout: 8000 }); await page.waitForTimeout(500) }
  const absent = []
  const opt = async (label, v) => { if (await L.fieldByLabel(page, label).count()) { await L.fillLabel(page, label, v); return true } absent.push(label); return false }
  // everything red/invalid that is visible right now
  const redState = async () => page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    const texts = [...document.querySelectorAll('.text-red-600, .text-red-700, .text-red-500, [role="alert"]')].filter(vis).map((e) => e.innerText.trim()).filter((t) => t && t !== '*')
    const borders = [...document.querySelectorAll('[class*="border-red"]')].filter(vis).length
    const active = [...document.querySelectorAll('aside button, nav button')].find((b) => /bg-surface text-primary-700/.test(b.className))
    return { texts: [...new Set(texts)].slice(0, 8), redBorders: borders, activeTab: active ? active.innerText.trim() : '?' }
  })

  await openList(); await listSearch(name)
  let exists = (await page.getByText(name).locator('visible=true').count()) > 0
  const priorRun = (L.readState().created || []).some((c) => c.name === name)
  let attempt = 0, toast = '', diag = null, bannerText = '', jumpedTab = ''

  while (!exists && attempt < 2) {
    attempt++
    sess.step = `T5 create a${attempt}`
    try {
      await openList()
      await page.getByRole('button', { name: /add product/i }).first().click({ timeout: 8000 })
      await page.getByText('Product Name', { exact: false }).first().waitFor({ timeout: 10000 })
      await L.fillLabel(page, 'Product Name', name)
      await L.fillLabel(page, 'Product Code / SKU', sku)
      const cat = await L.selectFirstByLabel(page, 'Category'); await page.waitForTimeout(1200)
      const sub = await L.selectFirstByLabel(page, 'Sub Category'); await page.waitForTimeout(800)
      await L.selectFirstByLabel(page, 'Product Status')
      await opt('Product Description', `QA-TEST ${stamp} variant product`)
      await page.locator('label').filter({ hasText: 'Do you have multiple variants under this Product?' }).locator('input[type="checkbox"]').check({ timeout: 5000 })
      await page.waitForTimeout(600)
      L.writeState({ productBEntered: { name, sku, cat, sub, variants } })
      await L.shot(sess, `T5-02-basic-a${attempt}`)
      // media
      await tab('Product Images & Media')
      const up = page.waitForResponse((x) => /\/files\/upload/.test(x.url()) && x.request().method() === 'POST', { timeout: 30000 }).catch(() => null)
      await page.locator('input[type="file"]').first().setInputFiles(png); await up
      await page.waitForTimeout(1500)
      // variants + attributes
      await tab('Variants & Attributes')
      await L.shot(sess, `T5-03-variants-empty-a${attempt}`)
      await opt('Attribute Types', 'Color')
      for (let i = 0; i < variants.length; i++) {
        await page.getByRole('button', { name: /new variant/i }).click({ timeout: 5000 })
        await page.waitForTimeout(500)
        const row = page.locator('tbody tr').nth(i)
        const inp = row.locator('input:not([type="file"]):not([type="checkbox"])')
        const v = variants[i]
        await inp.nth(0).fill(v.name); await inp.nth(1).fill(v.sku); await inp.nth(2).fill(v.stock)
        await inp.nth(3).fill(v.purchase); await inp.nth(4).fill(v.selling); await inp.nth(5).fill(v.mrp)
      }
      await L.shot(sess, `T5-04-variants-filled-a${attempt}`)
      // inventory tab (UOM)
      await tab('Inventory Information')
      await L.selectFirstByLabel(page, 'Unit of Measure').catch(() => {})
      await L.shot(sess, `T5-05-inventory-a${attempt}`)
      await tab('Documents')
      await L.startToastWatch(page)
      await page.getByRole('button', { name: /^add product$/i }).last().click({ timeout: 8000 })
      await page.waitForTimeout(6000)
      toast = await L.readToasts(page)
      bannerText = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').slice(0, 300)
      diag = await redState()
      await L.shot(sess, `T5-07-after-save-a${attempt}`)
    } catch (e) { bannerText = String(e.message).split('\n')[0]; await L.shot(sess, `T5-ERR-a${attempt}`) }
    await openList(); await listSearch(name)
    exists = (await page.getByText(name).locator('visible=true').count()) > 0
  }

  const createApis = sess.apis.filter((a) => /T5 create/.test(a.step) && !/crm-saas\.asynk\.in\/login$/.test(a.url))
  if (priorRun && attempt === 0) {
    rows.push(L.row('T5', 'Create variant product', 'Saved with 2 variants', 'Product already created by an earlier run of this script (verify only)', 'PASS', 'shots\\T5-07-after-save-a1.png', []))
  } else {
    rows.push(L.row('T5', 'Fill tabs + 2 variants + Add Product', 'Success message, product saved with Red/Blue variants',
      exists ? `Saved. Toast: "${toast || 'none seen'}". banner: "${bannerText || 'none'}"`
        : `NOT saved. banner: "${bannerText}". Visible red text: ${JSON.stringify(diag?.texts)}; red-bordered fields: ${diag?.redBorders}; tab shown after click: "${diag?.activeTab}". Fields not on form: ${absent.join(', ') || 'none'}`,
      exists ? (toast ? 'PASS' : 'FAIL') : 'FAIL', `shots\\T5-07-after-save-a${attempt || 1}.png`, createApis,
      exists && !toast ? { classification: 'Frontend', cause: 'src/features/products/ProductList.jsx:275 handleSaveProduct - no success message' } : {}))
  }
  if (!exists) { L.saveResults('T5', rows); await L.closeSession(sess); await browser.close(); console.log(rows.map((x) => `${x.what}: ${x.status} :: ${x.actual}`).join('\n')); return }
  if (attempt > 0) L.addCreated('Product (variants)', name, { sku })

  rows.push(L.row('T5', 'Variant product appears in list', 'Row with QA-TEST name', 'Found after search', 'PASS', await L.shot(sess, 'T5-08-list'), []))
  sess.step = 'T5 detail'
  await page.getByText(name).locator('visible=true').first().click({ timeout: 10000 })
  await page.waitForURL(/\/admin\/products\/[^/]+$/, { timeout: 15000 }).catch(() => {})
  await L.settle(page, 12000)
  L.writeState({ productBUrl: page.url().replace(L.BASE, '') })
  const text = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const has = (v) => text.toLowerCase().includes(String(v).toLowerCase())
  const miss = []
  for (const v of variants) for (const [k, val] of [['name', v.name], ['sku', v.sku], ['selling', v.selling]]) if (!has(val)) miss.push(`${v.name} ${k}=${val}`)
  if (!has('Color')) miss.push('attribute Color')
  rows.push(L.row('T5', 'Open detail, compare variants', 'Red + Blue variants with SKU/stock/prices visible',
    miss.length ? `Not shown on detail: ${miss.join('; ')}` : 'Both variants, SKUs, selling prices and attribute Color visible',
    miss.length ? 'FAIL' : 'PASS', await L.shot(sess, 'T5-09-detail'), sess.apis.filter((a) => a.step === 'T5 detail' && !/crm-saas\.asynk\.in\/login$/.test(a.url))))
  L.saveResults('T5', rows)
  await L.closeSession(sess)
  await browser.close()
  console.log(rows.map((x) => `${x.what}: ${x.status} :: ${x.actual}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
