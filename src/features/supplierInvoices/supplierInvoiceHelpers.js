// =============================================================================
// Supplier Invoice - shared frontend helpers.
// -----------------------------------------------------------------------------
// A Supplier Invoice is the actual vendor bill - distinct from the Purchase
// (what we ordered), the GRN (what we received) and the Sales Invoice
// (`/invoices`). The real API lives in src/api/supplierInvoices.js.
//   - real mode  -> `/supplier-invoices` APIs (canonical lifecycle below)
//   - demo mode  -> full local simulation (supplierInvoiceDemoData.js), never an API call
//
// Canonical lifecycle (backend `status`):  draft -> recorded, or -> cancelled.
// Verification (backend `verification_status`, INDEPENDENT of lifecycle):
//   pending -> matched | mismatched.
// Payment (backend `payment_status`, INDEPENDENT of both): unpaid / partially_paid / paid.
// The three are never derived from one another.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'

// Canonical lifecycle of the bill itself. "Disputed" is NOT a lifecycle state - a mismatch is
// a verification result, shown separately.
export const LIFECYCLE_META = {
  draft: { key: 'draft', label: 'Draft', variant: 'neutral' },
  recorded: { key: 'recorded', label: 'Recorded', variant: 'success' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'neutral' },
}

export function lifecycleMeta(key) {
  const normalized = String(key || 'draft').toLowerCase()
  if (normalized === 'matched') return LIFECYCLE_META.recorded // legacy record safety
  return LIFECYCLE_META[normalized] || LIFECYCLE_META.draft
}

// Canonical verification result (backend `verification_status`).
export const VERIFICATION_META = {
  pending: { key: 'pending', label: 'Pending Verification', variant: 'neutral' },
  matched: { key: 'matched', label: 'Matched', variant: 'success' },
  mismatched: { key: 'mismatched', label: 'Mismatch / Review Required', variant: 'warning' },
}

export function verificationMeta(key) {
  return VERIFICATION_META[String(key || 'pending').toLowerCase()] || VERIFICATION_META.pending
}

export const LIFECYCLE_FILTER_OPTIONS = Object.values(LIFECYCLE_META).map(({ key, label }) => ({ value: key, label }))
export const VERIFICATION_FILTER_OPTIONS = Object.values(VERIFICATION_META).map(({ key, label }) => ({ value: key, label }))

// Legacy demo-mode lifecycle map (the demo simulation still models "disputed"). Real mode
// never uses this - it uses LIFECYCLE_META.
export const INVOICE_STATUS_META = {
  draft: { key: 'draft', label: 'Draft', variant: 'neutral' },
  recorded: { key: 'recorded', label: 'Recorded', variant: 'info' },
  disputed: { key: 'disputed', label: 'Disputed', variant: 'danger' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'neutral' },
}

export const PAYMENT_STATUS_META = {
  unpaid: { key: 'unpaid', label: 'Unpaid', variant: 'danger' },
  partial: { key: 'partial', label: 'Partially Paid', variant: 'warning' },
  partially_paid: { key: 'partial', label: 'Partially Paid', variant: 'warning' },
  paid: { key: 'paid', label: 'Paid', variant: 'success' },
}

// Per-item verification result. Labels are user-facing plain language; the `key`s and the
// underlying variance maths are unchanged.
export const MATCH_STATUS_META = {
  matched: { key: 'matched', label: 'Verified', variant: 'success' },
  quantity_mismatch: { key: 'quantity_mismatch', label: 'Quantity Issue', variant: 'warning' },
  price_mismatch: { key: 'price_mismatch', label: 'Price Issue', variant: 'warning' },
  quantity_price_mismatch: { key: 'quantity_price_mismatch', label: 'Quantity & Price Issue', variant: 'warning' },
}

// Overall (invoice-level) verification result.
export const INVOICE_MATCH_META = {
  matched: { key: 'matched', label: 'Verified', variant: 'success' },
  partial_match: { key: 'partial_match', label: 'Needs Review', variant: 'warning' },
  mismatch: { key: 'mismatch', label: 'Issue Found', variant: 'danger' },
}

export const INVOICE_STATUS_OPTIONS = Object.values(INVOICE_STATUS_META).map(({ key, label }) => ({ value: key, label }))
export const PAYMENT_STATUS_OPTIONS = Object.values(PAYMENT_STATUS_META).map(({ key, label }) => ({ value: key, label }))

export function invoiceStatusMeta(key) {
  const normalized = String(key || '').toLowerCase()
  // Legacy: an old record may have carried the verification result as its status.
  if (normalized === 'matched') return INVOICE_STATUS_META.recorded
  return INVOICE_STATUS_META[normalized] || INVOICE_STATUS_META.draft
}

export function paymentStatusMeta(key) {
  return PAYMENT_STATUS_META[String(key || '').toLowerCase()] || PAYMENT_STATUS_META.unpaid
}

// ---- money -------------------------------------------------------------------

// Line total for a supplier-invoice item, from the same net*rate shape the
// Purchase form uses. Never returns NaN/undefined/Infinity.
export function computeInvoiceLine(line) {
  const quantity = safeNumber(line?.invoiceQty ?? line?.quantity)
  const unitPrice = safeNumber(line?.unitPrice)
  const discountPct = safeNumber(line?.discount)
  const taxPct = safeNumber(line?.taxRate ?? line?.tax)
  const gross = quantity * unitPrice
  const discountAmount = gross * (discountPct / 100)
  const taxable = Math.max(gross - discountAmount, 0)
  const taxAmount = taxable * (taxPct / 100)
  return { quantity, unitPrice, discountAmount, taxable, taxAmount, lineTotal: taxable + taxAmount }
}

// Whole-invoice commercial summary. `charges` carries the optional freight / packing /
// insurance / other / roundOff fields (demo only - backend has no landed-cost support).
export function computeInvoiceTotals(lines, charges = {}) {
  const rows = (Array.isArray(lines) ? lines : []).map(computeInvoiceLine)
  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
  const discount = rows.reduce((sum, row) => sum + row.discountAmount, 0)
  const tax = rows.reduce((sum, row) => sum + row.taxAmount, 0)
  const freight = safeNumber(charges.freight)
  const packing = safeNumber(charges.packing)
  const insurance = safeNumber(charges.insurance)
  const otherCharges = safeNumber(charges.otherCharges)
  const roundOff = safeNumber(charges.roundOff)
  const taxableAmount = Math.max(subtotal - discount, 0)
  const invoiceTotal = Math.max(taxableAmount + tax + freight + packing + insurance + otherCharges + roundOff, 0)
  return { subtotal, discount, taxableAmount, tax, freight, packing, insurance, otherCharges, roundOff, invoiceTotal }
}

export function invoiceOutstanding(invoice) {
  const total = safeNumber(invoice?.invoiceTotal ?? invoice?.total)
  const paid = safeNumber(invoice?.amountPaid)
  return Math.max(total - paid, 0)
}

export function derivePaymentStatusFromAmount(amountPaid, invoiceTotal) {
  const paid = safeNumber(amountPaid)
  const total = safeNumber(invoiceTotal)
  if (paid <= 0) return 'unpaid'
  if (paid >= total) return 'paid'
  return 'partial'
}

// ---- three-way match --------------------------------------------------------

// Build one comparison row per invoice line: Ordered (Purchase) vs Received (GRN cumulative
// accepted) vs Invoiced (this invoice). Purely a visibility layer - no blocking.
export function buildMatchRows(invoice, purchase, grns) {
  const purchaseItems = purchase?.items || []
  const acceptedByProduct = {}
  ;(Array.isArray(grns) ? grns : []).forEach((grn) => {
    ;(grn?.lines || []).forEach((grnLine) => {
      if (!grnLine?.productId) return
      acceptedByProduct[grnLine.productId] = (acceptedByProduct[grnLine.productId] || 0) + safeNumber(grnLine.acceptedQty)
    })
  })

  return (invoice?.items || []).map((invLine) => {
    const purchaseLine = purchaseItems.find((item) => item.productId === invLine.productId)
    const orderedQty = safeNumber(purchaseLine?.quantity)
    const receivedQty = safeNumber(acceptedByProduct[invLine.productId])
    const invoiceQty = safeNumber(invLine.invoiceQty ?? invLine.quantity)
    const purchaseUnitCost = safeNumber(purchaseLine?.purchasePrice)
    const invoiceUnitCost = safeNumber(invLine.unitPrice)
    const qtyVariance = invoiceQty - receivedQty
    const priceVariance = invoiceUnitCost - purchaseUnitCost

    let matchKey = 'matched'
    if (priceVariance !== 0 && qtyVariance !== 0) matchKey = 'quantity_price_mismatch'
    else if (priceVariance !== 0) matchKey = 'price_mismatch'
    else if (qtyVariance !== 0) matchKey = 'quantity_mismatch'

    return {
      productId: invLine.productId,
      productName: invLine.productName || purchaseLine?.productName || 'Item',
      sku: invLine.sku || purchaseLine?.sku || '',
      orderedQty,
      receivedQty,
      invoiceQty,
      purchaseUnitCost,
      invoiceUnitCost,
      qtyVariance,
      priceVariance,
      match: MATCH_STATUS_META[matchKey],
    }
  })
}

export function summarizeMatch(matchRows) {
  const rows = Array.isArray(matchRows) ? matchRows : []
  const orderedValue = rows.reduce((sum, row) => sum + row.orderedQty * row.purchaseUnitCost, 0)
  const receivedValue = rows.reduce((sum, row) => sum + row.receivedQty * row.purchaseUnitCost, 0)
  const invoicedValue = rows.reduce((sum, row) => sum + row.invoiceQty * row.invoiceUnitCost, 0)
  const matchedCount = rows.filter((row) => row.match.key === 'matched').length
  const hasPriceMismatch = rows.some(
    (row) => row.match.key === 'price_mismatch' || row.match.key === 'quantity_price_mismatch',
  )

  // All lines clean -> Matched. A wrong unit price is a hard Mismatch. Anything else (quantity
  // differences - often just because receiving is still in progress) -> Partial Match.
  let overallKey = 'partial_match'
  if (rows.length === 0 || matchedCount === rows.length) overallKey = 'matched'
  else if (hasPriceMismatch && matchedCount === 0) overallKey = 'mismatch'

  return {
    orderedValue,
    receivedValue,
    invoicedValue,
    variance: invoicedValue - receivedValue,
    overall: INVOICE_MATCH_META[overallKey],
  }
}

// Convenience: fold an invoice record + (optionally) its Purchase / GRNs into the derived
// values every screen needs - totals, outstanding, payment status, and the overall three-way
// match result. Match is null when there is no linked Purchase to compare against.
export function resolveSupplierInvoice(invoice, { purchase, grns } = {}) {
  const totals = computeInvoiceTotals(invoice?.items, invoice?.charges)
  const outstanding = invoiceOutstanding({ invoiceTotal: totals.invoiceTotal, amountPaid: invoice?.amountPaid })
  const paymentStatus = derivePaymentStatusFromAmount(invoice?.amountPaid, totals.invoiceTotal)
  const matchRows = purchase ? buildMatchRows(invoice, purchase, grns) : []
  const match = matchRows.length > 0 ? summarizeMatch(matchRows).overall : null
  return { ...invoice, ...totals, outstanding, paymentStatus, match }
}

// ---- validation (task section 18) ------------------------------------------

export function validateSupplierInvoice(form, { existingNumbersForSupplier = [] } = {}) {
  if (!form.supplierId) return 'Select a supplier.'
  if (!form.supplierInvoiceNumber?.trim()) return 'Enter the supplier invoice number.'
  if (!form.invoiceDate) return 'Enter the invoice date.'
  if (form.dueDate && form.invoiceDate && new Date(form.dueDate) < new Date(form.invoiceDate)) {
    return 'Due date cannot be earlier than the invoice date.'
  }
  const items = (form.items || []).filter((item) => item.productId)
  if (items.length === 0) return 'Add at least one invoice item.'
  for (const item of items) {
    if (safeNumber(item.invoiceQty) <= 0) return `${item.productName || 'Item'}: invoice quantity must be greater than 0.`
    if (safeNumber(item.unitPrice) < 0) return `${item.productName || 'Item'}: unit price cannot be negative.`
  }
  const duplicate = existingNumbersForSupplier
    .map((value) => String(value || '').trim().toLowerCase())
    .includes(form.supplierInvoiceNumber.trim().toLowerCase())
  if (duplicate) return 'This supplier already has an invoice with that number.'

  const totals = computeInvoiceTotals(items, form.charges)
  if (totals.invoiceTotal < 0) return 'Invoice total cannot be negative.'
  if (safeNumber(form.amountPaid) > totals.invoiceTotal) return 'Amount paid cannot exceed the invoice total.'
  return ''
}
