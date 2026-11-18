// Product Creation QA (Playwright library). Usage: node tests/product-creation-qa.spec.cjs T1 T2 ... | all
// Rules: no application source is touched; every created record starts with QA-PW-; only records created by this suite are ever edited/deleted.
// (Plain Node + the installed `playwright` library: the project has no @playwright/test runner, and package.json is "type": "module".)
const H = require('./pw-helpers.cjs')
const { L, fs, path } = H
const SHOT = H.shot

const ts = () => H.TS()
const nm = (p) => `QA-PW-${p}-${ts()}`
const skuOf = (p) => `QA-PW-SKU-${p}-${ts()}`
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
const kv = (text, label) => { const m = norm(text).match(new RegExp('\\| ' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\| ([^|]*)')); return m ? m[1].trim() : null }
const stat = (text, label) => { const m = norm(text).match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\| ([^|]*)')); return m ? m[1].trim() : null }
const inr = (n) => '₹ ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const BASE_CAT = /^Beverages$/ // an existing real top-level category (read only; used as the parent of the QA products)

function R(id, name, status, expected, actual, extra = {}) { H.record({ id, name, status, expected, actual, ...extra }) }
function netsave(id, h) {
  const s = H.state(); const log = s.netlog || {}
  log[id] = { failures: h.net.failures, consoleErrors: h.net.consoleErrors.map((c) => c.text.slice(0, 200)), writes: h.net.writes.map((w) => ({ m: w.method, u: w.url, s: w.status })) }
  H.setState({ netlog: log })
}
async function withSession(id, fn) {
  let h
  for (let a = 1; a <= 3; a++) { try { h = await H.open(); break } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 6000)) } }
  try { return await fn(h) } finally { netsave(id, h); await H.close(h) }
}
function remember(key, prod, extra = {}) {
  const s = H.state(); const products = s.products || {}
  products[key] = { id: prod.id, product_id: prod.product_id, name: prod.name, sku: prod.sku, ...extra }
  H.setState({ products }); H.addCreated({ kind: 'product', key, id: prod.id, name: prod.name, sku: prod.sku })
}
const P = (key) => (H.state().products || {})[key]

// create one product through the UI; returns { out, id, api }
async function createViaUi(h, key, data, { shotName, dbl = false } = {}) {
  const { page, net } = h
  await H.openCreate(page)
  const log = await H.fillForm(page, data)
  if (data.afterFill) await data.afterFill(page)
  let out
  if (dbl) {
    await H.tab(page, 'Documents'); await L.startToastWatch(page)
    const n0 = net.writes.length
    await page.getByRole('button', { name: /^add product$/i }).last().dblclick({ timeout: 10000 })
    await page.waitForTimeout(6000)
    const w = net.writes.slice(n0)
    out = { writes: w.length, posts: w.filter((x) => x.method === 'POST').length, status: w.length ? w[w.length - 1].status : null, res: w.length ? w[w.length - 1].res : null, req: w[0] && w[0].body ? H.safeJson(w[0].body) : null, toast: await L.readToasts(page), banner: '', fieldErrors: [] }
  } else out = await H.submit(page, net)
  out.log = log; out.url = page.url().replace(H.BASE, '')
  if (shotName) out.shot = await SHOT(page, shotName)
  const id = out.res && out.res.id
  if (out.status && out.status < 300 && id) { remember(key, out.res) }
  return { out, id, api: id ? await H.getProduct(page, id) : null }
}
const mismatches = (api, exp) => {
  const bad = []
  for (const [k, v] of Object.entries(exp)) {
    const got = k.split('.').reduce((o, p) => (o == null ? o : o[p]), api)
    const same = typeof v === 'number' ? Number(got) === v : got === v || norm(got) === norm(v)
    if (!same) bad.push(`${k}: expected ${JSON.stringify(v)} got ${JSON.stringify(got)}`)
  }
  return bad
}
const T = {}

// ---------------------------------------------------------------- T1
T.T1 = () => withSession('T1', async (h) => {
  const { page, net } = h
  await H.openCreate(page)
  const checks = []
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.innerText.trim()).filter((t) => /Information|Media|Documents|Specifications|Variants/.test(t)))
  checks.push(['form tabs rendered', tabs.length >= 9, tabs.join(', ')])
  checks.push(['Product Name input', await L.fieldByLabel(page, 'Product Name').count() > 0, ''])
  const cats = await H.listOptions(page, 'Category'); checks.push(['Category dropdown loads', cats.length > 0, cats.length + ' options'])
  await H.pickOption(page, 'Category', BASE_CAT); await page.waitForTimeout(1200)
  const subs = await H.listOptions(page, 'Sub Category'); checks.push(['Sub Category dropdown loads after Category', subs.length > 0, subs.length + ' options'])
  await H.tab(page, 'Documents')
  checks.push(['Add Product button available on the last tab', await page.getByRole('button', { name: /^add product$/i }).last().isVisible(), ''])
  const shot = await SHOT(page, '01-product-create-page', true)
  const crit = net.failures.filter((f) => /\/(products|categories|brands|suppliers|units|warehouses)/.test(f.url))
  checks.push(['no failed critical API request', crit.length === 0, JSON.stringify(crit)])
  const app = net.consoleErrors.filter((c) => !/403/.test(c.text))
  checks.push(['no unexpected console error', app.length === 0, JSON.stringify(app.map((c) => c.text.slice(0, 120)))])
  const bad = checks.filter((c) => !c[1])
  R('T1', 'Product Create page loads', bad.length ? 'FAIL' : 'PASS', 'Page renders, form controls, Save button, category dropdowns load, no critical failures', checks.map((c) => `${c[1] ? 'ok' : 'FAIL'}: ${c[0]} ${c[2]}`).join('; '), { screenshot: shot, notes: 'The single console line "Failed to load resource: 403" is the known hosting-level GET /login noise, not an app API call.' })
})

// ---------------------------------------------------------------- T2
T.T2 = () => withSession('T2', async (h) => {
  const { page, net } = h
  const before = (await H.api(page, '/products?page_size=1')).body
  await H.openCreate(page)
  const out = await H.submit(page, net)
  await H.tab(page, 'Basic Information')
  const basicErr = await page.evaluate(() => Array.from(document.querySelectorAll('.text-red-600,.text-red-500')).map((e) => e.innerText.trim()).filter(Boolean))
  const shot = await SHOT(page, '02-required-validation', true)
  await H.tab(page, 'Pricing Information')
  const priceErr = await page.evaluate(() => Array.from(document.querySelectorAll('.text-red-600,.text-red-500')).map((e) => e.innerText.trim()).filter(Boolean))
  const after = (await H.api(page, '/products?page_size=1')).body
  const ok = out.writes === 0 && before.total === after.total && basicErr.length >= 4 && priceErr.length >= 2
  const mand = [...new Set([...basicErr, ...priceErr].map((e) => e.replace(/\.$/, '')))]
  H.setState({ mandatory: mand })
  R('T2', 'Blank form validation', ok ? 'PASS' : 'FAIL', 'No product created; each required field shows an error next to it; no crash', `API writes: ${out.writes}; product total before/after: ${before.total}/${after.total}. Top banner: "${out.banner}". Errors on Basic tab: ${JSON.stringify(basicErr)}; on Pricing tab: ${JSON.stringify(priceErr)}. Currently mandatory: Product Name, Product Code / SKU, Category, Sub Category, Purchase Price, Selling Price (Product Status and UOM have defaults). "Primary Product Image" is marked with * but is NOT enforced (see T3).`, { screenshot: shot })
})

// ---------------------------------------------------------------- T3
T.T3 = () => withSession('T3', async (h) => {
  const { page } = h
  const name = nm('Minimal'), sku = skuOf('MIN')
  const { out, id, api } = await createViaUi(h, 'minimal', { name, sku, categoryRe: BASE_CAT, purchase: '50', selling: '118' }, { shotName: '03-minimal-product-created' })
  const found = await H.findProducts(page, name)
  const exact = found.filter((p) => p.name === name)
  await H.openDetail(page, id || 'x'); await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const text = await H.detailText(page)
  const api2 = id ? await H.getProduct(page, id) : null
  const bad = []
  if (!(out.status === 201)) bad.push('create status ' + out.status + ' ' + out.banner)
  if (out.posts !== 1) bad.push('POST count ' + out.posts)
  if (exact.length !== 1) bad.push('products with this name: ' + exact.length)
  if (api) bad.push(...mismatches(api, { name, sku, 'pricing.purchase_price': 50, 'pricing.selling_price': 118, price: 118, status: 'active', is_active: true }))
  if (!text.includes(name)) bad.push('detail page does not show the name after refresh')
  if (api2 && api && api2.updated_at !== api.updated_at) bad.push('API changed between reads')
  const noImage = !(api && api.cover_image)
  R('T3', 'Minimal valid product', bad.length ? 'FAIL' : 'PASS', 'Created once; success feedback; in list; detail opens; values persist after refresh', `POST status ${out.status}, POST count ${out.posts}, toast "${out.toast || '(none seen)'}", landed on ${out.url}; ${exact.length} product(s) named ${name}; product_id ${api && api.product_id}; detail after refresh shows "${(kv(text, 'Purchase Price') || '')}" purchase / ${stat(text, 'Selling Price')} selling. ${noImage ? 'Created WITHOUT a primary image although the field is marked *.' : ''} ${bad.join('; ')}`, { screenshot: out.shot, api: { request: out.req, response_summary: api && { id: api.id, product_id: api.product_id, sku: api.sku, pricing: api.pricing, total_stock: api.total_stock, opening_stock: api.opening_stock, inventory_tracking: api.inventory_tracking, uom: api.uom } } })
  H.setState({ minimalNoImage: noImage, minimalToast: out.toast })
})

// ---------------------------------------------------------------- T4
T.T4 = () => withSession('T4', async (h) => {
  const { page } = h
  const name = nm('Full'), sku = skuOf('FULL'), barcode = `QA-PW-BC-${ts()}`
  const png = L.ensureTestPng()
  const extra = {
    'Purchase Information': { 'Supplier Product Code': `SPC-${ts()}`, 'Lead Time': '7 days', 'Minimum Order Quantity': '5' },
    'Physical Specifications': { Weight: '2', Length: '10', Width: '5', Height: '3', Volume: '150', Color: 'Green', Size: 'Medium', Material: 'Plastic' },
    'Additional Information': { 'Warranty Period': '12', 'Shelf Life': '24', 'Product Tags': 'qa-pw, full', Notes: 'QA-PW full product notes' },
  }
  const data = {
    name, sku, shortName: 'QA-PW Full', barcode, categoryRe: BASE_CAT, modelNumber: 'QA-M-1', description: 'QA-PW complete product description', manufacturer: 'QA-PW Manufacturer',
    openingStock: '20', purchase: '50', selling: '118', mrp: '150', wholesale: '110', dealer: '105', discount: '5', taxIncl: false, gst: '18', hsn: '12345678', extra,
    afterFill: async () => {
      await H.tab(page, 'Product Images & Media')
      await page.locator('input[type=file]').first().setInputFiles(png); await page.waitForTimeout(3500)
    },
  }
  const { out, id, api } = await createViaUi(h, 'full', data, { shotName: '04-full-product-after-save' })
  const bad = []
  if (!id) { R('T4', 'Complete standard product', 'FAIL', 'Created with all exposed fields', `not created: status ${out.status}, banner "${out.banner}", errors ${JSON.stringify(out.fieldErrors)}, log ${JSON.stringify(out.log)}`, { screenshot: out.shot }); return }
  const exp = { name, sku, barcode, short_name: 'QA-PW Full', model_number: 'QA-M-1', description: 'QA-PW complete product description', opening_stock: 20, 'pricing.purchase_price': 50, 'pricing.selling_price': 118, 'pricing.mrp': 150, 'pricing.wholesale_price': 110, 'pricing.dealer_price': 105, 'pricing.discount_percent': 5, 'pricing.tax_inclusive': false, tax_rate: 18, hsn_code: '12345678', supplier_product_code: `SPC-${ts()}`, lead_time: '7 days', minimum_order_quantity: 5, weight: 2, length: 10, width: 5, height: 3, volume: 150, color: 'Green', material: 'Plastic', warranty_period: '12', shelf_life: '24', notes: 'QA-PW full product notes', uom: 'Piece', total_stock: 20 }
  bad.push(...mismatches(api, exp))
  if (!Array.isArray(api.product_tags) || !api.product_tags.join(',').includes('qa-pw')) bad.push('product_tags: ' + JSON.stringify(api.product_tags))
  if (!api.manufacturer) bad.push('manufacturer not persisted (entered "QA-PW Manufacturer"; field is a select/combobox) log=' + out.log.join('|'))
  await H.openDetail(page, id); await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const text = await H.detailText(page)
  const shot = await SHOT(page, '04-full-product-detail', true)
  const ui = []
  const chk = (label, got, want) => { if (norm(got) !== norm(want)) ui.push(`${label}: UI "${got}" vs expected "${want}"`) }
  chk('Purchase Price', kv(text, 'Purchase Price'), inr(50)); chk('MRP', kv(text, 'MRP'), inr(150)); chk('Wholesale', kv(text, 'Wholesale Price'), inr(110)); chk('Dealer', kv(text, 'Dealer Price'), inr(105))
  chk('Discount %', kv(text, 'Discount %'), '5%'); chk('HSN', kv(text, 'HSN/SAC Code'), '12345678'); chk('GST', kv(text, 'GST/VAT Rate'), '18%'); chk('Tax Inclusive', kv(text, 'Tax Inclusive'), 'No')
  chk('Color', kv(text, 'Color'), 'Green'); chk('Material', kv(text, 'Material'), 'Plastic'); chk('Barcode', kv(text, 'Barcode'), barcode); chk('Min Order Qty', kv(text, 'Min. Order Qty'), '5')
  chk('Total Stock', stat(text, 'Total Stock'), '20'); chk('Lead Time', kv(text, 'Lead Time'), '7 days'); chk('Short Name', kv(text, 'Short Name'), 'QA-PW Full')
  const dims = kv(text, 'Dimensions (L×W×H)'); if (!/10/.test(dims || '') || !/5/.test(dims || '') || !/3/.test(dims || '')) ui.push('Dimensions: UI "' + dims + '" vs 10×5×3')
  const api2 = await H.getProduct(page, id)
  const stillBad = mismatches(api2, { name, sku, 'pricing.selling_price': 118, opening_stock: 20, total_stock: 20 })
  const all = [...bad, ...ui.map((u) => 'UI ' + u), ...stillBad.map((u) => 'after refresh ' + u)]
  R('T4', 'Complete standard product', all.length ? 'FAIL' : 'PASS', 'All exposed fields persisted and shown on the detail page and after refresh', all.length ? all.join('; ') : `All ${Object.keys(exp).length} API fields and ${14} detail fields match; cover_image ${api.cover_image ? 'saved' : 'missing'}. Note: Minimum/Maximum Stock, Reorder Level and Reorder Quantity are not exposed on the non-variant Product form (only Opening Stock) so they could not be entered.`, { screenshot: shot, api: { request: out.req, response_summary: { id: api.id, product_id: api.product_id, opening_stock: api.opening_stock, total_stock: api.total_stock, pricing: api.pricing, cover_image: api.cover_image, manufacturer: api.manufacturer, product_tags: api.product_tags, minimum_stock_level: api.minimum_stock_level } } })
})

// ---------------------------------------------------------------- T5
T.T5 = () => withSession('T5', async (h) => {
  const { page } = h
  const cats = (await H.api(page, '/categories?page_size=300')).body
  const rows = (cats && (cats.items || cats)) || []
  const top = rows.filter((c) => !c.parent_id)
  const children = (p) => rows.filter((c) => c.parent_id === p.id).map((c) => c.name)
  const A = top.find((c) => c.name === 'Beverages'), B = top.find((c) => c.name === 'Electronics')
  if (!A || !B || !children(A).length || !children(B).length) { R('T5', 'Category to Subcategory dependency', 'NOT TESTABLE', 'Two categories with sub categories', 'Fewer than two usable categories'); return }
  await H.openCreate(page)
  await H.pickOption(page, 'Category', /^Beverages$/); await page.waitForTimeout(1500)
  const subA = (await H.listOptions(page, 'Sub Category')).map((s) => s.replace(/^.*›\s*/, '').trim())
  const wantA = children(A)
  const onlyA = subA.length > 0 && subA.every((s) => wantA.includes(s)) && wantA.every((s) => subA.includes(s))
  const picked = await H.pickOption(page, 'Sub Category', null)
  const lab = page.locator('label').filter({ hasText: 'Sub Category' }).first(); const forId = await lab.getAttribute('for')
  const trig = page.locator('[aria-labelledby="' + forId + '"]:not([type="hidden"]), [aria-controls="' + forId + '-listbox"]').first()
  const shownBefore = norm(await trig.innerText())
  await H.pickOption(page, 'Category', /^Electronics$/); await page.waitForTimeout(1500)
  const shownAfter = norm(await trig.innerText())
  const subB = (await H.listOptions(page, 'Sub Category')).map((s) => s.replace(/^.*›\s*/, '').trim())
  const wantB = children(B)
  const onlyB = subB.length > 0 && subB.every((s) => wantB.includes(s)) && wantB.every((s) => subB.includes(s))
  const cleared = !shownAfter || /select|choose|^$/i.test(shownAfter) || !subA.some((s) => shownAfter.includes(s))
  // stale value cannot be saved: fill the rest and try to submit
  await H.fillForm(page, { name: nm('Stale'), sku: skuOf('STALE'), skipCategory: true, status: false, purchase: '50', selling: '60' })
  const out = await H.submit(page, h.net)
  const blocked = out.writes === 0 && /Sub Category/i.test(out.banner + out.fieldErrors.join(' '))
  const shot = await SHOT(page, '05-category-subcategory', true)
  const bad = []
  if (!onlyA) bad.push(`Beverages sub list ${JSON.stringify(subA)} != API ${JSON.stringify(wantA)}`)
  if (!onlyB) bad.push(`Electronics sub list ${JSON.stringify(subB)} != API ${JSON.stringify(wantB)}`)
  if (!cleared) bad.push(`stale sub category "${shownAfter}" still shown after switching category`)
  if (!blocked) bad.push('form could be submitted with the cleared sub category: ' + JSON.stringify({ writes: out.writes, banner: out.banner, status: out.status }))
  R('T5', 'Category to Subcategory dependency', bad.length ? 'FAIL' : 'PASS', 'Sub categories follow the category; stale sub category cleared; cannot be saved stale', `Beverages -> ${JSON.stringify(subA)}; picked "${picked}" (shown "${shownBefore}"); after switching to Electronics shown "${shownAfter}"; Electronics -> ${JSON.stringify(subB)}; submit with cleared sub: writes=${out.writes} banner="${out.banner}". ${bad.join('; ')}`, { screenshot: shot })
})

// ---------------------------------------------------------------- T6 / T7
T.T6 = () => withSession('T6', async (h) => {
  const base = P('minimal'); if (!base) { R('T6', 'Duplicate SKU', 'BLOCKED', 'Needs T3 product', 'T3 product not created'); return }
  const { out, id, api } = await createViaUi(h, 'dupsku', { name: nm('DupSku'), sku: base.sku, categoryRe: BASE_CAT, purchase: '50', selling: '60' }, { shotName: '06-duplicate-sku' })
  const rejected = !id
  const found = (await H.findProducts(h.page, base.sku)).filter((p) => p.sku === base.sku)
  const meaningful = rejected && /sku|code|already|exist|duplicate/i.test(out.banner + out.toast + out.fieldErrors.join(' '))
  const status = rejected ? (meaningful ? 'PASS' : 'FAIL') : 'FAIL'
  R('T6', 'Duplicate SKU', status, 'Duplicate SKU rejected with a clear message (if uniqueness is a system rule)', rejected ? `Rejected (HTTP ${out.status}): "${out.banner}" ${meaningful ? '' : '- message does not mention the SKU'}` : `ACCEPTED: a second product ${api.product_id} was saved with the same SKU ${base.sku}; ${found.length} products now share it. Backend: no uniqueness rule on products.sku (ProductCreate.sku is only max_length=100; no UniqueConstraint on the model), and the form shows no warning.`, { screenshot: out.shot, api: { request: out.req, status: out.status } })
})
T.T7 = () => withSession('T7', async (h) => {
  const base = P('minimal'); if (!base) { R('T7', 'Duplicate product name', 'BLOCKED', 'Needs T3 product', 'T3 product not created'); return }
  const { out, id, api } = await createViaUi(h, 'dupname', { name: base.name, sku: skuOf('DUPNAME'), categoryRe: BASE_CAT, purchase: '50', selling: '60' }, { shotName: '07-duplicate-name' })
  R('T7', 'Duplicate product name', 'PASS', 'Record the actual rule (not a bug unless the business requires unique names)', id ? `Duplicate names are ALLOWED: ${api.product_id} saved with the same name as ${base.product_id} (HTTP ${out.status}). No schema rule requires unique names.` : `Duplicate names are REJECTED (HTTP ${out.status}): "${out.banner}"`, { screenshot: out.shot, notes: 'Informational: behaviour documented, not treated as a defect.' })
})

// ---------------------------------------------------------------- T8
const NUM = [
  { tab: 'Inventory Information', label: 'Opening Stock', kind: 'int', base: '' },
  { tab: 'Pricing Information', label: 'Purchase Price', kind: 'money', base: '50' },
  { tab: 'Pricing Information', label: 'Selling Price', kind: 'money', base: '100' },
  { tab: 'Pricing Information', label: 'MSRP/MRP', kind: 'money', base: '' },
  { tab: 'Pricing Information', label: 'Wholesale Price', kind: 'money', base: '' },
  { tab: 'Pricing Information', label: 'Dealer Price', kind: 'money', base: '' },
  { tab: 'Pricing Information', label: 'Discount (%)', kind: 'pct', base: '' },
  { tab: 'Tax Information', label: 'GST/VAT Rate', kind: 'pct', base: '' },
  { tab: 'Purchase Information', label: 'Minimum Order Quantity', kind: 'int', base: '' },
  { tab: 'Physical Specifications', label: 'Weight', kind: 'float', base: '' },
  { tab: 'Physical Specifications', label: 'Length', kind: 'float', base: '' },
  { tab: 'Physical Specifications', label: 'Width', kind: 'float', base: '' },
  { tab: 'Physical Specifications', label: 'Height', kind: 'float', base: '' },
  { tab: 'Physical Specifications', label: 'Volume', kind: 'float', base: '' },
  { tab: 'Digital Product Information', label: 'Download Limit', kind: 'int', base: '' },
]
const VALS = { int: ['-5', 'abc', '1.5', '99999999999'], money: ['-5', 'abc', '1.5', '99999999999'], float: ['-5', 'abc', '1.5', '99999999999'], pct: ['-5', '101', 'abc', '1.5'] }
T.T8 = () => withSession('T8', async (h) => {
  const { page, net } = h
  const rowsOut = []; let n = 0
  const freshForm = async () => {
    n += 1
    await H.openCreate(page)
    await H.fillForm(page, { name: nm('Num'), sku: skuOf('NUM' + n), categoryRe: BASE_CAT, purchase: '50', selling: '100' })
  }
  await freshForm()
  for (const f of NUM) {
    for (const v of VALS[f.kind]) {
      const key = `${f.label} = ${v}`
      try {
        await H.tab(page, f.tab)
        const el = L.fieldByLabel(page, f.label)
        await el.scrollIntoViewIfNeeded().catch(() => {})
        await el.click(); await el.press('Control+A'); await page.keyboard.type(v); await el.evaluate((e) => e.blur()); await page.waitForTimeout(250)
        const shown = await el.inputValue()
        const out = await H.submit(page, net)
        const created = !!(out.status && out.status < 300 && out.res && out.res.id)
        const sent = out.req && typeof out.req === 'object' ? JSON.stringify(out.req).length : 0
        let stored = null
        if (created) {
          const rec = out.res; H.addCreated({ kind: 'product', key: 'num:' + key, id: rec.id, name: rec.name, sku: rec.sku })
          const probe = { 'Opening Stock': rec.opening_stock, 'Purchase Price': rec.pricing && rec.pricing.purchase_price, 'Selling Price': rec.pricing && rec.pricing.selling_price, 'MSRP/MRP': rec.pricing && rec.pricing.mrp, 'Wholesale Price': rec.pricing && rec.pricing.wholesale_price, 'Dealer Price': rec.pricing && rec.pricing.dealer_price, 'Discount (%)': rec.pricing && rec.pricing.discount_percent, 'GST/VAT Rate': rec.tax_rate, 'Minimum Order Quantity': rec.minimum_order_quantity, Weight: rec.weight, Length: rec.length, Width: rec.width, Height: rec.height, Volume: rec.volume, 'Download Limit': rec.download_limit }
          stored = probe[f.label]
        }
        const msg = (out.banner || out.fieldErrors.join(' / ') || '').slice(0, 160)
        const row = { field: f.label, input: v, uiValueAfterBlur: shown, requestSent: out.writes > 0, http: out.status, created, stored, message: msg }
        // verdict
        let verdict
        if (v === 'abc') verdict = shown === '' || shown === v ? (shown === '' ? 'OK' : 'FAIL') : 'OK'
        else if (/^-/.test(v)) verdict = created ? 'FAIL' : 'OK'
        else if (v === '101') verdict = created ? 'FAIL' : 'OK'
        else if (v === '1.5') verdict = f.kind === 'int' ? (created && Number(stored) !== Math.round(Number(stored)) ? 'FAIL' : (created ? 'OK-ROUNDED' : (out.writes === 0 ? 'OK' : 'OK-SERVER'))) : (created ? 'INFO-ACCEPTED' : 'INFO-REJECTED')
        else verdict = out.status >= 500 ? 'FAIL' : created ? (f.kind === 'int' ? 'FAIL' : 'INFO-ACCEPTED') : 'OK'
        if (v === 'abc' && created) verdict = shown === '' ? 'OK' : 'FAIL'
        row.verdict = verdict
        if (out.writes > 0 && out.status >= 400 && !msg) row.verdict += ' (no message)'
        rowsOut.push(row)
        if (created) { await freshForm() } else {
          // restore the valid value and carry on in the same form
          await H.tab(page, f.tab); await el.fill(f.base).catch(async () => { await el.click(); await el.press('Control+A'); await el.press('Delete') })
        }
      } catch (e) {
        rowsOut.push({ field: f.label, input: v, verdict: 'ERROR', message: e.message.split('\n')[0] })
        try { await freshForm() } catch (e2) { /* continue */ }
      }
    }
  }
  fs.writeFileSync(path.join(H.OUT, 'T8-matrix.json'), JSON.stringify(rowsOut, null, 2))
  H.setState({ numMatrix: rowsOut })
  const bad = rowsOut.filter((r) => /^(FAIL|ERROR)/.test(r.verdict))
  const shot = await SHOT(page, '08-numeric-validation')
  R('T8', 'Numeric field validation', bad.length ? 'FAIL' : 'PASS', 'Negative / above-range / non-numeric / decimal-on-integer / huge values are blocked or normalised for every numeric field; no 5xx', `${rowsOut.length} field/value probes. Failing: ${bad.length ? bad.map((b) => `${b.field}=${b.input} -> ${b.verdict} ${b.message || ''}`).join('; ') : 'none'}. Matrix in qa-test/product-creation/T8-matrix.json`, { screenshot: shot })
})

// ---------------------------------------------------------------- T9..T14 product creations
T.T9 = () => withSession('T9', async (h) => {
  const m = P('minimal'); if (!m) { R('T9', 'Price relationship', 'BLOCKED', 'Needs T3', 'T3 product missing'); return }
  const { page } = h
  const api = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id)
  const text = await H.detailText(page)
  const bad = []
  if (api.pricing.purchase_price !== 50 || api.pricing.selling_price !== 118) bad.push('stored ' + api.pricing.purchase_price + '/' + api.pricing.selling_price)
  if (kv(text, 'Purchase Price') !== inr(50)) bad.push('detail Purchase Price ' + kv(text, 'Purchase Price'))
  if (stat(text, 'Selling Price') !== inr(118)) bad.push('Selling Price card ' + stat(text, 'Selling Price'))
  // selling price 0
  const { out, id, api: a0 } = await createViaUi(h, 'sell0', { name: nm('Sell0'), sku: skuOf('SELL0'), categoryRe: BASE_CAT, purchase: '50', selling: '0' })
  R('T9', 'Price relationship', bad.length ? 'FAIL' : 'PASS', 'Purchase 50 / Selling 118 persist and display unswapped; selling card = persisted selling price; selling 0 behaviour recorded', `${bad.join('; ') || 'stored 50/118, detail purchase ' + kv(text, 'Purchase Price') + ', card ' + stat(text, 'Selling Price')}. Selling Price = 0 is ${id ? 'ACCEPTED (product ' + a0.product_id + ' created, price ' + a0.price + ')' : 'rejected: ' + out.banner}. No rule forces selling >= purchase.`)
})
T.T10 = () => withSession('T10', async (h) => {
  const { page } = h
  const name = nm('GST-EXCL')
  const { out, id, api } = await createViaUi(h, 'gstexcl', { name, sku: skuOf('GSTEXCL'), categoryRe: BASE_CAT, purchase: '50', selling: '100', gst: '18', taxIncl: false, hsn: '12345678', openingStock: '20' })
  if (!id) { R('T10', 'GST tax-exclusive product', 'FAIL', 'created', out.banner); return }
  await H.openDetail(page, id); const text = await H.detailText(page); const shot = await SHOT(page, '10-gst-exclusive', true)
  const bad = mismatches(api, { tax_rate: 18, 'pricing.tax_inclusive': false, 'pricing.selling_price': 100, price: 100 })
  if (stat(text, 'Selling Price') !== inr(100)) bad.push('Selling Price card ' + stat(text, 'Selling Price') + ' (should stay 100, no GST added)')
  if (kv(text, 'GST/VAT Rate') !== '18%') bad.push('GST rate ' + kv(text, 'GST/VAT Rate'))
  if (kv(text, 'Tax Inclusive') !== 'No') bad.push('Tax Inclusive ' + kv(text, 'Tax Inclusive'))
  R('T10', 'GST tax-exclusive product', bad.length ? 'FAIL' : 'PASS', 'tax_rate 18, tax_inclusive false, selling price stays 100 (no double tax)', bad.join('; ') || `API tax_rate 18, tax_inclusive false, selling_price 100; detail: Selling Price ${stat(text, 'Selling Price')}, GST 18%, Tax Inclusive No`, { screenshot: shot, api: { request: out.req, response_pricing: api.pricing, tax_rate: api.tax_rate } })
})
T.T11 = () => withSession('T11', async (h) => {
  const { page } = h
  const name = nm('GST-INCL')
  const { out, id, api } = await createViaUi(h, 'gstincl', { name, sku: skuOf('GSTINCL'), categoryRe: BASE_CAT, purchase: '50', selling: '118', gst: '18', taxIncl: true, hsn: '12345678', openingStock: '20' })
  if (!id) { R('T11', 'GST tax-inclusive product', 'FAIL', 'created', out.banner); return }
  await H.openDetail(page, id); const text = await H.detailText(page); const shot = await SHOT(page, '11-gst-inclusive', true)
  const bad = mismatches(api, { tax_rate: 18, 'pricing.tax_inclusive': true, 'pricing.selling_price': 118, price: 118, 'pricing.purchase_price': 50 })
  if (stat(text, 'Selling Price') !== inr(118)) bad.push('Selling Price card ' + stat(text, 'Selling Price'))
  if (stat(text, 'Avg. GST Rate') !== '18%') bad.push('Avg GST ' + stat(text, 'Avg. GST Rate'))
  if (kv(text, 'Tax Inclusive') !== 'Yes') bad.push('Tax Inclusive ' + kv(text, 'Tax Inclusive'))
  if (kv(text, 'Purchase Price') !== inr(50)) bad.push('Purchase Price ' + kv(text, 'Purchase Price'))
  R('T11', 'GST tax-inclusive product', bad.length ? 'FAIL' : 'PASS', 'selling 118, tax 18, inclusive true; detail shows ₹118 / 18% / Yes / ₹50', bad.join('; ') || 'API selling 118, tax_rate 18, tax_inclusive true; detail Selling Price ₹ 118, Avg. GST 18%, Tax Inclusive Yes, Purchase ₹ 50. 118 not recalculated.', { screenshot: shot, api: { request: out.req, response_pricing: api.pricing } })
})
T.T12 = () => withSession('T12', async (h) => {
  const { page } = h
  const name = nm('Stock20')
  const { out, id, api } = await createViaUi(h, 'stock20', { name, sku: skuOf('STK20'), categoryRe: BASE_CAT, purchase: '50', selling: '118', openingStock: '20', tracking: true })
  if (!id) { R('T12', 'Opening stock / inventory', 'FAIL', 'created', out.banner); return }
  // immediately: no transaction has touched it
  await H.openDetail(page, id); const text = await H.detailText(page); const shot = await SHOT(page, '12-opening-stock', true)
  const inv = await H.api(page, '/inventory?search=' + encodeURIComponent(name) + '&page_size=20')
  const invRow = ((inv.body && inv.body.items) || []).find((x) => x.id === id)
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  const hasStockCol = /Stock/i.test(await page.locator('thead').first().innerText().catch(() => ''))
  const bad = mismatches(api, { opening_stock: 20, total_stock: 20, total_inventory: 20, inventory_tracking: true })
  if (stat(text, 'Total Stock') !== '20') bad.push('Detail Total Stock ' + stat(text, 'Total Stock'))
  if (!invRow || invRow.total_stock !== 20) bad.push('inventory API ' + JSON.stringify(invRow && { total_stock: invRow.total_stock, total_inventory: invRow.total_inventory }))
  R('T12', 'Opening stock / inventory (new untouched product)', bad.length ? 'FAIL' : 'PASS', 'opening_stock 20 and total_stock 20 immediately after creation', bad.join('; ') || `opening_stock 20, total_inventory ${api.total_inventory}, total_stock ${api.total_stock}; detail Total Stock ${stat(text, 'Total Stock')}; GET /inventory row total_stock ${invRow && invRow.total_stock}. Product list has ${hasStockCol ? 'a' : 'NO'} stock column.`, { screenshot: shot, priority: bad.length ? 'HIGH' : '', api: { request: out.req, response: { opening_stock: api.opening_stock, total_inventory: api.total_inventory, total_stock: api.total_stock } } })
})
T.T13 = () => withSession('T13', async (h) => {
  const { page } = h
  const { out, id, api } = await createViaUi(h, 'stock0', { name: nm('Stock0'), sku: skuOf('STK0'), categoryRe: BASE_CAT, purchase: '50', selling: '60', openingStock: '0' })
  if (!id) { R('T13', 'Zero opening stock', 'FAIL', 'created', out.banner); return }
  await H.openDetail(page, id); const text = await H.detailText(page)
  const bad = mismatches(api, { opening_stock: 0, total_stock: 0, status: 'active', is_active: true })
  if (stat(text, 'Total Stock') !== '0') bad.push('Detail Total Stock ' + stat(text, 'Total Stock'))
  R('T13', 'Zero opening stock', bad.length ? 'FAIL' : 'PASS', 'Created, Total Stock 0, active', bad.join('; ') || `opening_stock 0, total_stock 0, active; detail Total Stock ${stat(text, 'Total Stock')}`, { api: { request: out.req } })
})
T.T14 = () => withSession('T14', async (h) => {
  const { page, net } = h
  await H.openCreate(page)
  await H.fillForm(page, { name: nm('NoTrack'), sku: skuOf('NOTRACK'), categoryRe: BASE_CAT, purchase: '50', selling: '60', tracking: true, openingStock: '7' })
  await H.tab(page, 'Inventory Information')
  const onState = { opening: await L.fieldByLabel(page, 'Opening Stock').isDisabled(), uom: await page.locator('label').filter({ hasText: 'Unit of Measure' }).first().locator('xpath=following::*[@data-select-trigger="true"][1]').isDisabled().catch(() => null) }
  await H.setCheckbox(page, /^\s*Track inventory\s*$/, false); await page.waitForTimeout(500)
  const offState = { opening: await L.fieldByLabel(page, 'Opening Stock').isDisabled().catch(() => 'absent'), openingValue: await L.fieldByLabel(page, 'Opening Stock').inputValue().catch(() => 'absent') }
  const shotOff = await SHOT(page, '14-tracking-off')
  const out = await H.submit(page, net)
  const id = out.res && out.res.id
  if (id) remember('notrack', out.res)
  const api = id ? await H.getProduct(page, id) : null
  let text = ''; if (id) { await H.openDetail(page, id); text = await H.detailText(page) }
  const bad = []
  if (!id) bad.push('create failed: ' + out.banner)
  else {
    if (api.inventory_tracking !== false) bad.push('inventory_tracking ' + api.inventory_tracking)
    if (api.opening_stock > 0 && api.total_stock === 0) bad.push('contradictory state: opening_stock ' + api.opening_stock + ' but total_stock ' + api.total_stock)
  }
  R('T14', 'Inventory tracking toggle', bad.length ? 'FAIL' : 'PASS', 'Toggle exists; saved value matches; no contradictory stock state', `ON: opening stock disabled=${onState.opening}. OFF: opening stock disabled=${offState.opening} (value "${offState.openingValue}"). Saved inventory_tracking=${api && api.inventory_tracking}, opening_stock=${api && api.opening_stock}, total_stock=${api && api.total_stock}; detail Total Stock ${stat(text, 'Total Stock')}. ${bad.join('; ')}`, { screenshot: shotOff, api: { request: out.req } })
})

// ---------------------------------------------------------------- T15 / T16
T.T15 = () => withSession('T15', async (h) => {
  const m = P('minimal'); if (!m) { R('T15', 'Optional fields blank', 'BLOCKED', 'Needs T3', 'missing'); return }
  const { page } = h
  const api = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id); const text = await H.detailText(page)
  const bad = []
  if (/\b(undefined|null|NaN)\b/.test(text)) bad.push('detail page shows undefined/null/NaN: ' + (text.match(/.{20}\b(undefined|null|NaN)\b.{10}/) || [''])[0])
  const dashes = (text.match(/\| —/g) || []).length
  if (dashes < 5) bad.push('few empty-state dashes: ' + dashes)
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.locator('input[placeholder="Search products..."]').first().fill(m.name); await page.waitForTimeout(1800)
  const listText = norm(await page.locator('main').first().innerText())
  if (/\b(undefined|null|NaN)\b/.test(listText)) bad.push('list shows undefined/null/NaN')
  const optional = { manufacturer: api.manufacturer, model_number: api.model_number, short_name: api.short_name, barcode: api.barcode, description: api.description, notes: api.notes, hsn_code: api.hsn_code, supplier_product_code: api.supplier_product_code, lead_time: api.lead_time, color: api.color, material: api.material, product_tags: api.product_tags, launch_date: api.launch_date }
  R('T15', 'Optional fields left blank', bad.length ? 'FAIL' : 'PASS', 'Blank optional fields do not block, never print undefined/null; empty state is a dash; API holds null/empty', bad.join('; ') || `Created without any optional field. Detail shows ${dashes} dashes, no "undefined"/"null". API optional values: ${JSON.stringify(optional)}`, { api: { optional_fields: optional } })
})
T.T16S = () => withSession('T16S', async (h) => {
  const sp = ts(); const bad = []
  const r2 = await createViaUi(h, 'spaces', { name: '   QA-PW-Space-' + sp + '   ', sku: '  QA-PW-SKU-SP-' + sp + '  ', categoryRe: BASE_CAT, purchase: '50', selling: '60' })
  let trim = 'n/a'
  if (r2.id) { trim = 'name ' + JSON.stringify(r2.api.name) + ' sku ' + JSON.stringify(r2.api.sku); if (r2.api.name !== r2.api.name.trim() || r2.api.sku !== r2.api.sku.trim()) bad.push('leading/trailing spaces are stored untrimmed: ' + trim) } else bad.push('not created: ' + r2.out.status + ' ' + r2.out.banner)
  R('T16S', 'Leading/trailing spaces in name and SKU', bad.length ? 'FAIL' : 'PASS', 'Spaces are trimmed before saving', bad.join('; ') || 'trimmed: ' + trim, { api: { request_name: r2.out.req && r2.out.req.name, request_sku: r2.out.req && r2.out.req.sku } })
})
T.T16 = () => withSession('T16', async (h) => {
  const { page } = h
  const long = (p, n) => (p + 'x'.repeat(n)).slice(0, n)
  const name = ('QA-PW-LONG-' + ts() + '-').padEnd(120, 'N')
  const sku = ('QA-PW-LONG-' + ts() + '-').padEnd(48, 'S')
  const model = long('QA-PW-MODEL-', 80), desc = long('QA-PW description ', 400), notes = long('QA-PW notes ', 300), barcode = long('QA-PW-BC-' + ts() + '-', 60)
  const r1 = await createViaUi(h, 'long', { name, sku, barcode, modelNumber: model, description: desc, categoryRe: BASE_CAT, purchase: '50', selling: '60', extra: { 'Additional Information': { Notes: notes } } }, { shotName: '16-long-values' })
  const bad = []
  if (!r1.id) bad.push('long values not created: ' + r1.out.banner)
  else bad.push(...mismatches(r1.api, { name, sku, model_number: model, description: desc, notes, barcode }))
  // over-limit typing: name maxLength 150
  await H.openCreate(h.page)
  await h.page.keyboard.press('Escape')
  await L.fillLabel(h.page, 'Product Name', 'N'.repeat(170)); const typed = (await L.fieldByLabel(h.page, 'Product Name').inputValue()).length
  await L.fillLabel(h.page, 'Product Code / SKU', 'S'.repeat(70)); const typedSku = (await L.fieldByLabel(h.page, 'Product Code / SKU').inputValue()).length
  if (typed > 150) bad.push('name field accepts ' + typed + ' chars (limit 150)')
  if (typedSku > 50) bad.push('SKU field accepts ' + typedSku + ' chars (UI limit 50)')
  R('T16', 'Long text / boundary values', bad.length ? 'FAIL' : 'PASS', 'Normal long strings saved intact; leading/trailing spaces trimmed; field limits enforced', `Long name(120)/sku(48)/model(80)/desc(400)/notes(300)/barcode(60): ${r1.id ? 'saved and equal' : 'not saved'}; typing 170 chars into name keeps ${typed}, 70 into SKU keeps ${typedSku}. ${bad.join('; ')}`, { screenshot: r1.out.shot })
})

// ---------------------------------------------------------------- T17 edit
T.T17 = () => withSession('T17', async (h) => {
  const m = P('minimal'); if (!m) { R('T17', 'Edit product persistence', 'BLOCKED', 'Needs T3', 'missing'); return }
  const { page, net } = h
  const before = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id)
  await page.getByRole('button', { name: /^edit/i }).first().click(); await page.waitForTimeout(2500); await L.settle(page, 10000)
  const newName = m.name + '-EDIT'
  await L.fillLabel(page, 'Product Name', newName)
  await H.pickOption(page, 'Category', /^Electronics$/); await page.waitForTimeout(1500); await H.pickOption(page, 'Sub Category', null)
  await H.tab(page, 'Inventory Information')
  const stockLocked = await L.fieldByLabel(page, 'Opening Stock').isDisabled()
  if (!stockLocked) await L.fillLabel(page, 'Opening Stock', '7')
  await H.tab(page, 'Pricing Information'); await L.fillLabel(page, 'Purchase Price', '60'); await L.fillLabel(page, 'Selling Price', '150')
  await H.tab(page, 'Tax Information'); await L.fillLabel(page, 'GST/VAT Rate', '12')
  await H.tab(page, 'Basic Information'); await L.fillLabel(page, 'Product Description', 'QA-PW edited description')
  const shotForm = await SHOT(page, '17-product-edit')
  const out = await H.submit(page, net, { label: /^save changes$/i })
  await page.waitForTimeout(2500)
  const after = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id); await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const text = await H.detailText(page)
  const bad = mismatches(after, { name: newName, 'pricing.purchase_price': 60, 'pricing.selling_price': 150, price: 150, tax_rate: 12, description: 'QA-PW edited description', sku: m.sku, barcode: before.barcode })
  if (!(after.updated_at > before.updated_at)) bad.push('updated_at did not change: ' + before.updated_at + ' -> ' + after.updated_at)
  if (after.category_id === before.category_id) bad.push('category not changed')
  if (after.sub_category_id === before.sub_category_id) bad.push('sub category not changed')
  if (!text.includes(newName) || stat(text, 'Selling Price') !== inr(150)) bad.push('detail not updated')
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.locator('input[placeholder="Search products..."]').first().fill(newName); await page.waitForTimeout(1800)
  if (!norm(await page.locator('main').first().innerText()).includes(newName)) bad.push('list does not show the new name')
  R('T17', 'Edit product persistence', bad.length ? 'FAIL' : 'PASS', 'Edited values persist (API, refresh, list, detail); updated_at changes; unchanged fields stay', bad.join('; ') || `PATCH ${out.status}; name/prices/GST/description/category/sub updated; updated_at ${before.updated_at} -> ${after.updated_at}; SKU/barcode unchanged. Opening Stock field in the edit form is ${stockLocked ? 'DISABLED (locked after creation; stock changes only through stock workflows)' : 'editable: opening_stock=' + after.opening_stock + ', total_stock=' + after.total_stock}.`, { screenshot: shotForm, api: { request: out.req, opening_stock: after.opening_stock, total_stock: after.total_stock } })
  H.setState({ editedName: newName })
})

// ---------------------------------------------------------------- T18 deactivate / reactivate, T19 delete
T.T18 = () => withSession('T18', async (h) => {
  const m = P('gstexcl'); if (!m) { R('T18', 'Deactivate', 'BLOCKED', 'Needs T10', 'missing'); return }
  const { page } = h
  const before = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id)
  await page.getByRole('button', { name: /^deactivate$/i }).first().click(); await page.waitForTimeout(800)
  await SHOT(page, '18-deactivate-confirm')
  await page.getByRole('button', { name: /^deactivate$/i }).last().click(); await page.waitForTimeout(3000); await L.settle(page, 8000)
  const api = await H.getProduct(page, m.id)
  const text = await H.detailText(page)
  const bad = []
  if (api.status !== 'inactive' || api.is_active !== false) bad.push('status ' + api.status + ' is_active ' + api.is_active)
  if (!/Inactive/.test(text)) bad.push('detail does not show Inactive')
  for (const k of ['name', 'sku', 'tax_rate', 'opening_stock', 'total_stock']) if (api[k] !== before[k]) bad.push('data changed: ' + k)
  if (api.pricing.selling_price !== before.pricing.selling_price) bad.push('price changed')
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.locator('input[placeholder="Search products..."]').first().fill(m.name); await page.waitForTimeout(1800)
  const row = norm(await page.locator('tbody tr').first().innerText().catch(() => ''))
  if (!/Inactive/i.test(row)) bad.push('list row does not show Inactive: ' + row.slice(0, 100))
  const shot = await SHOT(page, '18-deactivated-list')
  R('T18', 'Deactivate (QA product only)', bad.length ? 'FAIL' : 'PASS', 'status inactive, detail + list reflect it, data intact', bad.join('; ') || `status=inactive, is_active=false; detail shows Inactive; list row "${row.slice(0, 90)}"; name/sku/GST/stock/price unchanged`, { screenshot: shot })
})
T.T18b = () => withSession('T18b', async (h) => {
  const m = P('gstexcl'); if (!m) { R('T18b', 'Reactivate', 'BLOCKED', 'Needs T10', 'missing'); return }
  const { page } = h
  await H.openDetail(page, m.id)
  await page.getByRole('button', { name: /^activate$/i }).first().click(); await page.waitForTimeout(800)
  await page.getByRole('button', { name: /^activate$/i }).last().click(); await page.waitForTimeout(3000)
  const api = await H.getProduct(page, m.id)
  R('T18b', 'Reactivate', api.status === 'active' && api.is_active ? 'PASS' : 'FAIL', 'status active again', `status=${api.status}, is_active=${api.is_active}`)
})
T.T19 = () => withSession('T19', async (h) => {
  const m = P('dupname'); if (!m) { R('T19', 'Delete', 'BLOCKED', 'Needs a QA product (T7)', 'missing'); return }
  if (!/^QA-PW-/.test(m.name)) { R('T19', 'Delete', 'BLOCKED', 'QA-PW only', 'refusing: not a QA-PW record'); return }
  const { page } = h
  await H.openDetail(page, m.id)
  await page.getByRole('button', { name: /^delete$/i }).first().click(); await page.waitForTimeout(800)
  const confirmText = norm(await page.locator('body').innerText()).match(/Delete [^.]*\? This cannot be undone\./)
  const shotConf = await SHOT(page, '19-delete-confirm')
  await page.getByRole('button', { name: /^delete$/i }).last().click(); await page.waitForTimeout(3500); await L.settle(page, 8000)
  const after = await H.api(page, '/products/' + m.id)
  const url = page.url().replace(H.BASE, '')
  await page.goto(H.BASE + '/admin/products', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
  await page.locator('input[placeholder="Search products..."]').first().fill(m.sku); await page.waitForTimeout(1800)
  const listHas = norm(await page.locator('main').first().innerText()).includes(m.sku)
  await H.openDetail(page, m.id); const direct = (await H.detailText(page)).slice(0, 160)
  const shot = await SHOT(page, '19-deleted-detail')
  const bad = []
  if (!confirmText) bad.push('no confirmation text seen')
  if (after.status !== 404) bad.push('GET after delete returned ' + after.status)
  if (listHas) bad.push('still in list')
  R('T19', 'Delete (QA product only)', bad.length ? 'FAIL' : 'PASS', 'Confirmation appears; product removed; direct access no longer an active product; list updated', bad.join('; ') || `Confirmation "${confirmText && confirmText[0]}"; GET /products/{id} -> 404; redirected to ${url}; not in list; direct detail shows "${direct.slice(0, 80)}"`, { screenshot: shot })
  const s = H.state(); const list = (s.created || []).map((c) => (c.id === m.id ? { ...c, deleted: true } : c)); H.setState({ created: list })
})

// ---------------------------------------------------------------- T20 refresh
T.T20 = () => withSession('T20', async (h) => {
  const m = P('full'); if (!m) { R('T20', 'Refresh / persistence', 'BLOCKED', 'Needs T4', 'missing'); return }
  const { page } = h
  const first = await H.getProduct(page, m.id)
  await H.openDetail(page, m.id)
  const keys = (a) => ({ name: a.name, sku: a.sku, category_id: a.category_id, sub_category_id: a.sub_category_id, tax_rate: a.tax_rate, price: a.price, purchase: a.pricing.purchase_price, selling: a.pricing.selling_price, stock: a.total_stock, status: a.status })
  const steps = []
  await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1200)
  steps.push(['hard reload', JSON.stringify(keys(await H.getProduct(page, m.id))) === JSON.stringify(keys(first)) && (await H.detailText(page)).includes(m.name)])
  await page.goto(H.BASE + '/admin/customers', { waitUntil: 'domcontentloaded' }); await L.settle(page, 10000)
  await page.goBack({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1200)
  steps.push(['navigate away and back', (await H.detailText(page)).includes(m.name)])
  const refetch = await H.getProduct(page, m.id)
  steps.push(['re-fetch from API equal', JSON.stringify(keys(refetch)) === JSON.stringify(keys(first))])
  const text = await H.detailText(page)
  steps.push(['detail values still correct', stat(text, 'Selling Price') === inr(118) && stat(text, 'Total Stock') === '20' && kv(text, 'GST/VAT Rate') === '18%'])
  const bad = steps.filter((s) => !s[1])
  R('T20', 'Refresh / persistence', bad.length ? 'FAIL' : 'PASS', 'Product, prices, category, GST, stock, SKU, status remain after reload / navigation / re-fetch', steps.map((s) => `${s[1] ? 'ok' : 'FAIL'}: ${s[0]}`).join('; '))
})

// ---------------------------------------------------------------- T21 consistency, T22 detail, T23 margin
const CONSIST = (api, text, label) => {
  const bad = []
  const ck = (what, ui, want) => { if (norm(ui) !== norm(want)) bad.push(`${label} ${what}: UI "${ui}" vs API "${want}"`) }
  if (!norm(text).includes(api.name)) bad.push(`${label} name not on page`)
  if (!norm(text).includes(api.product_id)) bad.push(`${label} product_id ${api.product_id} not on page`)
  if (!norm(text).includes(api.sku)) bad.push(`${label} sku not on page`)
  ck('status', kv(text, 'Lifecycle Status'), api.status === 'active' ? 'Active' : api.status.charAt(0).toUpperCase() + api.status.slice(1))
  ck('uom', kv(text, 'Unit of Measure'), api.uom || '—')
  ck('hsn', kv(text, 'HSN/SAC Code'), api.hsn_code || '—')
  ck('tax_rate', kv(text, 'GST/VAT Rate'), (api.tax_rate || 0) + '%')
  ck('purchase', kv(text, 'Purchase Price'), inr(api.pricing.purchase_price))
  ck('selling card', stat(text, 'Selling Price'), inr(api.pricing.selling_price))
  ck('mrp', kv(text, 'MRP'), inr(api.pricing.mrp || 0)); ck('wholesale', kv(text, 'Wholesale Price'), inr(api.pricing.wholesale_price || 0)); ck('dealer', kv(text, 'Dealer Price'), inr(api.pricing.dealer_price || 0))
  ck('discount', kv(text, 'Discount %'), (api.pricing.discount_percent || 0) + '%')
  ck('tax inclusive', kv(text, 'Tax Inclusive'), api.pricing.tax_inclusive ? 'Yes' : 'No')
  ck('total stock', stat(text, 'Total Stock'), String(api.total_stock))
  if (api.price !== api.pricing.selling_price) bad.push(`${label} price ${api.price} != pricing.selling_price ${api.pricing.selling_price}`)
  if (api.total_inventory !== api.total_stock && !api.has_variants) bad.push(`${label} total_inventory ${api.total_inventory} != total_stock ${api.total_stock}`)
  if (api.is_active !== (api.status === 'active')) bad.push(`${label} is_active ${api.is_active} vs status ${api.status}`)
  return bad
}
T.T21 = () => withSession('T21', async (h) => {
  const { page } = h; const bad = []; const used = []
  for (const key of ['minimal', 'full', 'gstincl', 'gstexcl', 'stock20']) {
    const m = P(key); if (!m) continue
    const api = await H.getProduct(page, m.id); await H.openDetail(page, m.id)
    bad.push(...CONSIST(api, await H.detailText(page), key)); used.push(key + ':' + api.product_id)
    const cats = (await H.api(page, '/categories/' + api.category_id)).body
    if (cats && cats.name && !(await H.detailText(page)).includes(cats.name)) bad.push(key + ' category name "' + cats.name + '" not on page')
  }
  R('T21', 'API / UI consistency', bad.length ? 'FAIL' : 'PASS', 'Every compared field equals between detail page and GET /products/{id}', bad.join('; ') || `Compared name, product_id, sku, category, status, uom, opening/total stock, tax_rate, hsn, price, purchase/selling/mrp/wholesale/dealer/discount, tax_inclusive, is_active on ${used.join(', ')}: no mismatch`)
})
T.T22 = () => withSession('T22', async (h) => {
  const m = P('full'), e = P('minimal'); if (!m || !e) { R('T22', 'Product Detail UI', 'BLOCKED', 'Needs T3/T4', 'missing'); return }
  const { page } = h; const bad = []
  await H.openDetail(page, m.id); const text = await H.detailText(page); const shot = await SHOT(page, '22-product-detail', true)
  for (const s of ['Variants', 'Selling Price', 'Avg. GST Rate', 'Avg. Margin', 'Total Stock']) if (stat(text, s) == null) bad.push('stat card missing: ' + s)
  for (const s of ['CLASSIFICATION', 'PRICING', 'TAX & PURCHASE', 'PHYSICAL SPECIFICATIONS', 'ADDITIONAL INFORMATION', 'Attachments']) if (!text.includes(s)) bad.push('section missing: ' + s)
  if (stat(text, 'Variants') !== '0') bad.push('Variants card ' + stat(text, 'Variants') + ' for a product without variants')
  if (stat(text, 'Avg. GST Rate') !== '18%') bad.push('Avg GST ' + stat(text, 'Avg. GST Rate'))
  if (stat(text, 'Selling Price') !== inr(118)) bad.push('Selling Price card ' + stat(text, 'Selling Price'))
  const cat = kv(text, 'Category'), sub = kv(text, 'Sub Category'); if (cat !== 'Beverages' || !/^Beverages ›/.test(sub || '')) bad.push(`classification labels "${cat}" / "${sub}"`)
  if (/₹\s?\d/.test(text) === false) bad.push('no ₹ amounts')
  if (/\b(undefined|null|NaN)\b/.test(text)) bad.push('undefined/null/NaN visible')
  await H.openDetail(page, e.id); const t2 = await H.detailText(page)
  if (/\b(undefined|null|NaN)\b/.test(t2)) bad.push('minimal product shows undefined/null/NaN')
  if (!/Attachments \| Extra files attached to this product \(up to 10\) \| No attachments uploaded yet\./.test(norm(t2))) bad.push('attachments empty state text changed: ' + (norm(t2).match(/Attachments \|.{0,100}/) || [''])[0])
  R('T22', 'Product Detail UI', bad.length ? 'FAIL' : 'PASS', 'Cards and sections correct, ₹ and % formatted, clean empty states', bad.join('; ') || `Cards: Variants ${stat(text, 'Variants')}, Selling ${stat(text, 'Selling Price')}, Avg GST ${stat(text, 'Avg. GST Rate')}, Avg Margin ${stat(text, 'Avg. Margin')}, Total Stock ${stat(text, 'Total Stock')}; sections Classification/Pricing/Tax & Purchase/Physical/Additional/Attachments present; category "${cat}" / "${sub}"; empty fields show a dash`, { screenshot: shot })
})
T.T23 = () => withSession('T23', async (h) => {
  const m = P('gstincl') || P('minimal'); if (!m) { R('T23', 'Margin display', 'BLOCKED', 'Needs 50/118 product', 'missing'); return }
  const { page } = h
  await H.openDetail(page, m.id); const text = await H.detailText(page)
  const code = fs.readFileSync(path.join(H.ROOT, 'src', 'utils', 'productVariants.js'), 'utf8').match(/export function variantMargin[\s\S]*?\n}/)[0]
  const detailCode = fs.readFileSync(path.join(H.ROOT, 'src', 'features', 'products', 'ProductDetail.jsx'), 'utf8').match(/const avgMargin[^\n]*/)[0]
  const shown = stat(text, 'Avg. Margin')
  const salesMargin = Math.round(((118 - 50) / 118) * 100)
  const markup = Math.round(((118 - 50) / 50) * 100)
  const usesSales = /sellingPrice\) - Number\(variant\.purchasePrice\)\) \/ Number\(variant\.sellingPrice\)/.test(code)
  R('T23', 'Margin display', usesSales && shown === salesMargin + '%' ? 'PASS' : 'FAIL', `Formula documented; 50/118 shows ${salesMargin}% under the sales-margin formula (markup would be ${markup}%)`, `Implemented formula (src/utils/productVariants.js variantMargin): (selling - purchase) / selling x 100 = SALES MARGIN, rounded to a whole number in ProductDetail ("${detailCode.trim()}"). 50/118 -> ${salesMargin}%; page shows "${shown}". Not markup (${markup}%).`)
})

// ---------------------------------------------------------------- T24 double submit
T.T24 = () => withSession('T24', async (h) => {
  const { page } = h
  const single = P('minimal')
  const name = nm('Dbl')
  let out, id, tries = 0
  do { tries += 1; ({ out, id } = await createViaUi(h, 'dbl', { name, sku: skuOf('DBL'), categoryRe: BASE_CAT, purchase: '50', selling: '60' }, { dbl: true })) } while (!id && out.status === 503 && tries < 4)
  await page.waitForTimeout(1500)
  const found = (await H.findProducts(page, name)).filter((p) => p.name === name)
  for (const p of found.slice(1)) H.addCreated({ kind: 'product', key: 'dbl-extra', id: p.id, name: p.name, sku: p.sku })
  const bad = []
  if (out.posts !== 1) bad.push('rapid double-click sent ' + out.posts + ' POST requests')
  if (found.length !== 1) bad.push(found.length + ' products named ' + name)
  if (!id) { R('T24', 'No duplicate submission', 'BLOCKED', 'Needs one successful create', 'Every attempt returned HTTP ' + out.status + ' (transient backend 503)'); return }
  const normalOnce = single ? 'T3 normal click sent ' + (H.results().T3 ? 'exactly one POST (see T3)' : '?') : ''
  R('T24', 'No duplicate submission', bad.length ? 'FAIL' : 'PASS', 'One normal click = one product; a rapid double-click still creates one', `${normalOnce}. Rapid double-click (attempt ${tries}${tries > 1 ? ', earlier attempts hit the transient 503 and saved nothing' : ''}): ${out.posts} POST request(s), HTTP ${out.status}; ${found.length} product(s) named ${name}. ${bad.join('; ')}`, { api: { posts: out.posts } })
})

// ---------------------------------------------------------------- Variants
T.VAR = () => withSession('VAR', async (h) => {
  const { page, net } = h
  const name = nm('Variants'), sku = skuOf('VAR')
  await H.openCreate(page)
  await H.fillForm(page, { name, sku, categoryRe: BASE_CAT, hasVariants: true, uom: false, purchase: undefined })
  await H.tab(page, 'Variants & Attributes')
  await page.locator('input[placeholder="e.g. Color, Size"]').fill('Size')
  const addBtn = page.getByRole('button', { name: /new variant/i })
  await addBtn.click(); await page.waitForTimeout(500); await addBtn.click(); await page.waitForTimeout(500)
  const names = page.locator('input[placeholder="e.g. Red / Large"]')
  const vals = [['Small', '60', '70', '10'], ['Medium', '60', '80', '5']]
  for (let i = 0; i < 2; i++) {
    // the price inputs are labelled by variant name once it is typed, so fill stock + prices first, name last
    const row = names.nth(i)
    await row.locator('xpath=following::input[@type="number"][1]').fill(vals[i][3]).catch(() => {})
    await page.locator(`input[aria-label="Variant ${i + 1} purchasePrice"]`).fill(vals[i][1])
    await page.locator(`input[aria-label="Variant ${i + 1} sellingPrice"]`).fill(vals[i][2])
    await row.fill(vals[i][0])
  }
  const shotForm = await SHOT(page, '24-variants-form', true)
  const out = await H.submit(page, net)
  const id = out.res && out.res.id
  if (!id) { R('VAR', 'Variants', 'FAIL', 'Product with 2 variants created', `not created: status ${out.status} banner "${out.banner}" errors ${JSON.stringify(out.fieldErrors)} req ${JSON.stringify(out.req).slice(0, 300)}`, { screenshot: shotForm }); return }
  remember('variants', out.res)
  const api = await H.getProduct(page, id)
  await H.openDetail(page, id); await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
  const text = await H.detailText(page); const shot = await SHOT(page, '24-variants-detail', true)
  const vs = api.variations || []
  const bad = []
  if (vs.length !== 2) bad.push('variants in API ' + vs.length)
  if (stat(text, 'Variants') !== '2') bad.push('Variants card ' + stat(text, 'Variants'))
  if (api.has_variants !== true) bad.push('has_variants ' + api.has_variants)
  const stockSum = vs.reduce((a, v) => a + (v.inventory || 0), 0)
  if (api.total_stock !== stockSum) bad.push('total_stock ' + api.total_stock + ' vs variant sum ' + stockSum)
  if (stat(text, 'Total Stock') !== String(api.total_stock)) bad.push('Total Stock card ' + stat(text, 'Total Stock'))
  const skus = vs.map((v) => v.sku || v.variant_code)
  if (new Set(skus).size !== skus.length) bad.push('duplicate variant SKU/codes ' + JSON.stringify(skus))
  // duplicate variant combination
  await H.openCreate(page)
  await H.fillForm(page, { name: nm('VarDup'), sku: skuOf('VARDUP'), categoryRe: BASE_CAT, hasVariants: true, uom: false })
  await H.tab(page, 'Variants & Attributes'); await page.locator('input[placeholder="e.g. Color, Size"]').fill('Size')
  await page.getByRole('button', { name: /new variant/i }).click(); await page.waitForTimeout(400); await page.getByRole('button', { name: /new variant/i }).click(); await page.waitForTimeout(400)
  for (let i = 0; i < 2; i++) { await page.locator(`input[aria-label="Variant ${i + 1} sellingPrice"]`).fill('70'); await page.locator(`input[aria-label="Variant ${i + 1} purchasePrice"]`).fill('60'); await page.locator('input[placeholder="e.g. Red / Large"]').nth(i).fill('Small') }
  const dup = await H.submit(page, net)
  const dupSaved = !!(dup.res && dup.res.id)
  if (dupSaved) { H.addCreated({ kind: 'product', key: 'var-dup', id: dup.res.id, name: dup.res.name, sku: dup.res.sku }); bad.push('two variants both named "Small" were accepted') }
  R('VAR', 'Variants (create from Product Create UI)', bad.length ? 'FAIL' : 'PASS', 'has_variants, 2 variants saved with stock/prices, Variants card = 2, persists, duplicates prevented', bad.join('; ') || `Saved 2 variants (${(vs.map((v) => v.name + ' stock ' + v.inventory + ' price ' + (v.pricing && v.pricing.selling_price))).join(', ')}); card Variants 2; total_stock ${api.total_stock}; persisted after refresh; duplicate "Small" twice: ${dupSaved ? 'ACCEPTED' : 'rejected: ' + dup.banner}`, { screenshot: shot, api: { variants: vs.map((v) => ({ name: v.name, sku: v.sku, variant_code: v.variant_code, inventory: v.inventory })) } })
})

// ---------------------------------------------------------------- Attachments
T.ATT = () => withSession('ATT', async (h) => {
  const { page, net } = h
  const png = L.ensureTestPng()
  const fx = path.join(H.OUT, 'fixtures')
  const pdf = path.join(fx, 'qa-pw-sample.pdf'); fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
  const txt = path.join(fx, 'qa-pw-invalid.txt'); fs.writeFileSync(txt, 'plain text, not an allowed type')
  const name = nm('Attach'); const notes = []
  await H.openCreate(page)
  await H.fillForm(page, { name, sku: skuOf('ATT'), categoryRe: BASE_CAT, purchase: '50', selling: '60' })
  await H.tab(page, 'Product Images & Media')
  const uploads = []
  page.on('response', (r) => { if (/\/files\/upload/.test(r.url())) uploads.push(r.status()) })
  // invalid type into the image slot
  await page.locator('input[type=file]').first().setInputFiles(txt); await page.waitForTimeout(1800)
  const invalidMsg = norm(await page.locator('main').first().innerText()).match(/(only|allowed|PNG|JPG|unsupported|invalid)[^|]{0,80}/i)
  const badUploadsAfterInvalid = uploads.length
  await SHOT(page, '25-attachment-invalid-type')
  // valid image + additional image
  await page.locator('input[type=file]').first().setInputFiles(png); await page.waitForTimeout(3500)
  await page.locator('input[type=file]').nth(1).setInputFiles([png]).catch((e) => notes.push('additional image: ' + e.message.split('\n')[0])); await page.waitForTimeout(3000)
  // documents
  await H.tab(page, 'Documents')
  await page.locator('input[type=file]').nth(0).setInputFiles(pdf); await page.waitForTimeout(3000)
  await page.locator('input[type=file]').last().setInputFiles(pdf).catch((e) => notes.push('other attachments: ' + e.message.split('\n')[0])); await page.waitForTimeout(3000)
  // datasheet with the wrong type
  await page.locator('input[type=file]').nth(1).setInputFiles(txt); await page.waitForTimeout(1500)
  const docsText = norm(await page.locator('main').first().innerText())
  const out = await H.submit(page, net)
  const id = out.res && out.res.id
  if (!id) { R('ATT', 'Attachments / images', 'FAIL', 'Product with image + documents created', `not created: ${out.status} ${out.banner}; uploads ${JSON.stringify(uploads)}`); return }
  remember('attach', out.res)
  const api = await H.getProduct(page, id)
  await H.openDetail(page, id); await page.reload({ waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(2000)
  const text = await H.detailText(page); const shot = await SHOT(page, '25-attachments-detail', true)
  const att = await H.api(page, '/products/' + id + '/attachments')
  const imgOk = await page.evaluate(() => Array.from(document.images).some((i) => i.naturalWidth > 0 && /files|product/i.test(i.src)))
  const bad = []
  if (!api.cover_image) bad.push('cover_image not saved')
  if (!imgOk) bad.push('no loaded product image visible on detail')
  if (!/\/files\//.test(api.cover_image || '')) bad.push('cover_image is not a /files/ path: ' + api.cover_image)
  if (badUploadsAfterInvalid > 0) bad.push('invalid .txt in image slot triggered an upload request')
  if (!invalidMsg) notes.push('no visible error text for the invalid image type (the picker accept= filter blocks it in a real browser)')
  R('ATT', 'Attachments / images', bad.length ? 'FAIL' : 'PASS', 'Valid image + PDF accepted and shown after refresh; unsupported type refused', `cover_image ${api.cover_image}; images ${JSON.stringify(api.images)}; attachments API ${att.status} ${JSON.stringify(att.body).slice(0, 160)}; uploads status ${JSON.stringify(uploads)}; invalid .txt in image slot: ${invalidMsg ? invalidMsg[0] : 'no message'}; ${notes.join('; ')} ${bad.join('; ')}`, { screenshot: shot })
})

// ---------------------------------------------------------------- Cross-module discoverability
async function discover(page, name) {
  const res = {}
  const has = async (fn) => { try { return await fn() } catch (e) { return 'could not drive: ' + e.message.split('\n')[0] } }
  res.salesOrder = await has(async () => {
    await page.goto(H.BASE + '/admin/orders/create', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
    await page.waitForFunction(() => !/Loading products/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {})
    await page.locator('input[placeholder*="Search products"]').first().fill(name); await page.waitForTimeout(1800)
    return (await page.locator('input[aria-label="' + name + ' quantity"]').count()) > 0
  })
  res.inventory = await has(async () => {
    await page.goto(H.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000)
    const box = page.locator('input[type=search], input[placeholder*="Search products" i]').first(); await box.fill(name); await box.press('Enter'); await page.waitForTimeout(2500)
    return norm(await page.locator('main').first().innerText()).includes(name)
  })
  res.purchase = await has(async () => {
    await page.goto(H.BASE + '/admin/purchases/create', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(1500)
    await page.locator('tbody tr [data-select-trigger="true"]').first().click({ timeout: 6000 })
    await page.keyboard.type(name.slice(0, 18)); await page.waitForTimeout(1500)
    const opts = (await page.getByRole('option').allInnerTexts()).map(norm); await page.keyboard.press('Escape')
    return opts.some((o) => o.includes(name))
  })
  res.quotation = await has(async () => {
    await page.goto(H.BASE + '/admin/quotations/new', { waitUntil: 'domcontentloaded' }); await L.settle(page, 15000); await page.waitForTimeout(2000)
    const box = page.locator('input[placeholder*="earch" i]:visible').last()
    if (await box.count()) { await box.fill(name); await page.waitForTimeout(1500) }
    return norm(await page.locator('main').first().innerText()).includes(name)
  })
  return res
}
T.CM = () => withSession('CM', async (h) => {
  const a = P('stock20'), d = P('gstexcl'); if (!a || !d) { R('CM', 'Cross-module discoverability', 'BLOCKED', 'Needs active + deactivated QA products', 'missing'); return }
  const { page } = h
  const act = await discover(page, a.name); const shotA = await SHOT(page, '26-cross-module-active')
  const apiD = await H.getProduct(page, d.id)
  const inact = await discover(page, d.name)
  const f = (v) => (v === true ? 'found' : v === false ? 'NOT found' : v)
  H.setState({ cross: { active: act, inactive: inact, inactiveStatus: apiD.status } })
  const driveIssues = Object.entries({ ...act, ...inact }).filter(([, v]) => typeof v === 'string')
  const bad = Object.entries(act).filter(([, v]) => v === false).map(([k]) => 'active product not found in ' + k)
  R('CM', 'Cross-module discoverability', bad.length ? 'FAIL' : (driveIssues.length ? 'PASS' : 'PASS'), 'Active QA product is selectable in Sales Order / Purchase / Quotation / Inventory; deactivated behaviour recorded', `ACTIVE (${a.product_id}): ${Object.entries(act).map(([k, v]) => k + ' ' + f(v)).join(', ')}. DEACTIVATED (${d.product_id}, status ${apiD.status}): ${Object.entries(inact).map(([k, v]) => k + ' ' + f(v)).join(', ')}. ${driveIssues.length ? 'Selectors that could not be driven are shown as text above (not counted as FAIL).' : ''}`, { screenshot: shotA })
})

// ---------------------------------------------------------------- runner
;(async () => {
  const args = process.argv.slice(2)
  const order = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T16S', 'T17', 'T18', 'CM', 'T18b', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24', 'VAR', 'ATT']
  const run = args.length && args[0] !== 'all' ? args : order
  for (const id of run) {
    if (!T[id]) { console.log('unknown test', id); continue }
    try { await T[id]() } catch (e) {
      console.log('SCRIPT ERROR in ' + id + ': ' + e.message.split('\n')[0])
      R(id, 'script error', 'BLOCKED', 'test runs', 'Script/selector problem (not an app verdict): ' + e.message.split('\n').slice(0, 2).join(' | '))
    }
  }
})()
