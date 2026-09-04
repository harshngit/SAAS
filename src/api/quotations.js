import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
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

export const QUOTATION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
]

function buildItemBody(item) {
  const body = {
    product_id: item.productId || item.product_id,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unitPrice ?? item.unit_price) || 0,
    discount: Number(item.discount) || 0,
  }

  const variantId = item.variantId || item.variant_id
  if (variantId) body.variant_id = variantId

  const uom = item.uom
  if (uom) body.uom = uom

  const taxRate = item.taxRate ?? item.tax_rate
  if (taxRate !== undefined && taxRate !== '') body.tax_rate = Number(taxRate)

  return body
}

function buildQuotationBody(payload) {
  // A quotation has EXACTLY ONE party: customer_id XOR lead_id (crm_changes Phase 2 §3).
  // Send whichever the caller supplied; never send both.
  const customerId = payload.customerId || payload.customer_id || null
  const leadId = payload.leadId || payload.lead_id || null

  const body = {
    quotation_date: payload.quotationDate || payload.quotation_date || undefined,
    currency: payload.currency || 'INR',
    status: payload.status || 'draft',
    items: (payload.items || []).map(buildItemBody),
  }

  if (leadId && !customerId) {
    body.lead_id = leadId
  } else {
    body.customer_id = customerId
  }

  if (payload.validUntil || payload.valid_until) body.valid_until = payload.validUntil || payload.valid_until
  if (payload.billingAddress || payload.billing_address) body.billing_address = payload.billingAddress || payload.billing_address
  if (payload.shippingAddress || payload.shipping_address) body.shipping_address = payload.shippingAddress || payload.shipping_address
  if (payload.salespersonId || payload.salesperson_id) body.salesperson_id = payload.salespersonId || payload.salesperson_id
  if (payload.paymentTerms || payload.payment_terms) body.payment_terms = payload.paymentTerms || payload.payment_terms
  if (payload.deliveryTerms || payload.delivery_terms) body.delivery_terms = payload.deliveryTerms || payload.delivery_terms
  if (payload.notes) body.notes = payload.notes
  if (payload.termsConditions || payload.terms_conditions) body.terms_conditions = payload.termsConditions || payload.terms_conditions

  return body
}

function normalizeQuotationItem(item) {
  if (!item) return item

  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    productName: item.product_name || '',
    quantity: item.quantity ?? 0,
    uom: item.uom || '',
    unitPrice: item.unit_price ?? 0,
    discount: item.discount ?? 0,
    taxRate: item.tax_rate ?? 0,
    taxAmount: item.tax_amount ?? 0,
    lineTotal: item.line_total ?? 0,
  }
}

function normalizeQuotation(quotation) {
  if (!quotation) return quotation

  return {
    id: quotation.id,
    quotationNumber: quotation.quotation_number || quotation.id,
    quotationDate: quotation.quotation_date,
    validUntil: quotation.valid_until,
    customerId: quotation.customer_id || quotation.customer?.id || '',
    customerName: quotation.customer?.name || quotation.customer?.customer_name || '',
    // Lead party (crm_changes Phase 2). A quotation is linked to a lead OR a customer.
    // `lead_id` persists as a historical reference even after the lead becomes a customer.
    leadId: quotation.lead_id || quotation.lead?.id || '',
    leadName: quotation.lead?.name || '',
    lead: quotation.lead
      ? {
          id: quotation.lead.id,
          name: quotation.lead.name || '',
          contactPerson: quotation.lead.contact_person || '',
          mobileNumber: quotation.lead.mobile_number || '',
          email: quotation.lead.email || '',
          leadSource: quotation.lead.lead_source || '',
          leadStatus: quotation.lead.lead_status || '',
        }
      : null,
    billingAddress: quotation.billing_address || '',
    shippingAddress: quotation.shipping_address || '',
    salespersonId: quotation.salesperson_id || quotation.salesperson?.id || '',
    salespersonName: quotation.salesperson?.name || '',
    currency: quotation.currency || 'INR',
    paymentTerms: quotation.payment_terms || '',
    deliveryTerms: quotation.delivery_terms || '',
    notes: quotation.notes || '',
    termsConditions: quotation.terms_conditions || '',
    status: quotation.status || 'draft',
    items: (quotation.items || []).map(normalizeQuotationItem),
    itemCount: quotation.item_count ?? quotation.items?.length ?? 0,
    subtotal: quotation.subtotal ?? 0,
    taxTotal: quotation.tax_total ?? 0,
    total: quotation.total ?? 0,
    convertedOrderId: quotation.converted_order_id || null,
    convertedAt: quotation.converted_at || null,
    createdAt: quotation.created_at,
    updatedAt: quotation.updated_at,
  }
}

export async function listQuotations() {
  try {
    const { data } = await apiClient.get('/quotations', {
      headers: authHeader(),
    })

    const quotations = Array.isArray(data) ? data : data?.quotations || []
    return { success: true, quotations: quotations.map(normalizeQuotation) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load quotations. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getQuotation(quotationId) {
  try {
    const { data } = await apiClient.get(`/quotations/${quotationId}`, {
      headers: authHeader(),
    })

    return { success: true, quotation: normalizeQuotation(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load quotation details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createQuotation(payload) {
  try {
    const { data } = await apiClient.post('/quotations', buildQuotationBody(payload), {
      headers: authHeader(),
    })

    return { success: true, quotation: normalizeQuotation(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create quotation. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateQuotation(quotationId, payload) {
  try {
    const { data } = await apiClient.patch(`/quotations/${quotationId}`, buildQuotationBody(payload), {
      headers: authHeader(),
    })

    return { success: true, quotation: normalizeQuotation(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update quotation. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateQuotationStatus(quotationId, status) {
  try {
    const { data } = await apiClient.patch(`/quotations/${quotationId}`, { status }, {
      headers: authHeader(),
    })

    return { success: true, quotation: normalizeQuotation(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update quotation status. Please try again.',
    )

    return { success: false, error: message }
  }
}

// NOTE: the frontend does NOT manually link a customer to a lead quotation. When a lead is
// converted to a customer the backend auto-attaches the new customer_id to that lead's
// quotations (crm_changes Phase 3 §3); callers just refetch the quotation.

export async function convertQuotationToOrder(quotationId, payload = {}) {
  try {
    const requestBody = {}
    if (payload.warehouseId || payload.warehouse_id) requestBody.warehouse_id = payload.warehouseId || payload.warehouse_id
    if (payload.deliveryDate || payload.delivery_date) requestBody.delivery_date = payload.deliveryDate || payload.delivery_date
    requestBody.fulfilment_method = payload.fulfilmentMethod || payload.fulfilment_method || 'delivery'
    if (payload.paymentType || payload.payment_type) requestBody.payment_type = payload.paymentType || payload.payment_type
    if (payload.paymentTermsDays !== undefined || payload.payment_terms_days !== undefined) {
      requestBody.payment_terms_days = Number(payload.paymentTermsDays ?? payload.payment_terms_days) || 0
    }

    const { data } = await apiClient.post(`/quotations/${quotationId}/convert-to-order`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, conversion: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to convert quotation to an order. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function downloadQuotationPdf(quotationId, quotationNumber) {
  try {
    const response = await apiClient.get(`/quotations/${quotationId}/pdf`, {
      headers: authHeader(),
      responseType: 'blob',
    })

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${quotationNumber || quotationId}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to download quotation PDF. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteQuotation(quotationId) {
  try {
    await apiClient.delete(`/quotations/${quotationId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete quotation. Please try again.',
    )

    return { success: false, error: message }
  }
}
