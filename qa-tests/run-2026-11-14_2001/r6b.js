// R6b: Quotation New - create a QA-TEST customer via Quick Add, pick Quotation Date + Valid Until in the custom calendar,
// save the quotation, verify the saved dates (API response + detail).
const L = require('./lib')
const H = require('./h')

;(async () => {
  const stamp = L.stamp()
  const productD = L.readState().productDName
  const custName = `QA-TEST customer ${stamp}`
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }

  sess.step = 'R6 quotation'
  await page.goto(L.BASE + '/admin/quotations/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
  // Quick Add Customer (QA-TEST customer, fake contact data)
  await page.getByRole('button', { name: /quick add customer/i }).click({ timeout: 8000 })
  await page.getByText('Create Customer & Continue').waitFor({ timeout: 8000 })
  await L.fillLabel(page, 'Customer Name', custName)
  await page.getByPlaceholder('Enter mobile number').fill('9000000001')
  await L.fillLabel(page, 'Contact Person', 'QA Tester')
  if (await page.getByPlaceholder('Enter full billing address').count()) await page.getByPlaceholder('Enter full billing address').fill(`QA-TEST address ${stamp}`)
  await page.getByRole('button', { name: /create customer/i }).click({ timeout: 8000 })
  await page.getByText('Create Customer & Continue').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  L.addCreated('Customer', custName)
  const custShown = (await page.locator('main, body').first().innerText()).includes(custName)

  await L.selectFirstByLabel(page, 'Salesperson').catch(() => {})
  const nativeN = await H.nativeDateCount(page)
  const q = await H.pickDay(page, 'Quotation Date', 10)
  const v = await H.pickDay(page, 'Valid Until', 20)
  await L.shot(sess, 'R6-quotation-dates-picked')
  // product
  await page.locator('input[placeholder^="Search products"]').first().fill(productD)
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: new RegExp(`^Add .*${productD.slice(-12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().click({ timeout: 8000 }).catch(async () => {
    await page.getByRole('button', { name: /^Add QA-TEST Product D/ }).first().click({ timeout: 8000 })
  })
  await page.waitForTimeout(800)
  await L.shot(sess, 'R6-quotation-filled')
  let created = null
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && /\/quotations$/.test(res.url().split('?')[0]) && res.url().startsWith(L.API)) { try { created = await res.json() } catch { /* ignore */ } }
  })
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /save quotation/i }).click({ timeout: 8000 })
  for (let i = 0; i < 40 && /quotations\/new/.test(page.url()); i++) await page.waitForTimeout(500)
  await page.waitForTimeout(1500)
  const toast = await L.readToasts(page)
  const url = page.url().replace(L.BASE, '')
  const saved = !/\/new/.test(url)
  const formErr = saved ? '' : (await page.locator('.bg-red-50, .text-red-600').allInnerTexts().catch(() => [])).join(' | ').slice(0, 250)
  await L.shot(sess, 'R6-quotation-saved')
  const apiQ = created ? String(created.quotation_date || created.date || '').slice(0, 10) : ''
  const apiV = created ? String(created.valid_until || '').slice(0, 10) : ''
  let detail = ''
  if (saved) {
    await L.settle(page, 12000)
    detail = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
    L.addCreated('Quotation', `for ${custName}`, { url })
  }
  const uiQ = H.hasDate(detail, q.iso), uiV = H.hasDate(detail, v.iso)
  rows.push(L.row('R6', 'Quotation New: Quotation Date + Valid Until calendars + saved dates', `App calendar; native 0; saved ${q.iso} / ${v.iso}`,
    `customer quick-added & shown=${custShown}; native date inputs=${nativeN}; picked "${q.after}" / "${v.after}"; API quotation_date="${apiQ || 'n/a'}", valid_until="${apiV || 'n/a'}"; detail shows dates: ${uiQ}/${uiV}; saved=${saved} (${url}); form error="${formErr || 'none'}"; toast="${toast || 'none seen'}"`,
    nativeN === 0 && saved && (apiQ ? apiQ === q.iso : uiQ) && (apiV ? apiV === v.iso : uiV) ? 'PASS' : 'FAIL', 'shots\\R6-quotation-dates-picked.png',
    sess.apis.filter((a) => a.step === 'R6 quotation' && !/\/login$/.test(a.url)),
    { classification: 'Frontend', cause: 'src/components/ui/Input.jsx DatePicker -> src/features/quotations/QuotationFormPage.jsx quotationDate/validUntil (min prop)' }))
  L.saveTagged('R6', 'b', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 700)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 4).join(' | '), String(e.stack).split('\n').find((l) => /r6b\.js/.test(l))); process.exit(1) })
