// T5b - reproduce the "field needs attention" block for a variant product WITHOUT saving anything.
// Variant is deliberately left without a selling price; validation stops the save client-side.
const L = require('./lib')
;(async () => {
  const stamp = L.stamp()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  sess.step = 'T5b repro'
  await page.goto(L.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('button', { name: /add product/i }).first().click()
  await page.getByText('Product Name').first().waitFor()
  await L.fillLabel(page, 'Product Name', `QA-TEST validation probe ${stamp} (never saved)`)
  await L.fillLabel(page, 'Product Code / SKU', `${stamp}-PROBE`)
  await L.selectFirstByLabel(page, 'Category'); await page.waitForTimeout(1200)
  await L.selectFirstByLabel(page, 'Sub Category'); await page.waitForTimeout(800)
  await page.locator('label').filter({ hasText: 'Do you have multiple variants under this Product?' }).locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Variants & Attributes', exact: true }).click()
  await page.getByRole('button', { name: /new variant/i }).click()
  await page.waitForTimeout(500)
  const inp = page.locator('tbody tr').first().locator('input:not([type="file"]):not([type="checkbox"])')
  await inp.nth(0).fill('Red')        // name present, selling price intentionally EMPTY
  await L.shot(sess, 'T5b-01-variant-no-selling-price')
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  const writes = []
  page.on('request', (q) => { if (['POST', 'PUT', 'PATCH'].includes(q.method()) && /\/products/.test(q.url())) writes.push(q.method() + ' ' + q.url()) })
  await page.getByRole('button', { name: /^add product$/i }).last().click()
  await page.waitForTimeout(1500)
  const banner = (await page.locator('.bg-red-50').allInnerTexts()).join(' | ')
  const state = await page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    return {
      redTexts: [...new Set([...document.querySelectorAll('.text-red-600, .text-red-700, [role="alert"]')].filter(vis).map((e) => e.innerText.trim()).filter(Boolean))],
      redBorders: [...document.querySelectorAll('[class*="border-red"]')].filter(vis).length,
      h: document.querySelector('p.text-lg')?.innerText,
    }
  })
  await L.shot(sess, 'T5b-02-after-click-add-product')
  // is the exact variant message anywhere in the DOM (visible)?
  const exact = await page.getByText(/enter a selling price/i).locator('visible=true').count()
  console.log(JSON.stringify({ banner, state, exactVariantMessageVisible: exact, productWritesSent: writes }))
  L.writeState({ t5b: { banner, state, exactVariantMessageVisible: exact, productWritesSent: writes } })
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
