// R4b/R6/R7: Purchase create (pick a date in the custom calendar, check toast + saved date), "Return Items" visibility
// before/after GRN confirm, GRN modal calendar opens, Confirm Purchase toast, GRN draft + confirm.
const L = require('./lib')
const H = require('./h')

;(async () => {
  const stamp = L.stamp()
  const st0 = L.readState()
  const supplierName = st0.supplierName, productD = st0.productDName
  if (!supplierName || !productD) throw new Error('need supplier + Product D from r4a')
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows4 = [], rows6 = [], rows7 = []
  const save = () => { L.saveTagged('R4', 'b', rows4); L.saveTagged('R6', 'b', rows6); L.saveTagged('R7', 'b', rows7) }
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const returnBtn = () => page.getByRole('button', { name: /^return items$/i }).locator('visible=true').count()

  let purchaseUrl = st0.purchaseUrl
  if (!purchaseUrl) {
    sess.step = 'R4 purchase create'
    await page.goto(L.BASE + '/admin/purchases/create', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
    await page.waitForFunction(() => !/Loading.../.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
    await L.selectByLabel(page, 'Supplier', stamp, { exact: false })
    await page.waitForTimeout(1200)
    await L.selectFirstByLabel(page, 'Purchase Type').catch(() => {})
    // R6: custom calendar on Purchase Create
    const nativeBefore = await H.nativeDateCount(page)
    const pick = await H.pickDay(page, 'Purchase Date', 10)
    await L.shot(sess, 'R6-purchase-create-date-picked')
    await L.fillLabel(page, 'Supplier Reference / Invoice Number', 'QA-TEST-INV-2')
    await L.selectFirstByLabel(page, 'Warehouse').catch(() => {})
    await L.fillLabel(page, 'Notes', `${stamp} purchase for Product D`).catch(() => {})
    const row = page.locator('tbody tr').first()
    await row.locator('[data-select-trigger="true"]').first().click()
    await page.getByRole('option', { name: new RegExp(productD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click({ timeout: 8000 })
    await page.waitForTimeout(800)
    await row.locator('input[type="number"]').nth(0).fill('2')
    await row.locator('input[type="number"]').nth(1).fill('100')
    await page.waitForTimeout(600)
    await L.shot(sess, 'R4-03-purchase-form-filled')
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /create purchase/i }).click({ timeout: 8000 })
    await page.waitForTimeout(7000)
    const toast = await L.readToasts(page)
    const err = (await page.locator('.bg-red-50, [role="alert"]').allInnerTexts().catch(() => [])).join(' | ').slice(0, 250)
    const url = page.url().replace(L.BASE, '')
    const created = /\/admin\/purchases\/[0-9a-f-]{20,}/.test(url) && !/create|edit/.test(url)
    const shot = await L.shot(sess, 'R4-04-purchase-created')
    if (created) { L.writeState({ purchaseUrl: url, purchaseDatePicked: pick.iso }); L.addCreated('Purchase', 'QA-TEST-INV-2', { url }); purchaseUrl = url }
    rows4.push(L.row('R4', 'Purchase create: Create Purchase', 'Saved as Draft + success toast', `toast="${toast || 'none seen'}"; error="${err || 'none'}"; landed on ${url}`,
      created && /created|saved/i.test(toast) ? 'PASS' : 'FAIL', shot, sess.apis.filter((a) => a.step === 'R4 purchase create' && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceForm.jsx handleSubmit (toast after navigate)' }))
    rows6.push(L.row('R6', 'Purchase Create: Purchase Date calendar', 'App calendar (not the browser one) opens; no native date input; picked date is saved',
      `native date inputs visible=${nativeBefore}; trigger before="${pick.before}" after pick="${pick.after}" (iso ${pick.iso || '?'})`,
      nativeBefore === 0 && /^\d{2}-\d{2}-\d{4}$/.test(pick.after) ? 'PASS' : 'FAIL', 'shots\\R6-purchase-create-date-picked.png', [],
      { classification: 'Frontend', cause: 'src/components/ui/Input.jsx type="date" -> DatePicker' }))
    save()
    if (!created) { await L.closeSession(sess); await browser.close(); console.log(rows4[0].actual); return }
  }

  // ---- saved date on detail (R6)
  sess.step = 'R6 purchase detail'
  await page.goto(L.BASE + purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const d0 = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const picked = L.readState().purchaseDatePicked
  const saved = H.hasDate(d0, picked)
  const poNo = (d0.match(/PO-[0-9A-Z-]+/) || [''])[0]
  L.writeState({ purchaseNo: poNo })
  rows6.push(L.row('R6', 'Purchase Create: saved date', `Detail shows ${picked}`, `date found on detail=${saved}; detail excerpt="${(d0.match(/.{0,60}(Nov|2026).{0,60}/) || [''])[0]}"`,
    saved ? 'PASS' : 'FAIL', await L.shot(sess, 'R6-purchase-detail-date'), [], { classification: 'Frontend/Data', cause: 'DatePicker value -> PurchaseInvoiceForm purchaseDate payload' }))

  // ---- R7 before GRN
  const draftCount = await returnBtn()
  rows7.push(L.row('R7', '"Return Items" on a new DRAFT purchase', 'Not visible', `visible count=${draftCount}`, draftCount === 0 ? 'PASS' : 'FAIL', await L.shot(sess, 'R7-draft'), [],
    { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceDetail.jsx hasReceivedGoods gate on actions.includes("return")' }))

  // ---- confirm purchase
  sess.step = 'R4 purchase confirm'
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /confirm purchase/i }).click({ timeout: 8000 })
  await page.waitForTimeout(5000)
  const toastC = await L.readToasts(page)
  rows4.push(L.row('R4', 'Purchase Confirm', 'Confirmed + toast (existing behaviour)', `toast="${toastC}"`, /confirmed/i.test(toastC) ? 'PASS' : 'FAIL', await L.shot(sess, 'R4-05-purchase-confirmed'), sess.apis.filter((a) => a.step === 'R4 purchase confirm' && !/\/login$/.test(a.url))))
  await page.goto(L.BASE + purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const confirmedCount = await returnBtn()
  rows7.push(L.row('R7', '"Return Items" on CONFIRMED purchase before any GRN', 'Not visible', `visible count=${confirmedCount}`, confirmedCount === 0 ? 'PASS' : 'FAIL', await L.shot(sess, 'R7-confirmed-no-grn'), [],
    { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceDetail.jsx hasReceivedGoods' }))
  save()

  // ---- GRN
  sess.step = 'R4 grn'
  await page.getByRole('tab', { name: /goods receipts/i }).click({ timeout: 8000 }).catch(() => page.getByText('Goods Receipts').first().click())
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /receive goods|create grn|create goods receipt|receive/i }).first().click({ timeout: 8000 })
  await page.waitForTimeout(1500)
  // R6: GRN modal -> just check the calendar opens
  let grnCal = ''
  try {
    const nativeN = await H.nativeDateCount(page)
    const { trigger, before, popover } = await H.openCalendar(page, 'Receipt Date')
    const isCustom = (await popover.count()) > 0
    await L.shot(sess, 'R6-grn-modal-calendar')
    await trigger.click().catch(() => {}) // toggle closed (Escape would close the modal)
    grnCal = `custom calendar opened=${isCustom}; native inputs=${nativeN}; value shown="${before}"`
    rows6.push(L.row('R6', 'GRN modal: Receipt Date calendar', 'App calendar opens', grnCal, isCustom && nativeN === 0 ? 'PASS' : 'FAIL', 'shots\\R6-grn-modal-calendar.png', []))
  } catch (e) { rows6.push(L.row('R6', 'GRN modal: Receipt Date calendar', 'App calendar opens', `could not open: ${String(e.message).split('\n')[0]}`, 'FAIL', await L.shot(sess, 'R6-grn-modal-ERR'), [])) }
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /save draft grn/i }).click({ timeout: 8000 })
  await page.waitForTimeout(5000)
  const toastG = await L.readToasts(page)
  L.addCreated('GRN', `GRN for ${poNo}`)
  rows4.push(L.row('R4', 'GRN save draft (existing behaviour)', 'Draft GRN toast', `toast="${toastG}"`, /draft|saved|created/i.test(toastG) ? 'PASS' : 'FAIL', await L.shot(sess, 'R4-06-grn-draft'), sess.apis.filter((a) => a.step === 'R4 grn' && !/\/login$/.test(a.url))))
  const afterDraft = await returnBtn()
  rows7.push(L.row('R7', '"Return Items" with only a DRAFT GRN', 'Not visible (nothing received yet)', `visible count=${afterDraft}`, afterDraft === 0 ? 'PASS' : 'FAIL', await L.shot(sess, 'R7-draft-grn'), [],
    { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceDetail.jsx hasReceivedGoods' }))

  // confirm GRN from row menu
  sess.step = 'R4 grn confirm'
  await page.goto(L.BASE + purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('tab', { name: /goods receipts/i }).click({ timeout: 8000 }).catch(() => page.getByText('Goods Receipts').first().click())
  await page.waitForTimeout(1200)
  await page.locator('tr', { hasText: 'GRN-' }).first().getByRole('button').last().click({ timeout: 8000 })
  await page.waitForTimeout(800)
  await L.startToastWatch(page)
  await page.getByRole('menuitem', { name: /confirm/i }).first().click({ timeout: 6000 })
  await page.waitForTimeout(1500)
  const dlgBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm/i }).last()
  if (await dlgBtn.count()) { await dlgBtn.click({ timeout: 6000 }); await page.waitForTimeout(5000) }
  const toastGC = await L.readToasts(page)
  rows4.push(L.row('R4', 'GRN confirm (existing behaviour)', 'Confirmed toast', `toast="${toastGC}"`, /confirm/i.test(toastGC) ? 'PASS' : 'FAIL', await L.shot(sess, 'R4-07-grn-confirmed'), sess.apis.filter((a) => a.step === 'R4 grn confirm' && !/\/login$/.test(a.url))))
  await page.goto(L.BASE + purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const afterGrn = await returnBtn()
  rows7.push(L.row('R7', '"Return Items" AFTER GRN confirmed', 'Visible', `visible count=${afterGrn}`, afterGrn >= 1 ? 'PASS' : 'FAIL', await L.shot(sess, 'R7-after-grn'), [],
    { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceDetail.jsx hasReceivedGoods / getPurchaseActions' }))
  const stock = await H.stockRow(page, productD)
  L.writeState({ productDStockAfterGrn: stock })
  save()
  await L.closeSession(sess); await browser.close()
  console.log([...rows4, ...rows6, ...rows7].map((x) => `${x.status} | ${x.test} ${x.what}\n   ${x.actual.slice(0, 400)}`).join('\n'), '\nstock:', stock)
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
