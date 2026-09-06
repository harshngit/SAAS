// =============================================================================
// Local-only demo layer for Delivery Collections + reconciliation.
// -----------------------------------------------------------------------------
// Explicit switch ONLY (VITE_DEMO_DATA=true) - never inferred from an empty or
// failed API, a 404, or an error. When enabled, api/deliveryCollections.js
// returns ONLY these records and simulates the whole lifecycle in localStorage;
// no real /deliveries/.../collections request is made and no demo id is sent.
//
// Every collection is anchored to a real demo delivery / order / customer
// (see features/orders/orderDemoData.js):
//   A. demo-col-a  Recorded  Cash ₹5,000   - DLV-DEMO-07 / SO-DEMO-07 / Metro Mart
//   B. demo-col-b  Recorded  UPI  ₹3,000   - DLV-DEMO-14 / SO-DEMO-14 / Green Basket Stores
//   C. demo-col-c  Reconciled Bank ₹26,381.25 - DLV-DEMO-08 / SO-DEMO-08 / Aarav Distributors
//                  -> demo CustomerPayment CP-DEMO-0007
//   D. demo-col-d  Voided    Cash ₹2,000   - DLV-DEMO-07 (2nd collection, wrong amount)
//
// DEMO LATER: a demo reconcile flips the collection to Reconciled and mints a
// demo CustomerPayment reference, but does NOT propagate into the demo invoice /
// receivable balance store (avoids cross-store coupling - spec §25). The real
// backend is authoritative for that link.
//
// TODO: remove this demo layer once the backend ships delivery collections.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'

export const COLLECTION_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoCollection(id) {
  return typeof id === 'string' && id.startsWith('demo-col-')
}

const OVERRIDE_KEY = 'saas.deliveryCollectionDemoOverride.v1'
const CUSTOM_KEY = 'saas.deliveryCollectionDemoCustom.v1'

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
    /* storage disabled - the demo change just won't survive a refresh */
  }
}

const DAY_MS = 86_400_000
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString()

const DEMO_ACTOR = { partner: { id: 'demo-dp-sunil', name: 'Sunil Yadav' }, ravi: { id: 'demo-dp-ravi', name: 'Ravi Kumar' } }
const DEMO_RECONCILER = { id: 'demo-user-accountant', name: 'Priya Menon' }

function seedCollections() {
  return [
    {
      id: 'demo-col-a',
      collectionNumber: 'COL-DEMO-0001',
      deliveryId: 'demo-dlv-delivered',
      deliveryNumber: 'DLV-DEMO-07',
      orderId: 'demo-so-delivered',
      orderNumber: 'SO-DEMO-07',
      customerId: 'demo-customer-metro',
      customerName: 'Metro Mart',
      deliveryPartnerId: DEMO_ACTOR.partner.id,
      deliveryPartnerName: DEMO_ACTOR.partner.name,
      amount: 5000,
      paymentMode: 'cash',
      reference: '',
      note: 'Collected at the shop counter.',
      status: 'recorded',
      recordedById: DEMO_ACTOR.partner.id,
      recordedByName: DEMO_ACTOR.partner.name,
      recordedAt: iso(1),
      reconciledAt: null,
      reconciledById: '',
      reconciledByName: '',
      customerPaymentId: null,
      customerPaymentNumber: '',
      invoiceId: null,
      invoiceNumber: '',
      invoiceTotal: null,
      orderTotal: 13020,
      alreadyPaid: 0,
      outstandingAtRecording: 16020,
      outstandingAmount: 16020,
      voidReason: '',
      voidedAt: null,
      voidedByName: '',
    },
    {
      id: 'demo-col-b',
      collectionNumber: 'COL-DEMO-0002',
      deliveryId: 'demo-dlv-partial',
      deliveryNumber: 'DLV-DEMO-14',
      orderId: 'demo-so-partial',
      orderNumber: 'SO-DEMO-14',
      customerId: 'demo-customer-green',
      customerName: 'Green Basket Stores',
      deliveryPartnerId: DEMO_ACTOR.partner.id,
      deliveryPartnerName: DEMO_ACTOR.partner.name,
      amount: 3000,
      paymentMode: 'upi',
      reference: 'UPI-77120453',
      note: '',
      status: 'recorded',
      recordedById: DEMO_ACTOR.partner.id,
      recordedByName: DEMO_ACTOR.partner.name,
      recordedAt: iso(2),
      reconciledAt: null,
      reconciledById: '',
      reconciledByName: '',
      customerPaymentId: null,
      customerPaymentNumber: '',
      invoiceId: null,
      invoiceNumber: '',
      invoiceTotal: null,
      orderTotal: 3517.5,
      alreadyPaid: 0,
      outstandingAtRecording: 2110.5,
      outstandingAmount: 2110.5,
      voidReason: '',
      voidedAt: null,
      voidedByName: '',
    },
    {
      id: 'demo-col-c',
      collectionNumber: 'COL-DEMO-0003',
      deliveryId: 'demo-dlv-completed',
      deliveryNumber: 'DLV-DEMO-08',
      orderId: 'demo-so-completed',
      orderNumber: 'SO-DEMO-08',
      customerId: 'demo-customer-aarav',
      customerName: 'Aarav Distributors',
      deliveryPartnerId: DEMO_ACTOR.ravi.id,
      deliveryPartnerName: DEMO_ACTOR.ravi.name,
      amount: 26381.25,
      paymentMode: 'bank_transfer',
      reference: 'NEFT-5510338',
      note: 'Full settlement on delivery.',
      status: 'reconciled',
      recordedById: DEMO_ACTOR.ravi.id,
      recordedByName: DEMO_ACTOR.ravi.name,
      recordedAt: iso(6),
      reconciledAt: iso(5),
      reconciledById: DEMO_RECONCILER.id,
      reconciledByName: DEMO_RECONCILER.name,
      customerPaymentId: 'demo-cpay-c',
      customerPaymentNumber: 'CP-DEMO-0007',
      invoiceId: 'demo-inv-completed',
      invoiceNumber: 'INV-DEMO-08',
      invoiceTotal: 26381.25,
      alreadyPaid: 26381.25,
      outstandingAtRecording: 26381.25,
      outstandingAmount: 0,
      voidReason: '',
      voidedAt: null,
      voidedByName: '',
    },
    {
      id: 'demo-col-d',
      collectionNumber: 'COL-DEMO-0004',
      deliveryId: 'demo-dlv-delivered',
      deliveryNumber: 'DLV-DEMO-07',
      orderId: 'demo-so-delivered',
      orderNumber: 'SO-DEMO-07',
      customerId: 'demo-customer-metro',
      customerName: 'Metro Mart',
      deliveryPartnerId: DEMO_ACTOR.partner.id,
      deliveryPartnerName: DEMO_ACTOR.partner.name,
      amount: 2000,
      paymentMode: 'cash',
      reference: '',
      note: '',
      status: 'voided',
      recordedById: DEMO_ACTOR.partner.id,
      recordedByName: DEMO_ACTOR.partner.name,
      recordedAt: iso(1),
      reconciledAt: null,
      reconciledById: '',
      reconciledByName: '',
      customerPaymentId: null,
      customerPaymentNumber: '',
      invoiceId: null,
      invoiceNumber: '',
      invoiceTotal: null,
      orderTotal: 13020,
      alreadyPaid: 0,
      outstandingAtRecording: 16020,
      outstandingAmount: 16020,
      voidReason: 'Amount entered incorrectly — re-recorded as ₹5,000.',
      voidedAt: iso(1),
      voidedByName: DEMO_RECONCILER.name,
    },
  ]
}

function resolved() {
  const overrides = readJson(OVERRIDE_KEY, {})
  const custom = readJson(CUSTOM_KEY, [])
  const merge = (row) => (overrides[row.id] ? { ...row, ...overrides[row.id] } : row)
  return [...custom.map(merge), ...seedCollections().map(merge)].sort(
    (a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0),
  )
}

function patch(id, partial) {
  const overrides = readJson(OVERRIDE_KEY, {})
  overrides[id] = { ...(overrides[id] || {}), ...partial }
  writeJson(OVERRIDE_KEY, overrides)
  return resolved().find((row) => row.id === id) || null
}

export function listDemoCollections(params = {}) {
  let rows = resolved()
  if (params.status && params.status !== 'all') rows = rows.filter((row) => row.status === params.status)
  if (params.search) {
    const term = String(params.search).toLowerCase()
    rows = rows.filter((row) =>
      [row.collectionNumber, row.deliveryNumber, row.orderNumber, row.customerName, row.reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }
  return { success: true, collections: rows }
}

export function listDemoCollectionsForDelivery(deliveryId) {
  return { success: true, collections: resolved().filter((row) => row.deliveryId === deliveryId) }
}

export function getDemoCollection(id) {
  return resolved().find((row) => row.id === id) || null
}

export function createDemoCollection(deliveryId, payload) {
  const custom = readJson(CUSTOM_KEY, [])
  const seq = custom.length + seedCollections().length + 1
  // Anchor to whatever demo delivery context the caller already resolved.
  const context = payload.context || {}
  const now = new Date().toISOString()
  const row = {
    id: `demo-col-${Date.now().toString(36)}`,
    collectionNumber: `COL-DEMO-${String(seq).padStart(4, '0')}`,
    deliveryId,
    deliveryNumber: context.deliveryNumber || '',
    orderId: context.orderId || null,
    orderNumber: context.orderNumber || '',
    customerId: context.customerId || '',
    customerName: context.customerName || '',
    deliveryPartnerId: context.deliveryPartnerId || DEMO_ACTOR.partner.id,
    deliveryPartnerName: context.deliveryPartnerName || DEMO_ACTOR.partner.name,
    amount: Math.max(0, Number(payload.amount) || 0),
    paymentMode: payload.paymentMode || 'cash',
    reference: (payload.reference || '').trim(),
    note: (payload.note || '').trim(),
    status: 'recorded',
    recordedById: context.deliveryPartnerId || DEMO_ACTOR.partner.id,
    recordedByName: context.deliveryPartnerName || DEMO_ACTOR.partner.name,
    recordedAt: now,
    reconciledAt: null,
    reconciledById: '',
    reconciledByName: '',
    customerPaymentId: null,
    customerPaymentNumber: '',
    invoiceId: context.invoiceId || null,
    invoiceNumber: context.invoiceNumber || '',
    invoiceTotal: context.invoiceTotal ?? null,
    orderTotal: context.orderTotal ?? null,
    alreadyPaid: context.alreadyPaid ?? null,
    // Snapshot the outstanding balance at the moment of recording - it will not move even
    // after this collection is later reconciled.
    outstandingAtRecording: context.outstandingAmount ?? null,
    outstandingAmount: context.outstandingAmount ?? null,
    voidReason: '',
    voidedAt: null,
    voidedByName: '',
  }
  writeJson(CUSTOM_KEY, [row, ...custom])
  return { success: true, collection: row }
}

export function reconcileDemoCollection(id) {
  const row = getDemoCollection(id)
  if (!row) return { success: false, error: 'Collection not found.' }
  if (row.status === 'reconciled') return { success: false, error: 'This collection has already been reconciled.' }
  if (row.status === 'voided') return { success: false, error: 'A voided collection cannot be reconciled.' }
  const now = new Date().toISOString()
  const seq = 7 + resolved().filter((r) => r.status === 'reconciled').length
  return {
    success: true,
    collection: patch(id, {
      status: 'reconciled',
      reconciledAt: now,
      reconciledById: DEMO_RECONCILER.id,
      reconciledByName: DEMO_RECONCILER.name,
      customerPaymentId: `demo-cpay-${id}`,
      customerPaymentNumber: `CP-DEMO-${String(seq).padStart(4, '0')}`,
    }),
  }
}

export function voidDemoCollection(id, reason) {
  const row = getDemoCollection(id)
  if (!row) return { success: false, error: 'Collection not found.' }
  if (row.status === 'reconciled') {
    return { success: false, error: 'A reconciled collection cannot be voided from here — it already produced a customer payment.' }
  }
  if (row.status === 'voided') return { success: false, error: 'This collection is already voided.' }
  return {
    success: true,
    collection: patch(id, {
      status: 'voided',
      voidReason: (reason || '').trim() || 'Voided.',
      voidedAt: new Date().toISOString(),
      voidedByName: DEMO_RECONCILER.name,
    }),
  }
}
