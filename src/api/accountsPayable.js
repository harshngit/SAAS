import { apiClient } from './client'

// =============================================================================
// Accounts Payable API - a DERIVED, READ-ONLY liability view over Supplier
// Invoices. There is no AccountsPayable create / edit / delete endpoint; there
// is no "record payment via AP" endpoint (Supplier Payment is a separate
// downstream module). This layer only reads.
//
//   GET /accounts-payable
//   GET /accounts-payable/summary
//   GET /accounts-payable/supplier/{supplier_id}
//
// Backend includes a row only when the source Supplier Invoice is
// status == recorded AND outstanding_amount > 0. Draft / cancelled / fully paid
// invoices are excluded. Recorded-mismatched invoices are included with a review
// flag. Overdue / ageing come from the backend - never recomputed here.
//
// Demo mode never calls any of this - see payableDemoData.js.
// =============================================================================

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  if (typeof errorData === 'object') {
    if (errorData.msg) return errorData.msg
    if (errorData.detail) return formatApiError(errorData.detail, fallbackMessage)
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
  }
  return String(errorData)
}

function apiError(error, fallback) {
  const status = error.response?.status
  if (status === 403) return 'You do not have permission to view accounts payable.'
  return formatApiError(error.response?.data?.detail ?? error.response?.data, fallback)
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Backend ageing keys -> display. Null / missing = nothing overdue yet or no due date.
export const AP_AGEING_LABELS = {
  '0_30': '1–30 Days',
  '31_60': '31–60 Days',
  '61_90': '61–90 Days',
  '90_plus': '90+ Days',
}

export function apAgeingLabel(bucketKey) {
  if (!bucketKey) return 'Current / No Due Date'
  return AP_AGEING_LABELS[String(bucketKey).toLowerCase()] || 'Current / No Due Date'
}

export function apAgeingVariant(bucketKey) {
  const key = String(bucketKey || '').toLowerCase()
  if (key === '61_90' || key === '90_plus') return 'danger'
  if (key === '0_30' || key === '31_60') return 'warning'
  return 'neutral'
}

export const AP_AGEING_FILTER_OPTIONS = [
  { value: 'all', label: 'All Ageing' },
  { value: '0_30', label: '1–30 Days' },
  { value: '31_60', label: '31–60 Days' },
  { value: '61_90', label: '61–90 Days' },
  { value: '90_plus', label: '90+ Days' },
]

// ---- normalizers ---------------------------------------------------------

export function normalizePayable(raw) {
  if (!raw) return raw
  const grandTotal = num(raw.grand_total ?? raw.invoice_total ?? raw.total)
  const amountPaid = num(raw.amount_paid ?? raw.paid_amount)
  const outstanding =
    raw.outstanding_amount !== undefined && raw.outstanding_amount !== null
      ? num(raw.outstanding_amount)
      : Math.max(grandTotal - amountPaid, 0)
  return {
    // Prefer the Supplier Invoice id so a row click can open its detail page directly.
    id: raw.supplier_invoice_id || raw.invoice_id || raw.id,
    supplierInvoiceId: raw.supplier_invoice_id || raw.invoice_id || raw.id,
    supplierInvoiceNumber: raw.supplier_invoice_number || raw.invoice_number || '',
    supplierId: raw.supplier_id || raw.supplier?.id || '',
    supplierName: raw.supplier?.name || raw.supplier_name || '',
    purchaseNumber: raw.purchase_number || raw.purchase?.purchase_number || '',
    invoiceDate: raw.invoice_date || null,
    dueDate: raw.due_date || null,
    grandTotal,
    amountPaid,
    outstandingAmount: outstanding,
    paymentStatus: String(raw.payment_status || 'unpaid').toLowerCase(),
    verificationStatus: String(raw.verification_status || 'pending').toLowerCase(),
    isOverdue: Boolean(raw.is_overdue),
    daysOverdue: num(raw.days_overdue),
    ageingBucket: raw.ageing_bucket ? String(raw.ageing_bucket).toLowerCase() : null,
  }
}

function normalizeAgeing(raw) {
  const source = raw?.ageing || raw?.ageing_buckets || raw || {}
  const pick = (...keys) => {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return num(source[key])
    }
    return 0
  }
  return {
    '0_30': pick('0_30', 'bucket_0_30', 'days_0_30'),
    '31_60': pick('31_60', 'bucket_31_60', 'days_31_60'),
    '61_90': pick('61_90', 'bucket_61_90', 'days_61_90'),
    '90_plus': pick('90_plus', 'bucket_90_plus', 'days_90_plus', '90plus'),
  }
}

export function normalizePayableSummary(raw) {
  const data = raw || {}
  return {
    totalPayable: num(data.total_payable ?? data.total_outstanding ?? data.outstanding_total),
    totalOverdue: num(data.total_overdue ?? data.overdue_amount ?? data.overdue_total),
    dueToday: num(data.due_today ?? data.due_today_amount),
    openInvoiceCount: num(data.open_invoice_count ?? data.open_invoices ?? data.invoice_count),
    supplierCount: num(data.supplier_count ?? data.suppliers ?? data.supplier_total),
    ageing: normalizeAgeing(data),
  }
}

// ---- calls -------------------------------------------------------------

export async function listAccountsPayable(params = {}) {
  try {
    const query = {}
    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) query.supplier_id = supplierId
    if (params.payment_status && params.payment_status !== 'all') query.payment_status = params.payment_status
    if (params.verification_status && params.verification_status !== 'all') {
      query.verification_status = params.verification_status
    }
    if (params.ageing_bucket && params.ageing_bucket !== 'all') query.ageing_bucket = params.ageing_bucket
    if (params.is_overdue !== undefined) query.is_overdue = params.is_overdue
    if (params.search) query.search = params.search
    query.page = params.page ?? 1
    query.page_size = Math.min(Math.max(params.page_size ?? 50, 1), 100)

    const { data } = await apiClient.get('/accounts-payable', { params: query })
    const rows = Array.isArray(data) ? data : data?.items || data?.results || data?.data || []
    const total = Array.isArray(data) ? data.length : data?.total ?? data?.count ?? rows.length
    return { success: true, payables: rows.map(normalizePayable), total, page: query.page, pageSize: query.page_size }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load accounts payable. Please try again.') }
  }
}

export async function getAccountsPayableSummary(params = {}) {
  try {
    const query = {}
    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) query.supplier_id = supplierId
    const { data } = await apiClient.get('/accounts-payable/summary', { params: query })
    return { success: true, summary: normalizePayableSummary(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load the payables summary.') }
  }
}

export async function getSupplierPayableStatement(supplierId) {
  try {
    const { data } = await apiClient.get(`/accounts-payable/supplier/${encodeURIComponent(supplierId)}`)
    const rows = Array.isArray(data?.invoices) ? data.invoices : Array.isArray(data?.items) ? data.items : []
    return {
      success: true,
      statement: {
        supplierId: data?.supplier_id || supplierId,
        supplierName: data?.supplier?.name || data?.supplier_name || '',
        totalOutstanding: num(data?.total_outstanding ?? data?.outstanding_total),
        openInvoiceCount: num(data?.open_invoice_count ?? rows.length),
        overdueAmount: num(data?.overdue_amount ?? data?.total_overdue),
        ageing: data?.ageing ? normalizeAgeing(data) : null,
        invoices: rows.map(normalizePayable),
      },
    }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load this supplier statement.') }
  }
}
