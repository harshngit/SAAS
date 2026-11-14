// R6a: Expense Add modal (pick Expense Date, save, verify saved date) + Customer form (calendar opens only; nothing saved).
const L = require('./lib')
const H = require('./h')

;(async () => {
  const stamp = L.stamp()
  const desc = `QA-TEST expense ${stamp} date-check`
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }

  // ---------- Expense
  sess.step = 'R6 expense'
  await page.goto(L.BASE + '/admin/expenses', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('button', { name: /add expense/i }).first().click({ timeout: 8000 })
  await page.getByText('Expense Category').first().waitFor({ timeout: 8000 })
  await page.waitForTimeout(1200)
  await L.selectFirstByLabel(page, 'Expense Category')
  await L.fillLabel(page, 'Amount', '1')
  const nativeN = await H.nativeDateCount(page)
  const pick = await H.pickDay(page, 'Expense Date', 10)
  await L.shot(sess, 'R6-expense-date-picked')
  await L.selectFirstByLabel(page, 'Payment Mode').catch(() => {})
  await L.fillLabel(page, 'Description / Purpose', desc)
  let created = null
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && /\/expenses$/.test(res.url().split('?')[0]) && res.url().startsWith(L.API)) { try { created = await res.json() } catch { /* ignore */ } }
  })
  await L.startToastWatch(page)
  const done = page.waitForResponse((x) => x.request().method() === 'POST' && x.url().startsWith(L.API) && /\/expenses$/.test(x.url().split('?')[0]), { timeout: 40000 }).catch(() => null)
  await page.locator('[role="dialog"], form').last().getByRole('button', { name: /^add expense$/i }).click({ timeout: 8000 })
  const resp = await done
  await page.waitForTimeout(2000)
  const toast = await L.readToasts(page)
  await L.shot(sess, 'R6-expense-saved')
  const apiDate = created ? String(created.expense_date || created.date || '').slice(0, 10) : ''
  // reopen detail to compare the saved date as the UI shows it
  await page.goto(L.BASE + '/admin/expenses', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  const sb = page.locator('input[placeholder*="earch" i]:visible').last()
  await sb.fill(desc); await page.waitForTimeout(1800); await L.settle(page, 8000)
  const exists = (await page.getByText(desc).locator('visible=true').count()) > 0
  if (exists) L.addCreated('Expense', desc)
  let detail = ''
  if (exists) {
    await page.locator('tr', { hasText: desc }).first().click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(1500)
    detail = (await page.locator('[role="dialog"]').last().innerText().catch(() => '')).replace(/\s+/g, ' ')
  }
  const rowTxt = exists ? (await page.locator('tr', { hasText: desc }).first().innerText().catch(() => '')).replace(/\s+/g, ' ') : ''
  const uiHas = H.hasDate(detail + ' ' + rowTxt, pick.iso)
  await L.shot(sess, 'R6-expense-detail')
  rows.push(L.row('R6', 'Expense Add modal: Expense Date calendar + saved date', `App calendar; native 0; saved date = ${pick.iso}`,
    `native date inputs=${nativeN}; picked "${pick.after}" (iso ${pick.iso}); API expense_date="${apiDate || 'not captured'}" (POST ${resp ? resp.status() : 'no response'}); UI shows date=${uiHas}; toast="${toast || 'none seen'}"; in list=${exists}`,
    nativeN === 0 && exists && /^\d{2}-\d{2}-\d{4}$/.test(pick.after) && (apiDate ? apiDate === pick.iso : uiHas) ? 'PASS' : 'FAIL', 'shots\\R6-expense-date-picked.png',
    sess.apis.filter((a) => a.step === 'R6 expense' && !/\/login$/.test(a.url)),
    { classification: 'Frontend', cause: 'src/components/ui/Input.jsx DatePicker -> src/features/expenses/AdminExpenses.jsx expenseDate' }))

  // ---------- Customer form: calendar opens (nothing saved)
  sess.step = 'R6 customer form'
  await page.goto(L.BASE + '/admin/customers', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('button', { name: /add customer/i }).first().click({ timeout: 8000 })
  await page.waitForTimeout(2000)
  let calRow
  try {
    const nN = await H.nativeDateCount(page)
    const { trigger, before, popover } = await H.openCalendar(page, 'Customer Since')
    const custom = (await popover.count()) > 0
    await L.shot(sess, 'R6-customer-form-calendar')
    await trigger.click().catch(() => {})
    calRow = L.row('R6', 'Customer form: Customer Since calendar', 'App calendar opens (nothing saved)', `custom calendar opened=${custom}; native date inputs visible=${nN}; value shown="${before}"`,
      custom && nN === 0 ? 'PASS' : 'FAIL', 'shots\\R6-customer-form-calendar.png', sess.apis.filter((a) => a.step === 'R6 customer form' && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/customers/CustomerForm.jsx Input type="date" via src/components/ui/Input.jsx' })
  } catch (e) { calRow = L.row('R6', 'Customer form: Customer Since calendar', 'App calendar opens', `could not open: ${String(e.message).split('\n')[0]}`, 'FAIL', await L.shot(sess, 'R6-customer-form-ERR'), []) }
  rows.push(calRow)
  L.saveTagged('R6', 'a', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 500)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
