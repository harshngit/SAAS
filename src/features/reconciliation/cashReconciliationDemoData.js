// =============================================================================
// Local-only demo layer for Cash Reconciliation (broader Finance day-close).
// -----------------------------------------------------------------------------
// Explicit switch ONLY (VITE_DEMO_DATA=true). When enabled, api/cashReconciliation.js
// returns ONLY this data and simulates the reconcile action in localStorage - no real
// API is called and no demo id is ever sent to the backend.
//
// This is a small self-contained fixture (not wired into the other demo stores) to
// avoid cross-store coupling / circular imports. Values are coherent kirana-scale days.
//
// A. Balanced   Expected ₹30,000  Actual ₹30,000  Variance ₹0
// B. Short Cash  Expected ₹20,000  Actual ₹19,500  Variance -₹500
// C. Excess      Expected ₹15,000  Actual ₹15,200  Variance +₹200
//
// TODO: remove once the backend ships a persisted reconciliation-session endpoint.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { toLocalDateString } from '../../utils/format'

export const CASH_RECON_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoReconciliation(id) {
  return typeof id === 'string' && id.startsWith('demo-recon-')
}

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
    /* storage disabled - the demo session just won't survive a refresh */
  }
}

const DAY_MS = 86_400_000
// Business date-only fields use the LOCAL calendar date (never toISOString - shifts a day in IST).
const dateOnly = (daysAgo) => toLocalDateString(new Date(Date.now() - daysAgo * DAY_MS))
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString()

const DEMO_RECONCILER = { id: 'demo-user-accountant', name: 'Priya Menon' }

function breakdown(rows) {
  return rows.map(([mode, expected, actual]) => ({ mode, expected, actual, variance: Math.round((actual - expected) * 100) / 100 }))
}

// One line per breakdown row; totals derived so nothing can drift.
function session({ id, number, date, rows, reason, notes, status = 'reconciled' }) {
  const modes = breakdown(rows)
  const expectedTotal = modes.reduce((sum, row) => sum + row.expected, 0)
  const actualTotal = modes.reduce((sum, row) => sum + row.actual, 0)
  return {
    id,
    sessionNumber: number,
    date,
    modes,
    expectedTotal,
    actualTotal,
    variance: Math.round((actualTotal - expectedTotal) * 100) / 100,
    status,
    varianceReason: reason || '',
    notes: notes || '',
    reconciledById: status === 'reconciled' ? DEMO_RECONCILER.id : '',
    reconciledByName: status === 'reconciled' ? DEMO_RECONCILER.name : '',
    reconciledAt: status === 'reconciled' ? iso(0) : null,
    createdAt: iso(0),
  }
}

function seedSessions() {
  return [
    session({
      id: 'demo-recon-a', number: 'CR-DEMO-0001', date: dateOnly(3),
      rows: [['Cash', 18000, 18000], ['UPI', 9000, 9000], ['Card', 3000, 3000]],
      notes: 'End-of-day close — all modes balanced.',
    }),
    session({
      id: 'demo-recon-b', number: 'CR-DEMO-0002', date: dateOnly(2),
      rows: [['Cash', 14000, 13500], ['UPI', 5000, 5000], ['Card', 1000, 1000]],
      reason: 'Cash shortage', notes: '₹500 short in the cash drawer — counted twice, still short.',
    }),
    session({
      id: 'demo-recon-c', number: 'CR-DEMO-0003', date: dateOnly(1),
      rows: [['Cash', 10000, 10200], ['UPI', 4000, 4000], ['Card', 1000, 1000]],
      reason: 'Rounding', notes: 'Small change rounding across the day.',
    }),
  ]
}

function resolved() {
  const custom = readJson(SESSIONS_KEY, [])
  return [...custom, ...seedSessions()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
}

export function listDemoReconciliations() {
  return { success: true, sessions: resolved() }
}

export function getDemoReconciliation(id) {
  return resolved().find((row) => row.id === id) || null
}

// A coherent "today" (or any un-reconciled date) expected breakdown. If the date already has
// a reconciled session, return that session's expected figures instead.
export function demoExpectedForDate(date) {
  const existing = resolved().find((row) => row.date === date)
  if (existing) {
    return {
      success: true,
      date,
      byMode: existing.modes.map((row) => ({ mode: row.mode, expected: row.expected })),
      total: existing.expectedTotal,
      reconciledSession: existing,
      source: 'demo',
    }
  }
  const byMode = [
    { mode: 'Cash', expected: 12400 },
    { mode: 'UPI', expected: 6000 },
    { mode: 'Card', expected: 1600 },
  ]
  return { success: true, date, byMode, total: byMode.reduce((sum, row) => sum + row.expected, 0), reconciledSession: null, source: 'demo' }
}

export function saveDemoReconciliation(payload) {
  const custom = readJson(SESSIONS_KEY, [])
  const seq = custom.length + seedSessions().length + 1
  const modes = (payload.modes || []).map((row) => ({
    mode: row.mode,
    expected: Number(row.expected) || 0,
    actual: Number(row.actual) || 0,
    variance: Math.round(((Number(row.actual) || 0) - (Number(row.expected) || 0)) * 100) / 100,
  }))
  const expectedTotal = modes.reduce((sum, row) => sum + row.expected, 0)
  const actualTotal = modes.reduce((sum, row) => sum + row.actual, 0)
  const now = new Date().toISOString()
  const row = {
    id: `demo-recon-${Date.now().toString(36)}`,
    sessionNumber: `CR-DEMO-${String(seq).padStart(4, '0')}`,
    date: payload.date || dateOnly(0),
    modes,
    expectedTotal,
    actualTotal,
    variance: Math.round((actualTotal - expectedTotal) * 100) / 100,
    status: 'reconciled',
    varianceReason: payload.varianceReason || '',
    notes: payload.notes || '',
    reconciledById: DEMO_RECONCILER.id,
    reconciledByName: DEMO_RECONCILER.name,
    reconciledAt: now,
    createdAt: now,
  }
  // One reconciliation per date - replace any earlier custom row for the same day.
  writeJson(SESSIONS_KEY, [row, ...custom.filter((existing) => existing.date !== row.date)])
  return { success: true, session: row }
}
