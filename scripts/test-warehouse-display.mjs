import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createServer } from 'vite'

// Exercise the actual hook with controlled effects and deferred API responses.
async function warehouseHook(getWarehouse) {
  const code = await readFile('src/hooks/useWarehouseName.js', 'utf8')
  let state = { id: '', name: '' }, effect
  const hook = new Function('useState', 'useEffect', 'getWarehouse',
    `${code.replace(/^import .*$/gm, '').replace('export function', 'function')}; return useWarehouseName`)(
    () => [state, (value) => { state = value }],
    (callback) => { effect = callback }, getWarehouse,
  )
  return { render: (...args) => hook(...args), effect: () => effect() }
}

test('warehouse names resolve from the saved ID without substituting another warehouse', async () => {
  const calls = []
  const hook = await warehouseHook(async (id) => {
    calls.push(id)
    return { success: true, warehouse: { id, name: 'Central Warehouse' } }
  })
  assert.equal(hook.render('wh-1'), '')
  hook.effect()
  await new Promise(setImmediate)
  assert.equal(hook.render('wh-1'), 'Central Warehouse')
  assert.equal(hook.render('wh-2'), '')
  assert.equal(hook.render('wh-1', 'Historical Name'), 'Historical Name')
  hook.effect()
  assert.deepEqual(calls, ['wh-1'])
})

test('missing IDs, lookup failures, and cancelled requests never show a guessed warehouse', async () => {
  let complete, calls = 0
  const hook = await warehouseHook(() => {
    calls++
    return new Promise((resolve) => { complete = resolve })
  })
  assert.equal(hook.render(''), '')
  hook.effect()
  assert.equal(calls, 0)
  hook.render('wh-old')
  const cleanup = hook.effect()
  cleanup()
  complete({ success: true, warehouse: { name: 'Old Warehouse' } })
  await new Promise(setImmediate)
  assert.equal(hook.render('wh-old'), '')
  hook.effect()
  complete({ success: false, error: 'Unavailable' })
  await new Promise(setImmediate)
  assert.equal(hook.render('wh-old'), '')
})

test('Purchase normalization preserves flat or nested warehouse IDs', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const { apiClient } = await server.ssrLoadModule('/src/api/client.js')
    const { getPurchase } = await server.ssrLoadModule('/src/api/purchases.js')
    apiClient.get = async () => ({ data: { id: 'purchase', warehouse: { id: 'wh-nested', name: 'Central' }, items: [] } })
    let result = await getPurchase('purchase')
    assert.equal(result.purchase.warehouseId, 'wh-nested')
    assert.equal(result.purchase.warehouseName, 'Central')
    apiClient.get = async () => ({ data: { id: 'purchase', warehouse_id: 'wh-flat', items: [] } })
    result = await getPurchase('purchase')
    assert.equal(result.purchase.warehouseId, 'wh-flat')
    assert.equal(result.purchase.warehouseName, '')
  } finally {
    await server.close()
  }
})
