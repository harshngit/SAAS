import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, filters, dashboard, client
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  filters = await server.ssrLoadModule('/src/features/dashboard/dashboardFilters.js')
  dashboard = await server.ssrLoadModule('/src/api/dashboard.js')
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
})
after(async () => server?.close())

test('custom dates require both dates and reject reversed ranges', () => {
  assert.ok(filters.validateDashboardDates('custom', { from: '2026-10-01', to: '' }))
  assert.ok(filters.validateDashboardDates('custom', { from: '2026-10-20', to: '2026-10-01' }))
  assert.equal(filters.validateDashboardDates('custom', { from: '2026-10-01', to: '2026-10-01' }), '')
  assert.equal(filters.validateDashboardDates('today', {}), '')
})
test('dropdowns include records after page 1 and deduplicate overlapping results', async () => {
  const calls = []
  const result = await filters.loadDashboardOptions(async (params) => {
    calls.push(params)
    return { success: true, customers: params.page === 1 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'b' }, { id: 'c' }], total: 3 }
  }, 'customers')
  assert.deepEqual(result.customers.map(row => row.id), ['a', 'b', 'c'])
  assert.deepEqual(calls, [{ page: 1, page_size: 100 }, { page: 2, page_size: 100 }])
})
test('failed subsequent pages do not silently return an incomplete dropdown', async () => {
  const result = await filters.loadDashboardOptions(async ({ page }) => page === 1
    ? { success: true, suppliers: [{ id: 'a' }], total: 2 }
    : { success: false, error: 'Access denied' }, 'suppliers')
  assert.equal(result.success, false)
  assert.equal(result.error, 'Access denied')
})
test('a repeated backend page stops instead of looping forever', async () => {
  let calls = 0
  const result = await filters.loadDashboardOptions(async () => {
    calls++
    return { success: true, customers: [{ id: 'a' }], total: 200 }
  }, 'customers')
  assert.equal(result.success, false)
  assert.equal(calls, 2)
})
test('bare legacy list results finish after a single request', async () => {
  const result = await filters.loadDashboardOptions(async () => ({ success: true, orders: [] }), 'orders')
  assert.deepEqual(result, { success: true, orders: [] })
})
test('combined dashboard scope is sent unchanged; clearing omits scope IDs', async () => {
  const queries = []
  client.get = async (path, options) => {
    assert.equal(path, '/dashboard/admin')
    queries.push(options.params)
    return { data: { summary: { period_sales: 12 } } }
  }
  const params = { date_from: '2026-10-01', date_to: '2026-10-27', company_id: 'co', warehouse_id: 'w', customer_id: 'c', supplier_id: 's' }
  assert.equal((await dashboard.getAdminDashboard(params)).success, true)
  await dashboard.getAdminDashboard({ ...params, company_id: '', warehouse_id: '', customer_id: '', supplier_id: '' })
  assert.deepEqual(queries[0], params)
  assert.deepEqual(queries[1], { date_from: params.date_from, date_to: params.date_to })
})
