// R8 Admin Vehicle Stock: two tables, search, status filter, pagination, sort, Export, row click -> detail, SKU/UOM, "Loaded on ...".
const fs = require('fs')
const path = require('path')
const L = require('./lib')

const stripApi = (u) => u.replace(L.API, '')

;(async () => {
  const browser = await L.launch()
  const sess = await L.newSession(browser, 'ADMIN')
  const { page } = sess
  const rows = []
  const calls = [] // every vehicle-stock API call made by the page
  let detailJson = null
  page.on('response', async (res) => {
    const u = res.url()
    if (!u.startsWith(L.API) || !/\/vehicle-stock/.test(u) || res.request().method() !== 'GET') return
    let json = null
    try { json = await res.json() } catch { /* ignore */ }
    calls.push({ step: sess.step, url: stripApi(u), status: res.status(), json })
  })
  const r = await L.login(sess, 'ADMIN')
  if (!r.ok) { rows.push(L.row('R8', 'login', 'ok', 'login failed', 'FAIL')); L.saveResults('R8', rows); await browser.close(); return }
  const fail = (what, e) => L.row('R8', what, 'works', `check crashed: ${String(e.message).split('\n')[0]}`, 'FAIL', '', [])
  const lastCall = (re) => [...calls].reverse().find((c) => re.test(c.url))
  const waitCall = async (re, since) => { for (let i = 0; i < 40; i++) { const c = calls.slice(since).find((x) => re.test(x.url)); if (c) return c; await page.waitForTimeout(500) } return null }
  const tableOf = (title) => page.locator('div', { has: page.getByRole('heading', { name: title }) }).filter({ has: page.locator('table') }).last()
  const histTable = () => page.locator('table').nth(1)
  const bodyRows = (t) => t.locator('tbody tr')

  // ---------- load
  sess.step = 'R8 load'
  await page.goto(L.BASE + '/admin/vehicle-stock', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.getByRole('heading', { name: /today.?s vehicle load information/i }).waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const hasToday = (await page.getByRole('heading', { name: /today.?s vehicle load information/i }).count()) > 0
  const hasHist = (await page.getByRole('heading', { name: /vehicle load history/i }).count()) > 0
  const tableCount = await page.locator('table').count()
  const todayCall = lastCall(/\/vehicle-stock\/today/), histCall = lastCall(/\/vehicle-stock\/history/)
  const heads = await page.locator('table').nth(0).locator('thead th').allInnerTexts().catch(() => [])
  const headsH = await page.locator('table').nth(1).locator('thead th').allInnerTexts().catch(() => [])
  const apiFail = calls.filter((c) => c.status >= 400)
  rows.push(L.row('R8', 'Open /admin/vehicle-stock: both tables', "Two tables: Today's Vehicle Load Information + Vehicle Load History; APIs /today and /history return 200",
    `today heading=${hasToday}, history heading=${hasHist}, tables=${tableCount}; GET /vehicle-stock/today -> ${todayCall ? todayCall.status : 'not called'} (${Array.isArray(todayCall?.json) ? todayCall.json.length : '?'} rows); GET /vehicle-stock/history -> ${histCall ? histCall.status : 'not called'} (total ${histCall?.json?.total ?? '?'}); Today columns: ${heads.map((h) => h.trim()).join(' | ')}; History columns: ${headsH.map((h) => h.trim()).join(' | ')}`,
    hasToday && hasHist && tableCount >= 2 && todayCall?.status === 200 && histCall?.status === 200 ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-01-overview'),
    apiFail.map((c) => ({ method: 'GET', url: L.API + c.url, status: c.status, body: JSON.stringify(c.json || '').slice(0, 200) })),
    { classification: apiFail.length ? 'Backend' : 'Frontend', cause: 'src/features/vehicleStock/VehicleStockList.jsx / src/api/vehicleStock.js getVehicleStockToday/getVehicleStockHistory' }))

  // ---------- Today's table: "Loaded on ..."
  try {
    const todayApi = Array.isArray(todayCall?.json) ? todayCall.json : []
    const isoToday = new Date().toISOString().slice(0, 10)
    const old = todayApi.filter((x) => String(x.date || '').slice(0, 10) !== isoToday && String(x.date || '').slice(0, 10) !== new Date().toLocaleDateString('en-CA'))
    const t0 = page.locator('table').nth(0)
    const txt = (await t0.innerText().catch(() => '')).replace(/\s+/g, ' ')
    const loadedOn = (txt.match(/Loaded on \d{2} [A-Z][a-z]{2}/g) || [])
    rows.push(L.row('R8', 'Today table: old active session shows "Loaded on ..."', 'Every row whose date is not today shows "Loaded on dd Mon" under the vehicle number',
      `today API rows=${todayApi.length}, rows with a non-today date=${old.length} (${old.map((o) => `${o.vehicle_number}@${String(o.date).slice(0, 10)}`).join(', ') || '-'}); "Loaded on" captions on screen=${loadedOn.length} (${loadedOn.join(', ') || '-'})`,
      old.length === 0 ? 'INFO' : (loadedOn.length >= old.length ? 'PASS' : 'FAIL'), await L.shot(sess, 'R8-02-today-table'), [],
      old.length === 0 ? { note: 'No old active session exists in live data today, so this cannot be proven by data; logic is loadedOnLabel() in VehicleStockList.jsx.' } : { classification: 'Frontend', cause: 'src/features/vehicleStock/VehicleStockList.jsx loadedOnLabel / StockTable showLoadedOn' }))
  } catch (e) { rows.push(fail('Today table "Loaded on"', e)) }

  // ---------- History: search
  const total0 = histCall?.json?.total ?? 0
  try {
    sess.step = 'R8 search'
    const first = (histCall?.json?.items || [])[0]
    const term = first ? (first.vehicle_number || first.driver_name || '').slice(0, 5) : ''
    const since = calls.length
    await page.locator('input[type="search"]').first().fill(term)
    const c = await waitCall(/\/vehicle-stock\/history.*search=/, since)
    await page.waitForTimeout(1200); await L.settle(page, 8000)
    const n = await bodyRows(histTable()).count()
    const sample = (await bodyRows(histTable()).first().innerText().catch(() => '')).replace(/\s+/g, ' ')
    rows.push(L.row('R8', `History search "${term}"`, 'Server request has search=; every visible row matches the term (vehicle no or driver)',
      `request=${c ? c.url : 'no search request'}; API total=${c?.json?.total ?? '?'}; rows=${n}; first row="${sample.slice(0, 120)}"`,
      c && c.status === 200 && n > 0 && new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sample) ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-03-search'),
      c && c.status >= 400 ? [{ method: 'GET', url: L.API + c.url, status: c.status, body: '' }] : [], { classification: 'Frontend/Backend', cause: 'VehicleStockList.jsx search -> GET /vehicle-stock/history?search' }))
    await page.locator('input[type="search"]').first().fill('')
    await page.waitForTimeout(1500)
  } catch (e) { rows.push(fail('History search', e)) }

  // ---------- History: status filter
  try {
    sess.step = 'R8 status'
    const results = []
    for (const [label, value] of [['Active', 'active'], ['Closed', 'closed']]) {
      const since = calls.length
      await page.locator('[data-select-trigger="true"]').filter({ hasText: /all status|^active$|^closed$/i }).first().click({ timeout: 6000 })
      await page.getByRole('option', { name: label, exact: true }).click({ timeout: 6000 })
      const c = await waitCall(new RegExp(`/vehicle-stock/history.*status=${value}`), since)
      await page.waitForTimeout(1200); await L.settle(page, 8000)
      const badges = await histTable().locator('tbody tr td:nth-last-child(2)').allInnerTexts().catch(() => [])
      const bad = badges.filter((b) => !new RegExp(label, 'i').test(b))
      results.push(`${label}: request ok=${!!c}, API total=${c?.json?.total ?? '?'}, rows=${badges.length}, wrong-status rows=${bad.length}`)
    }
    rows.push(L.row('R8', 'History status filter Active / Closed', 'status= sent; only that status listed', results.join(' || '),
      results.every((x) => /request ok=true/.test(x) && /wrong-status rows=0/.test(x)) ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-04-status-filter'), [],
      { classification: 'Frontend/Backend', cause: 'VehicleStockList.jsx status Select -> GET /vehicle-stock/history?status' }))
    await page.locator('[data-select-trigger="true"]').filter({ hasText: /^closed$/i }).first().click({ timeout: 6000 }).catch(() => {})
    await page.getByRole('option', { name: /all status/i }).click({ timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(1500)
  } catch (e) { rows.push(fail('History status filter', e)) }

  // ---------- History: pagination
  try {
    sess.step = 'R8 pagination'
    const since0 = calls.length
    await page.locator('[data-select-trigger="true"]').filter({ hasText: /^25$/ }).first().click({ timeout: 6000 })
    await page.getByRole('option', { name: '10', exact: true }).click({ timeout: 6000 })
    const c1 = await waitCall(/\/vehicle-stock\/history.*page_size=10/, since0)
    await page.waitForTimeout(1200); await L.settle(page, 8000)
    const total = c1?.json?.total ?? 0, pages = c1?.json?.total_pages ?? 1
    const firstId1 = (c1?.json?.items || [])[0]?.id
    let detail = `page_size=10 -> total ${total}, total_pages ${pages}, rows on page 1 = ${(c1?.json?.items || []).length}`
    let ok = !!c1 && c1.status === 200 && (c1.json?.items || []).length <= 10
    if (pages > 1) {
      const since = calls.length
      await page.getByRole('button', { name: /next page/i }).click({ timeout: 6000 })
      const c2 = await waitCall(/\/vehicle-stock\/history.*page=2/, since)
      await page.waitForTimeout(1000)
      const indicator = (await page.locator('text=/\\d+ \\/ \\d+/').first().innerText().catch(() => '')).trim()
      const differs = (c2?.json?.items || [])[0]?.id !== firstId1
      detail += `; next -> ${c2 ? 'page=2 requested' : 'no page 2 request'}, indicator "${indicator}", first row differs=${differs}`
      ok = ok && !!c2 && differs && /^2 \/ /.test(indicator)
      await page.getByRole('button', { name: /previous page/i }).click({ timeout: 6000 }).catch(() => {})
    } else detail += '; only one page of data, Next cannot be exercised (page size control and indicator still work)'
    rows.push(L.row('R8', 'History pagination (rows per page 10, Next/Previous)', 'page_size/page sent; page 2 shows different rows', detail, ok ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-05-pagination'), [],
      { classification: 'Frontend/Backend', cause: 'VehicleStockList.jsx pagination controls -> GET /vehicle-stock/history?page&page_size' }))
  } catch (e) { rows.push(fail('History pagination', e)) }

  // ---------- History: sort
  try {
    sess.step = 'R8 sort'
    const parts = []
    let ok = true
    for (const [col, key] of [['Date', 'date'], ['Vehicle No', 'vehicle_number'], ['Status', 'status']]) {
      const hdr = histTable().locator('thead th', { hasText: col }).first().locator('button')
      const since = calls.length
      await hdr.click({ timeout: 6000 })
      const asc = await waitCall(new RegExp(`/vehicle-stock/history.*sort_by=${key}.*sort_order=asc|/vehicle-stock/history.*sort_order=asc.*sort_by=${key}`), since)
      await page.waitForTimeout(800)
      const since2 = calls.length
      await hdr.click({ timeout: 6000 })
      const desc = await waitCall(new RegExp(`/vehicle-stock/history.*sort_by=${key}.*sort_order=desc|/vehicle-stock/history.*sort_order=desc.*sort_by=${key}`), since2)
      await page.waitForTimeout(800)
      const vals = (desc?.json?.items || []).map((x) => String(key === 'date' ? x.date : key === 'vehicle_number' ? x.vehicle_number : x.status))
      const distinct = new Set(vals.filter((v) => v !== 'null' && v !== 'undefined')).size
      const sortedDesc = distinct < 2 ? true : vals.filter((v) => v !== 'null').every((v, i, arr) => i === 0 || arr[i - 1] >= v)
      parts.push(`${col}: asc request=${!!asc}, desc request=${!!desc}, desc order ok=${sortedDesc}${distinct < 2 ? ' (data has <2 distinct values, order not provable)' : ''}`)
      ok = ok && !!asc && !!desc && sortedDesc
      await hdr.click({ timeout: 6000 }).catch(() => {}) // third click clears the sort
      await page.waitForTimeout(800)
    }
    rows.push(L.row('R8', 'History sorting (Date, Vehicle No, Status)', 'sort_by + sort_order sent; rows come back ordered', parts.join(' || '), ok ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-06-sort'), [],
      { classification: 'Frontend/Backend', cause: 'VehicleStockList.jsx SortableHeaderCell -> GET /vehicle-stock/history?sort_by&sort_order' }))
  } catch (e) { rows.push(fail('History sort', e)) }

  // ---------- Export
  try {
    sess.step = 'R8 export'
    const since = calls.length
    const dlP = page.waitForEvent('download', { timeout: 60000 }).catch(() => null)
    await page.getByRole('button', { name: /export to excel/i }).click({ timeout: 6000 })
    const dl = await dlP
    await page.waitForTimeout(1500)
    const exportCalls = calls.slice(since).filter((c) => /\/vehicle-stock\/history/.test(c.url))
    let fileInfo = 'no download'
    let rowsInFile = -1
    if (dl) {
      const file = path.join(L.DIR, dl.suggestedFilename())
      await dl.saveAs(file)
      fileInfo = `${dl.suggestedFilename()} (${fs.statSync(file).size} bytes)`
      try {
        const XLSX = require(path.join(L.DIR, '..', '..', 'node_modules', 'xlsx'))
        const wb = XLSX.readFile(file)
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
        rowsInFile = Math.max(0, data.length - 1)
        fileInfo += `; header=${JSON.stringify(data[0])}`
      } catch (e) { fileInfo += `; (could not parse xlsx: ${String(e.message).split('\n')[0]})` }
    }
    const totalNow = exportCalls[exportCalls.length - 1]?.json?.total ?? total0
    rows.push(L.row('R8', 'Export to Excel (current filters, all pages, page_size 100)', 'An .xlsx downloads; rows = history total; requests use page_size=100',
      `download=${fileInfo}; export requests=${exportCalls.map((c) => c.url.replace('/vehicle-stock/history', '')).join(' , ') || 'none'}; API total=${totalNow}; rows in file=${rowsInFile}`,
      dl && exportCalls.some((c) => /page_size=100/.test(c.url)) && (rowsInFile < 0 || rowsInFile === totalNow) ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-07-export'), [],
      { classification: 'Frontend', cause: 'src/features/vehicleStock/VehicleStockList.jsx handleExport' }))
  } catch (e) { rows.push(fail('Export', e)) }

  // ---------- Row click -> detail, SKU / UOM
  try {
    sess.step = 'R8 detail'
    await page.goto(L.BASE + '/admin/vehicle-stock', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
    await page.waitForTimeout(2000)
    const since = calls.length
    const firstRowTxt = (await bodyRows(histTable()).first().innerText().catch(() => '')).replace(/\s+/g, ' ')
    await bodyRows(histTable()).first().click({ timeout: 8000 })
    await page.waitForURL(/\/admin\/vehicle-stock\/[^/]+$/, { timeout: 15000 }).catch(() => {})
    const dcall = await waitCall(/\/vehicle-stock\/[0-9a-f-]{20,}$/, since)
    await L.settle(page, 12000); await page.waitForTimeout(1500)
    const url = page.url().replace(L.BASE, '')
    const items = dcall?.json?.items || []
    const tbl = page.locator('table').first()
    const heads = (await tbl.locator('thead th').allInnerTexts().catch(() => [])).map((h) => h.trim())
    const trs = tbl.locator('tbody tr')
    const n = await trs.count()
    const skuIdx = heads.findIndex((h) => /sku/i.test(h)), uomIdx = heads.findIndex((h) => /uom/i.test(h))
    const mism = []
    for (let i = 0; i < n; i++) {
      const cells = await trs.nth(i).locator('td').allInnerTexts()
      const it = items[i]
      if (!it) continue
      const exSku = it.sku && it.variant_name ? `${it.sku} / ${it.variant_name}` : (it.sku || it.variant_name || '—')
      const exUom = it.uom || '—'
      if ((cells[skuIdx] || '').trim() !== exSku) mism.push(`row${i + 1} SKU shows "${(cells[skuIdx] || '').trim()}" expected "${exSku}"`)
      if ((cells[uomIdx] || '').trim() !== exUom) mism.push(`row${i + 1} UOM shows "${(cells[uomIdx] || '').trim()}" expected "${exUom}"`)
    }
    const apiHasSku = items.filter((x) => x.sku).length, apiHasUom = items.filter((x) => x.uom).length
    rows.push(L.row('R8', 'Row click -> detail page; SKU / UOM filled', 'Opens /admin/vehicle-stock/:id via GET /vehicle-stock/{id}; SKU ("SKU / variant") and UOM match the API (null -> "—")',
      `clicked row "${firstRowTxt.slice(0, 100)}" -> ${url}; GET ${dcall ? dcall.url.replace(/[0-9a-f-]{36}/, '{id}') + ' -> ' + dcall.status : 'not called'}; API items=${items.length} (with sku=${apiHasSku}, with uom=${apiHasUom}); screen rows=${n}; columns=${heads.join(' | ')}; mismatches=${mism.join('; ') || 'none'}`,
      /\/admin\/vehicle-stock\/[^/]+$/.test(url) && dcall?.status === 200 && n > 0 && skuIdx >= 0 && uomIdx >= 0 && mism.length === 0 ? 'PASS' : 'FAIL', await L.shot(sess, 'R8-08-detail'),
      dcall && dcall.status >= 400 ? [{ method: 'GET', url: L.API + dcall.url, status: dcall.status, body: '' }] : [],
      { classification: apiHasSku === 0 && items.length ? 'Data (catalog has no SKU/UOM) / Backend' : 'Frontend', cause: 'src/features/vehicleStock/VehicleStockDetail.jsx + VehicleStockOverview.jsx skuVariantLabel / api normalizeSessionItem (variant_name, sku, uom)' }))
    L.writeState({ r8Detail: { url, items: items.map((x) => ({ sku: x.sku ?? null, uom: x.uom ?? null, variant_name: x.variant_name ?? null })) } })
  } catch (e) { rows.push(fail('Detail page', e)) }

  rows.push(L.row('R8', 'Console errors on Vehicle Stock pages', 'none', sess.consoleErrors.map((c) => c.text.slice(0, 140)).join(' ;; ') || 'none',
    sess.consoleErrors.some((c) => !/Failed to load resource/.test(c.text)) ? 'FAIL' : 'PASS', '', []))
  L.saveResults('R8', rows)
  await L.closeSession(sess); await browser.close()
  console.log(rows.map((x) => `${x.status} | ${x.what}\n   ${x.actual.slice(0, 650)}`).join('\n'))
})().catch((e) => { console.error('SCRIPT ERROR', String(e.message).split('\n').slice(0, 3).join(' | ')); process.exit(1) })
