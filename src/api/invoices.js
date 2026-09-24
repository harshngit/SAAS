import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import {
  INVOICE_DEMO_ENABLED,
  demoInvoicesResolved,
  getDemoInvoiceById,
} from '../features/invoices/invoiceDemoData'

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
  const paymentMethod = payload.payment?.paymentMethod || payload.paymentMethod || ''
  if (paymentAmount || paymentMethod === 'cod') {
    const payment = payload.payment || {}
    body.payment = {
      payment_method: paymentMethod || 'cash',
      amount: Number(paymentAmount),
      transaction_reference: payment.transactionReference || payload.paymentReference || undefined,
      received_on: payment.receivedOn || undefined,
    }

    if (payment.upiId || payload.upiId) body.payment.upi_id = payment.upiId || payload.upiId
    if (payment.cardType || payload.cardType) body.payment.card_type = payment.cardType || payload.cardType
    if (payment.cardLastFour || payload.cardLastFour) body.payment.card_last_four = payment.cardLastFour || payload.cardLastFour
    if (payment.collectionInstructions || payload.collectionInstructions) {
      body.payment.collection_instructions = payment.collectionInstructions || payload.collectionInstructions
    }
    if (payment.paymentStatus || payload.paymentStatus) body.payment.payment_status = payment.paymentStatus || payload.paymentStatus
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
    unit: item.uom || item.unit || '',
    description: item.description || '',
    mrp: item.mrp ?? null,
    batchNumber: item.batch_number || '',
    expiryDate: item.expiry_date || '',
    // Optional - only present if the backend starts sending it on invoice items; the Item Table
    // Columns "Product Image" toggle stays honest either way (no image = no broken image, see
    // invoiceTemplates.jsx).
    productImage: item.product_image_url || item.product_image_id || item.cover_image || '',
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
    orderNumber: invoice.order_number || invoice.order?.order_number || '',
    // Read defensively (no fabricated data) - Invoice/Order carry no po_number/eway_bill_number/
    // vehicle_number columns today (see the backend-changes writeup), so these stay blank until
    // that data exists; the Invoice Details toggles for them are already wired end to end.
    poNumber: invoice.order?.customer_po_number || invoice.po_number || '',
    ewayBillNumber: invoice.eway_bill_number || '',
    vehicleNumber: invoice.vehicle_number || '',
    deliveryId: invoice.delivery_id || null,
    customerId: invoice.customer?.id || invoice.customer_id || '',
    customerName: invoice.customer?.name || invoice.customer?.customer_name || invoice.walk_in_name || '',
    customerPhone: invoice.customer?.phone || invoice.customer?.mobile_number || invoice.walk_in_phone || '',
    customerGstin: invoice.customer?.gst_number || invoice.customer?.gstin || '',
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
  // Demo mode: seeded demo invoices only - never touches the real /invoices endpoint.
  if (INVOICE_DEMO_ENABLED) {
    return { success: true, invoices: demoInvoicesResolved(params) }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    const invoice = getDemoInvoiceById(invoiceId)
    return invoice ? { success: true, invoice } : { success: false, error: 'Invoice not found.' }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    return { success: false, error: 'Invoice creation is simulated in demo mode. Turn demo data off to create real invoices.' }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    return { success: false, error: 'Invoicing an order is simulated in demo mode. Turn demo data off to create real invoices.', duplicateRef: null }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    return { success: false, error: 'The server-generated PDF is unavailable in demo mode. Use Download PDF for the on-screen version.' }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    return { success: false, error: 'Credit notes are not simulated in demo mode.' }
  }

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

// Mirrors app/schemas/workflow_settings.py's InvoiceSettings exactly - this IS the real,
// backend-confirmed shape (inspected directly in the backend repo), not a guess. `fields` is
// the original 14-boolean block the PDF's per-row/section toggles use; everything else is its
// own nested block matching a dedicated Pydantic model one-to-one. camelCase in React, snake_case
// on the wire - normalized exactly once, here.
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

const DEFAULT_TYPOGRAPHY = { fontFamily: 'Helvetica', headingSize: 16, bodySize: 9, tableSize: 8 }

const DEFAULT_BUSINESS_DETAILS = {
  showBusinessName: true,
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showGstin: true,
  showPan: false,
}

const DEFAULT_INVOICE_DETAILS = {
  showInvoiceNumber: true,
  showInvoiceDate: true,
  showDueDate: true,
  showOrderReference: true,
  showPoNumber: false,
  showEwayBillNumber: false,
  showVehicleNumber: false,
}

const DEFAULT_PARTY_DETAILS = {
  showCustomerName: true,
  showCustomerGstin: true,
  showBillingAddress: true,
  showShippingAddress: true,
  showCustomerPhone: true,
}

const DEFAULT_ITEM_TABLE = {
  showProductImage: false,
  showDescription: false,
  columns: ['product', 'hsn_sac', 'quantity', 'rate', 'discount', 'tax_rate', 'tax_amount', 'amount'],
}

const DEFAULT_PAYMENT_DETAILS = { showBankDetails: true, showUpiQr: true }

const DEFAULT_FOOTER = { showTerms: true, showSignature: true, showStamp: true, terms: '', footerText: '', notes: '' }

const DEFAULT_REGULAR_PRINT = {
  layout: 'standard',
  paperSize: 'A4',
  orientation: 'portrait',
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
}

const DEFAULT_THERMAL_PRINT = {
  layout: 'standard',
  paperWidth: '80mm',
  printingType: 'text',
  boldText: true,
  autoCut: false,
  openCashDrawer: false,
  extraLines: 0,
  copies: 1,
}

function normalizeInvoiceSettings(settings) {
  if (!settings) return settings
  const biz = settings.business_details || {}
  const inv = settings.invoice_details || {}
  const party = settings.party_details || {}
  const item = settings.item_table || {}
  const pay = settings.payment_details || {}
  const foot = settings.footer || {}
  const reg = settings.regular_print || {}
  const thermal = settings.thermal_print || {}
  const typo = settings.typography || {}

  return {
    template: settings.template || 'classic',
    // Not a real backend field yet (the backend's `template` is still restricted to
    // classic/modern/compact/thermal) - the backend is adding `template_variant` to persist the
    // exact selected theme preset (e.g. "GST Theme 3") on top of that. Read defensively so this
    // stays a no-op fallback to session-only preset selection (InvoiceSettings.jsx) until the
    // backend actually returns it; once it does, this starts round-tripping for real with no
    // further frontend change.
    templateVariant: settings.template_variant || '',
    paperSize: settings.paper_size || 'A4',
    branding: {
      logoFileId: settings.branding?.logo_file_id || '',
      signatureFileId: settings.branding?.signature_file_id || '',
      // Same as above - not yet a real field on this backend snapshot (InvoiceBranding only has
      // logo_file_id/signature_file_id/primary_color today), being added alongside
      // template_variant. Reads back empty until then; see the backend-changes writeup.
      stampFileId: settings.branding?.stamp_file_id || '',
      paymentQrFileId: settings.branding?.payment_qr_file_id || '',
      primaryColor: settings.branding?.primary_color || '#063b00',
    },
    fields: { ...DEFAULT_INVOICE_FIELDS, ...(settings.fields || {}) },
    typography: {
      fontFamily: typo.font_family || DEFAULT_TYPOGRAPHY.fontFamily,
      headingSize: typo.heading_size ?? DEFAULT_TYPOGRAPHY.headingSize,
      bodySize: typo.body_size ?? DEFAULT_TYPOGRAPHY.bodySize,
      tableSize: typo.table_size ?? DEFAULT_TYPOGRAPHY.tableSize,
    },
    businessDetails: {
      showBusinessName: biz.show_business_name ?? DEFAULT_BUSINESS_DETAILS.showBusinessName,
      showLogo: biz.show_logo ?? DEFAULT_BUSINESS_DETAILS.showLogo,
      showAddress: biz.show_address ?? DEFAULT_BUSINESS_DETAILS.showAddress,
      showPhone: biz.show_phone ?? DEFAULT_BUSINESS_DETAILS.showPhone,
      showEmail: biz.show_email ?? DEFAULT_BUSINESS_DETAILS.showEmail,
      showGstin: biz.show_gstin ?? DEFAULT_BUSINESS_DETAILS.showGstin,
      showPan: biz.show_pan ?? DEFAULT_BUSINESS_DETAILS.showPan,
    },
    invoiceDetails: {
      showInvoiceNumber: inv.show_invoice_number ?? DEFAULT_INVOICE_DETAILS.showInvoiceNumber,
      showInvoiceDate: inv.show_invoice_date ?? DEFAULT_INVOICE_DETAILS.showInvoiceDate,
      showDueDate: inv.show_due_date ?? DEFAULT_INVOICE_DETAILS.showDueDate,
      showOrderReference: inv.show_order_reference ?? DEFAULT_INVOICE_DETAILS.showOrderReference,
      showPoNumber: inv.show_po_number ?? DEFAULT_INVOICE_DETAILS.showPoNumber,
      showEwayBillNumber: inv.show_eway_bill_number ?? DEFAULT_INVOICE_DETAILS.showEwayBillNumber,
      showVehicleNumber: inv.show_vehicle_number ?? DEFAULT_INVOICE_DETAILS.showVehicleNumber,
    },
    partyDetails: {
      showCustomerName: party.show_customer_name ?? DEFAULT_PARTY_DETAILS.showCustomerName,
      showCustomerGstin: party.show_customer_gstin ?? DEFAULT_PARTY_DETAILS.showCustomerGstin,
      showBillingAddress: party.show_billing_address ?? DEFAULT_PARTY_DETAILS.showBillingAddress,
      showShippingAddress: party.show_shipping_address ?? DEFAULT_PARTY_DETAILS.showShippingAddress,
      showCustomerPhone: party.show_customer_phone ?? DEFAULT_PARTY_DETAILS.showCustomerPhone,
    },
    itemTable: {
      showProductImage: item.show_product_image ?? DEFAULT_ITEM_TABLE.showProductImage,
      showDescription: item.show_description ?? DEFAULT_ITEM_TABLE.showDescription,
      columns: Array.isArray(item.columns) && item.columns.length > 0 ? item.columns : [...DEFAULT_ITEM_TABLE.columns],
    },
    paymentDetails: {
      showBankDetails: pay.show_bank_details ?? DEFAULT_PAYMENT_DETAILS.showBankDetails,
      showUpiQr: pay.show_upi_qr ?? DEFAULT_PAYMENT_DETAILS.showUpiQr,
    },
    // Canonical terms/footer/notes source - the backend's top-level `terms`/`footer_text`/`notes`
    // are a legacy duplicate `footer.*` already wins over in every PDF render (see
    // _invoice_footer in pdf_docs.py: `footer_cfg.get("terms") or settings.get("terms")`), so this
    // is the ONE place the UI reads/writes them - never the top-level fields, no competing copies.
    footer: {
      showTerms: foot.show_terms ?? DEFAULT_FOOTER.showTerms,
      showSignature: foot.show_signature ?? DEFAULT_FOOTER.showSignature,
      showStamp: foot.show_stamp ?? DEFAULT_FOOTER.showStamp,
      terms: foot.terms ?? settings.terms ?? '',
      footerText: foot.footer_text ?? settings.footer_text ?? '',
      notes: foot.notes ?? settings.notes ?? '',
    },
    regularPrint: {
      layout: reg.layout || DEFAULT_REGULAR_PRINT.layout,
      paperSize: reg.paper_size || DEFAULT_REGULAR_PRINT.paperSize,
      orientation: reg.orientation || DEFAULT_REGULAR_PRINT.orientation,
      marginTop: reg.margin_top ?? DEFAULT_REGULAR_PRINT.marginTop,
      marginRight: reg.margin_right ?? DEFAULT_REGULAR_PRINT.marginRight,
      marginBottom: reg.margin_bottom ?? DEFAULT_REGULAR_PRINT.marginBottom,
      marginLeft: reg.margin_left ?? DEFAULT_REGULAR_PRINT.marginLeft,
    },
    thermalPrint: {
      layout: thermal.layout || DEFAULT_THERMAL_PRINT.layout,
      paperWidth: thermal.paper_width || DEFAULT_THERMAL_PRINT.paperWidth,
      printingType: thermal.printing_type || DEFAULT_THERMAL_PRINT.printingType,
      boldText: thermal.bold_text ?? DEFAULT_THERMAL_PRINT.boldText,
      autoCut: thermal.auto_cut ?? DEFAULT_THERMAL_PRINT.autoCut,
      openCashDrawer: thermal.open_cash_drawer ?? DEFAULT_THERMAL_PRINT.openCashDrawer,
      extraLines: thermal.extra_lines ?? DEFAULT_THERMAL_PRINT.extraLines,
      copies: thermal.copies ?? DEFAULT_THERMAL_PRINT.copies,
    },
  }
}

export async function getInvoiceSettings() {
  if (INVOICE_DEMO_ENABLED) {
    return { success: true, settings: normalizeInvoiceSettings({}) }
  }

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
  if (INVOICE_DEMO_ENABLED) {
    return { success: true, settings: normalizeInvoiceSettings(denormalizeInvoiceSettings(payload)) }
  }

  try {
    const requestBody = denormalizeInvoiceSettings(payload)

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

// `fields` (14 flat booleans) predates the nested blocks below, and pdf_docs.py has each nested
// block win over its `fields` counterpart when both are present (e.g.
// `payment_cfg.get("show_bank_details", fields.get("show_bank_details", True))`) - so once this
// UI always sends the nested blocks, the overlapping flat keys become inert. Rather than expose
// two controls for one visual outcome, this derives them FROM the nested state so `fields` never
// holds a stale/contradictory value. show_discount/show_tax_amount have no nested equivalent
// (they gate the Subtotal/Discount/Tax summary rows, not a column) and get their own control in
// the Item Table section, so they pass through untouched. show_hsn_sac/show_mrp/
// show_batch_number/show_expiry_date are never read anywhere in pdf_docs.py any more (superseded
// by item_table.columns membership) - kept only so the stored shape stays complete.
function deriveFlatFields(settings) {
  return {
    ...settings.fields,
    show_company_gstin: settings.businessDetails.showGstin,
    show_customer_gstin: settings.partyDetails.showCustomerGstin,
    show_billing_address: settings.partyDetails.showBillingAddress,
    show_shipping_address: settings.partyDetails.showShippingAddress,
    show_bank_details: settings.paymentDetails.showBankDetails,
    show_upi_qr: settings.paymentDetails.showUpiQr,
    show_terms: settings.footer.showTerms,
    show_signature: settings.footer.showSignature,
  }
}

// The reverse of normalizeInvoiceSettings - only ever called with a full, already-normalized
// settings object (camelCase), so every nested block is always present and this can send the
// whole shape on every save without guessing which keys changed.
function denormalizeInvoiceSettings(settings) {
  return {
    template: settings.template,
    // See normalizeInvoiceSettings - sent unconditionally like every other field here (this
    // function always receives a full, already-normalized object), harmless no-op against the
    // current backend (unknown Pydantic fields are ignored, not rejected - confirmed by reading
    // app/schemas/workflow_settings.py: no model forbids extra fields) until template_variant
    // exists server-side, at which point it starts persisting with no frontend change needed.
    template_variant: settings.templateVariant || null,
    paper_size: settings.paperSize,
    branding: {
      logo_file_id: settings.branding.logoFileId || null,
      signature_file_id: settings.branding.signatureFileId || null,
      stamp_file_id: settings.branding.stampFileId || null,
      payment_qr_file_id: settings.branding.paymentQrFileId || null,
      primary_color: settings.branding.primaryColor || null,
    },
    fields: deriveFlatFields(settings),
    typography: {
      font_family: settings.typography.fontFamily,
      heading_size: settings.typography.headingSize,
      body_size: settings.typography.bodySize,
      table_size: settings.typography.tableSize,
    },
    business_details: {
      show_business_name: settings.businessDetails.showBusinessName,
      show_logo: settings.businessDetails.showLogo,
      show_address: settings.businessDetails.showAddress,
      show_phone: settings.businessDetails.showPhone,
      show_email: settings.businessDetails.showEmail,
      show_gstin: settings.businessDetails.showGstin,
      show_pan: settings.businessDetails.showPan,
    },
    invoice_details: {
      show_invoice_number: settings.invoiceDetails.showInvoiceNumber,
      show_invoice_date: settings.invoiceDetails.showInvoiceDate,
      show_due_date: settings.invoiceDetails.showDueDate,
      show_order_reference: settings.invoiceDetails.showOrderReference,
      show_po_number: settings.invoiceDetails.showPoNumber,
      show_eway_bill_number: settings.invoiceDetails.showEwayBillNumber,
      show_vehicle_number: settings.invoiceDetails.showVehicleNumber,
    },
    party_details: {
      show_customer_name: settings.partyDetails.showCustomerName,
      show_customer_gstin: settings.partyDetails.showCustomerGstin,
      show_billing_address: settings.partyDetails.showBillingAddress,
      show_shipping_address: settings.partyDetails.showShippingAddress,
      show_customer_phone: settings.partyDetails.showCustomerPhone,
    },
    item_table: {
      show_product_image: settings.itemTable.showProductImage,
      show_description: settings.itemTable.showDescription,
      columns: settings.itemTable.columns,
    },
    payment_details: {
      show_bank_details: settings.paymentDetails.showBankDetails,
      show_upi_qr: settings.paymentDetails.showUpiQr,
    },
    footer: {
      show_terms: settings.footer.showTerms,
      show_signature: settings.footer.showSignature,
      show_stamp: settings.footer.showStamp,
      terms: settings.footer.terms || null,
      footer_text: settings.footer.footerText || null,
      notes: settings.footer.notes || null,
    },
    regular_print: {
      layout: settings.regularPrint.layout,
      paper_size: settings.regularPrint.paperSize,
      orientation: settings.regularPrint.orientation,
      margin_top: settings.regularPrint.marginTop,
      margin_right: settings.regularPrint.marginRight,
      margin_bottom: settings.regularPrint.marginBottom,
      margin_left: settings.regularPrint.marginLeft,
    },
    thermal_print: {
      layout: settings.thermalPrint.layout,
      paper_width: settings.thermalPrint.paperWidth,
      printing_type: settings.thermalPrint.printingType,
      bold_text: settings.thermalPrint.boldText,
      auto_cut: settings.thermalPrint.autoCut,
      open_cash_drawer: settings.thermalPrint.openCashDrawer,
      extra_lines: settings.thermalPrint.extraLines,
      copies: settings.thermalPrint.copies,
    },
  }
}
