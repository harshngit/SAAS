// T6c - save Draft GRN (10 received), confirm GRN, verify Product A stock + purchase receiving status
const L = require('./lib')
;(async () => {
  const st = L.readState()
  const productA = st.productAEntered.name
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const save = () => L.saveTagged('T6', 'c', rows)
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const stock = async (label) => {
    await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.locator('input[placeholder*="earch" i]:visible').last().fill(productA)
    await page.waitForTimeout(1800); await L.settle(page, 8000)
    const shot = await L.shot(sess, `T6-${label}-inventory`)
    const t = (await page.locator('tr', { hasText: productA }).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    return { t, shot }
  }
  const openReceipts = async () => {
    await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.getByRole('tab', { name: /goods receipts/i }).click({ timeout: 8000 }).catch(() => page.getByText('Goods Receipts').first().click())
    await page.waitForTimeout(1200)
  }
  await openReceipts()
  const hasGrn = (await page.getByText(/GRN-/).count()) > 0
  if (!hasGrn) {
    sess.step = 'T6 grn save'
    await page.getByRole('button', { name: /receive goods|create grn|create goods receipt|receive/i }).first().click({ timeout: 8000 })
    await page.waitForTimeout(1200)
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /save draft grn/i }).click({ timeout: 8000 })
    await page.waitForTimeout(5000)
    const toast = await L.readToasts(page)
    await L.shot(sess, 'T6-11-grn-draft-saved')
    L.addCreated('GRN (draft)', st.purchaseNo || 'PO of QA-TEST-INV-1')
    rows.push(L.row('T6', 'Save Draft GRN (received 10)', 'Draft GRN created, toast, stock unchanged', `Toast: "${toast}"`, /Draft/i.test(toast) ? 'PASS' : 'FAIL', 'shots\\T6-11-grn-draft-saved.png', sess.apis.filter((a) => a.step === 'T6 grn save')))
    const s1 = await stock('12-after-draft-grn')
    rows.push(L.row('T6', 'Product A stock after DRAFT GRN', 'Still 0 (draft must not add stock)', s1.t, /\s0\s+0\s+Out of Stock|Out of Stock/i.test(s1.t) ? 'PASS' : 'FAIL', s1.shot, []))
    save()
  }
  // confirm GRN
  sess.step = 'T6 grn confirm'
  await openReceipts()
  await L.shot(sess, 'T6-13-grn-list')
  const btns = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
  console.log('buttons:', btns.join(' | '))
  const confirmBtn = page.getByRole('button', { name: /confirm( grn| receipt)?$/i }).first()
  if (await confirmBtn.count()) {
    await L.startToastWatch(page)
    await confirmBtn.click({ timeout: 8000 })
    await page.waitForTimeout(1500)
    await L.shot(sess, 'T6-14-grn-confirm-dialog')
    const dlgBtns = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
    console.log('after click buttons:', dlgBtns.join(' | '))
  }
  save()
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
