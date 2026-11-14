// T6b - purchase detail: totals, Confirm Purchase, prompt, GRN receive, confirm GRN; stock after each step
const L = require('./lib')
;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const productA = st.productAEntered.name
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const save = () => L.saveTagged('T6', 'b', rows)
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const info = st.purchaseFormInfo || {}
  const created = st.purchaseAfterCreate || {}

  const stock = async (label) => {
    await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.locator('input[placeholder*="earch" i]:visible').last().fill(productA)
    await page.waitForTimeout(1800); await L.settle(page, 8000)
    const shot = await L.shot(sess, `T6-${label}-inventory`)
    const t = (await page.locator('tr', { hasText: productA }).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    return { t, shot }
  }

  // --- create results
  rows.push(L.row('T6', 'Create purchase: Product A qty 10 x 100, invoice QA-TEST-INV-1', 'Totals 1000, saved as Draft, success message',
    `Form totals: ${info.totalsText}. Redirected to ${created.url}. Row text: "${(info.rowText || '').trim()}". Purchase Type chosen: ${info.ptype}, warehouse ${info.wh}, date ${info.dateVal}. Success message seen: ${/created|saved|success/i.test(created.toast || '') ? created.toast : 'NONE (only loader text: "' + created.toast + '")'}`,
    /created|saved|success/i.test(created.toast || '') ? 'PASS' : 'FAIL', 'shots\\T6-04-after-create.png', [],
    { classification: 'Frontend', cause: 'src/features/purchases/PurchaseInvoiceForm.jsx - the only showToast call is "Product already added" (:269); a successful Create Purchase just navigates to the detail page with no success message.' }))
  save()

  sess.step = 'T6 detail'
  await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const d0 = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const poNo = (d0.match(/PO-[0-9A-Z-]+/) || [''])[0]
  L.writeState({ purchaseNo: poNo })
  const detailOk = ['QA-TEST-INV-1', '1,000', 'Draft', 'Not Received', 'QA-TEST supplier'].filter((x) => !d0.includes(x))
  rows.push(L.row('T6', 'Purchase detail vs entered', 'Supplier, invoice no, totals 1,000, Draft, Not Received', detailOk.length ? `Missing: ${detailOk.join(', ')}` : `All match. Purchase # ${poNo}`, detailOk.length ? 'FAIL' : 'PASS', await L.shot(sess, 'T6-05-detail-draft'), []))

  // list check
  await page.goto(L.BASE + '/admin/purchases', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const lbox = page.locator('input[placeholder*="earch" i]:visible').last()
  await lbox.fill('QA-TEST-INV-1'); await page.waitForTimeout(1800); await L.settle(page, 8000)
  const inList = (await page.getByText(poNo).locator('visible=true').count()) > 0
  rows.push(L.row('T6', 'Purchase appears in list', 'Row PO + QA-TEST-INV-1', inList ? 'Found' : 'NOT found by search', inList ? 'PASS' : 'FAIL', await L.shot(sess, 'T6-06-list'), []))
  save()

  // --- confirm purchase
  sess.step = 'T6 confirm'
  await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /confirm purchase/i }).click({ timeout: 8000 })
  await page.waitForTimeout(4500)
  const toastC = await L.readToasts(page)
  const promptShown = (await page.getByText(/Confirming doesn.t move any stock/i).count()) > 0
  await L.shot(sess, 'T6-07-after-confirm')
  const statusC = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').match(/PURCHASE STATUS\s+(\w+)/i)?.[1]
  const stockC = await stock('08-after-confirm')
  rows.push(L.row('T6', 'Confirm Purchase', 'Status Confirmed, toast, prompt to receive goods, stock still 0 (no stock on confirm)',
    `Toast: "${toastC}". Prompt shown: ${promptShown}. Status now: ${statusC}. Product A inventory row: "${stockC.t}"`,
    /Purchase confirmed/i.test(toastC) && statusC && /confirmed/i.test(statusC) ? 'PASS' : 'FAIL', stockC.shot, sess.apis.filter((a) => a.step === 'T6 confirm')))
  save()

  // --- receive goods (GRN)
  sess.step = 'T6 grn'
  await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('tab', { name: /goods receipts/i }).click({ timeout: 8000 }).catch(() => page.getByText('Goods Receipts').first().click())
  await page.waitForTimeout(1200)
  await L.shot(sess, 'T6-09-grn-tab')
  const recvBtn = page.getByRole('button', { name: /receive goods|create grn|create goods receipt|receive/i }).first()
  await recvBtn.click({ timeout: 8000 })
  await page.waitForTimeout(1500)
  await L.shot(sess, 'T6-10-grn-modal')
  console.log('GRN modal opened; text:', (await page.locator('[role="dialog"], .fixed').last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 700))
  save()
  await L.closeSession(sess); await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
