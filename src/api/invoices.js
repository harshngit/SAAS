import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (errorData.error === 'INSUFFICIENT_STOCK' && Array.isArray(errorData.shortages)) {
    const lines = errorData.shortages.map((shortage) => {
      const name = shortage.product_name || shortage.product_id || 'item'
      const available = shortage.available ?? shortage.available_quantity
      const requested = shortage.requested ?? shortage.requested_quantity
      return `${name} (need ${requested ?? '?'}, have ${available ?? 0})`
    })
    return `Not enough stock: ${lines.join(', ')}`
  }

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function extractShortages(errorData) {
  const detail = errorData?.detail && typeof errorData.detail === 'object' ? errorData.detail : errorData

  if (detail?.error === 'INSUFFICIENT_STOCK' && Array.isArray(detail.shortages)) {
    return detail.shortages.map((shortage) => ({
      productId: shortage.product_id || '',
      variantId: shortage.variant_id || '',
      productName: shortage.product_name || shortage.product_id || 'Item',
      requested: shortage.requested ?? shortage.requested_quantity ?? 0,
      available: shortage.available ?? shortage.available_quantity ?? 0,
    }))
  }

  return null
}

function buildItemBody(item) {
  const body = {
    product_id: item.productId || item.product_id,
    quantity: Math.trunc(Number(item.quantity)) || 0,
    unit_price: Number(item.unitPrice ?? item.unit_price) || 0,
  }

  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId
  if (item.discount !== undefined && item.discount !== '') body.discount = Number(item.discount)

  const taxRate = item.taxRate ?? item.tax_rate
  if (taxRate !== undefined && taxRate !== '') body.tax_rate = Number(taxRate)

  if (item.batchNumber || item.batch_number) body.batch_number = item.batchNumber || item.batch_number

  const serialNumbers = item.serialNumbers || item.serial_numbers
  if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
    body.serial_numbers = serialNumbers.filter(Boolean)
  }

  return body
}

function buildInvoiceBody(payload) {
  const body = {
    items: (payload.items || []).map(buildItemBody),
  }

  if (payload.customerId || payload.customer_id) {
    body.customer_id = payload.customerId || payload.customer_id
  } else if (payload.walkInName || payload.walk_in_customer) {
    body.walk_in_customer = payload.walk_in_customer || {
      name: payload.walkInName,
      mobile_number: payload.walkInPhone || '',
    }
  }

  if (payload.warehouseId || payload.warehouse_id) body.warehouse_id = payload.warehouseId || payload.warehouse_id
  if (payload.invoiceDate || payload.invoice_date) body.invoice_date = payload.invoiceDate || payload.invoice_date
  if (payload.discount !== undefined) body.discount = Number(payload.discount) || 0
  if (payload.tax !== undefined) body.tax = Number(payload.tax) || 0
  if (payload.additionalCharges !== undefined || payload.additional_charges !== undefined) {
    body.additional_charges = Number(payload.additionalCharges ?? payload.additional_charges) || 0
  }
  if (payload.roundOff !== undefined || payload.round_off !== undefined) {
    body.round_off = Number(payload.roundOff ?? payload.round_off) || 0
  }
  if (payload.notes) body.notes = payload.notes
  if (payload.billingAddress || payload.billing_address) body.billing_address = payload.billingAddress || payload.billing_address

  const paymentAmount = payload.payment?.amount ?? payload.paymentAmount
  if (paymentAmount) {
    body.payment = {
      payment_method: payload.payment?.paymentMethod || payload.paymentMethod || 'cash',
      amount: Number(paymentAmount),
      transaction_reference: payload.payment?.transactionReference || payload.paymentReference || undefined,
      received_on: payload.payment?.receivedOn || undefined,
    }
  }

  return body
}

function normalizeInvoiceItem(item) {
  if (!item) return item

  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unit_price) || 0
  const discount = Number(item.discount) || 0
  const taxRate = Number(item.tax_rate) || 0
  const subtotal = quantity * unitPrice
  const discounted = subtotal - subtotal * (discount / 100)
  const fallbackLineTotal = discounted + discounted * (taxRate / 100)

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || item.name || '',
    hsnCode: item.hsn_code || '',
    quantity,
    unitPrice,
    discount,
    taxRate,
    taxAmount: item.tax_amount ?? (fallbackLineTotal - discounted),
    lineTotal: item.line_total ?? item.amount ?? fallbackLineTotal,
  }
}

function normalizeInvoice(invoice) {
  if (!invoice) return invoice

  const items = (invoice.items || []).map(normalizeInvoiceItem)
  const fallbackSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const fallbackTotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const total = invoice.total ?? fallbackTotal
  const amountPaid = invoice.amount_paid ?? 0

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number || invoice.id,
    salesId: invoice.sales_id || '',
    orderId: invoice.order_id || null,
    deliveryId: invoice.delivery_id || null,
    customerId: invoice.customer?.id || invoice.customer_id || '',
    customerName: invoice.customer?.name || invoice.customer?.customer_name || invoice.walk_in_name || '',
    walkInName: invoice.walk_in_name || '',
    walkInPhone: invoice.walk_in_phone || '',
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    invoiceStatus: invoice.invoice_status || invoice.status || 'Issued',
    paymentStatus: invoice.payment_status || (amountPaid >= total && total > 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid'),
    subtotal: invoice.subtotal ?? fallbackSubtotal,
    discount: invoice.discount ?? 0,
    tax: invoice.tax ?? 0,
    additionalCharges: invoice.additional_charges ?? 0,
    roundOff: invoice.round_off ?? 0,
    total,
    amountPaid,
    outstandingAmount: invoice.outstanding_amount ?? Math.max(0, total - amountPaid),
    notes: invoice.notes || '',
    isCreditNote: Boolean(invoice.is_credit_note),
    creditNoteReason: invoice.credit_note_reason || '',
    billingAddress: invoice.billing_address || '',
    salesType: invoice.sales_type || '',
    salesDate: invoice.sales_date || invoice.invoice_date,
    items,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
  }
}

export async function listInvoices(params = {}) {
  try {
    const queryParams = {}
    if (params.customer_id) queryParams.customer_id = params.customer_id
    if (params.status) queryParams.status = params.status
    if (params.order_id) queryParams.order_id = params.order_id

    const { data } = await apiClient.get('/invoices', {
      headers: authHeader(),
      params: queryParams,
    })

    const invoices = Array.isArray(data) ? data : data?.invoices || []
    return { success: true, invoices: invoices.map(normalizeInvoice) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load invoices. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getInvoice(invoiceId) {
  try {
    const { data } = await apiClient.get(`/invoices/${invoiceId}`, {
      headers: authHeader(),
    })

    return { success: true, invoice: normalizeInvoice(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load invoice details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createInvoice(payload) {
  try {
    const { data } = await apiClient.post('/invoices', buildInvoiceBody(payload), {
      headers: authHeader(),
    })

    return { success: true, invoice: normalizeInvoice(data) }
  } catch (error) {
    const errorData = error.response?.data
    const shortages = extractShortages(errorData)
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create invoice. Please try again.',
    )

    return shortages ? { success: false, error: message, shortages } : { success: false, error: message }
  }
}

function extractDuplicateInvoiceRef(message) {
  if (typeof message !== 'string') return null
  const uuidMatch = message.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
  if (uuidMatch) return { id: uuidMatch[0] }
  const numberMatch = message.match(/INV-\d{4}-\d+/)
  if (numberMatch) return { invoiceNumber: numberMatch[0] }
  return null
}

export async function invoiceOrder(orderId, deliveryId) {
  try {
    const { data } = await apiClient.post(`/orders/${orderId}/invoice`, deliveryId ? { delivery_id: deliveryId } : {}, {
      headers: authHeader(),
    })

    return { success: true, invoice: normalizeInvoice(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to invoice this order. Please try again.',
    )
    const isDuplicate = error.response?.status === 409

    return {
      success: false,
      error: message,
      duplicateRef: isDuplicate ? extractDuplicateInvoiceRef(message) : null,
    }
  }
}

export async function downloadInvoicePdf(invoiceId, invoiceNumber, format = 'detailed') {
  try {
    const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
      headers: authHeader(),
      params: { format },
      responseType: 'blob',
    })

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoiceNumber || invoiceId}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to download invoice PDF. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function creditNoteInvoice(invoiceId, payload = {}) {
  try {
    const requestBody = {}
    if (payload.items) requestBody.items = payload.items
    if (payload.reason) requestBody.reason = payload.reason

    const { data } = await apiClient.post(`/invoices/${invoiceId}/credit-note`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, invoice: normalizeInvoice(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to credit this invoice. Please try again.',
    )

    return { success: false, error: message }
  }
}

const DEFAULT_INVOICE_FIELDS = {
  show_company_gstin: true,
  show_customer_gstin: true,
  show_billing_address: true,
  show_shipping_address: true,
  show_hsn_sac: true,
  show_mrp: false,
  show_discount: true,
  show_tax_rate: true,
  show_tax_amount: true,
  show_batch_number: false,
  show_expiry_date: false,
  show_bank_details: true,
  show_upi_qr: true,
  show_terms: true,
  show_signature: true,
}

function normalizeInvoiceSettings(settings) {
  if (!settings) return settings

  return {
    template: settings.template || 'classic',
    paperSize: settings.paper_size || 'A4',
    branding: {
      logoFileId: settings.branding?.logo_file_id || '',
      signatureFileId: settings.branding?.signature_file_id || '',
      primaryColor: settings.branding?.primary_color || '#16A34A',
    },
    fields: { ...DEFAULT_INVOICE_FIELDS, ...(settings.fields || {}) },
    terms: settings.terms || '',
    footerText: settings.footer_text || '',
    notes: settings.notes || '',
  }
}

export async function getInvoiceSettings() {
  try {
    const { data } = await apiClient.get('/invoice-settings', {
      headers: authHeader(),
    })

    return { success: true, settings: normalizeInvoiceSettings(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load invoice settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateInvoiceSettings(payload) {
  try {
    const requestBody = {}

    if (payload.template) requestBody.template = payload.template
    if (payload.paperSize) requestBody.paper_size = payload.paperSize
    if (payload.branding) {
      requestBody.branding = {
        ...(payload.branding.logoFileId ? { logo_file_id: payload.branding.logoFileId } : {}),
        ...(payload.branding.signatureFileId ? { signature_file_id: payload.branding.signatureFileId } : {}),
        ...(payload.branding.primaryColor ? { primary_color: payload.branding.primaryColor } : {}),
      }
    }
    if (payload.fields) requestBody.fields = payload.fields
    if (payload.terms !== undefined) requestBody.terms = payload.terms
    if (payload.footerText !== undefined) requestBody.footer_text = payload.footerText
    if (payload.notes !== undefined) requestBody.notes = payload.notes

    const { data } = await apiClient.patch('/invoice-settings', requestBody, {
      headers: authHeader(),
    })

    return { success: true, settings: normalizeInvoiceSettings(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save invoice settings. Please try again.',
    )

    return { success: false, error: message }
  }
}
