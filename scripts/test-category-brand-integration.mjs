import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'

let server, client, categories, products, users, roleUtils, store
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  categories = await server.ssrLoadModule('/src/api/categories.js')
  products = await server.ssrLoadModule('/src/api/products.js')
  users = await server.ssrLoadModule('/src/api/users.js')
  roleUtils = await server.ssrLoadModule('/src/features/users/userRoleUtils.js')
  ;({ useAuthStore: store } = await server.ssrLoadModule('/src/store/authStore.js'))
})
beforeEach(() => {
  for (const method of ['get', 'post', 'put', 'patch']) client[method] = async () => { throw new Error(`Unexpected ${method}`) }
})
after(async () => server?.close())

function walk(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (value.type) out.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walk(item, out))
    else if (child && typeof child === 'object') walk(child, out)
  }
  return out
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

test('category brand APIs use the documented paths and replace the list, including empty', async () => {
  const brands = [{ id: 'b-2', name: 'Beta' }, { id: 'b-1', name: 'Alpha' }]
  client.get = async (url) => { assert.equal(url, '/categories/cat/brands'); return { data: brands } }
  assert.deepEqual((await categories.getCategoryBrands('cat')).brands, brands)
  for (const ids of [['b-1'], []]) {
    client.put = async (url, body) => { assert.equal(url, '/categories/cat/brands'); assert.deepEqual(body, { brand_ids: ids }); return { data: [] } }
    assert.equal((await categories.setCategoryBrands('cat', ids)).success, true)
  }
  client.put = async () => { throw { response: { status: 409, data: { detail: 'Conflict' } } } }
  assert.deepEqual(await categories.setCategoryBrands('cat', []), { success: false, status: 409, error: 'Someone else saved this at the same time. Reload and try again.' })
})

test('plain Brand 422 errors are assigned to the Brand field on create and edit', async () => {
  for (const detail of ['Brand is not mapped to the selected category.', 'This brand is inactive and cannot be chosen']) {
    client.post = client.patch = async () => { throw { response: { status: 422, data: { detail } } } }
    for (const result of [await products.createProduct({ name: 'Test' }), await products.updateProduct('product', { brandId: 'brand' })]) {
      assert.equal(result.error, detail)
      assert.deepEqual(result.errorFields, ['brand_id'])
    }
  }
})

test('clearing a Brand sends null rather than an empty relation ID', async () => {
  client.patch = async (_url, body) => {
    assert.equal(body.brand_id, null)
    return { data: { id: 'product', ...body } }
  }
  assert.equal((await products.updateProduct('product', { brandId: '', brand: '' })).success, true)
})

test('category brand response clears an invalid choice but preserves an unchanged saved brand', async () => {
  const { code, nodes } = await source('features/products/ProductForm.jsx')
  const effect = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'useEffect' && code.slice(node.start, node.end).includes('getCategoryBrands(categoryId)'))
  for (const [editing, oldCategory, allowed, expected] of [[false, 'old', false, ''], [false, 'old', true, 'brand'], [true, 'cat', false, 'brand'], [true, 'old', false, '']]) {
    let form = { categoryId: 'cat', brandId: 'brand', brand: 'Saved Brand' }, choices
    evaluate(code, effect.arguments[0], {
      formData: form, isOpen: true, product: editing ? {} : null, initialFormData: { categoryId: oldCategory, brandId: 'brand' },
      categoryOptions: [{ value: 'cat' }], setCategoryBrandOptions(value) { choices = value }, setCategoryBrandsError() {}, setLoadedBrandCategoryId() {}, setIsLoadingCategoryBrands() {},
      getCategoryBrands: async () => ({ success: true, brands: allowed ? [{ id: 'brand', name: 'Allowed Brand' }] : [{ id: 'other', name: 'Other Brand' }] }),
      setFormData(update) { form = update(form) },
    })()
    await new Promise(setImmediate)
    assert.equal(form.brandId, expected)
    assert.deepEqual(choices.map((item) => item.value), allowed ? ['brand'] : ['other'])
  }
})

test('an obsolete Category response cannot overwrite the current Brand choices', async () => {
  const { code, nodes } = await source('features/products/ProductForm.jsx')
  const effect = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'useEffect' && code.slice(node.start, node.end).includes('getCategoryBrands(categoryId)'))
  let complete, writes = 0
  const cleanup = evaluate(code, effect.arguments[0], {
    formData: { categoryId: 'old' }, isOpen: true, categoryOptions: [{ value: 'old' }], product: null, initialFormData: {},
    setCategoryBrandOptions() {}, setCategoryBrandsError() {}, setLoadedBrandCategoryId() {}, setIsLoadingCategoryBrands() {},
    getCategoryBrands: () => new Promise((resolve) => { complete = resolve }), setFormData() { writes++ },
  })()
  cleanup()
  complete({ success: true, brands: [] })
  await new Promise(setImmediate)
  assert.equal(writes, 0)
})

test('Allowed Brands reads explicit links rather than treating all active brands as restrictions', async () => {
  const { code, nodes } = await source('hooks/useCategoryBrandSelection.js')
  const effect = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'useEffect')
  const brands = [{ id: 'mapped', categories: [{ id: 'restricted' }] }, { id: 'unmapped', categories: [] }]
  for (const [categoryId, expected] of [['restricted', ['mapped']], ['unrestricted', []], [null, []]]) {
    let selection
    evaluate(code, effect.arguments[0], {
      enabled: true, categoryId, setLoading() {}, setError() {}, setBrands() {}, setSelectedIds(ids) { selection = ids },
      listBrands: async () => ({ success: true, brands }),
    })()
    await new Promise(setImmediate)
    assert.deepEqual(selection, expected)
  }
})

test('Category partial-save retry does not recreate the parent or repeat a saved Brand mapping', async () => {
  const { code, nodes } = await source('features/categories/CategoryFormPage.jsx')
  const handler = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'handleSubmit').init
  let attempts = 0, categoryCalls = 0, mappings = 0, navigated = false
  const submit = evaluate(code, handler, {
    isSaving: false, uploadingImages: 0, canSetBrands: true, brandSelection: { loading: false, error: '', selectedIds: ['brand'] }, validate: () => true,
    setIsSaving() {}, setFormError() {}, formData: { name: 'Test', subcategories: [{ id: 'child-draft', name: 'Child', variants: [] }] },
    saved: { current: { categoryId: '', children: {}, variants: new Set() } },
    createCategory: async (body) => { categoryCalls++; if (body.parentId && attempts++ === 0) return { success: false }; return { success: true, category: { id: body.parentId ? 'child' : 'parent' } } },
    setCategoryBrands: async (id, ids) => { assert.equal(id, 'parent'); assert.deepEqual(ids, ['brand']); mappings++; return { success: true } },
    navigate() { navigated = true },
  })
  await submit({ preventDefault() {} })
  assert.equal(navigated, false)
  await submit({ preventDefault() {} })
  assert.equal(navigated, true)
  assert.equal(categoryCalls, 3)
  assert.equal(mappings, 1)
})

test('sectioned User details preserve last login and phone verification', async () => {
  client.get = async () => ({ data: { id: 'staff', basic_information: { first_name: 'Test' }, contact_information: { mobile_number: '+919876543210' }, phone_verified: true, last_login: '2026-10-26T07:00:00Z' } })
  const result = await users.getUser('staff')
  const user = roleUtils.normalizeApiUser(result.user)
  assert.equal(user.phoneVerified, true)
  assert.equal(user.lastLogin, '2026-10-26T07:00:00Z')
  assert.equal(roleUtils.normalizeApiUser({ id: 'never' }).lastLogin, null)
  store.getState().setAuthenticatedSession({ user: { id: 'staff', role: 'sales', organization_id: 'org', is_active: true }, phone_verified: true })
  assert.equal(store.getState().currentUser.phone_verified, true)
  store.getState().setAuthenticatedSession({ user: { id: 'staff', role: 'sales', organization_id: 'org', phone_verified: false }, phone_verified: true })
  assert.equal(store.getState().currentUser.phone_verified, false)
})
