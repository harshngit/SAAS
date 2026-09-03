// Local-only demo layer for End of Day Return. Mirrors the expected normalized frontend
// contract so a backend developer can read the shapes later. NEVER calls an API.
//
// A demo return record:
//   {
//     id, sessionId, date, vehicleNumber, vehicleType, deliveryPartnerName, warehouseName,
//     status: 'submitted' | 'verified',
//     submittedAt, submittedBy,
//     totals: { loaded, delivered, expected, physical, goodReturn, damaged, shortage, excess, varianceCount },
//     lines: [{
//       productId, productName, sku, variantId, uom,
//       loadedQuantity, deliveredQuantity, expectedRemaining,
//       physicalCount, goodReturn, damaged, shortage, excess,
//       reason, status
//     }]
//   }

import { demoVehicleSessionResolved } from '../orders/orderDemoData'

const SUBMIT_KEY = 'saas.eodReturnDemo.v1'

export function isDemoSession(session) {
  return Boolean(session?.isDemo) || session?.id === 'demo-vss-1'
}

const lineStatus = (physical, expected, damaged) => {
  if (damaged > 0 && physical === expected) return 'damaged'
  if (physical < expected) return 'shortage'
  if (physical > expected) return 'excess'
  return damaged > 0 ? 'damaged' : 'matched'
}

// Good Return = stock that can safely go back to the warehouse. It is CAPPED at the
// expected remaining quantity: any Excess (physical > expected) is an unverified variance
// for the back office to reconcile - it is never posted as normal returned stock.
export function goodReturnOf(line) {
  const usable = (line.physicalCount || 0) - (line.damaged || 0)
  return Math.max(Math.min(line.expectedRemaining || 0, usable), 0)
}

export function rollupTotals(lines) {
  return lines.reduce(
    (acc, l) => {
      const shortage = Math.max((l.expectedRemaining || 0) - (l.physicalCount || 0), 0)
      const excess = Math.max((l.physicalCount || 0) - (l.expectedRemaining || 0), 0)
      // Real reconciliation rows carry the backend-posted returned qty - trust it; otherwise derive.
      const good = Number.isFinite(l.goodReturn) ? l.goodReturn : goodReturnOf(l)
      return {
        loaded: acc.loaded + (l.loadedQuantity || 0),
        delivered: acc.delivered + (l.deliveredQuantity || 0),
        expected: acc.expected + (l.expectedRemaining || 0),
        physical: acc.physical + (l.physicalCount || 0),
        goodReturn: acc.goodReturn + good,
        damaged: acc.damaged + (l.damaged || 0),
        shortage: acc.shortage + shortage,
        excess: acc.excess + excess,
        varianceCount: acc.varianceCount + (shortage > 0 || excess > 0 ? 1 : 0),
      }
    },
    { loaded: 0, delivered: 0, expected: 0, physical: 0, goodReturn: 0, damaged: 0, shortage: 0, excess: 0, varianceCount: 0 },
  )
}

// The editable "today" draft, seeded from the shared demo vehicle session. Pre-fills a
// realistic mixed scenario (matched / damaged / shortage / excess) so every badge and
// validation path is visible out of the box - the partner can still edit every field.
export function buildDemoEodDraft() {
  const session = demoVehicleSessionResolved()
  const seed = {
    'demo-p-rice': { physicalCount: null, damaged: 0 }, // matched (physical defaults to expected)
    'demo-p-oil': { physicalCount: null, damaged: 2, reason: 'Packaging damaged' }, // damaged
    'demo-p-sugar': { physicalCount: 1, reason: 'Count mismatch / unaccounted' }, // shortage 1
    'demo-p-flour': { physicalCount: 1, reason: 'Loading count mismatch' }, // excess +1 (expected 0)
  }

  const lines = session.items.map((it) => {
    const expectedRemaining = Number(it.remainingQuantity) || 0
    const s = seed[it.productId] || {}
    const physicalCount = s.physicalCount == null ? expectedRemaining : s.physicalCount
    return {
      productId: it.productId,
      productName: it.productName,
      sku: it.sku || '',
      variantId: it.variantId || '',
      uom: it.uom || 'unit',
      loadedQuantity: (it.loadedQuantity || 0) + (it.extraQuantity || 0),
      deliveredQuantity: it.deliveredQuantity || 0,
      expectedRemaining,
      physicalCount,
      damaged: s.damaged || 0,
      reason: s.reason || '',
    }
  })

  return { session, lines }
}

// ---- Submitted-today store (localStorage, demo-only) ----------------------------------
function readSubmits() {
  try {
    return JSON.parse(window.localStorage.getItem(SUBMIT_KEY)) || {}
  } catch {
    return {}
  }
}
function writeSubmits(value) {
  try {
    window.localStorage.setItem(SUBMIT_KEY, JSON.stringify(value))
  } catch {
    /* storage disabled - the demo submit just won't survive a refresh */
  }
}

export function getDemoEodSubmission(sessionId) {
  return readSubmits()[sessionId] || null
}

export function simulateDemoEodSubmit(sessionId, { lines, submittedBy }) {
  const session = demoVehicleSessionResolved()
  const finalLines = lines.map((l) => ({
    ...l,
    goodReturn: goodReturnOf(l),
    shortage: Math.max((l.expectedRemaining || 0) - (l.physicalCount || 0), 0),
    excess: Math.max((l.physicalCount || 0) - (l.expectedRemaining || 0), 0),
    status: lineStatus(l.physicalCount || 0, l.expectedRemaining || 0, l.damaged || 0),
  }))
  const record = {
    id: `demo-eod-${Date.now().toString(36)}`,
    sessionId,
    date: session.date,
    vehicleNumber: session.vehicleNumber,
    vehicleType: session.vehicleType,
    deliveryPartnerName: session.deliveryPartnerName,
    warehouseName: session.warehouseName,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    submittedBy: submittedBy || session.deliveryPartnerName,
    totals: rollupTotals(finalLines),
    lines: finalLines,
  }
  const map = readSubmits()
  map[sessionId] = record
  writeSubmits(map)
  return record
}

// ---- Historical demo records (read-only) ----------------------------------------------
const DAY_MS = 86_400_000
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS).toISOString()

function historyRecord({ id, day, statusValue, rows }) {
  const lines = rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    sku: r.sku || '',
    variantId: '',
    uom: r.uom || 'bag',
    loadedQuantity: r.loaded,
    deliveredQuantity: r.delivered,
    expectedRemaining: r.expected,
    physicalCount: r.physical,
    damaged: r.damaged || 0,
    reason: [r.damageReason, r.varianceReason].filter(Boolean).join(' · '),
    goodReturn: goodReturnOf({ expectedRemaining: r.expected, physicalCount: r.physical, damaged: r.damaged || 0 }),
    shortage: Math.max(r.expected - r.physical, 0),
    excess: Math.max(r.physical - r.expected, 0),
    status: lineStatus(r.physical, r.expected, r.damaged || 0),
  }))
  return {
    id,
    sessionId: `demo-vss-${id}`,
    date: daysAgo(day),
    vehicleNumber: 'MH-12-AB-4521',
    vehicleType: 'Tempo',
    deliveryPartnerName: 'Ravi Kumar',
    warehouseName: 'Main Warehouse',
    status: statusValue,
    submittedAt: daysAgo(day),
    submittedBy: 'Ravi Kumar',
    totals: rollupTotals(lines),
    lines,
  }
}

const STATIC_HISTORY = [
  // 1. Exact match - everything counted back clean.
  historyRecord({
    id: 'h1', day: 6, statusValue: 'verified',
    rows: [
      { productId: 'demo-p-rice', productName: 'Rice 10kg', sku: 'RICE-10KG', loaded: 18, delivered: 12, expected: 6, physical: 6 },
      { productId: 'demo-p-oil', productName: 'Sunflower Oil 1L', sku: 'OIL-1L', uom: 'bottle', loaded: 10, delivered: 10, expected: 0, physical: 0 },
    ],
  }),
  // 2. Damaged + shortage.
  historyRecord({
    id: 'h2', day: 4, statusValue: 'verified',
    rows: [
      { productId: 'demo-p-flour', productName: 'Wheat Flour 5kg', sku: 'FLOUR-5KG', loaded: 20, delivered: 14, expected: 6, physical: 6, damaged: 1, damageReason: 'Leakage' },
      { productId: 'demo-p-sugar', productName: 'Sugar 5kg', sku: 'SUGAR-5KG', loaded: 12, delivered: 8, expected: 4, physical: 3, varianceReason: 'Lost in transit' },
    ],
  }),
  // 3. Mixed variance - match, damage, shortage and excess on one return.
  historyRecord({
    id: 'h3', day: 2, statusValue: 'submitted',
    rows: [
      { productId: 'demo-p-rice', productName: 'Rice 10kg', sku: 'RICE-10KG', loaded: 24, delivered: 12, expected: 12, physical: 12 },
      { productId: 'demo-p-oil', productName: 'Sunflower Oil 1L', sku: 'OIL-1L', uom: 'bottle', loaded: 15, delivered: 8, expected: 7, physical: 6, damaged: 2, damageReason: 'Broken', varianceReason: 'Count mismatch' },
      { productId: 'demo-p-sugar', productName: 'Sugar 5kg', sku: 'SUGAR-5KG', loaded: 10, delivered: 6, expected: 4, physical: 5, varianceReason: 'Unrecorded return' },
    ],
  }),
]

export function demoEodHistoryResolved() {
  const submittedToday = readSubmits()
  const dynamic = Object.values(submittedToday)
  return [...dynamic, ...STATIC_HISTORY].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function getDemoEodRecord(id) {
  return demoEodHistoryResolved().find((r) => r.id === id) || null
}
