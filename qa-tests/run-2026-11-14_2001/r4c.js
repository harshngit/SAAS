// R4c/R6: Purchase Return new (pick Return Date in custom calendar) -> Create Draft Return (toast) -> Confirm -> Dispatch -> Complete (toast each).
const L = require('./lib')
const H = require('./h')

;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const productD = st.productDName
  const purchaseId = st.purchaseUrl.split('/').pop()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows4 = [], rows6 = []
  const save = () => { L.saveTagged('R4', 'c', rows4); L.saveTagged('R6', 'c', rows6) }
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }

  let retUrl = st.purchaseReturnUrl
  if (!retUrl) {
    sess.step = 'R4 return create'
    await page.goto(`${L.BASE}/admin/purchase-returns/new?purchase=${purchaseId}`, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
    await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
    const nativeN = await H.nativeDateCount(page)
    const pick = await H.pickDay(page, 'Return Date', 10)
    await L.shot(sess, 'R6-return-new-date-picked')
    const row = page.locator('tbody tr', { hasText: productD }).first()
    await row.locator('input[type="number"]').fill('1')
    await L.selectFirstByLabel(page, 'Return Reason').catch(() => {})
    await L.fillLabel(page, 'Notes', `${stamp} purchase return qty 1`).catch(() => {})
    await L.shot(sess, 'R4-08-return-form-filled')
    let created = null
    page.on('response', async (res) => {
      if (res.request().method() === 'POST' && /\/purchase-returns$/.test(res.url().split('?')[0]) && res.url().startsWith(L.API)) {
        try { created = await res.json() } catch { /* ignore */ }
      }
    })
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /create draft return/i }).click({ timeout: 8000 })
    for (let i = 0; i < 30 && !/purchase-returns\/[0-9a-f-]{20,}$/.test(page.url()); i++) await page.waitForTimeout(500)
    await page.waitForTimeout(1500)
    const toast = await L.readToasts(page)
    retUrl = page.url().replace(L.BASE, '')
    const ok = /purchase-returns\/[0-9a-f-]{20,}$/.test(retUrl)
    const shot = await L.shot(sess, 'R4-09-return-created')
    if (ok) { L.writeState({ purchaseReturnUrl: retUrl, returnDatePicked: pick.iso }); L.addCreated('Purchase Return', `${stamp} qty 1`, { url: retUrl }) }
    const apiDate = created ? String(created.return_date || created.returnDate || '').slice(0, 10) : ''
    rows4.push(L.row('R4', 'Purchase Return create: Create Draft Return', 'Draft created + success toast', `toast="${toast || 'none seen'}"; landed on ${retUrl}`,
      ok && /created|draft/i.test(toast) ? 'PASS' : 'FAIL', shot, sess.apis.filter((a) => a.step === 'R4 return create' && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/purchaseReturns/PurchaseReturnFormPage.jsx handleSubmit (toast after navigate)' }))
    rows6.push(L.row('R6', 'Purchase Return New: Return Date calendar + saved date', `App calendar opens, native inputs 0, saved return_date = ${pick.iso}`,
      `native date inputs=${nativeN}; picked "${pick.after}" (iso ${pick.iso}); API return_date="${apiDate || 'not captured'}"`,
      nativeN === 0 && /^\d{2}-\d{2}-\d{4}$/.test(pick.after) && (apiDate ? apiDate === pick.iso : true) ? 'PASS' : 'FAIL', 'shots\\R6-return-new-date-picked.png', [],
      { classification: apiDate && apiDate !== pick.iso ? 'Frontend/Backend (date mismatch)' : 'Frontend', cause: 'src/components/ui/Input.jsx DatePicker -> PurchaseReturnFormPage returnDate' }))
    save()
    if (!ok) { await L.closeSession(sess); await browser.close(); console.log(rows4[0].actual); return }
  }

  const steps = [
    { key: 'confirm', label: /^confirm$/i, re: /confirmed/i, title: 'Confirm' },
    { key: 'dispatch', label: /dispatch return/i, re: /dispatched/i, title: 'Dispatch Return' },
    { key: 'complete', label: /complete return/i, re: /completed/i, title: 'Complete Return' },
  ]
  for (const s of steps) {
    sess.step = `R4 return ${s.key}`
    await page.goto(L.BASE + retUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    const btn = page.getByRole('button', { name: s.label }).first()
    if (!(await btn.count())) { rows4.push(L.row('R4', `Purchase Return ${s.title}`, 'Action button available', 'button not visible', 'FAIL', await L.shot(sess, `R4-ret-${s.key}-missing`), [])); save(); break }
    await L.startToastWatch(page)
    const done = page.waitForResponse((x) => x.request().method() === 'POST' && x.url().startsWith(L.API) && new RegExp(`/purchase-returns/[^/]+/${s.key}$`).test(x.url().split('?')[0]), { timeout: 40000 }).catch(() => null)
    await btn.click({ timeout: 8000 })
    await page.waitForTimeout(1200)
    const dlg = page.locator('[role="dialog"]').getByRole('button', { name: s.label }).last()
    if (await dlg.count()) await dlg.click().catch(() => {})
    const resp = await done
    await page.waitForTimeout(1500)
    const toast = await L.readToasts(page)
    const badge = (await page.locator('.app-badge').allInnerTexts().catch(() => [])).map((x) => x.trim()).filter(Boolean).join(' / ')
    rows4.push(L.row('R4', `Purchase Return ${s.title}`, 'Status moves forward + success toast', `API ${resp ? resp.status() : 'no response'}; toast="${toast || 'none seen'}"; badges now: ${badge}`,
      resp && resp.status() < 400 && s.re.test(toast) ? 'PASS' : 'FAIL', await L.shot(sess, `R4-ret-${s.key}`), sess.apis.filter((a) => a.step === `R4 return ${s.key}` && !/\/login$/.test(a.url)),
      { classification: 'Frontend', cause: 'src/features/purchaseReturns/PurchaseReturnDetail.jsx runRealAction(successTitle)' }))
    save()
  }
  await L.closeSession(sess); await browser.close()
  console.log([...rows4, ...rows6].map((x) => `${x.status} | ${x.test} ${x.what}\n   ${x.actual.slice(0, 400)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
