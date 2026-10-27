import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'

let server, client, syncBrandCategories
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  ;({ syncBrandCategories } = await server.ssrLoadModule('/src/features/brands/brandCategoryMappings.js'))
})
beforeEach(() => {
  for (const method of ['get', 'post', 'patch', 'delete']) client[method] = async () => { throw new Error(`Unexpected ${method}`) }
})
after(async () => server?.close())
const catalog = [{ id: 'fans', name: 'Fans' }, { id: 'lights', name: 'Lighting' }]

test('mapping Add/Remove changes only the current Brand using existing endpoints', async () => {
  const calls = []
  client.get = async (url) => {
    assert.equal(url, '/brands')
    return { data: [{ id: 'brand', categories: [catalog[0]] }, { id: 'other-brand', categories: catalog }] }
  }
  client.delete = async (url) => { calls.push(['delete', url]); return {} }
  client.post = async (url, body) => { calls.push(['post', url, body]); return { data: { category_id: 'lights' } } }
  const result = await syncBrandCategories('brand', ['lights'], catalog)
  assert.equal(result.success, true)
  assert.deepEqual(result.categories, [catalog[1]])
  assert.deepEqual(calls, [['delete', '/brands/brand/categories/fans'], ['post', '/brands/brand/categories', { category_id: 'lights' }]])
})

test('Clear mappings removes the current Brand links and creates no fake All Categories row', async () => {
  const removed = []
  client.get = async () => ({ data: [{ id: 'brand', categories: catalog }] })
  client.delete = async (url) => { removed.push(url); return {} }
  assert.deepEqual(await syncBrandCategories('brand', [], catalog), { success: true, categories: [] })
  assert.deepEqual(removed, ['/brands/brand/categories/fans', '/brands/brand/categories/lights'])
})

test('Subcategory and unknown selections are rejected before any network mutation', async () => {
  const categories = [...catalog, { id: 'child', name: 'Child', parentId: 'fans' }]
  for (const id of ['child', 'unknown']) {
    assert.deepEqual(await syncBrandCategories('brand', [id], categories), { success: false, error: 'Only top-level Categories can be assigned to a Brand.' })
  }
})

test('partial failure retries from fresh server mappings without repeating completed changes', async () => {
  const current = new Map([['fans', catalog[0]]])
  let removals = 0, attempts = 0
  client.get = async () => ({ data: [{ id: 'brand', categories: [...current.values()] }] })
  client.delete = async () => { current.delete('fans'); removals++; return {} }
  client.post = async () => {
    if (attempts++ === 0) throw { response: { status: 422, data: { detail: 'Mapping could not be saved' } } }
    current.set('lights', catalog[1])
    return { data: { category_id: 'lights' } }
  }
  const failed = await syncBrandCategories('brand', ['lights'], catalog)
  assert.equal(failed.success, false)
  assert.deepEqual(failed.categories, [])
  assert.equal((await syncBrandCategories('brand', ['lights'], catalog)).success, true)
  assert.equal(removals, 1)
  assert.equal(attempts, 2)
})

function walk(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (value.type) out.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, out))
    else if (child && typeof child === 'object') walk(child, out)
  }
  return out
}
async function source(file) {
  const code = await readFile(`src/${file}`, 'utf8')
  const parsed = parseSync(file, code)
  assert.equal(parsed.errors.length, 0)
  return { code, nodes: walk(parsed.program) }
}
function evaluate(code, node, values) {
  return new Function(...Object.keys(values), `return (${code.slice(node.start, node.end)})`)(...Object.values(values))
}

test('Category Edit has no parent control and preserves a Subcategory relationship on save', async () => {
  const { code, nodes } = await source('features/categories/CategoryList.jsx')
  assert.doesNotMatch(code, /Parent Category \(optional\)/)
  const submit = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'handleSubmit').init
  let submitted
  evaluate(code, submit, { validate: () => true, canSetBrands: false, brandSelection: {},
    formData: { name: 'Edited child', parentId: 'accidental-change' }, category: { parentId: 'saved-parent' },
    onSave(value) { submitted = value },
  })({ preventDefault() {} })
  assert.equal(submitted.parentId, 'saved-parent')
})

test('Brand selector loads only top-level Categories', async () => {
  const { code, nodes } = await source('features/brands/BrandList.jsx')
  const effect = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'useEffect' && code.slice(node.start, node.end).includes('listCategories()'))
  let choices
  evaluate(code, effect.arguments[0], { canMapCategories: true, setCategoriesLoading() {}, setCategoriesError() {},
    setTopCategories(value) { choices = value }, listCategories: async () => ({ success: true, categories: [
      { id: 'root', name: 'Footwear' }, { id: 'child', name: 'Casual', parent_id: 'root' },
    ] }),
  })()
  await new Promise(setImmediate)
  assert.deepEqual(choices, [{ id: 'root', name: 'Footwear' }])
})

test('retrying a newly created Brand after mapping failure updates the saved Brand instead of creating another', async () => {
  const { code, nodes } = await source('features/brands/BrandList.jsx')
  const save = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'handleSaveBrand').init
  const normalize = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'normalizeBrand').init
  const pendingBrandId = { current: '' }
  let creations = 0, updates = 0, mappingAttempts = 0, rows = []
  const bindings = { isSaving: false, setIsSaving() {}, setFormError() {}, editingBrand: null, pendingBrandId,
    normalizeBrand: evaluate(code, normalize, {}),
    createBrand: async () => { creations++; return { success: true, brand: { id: 'created', name: 'Test' } } },
    updateBrand: async (id) => { updates++; assert.equal(id, 'created'); return { success: true, brand: { id, name: 'Test' } } },
    syncBrandCategories: async () => ++mappingAttempts === 1 ? { success: false, error: 'Retry', categories: [] } : { success: true, categories: [catalog[0]] },
    setBrands(update) { rows = update(rows) }, setIsFormOpen() {}, setEditingBrand() {},
  }
  const submit = evaluate(code, save, bindings)
  const data = { name: 'Test', categoryIds: ['fans'], topCategories: catalog }
  await submit(data)
  assert.equal(pendingBrandId.current, 'created')
  await submit(data)
  assert.equal(creations, 1)
  assert.equal(updates, 1)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].categories, [catalog[0]])
})
