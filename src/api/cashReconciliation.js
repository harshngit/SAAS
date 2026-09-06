import {
  demoExpectedForDate,
  getDemoReconciliation,
  listDemoReconciliations,
  saveDemoReconciliation,
} from '../features/reconciliation/cashReconciliationDemoData'
import { DEMO_EMPTY, DEMO_MODE } from '../config/demoMode'
import { listPaymentReceipts } from './paymentReceipts'

// =============================================================================
// Cash Reconciliation - the broader Finance day-close (NOT delivery-collection
// reconciliation, which is a separate frozen workflow).
// -----------------------------------------------------------------------------
// The backend has NO persisted reconciliation-session / close endpoint. What it
// does expose is the source transaction ledger (GET /payment-receipts), so real
// mode can compute EXPECTED totals for a date but cannot save the counted actuals
// or a close. Demo mode simulates the whole flow locally.
//
//   BACKEND LATER: persisted Cash Reconciliation session (save actuals + close),
//   reconciliation history, and a server-side expected-total aggregation.
// =============================================================================

// App payment_method values -> the four canonical modes this page reconciles.
const MODE_LABEL = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Bank Transfer',
  cod: 'Cash',
}

function normalizeMode(method) {
  return MODE_LABEL[String(method || '').toLowerCase()] || 'Other'
}

// Expected cash-in for a single day, grouped by mode. Real source: recorded payment
// receipts whose receipt date is that day. Recorded-but-unreconciled delivery collections,
// approved-but-unpaid expenses, voided/cancelled records are NOT counted (they are not in
// this ledger).
export async function getExpectedTotals(date) {
  // ANY demo mode - never calls /payment-receipts. VITE_DEMO_DATA=empty -> zero activity.
  if (DEMO_MODE) {
    if (DEMO_EMPTY) return { success: true, date, byMode: [], total: 0, reconciledSession: null, source: 'demo' }
    return demoExpectedForDate(date)
  }

  const result = await listPaymentReceipts()
  if (!result.success) {
    return { success: false, error: result.error }
  }

  const onDate = result.receipts.filter((receipt) => {
    const day = String(receipt.receiptDate || receipt.createdAt || '').slice(0, 10)
    return day === date
  })

  const totals = new Map()
  onDate.forEach((receipt) => {
    const mode = normalizeMode(receipt.paymentMethod)
    totals.set(mode, (totals.get(mode) || 0) + (Number(receipt.amountReceived) || 0))
  })

  const order = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other']
  const byMode = [...totals.entries()]
    .map(([mode, expected]) => ({ mode, expected: Math.round(expected * 100) / 100 }))
    .sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode))

  return {
    success: true,
    date,
    byMode,
    total: byMode.reduce((sum, row) => sum + row.expected, 0),
    reconciledSession: null,
    source: 'payment-receipts',
  }
}

export async function listReconciliationSessions() {
  if (DEMO_MODE) return DEMO_EMPTY ? { success: true, sessions: [] } : listDemoReconciliations()
  // No backend list endpoint - real mode has no persisted history.
  return { success: false, notAvailable: true, error: 'BACKEND LATER: no persisted reconciliation session history endpoint.' }
}

export async function getReconciliationSession(id) {
  if (DEMO_MODE) {
    const session = DEMO_EMPTY ? null : getDemoReconciliation(id)
    return session ? { success: true, session } : { success: false, error: 'Reconciliation not found.' }
  }
  return { success: false, notAvailable: true, error: 'BACKEND LATER: reconciliation sessions are not persisted.' }
}

// Demo mode simulates the close. Real mode NEVER persists (no localStorage) - it returns a
// truthful not-available result so the UI can show the future-state note.
export async function saveReconciliation(payload) {
  if (DEMO_MODE) {
    if (DEMO_EMPTY) return { success: false, notAvailable: true, error: 'Nothing to reconcile in empty demo mode.' }
    return saveDemoReconciliation(payload)
  }
  return {
    success: false,
    notAvailable: true,
    error: 'BACKEND LATER: a Cash Reconciliation session cannot be saved or closed yet — no backend endpoint.',
  }
}
