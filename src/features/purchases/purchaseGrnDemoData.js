// =============================================================================
// FRONTEND DEMO GOODS RECEIPTS (GRN) - UI TESTING ONLY
// -----------------------------------------------------------------------------
// Gated behind the same explicit demo-mode flag as the rest of the Purchase
// module. GRN ids are prefixed `demo-grn-` so they can never be mistaken for a
// real backend id, and every caller checks demo mode before reaching this file.
// Real purchases NEVER get a GRN from here - the backend has no GRN persistence,
// so real mode shows a truthful empty state instead.
//
// Line quantities below are kept arithmetically consistent with the demo
// purchase items in purchaseDemoData.js (the task's "ordered 100" sample numbers
// were illustrative; the real demo purchases have different quantities, and we
// never want an impossible received > ordered state).
// =============================================================================

import { DEMO_PURCHASES_ENABLED } from './purchaseDemoData'
import { computeGrnLine } from './purchaseGrnHelpers'

export const GRN_DEMO_ENABLED = DEMO_PURCHASES_ENABLED

export function isDemoGrn(id) {
  return typeof id === 'string' && id.startsWith('demo-grn-')
}

function line(raw) {
  const computed = computeGrnLine({
    orderedQty: raw.orderedQty,
    previousReceived: raw.previousReceived || 0,
    receivingNow: raw.receivingNow,
    damagedQty: raw.damagedQty || 0,
    rejectedQty: raw.rejectedQty || 0,
  })
  return {
    productId: raw.productId,
    productName: raw.productName,
    sku: raw.sku,
    batchNumber: raw.batchNumber || '',
    serialNumber: raw.serialNumber || '',
    expiryDate: raw.expiryDate || '',
    ...computed,
  }
}

const SEED_GRNS = [
  {
    id: 'demo-grn-apx-001',
    grnNumber: 'GRN-2026-001',
    purchaseId: 'demo-po-apx-003',
    purchaseNumber: 'PUR-2026-003',
    supplierId: 'demo-supplier-apex',
    supplierName: 'Apex Electricals',
    warehouseId: 'demo-wh-main',
    warehouseName: 'Central Mumbai Warehouse',
    receiptDate: '2026-08-27',
    receivedBy: 'Rahul Verma',
    notes: 'First lorry arrived short; 2 rolls water-damaged in transit.',
    lines: [
      line({ productId: 'demo-po-product-cables', productName: 'Copper Cable Roll (90m)', sku: 'CAB-CU-90', orderedQty: 15, previousReceived: 0, receivingNow: 10, damagedQty: 2, rejectedQty: 0 }),
    ],
    createdAt: '2026-08-27T11:30:00.000Z',
  },
  {
    id: 'demo-grn-cst-001',
    grnNumber: 'GRN-2026-002',
    purchaseId: 'demo-po-cst-002',
    purchaseNumber: 'PUR-2026-002',
    supplierId: 'demo-supplier-coastal',
    supplierName: 'Coastal Beverages Distribution',
    warehouseId: 'demo-wh-central',
    warehouseName: 'Navi Mumbai Warehouse',
    receiptDate: '2026-08-19',
    receivedBy: 'Anitha Menon',
    notes: 'Full delivery received in one shipment. Batch + expiry logged.',
    lines: [
      line({ productId: 'demo-po-product-water', productName: 'Mineral Water 1L (Case of 12)', sku: 'WATER-1L-CASE', orderedQty: 400, previousReceived: 0, receivingNow: 400, batchNumber: 'CB-W-2608', expiryDate: '2027-02-18' }),
      line({ productId: 'demo-po-product-soft-drinks', productName: 'Soft Drinks 500ml (Case of 24)', sku: 'SOFT-500-CASE', orderedQty: 260, previousReceived: 0, receivingNow: 260, batchNumber: 'CB-S-2608', expiryDate: '2026-12-30' }),
    ],
    createdAt: '2026-08-19T09:15:00.000Z',
  },
  {
    id: 'demo-grn-rel-001',
    grnNumber: 'GRN-2026-003',
    purchaseId: 'demo-po-rel-001',
    purchaseNumber: 'PUR-2026-001',
    supplierId: 'demo-supplier-reliance',
    supplierName: 'Reliance Industries',
    warehouseId: 'demo-wh-main',
    warehouseName: 'Central Mumbai Warehouse',
    receiptDate: '2026-08-12',
    receivedBy: 'Rahul Verma',
    notes: 'Complete receipt against the festive-season order.',
    lines: [
      line({ productId: 'demo-po-product-anchor', productName: 'Anchor Roma 6A One-Way Switch', sku: 'ANCHOR-6A', orderedQty: 500, previousReceived: 0, receivingNow: 500 }),
      line({ productId: 'demo-po-product-extension', productName: 'Industrial Extension Board', sku: 'EXT-IND-01', orderedQty: 100, previousReceived: 0, receivingNow: 100 }),
    ],
    createdAt: '2026-08-12T14:00:00.000Z',
  },
]

// -----------------------------------------------------------------------------
// Local simulation store (localStorage) - a flat list of GRNs created via the
// "Receive Goods" flow while in demo mode. Same read/write pattern as
// purchaseDemoData.js. Never touches a real API.
// -----------------------------------------------------------------------------
const STORE_KEY = 'saas.purchaseGrnDemo.v1'

function readStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORE_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStore(list) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* storage disabled - demo GRNs just won't persist across refresh */
  }
}

function allDemoGrns() {
  return [...SEED_GRNS, ...readStore()]
}

export function getDemoGrns(purchaseId) {
  return allDemoGrns()
    .filter((grn) => grn.purchaseId === purchaseId)
    .sort((a, b) => new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime())
}

export function getDemoGrn(grnId) {
  return allDemoGrns().find((grn) => grn.id === grnId) || null
}

export function nextDemoGrnNumber() {
  const year = new Date().getFullYear()
  const maxSeq = allDemoGrns().reduce((max, grn) => {
    const match = /GRN-\d{4}-(\d+)/.exec(grn.grnNumber || '')
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `GRN-${year}-${String(maxSeq + 1).padStart(3, '0')}`
}

export function addDemoGrn(grn) {
  const record = { ...grn, id: grn.id || `demo-grn-${Date.now().toString(36)}`, createdAt: new Date().toISOString() }
  writeStore([...readStore(), record])
  return record
}
