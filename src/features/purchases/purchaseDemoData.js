// =============================================================================
// FRONTEND DEMO / MOCK PURCHASES - UI TESTING ONLY
// -----------------------------------------------------------------------------
// Reuses the project's existing explicit demo-mode flag (config/demoMode.js). Ids are prefixed
// `demo-po-` (Purchase) so they can never be mistaken for a real backend id, and every mutating
// handler in PurchaseInvoiceDetail.jsx / PurchaseInvoiceForm.jsx guards on isDemoPurchase(id)
// before ever calling a real API. Supplier ids intentionally match the ones used in
// supplierDemoData.js (demo-supplier-reliance etc.) so "View Supplier" links land on the same
// demo supplier record - this only reuses the same ID CONVENTION, no code/data is imported
// across the two modules.
//
// Totals below intentionally match supplierDemoData.js's Reliance/Coastal/Apex demo purchase
// figures exactly (185000/125000/60000, 92000/92000/0, 45000/0/45000) so Supplier Detail's
// Purchases tab and this Purchase module never show contradictory numbers for the same supplier.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'

export const DEMO_PURCHASES_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoPurchase(id) {
  return typeof id === 'string' && id.startsWith('demo-po-')
}

const SUPPLIER_SNAPSHOTS = {
  'demo-supplier-reliance': {
    name: 'Reliance Industries', contactPerson: 'Anil Mehta', phone: '+91 98765 41001', email: 'procurement@reliance-demo.example',
    gstNumber: '27AAECR1234F1Z5', address: 'Plot 14, Andheri Industrial Estate, Andheri East, Mumbai, Maharashtra 400001',
    paymentTerms: '30 Days', purchaseCurrency: 'INR - Indian Rupee',
  },
  'demo-supplier-coastal': {
    name: 'Coastal Beverages Distribution', contactPerson: 'Priya Nair', phone: '+91 98765 41002', email: 'orders@coastal-demo.example',
    gstNumber: '', address: 'Warehouse 3, Willingdon Island Port Road, Kochi, Kerala 682001',
    paymentTerms: '15 Days', purchaseCurrency: 'INR - Indian Rupee',
  },
  'demo-supplier-apex': {
    name: 'Apex Electricals', contactPerson: 'Neeraj Kapoor', phone: '+91 98765 41004', email: 'sales@apex-demo.example',
    gstNumber: '07AABCA9012H1Z8', address: 'B-45, Bhagirath Palace, Chandni Chowk, Delhi 110001',
    paymentTerms: '45 Days', purchaseCurrency: 'INR - Indian Rupee',
  },
  'demo-supplier-metro': {
    name: 'Metro Wholesale Supplies', contactPerson: 'Rakesh Shah', phone: '+91 98765 41003', email: 'hello@metro-demo.example',
    gstNumber: '27AABCM5678G1Z2', address: 'Shop 22, Market Yard, Gultekdi, Pune, Maharashtra 411001',
    paymentTerms: 'Immediate', purchaseCurrency: 'INR - Indian Rupee',
  },
}

export function getDemoSupplierSnapshot(supplierId) {
  return SUPPLIER_SNAPSHOTS[supplierId] || null
}

function item(overrides) {
  const quantity = overrides.quantity
  const purchasePrice = overrides.purchasePrice
  const discount = overrides.discount || 0
  const tax = overrides.tax || 0
  const subtotal = quantity * purchasePrice
  const discounted = subtotal - subtotal * (discount / 100)
  const lineTotal = discounted + discounted * (tax / 100)
  return {
    id: overrides.id,
    productId: overrides.productId,
    variantId: '',
    productName: overrides.productName,
    sku: overrides.sku,
    uom: overrides.uom || 'unit',
    quantity,
    purchasePrice,
    discount,
    tax,
    lineTotal,
  }
}

export const demoPurchases = [
  {
    id: 'demo-po-rel-001', invoiceNumber: 'PUR-2026-001', purchaseNumber: 'PUR-2026-001',
    supplierId: 'demo-supplier-reliance', supplierName: 'Reliance Industries',
    purchaseType: 'Purchase Order', warehouseId: 'demo-wh-main', warehouseName: 'Main Warehouse',
    purchaseDate: '2026-08-08', invoiceDate: '2026-08-08', financialYear: '2026-27',
    billingAddress: 'Main Warehouse, 12 MG Road, Mumbai',
    status: 'approved', receivingStatus: 'completed', paymentStatus: 'partial',
    subtotal: 185000, discount: 0, tax: 0, total: 185000, amountPaid: 125000,
    notes: 'Bulk electrical stock replenishment for the festive season.',
    items: [
      item({ id: 'i1', productId: 'demo-po-product-anchor', productName: 'Anchor Roma 6A One-Way Switch', sku: 'ANCHOR-6A', uom: 'pcs', quantity: 500, purchasePrice: 200 }),
      item({ id: 'i2', productId: 'demo-po-product-extension', productName: 'Industrial Extension Board', sku: 'EXT-IND-01', uom: 'pcs', quantity: 100, purchasePrice: 850 }),
    ],
    createdAt: '2026-08-08T10:00:00.000Z', updatedAt: '2026-08-20T15:00:00.000Z',
  },
  {
    id: 'demo-po-cst-002', invoiceNumber: 'PUR-2026-002', purchaseNumber: 'PUR-2026-002',
    supplierId: 'demo-supplier-coastal', supplierName: 'Coastal Beverages Distribution',
    purchaseType: 'Direct Purchase', warehouseId: 'demo-wh-central', warehouseName: 'Central Warehouse',
    purchaseDate: '2026-08-18', invoiceDate: '2026-08-18', financialYear: '2026-27',
    billingAddress: 'Central Warehouse, Willingdon Island, Kochi',
    status: 'approved', receivingStatus: 'completed', paymentStatus: 'paid',
    subtotal: 92000, discount: 0, tax: 0, total: 92000, amountPaid: 92000,
    notes: 'Monthly beverage stock restock.',
    items: [
      item({ id: 'i1', productId: 'demo-po-product-water', productName: 'Mineral Water 1L (Case of 12)', sku: 'WATER-1L-CASE', uom: 'case', quantity: 400, purchasePrice: 100 }),
      item({ id: 'i2', productId: 'demo-po-product-soft-drinks', productName: 'Soft Drinks 500ml (Case of 24)', sku: 'SOFT-500-CASE', uom: 'case', quantity: 260, purchasePrice: 200 }),
    ],
    createdAt: '2026-08-18T10:00:00.000Z', updatedAt: '2026-08-22T11:30:00.000Z',
  },
  {
    id: 'demo-po-apx-003', invoiceNumber: 'PUR-2026-003', purchaseNumber: 'PUR-2026-003',
    supplierId: 'demo-supplier-apex', supplierName: 'Apex Electricals',
    purchaseType: 'Purchase Order', warehouseId: 'demo-wh-main', warehouseName: 'Main Warehouse',
    purchaseDate: '2026-08-25', invoiceDate: '2026-08-25', financialYear: '2026-27',
    billingAddress: 'Main Warehouse, 12 MG Road, Mumbai',
    status: 'approved', receivingStatus: 'pending', paymentStatus: 'unpaid',
    subtotal: 45000, discount: 0, tax: 0, total: 45000, amountPaid: 0,
    notes: 'Awaiting delivery from supplier.',
    items: [
      item({ id: 'i1', productId: 'demo-po-product-cables', productName: 'Copper Cable Roll (90m)', sku: 'CAB-CU-90', uom: 'roll', quantity: 15, purchasePrice: 3000 }),
    ],
    createdAt: '2026-08-25T10:00:00.000Z', updatedAt: '2026-08-25T10:00:00.000Z',
  },
  {
    id: 'demo-po-met-004', invoiceNumber: 'PUR-2026-004', purchaseNumber: 'PUR-2026-004',
    supplierId: 'demo-supplier-metro', supplierName: 'Metro Wholesale Supplies',
    purchaseType: 'Direct Purchase', warehouseId: 'demo-wh-main', warehouseName: 'Main Warehouse',
    purchaseDate: '2026-09-01', invoiceDate: '2026-09-01', financialYear: '2026-27',
    billingAddress: '',
    status: 'pending', receivingStatus: 'pending', paymentStatus: 'unpaid',
    subtotal: 2000, discount: 0, tax: 0, total: 2000, amountPaid: 0,
    notes: 'Draft - trial order, not yet confirmed.',
    items: [
      item({ id: 'i1', productId: 'demo-po-product-packaging', productName: 'Packaging Material', sku: 'PACK-GEN-01', uom: 'pcs', quantity: 50, purchasePrice: 40 }),
    ],
    createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
  },
]

// -----------------------------------------------------------------------------
// Local simulation store (localStorage) - same pattern as orders/orderDemoData.js: an override
// map keyed by id (for confirm/cancel/payment/return actions on the seeded rows above) plus a
// custom-rows list (for purchases created via "Create Purchase" while in demo mode). Never
// touches a real API - isDemoPurchase() gates every caller before it reaches here.
// -----------------------------------------------------------------------------
const OVERRIDE_KEY = 'saas.purchaseDemoOverride.v1'
const CUSTOM_KEY = 'saas.purchaseDemoCustom.v1'

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled - demo edits just won't persist across refresh */
  }
}

const readOverrides = () => readJson(OVERRIDE_KEY, {})
const readCustom = () => readJson(CUSTOM_KEY, [])

function allBasePurchases() {
  return [...demoPurchases, ...readCustom()]
}

export function demoPurchasesResolved() {
  const overrides = readOverrides()
  return allBasePurchases().map((purchase) => (overrides[purchase.id] ? { ...purchase, ...overrides[purchase.id] } : purchase))
}

export function getDemoPurchase(id) {
  const base = allBasePurchases().find((purchase) => purchase.id === id)
  if (!base) return null
  const override = readOverrides()[id]
  return override ? { ...base, ...override } : base
}

export function patchDemoPurchase(id, partial) {
  if (!isDemoPurchase(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, map)
}

export function createDemoPurchase(data) {
  const list = readCustom()
  const id = `demo-po-custom-${Date.now().toString(36)}`
  const number = `PUR-2026-C${String(list.length + 1).padStart(3, '0')}`
  const now = new Date().toISOString()
  const record = {
    id,
    invoiceNumber: data.invoiceNumber || number,
    purchaseNumber: number,
    status: 'pending',
    receivingStatus: 'pending',
    paymentStatus: 'unpaid',
    amountPaid: 0,
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  writeJson(CUSTOM_KEY, [...list, record])
  return record
}

export function getDemoPurchasesForSupplier(supplierId) {
  return demoPurchasesResolved().filter((purchase) => purchase.supplierId === supplierId)
}
