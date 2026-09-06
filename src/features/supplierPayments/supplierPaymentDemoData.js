// =============================================================================
// FRONTEND DEMO SUPPLIER PAYMENTS - UI TESTING ONLY (canonical demo ledger)
// -----------------------------------------------------------------------------
// This is the ONE demo supplier-payment source. Accounts Payable, Supplier
// Detail and Supplier Invoice Detail all read/write through here - there is no
// second ledger anywhere.
//
// How the invoice balance stays coherent:
//   - Seed payments below already correspond to the amountPaid baked into the
//     seed Supplier Invoices, so they are display-only and do NOT re-apply.
//   - A payment recorded by the user applies each allocation with
//     patchDemoSupplierInvoice(invoiceId, { amountPaid: current + allocated }).
//   - Voiding a payment reverses each allocation (clamped at >= 0).
// Every screen that derives from Supplier Invoices therefore updates together.
//
// Real supplier invoices are never touched - real mode disables Record Payment.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'
import {
  SUPPLIER_INVOICES_DEMO_ENABLED,
  getDemoSupplierInvoice,
  patchDemoSupplierInvoice,
} from '../supplierInvoices/supplierInvoiceDemoData'
import { isSameMonth, isWithinDays } from './supplierPaymentHelpers'

export const SUPPLIER_PAYMENTS_DEMO_ENABLED = SUPPLIER_INVOICES_DEMO_ENABLED

const STORE_KEY = 'saas.supplierPaymentDemo.v1'

// Seed payments == the amountPaid already baked into the seed Supplier Invoices.
const SEED_PAYMENTS = [
  {
    id: 'demo-supplier-payment-seed-rel-001',
    paymentNumber: 'PAY-2026-0001',
    supplierId: 'demo-supplier-reliance',
    supplierName: 'Reliance Industries',
    paymentDate: '2026-08-20',
    amount: 125000,
    paymentMode: 'bank_transfer',
    reference: 'REL-NEFT-8821',
    notes: 'August part payment.',
    status: 'recorded',
    allocations: [{ invoiceId: 'demo-si-rel-001', supplierInvoiceNumber: 'INV-RIL-2026-081', amount: 125000 }],
    recordedAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'demo-supplier-payment-seed-cst-001',
    paymentNumber: 'PAY-2026-0002',
    supplierId: 'demo-supplier-coastal',
    supplierName: 'Coastal Beverages Distribution',
    paymentDate: '2026-08-22',
    amount: 92000,
    paymentMode: 'upi',
    reference: 'CST-UPI-1442',
    notes: 'Invoice settled in full.',
    status: 'recorded',
    allocations: [{ invoiceId: 'demo-si-cst-001', supplierInvoiceNumber: 'INV-CST-2026-018', amount: 92000 }],
    recordedAt: '2026-08-22T11:30:00.000Z',
  },
]

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
    /* storage disabled - demo payments just won't persist across refresh */
  }
}

// Stored records win over a seed record with the same id (used for voiding a seed payment).
function allPayments() {
  const stored = readStore()
  const storedIds = new Set(stored.map((entry) => entry.id))
  const seeds = SEED_PAYMENTS.filter((seed) => !storedIds.has(seed.id))
  return [...seeds, ...stored].sort(
    (a, b) => new Date(b.paymentDate || b.recordedAt || 0).getTime() - new Date(a.paymentDate || a.recordedAt || 0).getTime(),
  )
}

export function getSupplierPayments({ supplierId, invoiceId } = {}) {
  return allPayments().filter((payment) => {
    if (supplierId && payment.supplierId !== supplierId) return false
    if (invoiceId && !(payment.allocations || []).some((allocation) => allocation.invoiceId === invoiceId)) return false
    return true
  })
}

export function getSupplierPayment(id) {
  return allPayments().find((payment) => payment.id === id) || null
}

// Allocated amount from a payment to one invoice (0 for voided payments).
export function allocatedToInvoice(payment, invoiceId) {
  if (!payment || payment.status === 'voided') return 0
  return (payment.allocations || [])
    .filter((allocation) => allocation.invoiceId === invoiceId)
    .reduce((sum, allocation) => sum + safeNumber(allocation.amount), 0)
}

export function nextPaymentNumber() {
  const year = new Date().getFullYear()
  const maxSeq = allPayments().reduce((max, payment) => {
    const match = /PAY-\d{4}-(\d+)/.exec(payment.paymentNumber || '')
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `PAY-${year}-${String(maxSeq + 1).padStart(4, '0')}`
}

// ---- summary metrics (recorded payments only) -----------------------------

const recorded = () => allPayments().filter((payment) => payment.status === 'recorded')

export function totalPaid() {
  return recorded().reduce((sum, payment) => sum + safeNumber(payment.amount), 0)
}

export function paidThisMonth(now = new Date()) {
  return recorded()
    .filter((payment) => isSameMonth(payment.paymentDate, now))
    .reduce((sum, payment) => sum + safeNumber(payment.amount), 0)
}

export function suppliersPaidCount() {
  return new Set(recorded().map((payment) => payment.supplierId)).size
}

export function recentPaymentsCount(now = Date.now()) {
  return recorded().filter((payment) => isWithinDays(payment.paymentDate, 30, now)).length
}

// ---- mutations -----------------------------------------------------------

// allocations: [{ invoiceId, amount }] with amount > 0. The record's amount is their sum.
export function recordSupplierPaymentDemo({ supplierId, supplierName, paymentDate, paymentMode, reference = '', notes = '', allocations = [] }) {
  const lines = allocations
    .map((allocation) => {
      const invoice = getDemoSupplierInvoice(allocation.invoiceId)
      return {
        invoiceId: allocation.invoiceId,
        supplierInvoiceNumber: invoice?.supplierInvoiceNumber || '',
        amount: safeNumber(allocation.amount),
      }
    })
    .filter((line) => line.amount > 0)

  if (lines.length === 0) return null

  lines.forEach((line) => {
    const invoice = getDemoSupplierInvoice(line.invoiceId)
    if (!invoice) return
    patchDemoSupplierInvoice(line.invoiceId, { amountPaid: safeNumber(invoice.amountPaid) + line.amount })
  })

  const record = {
    id: `demo-supplier-payment-${Date.now().toString(36)}`,
    paymentNumber: nextPaymentNumber(),
    supplierId,
    supplierName,
    paymentDate,
    amount: lines.reduce((sum, line) => sum + line.amount, 0),
    paymentMode,
    reference: reference.trim(),
    notes: notes.trim(),
    status: 'recorded',
    allocations: lines,
    recordedAt: new Date().toISOString(),
  }
  writeStore([...readStore(), record])
  return record
}

export function voidSupplierPaymentDemo(paymentId, reason) {
  const payment = getSupplierPayment(paymentId)
  if (!payment || payment.status === 'voided') return null

  ;(payment.allocations || []).forEach((allocation) => {
    const invoice = getDemoSupplierInvoice(allocation.invoiceId)
    if (!invoice) return
    const nextPaid = Math.max(safeNumber(invoice.amountPaid) - safeNumber(allocation.amount), 0)
    patchDemoSupplierInvoice(allocation.invoiceId, { amountPaid: nextPaid })
  })

  const voided = { ...payment, status: 'voided', voidReason: String(reason || '').trim(), voidedAt: new Date().toISOString() }
  const stored = readStore()
  const index = stored.findIndex((entry) => entry.id === paymentId)
  if (index === -1) writeStore([...stored, voided])
  else {
    const next = [...stored]
    next[index] = voided
    writeStore(next)
  }
  return voided
}
