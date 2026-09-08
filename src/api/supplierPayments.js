import { apiClient } from './client'

// =============================================================================
// Supplier Payment API - payment history + invoice allocation + void.
// -----------------------------------------------------------------------------
//   GET    /supplier-payments
//   GET    /supplier-payments/{id}
//   POST   /supplier-payments
//   POST   /supplier-payments/{id}/void
//   GET    /supplier-invoices/{id}/payments      (per-invoice history)
//
// Flow: Supplier Invoice -> Accounts Payable -> Supplier Payment -> allocation
// -> payment history / void. A Supplier Payment only affects the Supplier Invoice
// balance, Accounts Payable visibility and the supplier financial summary. It
// NEVER touches warehouse stock, StockMovement, GRN or Purchase.
//
// Accounts Payable stays read-only - it is never mutated from here.
// Demo mode never calls any of this - see supplierPaymentDemoData.js.
// =============================================================================

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.detail) return formatApiError(errorData.detail, fallbackMessage)
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }
  return String(errorData)
}

function apiError(error, fallback) {
  const status = error.response?.status
  const detail = error.response?.data?.detail ?? error.response?.data?.message ?? error.response?.data
  if (status === 404) return 'This supplier payment is no longer available (404). Please refresh.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return formatApiError(detail, 'This supplier payment has already changed. Refreshing…')
  return formatApiError(detail, fallback)
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const SUPPLIER_PAYMENT_STATUS_OPTIONS = [
  { value: 'recorded', label: 'Recorded' },
  { value: 'voided', label: 'Voided' },
]

export const SUPPLIER_PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export function supplierPaymentMethodLabel(value) {
  return SUPPLIER_PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label || value || '—'
}

// ---- normalizers ---------------------------------------------------------

function normalizeAllocation(raw) {
  if (!raw) return raw
  return {
    id: raw.id,
    supplierInvoiceId: raw.supplier_invoice_id || raw.invoice_id || raw.supplierInvoiceId || '',
    supplierInvoiceNumber:
      raw.supplier_invoice_number || raw.invoice_number || raw.supplier_invoice?.supplier_invoice_number || '',
    invoiceDate: raw.invoice_date || raw.supplier_invoice?.invoice_date || null,
    amount: num(raw.amount ?? raw.allocated_amount),
  }
}

export function normalizeSupplierPayment(raw) {
  if (!raw) return raw
  const amount = num(raw.amount ?? raw.payment_amount)
  const allocations = Array.isArray(raw.allocations) ? raw.allocations.map(normalizeAllocation) : []
  const allocated =
    raw.allocated_amount !== undefined && raw.allocated_amount !== null
      ? num(raw.allocated_amount)
      : allocations.reduce((sum, line) => sum + line.amount, 0)
  const unallocated =
    raw.unallocated_amount !== undefined && raw.unallocated_amount !== null
      ? num(raw.unallocated_amount)
      : Math.max(amount - allocated, 0)
  return {
    id: raw.id,
    paymentNumber: raw.payment_number || raw.number || raw.reference_number || raw.id,
    supplierId: raw.supplier_id || raw.supplier?.id || '',
    supplierName: raw.supplier?.name || raw.supplier_name || '',
    paymentDate: raw.payment_date || raw.date || null,
    amount,
    allocatedAmount: allocated,
    unallocatedAmount: unallocated,
    paymentMethod: raw.payment_method || raw.payment_mode || raw.method || '',
    reference: raw.reference || raw.reference_number || '',
    notes: raw.notes || '',
    status: String(raw.status || 'recorded').toLowerCase(),
    voidReason: raw.void_reason || raw.voided_reason || '',
    voidedAt: raw.voided_at || null,
    createdAt: raw.created_at || raw.recorded_at || null,
    allocations,
  }
}

function unwrapList(data) {
  if (Array.isArray(data)) return { rows: data, total: data.length }
  const rows = data?.items || data?.results || data?.data || data?.supplier_payments || data?.payments || []
  const total = data?.total ?? data?.count ?? data?.total_count ?? rows.length
  return { rows, total }
}

// ---- request body -------------------------------------------------------

export function buildSupplierPaymentBody(form) {
  const body = {
    supplier_id: form.supplierId || form.supplier_id,
    amount: num(form.amount ?? form.paymentAmount),
    payment_method: form.paymentMethod || form.payment_method || form.paymentMode,
    allocations: (form.allocations || [])
      .map((line) => ({
        supplier_invoice_id: line.supplierInvoiceId || line.supplier_invoice_id || line.invoiceId,
        amount: num(line.amount),
      }))
      .filter((line) => line.supplier_invoice_id && line.amount > 0),
  }
  const reference = (form.reference || '').trim?.() ?? form.reference
  if (reference) body.reference = reference
  const notes = (form.notes || '').trim?.() ?? form.notes
  if (notes) body.notes = notes
  const paymentDate = form.paymentDate || form.payment_date
  if (paymentDate) body.payment_date = paymentDate
  return body
}

// ---- calls -------------------------------------------------------------

export async function listSupplierPayments(params = {}) {
  try {
    const query = {}
    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) query.supplier_id = supplierId
    if (params.status && params.status !== 'all') query.status = params.status
    const method = params.payment_method || params.paymentMethod
    if (method && method !== 'all') query.payment_method = method
    if (params.date_from || params.dateFrom) query.date_from = params.date_from || params.dateFrom
    if (params.date_to || params.dateTo) query.date_to = params.date_to || params.dateTo
    if (params.search) query.search = params.search
    query.page = params.page ?? 1
    query.page_size = Math.min(Math.max(params.page_size ?? 25, 1), 100)

    const { data } = await apiClient.get('/supplier-payments', { params: query })
    const { rows, total } = unwrapList(data)
    return {
      success: true,
      payments: rows.map(normalizeSupplierPayment),
      total,
      page: query.page,
      pageSize: query.page_size,
    }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load supplier payments. Please try again.') }
  }
}

export async function getSupplierPayment(id) {
  try {
    const { data } = await apiClient.get(`/supplier-payments/${encodeURIComponent(id)}`)
    return { success: true, payment: normalizeSupplierPayment(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load this supplier payment.') }
  }
}

export async function createSupplierPayment(form) {
  try {
    const { data } = await apiClient.post('/supplier-payments', buildSupplierPaymentBody(form))
    return { success: true, payment: normalizeSupplierPayment(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to record this supplier payment. Please try again.') }
  }
}

// Only a `recorded` payment can be voided. Payment history is retained (status -> voided).
export async function voidSupplierPayment(id, reason) {
  try {
    const { data } = await apiClient.post(`/supplier-payments/${encodeURIComponent(id)}/void`, {
      reason: (reason || '').trim(),
    })
    return { success: true, payment: normalizeSupplierPayment(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to void this supplier payment. Please try again.') }
  }
}

// Per-invoice payment history: GET /supplier-invoices/{id}/payments
export async function getSupplierInvoicePayments(supplierInvoiceId) {
  try {
    const { data } = await apiClient.get(`/supplier-invoices/${encodeURIComponent(supplierInvoiceId)}/payments`)
    const { rows } = unwrapList(data)
    return { success: true, payments: rows.map(normalizeSupplierPayment) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load payment history for this invoice.') }
  }
}
