import assert from 'node:assert/strict'
import { before, beforeEach, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, client, products, categories, utils, context, ConfiguredField, keys
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  products = await server.ssrLoadModule('/src/api/products.js')
  categories = await server.ssrLoadModule('/src/api/categories.js')
  utils = await server.ssrLoadModule('/src/features/products/productUtils.js')
  ;({ FieldSettingsContext: context } = await server.ssrLoadModule('/src/fieldSettings/FieldSettingsContext.jsx'))
  ;({ default: ConfiguredField } = await server.ssrLoadModule('/src/fieldSettings/ConfiguredField.jsx'))
  keys = await server.ssrLoadModule('/src/fieldSettings/formFieldKeys.js')
})
beforeEach(() => { for (const method of ['get', 'post', 'patch', 'put']) client[method] = async () => { throw new Error(`Unexpected ${method}`) } })
after(async () => server?.close())

function walk(node, nodes = []) {
  if (!node || typeof node !== 'object') return nodes
  if (node.type) nodes.push(node)
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, nodes))
    else if (child && typeof child === 'object') walk(child, nodes)
  }
  return nodes
}
async function source(file) {
  const code = await readFile(`src/${file}`, 'utf8')
  const result = parseSync(file, code)
  assert.equal(result.errors.length, 0)
  return { code, nodes: walk(result.program) }
}
function evaluate(code, node, bindings) {
  return new Function(...Object.keys(bindings), `return (${code.slice(node.start, node.end)})`)(...Object.values(bindings))
}
async function arrow(file, name, bindings) {
  const { code, nodes } = await source(file)
  const init = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === name)?.init
  assert.ok(init, name)
  return evaluate(code, init.type === 'CallExpression' ? init.arguments[0] : init, bindings)
}

const formCases = [
  ['company', 'company/CompanySettings.jsx', 'qrCodeUrl', 'payment_qr_url'],
  ['lead', 'leads/LeadFormPage.jsx', 'interestedProductList', 'interested_product_ids'],
  ['customer', 'customers/CustomerForm.jsx', 'billingAddress', 'address_information.billing_address'],
  ['quotation', 'quotations/QuotationFormPage.jsx', 'salespersonId', 'salesperson_id'],
  ['product', 'products/ProductForm.jsx', 'sellingPrice', 'pricing.selling_price'],
  ['sales_order', 'orders/CreateSalesOrder.jsx', 'discountValue', 'discount'],
  ['supplier', 'suppliers/SupplierForm.jsx', 'pinCode', 'pincode'],
  ['purchase', 'purchases/PurchaseInvoiceForm.jsx', 'purchaseDate', 'purchase_date'],
  ['expense', 'expenses/MyExpenses.jsx', 'paymentMode', 'payment_mode'],
]
for (const [module, file, name, backendKey] of formCases) {
  test(`${module}: canonical field mapping unmounts hidden required controls and the form is wired`, async () => {
    assert.equal(keys.formFieldKey(module, name), backendKey)
    const { code } = await source(`features/${file}`)
    assert.ok(code.includes('ConfiguredField') || code.includes('useFormFieldSettings'))
    const html = renderToStaticMarkup(React.createElement(context.Provider, {
      value: { isFieldVisible: (m, key) => !(m === module && key === backendKey), getFieldMeta: () => null },
    }, React.createElement(ConfiguredField, { module, name }, React.createElement('input', { required: true, defaultValue: 'retained' }))))
    assert.equal(html, '')
  })
}

test('provider fails open before load, enforces locked classes, and ignores another organization cache', async () => {
  const bindings = { isOrgScoped: true, settingsOrgId: 'firm-a', orgId: 'firm-a',
    fieldSettings: { product: { name: false, has_variants: false, product_type_id: false } },
    availableFields: { product: { fields: [{ key: 'name', classification: 'mandatory' }, { key: 'has_variants', classification: 'non_configurable' }, { key: 'product_type_id', classification: 'optional' }] } } }
  const create = (values) => arrow('fieldSettings/FieldSettingsProvider.jsx', 'isFieldVisible', values)
  const visible = await create(bindings)
  assert.equal(visible('product', 'name'), true)
  assert.equal(visible('product', 'has_variants'), true)
  assert.equal(visible('product', 'product_type_id'), false)
  assert.equal(visible('product', 'future_field'), true)
  assert.equal((await create({ ...bindings, settingsOrgId: 'firm-b' }))('product', 'product_type_id'), true)
})

test('has_variants switches pricing and variation fields while keeping the checkbox available', async () => {
  const formData = { hasVariants: false }
  const visible = await arrow('features/products/ProductForm.jsx', 'fieldIsVisible', { formData, visible: () => true })
  assert.equal(visible({ name: 'sellingPrice' }), true)
  assert.equal(visible({ name: 'variants' }), false)
  assert.equal(visible({ name: 'hasVariants' }), true)
  formData.hasVariants = true
  assert.equal(visible({ name: 'sellingPrice' }), false)
  assert.equal(visible({ name: 'openingStock' }), false)
  assert.equal(visible({ name: 'variants' }), true)
  assert.equal(visible({ name: 'variantInventory' }), true)
  assert.equal(visible({ name: 'hasVariants' }), true)
})

test('real Product Create markup hides a disabled Product Type field without a required control', async () => {
  const { default: ProductForm } = await server.ssrLoadModule('/src/features/products/ProductForm.jsx')
  const render = (hidden) => renderToStaticMarkup(React.createElement(context.Provider, {
    value: { isFieldVisible: (_module, key) => !hidden.includes(key), getFieldMeta: () => null },
  }, React.createElement(ProductForm, { isOpen: true, onClose() {}, onSave() {} })))
  assert.match(render([]), /Product Type/)
  assert.doesNotMatch(render(['product_type_id']), /Product Type/)
  assert.match(render(['sku', 'category_id']), /Product Name/)
})

test('subcategory Product Types use the documented GET/POST and preserve inactive/current records', async () => {
  client.get = async (url, config) => {
    assert.equal(url, '/categories/child/variants')
    assert.equal(config.params.include_inactive, true)
    return { data: [{ id: 'type-1', name: 'Ceiling Fan', is_active: false }] }
  }
  assert.equal((await categories.listSubcategoryVariants('child', { includeInactive: true })).variants[0].is_active, false)
  client.post = async (url, body) => {
    assert.equal(url, '/categories/child/variants')
    assert.deepEqual(body, { name: 'Table Fan', sort_order: 2 })
    return { data: { id: 'type-2', ...body } }
  }
  assert.equal((await categories.createSubcategoryVariant('child', { name: ' Table Fan ', sort_order: 2 })).variant.id, 'type-2')
})

test('product_type_id create/edit/clear round trip keeps the separate legacy text', async () => {
  let stored = { id: 'product-1', name: 'Fan', product_type: 'Old classification', variations: [] }
  client.post = async (_url, body) => { assert.equal(body.product_type_id, 'type-1'); stored = { ...stored, ...body, product_type_ref: { id: 'type-1', name: 'Ceiling Fan' } }; return { data: stored } }
  await products.createProduct({ name: 'Fan', productTypeId: 'type-1', productType: 'Old classification' })
  const normalized = utils.normalizeApiProduct(stored)
  assert.equal(normalized.productTypeId, 'type-1')
  assert.equal(normalized.productType, 'Ceiling Fan')
  assert.equal(normalized.legacyProductType, 'Old classification')
  client.patch = async (_url, body) => { assert.equal(body.product_type_id, null); assert.equal(body.product_type, undefined); return { data: { ...stored, ...body, product_type_ref: null } } }
  const cleared = await products.updateProduct('product-1', { product_type_id: null })
  assert.equal(cleared.success, true)
  assert.equal(utils.normalizeApiProduct(cleared.product).productType, 'Old classification')
  assert.equal(utils.normalizeApiProduct(cleared.product).productTypeId, '')
})

test('PATCH excludes stock totals and existing variant stock, but allows a new variant opening balance', async () => {
  client.patch = async (_url, body) => {
    assert.equal('total_inventory' in body, false)
    assert.equal('opening_stock' in body, false)
    assert.equal('inventory' in body.variations[0], false)
    assert.equal(body.variations[1].inventory, 0)
    assert.equal(body.variations[0].pricing.selling_price, 0)
    return { data: { id: 'product-1', ...body } }
  }
  const result = await products.updateProduct('product-1', { totalInventory: 999, total_inventory: 999, openingStock: 999,
    variants: [{ id: 'saved-variant', size: 'Small', sellingPrice: 0, inventory: { openingStock: 999 } },
      { isNew: true, size: 'Large', sellingPrice: 10, inventory: { openingStock: 0 } }] })
  assert.equal(result.success, true)
})

test('category partial save retries failed types without recreating categories or successful types', async () => {
  const saved = { current: { categoryId: '', children: {}, variants: new Set() } }
  const categoryCalls = [], typeCalls = []
  let first = true, navigated = false
  const submit = await arrow('features/categories/CategoryFormPage.jsx', 'handleSubmit', {
    validate: () => true, setIsSaving() {}, setFormError() {},
    formData: { name: 'Fans', subcategories: ['Home'], parentId: '' },
    saved, subcategoryVariants: { Home: 'Ceiling Fan, Table Fan' },
    createCategory: async (body) => { categoryCalls.push(body); return { success: true, category: { id: body.parentId ? 'child' : 'root' } } },
    createSubcategoryVariant: async (_id, body) => { typeCalls.push(body.name); if (body.name === 'Table Fan' && first) { first = false; return { success: false, error: 'temporary failure' } } return { success: true } },
    navigate() { navigated = true },
  })
  await submit({ preventDefault() {} })
  assert.equal(navigated, false)
  await submit({ preventDefault() {} })
  assert.equal(navigated, true)
  assert.equal(categoryCalls.length, 2)
  assert.deepEqual(typeCalls, ['Ceiling Fan', 'Table Fan', 'Table Fan'])
})

test('classification cascade clears IDs on category, subcategory, brand and supplier changes', async () => {
  const { code, nodes } = await source('features/products/ProductForm.jsx')
  for (const marker of ['categoryId: event.target.value', "subCategoryId: event.target.value", 'brandId: event.target.value', 'preferredSupplierId: event.target.value']) {
    const attr = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onChange' && code.slice(node.start,node.end).includes(marker))
    assert.ok(attr, marker)
    let form = { productTypeId: 'saved-type', productType: 'Saved type' }
    const change = evaluate(code, attr.value.expression, { setFormData: (update) => { form = update(form) }, setErrors() {}, effectiveCategoryOptions: [], subCategoryOptions: [], effectiveBrandOptions: [], supplierOptions: [] })
    change({ target: { value: 'new-parent' } })
    assert.equal(form.productTypeId, '', marker)
  }
})

test('hidden customer fields no longer block validation; mandatory customer name still does', async () => {
  const values = { customerName: 'Customer', mobileNumber: '', primaryContactPerson: '', billingAddress: '', googleMapsLocation: '',
    alternateMobileNumber: '', gstNumber: '', email: '', website: '', creditLimit: '' }
  let errors
  const validate = await arrow('features/customers/CustomerForm.jsx', 'validate', {
    formData: values, visibleErrors: (all) => Object.fromEntries(Object.entries(all).filter(([name]) => name === 'customerName')),
    setErrors(value) { errors = value }, setSubmitError() {}, setActiveSection() {}, formSections: [],
  })
  assert.equal(validate(), true)
  assert.deepEqual(errors, {})
  values.customerName = ''
  assert.equal(validate(), false)
  assert.match(errors.customerName, /required/)
})
