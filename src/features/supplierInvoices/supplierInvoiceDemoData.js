// =============================================================================
// FRONTEND DEMO SUPPLIER INVOICES - UI TESTING ONLY
// -----------------------------------------------------------------------------
// Gated behind the same explicit demo flag as the rest of the app. Ids are
// prefixed `demo-si-` so they can never be mistaken for a real backend id.
// Real Supplier Invoices are NOT persisted anywhere (no backend entity) - real
// mode shows a truthful future-state instead of writing here.
//
// Figures are kept consistent with the demo Supplier / Purchase / GRN data:
//   Reliance PUR-2026-001  total 185000, GRN-2026-003 fully received
//   Coastal  PUR-2026-002  total 92000,  GRN-2026-002 fully received
//   Apex     PUR-2026-003  total 45000,  GRN-2026-001 partial (8 of 15 accepted)
// =============================================================================

import { DEMO_PURCHASES_ENABLED } from '../purchases/purchaseDemoData'

export const SUPPLIER_INVOICES_DEMO_ENABLED = DEMO_PURCHASES_ENABLED

export function isDemoSupplierInvoice(id) {
  return typeof id === 'string' && id.startsWith('demo-si-')
}

function invItem(raw) {
  return {
    productId: raw.productId,
    productName: raw.productName,
    sku: raw.sku,
    uom: raw.uom || 'unit',
    invoiceQty: raw.invoiceQty,
    unitPrice: raw.unitPrice,
    discount: raw.discount || 0,
    taxRate: raw.taxRate || 0,
  }
}

const EMPTY_CHARGES = { freight: 0, packing: 0, insurance: 0, otherCharges: 0, roundOff: 0 }

const SEED_INVOICES = [
  {
    id: 'demo-si-rel-001',
    systemRef: 'SI-2026-001',
    supplierInvoiceNumber: 'INV-RIL-2026-081',
    supplierId: 'demo-supplier-reliance',
    supplierName: 'Reliance Industries',
    purchaseId: 'demo-po-rel-001',
    purchaseNumber: 'PUR-2026-001',
    grnId: 'demo-grn-rel-001',
    grnNumber: 'GRN-2026-003',
    invoiceDate: '2026-08-13',
    dueDate: '2026-09-12',
    currency: 'INR',
    paymentTerms: '30 Days',
    notes: 'Billed in full against the festive-season order. GRN-2026-003 received everything.',
    invoiceStatus: 'recorded',
    charges: { ...EMPTY_CHARGES },
    items: [
      invItem({ productId: 'demo-po-product-anchor', productName: 'Anchor Roma 6A One-Way Switch', sku: 'ANCHOR-6A', uom: 'pcs', invoiceQty: 500, unitPrice: 200 }),
      invItem({ productId: 'demo-po-product-extension', productName: 'Industrial Extension Board', sku: 'EXT-IND-01', uom: 'pcs', invoiceQty: 100, unitPrice: 850 }),
    ],
    amountPaid: 125000,
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-20T15:00:00.000Z',
  },
  {
    id: 'demo-si-cst-001',
    systemRef: 'SI-2026-002',
    supplierInvoiceNumber: 'INV-CST-2026-018',
    supplierId: 'demo-supplier-coastal',
    supplierName: 'Coastal Beverages Distribution',
    purchaseId: 'demo-po-cst-002',
    purchaseNumber: 'PUR-2026-002',
    grnId: 'demo-grn-cst-001',
    grnNumber: 'GRN-2026-002',
    invoiceDate: '2026-08-20',
    dueDate: '2026-09-04',
    currency: 'INR',
    paymentTerms: '15 Days',
    notes: 'Full delivery, invoice matches GRN. Paid in full.',
    invoiceStatus: 'recorded',
    charges: { ...EMPTY_CHARGES },
    items: [
      invItem({ productId: 'demo-po-product-water', productName: 'Mineral Water 1L (Case of 12)', sku: 'WATER-1L-CASE', uom: 'case', invoiceQty: 400, unitPrice: 100 }),
      invItem({ productId: 'demo-po-product-soft-drinks', productName: 'Soft Drinks 500ml (Case of 24)', sku: 'SOFT-500-CASE', uom: 'case', invoiceQty: 260, unitPrice: 200 }),
    ],
    amountPaid: 92000,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-22T11:30:00.000Z',
  },
  {
    id: 'demo-si-apx-001',
    systemRef: 'SI-2026-003',
    supplierInvoiceNumber: 'INV-APX-2026-025',
    supplierId: 'demo-supplier-apex',
    supplierName: 'Apex Electricals',
    purchaseId: 'demo-po-apx-003',
    purchaseNumber: 'PUR-2026-003',
    grnId: 'demo-grn-apx-001',
    grnNumber: 'GRN-2026-001',
    invoiceDate: '2026-08-28',
    dueDate: '2026-10-12',
    currency: 'INR',
    paymentTerms: '45 Days',
    notes: 'Supplier billed all 15 rolls but only 8 have been received and accepted so far - flagged for review.',
    invoiceStatus: 'recorded',
    charges: { ...EMPTY_CHARGES },
    items: [
      invItem({ productId: 'demo-po-product-cables', productName: 'Copper Cable Roll (90m)', sku: 'CAB-CU-90', uom: 'roll', invoiceQty: 15, unitPrice: 3000 }),
    ],
    amountPaid: 0,
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
  },
]

// -----------------------------------------------------------------------------
// Local simulation store (localStorage) - override map + custom list, same
// pattern as purchaseDemoData.js. Never touches a real API.
// -----------------------------------------------------------------------------
const OVERRIDE_KEY = 'saas.supplierInvoiceDemoOverride.v1'
const CUSTOM_KEY = 'saas.supplierInvoiceDemoCustom.v1'

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key))
    return parsed ?? fallback
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
const readCustom = () => (Array.isArray(readJson(CUSTOM_KEY, [])) ? readJson(CUSTOM_KEY, []) : [])

function allBaseInvoices() {
  return [...SEED_INVOICES, ...readCustom()]
}

export function demoSupplierInvoicesResolved() {
  const overrides = readOverrides()
  return allBaseInvoices().map((invoice) => (overrides[invoice.id] ? { ...invoice, ...overrides[invoice.id] } : invoice))
}

export function getDemoSupplierInvoice(id) {
  const base = allBaseInvoices().find((invoice) => invoice.id === id)
  if (!base) return null
  const override = readOverrides()[id]
  return override ? { ...base, ...override } : base
}

export function patchDemoSupplierInvoice(id, partial) {
  if (!isDemoSupplierInvoice(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, map)
}

export function nextDemoSupplierInvoiceRef() {
  const year = new Date().getFullYear()
  const maxSeq = allBaseInvoices().reduce((max, invoice) => {
    const match = /SI-\d{4}-(\d+)/.exec(invoice.systemRef || '')
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `SI-${year}-${String(maxSeq + 1).padStart(3, '0')}`
}

export function createDemoSupplierInvoice(data) {
  const list = readCustom()
  const now = new Date().toISOString()
  const record = {
    id: `demo-si-custom-${Date.now().toString(36)}`,
    systemRef: nextDemoSupplierInvoiceRef(),
    invoiceStatus: 'draft',
    amountPaid: 0,
    charges: { ...EMPTY_CHARGES },
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  writeJson(CUSTOM_KEY, [...list, record])
  return record
}

export function getSupplierInvoiceNumbersForSupplier(supplierId, exceptId) {
  return demoSupplierInvoicesResolved()
    .filter((invoice) => invoice.supplierId === supplierId && invoice.id !== exceptId)
    .map((invoice) => invoice.supplierInvoiceNumber)
}

export function getDemoSupplierInvoicesForSupplier(supplierId) {
  return demoSupplierInvoicesResolved().filter((invoice) => invoice.supplierId === supplierId)
}

export function getDemoSupplierInvoicesForPurchase(purchaseId) {
  return demoSupplierInvoicesResolved().filter((invoice) => invoice.purchaseId === purchaseId)
}
