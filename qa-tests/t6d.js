// T6d - confirm the draft GRN from the row menu; verify stock + purchase receiving status
const L = require('./lib')
;(async () => {
  const st = L.readState()
  const productA = st.productAEntered.name
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
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
  sess.step = 'T6 grn confirm'
  await page.goto(L.BASE + st.purchaseUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('tab', { name: /goods receipts/i }).click({ timeout: 8000 }).catch(() => page.getByText('Goods Receipts').first().click())
  await page.waitForTimeout(1200)
  const grnRow = page.locator('tr', { hasText: 'GRN-' }).first()
  await grnRow.getByRole('button').last().click({ timeout: 8000 })
  await page.waitForTimeout(800)
  await L.shot(sess, 'T6-14-grn-row-menu')
  const items = (await page.getByRole('menuitem').allInnerTexts().catch(() => [])).map((t) => t.trim())
  console.log('menu items:', items.join(' | '))
  await L.startToastWatch(page)
  await page.getByRole('menuitem', { name: /confirm/i }).first().click({ timeout: 6000 })
  await page.waitForTimeout(1500)
  await L.shot(sess, 'T6-15-grn-confirm-click')
  const dlg = await page.locator('[role="dialog"]').last().innerText().catch(() => '')
  console.log('dialog:', dlg.replace(/\s+/g, ' ').slice(0, 400))
  const dlgBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm/i }).last()
  if (await dlgBtn.count()) { await dlgBtn.click({ timeout: 6000 }); await page.waitForTimeout(5000) }
  const toast = await L.readToasts(page)
  await L.shot(sess, 'T6-16-grn-confirmed')
  const body = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const grnStatus = (body.match(/GRN-[0-9A-Z-]+\s+\d+ \w+ \d+\s+[\w ]+?\s+\d+\s+\d+\s+\d+\s+(\w+)/) || [])[1]
  const recv = (body.match(/Receiving\s+([A-Za-z ]+?)\s+Amount Paid/) || [])[1]
  const s2 = await stock('17-after-grn-confirm')
  rows.push(L.row('T6', 'Confirm GRN (10 accepted)', 'GRN Confirmed, purchase Fully Received, Product A stock = 10',
    `Toast: "${toast}". GRN status text: ${grnStatus}. Purchase receiving card: ${recv}. Product A inventory row: "${s2.t}"`,
    /\b10\b/.test(s2.t.replace(productA, '').replace(/QA-TEST-\d+-\d+(-A)?/g, '')) ? 'PASS' : 'FAIL', s2.shot, sess.apis.filter((a) => a.step === 'T6 grn confirm' && !/\/login$/.test(a.url))))
  L.saveTagged('T6', 'd', rows)
  L.writeState({ productAStockAfterGrn: s2.t })
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} ${x.what}: ${x.actual}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
