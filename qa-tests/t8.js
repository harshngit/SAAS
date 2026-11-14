// T8 Expenses: screenshot Add button position, add "QA-TEST expense" amount 1, verify list + detail
const L = require('./lib')
;(async () => {
  const stamp = L.stamp()
  const desc = `QA-TEST expense ${stamp}`
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const openList = async () => { await page.goto(L.BASE + '/admin/expenses', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000) }
  const search = async (q) => { const b = page.locator('input[placeholder*="earch" i]:visible').last(); await b.fill(q); await page.waitForTimeout(1800); await L.settle(page, 8000) }

  sess.step = 'T8 list'
  await openList()
  const addBtn = page.getByRole('button', { name: /add expense/i }).first()
  const box = await addBtn.boundingBox()
  const vp = page.viewportSize()
  const shotList = await L.shot(sess, 'T8-01-expenses-list-add-button')
  rows.push(L.row('T8', 'Add Expense button position', 'Visible, sensible place (top-right of table header)',
    box ? `Button at x=${Math.round(box.x)}, y=${Math.round(box.y)}, ${Math.round(box.width)}x${Math.round(box.height)} on a ${vp.width}x${vp.height} viewport (right edge ${Math.round(box.x + box.width)}px)` : 'not found',
    box ? 'INFO' : 'FAIL', shotList, []))

  await search(desc)
  let exists = (await page.getByText(desc).locator('visible=true').count()) > 0
  const priorRun = (L.readState().created || []).some((c) => c.kind === 'Expense')
  let toast = '', formErr = '', attempt = 0, entered = {}
  while (!exists && attempt < 2) {
    attempt++
    sess.step = `T8 create a${attempt}`
    try {
      await openList()
      await page.getByRole('button', { name: /add expense/i }).first().click({ timeout: 8000 })
      await page.getByText('Expense Category').first().waitFor({ timeout: 8000 })
      await page.waitForTimeout(1200)
      entered.category = await L.selectFirstByLabel(page, 'Expense Category')
      await L.fillLabel(page, 'Amount', '1'); entered.amount = '1'
      const d = await L.fieldByLabel(page, 'Expense Date').inputValue().catch(() => '')
      entered.date = d
      if (!d) { const today = new Date().toISOString().slice(0, 10); await L.fillLabel(page, 'Expense Date', today); entered.date = today }
      entered.mode = await L.selectFirstByLabel(page, 'Payment Mode').catch(() => '(n/a)')
      await L.fillLabel(page, 'Description / Purpose', desc); entered.desc = desc
      await L.shot(sess, `T8-02-form-filled-a${attempt}`)
      await L.startToastWatch(page)
      await page.locator('[role="dialog"], form').last().getByRole('button', { name: /^add expense$/i }).click({ timeout: 8000 })
      await page.waitForTimeout(6000)
      toast = await L.readToasts(page)
      formErr = (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').slice(0, 300)
      await L.shot(sess, `T8-03-after-save-a${attempt}`)
    } catch (e) { formErr = String(e.message).split('\n')[0]; await L.shot(sess, `T8-ERR-a${attempt}`) }
    await openList(); await search(desc)
    exists = (await page.getByText(desc).locator('visible=true').count()) > 0
  }
  if (attempt > 0) { L.addCreated('Expense', desc); L.writeState({ expenseEntered: entered }) }
  entered = attempt > 0 ? entered : (L.readState().expenseEntered || {})
  const okToast = /added|recorded|submitted|created/i.test(toast)
  if (attempt === 0 && !priorRun) rows.push(L.row('T8', 'Expense', 'exists', 'unexpected state', 'FAIL', '', []))
  else rows.push(L.row('T8', 'Add expense "QA-TEST expense" amount 1', 'Saved, success message',
    attempt === 0 ? 'Saved in an earlier run of this script' : `Toast: "${toast || 'none'}". form error: "${formErr || 'none'}". attempts=${attempt}`,
    exists ? (okToast || attempt === 0 ? 'PASS' : 'FAIL') : 'FAIL', 'shots\\T8-03-after-save-a1.png', sess.apis.filter((a) => /T8 create/.test(a.step) && !/\/login$/.test(a.url))))
  if (!exists) { L.saveResults('T8', rows); await L.closeSession(sess); await browser.close(); console.log(rows.map((x) => `${x.status} | ${x.what} | ${x.actual}`).join('\n')); return }

  const rowTxt = (await page.locator('tr', { hasText: desc }).first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  rows.push(L.row('T8', 'Expense appears in list with amount 1', 'Row with description, ₹1, category', `Row: "${rowTxt}"`, /₹\s?1(\.00)?\b/.test(rowTxt) ? 'PASS' : 'FAIL', await L.shot(sess, 'T8-04-list-search'), []))
  sess.step = 'T8 detail'
  await page.locator('tr', { hasText: desc }).first().click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const detail = (await page.locator('[role="dialog"]').last().innerText().catch(() => '')).replace(/\s+/g, ' ')
  const miss = [desc, entered.category, '1'].filter((v) => v && !detail.includes(v))
  rows.push(L.row('T8', 'Open expense detail, compare', 'Category, amount, date, description match', detail ? (miss.length ? `Missing: ${miss.join(', ')}. Detail text: "${detail.slice(0, 300)}"` : `Matches. Detail: "${detail.slice(0, 300)}"`) : 'No detail dialog opened by clicking the row', detail && !miss.length ? 'PASS' : 'FAIL', await L.shot(sess, 'T8-05-detail'), sess.apis.filter((a) => a.step === 'T8 detail' && !/\/login$/.test(a.url))))
  L.saveResults('T8', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what} | ${x.actual.slice(0, 380)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
