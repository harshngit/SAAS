import { apiClient } from './client'

// =============================================================================
// Supplier Invoice API - the real vendor-bill entity.
// -----------------------------------------------------------------------------
//   POST   /supplier-invoices
//   GET    /supplier-invoices
//   GET    /supplier-invoices/{id}
//   PUT    /supplier-invoices/{id}            (draft only)
//   POST   /supplier-invoices/{id}/record     (draft -> recorded, runs 3-way match)
//   POST   /supplier-invoices/{id}/cancel     (blocked once amount_paid > 0)
//   DELETE /supplier-invoices/{id}            (draft only)
//
// A Supplier Invoice is what the vendor BILLED us - distinct from the Purchase
// (what we ordered), the GRN (what we physically received) and the Sales Invoice
// (`/invoices`, the customer bill). It is NOT `/purchase-invoices` - that route is
// legacy backend naming for the Purchase record itself.
//
// Recording does NOT move stock. It runs the backend 3-way match (cumulative
// accepted_qty across all CONFIRMED GRNs per purchase item vs billed_qty / price)
// and sets verification_status. Lifecycle and verification are independent.
//
// Demo mode never calls any of this - see supplierInvoiceDemoData.js.
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
  const data = error.response?.data
  const detail = data?.detail ?? data?.message ?? data?.error ?? data
  if (status === 404) return 'This supplier invoice is no longer available (404). Please refresh.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return formatApiError(detail, 'This supplier invoice has already moved to the next stage. Refreshing…')
  if (status === 400 || status === 422) return formatApiError(detail, fallback)
  return formatApiError(detail, fallback)
}

const num = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// ---- canonical vocab --------------------------------------------------------

export const SUPPLIER_INVOICE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const SUPPLIER_INVOICE_VERIFICATION_OPTIONS = [
  { value: 'pending', label: 'Pending Verification' },
  { value: 'matched', label: 'Matched' },
  { value: 'mismatched', label: 'Mismatch / Review Required' },
]

export const SUPPLIER_INVOICE_PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]

// ---- normalizers -----------------------------------------------------------

function normalizeItem(item) {
  if (!item) return item
  const billedQty = num(item.billed_qty ?? item.invoice_qty ?? item.quantity)
  const unitPrice = num(item.unit_price ?? item.rate)
  const lineTotal =
    item.line_total !== undefined && item.line_total !== null ? num(item.line_total) : billedQty * unitPrice
  return {
    id: item.id,
    productId: item.product_id || item.product?.id || item.productId || '',
    variantId: item.variant_id || item.variantId || '',
    purchaseItemId: item.purchase_item_id || item.purchaseItemId || null,
    productName: item.product_name || item.product?.name || item.productName || '',
    sku: item.product_sku || item.sku || '',
    uom: item.uom || item.unit || '',
    billedQty,
    unitPrice,
    discount: num(item.discount ?? item.discount_percent),
    tax: num(item.tax ?? item.tax_percent ?? item.tax_rate),
    taxAmount: item.tax_amount !== undefined ? num(item.tax_amount) : null,
    lineTotal,
    // Context fields (backend-exposed where available) - never persisted by the form.
    orderedQty: item.ordered_qty !== undefined ? num(item.ordered_qty) : null,
    receivedQty:
      item.received_qty !== undefined
        ? num(item.received_qty)
        : item.accepted_qty !== undefined
          ? num(item.accepted_qty)
          : null,
    previouslyInvoicedQty:
      item.previously_invoiced_qty !== undefined ? num(item.previously_invoiced_qty) : null,
    remainingInvoiceableQty:
      item.remaining_invoiceable_qty !== undefined
        ? num(item.remaining_invoiceable_qty)
        : item.remaining_billable_qty !== undefined
          ? num(item.remaining_billable_qty)
          : null,
    purchasePrice: item.purchase_price !== undefined ? num(item.purchase_price) : null,
  }
}

function normalizeMatching(raw) {
  const source = raw?.matching_result || raw?.verification || raw?.match_summary || null
  if (!source && raw?.verification_status === undefined) return null
  const issues = Array.isArray(source?.issues)
    ? source.issues
    : Array.isArray(raw?.verification_issues)
      ? raw.verification_issues
      : []
  const bool = (value) => (value === undefined || value === null ? null : Boolean(value))
  return {
    quantityMatch: bool(source?.quantity_match ?? source?.qty_match),
    priceMatch: bool(source?.price_match),
    overall: String(source?.overall ?? raw?.verification_status ?? 'pending').toLowerCase(),
    issues: issues
      .map((issue) => (typeof issue === 'string' ? issue : formatApiError(issue)))
      .filter(Boolean),
  }
}

export function normalizeSupplierInvoice(raw) {
  if (!raw) return raw
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : []
  const grandTotal = num(raw.grand_total ?? raw.total ?? raw.invoice_total)
  const amountPaid = num(raw.amount_paid)
  const outstanding =
    raw.outstanding_amount !== undefined && raw.outstanding_amount !== null
      ? num(raw.outstanding_amount)
      : Math.max(grandTotal - amountPaid, 0)
  return {
    id: raw.id,
    supplierInvoiceNumber: raw.supplier_invoice_number || raw.invoice_number || raw.number || '',
    systemRef: raw.reference || raw.system_ref || raw.ref || '',
    supplierId: raw.supplier_id || raw.supplier?.id || '',
    supplierName: raw.supplier?.name || raw.supplier_name || '',
    purchaseId: raw.purchase_id || raw.purchase?.id || '',
    purchaseNumber: raw.purchase_number || raw.purchase?.purchase_number || raw.purchase?.invoice_number || '',
    invoiceDate: raw.invoice_date || null,
    dueDate: raw.due_date || null,
    status: String(raw.status || 'draft').toLowerCase(),
    verificationStatus: String(raw.verification_status || 'pending').toLowerCase(),
    paymentStatus: String(raw.payment_status || 'unpaid').toLowerCase(),
    notes: raw.notes || '',
    items,
    // Backend is authoritative for every money field.
    subtotal: num(raw.subtotal ?? raw.sub_total),
    discountTotal: num(raw.discount_total ?? raw.total_discount),
    taxTotal: num(raw.tax_total ?? raw.total_tax),
    additionalCharges: num(raw.additional_charges ?? raw.other_charges ?? raw.charges_total),
    grandTotal,
    amountPaid,
    outstandingAmount: outstanding,
    matching: normalizeMatching(raw),
    createdAt: raw.created_at || null,
    recordedAt: raw.recorded_at || null,
    cancelledAt: raw.cancelled_at || null,
    updatedAt: raw.updated_at || null,
  }
}

function unwrapList(data) {
  if (Array.isArray(data)) return { rows: data, total: data.length }
  const rows = data?.items || data?.results || data?.data || data?.supplier_invoices || []
  const total = data?.total ?? data?.count ?? data?.total_count ?? rows.length
  return { rows, total }
}

// ---- request bodies -------------------------------------------------------

function buildItemBody(item) {
  const body = {
    product_id: item.productId || item.product_id,
    billed_qty: num(item.billedQty ?? item.invoiceQty ?? item.quantity),
    unit_price: num(item.unitPrice ?? item.unit_price),
  }
  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId
  const purchaseItemId = item.purchaseItemId || item.purchase_item_id
  if (purchaseItemId) body.purchase_item_id = purchaseItemId
  const discount = num(item.discount)
  if (discount) body.discount = discount
  const tax = num(item.tax ?? item.taxRate)
  if (tax) body.tax = tax
  return body
}

// Only backend-supported fields. Server-managed fields (status, verification_status,
// payment_status, amount_paid, outstanding_amount, totals) are NEVER sent.
export function buildSupplierInvoiceBody(form) {
  const body = {
    supplier_id: form.supplierId || form.supplier_id,
    supplier_invoice_number: (form.supplierInvoiceNumber ?? form.supplier_invoice_number ?? '').trim(),
    invoice_date: form.invoiceDate || form.invoice_date,
    items: (form.items || []).filter((item) => item.productId || item.product_id).map(buildItemBody),
  }
  const purchaseId = form.purchaseId || form.purchase_id
  if (purchaseId) body.purchase_id = purchaseId
  const dueDate = form.dueDate || form.due_date
  if (dueDate) body.due_date = dueDate
  const notes = (form.notes || '').trim()
  if (notes) body.notes = notes
  return body
}

// ---- calls ---------------------------------------------------------------

export async function listSupplierInvoices(params = {}) {
  try {
    const query = {}
    const supplierId = params.supplier_id || params.supplierId
    if (supplierId) query.supplier_id = supplierId
    const purchaseId = params.purchase_id || params.purchaseId
    if (purchaseId) query.purchase_id = purchaseId
    if (params.status && params.status !== 'all') query.status = params.status
    const verification = params.verification_status || params.verificationStatus
    if (verification && verification !== 'all') query.verification_status = verification
    const payment = params.payment_status || params.paymentStatus
    if (payment && payment !== 'all') query.payment_status = payment
    if (params.search) query.search = params.search
    if (params.page !== undefined) query.page = params.page
    if (params.page_size !== undefined) query.page_size = params.page_size
    if (params.skip !== undefined) query.skip = params.skip
    if (params.limit !== undefined) query.limit = params.limit

    const { data } = await apiClient.get('/supplier-invoices', { params: query })
    const { rows, total } = unwrapList(data)
    return { success: true, invoices: rows.map(normalizeSupplierInvoice), total }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load supplier invoices. Please try again.') }
  }
}

export async function getSupplierInvoice(id) {
  try {
    const { data } = await apiClient.get(`/supplier-invoices/${encodeURIComponent(id)}`)
    return { success: true, invoice: normalizeSupplierInvoice(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to load this supplier invoice.') }
  }
}

export async function createSupplierInvoice(form) {
  try {
    const { data } = await apiClient.post('/supplier-invoices', buildSupplierInvoiceBody(form))
    return { success: true, invoice: normalizeSupplierInvoice(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to create this supplier invoice. Please try again.') }
  }
}

// Draft only.
export async function updateSupplierInvoice(id, form) {
  try {
    const { data } = await apiClient.put(`/supplier-invoices/${encodeURIComponent(id)}`, buildSupplierInvoiceBody(form))
    return { success: true, invoice: normalizeSupplierInvoice(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to update this supplier invoice. Please try again.') }
  }
}

// Draft -> recorded. Runs the backend 3-way match; verification_status becomes matched or
// mismatched. Moves NO stock.
export async function recordSupplierInvoice(id) {
  try {
    const { data } = await apiClient.post(`/supplier-invoices/${encodeURIComponent(id)}/record`, {})
    return { success: true, invoice: normalizeSupplierInvoice(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to record this supplier invoice. Please try again.') }
  }
}

// Backend blocks a cancel once amount_paid > 0.
export async function cancelSupplierInvoice(id, reason) {
  try {
    const body = reason ? { reason } : {}
    const { data } = await apiClient.post(`/supplier-invoices/${encodeURIComponent(id)}/cancel`, body)
    return { success: true, invoice: normalizeSupplierInvoice(data) }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to cancel this supplier invoice. Please try again.') }
  }
}

// Draft only.
export async function deleteSupplierInvoice(id) {
  try {
    await apiClient.delete(`/supplier-invoices/${encodeURIComponent(id)}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: apiError(error, 'Unable to delete this supplier invoice. Please try again.') }
  }
}
