// T9 Vehicle Stock (read-only screenshot) + T10 native date inputs on create pages (read-only; nothing submitted)
const L = require('./lib')
;(async () => {
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { console.log('login failed'); await browser.close(); return }
  const rows9 = []
  sess.step = 'T9'
  await page.goto(L.BASE + '/admin/vehicle-stock', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.waitForTimeout(1500)
  const txt = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const shot = await L.shot(sess, 'T9-01-vehicle-stock')
  const empty = /no active loading session|no vehicle|no data|not found/i.exec(txt)
  rows9.push(L.row('T9', 'Open Vehicle Stock page', 'Page loads with stock or a clean empty state, no errors',
    `Header/text: "${txt.slice(0, 380)}"${empty ? ` | empty-state text: "${empty[0]}"` : ''}`,
    sess.apis.filter((a) => a.step === 'T9' && !/\/login$/.test(a.url)).length ? 'FAIL' : 'PASS', shot, sess.apis.filter((a) => a.step === 'T9' && !/\/login$/.test(a.url))))
  L.saveResults('T9', rows9)

  // ---- T10
  const pages = [
    ['/admin/purchases/create', 'Purchase - Create'], ['/admin/purchase-returns/new', 'Purchase Return - New'],
    ['/admin/supplier-invoices/new', 'Supplier Invoice - New'], ['/admin/quotations/new', 'Quotation - New'],
    ['/admin/sales-returns/new', 'Sales Return - New'], ['/admin/invoices/new', 'Sales Invoice - New'],
    ['/admin/orders/create', 'Order - Create'], ['/admin/leads/new', 'Lead - New'],
    ['/admin/expenses', 'Expenses (list; Add modal below)'], ['/admin/customers', 'Customers (list)'],
    ['/admin/supplier-payments', 'Supplier Payments (list)'], ['/admin/receivables', 'Receivables (list)'],
    ['/admin/dashboard', 'Dashboard'], ['/admin/collections', 'Collection Reconciliation'],
    ['/admin/reports', 'Reports'], ['/admin/deliveries', 'Deliveries'], ['/admin/users', 'Users'], ['/admin/leaves', 'Leaves'],
  ]
  const out = []
  for (const [p, name] of pages) {
    sess.step = `T10 ${p}`
    await page.goto(L.BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    await L.settle(page, 10000)
    await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 12000 }).catch(() => {})
    const info = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
      const native = [...document.querySelectorAll('input[type="date"]')].filter(vis).map((i) => {
        const lab = i.closest('div')?.parentElement?.querySelector('label')?.innerText?.trim() || i.getAttribute('aria-label') || ''
        return lab.replace(/\s*\*$/, '')
      })
      const custom = document.querySelectorAll('.app-calendar-day, [data-date-picker], [class*="app-calendar"]').length
      return { native, custom }
    })
    out.push({ p, name, native: info.native })
  }
  // Expense Add modal + Customer form + GRN are reached through buttons: check Expense modal live
  sess.step = 'T10 expense modal'
  await page.goto(L.BASE + '/admin/expenses', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.getByRole('button', { name: /add expense/i }).first().click()
  await page.waitForTimeout(1200)
  const expNative = await page.locator('[role="dialog"] input[type="date"]').count()
  out.push({ p: '/admin/expenses (Add Expense modal)', name: 'Expenses - Add modal', native: Array(expNative).fill('Expense Date') })
  await L.shot(sess, 'T10-expense-modal-native-date')
  await page.keyboard.press('Escape')

  const shotNative = await L.shot(sess, 'T10-last')
  const withNative = out.filter((o) => o.native.length)
  const rows10 = [L.row('T10', 'Pages where a date field is the plain browser calendar (live check, read-only)', 'Custom DatePicker everywhere (consistent look)',
    withNative.map((o) => `${o.name} [${o.p}]: ${o.native.join(', ') || 'date'}`).join(' || ') || 'none found',
    withNative.length ? 'FAIL' : 'PASS', 'shots\\T10-expense-modal-native-date.png', [],
    { classification: 'Frontend', cause: 'src/components/ui/Input.jsx has NO date handling - every <Input type="date"> renders a native <input type="date"> (browser calendar). Only src/components/ui/DatePicker.jsx is the custom calendar, and it is used just in DateRangeFilter, AdminDashboard, CreateSalesOrder, SalesOverview, FinancialReports, CashReconciliation, CustomerDetail, customers/RecordPaymentDrawer, PlatformSupportTickets.' })]
  L.saveResults('T10', rows10)
  L.writeState({ t10: out })
  await L.closeSession(sess); await browser.close()
  console.log(rows9.map((x) => `${x.status} | ${x.what} | ${x.actual.slice(0, 500)}`).join('\n'))
  console.log(out.map((o) => `${o.p}: ${o.native.length ? o.native.join(', ') : '-'}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n')[0]); process.exit(1) })
