// Run: node --test scripts/test-listing-summaries.mjs
// Exercise the actual summary expressions with table data changing independently.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parseSync } from 'rolldown/utils'
import { loadSummaryRows } from '../src/utils/listSummary.js'

const pages = [
  ['categories/CategoryList', null, 'categories'],
  ['customers/CustomerList', 'customerSummary', 'summaryCustomers'],
  ['leads/LeadList', 'leadSummary', 'summaryLeads'],
  ['quotations/QuotationList', 'quotationSummary', 'summaryQuotations'],
  ['products/ProductList', 'productSummary', 'summaryProducts'],
  ['suppliers/SupplierList', 'supplierSummary', 'summarySuppliers'],
  ['inventory/StockBoard', 'stats', 'items'],
  ['warehouses/WarehouseList', 'stats', 'warehouses'],
  ['purchases/PurchaseInvoiceList', 'stats', 'summaryPurchases'],
  ['purchaseReturns/PurchaseReturnList', 'stats', 'realStats'],
  ['orders/OrderList', 'stats', 'summaryOrders'],
  ['salesReturns/SalesReturnList', 'stats', 'salesReturns'],
  ['deliveries/AdminDeliveries', 'stats', 'deliveries'],
  ['vehicles/VehicleList', 'stats', 'vehicles'],
  ['outstanding/ReceivablesPayables', 'stats', 'invoices'],
  ['payables/PayablesList', 'stats', 'realSummary'],
  ['supplierPayments/SupplierPaymentsList', 'stats', 'summaryPayments'],
  ['expenses/AdminExpenses', 'stats', 'expenseList'],
  ['expenses/MyExpenses', 'counts', 'summaryExpenses'],
  ['collections/CollectionReconciliation', 'stats', 'collections'],
  ['supplierInvoices/SupplierInvoiceList', 'stats', 'summaryInvoices'],
  ['leaves/MyLeaves', 'counts', 'leaves'],
  ['superadmin/OrganizationsList', 'stats', 'summaryOrganizations'],
  ['superadmin/UpgradeRequests', 'requestSummary', 'summaryRequests'],
]

function nodes(value, out = []) {
  if (!value || typeof value !== 'object') return out
  if (value.type) out.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => nodes(item, out))
    else if (child && typeof child === 'object') nodes(child, out)
  }
  return out
}

const records = [
  { id: 'a', name: 'Alpha', status: 'active', leadStatus: 'new', leadSource: 'Website',
    approvalStatus: 'Pending', paymentStatus: 'Paid', total: 100, amount: 100, price: 100,
    total_stock: 5, is_active: true, isActive: true, outstanding: 50, outstandingAmount: 50,
    outstandingBalance: 50, outstandingPayable: 50, grandTotal: 100, mrr: 50, image: 'a.png',
    upgrade_status: 'pending', dueDate: '2020-01-01', lifecycle: { key: 'active' } },
  { id: 'b', name: 'Beta', status: 'recorded', leadStatus: 'won', leadSource: 'Referral',
    approvalStatus: 'Approved', paymentStatus: 'Paid', total: 200, amount: 200, price: 200,
    total_stock: 0, is_active: false, isActive: false, outstanding: 70, outstandingAmount: 70,
    outstandingBalance: 70, outstandingPayable: 70, grandTotal: 200, mrr: 70, parentId: 'a',
    upgrade_status: 'approved', dueDate: '2020-01-01', lifecycle: { key: 'active' } },
]

function context() {
  const scope = Object.fromEntries(pages.map(([, , name]) => [name, records]))
  return {
    ...scope, leaves: records.map((row, index) => ({ ...row, status: index ? 'approved' : 'pending' })),
    useMemo: (calculate) => calculate(), DEMO_MODE: false, PURCHASE_RETURNS_DEMO_ENABLED: false,
    realStats: { total: 2, draft: 1, inProgress: 0, completed: 1 },
    realSummary: { totalPayable: 120, totalOverdue: 50, dueToday: 0, openInvoiceCount: 2, supplierCount: 2 },
    rows: records, returns: records, demoRows: records, demoMonthPaid: 200, demoStats: {},
    Tags: 'icon', ImageIcon: 'icon', CalendarPlus: 'icon', CalendarClock: 'icon',
    safeNumber: (value) => Number(value) || 0,
    deriveQuotationStatus: (row) => row.status,
    derivePurchaseOutstanding: (row) => row.outstanding,
    derivePurchaseStatus: (row) => ({ key: row.status }),
    deriveReceivingStatus: () => ({ key: 'fully_received' }),
    srStatusMeta: (status) => ({ key: status }), prStatusMeta: (status) => ({ key: status }),
    getDeliveryStage: (row) => ({ key: row.status }),
    vehicleStatus: (row) => row.status, vehicleHasDriver: () => false,
    isInvoiceOverdue: () => false, isInvoiceDueSoon: () => false,
    isSameDay: () => true, isSameMonth: () => true, isWithinDays: () => true,
    toRow: (row) => ({ ...row, outstanding: row.outstandingAmount }),
  }
}

for (const [page, summaryName, sourceName] of pages) {
  test(`${page}: cards stay fixed when table rows/search/filter/sort/page change`, async () => {
    const source = await readFile(new URL(`../src/features/${page}.jsx`, import.meta.url), 'utf8')
    const ast = parseSync(`${page}.jsx`, source)
    assert.equal(ast.errors.length, 0)
    const all = nodes(ast.program)
    const expression = summaryName
      ? all.find((node) => node.type === 'VariableDeclarator' && node.id.name === summaryName)?.init
      : all.find((node) => node.type === 'ArrayExpression' && node.elements[0]?.properties?.some(
        (property) => property.key?.name === 'label' && property.value?.value === 'Total Categories'))
    assert.ok(expression, 'summary expression exists')
    const expressionCode = source.slice(expression.start, expression.end)
    assert.ok(expressionCode.includes(sourceName), `cards must use ${sourceName}`)
    assert.doesNotMatch(expressionCode, /\b(?:filtered\w*|visible\w*|paginated\w*|dateFiltered\w*|searchTerm|search|sortParams|sortFilter|statusFilter|dateFrom|dateTo)\b/)
    const before = context()
    const after = { ...before, rows: [], returns: [], searchTerm: 'no matches', search: 'no matches',
      statusFilter: 'inactive', sortFilter: 'oldest', sortParams: { sort_by: 'name', sort_order: 'desc' },
      dateFrom: '2099-01-01', dateTo: '2099-01-02', page: 2 }
    for (const node of all) {
      if (node.type === 'VariableDeclarator' && /^(filtered|visible|paginated|dateFiltered)/.test(node.id.name || '')) {
        before[node.id.name] = records
        after[node.id.name] = []
      }
    }
    const evaluate = (scope) => new Function(...Object.keys(scope), `return (${expressionCode})`)(...Object.values(scope))
    const expected = evaluate(before)
    assert.deepEqual(evaluate(after), expected)
    assert.ok(JSON.stringify(expected).match(/[1-9]/), 'test uses nonzero summary data')
  })
}

test('unfiltered summary loads every page, preserving access scope', async () => {
  const calls = []
  const rows = Array.from({ length: 205 }, (_, id) => ({ id: String(id), amount: id + 1 }))
  const result = await loadSummaryRows(async (query) => {
    calls.push(query)
    return { success: true, total: rows.length, payments: rows.slice((query.page - 1) * 100, query.page * 100) }
  }, 'payments', { submitted_by: 'current-user' })
  assert.equal(result.success, true)
  assert.deepEqual(result.payments, rows)
  assert.deepEqual(calls.map((query) => query.page), [1, 2, 3])
  assert.ok(calls.every((query) => query.submitted_by === 'current-user' && !query.search && !query.sort_by))
})

test('failed later summary page never returns a misleading partial total', async () => {
  const result = await loadSummaryRows(async ({ page }) => page === 1
    ? { success: true, total: 101, invoices: Array.from({ length: 100 }, (_, id) => ({ id: String(id) })) }
    : { success: false, error: 'Network error' }, 'invoices')
  assert.deepEqual(result, { success: false, error: 'Network error' })
})

test('empty datasets succeed and a server ignoring pagination does not loop', async () => {
  assert.deepEqual(await loadSummaryRows(async () => ({ success: true, items: [], total: 0 }), 'items'),
    { success: true, items: [], total: 0 })
  let calls = 0
  const result = await loadSummaryRows(async () => {
    calls += 1
    return { success: true, total: 200, items: [{ id: 'same' }] }
  }, 'items')
  assert.equal(result.success, false)
  assert.equal(calls, 2)
})

for (const [file, listName, rowsKey] of [
  ['customers', 'listCustomers', 'customers'], ['products', 'listProducts', 'products'],
  ['suppliers', 'listSuppliers', 'suppliers'], ['leads', 'listLeads', 'leads'],
  ['orders', 'listOrders', 'orders'], ['quotations', 'listQuotations', 'quotations'],
  ['expenses', 'listExpenses', 'expenses'], ['superadmin', 'listSuperAdminOrganizations', 'organizations'],
]) {
  test(`${listName}: actual frontend adapter forwards every summary page`, async () => {
    const source = await readFile(new URL(`../src/api/${file}.js`, import.meta.url), 'utf8')
    const ast = parseSync(`${file}.js`, source)
    const declaration = nodes(ast.program).find((node) => node.type === 'FunctionDeclaration' && node.id?.name === listName)
    assert.ok(declaration)
    const calls = []
    const all = Array.from({ length: 205 }, (_, id) => ({ id: String(id) }))
    const dependencies = {
      apiClient: { get: async (_url, { params }) => {
        calls.push(params)
        return { data: { items: all.slice(((params.page || 1) - 1) * 100, (params.page || 1) * 100), total: all.length } }
      } },
      authHeader: () => ({}), normalizeLead: (row) => row, normalizeOrder: (row) => row,
      normalizeQuotation: (row) => row, normalizeExpense: (row) => row, formatApiError: () => 'error',
    }
    const list = new Function(...Object.keys(dependencies), `return (${source.slice(declaration.start, declaration.end)})`)(...Object.values(dependencies))
    const result = await loadSummaryRows(list, rowsKey)
    assert.equal(result.success, true)
    assert.deepEqual(result[rowsKey], all)
    assert.deepEqual(calls.map((call) => call.page), [1, 2, 3])
  })
}

for (const [page, title] of [
  ['customers/CustomerList', 'Customers'], ['products/ProductList', 'Products'],
  ['suppliers/SupplierList', 'Suppliers'], ['leads/LeadList', 'Leads'],
  ['orders/OrderList', 'Orders'], ['quotations/QuotationList', 'Quotations'],
]) {
  test(`${page}: actual mutation updater refreshes both table and full summary`, async () => {
    const source = await readFile(new URL(`../src/features/${page}.jsx`, import.meta.url), 'utf8')
    const ast = parseSync(`${page}.jsx`, source)
    const updater = nodes(ast.program).find((node) => node.type === 'VariableDeclarator' && node.id.name === `update${title}`)?.init
    assert.ok(updater)
    let table = records.slice(0, 1)
    let summary = records.slice()
    const update = new Function(`set${title}`, `setSummary${title}`, `return (${source.slice(updater.start, updater.end)})`)(
      (fn) => { table = fn(table) }, (fn) => { summary = fn(summary) })
    update((current) => current.filter((row) => row.id !== 'a'))
    assert.deepEqual(table, [])
    assert.deepEqual(summary, [records[1]])
    const created = { id: 'new', amount: 300 }
    update((current) => [created, ...current])
    assert.deepEqual(table, [created])
    assert.deepEqual(summary, [created, records[1]])
  })
}

test('customer summary keeps the sales officer access scope, ignoring optional table filters', async () => {
  const source = await readFile(new URL('../src/features/customers/CustomerList.jsx', import.meta.url), 'utf8')
  const ast = parseSync('CustomerList.jsx', source)
  const call = nodes(ast.program).find((node) => node.type === 'CallExpression' && node.callee.name === 'loadSummaryRows')
  const scopeCode = source.slice(call.arguments[2].start, call.arguments[2].end)
  const scope = new Function('isSalesOfficer', 'currentUser', `return (${scopeCode})`)
  assert.deepEqual(scope(true, { id: 'sales-user' }), { assigned_sales_officer_id: 'sales-user' })
  assert.deepEqual(scope(false, { id: 'admin' }), {})
})

test('purchase return summary never falls back to filtered rows while counts are pending', async () => {
  const source = await readFile(new URL('../src/features/purchaseReturns/PurchaseReturnList.jsx', import.meta.url), 'utf8')
  const ast = parseSync('PurchaseReturnList.jsx', source)
  const init = nodes(ast.program).find((node) => node.type === 'VariableDeclarator' && node.id.name === 'stats').init
  const evaluate = new Function('useMemo', 'PURCHASE_RETURNS_DEMO_ENABLED', 'realStats', 'returns',
    `return (${source.slice(init.start, init.end)})`)
  assert.deepEqual(evaluate((fn) => fn(), false, null, records), evaluate((fn) => fn(), false, null, []))
})
