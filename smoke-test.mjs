// Full-platform smoke test — checks every backend module that's currently live.
// Run locally: node smoke-test.mjs
// Needs Node 18+ (uses built-in fetch). No npm install required.
//
// SET THESE AS ENV VARS BEFORE RUNNING — don't paste real credentials into any chat/file:
//   ADMIN_EMAIL=admin@yourfirm.com ADMIN_PASSWORD=yourpassword node smoke-test.mjs
//
// This creates a few throwaway test records (category, product, supplier, staff user)
// and cleans up everything it created. It does NOT touch your real company settings
// (only reads /organizations/settings, never writes it) and does NOT touch real inventory
// numbers (only reads /inventory, never posts an adjustment).

const BASE = process.env.API_BASE || 'https://crm-saas-backend-9nom.onrender.com'
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD as environment variables before running.')
  process.exit(1)
}

const results = []
let token = null
const stamp = Date.now()

function log(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

async function call(method, path, body, useAuth = true) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* no body */ }
  return { status: res.status, ok: res.ok, data }
}

async function main() {
  // 1. Auth
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, false)
  const accessToken = login.data?.tokens?.access_token || login.data?.access_token
  if (!login.ok || !accessToken) {
    log('Login', false, `status ${login.status} — stopping, nothing else can run without a token`)
    printSummary()
    return
  }
  token = accessToken
  log('Login', true)

  const me = await call('GET', '/auth/me')
  log('GET /auth/me', me.ok, me.ok ? `full_access=${me.data?.full_access}` : `status ${me.status}`)

  // 2. Roles
  const catalog = await call('GET', '/roles/catalog')
  log('GET /roles/catalog', catalog.ok, catalog.ok ? `${catalog.data?.modules?.length ?? 0} modules` : `status ${catalog.status}`)

  const roles = await call('GET', '/roles')
  log('GET /roles', roles.ok, roles.ok ? `${roles.data?.length ?? 0} roles` : `status ${roles.status}`)
  const defaultRole = Array.isArray(roles.data) ? roles.data.find((r) => r.is_default) : null

  // 3. Users (create -> get -> edit -> deactivate; no delete endpoint exists, left deactivated on purpose)
  let testUserId = null
  if (defaultRole) {
    const createUser = await call('POST', '/users', {
      name: `Smoke Test User ${stamp}`,
      email: `smoketest+${stamp}@example.com`,
      username: `smoketest${stamp}`,
      phone: '9999999999',
      password: 'SmokeTest@123',
      role_id: defaultRole.id,
    })
    log('POST /users', createUser.ok, createUser.ok ? '' : `status ${createUser.status} ${JSON.stringify(createUser.data)}`)
    testUserId = createUser.data?.id

    if (testUserId) {
      const getUser = await call('GET', `/users/${testUserId}`)
      log('GET /users/{id}', getUser.ok)

      const editUser = await call('PATCH', `/users/${testUserId}`, { name: `Smoke Test User ${stamp} (edited)` })
      log('PATCH /users/{id}', editUser.ok)

      const deactivate = await call('PATCH', `/users/${testUserId}/status`, { is_active: false })
      log('PATCH /users/{id}/status', deactivate.ok, 'left deactivated — no delete endpoint exists for users')
    }
  } else {
    log('POST /users', false, 'skipped — no default role found from GET /roles')
  }

  // 4. Organizations (read-only, never writes real settings)
  const orgSettings = await call('GET', '/organizations/settings')
  log('GET /organizations/settings', orgSettings.ok, orgSettings.ok ? '' : `status ${orgSettings.status}`)

  // 5. Categories (full create -> read -> update -> delete cycle)
  const createCategory = await call('POST', '/categories', { name: `Smoke Test Category ${stamp}` })
  log('POST /categories', createCategory.ok, createCategory.ok ? '' : `status ${createCategory.status}`)
  const categoryId = createCategory.data?.id
  if (categoryId) {
    log('GET /categories', (await call('GET', '/categories')).ok)
    log('GET /categories/{id}', (await call('GET', `/categories/${categoryId}`)).ok)
    log('PATCH /categories/{id}', (await call('PATCH', `/categories/${categoryId}`, { name: `Smoke Test Category ${stamp} (edited)` })).ok)
    const delCategory = await call('DELETE', `/categories/${categoryId}`)
    log('DELETE /categories/{id}', delCategory.ok || delCategory.status === 204)
  }

  // 6. Products (create -> read -> update -> delete cycle)
  const createProduct = await call('POST', '/products', {
    name: `Smoke Test Product ${stamp}`,
    price: 10,
    variations: [{ name: 'Default', price: 10, inventory: 0 }],
  })
  log('POST /products', createProduct.ok, createProduct.ok ? '' : `status ${createProduct.status} ${JSON.stringify(createProduct.data)}`)
  const productId = createProduct.data?.id
  if (productId) {
    log('GET /products', (await call('GET', '/products')).ok)
    log('GET /products/{id}', (await call('GET', `/products/${productId}`)).ok)
    log('PATCH /products/{id}', (await call('PATCH', `/products/${productId}`, { name: `Smoke Test Product ${stamp} (edited)` })).ok)
    const delProduct = await call('DELETE', `/products/${productId}`)
    log('DELETE /products/{id}', delProduct.ok || delProduct.status === 204)
  }

  // 7. Inventory (read-only, never posts an adjustment against real stock)
  log('GET /inventory', (await call('GET', '/inventory')).ok)

  // 8. Suppliers (create -> read -> payment -> void payment -> delete cycle)
  const createSupplier = await call('POST', '/suppliers', { name: `Smoke Test Supplier ${stamp}`, opening_balance: 0 })
  log('POST /suppliers', createSupplier.ok, createSupplier.ok ? '' : `status ${createSupplier.status}`)
  const supplierId = createSupplier.data?.id
  if (supplierId) {
    log('GET /suppliers', (await call('GET', '/suppliers')).ok)
    log('GET /suppliers/{id}', (await call('GET', `/suppliers/${supplierId}`)).ok)

    const paymentNote = `smoke test payment ${stamp}`
    const payment = await call('POST', `/suppliers/${supplierId}/payments`, {
      amount: 100,
      payment_mode: 'cash',
      note: paymentNote,
    })
    log('POST /suppliers/{id}/payments', payment.ok, payment.ok ? '' : `status ${payment.status}`)

    const paymentsList = await call('GET', `/suppliers/${supplierId}/payments`)
    log('GET /suppliers/{id}/payments', paymentsList.ok)
    const paymentId = Array.isArray(paymentsList.data)
      ? paymentsList.data.find((p) => p.note === paymentNote)?.id
      : null

    if (paymentId) {
      const voidPayment = await call('DELETE', `/suppliers/${supplierId}/payments/${paymentId}`)
      log('DELETE /suppliers/{id}/payments/{id}', voidPayment.ok || voidPayment.status === 204)
    }

    const delSupplier = await call('DELETE', `/suppliers/${supplierId}`)
    log('DELETE /suppliers/{id}', delSupplier.ok || delSupplier.status === 204)
  }

  // 9. Plans (read-only)
  log('GET /plans', (await call('GET', '/plans')).ok)

  printSummary()
}

function printSummary() {
  const pass = results.filter((r) => r.ok).length
  const fail = results.length - pass
  console.log('\n----------------------------------------')
  console.log(`${pass} passed, ${fail} failed, ${results.length} total`)
  if (fail > 0) {
    console.log('\nFailed checks:')
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}${r.detail ? ' — ' + r.detail : ''}`))
  }
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(1)
})
