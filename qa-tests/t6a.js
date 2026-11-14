// T6a - Product A stock BEFORE, then create the purchase (qty 10 x 100, invoice QA-TEST-INV-1) and verify totals
const L = require('./lib')
;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const supplierName = st.supplierName
  const productA = (st.productAEntered || {}).name
  if (!supplierName || !productA) throw new Error('need supplier (T3) and Product A (T4) in state')
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }

  const stockOf = async (label) => {
    await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    const box = page.locator('input[placeholder*="earch" i]:visible').last()
    await box.fill(productA); await page.waitForTimeout(1800); await L.settle(page, 8000)
    const shot = await L.shot(sess, `T6-${label}-inventory`)
    const rowTxt = await page.locator('tr', { hasText: productA }).first().innerText().catch(() => '')
    const cardTxt = rowTxt || (await page.getByText(productA).locator('visible=true').first().locator('xpath=ancestor::*[self::tr or self::div][3]').innerText().catch(() => ''))
    return { text: cardTxt.replace(/\s+/g, ' ').trim(), shot }
  }
  sess.step = 'T6 stock before'
  const before = await stockOf('01-before')
  L.writeState({ productAStockBefore: before.text })
  rows.push(L.row('T6', 'Inventory: Product A stock BEFORE purchase', 'Row for Product A (opening stock 0)', before.text || '(row not found)', before.text ? 'PASS' : 'FAIL', before.shot, []))

  L.saveTagged('T6', 'a', rows)
  // ---------- create purchase
  const already = L.readState().purchaseUrl
  if (already) { console.log('purchase already created:', already); await L.closeSession(sess); await browser.close(); return }
  sess.step = 'T6 create purchase'
  await page.goto(L.BASE + '/admin/purchases/create', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForFunction(() => !/Loading.../.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
  await L.shot(sess, 'T6-02-create-form-empty')
  await L.selectByLabel(page, 'Supplier', stamp, { exact: false })   // option text contains the stamp -> our supplier
  await page.waitForTimeout(1200)
  const ptype = await L.selectFirstByLabel(page, 'Purchase Type').catch(() => '(not shown)')
  const dateVal = await L.fieldByLabel(page, 'Purchase Date').inputValue().catch(() => '')
  await L.fillLabel(page, 'Supplier Reference / Invoice Number', 'QA-TEST-INV-1')
  const wh = await L.selectFirstByLabel(page, 'Warehouse').catch(() => '(not shown)')
  await L.fillLabel(page, 'Notes', `${stamp} purchase for Product A`).catch(() => {})
  // item row
  const row = page.locator('tbody tr').first()
  await row.locator('[data-select-trigger="true"]').first().click()
  await page.getByRole('option', { name: new RegExp(productA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click({ timeout: 8000 })
  await page.waitForTimeout(800)
  const nums = row.locator('input:not([type="hidden"]):not([type="file"])')
  const cnt = await nums.count()
  // inputs in row (after the select's own search input): qty, price, discount, tax
  const qty = row.locator('input[type="number"], input[inputmode]').nth(0)
  await row.locator('input[type="number"]').nth(0).fill('10')
  await row.locator('input[type="number"]').nth(1).fill('100')
  await page.waitForTimeout(600)
  const totalsText = (await page.locator('text=Grand Total').first().locator('xpath=ancestor::div[contains(@class,"space-y")][1]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  const rowText = (await row.innerText()).replace(/\s+/g, ' ')
  await L.shot(sess, 'T6-03-create-form-filled')
  L.writeState({ purchaseFormInfo: { ptype, wh, dateVal, totalsText, rowText, cnt } })
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /create purchase/i }).click({ timeout: 8000 })
  await page.waitForTimeout(6000)
  const toast = await L.readToasts(page)
  const bannerErr = (await page.locator('.bg-red-50, [role="alert"]').allInnerTexts().catch(() => [])).join(' | ').slice(0, 300)
  await L.shot(sess, 'T6-04-after-create')
  const url = page.url().replace(L.BASE, '')
  console.log(JSON.stringify({ ptype, wh, dateVal, totalsText, rowText: rowText.slice(0, 200), toast, bannerErr, url }))
  L.writeState({ purchaseAfterCreate: { toast, bannerErr, url } })
  if (/\/admin\/purchases\/[0-9a-f-]{20,}/.test(url) && !/create|edit/.test(url)) { L.writeState({ purchaseUrl: url }); L.addCreated('Purchase', 'QA-TEST-INV-1', { url }) }
  await L.closeSession(sess); await browser.close()
  L.saveTagged('T6', 'a', rows)
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
