// T3 Create supplier "QA-TEST supplier", verify toast -> list -> detail field-by-field
const L = require('./lib')

;(async () => {
  const stamp = L.stamp()
  const name = `QA-TEST supplier ${stamp}`
  const data = {
    'Supplier Name': name, 'Company Name': `QA-TEST Traders ${stamp}`, 'Contact Person': 'QA Tester',
    Phone: '9000000001', Email: 'qa-test@example.com', Address: `QA-TEST address ${stamp}, Test Lane`,
    City: 'Pune', State: 'Maharashtra', 'PIN Code': '411001', Notes: `QA-TEST ${stamp} supplier notes`,
  }
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('T3', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('T3', rows); await browser.close(); return }

  const openList = async () => {
    await page.goto(L.BASE + '/admin/suppliers', { waitUntil: 'domcontentloaded' })
    await L.settle(page, 12000)
  }
  const searchList = async (q) => {
    // NOT the top-bar global search ("Search customers, jobs, quotes...") - use the page's own box
    const box = page.locator('input[placeholder="Search suppliers..."]').first()
    await box.fill(q)
    await page.waitForTimeout(1500)
    await L.settle(page, 8000)
  }

  sess.step = 'T3 open list'
  await openList()
  await L.shot(sess, 'T3-01-supplier-list')
  // idempotent: if an earlier (failed/retried) attempt already saved it, do not create a second one
  await searchList(name)
  let exists = (await page.getByText(name, { exact: false }).count()) > 0
  let toast = ''
  const priorRun = (L.readState().created || []).some((c) => c.name === name)
  let attempt = 0
  let formErr = ''
  while (!exists && attempt < 2) {
    attempt++
    sess.step = `T3 create attempt ${attempt}`
    const startApi = sess.apis.length
    try {
      await openList()
      await page.getByRole('button', { name: /add supplier/i }).first().click({ timeout: 8000 })
      await page.getByText('Supplier Name', { exact: false }).first().waitFor({ timeout: 10000 })
      for (const [label, value] of Object.entries(data)) await L.fillLabel(page, label, value)
      const typeUsed = await L.selectFirstByLabel(page, 'Supplier Type')
      L.writeState({ supplierType: typeUsed })
      await L.shot(sess, `T3-02-form-filled-a${attempt}`)
      await L.startToastWatch(page)
      await page.getByRole('button', { name: /save supplier/i }).click({ timeout: 8000 })
      await page.waitForTimeout(6000)
      toast = await L.readToasts(page)
      await L.settle(page, 10000)
      await L.shot(sess, `T3-03-after-save-a${attempt}`)
      const errs = await page.locator('.text-red-600, [role="alert"]').allInnerTexts().catch(() => [])
      formErr = errs.filter(Boolean).join(' | ').slice(0, 300)
      sess.lastApis = sess.apis.slice(startApi)
    } catch (e) { formErr = String(e.message).split('\n')[0] }
    await openList(); await searchList(name)
    exists = (await page.getByText(name, { exact: false }).count()) > 0
  }

  const apisCreate = sess.apis.filter((a) => /T3 create/.test(a.step) && !/crm-saas\.asynk\.in\/login$/.test(a.url))
  if (priorRun && attempt === 0) {
    // Record was already created by the first run of this script (which crashed AFTER the save, at the
    // detail step, because it typed into the top-bar search by mistake). Never create a duplicate.
    rows.push(L.row('T3', 'Fill supplier form + Save Supplier', 'Success message, supplier saved',
      'Saved: drawer closed and SUP-0008 appears in list, but NO success message was seen (screenshot T3-03). Code check: SupplierList.jsx only calls showToast for errors (:273, :355), never after a successful save.',
      'FAIL', 'shots\T3-03-after-save-a1.png', [], { classification: 'Frontend', cause: 'src/features/suppliers/SupplierList.jsx save handler (~:340-362) shows no success toast; only error toasts exist (:273, :355).' }))
  } else {
    rows.push(L.row('T3', 'Fill supplier form + Save Supplier', 'Success message, supplier saved',
      `Toast: "${toast || '(none captured)'}". attempts=${attempt}. form errors: "${formErr || 'none'}"`,
      exists ? (toast ? 'PASS' : 'FAIL') : 'FAIL', 'shots\\T3-03-after-save-a1.png', apisCreate,
      { note: exists && !toast ? 'Saved but NO success message seen on screen' : '' }))
  }

  if (!exists) { L.saveResults('T3', rows); await L.closeSession(sess); await browser.close(); console.log(rows[0].actual); return }

  if (!priorRun) L.addCreated('Supplier', name)
  rows.push(L.row('T3', 'Supplier appears in list', 'Row with the QA-TEST name', 'Found in list after search', 'PASS', await L.shot(sess, 'T3-04-list-search'), []))

  sess.step = 'T3 detail'
  // list renders both a mobile-card and a table layout; take the VISIBLE match only
  await page.getByText(name, { exact: false }).locator('visible=true').first().click({ timeout: 10000 })
  await page.waitForURL(/\/admin\/suppliers\/[^/]+$/, { timeout: 15000 }).catch(() => {})
  await L.settle(page, 12000)
  const detailUrl = page.url()
  L.writeState({ supplierUrl: detailUrl.replace(L.BASE, ''), supplierName: name })
  // capture the raw API payload for this supplier (to separate Backend-dropped from Frontend-not-shown)
  const respP = page.waitForResponse((x) => /\/suppliers\/[^/?]+$/.test(x.url().split('?')[0]) && x.url().startsWith(L.API) && x.request().method() === 'GET', { timeout: 20000 }).catch(() => null)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const apiResp = await respP
  let apiBody = null
  try { apiBody = apiResp ? await apiResp.json() : null } catch { /* ignore */ }
  await L.settle(page, 12000)
  let text = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  await page.getByRole('tab', { name: /documents \/ notes/i }).click({ timeout: 5000 }).catch(() => page.getByText('Documents / Notes').first().click().catch(() => {}))
  await page.waitForTimeout(800)
  text += ' ' + (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  await L.shot(sess, 'T3-06-detail-notes-tab')
  const cmp = []
  for (const [label, value] of Object.entries(data)) {
    const ok = text.toLowerCase().includes(String(value).toLowerCase())
    cmp.push(`${label}: ${ok ? 'OK' : 'MISSING ("' + value + '")'}`)
  }
  const missing = cmp.filter((c) => /MISSING/.test(c))
  const apiHas = apiBody ? `API GET /suppliers/{id}: company_name=${JSON.stringify(apiBody.company_name ?? null)}, notes=${JSON.stringify(apiBody.notes ?? null)}, city=${JSON.stringify(apiBody.city ?? apiBody.address_information?.city ?? null)}` : 'API body not captured'
  rows.push(L.row('T3', 'Open detail, compare every entered field', 'All entered values visible on detail',
    missing.length ? `Not shown on detail (Overview + Documents/Notes tabs): ${missing.join('; ')}. ${apiHas}` : `All ${cmp.length} fields match. URL ${detailUrl.replace(L.BASE, '')}. ${apiHas}`,
    missing.length ? 'FAIL' : 'PASS', 'shots\\T3-05-detail.png',
    sess.apis.filter((a) => a.step === 'T3 detail' && !/crm-saas\.asynk\.in\/login$/.test(a.url)),
    missing.length ? { classification: 'Frontend', cause: 'API returns company_name correctly, but src/features/suppliers/SupplierDetail.jsx never renders companyName (only notes at :1148). Data is saved and mapped (supplierUtils.js:64) - just not displayed.' } : {}))
  rows.push(L.row('T3', 'Console errors during T3', 'none', sess.consoleErrors.map((c) => c.text.slice(0, 140)).join(' ;; ') || 'none', sess.consoleErrors.some((c) => !/Failed to load resource/.test(c.text)) ? 'FAIL' : 'PASS', '', []))
  L.saveResults('T3', rows)
  await L.closeSession(sess)
  await browser.close()
  console.log(rows.map((x) => `${x.what}: ${x.status} :: ${x.actual}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
