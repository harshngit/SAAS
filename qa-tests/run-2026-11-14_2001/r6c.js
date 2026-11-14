// R6c: Supplier Invoice New - pick Invoice Date + Due Date in the custom calendar, Save Draft, verify saved dates.
const L = require('./lib')
const H = require('./h')

;(async () => {
  const stamp = L.stamp()
  const st = L.readState()
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }

  sess.step = 'R6 supplier invoice'
  await page.goto(L.BASE + '/admin/supplier-invoices/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {})
  await L.selectByLabel(page, 'Supplier', stamp, { exact: false })
  await page.waitForTimeout(1500)
  await L.fillLabel(page, 'Supplier Invoice Number', `QA-TEST-SINV-${stamp.slice(-4)}`)
  await L.selectByLabel(page, 'Purchase Reference', st.purchaseNo || 'PO-', { exact: false })
  await page.waitForTimeout(1500)
  const nativeN = await H.nativeDateCount(page)
  const inv = await H.pickDay(page, 'Invoice Date', 10)
  const due = await H.pickDay(page, 'Due Date', 20)
  await L.shot(sess, 'R6-supplier-invoice-dates-picked')
  let created = null
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && /\/supplier-invoices$/.test(res.url().split('?')[0]) && res.url().startsWith(L.API)) { try { created = await res.json() } catch { /* ignore */ } }
  })
  await L.startToastWatch(page)
  await page.getByRole('button', { name: /^save draft$/i }).click({ timeout: 8000 })
  for (let i = 0; i < 40 && /supplier-invoices\/new/.test(page.url()); i++) await page.waitForTimeout(500)
  await page.waitForTimeout(1500)
  const toast = await L.readToasts(page)
  const url = page.url().replace(L.BASE, '')
  const saved = !/\/new/.test(url)
  const formErr = saved ? '' : (await page.locator('.bg-red-50').allInnerTexts().catch(() => [])).join(' | ').slice(0, 300)
  await L.shot(sess, 'R6-supplier-invoice-saved')
  const apiInv = created ? String(created.invoice_date || '').slice(0, 10) : ''
  const apiDue = created ? String(created.due_date || '').slice(0, 10) : ''
  let detail = ''
  if (saved) { await L.settle(page, 12000); detail = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' '); L.addCreated('Supplier Invoice', `QA-TEST-SINV-${stamp.slice(-4)}`, { url }) }
  const uiInv = H.hasDate(detail, inv.iso), uiDue = H.hasDate(detail, due.iso)
  rows.push(L.row('R6', 'Supplier Invoice New: Invoice Date + Due Date calendars + saved dates', `App calendar; native 0; saved ${inv.iso} / ${due.iso}`,
    `native date inputs=${nativeN}; picked "${inv.after}" / "${due.after}"; API invoice_date="${apiInv || 'n/a'}", due_date="${apiDue || 'n/a'}"; detail shows dates: ${uiInv}/${uiDue}; saved=${saved} (${url}); form error="${formErr || 'none'}"; toast="${toast || 'none seen'}"`,
    nativeN === 0 && saved && (apiInv ? apiInv === inv.iso : uiInv) && (apiDue ? apiDue === due.iso : uiDue) ? 'PASS' : 'FAIL', 'shots\\R6-supplier-invoice-dates-picked.png',
    sess.apis.filter((a) => a.step === 'R6 supplier invoice' && !/\/login$/.test(a.url)),
    { classification: 'Frontend', cause: 'src/components/ui/Input.jsx DatePicker -> src/features/supplierInvoices/SupplierInvoiceForm.jsx invoiceDate/dueDate' }))
  L.saveTagged('R6', 'c', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 700)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 3).join(' | ')); process.exit(1) })
