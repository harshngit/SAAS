import assert from 'node:assert/strict'
import { before, after, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'
let server, api, client, auth, store, roles, platformRoles
const sales = { id: 'sales', system_role: 'sales_manager', organization_id: null, name: 'Sales Manager', email: 'sales@example.test', is_active: true, role: null }
const admin = { ...sales, id: 'super', system_role: 'super_admin' }
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  api = await server.ssrLoadModule('/src/api/platform.js')
  ;({ apiClient: client } = await server.ssrLoadModule('/src/api/client.js'))
  auth = await server.ssrLoadModule('/src/api/auth.js')
  ;({ useAuthStore: store } = await server.ssrLoadModule('/src/store/authStore.js'))
  roles = await server.ssrLoadModule('/src/auth/roles.js')
  platformRoles = await server.ssrLoadModule('/src/auth/platformRoles.js')
})
after(async () => server?.close())
beforeEach(() => {
  client.request = async () => { throw new Error('Unexpected request') }
  store.setState({ currentUser: sales, authTokens: { access_token: 'test', refresh_token: 'test' } })
})
test('platform identity requires organization-less system_role; tenant role is untouched', () => {
  assert.equal(platformRoles.platformRoleForUser(sales), 'sales_manager')
  assert.equal(platformRoles.platformRoleForUser(admin), 'super_admin')
  assert.equal(platformRoles.platformRoleForUser({ ...sales, organization_id: 'tenant' }), null)
  assert.equal(platformRoles.platformRoleForUser({ role: 'sales_manager', organization_id: 'tenant' }), null)
  assert.equal(platformRoles.platformRoleForUser({ system_role: 'sales_manager' }), null)
  assert.equal(platformRoles.platformRoleForUser({ system_role: 'support_agent', organization_id: null }), null)
})
test('platform home and shell win over tenant full_access/workspace values', () => {
  const session = { fullAccess: true, role: { workspace: 'admin' }, currentUser: sales }
  assert.equal(roles.resolveHomePath(session), '/platform/organizations')
  assert.equal(roles.resolveWorkspaceRole(session), roles.ROLES.PLATFORM_SALES_MANAGER)
  assert.equal(roles.resolveHomePath({ ...session, currentUser: admin }), '/superadmin/dashboard')
  assert.equal(roles.resolveHomePath({ fullAccess: true, currentUser: { role: 'admin', organization_id: 'tenant' } }), '/admin/dashboard')
})
test('Sales Manager menu has only three allowed entries; Super Admin keeps all eight', () => {
  const salesMenu = roles.roleMenus[roles.ROLES.PLATFORM_SALES_MANAGER].flatMap(group => group.items)
  assert.deepEqual(salesMenu.map(item => item.path), ['/platform/organizations', '/platform/upgrade-requests', '/platform/feature-requests'])
  const superMenu = roles.roleMenus[roles.ROLES.SUPER_ADMIN].flatMap(group => group.items)
  assert.equal(superMenu.length, 8)
  assert.ok(superMenu.some(item => item.path === '/superadmin/staff'))
  assert.ok(superMenu.some(item => item.path === '/superadmin/feature-requests'))
})
test('route access denies Sales Manager on Super Admin pages and all tenant users on platform pages', () => {
  assert.equal(platformRoles.hasPlatformAccess(sales), true)
  assert.equal(platformRoles.hasPlatformAccess(sales, true), false)
  assert.equal(platformRoles.hasPlatformAccess(admin, true), true)
  assert.equal(platformRoles.hasPlatformAccess({ role: 'admin', full_access: true, organization_id: 'tenant' }), false)
})
test('auth/me normalizes platform identity while retaining system_role and tenant sessions', async () => {
  client.get = async () => ({ data: { user: sales, organization: null, full_access: false } })
  assert.equal((await auth.getCurrentProfile()).success, true)
  assert.equal(store.getState().currentUser.role, 'platform_sales_manager')
  assert.equal(store.getState().currentUser.system_role, 'sales_manager')
  assert.equal(store.getState().currentOrganization, null)
  store.getState().setAuthenticatedSession({ user: { ...sales, role: 'sales_manager', organization_id: 'tenant', system_role: null } })
  assert.equal(store.getState().currentUser.role, 'sales_manager')
})
test('staff list uses plain array and exact search/active query', async () => {
  client.request = async config => {
    assert.equal(config.url, '/platform/staff')
    assert.equal(config.method, 'get')
    assert.deepEqual(config.params, { search: 'Ann', is_active: false })
    return { data: [sales] }
  }
  assert.deepEqual((await api.listPlatformStaff({ search: 'Ann', is_active: false })).staff, [sales])
})
test('staff create sends the supplied Sales Manager contract; edit sends only changed values', async () => {
  const original = { name: 'Ann', email: 'ann@example.test', phone: '', role: 'sales_manager', is_active: true }
  const changes = api.changedStaffFields(original, { ...original, name: 'Anne', password: '' })
  assert.deepEqual(changes, { name: 'Anne' })
  assert.deepEqual(api.changedStaffFields(original, { ...original, password: 'NewSecret123' }), { password: 'NewSecret123' })
  const calls = []
  client.request = async config => { calls.push(config); return { data: sales } }
  const body = { name: 'Ann', email: 'ann@example.test', phone: '', password: 'NewSecret123', role: 'sales_manager' }
  await api.createPlatformStaff(body)
  await api.updatePlatformStaff('sales', changes)
  await api.updatePlatformStaff('sales', { is_active: false })
  assert.deepEqual(calls.map(call => [call.method, call.url, call.data]), [
    ['post', '/platform/staff', body], ['patch', '/platform/staff/sales', { name: 'Anne' }], ['patch', '/platform/staff/sales', { is_active: false }],
  ])
})
test('409 and 422 expose backend detail and field validation', async () => {
  client.request = async () => { throw { response: { status: 409, data: { detail: 'Email already registered' } } } }
  const conflict = await api.createPlatformStaff({})
  assert.equal(conflict.error, 'Email already registered')
  assert.equal(conflict.fieldErrors.email, 'Email already registered')
  client.request = async () => { throw { response: { status: 422, data: { detail: [{ loc: ['body', 'password'], msg: 'Password too short' }] } } } }
  assert.equal((await api.createPlatformStaff({})).fieldErrors.password, 'Password too short')
})
test('platform 401 clears auth while 403 preserves session and reports No Access', async () => {
  client.request = async () => { throw { response: { status: 403, data: { detail: 'Super Admin required' } } } }
  const denied = await api.listPlatformStaff()
  assert.equal(denied.status, 403)
  assert.match(denied.error, /don't have access.*Super Admin required/)
  assert.equal(store.getState().currentUser.id, sales.id)
  client.request = async () => { throw { response: { status: 401, data: { detail: 'Inactive account' } } } }
  await api.listPlatformStaff()
  assert.equal(store.getState().currentUser, null)
  assert.equal(store.getState().authTokens, null)
})
test('organizations use the new endpoint and forward only chosen scope/sort filters', async () => {
  client.request = async config => {
    assert.equal(config.url, '/platform/organizations')
    assert.deepEqual(config.params, { page: 2, page_size: 25, search: 'Acme', status: 'active', upgrade_status: 'pending', sort_by: 'name', sort_order: 'asc' })
    return { data: { items: [{ id: 'org', name: 'Acme' }], total: 101 } }
  }
  const result = await api.listPlatformOrganizations({ page: 2, page_size: 25, search: 'Acme', status: 'active', upgrade_status: 'pending', sort_by: 'name', sort_order: 'asc' })
  assert.equal(result.total, 101)
  assert.equal(result.organizations[0].name, 'Acme')
})
test('request queues support mine and per-organization history without legacy organization upgrade calls', async () => {
  const calls = []
  client.request = async config => { calls.push(config); return { data: [] } }
  await api.listPlatformRequests('upgrade', { mine: true })
  await api.listPlatformRequests('feature', { organization_id: 'org' })
  assert.equal(calls[0].url, '/platform/upgrade-requests')
  assert.equal(calls[0].params.mine, true)
  assert.equal(calls[1].url, '/platform/feature-requests')
  assert.equal(calls[1].params.organization_id, 'org')
})
test('upgrade and feature request creation preserve exact backend bodies', async () => {
  const calls = []
  client.request = async config => { calls.push(config); return { data: { id: 'request' } } }
  const upgrade = { requested_plan_id: 'plan', billing_cycle: 'yearly', reason: 'Need capacity', notes: 'Discussed' }
  await api.createPlatformUpgrade('org', upgrade)
  for (const action of ['unlock', 'restrict']) await api.createPlatformFeature('org', { entitlement_key: 'catalog-returned-key', action, reason: 'Customer request' })
  assert.deepEqual(calls[0].data, upgrade)
  assert.equal(calls[0].url, '/platform/organizations/org/upgrade-requests')
  assert.deepEqual(calls.slice(1).map(call => call.data.action), ['unlock', 'restrict'])
  assert.ok(calls.slice(1).every(call => call.url === '/platform/organizations/org/feature-requests'))
})
test('decisions POST to request IDs with optional note and preserve conflict details', async () => {
  const calls = []
  client.request = async config => { calls.push(config); return { data: { status: 'approved' } } }
  await api.decidePlatformRequest('upgrade', 'request', 'approve', '')
  await api.decidePlatformRequest('feature', 'request', 'reject', 'No change')
  assert.deepEqual(calls.map(call => [call.url, call.data]), [['/platform/upgrade-requests/request/approve', { note: '' }], ['/platform/feature-requests/request/reject', { note: 'No change' }]])
  client.request = async () => { throw { response: { status: 409, data: { detail: 'Request already approved' } } } }
  const conflict = await api.decidePlatformRequest('upgrade', 'request', 'approve', '')
  assert.equal(conflict.status, 409)
  assert.equal(conflict.error, 'Request already approved')
})
test('organization reads use platform detail, features, entitlements, plans and billing without mutation', async () => {
  const calls = []
  client.request = async config => {
    calls.push(config.url)
    return { data: config.url.endsWith('/entitlements') ? { features: { supplied_key: true } } : config.url === '/platform/organizations/org' ? { id: 'org' } : [] }
  }
  await api.getPlatformOrganization('org')
  const access = await api.getPlatformEntitlements('org')
  assert.equal(access.data.features.supplied_key, true)
  await api.listPlatformFeatures()
  await api.listPlatformPlans()
  await api.getPlatformPayments('org')
  assert.deepEqual(calls, ['/platform/organizations/org', '/platform/organizations/org/entitlements', '/platform/features', '/platform/plans', '/platform/organizations/org/subscription-payments'])
})
test('restricted route declarations are inside the Super Admin-only guard', async () => {
  const code = await readFile('src/routes/AppRoutes.jsx', 'utf8')
  const parsed = parseSync('AppRoutes.jsx', code)
  assert.equal(parsed.errors.length, 0)
  const block = code.slice(code.indexOf('<PlatformGuard superAdminOnly>'), code.indexOf('<Route element={<PlatformGuard>'))
  for (const path of ['/superadmin/staff', '/superadmin/plans', '/superadmin/admins', '/superadmin/superadmins', '/superadmin/analytics']) assert.ok(block.includes(path), path)
})

function walk(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (value.type) out.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(item => walk(item, out))
    else if (child && typeof child === 'object') walk(child, out)
  }
  return out
}
async function actualDecision(context) {
  const code = await readFile('src/features/superadmin/PlatformRequests.jsx', 'utf8')
  const parsed = parseSync('PlatformRequests.jsx', code)
  const node = walk(parsed.program).find(node => node.type === 'FunctionDeclaration' && node.id?.name === 'decide')
  assert.ok(node)
  return new Function(...Object.keys(context), `return (${code.slice(node.start, node.end)})`)(...Object.values(context))
}
test('actual approval handler refetches backend plan/access after a successful decision', async () => {
  for (const kind of ['upgrade', 'feature']) {
    const calls = []
    const decide = await actualDecision({
      isSuperAdmin: true, kind, decision: { row: { id: 'request', status: 'pending', organization_id: 'org', entitlement_key: 'backend_key' }, action: 'approve' }, note: '',
      setSaving() {}, setDecisionError() {}, setDecision() {}, refresh() { calls.push('refresh') }, onChanged() { calls.push('changed') }, showToast() {},
      decidePlatformRequest: async () => { calls.push('decision'); return { success: true } },
      getPlatformEntitlements: async id => { assert.equal(id, 'org'); calls.push('entitlements'); return { success: true, data: { features: { backend_key: true } } } },
      getPlatformOrganization: async id => { assert.equal(id, 'org'); calls.push('organization'); return { success: true, organization: { id } } },
      setCurrentState(value) { assert.equal(value, true); calls.push('state-from-backend') },
    })
    await decide()
    assert.deepEqual(calls, kind === 'feature' ? ['decision', 'refresh', 'changed', 'entitlements', 'state-from-backend'] : ['decision', 'refresh', 'changed', 'organization'])
  }
})
test('actual decision handler refuses Sales Manager mutations and keeps exact 409 error while refreshing', async () => {
  const calls = []
  const context = {
    isSuperAdmin: false, decision: { row: { id: 'request', status: 'pending' }, action: 'approve' }, kind: 'upgrade', note: '',
    setSaving() {}, setDecisionError(error) { if (error) calls.push(error) },
    decidePlatformRequest: async () => { calls.push('request'); return { success: false, status: 409, error: 'Request already rejected' } },
    refresh() { calls.push('refresh') },
  }
  await (await actualDecision(context))()
  assert.deepEqual(calls, [])
  await (await actualDecision({ ...context, isSuperAdmin: true }))()
  assert.deepEqual(calls, ['request', 'Request already rejected', 'refresh'])
})
test('actual request-table action menu never offers approve/reject to Sales Manager', async () => {
  const code = await readFile('src/features/superadmin/PlatformRequests.jsx', 'utf8')
  const parsed = parseSync('PlatformRequests.jsx', code)
  const attribute = walk(parsed.program).find(node => node.type === 'JSXAttribute' && node.name?.name === 'actions')
  const expression = attribute.value.expression
  const actions = new Function('isSuperAdmin', 'open', 'navigate', 'basePath', `return (${code.slice(expression.start, expression.end)})`)(false, () => { throw new Error('Must not mutate') }, () => {}, '/platform')
  assert.deepEqual(actions({ id: 'request', status: 'pending', organization_id: 'org' }).map(action => action.label), ['View Organization'])
})
