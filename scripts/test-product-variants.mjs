// node --test scripts/test-product-variants.mjs
// Actual frontend modules run against mocked transport; no live records are created.
import assert from 'node:assert/strict'
import { before, beforeEach, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer, transformWithOxc } from 'vite'
import { parseSync } from 'rolldown/utils'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, client, productsApi, ordersApi, quotesApi, utils, variants, quoteHelpers, Picker
const smallId = '10000000-0000-4000-8000-000000000001'
const mediumId = '10000000-0000-4000-8000-000000000002'
const categoryId = '20000000-0000-4000-8000-000000000001'
const childId = '20000000-0000-4000-8000-000000000002'
const product = {
  id: 'product-1', name: 'LED Batten', sku: 'PARENT-SKU', price: 999, total_stock: 20,
  category_id: categoryId, category: { name: 'Electrical' }, sub_category_id: childId,
  product_type: 'LED lighting', variations: [
    { id: smallId, variant_code: 'VAR-0001', name: 'Small', sku: 'LED-S', inventory: 10,
      pricing: { purchase_price: 50, selling_price: 75, mrp: 90, wholesale_price: 70, dealer_price: 65, discount_percent: 5, tax_inclusive: false, currency: 'INR' } },
    { id: mediumId, variant_code: 'VAR-0002', name: 'Medium', sku: 'LED-M', inventory: 10,
      pricing: { purchase_price: 60, selling_price: 80, mrp: 100, wholesale_price: 75, dealer_price: 70, discount_percent: 0, tax_inclusive: true, currency: 'INR' } },
  ],
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  productsApi = await server.ssrLoadModule('/src/api/products.js')
  ordersApi = await server.ssrLoadModule('/src/api/orders.js')
  quotesApi = await server.ssrLoadModule('/src/api/quotations.js')
  utils = await server.ssrLoadModule('/src/features/products/productUtils.js')
  variants = await server.ssrLoadModule('/src/utils/productVariants.js')
  quoteHelpers = await server.ssrLoadModule('/src/features/quotations/quotationHelpers.js')
  ;({ default: Picker } = await server.ssrLoadModule('/src/features/orders/ProductPickerList.jsx'))
})
beforeEach(() => {
  for (const method of ['get', 'post', 'patch']) client[method] = async () => { throw new Error('Unexpected API call') }
})
after(async () => { await server?.close() })

function walk(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (value.type) out.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, out))
    else if (child && typeof child === 'object') walk(child, out)
  }
  return out
}
async function sourceOf(file) {
  const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const parsed = parseSync(file, source)
  assert.equal(parsed.errors.length, 0)
  return { source, nodes: walk(parsed.program) }
}
function evaluate(source, node, context = {}) {
  return new Function(...Object.keys(context), `return (${source.slice(node.start, node.end)})`)(...Object.values(context))
}
async function handler(file, name, context) {
  const { source, nodes } = await sourceOf(file)
  const node = nodes.find((entry) => entry.type === 'VariableDeclarator' && entry.id.name === name)?.init
  assert.ok(node, `${file}: ${name}`)
  return evaluate(source, node, context)
}
async function formHelpers() {
  const { source, nodes } = await sourceOf('features/products/ProductForm.jsx')
  const names = ['emptyVariantInventory', 'emptyForm', 'makeEmptyVariant', 'normalizeVariantInventory', 'hydrateProduct', 'getVariantName', 'getVariantInventoryNumber']
  const selected = names.map((name) => nodes.find((node) =>
    (node.type === 'FunctionDeclaration' || node.type === 'VariableDeclarator') && node.id?.name === name))
  const code = selected.map((node) => node.type === 'VariableDeclarator'
    ? `const ${source.slice(node.start, node.end)};` : source.slice(node.start, node.end)).join('\n')
  return new Function('readableClassification', `${code}; return { ${names.join(', ')} }`)(variants.readableClassification)
}

test('canonical variant pricing wins over legacy price; stock and SKU are variant-specific', () => {
  const normalized = utils.normalizeApiProduct({ ...product, variations: product.variations.map((row) => ({ ...row, price: 999 })) })
  assert.deepEqual(normalized.variants.map((row) => row.sellingPrice), [75, 80])
  assert.deepEqual(normalized.variants.map((row) => row.inventory.openingStock), [10, 10])
  assert.deepEqual(normalized.variants.map((row) => row.sku), ['LED-S', 'LED-M'])
  assert.equal(normalized.variants[0].variantCode, 'VAR-0001')
  assert.equal(normalized.variants[0].taxInclusive, false)
})

test('legacy price is retained, missing SKU/cost/tier prices/currency remain unavailable', () => {
  const [legacy] = utils.normalizeApiProduct({ ...product, variations: [{ id: smallId, name: 'Legacy', price: 75, sku: null, inventory: 0 }] }).variants
  assert.equal(legacy.sellingPrice, 75)
  for (const field of ['sku', 'purchasePrice', 'mrp', 'wholesalePrice', 'dealerPrice', 'discountPercent', 'currency']) assert.equal(legacy[field], '')
  assert.equal(legacy.inventory.openingStock, 0)
  assert.equal(variants.variantMargin(legacy), null)
  assert.equal(utils.formatVariantCurrency(legacy.purchasePrice, ''), '—')
  assert.equal(variants.variantMargin({ purchasePrice: 0, sellingPrice: 75 }), 100)
})

test('classification never uses category as Product Type or displays raw UUID values', () => {
  const result = utils.normalizeApiProduct({ ...product, product_type: categoryId })
  assert.equal(result.productType, '')
  assert.equal(result.categoryLabel, 'Electrical')
  const withoutLabels = utils.normalizeApiProduct({ ...product, category: null, product_type: 'LED lighting' })
  assert.equal(withoutLabels.categoryLabel, '')
  assert.equal(withoutLabels.category, '')
})

test('new rows have no fabricated identity or parent-derived prices/SKU', async () => {
  const helpers = await formHelpers()
  const row = helpers.makeEmptyVariant()
  assert.equal(row.id, '')
  assert.equal(row.sku, '')
  assert.equal(row.sellingPrice, '')
  assert.equal(row.purchasePrice, '')
  const hydrated = helpers.hydrateProduct(utils.normalizeApiProduct(product))
  assert.equal(hydrated.variants[1].id, mediumId)
  assert.equal(hydrated.variants[1].isNew, false)
})

test('product create omits new variant IDs/codes and uses the nested pricing contract', async () => {
  let body
  client.post = async (_url, payload) => { body = payload; return { data: { id: 'created', ...payload } } }
  const result = await productsApi.createProduct({ name: 'LED', sku: 'PARENT-SKU', category: categoryId,
    subCategoryId: childId, productType: 'LED lighting', variants: [{ id: 'must-not-leak', variantCode: 'must-not-leak', isNew: true,
      size: 'Small', sku: 'LED-S', sellingPrice: 75, purchasePrice: 50, wholesalePrice: 70, dealerPrice: 65,
      mrp: 90, discountPercent: 0, taxInclusive: false, currency: 'INR', inventory: { openingStock: 10 } }] })
  assert.equal(result.success, true)
  const [row] = body.variations
  assert.equal(row.id, undefined)
  assert.equal(row.variant_code, undefined)
  assert.equal(row.sku, 'LED-S')
  assert.equal(row.inventory, 10)
  assert.equal(row.pricing.selling_price, 75)
  assert.equal(row.pricing.purchase_price, 50)
  assert.equal(row.pricing.tax_inclusive, false)
  assert.equal(body.product_type, 'LED lighting')
  assert.equal(body.sub_category_id, childId)
})

test('edit/save/fresh GET round trip preserves existing UUID, SKU, full pricing and classification', async () => {
  let stored = structuredClone(product), request
  client.patch = async (_url, payload) => {
    request = payload
    stored = { ...stored, ...payload, variations: payload.variations.map((row) => ({ ...product.variations.find((old) => old.id === row.id), ...row })) }
    return { data: structuredClone(stored) }
  }
  client.get = async () => ({ data: JSON.parse(JSON.stringify(stored)) })
  const { hydrateProduct } = await formHelpers()
  const edit = hydrateProduct(utils.normalizeApiProduct(product))
  edit.variants[1].sku = 'LED-M-UPDATED'
  edit.variants[1].sellingPrice = '82.50'
  edit.productType = 'Batten light'
  const saved = await productsApi.updateProduct(product.id, edit)
  assert.equal(saved.success, true)
  assert.equal(request.variations[1].id, mediumId)
  assert.equal(request.variations[1].variant_code, undefined)
  const fresh = utils.normalizeApiProduct((await productsApi.getProduct(product.id)).product)
  assert.equal(fresh.variants[1].id, mediumId)
  assert.equal(fresh.variants[1].variantCode, 'VAR-0002')
  assert.equal(fresh.variants[1].sku, 'LED-M-UPDATED')
  assert.equal(fresh.variants[1].sellingPrice, 82.5)
  assert.equal(fresh.variants[1].wholesalePrice, 75)
  assert.equal(fresh.variants[1].taxInclusive, true)
  assert.equal(fresh.variants[1].inventory.openingStock, 10)
  assert.equal(fresh.productType, 'Batten light')
  assert.equal(fresh.subCategoryId, childId)
})

test('legacy edit never injects missing prices/stock; clearing a variant SKU sends null', async () => {
  let body
  client.patch = async (_url, payload) => { body = payload; return { data: { id: product.id, ...payload } } }
  await productsApi.updateProduct(product.id, { variants: [{ id: smallId, isNew: false, size: 'Legacy', sku: '', sellingPrice: 75, purchasePrice: '', inventory: { openingStock: '' } }], subCategoryId: '' })
  assert.equal(body.variations[0].sku, null)
  assert.deepEqual(body.variations[0].pricing, { selling_price: 75 })
  assert.equal(body.variations[0].inventory, undefined)
  assert.equal(body.total_inventory, undefined)
  assert.equal(body.product_type, undefined)
  assert.equal(body.sub_category_id, null)
})

test('selection requires exact variant, auto-selects one variant and preserves simple products', () => {
  assert.equal(variants.selectedProductValues(product), null)
  const medium = variants.selectedProductValues(product, mediumId)
  assert.equal(medium.unitPrice, 80)
  assert.equal(medium.stock, 10)
  assert.equal(medium.sku, 'LED-M')
  assert.equal(variants.selectedProductValues(product, 'VAR-0002'), null)
  assert.equal(variants.selectedProductValues({ ...product, variations: [product.variations[0]] }).variantId, smallId)
  assert.equal(variants.selectedProductValues({ id: 'simple', price: 25, sku: 'S', total_stock: 5 }).unitPrice, 25)
  assert.match(variants.validateVariantItems([{ productId: product.id, quantity: 1 }], [product]), /Select a variant/)
})

for (const quotation of [false, true]) {
  test(`${quotation ? 'Quotation' : 'Order'} adapter keeps two variants separate and preserves manual price overrides`, async () => {
    let items = [], errors = {}
    const context = { ...variants,
      setErrors: (fn) => { errors = fn(errors) },
      setOrderItems: (fn) => { items = fn(items) },
      setFormData: (fn) => { items = fn({ items }).items },
    }
    const file = quotation ? 'features/quotations/QuotationFormPage.jsx' : 'features/orders/CreateSalesOrder.jsx'
    const add = await handler(file, 'setPickerQuantity', context)
    add(product, 1)
    assert.equal(items.length, 0)
    assert.match(errors.items, /Select a variant/)
    add(product, 2, smallId)
    add(product, 3, mediumId)
    assert.equal(items.length, 2)
    assert.deepEqual(items.map((item) => Number(item.unitPrice)), [75, 80])
    const update = await handler(file, quotation ? 'updateItemField' : 'updateOrderItem', context)
    update(variants.itemKey(items[1]), 'unitPrice', '88')
    add(product, 4, mediumId)
    assert.equal(Number(items[1].unitPrice), 88)
    assert.equal(Number(items[0].quantity), 2)
    add(product, 11, mediumId)
    assert.equal(Number(items[1].quantity), quotation ? 11 : 4)
    if (!quotation) assert.match(errors.items, /only 10/)
    add(product, 0, smallId)
    assert.deepEqual(items.map((item) => item.variantId), [mediumId])
  })
}

for (const quotation of [false, true]) {
  test(`${quotation ? 'Quotation' : 'Order'} actual request/response/reopen path retains variant UUID and overridden price`, async () => {
    let body, stored
    client.post = async (_url, payload) => {
      body = payload
      stored = { ...payload, id: 'document', items: payload.items.map((item, index) => ({ ...item, id: `line-${index}`, product_name: product.name })) }
      return { data: stored }
    }
    client.get = async () => ({ data: structuredClone(stored) })
    const file = quotation ? 'features/quotations/QuotationFormPage.jsx' : 'features/orders/CreateSalesOrder.jsx'
    const { source, nodes } = await sourceOf(file)
    const payloadNode = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'itemsPayload').init
    const items = [{ productId: product.id, variantId: mediumId, quantity: 2, unitPrice: 88, taxRate: 0 }]
    const payload = evaluate(source, payloadNode, { orderItems: items, formData: { items }, discountPercentForItems: 0 })
    const api = quotation ? quotesApi : ordersApi
    const created = await (quotation ? api.createQuotation : api.createOrder)({ customerId: 'customer', items: payload })
    assert.equal(created.success, true)
    assert.equal(body.items[0].variant_id, mediumId)
    assert.equal(body.items[0].unit_price, 88)
    assert.equal(body.items[0].variant_code, undefined)
    const result = await (quotation ? api.getQuotation : api.getOrder)('document')
    const document = quotation ? result.quotation : result.order
    const reopened = quotation ? quoteHelpers.quotationToDraftForm(document).items
      : await handler(file, 'applyItems', {}).then((apply) => apply(document.items))
    assert.equal(reopened[0].variantId, mediumId)
    assert.equal(Number(reopened[0].unitPrice), 88)
  })
}

test('shared picker renders variant codes/SKUs/stock and never labels parent SKU as variant SKU', () => {
  const html = renderToStaticMarkup(React.createElement(Picker, { products: [product],
    orderItems: [{ productId: product.id, variantId: mediumId, quantity: 1, unitPrice: 80 }],
    onSetQuantity() {}, onUpdateItem() {}, onRoundBlur() { return () => {} } }))
  assert.match(html, /VAR-0001/)
  assert.match(html, /LED-M/)
  assert.match(html, /10 unit/)
  // The parent SKU is now explicitly shown in the expandable product header.
  // It must never leak into any variant's own SKU cell.
  assert.match(html, /2 variants/)
  assert.match(html, /SKU: PARENT-SKU/)
  const variantRows = html.replace(/<button\b[^>]*aria-expanded="true"[\s\S]*?<\/button>/, '')
  assert.doesNotMatch(variantRows, /PARENT-SKU|999|10000000-0000/)
  const missingSku = { ...product, variations: [{ ...product.variations[0], sku: null }] }
  const legacyHtml = renderToStaticMarkup(React.createElement(Picker, { products: [missingSku], orderItems: [], onSetQuantity() {}, onUpdateItem() {}, onRoundBlur() { return () => {} } }))
  assert.doesNotMatch(legacyHtml, /PARENT-SKU/)
})

test('product category change clears the child selection and validation rejects invalid relations/UUID type', async () => {
  const { source, nodes } = await sourceOf('features/products/ProductForm.jsx')
  const attribute = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onChange'
    && source.slice(node.start, node.end).includes('categoryId: event.target.value'))
  let form = { category: categoryId, subCategoryId: childId, subCategory: 'Child' }
  const change = evaluate(source, attribute.value.expression, { effectiveCategoryOptions: [{ value: 'other', label: 'Other' }],
    setFormData: (fn) => { form = fn(form) }, setErrors() {} })
  change({ target: { value: 'other' } })
  assert.equal(form.subCategoryId, '')
  assert.equal(form.categoryLabel, 'Other')
  const helpers = await formHelpers()
  const validate = await handler('features/products/ProductForm.jsx', 'validate', { ...helpers, ...variants,
    formData: { ...helpers.hydrateProduct(utils.normalizeApiProduct(product)), productType: categoryId, subCategoryId: 'wrong-child' },
    subCategoryOptions: [{ value: childId }], visibleErrors: (errors) => errors, setErrors() {} })
  const errors = validate()
  assert.match(errors.subCategory, /belonging/)
  assert.match(errors.productType, /name/)
})

test('400/422 variant and classification errors remain readable UI messages', async () => {
  client.patch = async () => { throw { response: { status: 422, data: { detail: [{ loc: ['body', 'sub_category_id'], msg: 'Sub category does not belong to category' }] } } } }
  const result = await productsApi.updateProduct(product.id, { subCategoryId: 'bad' })
  assert.equal(result.success, false)
  assert.match(result.error, /Sub category does not belong/)
  assert.equal(typeof result.error, 'string')
  assert.deepEqual(result.errorFields, ['sub_category_id'])
  client.post = async () => { throw { response: { status: 400, data: { detail: 'Variant does not belong to product' } } } }
  assert.match((await ordersApi.createOrder({ items: [] })).error, /Variant does not belong/)
  assert.match((await quotesApi.createQuotation({ items: [] })).error, /Variant does not belong/)
})

test('actual product submit preserves zero prices and blank variant SKU through to the API', async () => {
  const helpers = await formHelpers()
  const formData = helpers.hydrateProduct(utils.normalizeApiProduct(product))
  formData.variants[0].sku = ''
  formData.variants[0].sellingPrice = 0
  let submitted, request
  const syncVariants = await handler('features/products/ProductForm.jsx', 'syncVariants', helpers)
  const submit = await handler('features/products/ProductForm.jsx', 'handleSubmit', {
    ...helpers, product: null, formData, syncVariants, validate: () => ({}), setValidationBanner() {}, onSave: (payload) => { submitted = payload },
  })
  submit({ preventDefault() {} })
  client.patch = async (_url, payload) => { request = payload; return { data: { id: product.id, ...payload } } }
  await productsApi.updateProduct(product.id, submitted)
  assert.equal(request.variations[0].sku, null)
  assert.equal(request.variations[0].pricing.selling_price, 0)
  assert.equal(request.variations[1].pricing.selling_price, 80)
  assert.equal(request.variations[0].id, smallId)
})

test('product detail variant table renders the required columns with real data and no UUID/parent SKU', async () => {
  const { source, nodes } = await sourceOf('features/products/ProductDetail.jsx')
  const table = nodes.find((node) => node.type === 'JSXElement' && node.openingElement.name.name === 'Card'
    && node.openingElement.attributes.some((attribute) => attribute.name?.name === 'title' && attribute.value?.value === 'Variants'))
  assert.ok(table)
  const componentSource = `export default function VariantTable({product,variantMargin,formatVariantCurrency,getFileUrl,Package,Card}) {return (${source.slice(table.start, table.end)})}`
  const compiled = await transformWithOxc(componentSource, 'VariantTable.jsx', { jsx: { runtime: 'automatic' } })
  const code = compiled.code.replace(/from "([^"]+)"/g, (_, name) => `from "${import.meta.resolve(name)}"`)
  const { default: Table } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const html = renderToStaticMarkup(React.createElement(Table, {
    product: utils.normalizeApiProduct(product), variantMargin: variants.variantMargin,
    formatVariantCurrency: utils.formatVariantCurrency, getFileUrl: (value) => value,
    Package: () => React.createElement('span'), Card: ({ children }) => React.createElement('section', null, children),
  }))
  for (const label of ['Variant Code', 'SKU', 'Purchase Price', 'Selling Price', 'MRP', 'Stock', 'Margin', 'VAR-0001', 'LED-M']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /PARENT-SKU|10000000-0000|999/)
})

test('editing with both existing and new variants updates only real existing UUIDs', async () => {
  let body
  client.patch = async (_url, payload) => { body = payload; return { data: { id: product.id, ...payload } } }
  await productsApi.updateProduct(product.id, { variants: [product.variations[0], { id: '', isNew: true, size: 'New', sellingPrice: 90, inventory: 0 }] })
  assert.equal(body.variations[0].id, smallId)
  assert.equal(body.variations[1].id, undefined)
  assert.equal(body.variations[1].variant_code, undefined)
  assert.equal(body.variations[1].sku, null)
})

for (const quotation of [false, true]) {
  test(`${quotation ? 'Quotation' : 'Order'} simple/single-variant flows need no extra selection`, async () => {
    let items = []
    const file = quotation ? 'features/quotations/QuotationFormPage.jsx' : 'features/orders/CreateSalesOrder.jsx'
    const add = await handler(file, 'setPickerQuantity', { ...variants, setErrors() {},
      setOrderItems: (fn) => { items = fn(items) }, setFormData: (fn) => { items = fn({ items }).items } })
    add({ id: 'simple', name: 'Simple', price: 25, total_stock: 5 }, 1)
    add({ ...product, variations: [product.variations[0]] }, 2)
    assert.equal(items.length, 2)
    assert.equal(items[0].variantId, '')
    assert.equal(Number(items[0].unitPrice), 25)
    assert.equal(items[1].variantId, smallId)
    assert.equal(Number(items[1].unitPrice), 75)
  })
}

test('unavailable variant price/stock never falls back to the parent price/total stock', () => {
  const selected = variants.selectedProductValues({ ...product, variations: [{ id: smallId, name: 'Legacy', sku: null }] })
  assert.equal(selected.unitPrice, null)
  assert.equal(selected.stock, null)
  assert.equal(selected.sku, '')
})

for (const quotation of [false, true]) {
  const label = quotation ? 'Quotation' : 'Order'
  const file = quotation ? 'features/quotations/QuotationFormPage.jsx' : 'features/orders/CreateSalesOrder.jsx'

  test(`${label}: removing an unavailable saved variant affects only that exact line`, async () => {
    const staleId = '10000000-0000-4000-8000-000000000099'
    let items = [{ productId: product.id, variantId: staleId, quantity: 1, unitPrice: 60 },
      { productId: product.id, variantId: smallId, quantity: 2, unitPrice: 75 }]
    let errors = { items: 'Variant unavailable' }
    const remove = await handler(file, 'setPickerQuantity', { ...variants,
      setErrors: (fn) => { errors = fn(errors) }, setOrderItems: (fn) => { items = fn(items) },
      setFormData: (fn) => { items = fn({ items }).items } })
    remove(product, 0, staleId)
    assert.equal(items.length, 1)
    assert.equal(items[0].variantId, smallId)
    assert.equal(errors.items, '')
  })

  test(`${label}: a cleared catalog variant is removed when the simple product is reselected`, async () => {
    let items = [{ productId: product.id, variantId: smallId, quantity: 1, unitPrice: 75 }]
    const add = await handler(file, 'setPickerQuantity', { ...variants, setErrors() {},
      setOrderItems: (fn) => { items = fn(items) }, setFormData: (fn) => { items = fn({ items }).items } })
    add({ ...product, variations: [], has_variants: false, price: 29 }, 1)
    assert.equal(items.length, 1)
    assert.equal(items[0].variantId, '')
    assert.equal(Number(items[0].unitPrice), 29)
  })

  test(`${label}: blank manual price stays unavailable on blur; explicit zero remains valid`, async () => {
    const calls = []
    const round = await handler(file, quotation ? 'roundItemOnBlur' : 'roundToWholeNumberOnBlur', {
      updateItemField: (...args) => calls.push(args), updateOrderItem: (...args) => calls.push(args),
    })
    const onBlur = round(variants.itemKey({ productId: product.id, variantId: smallId }), 'unitPrice')
    onBlur({ target: { value: '' } })
    assert.deepEqual(calls, [])
    onBlur({ target: { value: '0' } })
    assert.equal(calls[0][2], '0')
  })
}

test('explicitly cleared classification values never resurrect old edit fallback values', () => {
  const result = utils.normalizeApiProduct({ ...product, product_type: null, sub_category_id: null }, {
    productType: 'Old type', subCategoryId: childId, subCategory: 'Old child',
  })
  assert.equal(result.productType, '')
  assert.equal(result.subCategoryId, '')
  assert.equal(result.subCategory, '')
})

test('actual multi-variant expand control reveals both choices before any quantity is added', async () => {
  const { source, nodes } = await sourceOf('features/orders/ProductPickerList.jsx')
  const rowsNode = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'pickerRows').init
  let expandedProducts = {}
  const rows = () => evaluate(source, rowsNode, { filtered: [product], productVariants: variants.productVariants, expandedProducts, orderItems: [] })
  const initial = rows()
  assert.equal(initial.length, 1)
  const expandNode = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onClick'
    && source.slice(node.start, node.end).includes('setExpandedProducts'))
  const expand = evaluate(source, expandNode.value.expression, { product, expanded: initial[0].expanded,
    setExpandedProducts: (fn) => { expandedProducts = fn(expandedProducts) } })
  expand()
  const expanded = rows()
  assert.equal(expanded.length, 3)
  assert.deepEqual(expanded.slice(1).map((row) => row.variant.id), [smallId, mediumId])
  assert.deepEqual(expanded.slice(1).map((row) => variants.selectedProductValues(row.product, row.variant.id).unitPrice), [75, 80])
})

test('admin/sales routes and both real forms use the variant-aware selector', async () => {
  const route = await sourceOf('routes/AppRoutes.jsx')
  assert.ok(route.nodes.filter((node) => node.type === 'JSXOpeningElement' && node.name.name === 'CreateSalesOrder').length >= 4)
  assert.ok(route.nodes.filter((node) => node.type === 'JSXOpeningElement' && node.name.name === 'QuotationFormPage').length >= 4)
  for (const file of ['features/orders/CreateSalesOrder.jsx', 'features/quotations/QuotationFormPage.jsx']) {
    const { nodes } = await sourceOf(file)
    const picker = nodes.find((node) => node.type === 'JSXOpeningElement' && node.name.name === 'ProductPickerList')
    assert.ok(picker)
    assert.equal(picker.attributes.find((attribute) => attribute.name?.name === 'onSetQuantity').value.expression.name, 'setPickerQuantity')
  }
})
