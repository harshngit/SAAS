import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { parseSync } from 'rolldown/utils'
import { createServer } from 'vite'
let server, grnActions
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ grnActions } = await server.ssrLoadModule('/src/features/purchases/purchaseGrnHelpers.js'))
})
after(async () => server?.close())

const code = await readFile('src/features/purchases/PurchaseGrnPanel.jsx', 'utf8')
const { program, errors } = parseSync('PurchaseGrnPanel.jsx', code)
assert.equal(errors.length, 0)
const nodes = []
function walk(value) {
  if (!value || typeof value !== 'object') return
  if (value.type) nodes.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(walk)
    else if (child && typeof child === 'object') walk(child)
  }
}
walk(program)
function handler(name, bindings) {
  const node = nodes.find((item) => item.type === 'VariableDeclarator' && item.id.name === name).init
  return new Function(...Object.keys(bindings), `return (${code.slice(node.start, node.end)})`)(...Object.values(bindings))
}

test('shared popup/list actions enforce lifecycle and separate permissions', () => {
  const bindings = { isDemo: false, grnActions, Pencil: 'edit', Check: 'confirm', Ban: 'cancel', Trash2: 'delete',
    canEditGrn: true, canApproveGrn: true, canDeleteGrn: true, openEditModal() {}, runGrnAction() {} }
  const actions = handler('grnActionItems', bindings)
  assert.deepEqual(actions({ status: 'draft' }).map((item) => item.key), ['edit', 'confirm', 'cancel', 'delete'])
  assert.deepEqual(actions({ status: 'confirmed' }), [])
  assert.deepEqual(actions({ status: 'cancelled' }), [])
  assert.deepEqual(handler('grnActionItems', { ...bindings, canApproveGrn: false, canDeleteGrn: false })({ status: 'draft' }).map((item) => item.key), ['edit'])
  assert.deepEqual(handler('grnActionItems', { ...bindings, isDemo: true })({ status: 'draft' }), [])
})

test('popup actions delegate to the existing handlers with the exact GRN', () => {
  const calls = [], grn = { id: 'grn-1', status: 'draft' }
  const actions = handler('grnActionItems', { isDemo: false, grnActions, Pencil: 'edit', Check: 'confirm', Ban: 'cancel', Trash2: 'delete',
    canEditGrn: true, canApproveGrn: true, canDeleteGrn: true,
    openEditModal(record) { calls.push([record.id, 'edit']) }, runGrnAction(record, kind) { calls.push([record.id, kind]) } })
  actions(grn).forEach((item) => item.onClick())
  assert.deepEqual(calls, ['edit', 'confirm', 'cancel', 'delete'].map((kind) => ['grn-1', kind]))
})

test('confirm updates open details, delete closes them, and disallowed actions do not call the API', async () => {
  const calls = [], grn = { id: 'grn-1', grnNumber: 'GRN-1', status: 'draft' }
  let detail, openId = grn.id
  const bindings = { busyId: '', isPreparingEdit: false, canDeleteGrn: true, canApproveGrn: true, grnActions,
    detailGrnId: grn.id, setBusyId() {}, setActionErr() {}, showToast() {}, setDetailTick() {},
    setDetailGrn(value) { detail = value }, setDetailGrnId(value) { openId = value },
    confirmGrn: async (id) => { calls.push(['confirm', id]); return { success: true, grn: { ...grn, status: 'confirmed' } } },
    cancelGrn: async () => ({ success: true, grn: { ...grn, status: 'cancelled' } }),
    deleteGrn: async (id) => { calls.push(['delete', id]); return { success: true } },
    loadRealGrns: async () => {}, onGrnChange() {},
  }
  await handler('runGrnAction', bindings)(grn, 'confirm')
  assert.equal(detail.status, 'confirmed')
  await handler('runGrnAction', bindings)(grn, 'delete')
  assert.equal(openId, null)
  await handler('runGrnAction', { ...bindings, canApproveGrn: false })(grn, 'confirm')
  await handler('runGrnAction', bindings)({ ...grn, status: 'confirmed' }, 'confirm')
  await handler('runGrnAction', { ...bindings, busyId: grn.id })(grn, 'confirm')
  assert.deepEqual(calls, [['confirm', grn.id], ['delete', grn.id]])
})
