// =============================================================================
// Local-only demo layer for Cash Reconciliation.
// -----------------------------------------------------------------------------
// Explicit switch ONLY (VITE_DEMO_DATA=true). When enabled, api/cashReconciliation.js's
// demo branches return ONLY this data and simulate create/update/close in localStorage -
// no real API is called and no demo id is ever sent to the backend.
//
// Every function here returns data already in the app's canonical (camelCase) Cash
// Reconciliation shape - the same shape api/cashReconciliation.js's normalizeCashReconciliation
// produces from the real backend - so CashReconciliation.jsx never needs to know whether it's
// looking at demo or real data.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { toLocalDateString } from '../../utils/format'

export const CASH_RECON_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

const SESSIONS_KEY = 'saas.cashReconDemoSessions.v1'

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
    /* storage disabled - the demo draft just won't survive a refresh */
  }
}

const DAY_MS = 86_400_000
// Business date-only fields use the LOCAL calendar date (never toISOString - shifts a day in IST).
const dateOnly = (daysAgo) => toLocalDateString(new Date(Date.now() - daysAgo * DAY_MS))
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString()
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const DEMO_CLOSER = { id: 'demo-user-accountant', name: 'Priya Menon', email: 'priya.menon@demo.local' }

function buildDetails(methodRows) {
  return methodRows.map(([paymentMethod, expectedAmount, actualAmount]) => ({
    id: `${paymentMethod}-detail`,
    paymentMethod,
    expectedAmount,
    actualAmount,
    varianceAmount: round2(actualAmount - expectedAmount),
    notes: '',
  }))
}

// Builds one full canonical-shape record - totals derived from the method rows + cash-closing
// inputs so nothing can drift between the two.
function buildReconciliation({
  id, reconciliationDate, methodRows, openingBalance, cashSales, cashReceived, cashPaid, expensesPaid,
  actualCashOnHand, status = 'closed', varianceReason = '', notes = '', closedDaysAgo = 0, createdDaysAgo = 0,
}) {
  const details = buildDetails(methodRows)
  const totalExpectedCollections = round2(details.reduce((sum, row) => sum + row.expectedAmount, 0))
  const totalActualCollections = round2(details.reduce((sum, row) => sum + row.actualAmount, 0))
  const expectedClosingCash = round2(openingBalance + cashSales + cashReceived - cashPaid - expensesPaid)
  return {
    id,
    organizationId: 'demo-org',
    reconciliationDate,
    status,
    totalExpectedCollections,
    totalActualCollections,
    collectionsVariance: round2(totalActualCollections - totalExpectedCollections),
    openingBalance,
    cashSales,
    cashReceived,
    cashPaid,
    expensesPaid,
    expectedClosingCash,
    actualCashOnHand,
    cashBalanceVariance: round2(actualCashOnHand - expectedClosingCash),
    varianceReason,
    notes,
    createdById: DEMO_CLOSER.id,
    closedById: status === 'closed' ? DEMO_CLOSER.id : null,
    createdBy: DEMO_CLOSER,
    closedBy: status === 'closed' ? DEMO_CLOSER : null,
    closedAt: status === 'closed' ? iso(closedDaysAgo) : null,
    createdAt: iso(createdDaysAgo),
    updatedAt: iso(closedDaysAgo),
    details,
  }
}

function seedReconciliations() {
  return [
    buildReconciliation({
      id: 'demo-recon-a', reconciliationDate: dateOnly(3), closedDaysAgo: 3, createdDaysAgo: 3,
      methodRows: [['cash', 18000, 18000], ['upi', 9000, 9000], ['card', 3000, 3000]],
      openingBalance: 5000, cashSales: 18000, cashReceived: 0, cashPaid: 0, expensesPaid: 2000,
      actualCashOnHand: 21000, notes: 'End-of-day close - all modes balanced.',
    }),
    buildReconciliation({
      id: 'demo-recon-b', reconciliationDate: dateOnly(2), closedDaysAgo: 2, createdDaysAgo: 2,
      methodRows: [['cash', 14000, 13500], ['upi', 5000, 5000], ['card', 1000, 1000]],
      openingBalance: 5000, cashSales: 14000, cashReceived: 0, cashPaid: 0, expensesPaid: 1500,
      actualCashOnHand: 17000, varianceReason: 'Cash shortage',
      notes: '₹500 short in the cash drawer - counted twice, still short.',
    }),
    buildReconciliation({
      id: 'demo-recon-c', reconciliationDate: dateOnly(1), closedDaysAgo: 1, createdDaysAgo: 1,
      methodRows: [['cash', 10000, 10200], ['upi', 4000, 4000], ['card', 1000, 1000]],
      openingBalance: 5000, cashSales: 10000, cashReceived: 0, cashPaid: 0, expensesPaid: 1000,
      actualCashOnHand: 14200, varianceReason: 'Rounding', notes: 'Small change rounding across the day.',
    }),
  ]
}

function resolved() {
  const custom = readJson(SESSIONS_KEY, [])
  return [...custom, ...seedReconciliations()].sort(
    (a, b) => new Date(b.reconciliationDate || 0) - new Date(a.reconciliationDate || 0),
  )
}

function findByDate(date) {
  return resolved().find((row) => row.reconciliationDate === date) || null
}

// A coherent "today" (or any not-yet-reconciled date) preview - what a brand new draft for this
// date would look like before anything is saved.
function previewForDate(date) {
  const methodRows = [['cash', 12400, 0], ['upi', 6000, 0], ['card', 1600, 0]]
  const details = buildDetails(methodRows).map((row) => ({ ...row, actualAmount: 0, varianceAmount: -row.expectedAmount }))
  return {
    reconciliationDate: date,
    totalExpectedCollections: round2(details.reduce((sum, row) => sum + row.expectedAmount, 0)),
    details,
    openingBalance: 5000,
    cashSales: 12400,
    cashReceived: 0,
    cashPaid: 0,
    expensesPaid: 900,
    expectedClosingCash: round2(5000 + 12400 - 900),
  }
}

export async function demoCashReconciliationPreview(date) {
  return { success: true, preview: previewForDate(date) }
}

export async function demoCashReconciliationForDate(date) {
  return { success: true, reconciliation: findByDate(date) }
}

export async function listDemoCashReconciliations(params = {}) {
  let rows = resolved()
  if (params.status) rows = rows.filter((row) => row.status === params.status)
  if (params.date_from) rows = rows.filter((row) => row.reconciliationDate >= params.date_from)
  if (params.date_to) rows = rows.filter((row) => row.reconciliationDate <= params.date_to)
  return { success: true, reconciliations: rows, total: rows.length, page: 1, pageSize: rows.length, totalPages: 1 }
}

export async function getDemoCashReconciliation(id) {
  const record = resolved().find((row) => row.id === id)
  return record ? { success: true, reconciliation: record } : { success: false, error: 'Reconciliation not found.' }
}

function upsertCustom(record) {
  const custom = readJson(SESSIONS_KEY, []).filter((row) => row.id !== record.id && row.reconciliationDate !== record.reconciliationDate)
  writeJson(SESSIONS_KEY, [record, ...custom])
}

export async function createDemoCashReconciliation(payload) {
  if (findByDate(payload.reconciliationDate)) {
    return { success: false, error: 'A reconciliation already exists for this date.', status: 409 }
  }
  const preview = previewForDate(payload.reconciliationDate)
  const actualsByMethod = new Map((payload.details || []).map((row) => [row.paymentMethod, Number(row.actualAmount) || 0]))
  const methodRows = preview.details.map((row) => [row.paymentMethod, row.expectedAmount, actualsByMethod.get(row.paymentMethod) ?? 0])
  const record = buildReconciliation({
    id: `demo-recon-${Date.now().toString(36)}`,
    reconciliationDate: payload.reconciliationDate,
    methodRows,
    openingBalance: Number(payload.openingBalance) || 0,
    cashSales: preview.cashSales,
    cashReceived: preview.cashReceived,
    cashPaid: preview.cashPaid,
    expensesPaid: preview.expensesPaid,
    actualCashOnHand: Number(payload.actualCashOnHand) || 0,
    status: 'draft',
    varianceReason: payload.varianceReason || '',
    notes: payload.notes || '',
    closedDaysAgo: 0,
    createdDaysAgo: 0,
  })
  upsertCustom(record)
  return { success: true, reconciliation: record }
}

export async function updateDemoCashReconciliation(id, payload) {
  const existing = resolved().find((row) => row.id === id)
  if (!existing) return { success: false, error: 'Reconciliation not found.' }
  if (existing.status === 'closed') return { success: false, error: 'This reconciliation is already closed.' }

  const actualsByMethod = new Map((payload.details || []).map((row) => [row.paymentMethod, Number(row.actualAmount) || 0]))
  const methodRows = existing.details.map((row) => [row.paymentMethod, row.expectedAmount, actualsByMethod.get(row.paymentMethod) ?? row.actualAmount])
  const record = buildReconciliation({
    id: existing.id,
    reconciliationDate: existing.reconciliationDate,
    methodRows,
    openingBalance: payload.openingBalance ?? existing.openingBalance,
    cashSales: existing.cashSales,
    cashReceived: existing.cashReceived,
    cashPaid: existing.cashPaid,
    expensesPaid: existing.expensesPaid,
    actualCashOnHand: payload.actualCashOnHand ?? existing.actualCashOnHand,
    status: 'draft',
    varianceReason: payload.varianceReason ?? existing.varianceReason,
    notes: payload.notes ?? existing.notes,
    closedDaysAgo: 0,
    createdDaysAgo: 0,
  })
  record.createdAt = existing.createdAt
  upsertCustom(record)
  return { success: true, reconciliation: record }
}

export async function closeDemoCashReconciliation(id, payload = {}) {
  const existing = resolved().find((row) => row.id === id)
  if (!existing) return { success: false, error: 'Reconciliation not found.' }
  if (existing.status === 'closed') return { success: false, error: 'This reconciliation is already closed.' }

  const hasVariance = Math.abs(existing.collectionsVariance) >= 0.005 || Math.abs(existing.cashBalanceVariance) >= 0.005
  const reason = payload.varianceReason ?? existing.varianceReason
  if (hasVariance && !reason) {
    return { success: false, error: 'A variance reason is required before closing this reconciliation.' }
  }

  const record = {
    ...existing,
    openingBalance: payload.openingBalance ?? existing.openingBalance,
    actualCashOnHand: payload.actualCashOnHand ?? existing.actualCashOnHand,
    varianceReason: reason,
    notes: payload.notes ?? existing.notes,
    status: 'closed',
    closedById: DEMO_CLOSER.id,
    closedBy: DEMO_CLOSER,
    closedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  record.cashBalanceVariance = round2(record.actualCashOnHand - record.expectedClosingCash)
  upsertCustom(record)
  return { success: true, reconciliation: record }
}

export async function deleteDemoCashReconciliation(id) {
  const custom = readJson(SESSIONS_KEY, [])
  const existing = custom.find((row) => row.id === id)
  if (!existing) return { success: false, error: 'Only drafts created in this demo session can be deleted.' }
  writeJson(SESSIONS_KEY, custom.filter((row) => row.id !== id))
  return { success: true }
}
