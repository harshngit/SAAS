// R4a: Supplier create (toast) + simple Product D create (toast); R5: SupplierDetail shows Company Name, ProductDetail shows Purchase Price.
const L = require('./lib')

;(async () => {
  const stamp = L.stamp()
  const supName = `QA-TEST supplier ${stamp}`
  const company = `QA-TEST Traders ${stamp}`
  const prodName = `QA-TEST Product D ${stamp}`
  const prodSku = `${stamp}-D`
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows4 = [], rows5 = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows4.push(L.row('R4', 'login', 'ok', 'login failed', 'FAIL')); L.saveTagged('R4', 'a', rows4); await browser.close(); return }
  const st = L.readState()

  // ---------------- Supplier
  const supUrl0 = st.supplierUrl
  if (!supUrl0) {
    sess.step = 'R4 supplier'
    await page.goto(L.BASE + '/admin/suppliers', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.getByRole('button', { name: /add supplier/i }).first().click({ timeout: 8000 })
    await page.getByText('Supplier Name', { exact: false }).first().waitFor({ timeout: 10000 })
    const data = { 'Supplier Name': supName, 'Company Name': company, 'Contact Person': 'QA Tester', Phone: '9000000001', Email: 'qa-test@example.com', Address: `QA-TEST address ${stamp}`, City: 'Pune', State: 'Maharashtra', 'PIN Code': '411001' }
    for (const [label, value] of Object.entries(data)) await L.fillLabel(page, label, value)
    await L.selectFirstByLabel(page, 'Supplier Type')
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /save supplier/i }).click({ timeout: 8000 })
    await page.waitForTimeout(7000)
    const toast = await L.readToasts(page)
    const shot = await L.shot(sess, 'R4-01-supplier-saved')
    await page.goto(L.BASE + '/admin/suppliers', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.locator('input[placeholder="Search suppliers..."]').first().fill(supName)
    await page.waitForTimeout(1800); await L.settle(page, 8000)
    const exists = (await page.getByText(supName).locator('visible=true').count()) > 0
    if (exists) L.addCreated('Supplier', supName)
    L.writeState({ supplierName: supName })
    rows4.push(L.row('R4', 'Supplier create: Save Supplier', 'Saved + success toast', `toast="${toast || 'none seen'}"; in list=${exists}`,
      exists && /created|saved/i.test(toast) ? 'PASS' : 'FAIL', shot, sess.apis.filter((a) => /R4 supplier/.test(a.step) && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/suppliers/SupplierList.jsx handleSaveSupplier' }))
    if (exists) {
      await page.getByText(supName).locator('visible=true').first().click({ timeout: 10000 })
      await page.waitForURL(/\/admin\/suppliers\/[^/]+$/, { timeout: 15000 }).catch(() => {})
      await L.settle(page, 12000)
      L.writeState({ supplierUrl: page.url().replace(L.BASE, '') })
    }
  }
  // R5 supplier detail
  sess.step = 'R5 supplier detail'
  const supUrl = L.readState().supplierUrl
  if (supUrl) {
    await page.goto(L.BASE + supUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    const txt = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
    const hasLabel = /Company Name/i.test(txt), hasVal = txt.includes(company)
    rows5.push(L.row('R5', 'SupplierDetail shows Company Name', `Label "Company Name" with value "${company}"`, `label shown=${hasLabel}; value shown=${hasVal}`,
      hasLabel && hasVal ? 'PASS' : 'FAIL', await L.shot(sess, 'R5-supplier-detail'), sess.apis.filter((a) => a.step === 'R5 supplier detail' && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/suppliers/SupplierDetail.jsx Basic Information (DetailField Company Name)' }))
  } else rows5.push(L.row('R5', 'SupplierDetail shows Company Name', 'Company Name visible', 'supplier not created', 'FAIL'))

  // ---------------- Product D (simple)
  if (!L.readState().productDName) {
    sess.step = 'R4 product'
    const tab = async (title) => { await page.getByRole('button', { name: title, exact: true }).click({ timeout: 8000 }); await page.waitForTimeout(500) }
    await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.getByRole('button', { name: /add product/i }).first().click({ timeout: 8000 })
    await page.getByText('Product Name', { exact: false }).first().waitFor({ timeout: 10000 })
    await L.fillLabel(page, 'Product Name', prodName)
    await L.fillLabel(page, 'Product Code / SKU', prodSku)
    await L.selectFirstByLabel(page, 'Category'); await page.waitForTimeout(1200)
    await L.selectFirstByLabel(page, 'Sub Category'); await page.waitForTimeout(800)
    await L.selectFirstByLabel(page, 'Product Status').catch(() => {})
    await tab('Inventory Information')
    await L.selectFirstByLabel(page, 'Unit of Measure')
    await L.fillLabel(page, 'Opening Stock', '0')
    await tab('Pricing Information')
    await L.fillLabel(page, 'Purchase Price', '100')
    await L.fillLabel(page, 'Selling Price', '150')
    await tab('Documents')
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /^add product$/i }).last().click({ timeout: 8000 })
    await page.waitForTimeout(7000)
    const toast = await L.readToasts(page)
    const shot = await L.shot(sess, 'R4-02-product-saved')
    const banner = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').slice(0, 250)
    await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.locator('input[placeholder="Search products..."]').first().fill(prodName)
    await page.waitForTimeout(1800); await L.settle(page, 8000)
    const exists = (await page.getByText(prodName).locator('visible=true').count()) > 0
    if (exists) { L.addCreated('Product', prodName, { sku: prodSku }); L.writeState({ productDName: prodName }) }
    rows4.push(L.row('R4', 'Product create: Add Product (simple)', 'Saved + success toast', `toast="${toast || 'none seen'}"; banner="${banner || 'none'}"; in list=${exists}`,
      exists && /created|saved/i.test(toast) ? 'PASS' : 'FAIL', shot, sess.apis.filter((a) => /R4 product/.test(a.step) && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/products/ProductList.jsx handleSaveProduct' }))
    if (exists) {
      await page.getByText(prodName).locator('visible=true').first().click({ timeout: 10000 })
      await page.waitForURL(/\/admin\/products\/[^/]+$/, { timeout: 15000 }).catch(() => {})
      await L.settle(page, 12000)
      L.writeState({ productDUrl: page.url().replace(L.BASE, '') })
    }
  }
  sess.step = 'R5 product detail'
  const pUrl = L.readState().productDUrl
  if (pUrl) {
    await page.goto(L.BASE + pUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    const txt = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
    const m = txt.match(/Purchase Price\s*(?:₹\s*)?([\d,]+(?:\.\d+)?)/i)
    rows5.push(L.row('R5', 'ProductDetail shows Purchase Price', 'Label "Purchase Price" with ₹100', `found=${!!m}; value=${m ? m[1] : 'n/a'}`,
      m && Number(m[1].replace(/,/g, '')) === 100 ? 'PASS' : 'FAIL', await L.shot(sess, 'R5-product-detail'), sess.apis.filter((a) => a.step === 'R5 product detail' && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/products/ProductDetail.jsx Pricing block (Purchase Price field)' }))
  } else rows5.push(L.row('R5', 'ProductDetail shows Purchase Price', 'Purchase Price visible', 'product not created', 'FAIL'))

  L.saveTagged('R4', 'a', rows4)
  L.saveResults('R5', rows5)
  await L.closeSession(sess); await browser.close()
  console.log([...rows4, ...rows5].map((x) => `${x.status} | ${x.test} ${x.what}\n   ${x.actual.slice(0, 400)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
