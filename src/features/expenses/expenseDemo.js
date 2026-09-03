// Local-only demo layer for the self-service Expenses screen. NEVER calls an API.
// Objects match normalizeExpense() output so the page renders them directly.
// Only consulted when config/demoMode.DEMO_MODE is explicitly on (VITE_DEMO_DATA).

import { DEMO_EMPTY } from '../../config/demoMode'

const KEY = 'saas.expenseDemo.v1' // { created: [expense], cancelled: [id] }

const DEMO_USER = { id: 'demo-user-ravi', name: 'Ravi Kumar' }

// Fallback categories, only used when GET /expenses/categories returns nothing.
export const DEMO_EXPENSE_CATEGORIES = [
  'Fuel',
  'Toll',
  'Parking',
  'Loading / Unloading',
  'Vehicle Repair',
  'Food / Travel',
  'Miscellaneous',
]

// Inline SVG data-URI stand-in receipt (no network, demo only).
export const DEMO_RECEIPT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='300'%3E%3Crect width='240' height='300' fill='%23e5e7eb'/%3E%3Ctext x='120' y='150' font-family='sans-serif' font-size='14' fill='%23374151' text-anchor='middle'%3EDemo receipt%3C/text%3E%3C/svg%3E"

const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
const stamp = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || { created: [], cancelled: [] }
  } catch {
    return { created: [], cancelled: [] }
  }
}
function write(value) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* storage disabled - demo expense edits just won't survive a refresh */
  }
}

function expense({ id, category, description, amount, paymentMode, expenseDate, receipt, status, approverName = '', reviewedOffset, rejectionReason = '', paymentStatus = 'Pending', createdOffset }) {
  return {
    id,
    expenseId: id,
    expenseNumber: `EXP-DEMO-${String(id).replace('demo-exp-', '').toUpperCase()}`,
    category,
    description,
    amount,
    expenseDate,
    paymentMode,
    receiptUrl: receipt ? DEMO_RECEIPT : '',
    expenseStatus: 'Submitted',
    approvalStatus: status,
    paymentStatus: status === 'Approved' ? paymentStatus : 'Pending',
    submittedBy: DEMO_USER.id,
    submittedByName: DEMO_USER.name,
    approvedBy: approverName ? 'demo-mgr' : null,
    approverName,
    reviewedAt: status === 'Pending' ? null : stamp(reviewedOffset ?? createdOffset + 1),
    clarificationNote: rejectionReason,
    createdAt: stamp(createdOffset),
    updatedAt: status === 'Pending' ? stamp(createdOffset) : stamp(reviewedOffset ?? createdOffset + 1),
    isDemo: true,
  }
}

const STATIC = [
  expense({ id: 'demo-exp-1', category: 'Fuel', description: 'Diesel refill before the Baner route', amount: 1500, paymentMode: 'Cash', expenseDate: iso(-1), receipt: true, status: 'Pending', createdOffset: -1 }),
  expense({ id: 'demo-exp-2', category: 'Toll', description: 'Mumbai–Pune expressway toll', amount: 350, paymentMode: 'UPI', expenseDate: iso(-3), receipt: true, status: 'Approved', approverName: 'Operations Manager', paymentStatus: 'Paid', createdOffset: -3 }),
  expense({ id: 'demo-exp-3', category: 'Vehicle Repair', description: 'Rear tyre puncture + tube replacement', amount: 4500, paymentMode: 'Card', expenseDate: iso(-5), receipt: true, status: 'Rejected', rejectionReason: 'Receipt total does not match the claimed amount.', createdOffset: -6 }),
  expense({ id: 'demo-exp-4', category: 'Parking', description: 'Market yard parking, no printed slip available', amount: 120, paymentMode: 'Cash', expenseDate: iso(-2), receipt: false, status: 'Pending', createdOffset: -2 }),
  expense({ id: 'demo-exp-5', category: 'Food / Travel', description: 'Lunch during the long Nashik run', amount: 260, paymentMode: 'Bank Transfer', expenseDate: iso(-8), receipt: true, status: 'Approved', approverName: 'Operations Manager', paymentStatus: 'Pending', createdOffset: -9 }),
  expense({ id: 'demo-exp-6', category: 'Miscellaneous', description: 'Replacement cargo straps and rope', amount: 12750, paymentMode: 'UPI', expenseDate: iso(-4), receipt: true, status: 'Pending', createdOffset: -4 }),
]

export function demoExpensesResolved() {
  if (DEMO_EMPTY) return []
  const { created, cancelled } = read()
  return [...created, ...STATIC]
    .filter((e) => !cancelled.includes(e.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function simulateDemoCreateExpense({ category, description, amount, paymentMode, expenseDate, hasReceipt }) {
  const { created, cancelled } = read()
  const record = expense({
    id: `demo-exp-${Date.now().toString(36)}`,
    category,
    description,
    amount: Math.round(Number(amount)) || 0,
    paymentMode,
    expenseDate,
    receipt: Boolean(hasReceipt),
    status: 'Pending',
    createdOffset: 0,
  })
  write({ created: [record, ...created], cancelled })
  return record
}

export function simulateDemoCancelExpense(id) {
  const { created, cancelled } = read()
  write({ created, cancelled: [...new Set([...cancelled, id])] })
}
