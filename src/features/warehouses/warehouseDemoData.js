// =============================================================================
// FRONTEND DEMO WAREHOUSES - UI TESTING ONLY
// -----------------------------------------------------------------------------
// The single demo source for warehouse stock. Stock per warehouse =
//   seed rows (below)  +  accepted quantity from every demo Goods Receipt (GRN)
//                         whose warehouseId matches.
// Damaged / rejected GRN quantity is NOT added (GRN lines already expose only
// acceptedQty = receivingNow - damaged - rejected).
//
// Warehouse ids reuse the demo purchase/GRN warehouse ids (demo-wh-main /
// demo-wh-central) so GRN-accepted stock lands in the right place. Pune is a
// separate inactive warehouse.
//
// Transfers are recorded locally as Draft records only - no stock transaction is
// simulated (that is BACKEND LATER). Real warehouses/stock use the live API.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { safeNumber } from '../purchases/purchaseHelpers'
import { demoPurchases } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import { isLowStock } from './warehouseHelpers'

export const WAREHOUSES_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoWarehouse(id) {
  return typeof id === 'string' && id.startsWith('demo-wh-')
}

const DEMO_WAREHOUSES = [
  {
    id: 'demo-wh-main',
    name: 'Central Mumbai Warehouse',
    code: 'WH-MUM-001',
    address: 'Unit 4, Kurla Industrial Estate, Kurla West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400070',
    country: 'India',
    managerName: 'Sameer Kulkarni',
    contactNumber: '+91 98200 55001',
    email: 'mumbai.wh@demo.example',
    notes: 'Primary hub - receives most goods receipts.',
    isActive: true,
    isDefault: true,
    createdAt: '2026-01-05T09:00:00.000Z',
    updatedAt: '2026-08-25T10:00:00.000Z',
  },
  {
    id: 'demo-wh-central',
    name: 'Navi Mumbai Warehouse',
    code: 'WH-NAV-001',
    address: 'Plot 22, TTC Industrial Area, Mahape',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pinCode: '400710',
    country: 'India',
    managerName: 'Farah Sheikh',
    contactNumber: '+91 98200 55002',
    email: 'navimumbai.wh@demo.example',
    notes: 'Beverage overflow storage.',
    isActive: true,
    isDefault: false,
    createdAt: '2026-02-10T09:00:00.000Z',
    updatedAt: '2026-08-22T11:30:00.000Z',
  },
  {
    id: 'demo-wh-pune',
    name: 'Pune Warehouse',
    code: 'WH-PUN-001',
    address: 'Gala 7, Bhosari MIDC',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411026',
    country: 'India',
    managerName: 'Rohan Deshpande',
    contactNumber: '+91 98200 55003',
    email: 'pune.wh@demo.example',
    notes: 'Temporarily closed for renovation.',
    isActive: false,
    isDefault: false,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
]

// ---- local override / custom layer (same pattern as the other demo modules) ----
const OVERRIDE_KEY = 'saas.warehouseDemoOverride.v1'
const CUSTOM_KEY = 'saas.warehouseDemoCustom.v1'

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

export function patchDemoWarehouse(id, partial) {
  if (!isDemoWarehouse(id)) return
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, map)
}

export function createDemoWarehouse(data) {
  const list = readCustom()
  const now = new Date().toISOString()
  const record = {
    id: `demo-wh-custom-${Date.now().toString(36)}`,
    isActive: true,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  writeJson(CUSTOM_KEY, [...list, record])
  return record
}

function stockRow(raw) {
  return {
    productId: raw.productId,
    productName: raw.productName,
    sku: raw.sku,
    category: raw.category || 'General',
    onHand: raw.onHand,
    reserved: raw.reserved || 0,
    reorderLevel: raw.reorderLevel || 0,
  }
}

const SEED_STOCK = {
  'demo-wh-main': [
    stockRow({ productId: 'demo-p-rice', productName: 'Rice 25kg', sku: 'RICE-25', category: 'Grocery', onHand: 100, reserved: 20, reorderLevel: 20 }),
    stockRow({ productId: 'demo-p-oil', productName: 'Sunflower Oil 1L', sku: 'OIL-SF-1L', category: 'Grocery', onHand: 18, reserved: 8, reorderLevel: 12 }),
    stockRow({ productId: 'demo-p-flour', productName: 'Wheat Flour 10kg', sku: 'FLOUR-10', category: 'Grocery', onHand: 0, reserved: 0, reorderLevel: 8 }),
  ],
  'demo-wh-central': [
    stockRow({ productId: 'demo-p-sugar', productName: 'Sugar 50kg', sku: 'SUGAR-50', category: 'Grocery', onHand: 40, reserved: 5, reorderLevel: 10 }),
  ],
  'demo-wh-pune': [],
}

// Every demo GRN, flattened, tagged with its warehouse.
function allDemoGrnLines() {
  const lines = []
  demoPurchases.forEach((purchase) => {
    getDemoGrns(purchase.id).forEach((grn) => {
      ;(grn.lines || []).forEach((line) => {
        lines.push({
          warehouseId: grn.warehouseId,
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          acceptedQty: safeNumber(line.acceptedQty),
        })
      })
    })
  })
  return lines
}

// Seed rows + GRN-accepted layer, merged by productId.
export function getDemoWarehouseStock(warehouseId) {
  const byProduct = new Map()
  ;(SEED_STOCK[warehouseId] || []).forEach((row) => byProduct.set(row.productId, { ...row }))

  allDemoGrnLines()
    .filter((line) => line.warehouseId === warehouseId && line.acceptedQty > 0)
    .forEach((line) => {
      const existing = byProduct.get(line.productId)
      if (existing) {
        existing.onHand += line.acceptedQty
      } else {
        byProduct.set(
          line.productId,
          stockRow({
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            category: 'General',
            onHand: line.acceptedQty,
            reserved: 0,
            reorderLevel: 0,
          }),
        )
      }
    })

  return [...byProduct.values()]
}

export function getDemoWarehouses() {
  const overrides = readOverrides()
  const base = [...DEMO_WAREHOUSES, ...readCustom()].map((warehouse) =>
    overrides[warehouse.id] ? { ...warehouse, ...overrides[warehouse.id] } : warehouse,
  )
  return base.map((warehouse) => {
    const stock = getDemoWarehouseStock(warehouse.id)
    return {
      ...warehouse,
      productCount: stock.length,
      stockUnits: stock.reduce((sum, row) => sum + safeNumber(row.onHand), 0),
      lowStockCount: stock.filter(isLowStock).length,
    }
  })
}

export function getDemoWarehouse(id) {
  return getDemoWarehouses().find((warehouse) => warehouse.id === id) || null
}

// Demo movement history - derived from GRNs (Goods Received) plus a couple of illustrative rows.
export function getDemoWarehouseMovements(warehouseId) {
  const movements = []
  demoPurchases.forEach((purchase) => {
    getDemoGrns(purchase.id)
      .filter((grn) => grn.warehouseId === warehouseId)
      .forEach((grn) => {
        ;(grn.lines || []).forEach((line, index) => {
          if (safeNumber(line.acceptedQty) <= 0) return
          movements.push({
            id: `${grn.id}-${index}`,
            date: grn.receiptDate,
            productName: line.productName,
            type: 'goods_received',
            quantity: safeNumber(line.acceptedQty),
            reference: grn.grnNumber,
            fromTo: `${grn.supplierName} → ${grn.warehouseName || 'Warehouse'}`,
            performedBy: grn.receivedBy || '—',
          })
        })
      })
  })

  if (warehouseId === 'demo-wh-main') {
    movements.push(
      { id: 'demo-mv-res-1', date: '2026-08-26', productName: 'Rice 25kg', type: 'reservation', quantity: 20, reference: 'SO-2026-014', fromTo: 'Order reservation', performedBy: 'Rahul Sharma' },
      { id: 'demo-mv-res-2', date: '2026-08-27', productName: 'Sunflower Oil 1L', type: 'reservation', quantity: 8, reference: 'SO-2026-018', fromTo: 'Order reservation', performedBy: 'Rahul Sharma' },
      { id: 'demo-mv-adj-1', date: '2026-08-30', productName: 'Wheat Flour 10kg', type: 'adjustment', quantity: -4, reference: 'STK-ADJ-07', fromTo: 'Stock take correction', performedBy: 'Sameer Kulkarni' },
    )
  }

  return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// ---- transfers (local, Draft records only) --------------------------------

const TRANSFER_KEY = 'saas.warehouseTransferDemo.v1'

const SEED_TRANSFERS = [
  {
    id: 'demo-wt-001',
    transferNumber: 'WT-2026-001',
    date: '2026-08-24',
    fromWarehouseId: 'demo-wh-main',
    fromWarehouseName: 'Central Mumbai Warehouse',
    toWarehouseId: 'demo-wh-central',
    toWarehouseName: 'Navi Mumbai Warehouse',
    status: 'draft',
    items: [{ productId: 'demo-p-rice', productName: 'Rice 25kg', quantity: 15 }],
  },
]

function readTransfers() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRANSFER_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeTransfers(list) {
  try {
    window.localStorage.setItem(TRANSFER_KEY, JSON.stringify(list))
  } catch {
    /* storage disabled - demo transfers just won't persist across refresh */
  }
}

export function getDemoTransfers(warehouseId) {
  const all = [...SEED_TRANSFERS, ...readTransfers()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  if (!warehouseId) return all
  return all.filter((transfer) => transfer.fromWarehouseId === warehouseId || transfer.toWarehouseId === warehouseId)
}

export function nextTransferNumber() {
  const year = new Date().getFullYear()
  const maxSeq = getDemoTransfers().reduce((max, transfer) => {
    const match = /WT-\d{4}-(\d+)/.exec(transfer.transferNumber || '')
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `WT-${year}-${String(maxSeq + 1).padStart(3, '0')}`
}

export function createDemoTransfer({ fromWarehouseId, fromWarehouseName, toWarehouseId, toWarehouseName, date, items }) {
  const record = {
    id: `demo-wt-${Date.now().toString(36)}`,
    transferNumber: nextTransferNumber(),
    date,
    fromWarehouseId,
    fromWarehouseName,
    toWarehouseId,
    toWarehouseName,
    status: 'draft',
    items: (items || [])
      .filter((item) => safeNumber(item.quantity) > 0)
      .map((item) => ({ productId: item.productId, productName: item.productName, quantity: safeNumber(item.quantity) })),
    createdAt: new Date().toISOString(),
  }
  writeTransfers([...readTransfers(), record])
  return record
}
