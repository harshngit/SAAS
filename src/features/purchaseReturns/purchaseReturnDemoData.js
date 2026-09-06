// Local-only demo layer for Purchase Returns. Explicit switch only — tied to the Purchase
// module's demo flag (VITE_DEMO_DATA=true). Never inferred from an empty/failed API, never
// calls a real endpoint, never writes a real record. Records are anchored to the existing
// demo purchases + demo GRNs so received / returnable quantities stay coherent.

import { DEMO_PURCHASES_ENABLED, demoPurchasesResolved } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import { cumulativeAcceptedByProduct } from '../purchases/purchaseGrnHelpers'

export const PURCHASE_RETURNS_DEMO_ENABLED = DEMO_PURCHASES_ENABLED

const OVERRIDE_KEY = 'saas.purchaseReturnDemoOverride.v1'
const CUSTOM_KEY = 'saas.purchaseReturnDemoCustom.v1'

const readJson = (key, fallback) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}
const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled - demo change just won't survive a refresh */
  }
}

export function isDemoPurchaseReturn(id) {
  return typeof id === 'string' && id.startsWith('demo-pr-')
}

const iso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

// Received (accepted) quantity per product for a demo purchase, from its demo GRNs.
function receivedByProduct(purchaseId) {
  return cumulativeAcceptedByProduct(getDemoGrns(purchaseId))
}

function grnRefFor(purchaseId) {
  const grns = getDemoGrns(purchaseId)
  return grns.length ? { grnId: grns[0].id, grnNumber: grns[0].grnNumber } : { grnId: '', grnNumber: '' }
}

function seedItem(purchaseItem, received, returnQty) {
  return {
    id: `demo-pri-${purchaseItem.id}-${returnQty}`,
    purchaseItemId: purchaseItem.id,
    productId: purchaseItem.productId,
    variantId: '',
    productName: purchaseItem.productName,
    sku: purchaseItem.sku || '',
    receivedQty: received,
    previouslyReturned: 0,
    returnQty,
    unitPrice: purchaseItem.purchasePrice ?? purchaseItem.unitPrice ?? 0,
  }
}

function buildSeeds() {
  const purchases = demoPurchasesResolved()
  const rel = purchases.find((p) => p.id === 'demo-po-rel-001') // Reliance, GRN fully received
  const cst = purchases.find((p) => p.id === 'demo-po-cst-002') // Coastal
  const apx = purchases.find((p) => p.id === 'demo-po-apx-003') // Apex, partial GRN (cable 8 accepted)
  const seeds = []

  const base = (over) => ({
    returnType: 'Debit Note',
    warehouseName: '',
    notes: '',
    confirmedAt: null,
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: '',
    ...over,
  })

  if (rel) {
    const rec = receivedByProduct(rel.id)
    const anchor = rel.items[0]
    // A — Draft: damaged packaging
    seeds.push(
      base({
        id: 'demo-pr-01',
        returnNumber: 'PR-DEMO-001',
        status: 'draft',
        returnDate: iso(1),
        supplierId: rel.supplierId,
        supplierName: rel.supplierName,
        purchaseId: rel.id,
        purchaseNumber: rel.purchaseNumber,
        ...grnRefFor(rel.id),
        warehouseId: rel.warehouseId,
        warehouseName: rel.warehouseName,
        returnReason: 'Damaged Goods',
        notes: 'Two cartons of switches crushed in the last pallet.',
        items: [seedItem(anchor, rec[anchor.productId] || anchor.quantity, 12)],
        createdAt: iso(1),
        updatedAt: iso(1),
      }),
    )
    // D — Completed
    const anchor2 = rel.items[1] || rel.items[0]
    seeds.push(
      base({
        id: 'demo-pr-04',
        returnNumber: 'PR-DEMO-004',
        status: 'completed',
        returnDate: iso(14),
        supplierId: rel.supplierId,
        supplierName: rel.supplierName,
        purchaseId: rel.id,
        purchaseNumber: rel.purchaseNumber,
        ...grnRefFor(rel.id),
        warehouseId: rel.warehouseId,
        warehouseName: rel.warehouseName,
        returnReason: 'Quality Issue',
        notes: 'Batch failed the incoming QC check; supplier collected the lot.',
        confirmedAt: iso(12),
        dispatchedAt: iso(10),
        completedAt: iso(8),
        items: [seedItem(anchor2, rec[anchor2.productId] || anchor2.quantity, 6)],
        createdAt: iso(14),
        updatedAt: iso(8),
      }),
    )
  }

  if (cst) {
    const rec = receivedByProduct(cst.id)
    const anchor = cst.items[0]
    // B — Confirmed: wrong product awaiting dispatch
    seeds.push(
      base({
        id: 'demo-pr-02',
        returnNumber: 'PR-DEMO-002',
        status: 'confirmed',
        returnDate: iso(4),
        supplierId: cst.supplierId,
        supplierName: cst.supplierName,
        purchaseId: cst.id,
        purchaseNumber: cst.purchaseNumber,
        ...grnRefFor(cst.id),
        warehouseId: cst.warehouseId,
        warehouseName: cst.warehouseName,
        returnReason: 'Wrong Product',
        notes: 'Received sparkling instead of still water on 40 cases.',
        confirmedAt: iso(3),
        items: [seedItem(anchor, rec[anchor.productId] || anchor.quantity, 40)],
        createdAt: iso(4),
        updatedAt: iso(3),
      }),
    )
    // E — Cancelled before dispatch
    const anchor2 = cst.items[1] || cst.items[0]
    seeds.push(
      base({
        id: 'demo-pr-05',
        returnNumber: 'PR-DEMO-005',
        status: 'cancelled',
        returnDate: iso(9),
        supplierId: cst.supplierId,
        supplierName: cst.supplierName,
        purchaseId: cst.id,
        purchaseNumber: cst.purchaseNumber,
        ...grnRefFor(cst.id),
        warehouseId: cst.warehouseId,
        warehouseName: cst.warehouseName,
        returnReason: 'Excess Supply',
        notes: '',
        cancelledAt: iso(7),
        cancelReason: 'Supplier agreed to a price adjustment instead of a physical return.',
        items: [seedItem(anchor2, rec[anchor2.productId] || anchor2.quantity, 20)],
        createdAt: iso(9),
        updatedAt: iso(7),
      }),
    )
  }

  if (apx) {
    const rec = receivedByProduct(apx.id)
    const anchor = apx.items[0]
    // C — Dispatched: goods sent back to supplier
    seeds.push(
      base({
        id: 'demo-pr-03',
        returnNumber: 'PR-DEMO-003',
        status: 'dispatched',
        returnDate: iso(6),
        supplierId: apx.supplierId,
        supplierName: apx.supplierName,
        purchaseId: apx.id,
        purchaseNumber: apx.purchaseNumber,
        ...grnRefFor(apx.id),
        warehouseId: apx.warehouseId,
        warehouseName: apx.warehouseName,
        returnReason: 'Damaged Goods',
        notes: 'Water-damaged cable rolls flagged on the GRN — 2 units going back.',
        confirmedAt: iso(5),
        dispatchedAt: iso(4),
        items: [seedItem(anchor, rec[anchor.productId] || 8, 2)],
        createdAt: iso(6),
        updatedAt: iso(4),
      }),
    )
  }

  return seeds
}

function resolved() {
  const overrides = readJson(OVERRIDE_KEY, {})
  const custom = readJson(CUSTOM_KEY, [])
  const merge = (record) => (overrides[record.id] ? { ...record, ...overrides[record.id] } : record)
  return [...custom.map(merge), ...buildSeeds().map(merge)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  )
}

export function getDemoPurchaseReturns() {
  return resolved()
}

export function getDemoPurchaseReturn(id) {
  return resolved().find((record) => record.id === id) || null
}

function patch(id, partial) {
  const overrides = readJson(OVERRIDE_KEY, {})
  overrides[id] = { ...(overrides[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, overrides)
  return getDemoPurchaseReturn(id)
}

// ---- Interactive lifecycle simulation (localStorage only) ----------------------------------

export function createDemoPurchaseReturn(payload) {
  const custom = readJson(CUSTOM_KEY, [])
  const seq = custom.length + getDemoPurchaseReturns().length + 1
  const now = new Date().toISOString()
  const record = {
    id: `demo-pr-${Date.now().toString(36)}`,
    returnNumber: `PR-DEMO-${String(seq).padStart(3, '0')}`,
    status: 'draft',
    returnDate: payload.returnDate || now,
    supplierId: payload.supplierId || '',
    supplierName: payload.supplierName || '',
    purchaseId: payload.purchaseId || '',
    purchaseNumber: payload.purchaseNumber || '',
    grnId: payload.grnId || '',
    grnNumber: payload.grnNumber || '',
    warehouseId: payload.warehouseId || '',
    warehouseName: payload.warehouseName || '',
    returnReason: payload.returnReason || '',
    returnType: payload.returnType || 'Debit Note',
    notes: payload.notes || '',
    confirmedAt: null,
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: '',
    items: (payload.items || []).map((item, index) => ({
      id: `demo-pri-${Date.now().toString(36)}-${index}`,
      purchaseItemId: item.purchaseItemId || '',
      productId: item.productId || '',
      variantId: item.variantId || '',
      productName: item.productName || 'Item',
      sku: item.sku || '',
      receivedQty: Number(item.receivedQty) || 0,
      previouslyReturned: Number(item.previouslyReturned) || 0,
      returnQty: Number(item.returnQty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
    })),
    createdAt: now,
    updatedAt: now,
  }
  writeJson(CUSTOM_KEY, [record, ...custom])
  return record
}

export function updateDemoPurchaseReturn(id, payload) {
  const record = getDemoPurchaseReturn(id)
  if (!record || record.status !== 'draft') return record
  const next = {}
  if (payload.returnReason !== undefined) next.returnReason = payload.returnReason
  if (payload.returnDate !== undefined) next.returnDate = payload.returnDate
  if (payload.notes !== undefined) next.notes = payload.notes
  if (Array.isArray(payload.items)) {
    next.items = record.items.map((item) => {
      const patchItem = payload.items.find((row) => row.id === item.id || row.purchaseItemId === item.purchaseItemId)
      return patchItem ? { ...item, returnQty: Number(patchItem.returnQty) || 0 } : item
    })
  }
  return patch(id, next)
}

export function confirmDemoPurchaseReturn(id) {
  return patch(id, { status: 'confirmed', confirmedAt: new Date().toISOString() })
}
export function dispatchDemoPurchaseReturn(id) {
  return patch(id, { status: 'dispatched', dispatchedAt: new Date().toISOString() })
}
export function completeDemoPurchaseReturn(id) {
  return patch(id, { status: 'completed', completedAt: new Date().toISOString() })
}
export function cancelDemoPurchaseReturn(id, reason) {
  return patch(id, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason || 'Cancelled.' })
}
export function deleteDemoPurchaseReturn(id) {
  const custom = readJson(CUSTOM_KEY, [])
  writeJson(CUSTOM_KEY, custom.filter((record) => record.id !== id))
  const overrides = readJson(OVERRIDE_KEY, {})
  if (overrides[id]) {
    delete overrides[id]
    writeJson(OVERRIDE_KEY, overrides)
  }
  return { success: true }
}

// ---- Create-form support: demo purchases that have received goods to return -----------------

export function demoReturnablePurchases() {
  const returnedByPurchaseItem = {}
  getDemoPurchaseReturns().forEach((pr) => {
    if (prIsCancelled(pr)) return
    ;(pr.items || []).forEach((item) => {
      const key = `${pr.purchaseId}::${item.purchaseItemId}`
      returnedByPurchaseItem[key] = (returnedByPurchaseItem[key] || 0) + (Number(item.returnQty) || 0)
    })
  })

  return demoPurchasesResolved()
    .map((purchase) => {
      const received = cumulativeAcceptedByProduct(getDemoGrns(purchase.id))
      const grn = grnRefFor(purchase.id)
      const items = (purchase.items || [])
        .map((it) => {
          const receivedQty = Number(received[it.productId]) || 0
          const already = returnedByPurchaseItem[`${purchase.id}::${it.id}`] || 0
          return {
            purchaseItemId: it.id,
            productId: it.productId,
            productName: it.productName,
            sku: it.sku || '',
            receivedQty,
            previouslyReturned: already,
            returnableQty: Math.max(receivedQty - already, 0),
            unitPrice: it.purchasePrice ?? it.unitPrice ?? 0,
          }
        })
        .filter((line) => line.receivedQty > 0)
      return {
        id: purchase.id,
        purchaseNumber: purchase.purchaseNumber || purchase.invoiceNumber,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        warehouseId: purchase.warehouseId,
        warehouseName: purchase.warehouseName || '',
        grnId: grn.grnId,
        grnNumber: grn.grnNumber,
        items,
        hasReturnable: items.some((line) => line.returnableQty > 0),
      }
    })
    .filter((purchase) => purchase.items.length > 0)
}

function prIsCancelled(pr) {
  return String(pr.status).toLowerCase() === 'cancelled'
}

export function getDemoPurchaseReturnsForPurchase(purchaseId) {
  return getDemoPurchaseReturns().filter((pr) => pr.purchaseId === purchaseId)
}
