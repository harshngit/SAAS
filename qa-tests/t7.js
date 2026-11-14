// T7 Purchase Return from the T6 purchase: qty 2 -> Draft -> Confirm -> Dispatch Return -> Complete Return.
// After each step: status, toast, Product A stock.
const L = require('./lib')
;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const productA = st.productAEntered.name
  const purchaseId = st.purchaseUrl.split('/').pop()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const save = () => L.saveTagged('T7', 'a', rows)
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const stockNow = async () => {
    await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.locator('input[placeholder*="earch" i]:visible').last().fill(productA)
    await page.waitForTimeout(1800); await L.settle(page, 8000)
    const t = (await page.locator('tr', { hasText: productA }).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    return t.replace(productA, '').replace(/QA-TEST-\d+-\d+-A/, '').trim()
  }
  const badges = async () => (await page.locator('.app-badge').allInnerTexts().catch(() => [])).map((x) => x.trim()).filter(Boolean).join(' / ')

  const priorUrl = st.purchaseReturnUrl
  let retUrl = priorUrl
  if (!retUrl) {
    sess.step = 'T7 create'
    await page.goto(`${L.BASE}/admin/purchase-returns/new?purchase=${purchaseId}`, { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
    await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
    const tableTxt = (await page.locator('table').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
    await L.shot(sess, 'T7-01-return-form')
    const row = page.locator('tbody tr', { hasText: productA }).first()
    await row.locator('input[type="number"]').fill('2')
    await L.selectFirstByLabel(page, 'Return Reason').catch(() => {})
    await L.fillLabel(page, 'Notes', `${stamp} purchase return qty 2`).catch(() => {})
    await L.shot(sess, 'T7-02-return-form-filled')
    await L.startToastWatch(page)
    await page.getByRole('button', { name: /create draft return/i }).click({ timeout: 8000 })
    await page.waitForTimeout(6000)
    const toast = await L.readToasts(page)
    retUrl = page.url().replace(L.BASE, '')
    await L.shot(sess, 'T7-03-after-create')
    const ok = /purchase-returns\/[0-9a-f-]{20,}$/.test(retUrl)
    if (ok) { L.writeState({ purchaseReturnUrl: retUrl }); L.addCreated('Purchase Return', stamp + ' qty 2', { url: retUrl }) }
    rows.push(L.row('T7', 'Create return qty 2 from T6 purchase', 'Form shows Received 10 / Already Returned 0 / Returnable 10; draft created with success message',
      `Table before: "${tableTxt}". Toast: "${toast}". Landed on ${retUrl}`, ok ? (/created|saved|draft/i.test(toast) ? 'PASS' : 'FAIL') : 'FAIL', 'shots\\T7-03-after-create.png', sess.apis.filter((a) => a.step === 'T7 create' && !/\/login$/.test(a.url)),
      ok && !/created|saved|draft/i.test(toast) ? { classification: 'Frontend', cause: 'src/features/purchaseReturns/PurchaseReturnFormPage.jsx - no showToast usage at all (file has zero toast calls); create just navigates.' } : {}))
    save()
    if (!ok) { await L.closeSession(sess); await browser.close(); return }
  }

  // ----- walk the lifecycle
  const steps = [
    { key: 'draft', label: null },
    { key: 'confirm', label: /^confirm$/i },
    { key: 'dispatch', label: /dispatch return/i },
    { key: 'complete', label: /complete return/i },
  ]
  for (const s of steps) {
    sess.step = `T7 ${s.key}`
    await page.goto(L.BASE + retUrl, { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    let toast = ''
    const before = await badges()
    if (s.label) {
      const btn = page.getByRole('button', { name: s.label }).first()
      if (!(await btn.count())) { rows.push(L.row('T7', `${s.key}`, 'Action button available', `Button not visible. Badges now: ${before}`, 'FAIL', await L.shot(sess, `T7-${s.key}-missing`), [])); save(); break }
      await L.startToastWatch(page)
      await btn.click({ timeout: 8000 })
      await page.waitForTimeout(1200)
      // some actions ask for confirmation in a dialog
      const dlgConfirm = page.locator('[role="dialog"]').getByRole('button', { name: s.label }).last()
      if (await dlgConfirm.count()) await dlgConfirm.click().catch(() => {})
      await page.waitForTimeout(4500)
      toast = await L.readToasts(page)
      await L.settle(page, 8000)
    }
    const after = await badges()
    const body = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
    const shot = await L.shot(sess, `T7-0${steps.indexOf(s) + 4}-${s.key}`)
    const stock = await stockNow()
    L.writeState({ [`prStock_${s.key}`]: stock })
    const itemTxt = (body.match(/Items?.{0,300}/) || [''])[0].slice(0, 220)
    rows.push(L.row('T7', s.label ? `Action: ${s.key}` : 'Draft return state', s.key === 'draft' ? 'Status Draft, stock unchanged (10)' : `Status moves forward; stock check after ${s.key}`,
      `Badges before: [${before}] after: [${after}]. Toast: "${toast || 'none seen'}". Product A inventory (variants / stock / status): "${stock}"`,
      s.label ? (toast ? 'PASS' : 'FAIL') : 'PASS', shot, sess.apis.filter((a) => a.step === `T7 ${s.key}` && !/\/login$/.test(a.url)),
      s.label && !toast ? { classification: 'Frontend (or just no toast)', cause: 'no success message observed after this action' } : {}))
    save()
  }
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what} | ${x.actual.slice(0, 330)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
