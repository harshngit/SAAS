import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { parseMapsCoordinates } from './customers'

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

// Full status set (used for list badges + filters). The backend value stays `won`;
// the UI calls it "Converted" - it means the lead became a customer.
export const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
]

// The only statuses a user may set by hand. "Converted" (`won`) is applied automatically
// by the Convert-to-Customer flow, never chosen manually.
export const LEAD_MANUAL_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
]

// Backend-enforced lead status workflow (crm_changes Phase 1 §3 + latest addendum §7):
// forward moves only, `lost` may be reopened to contacted/qualified, `won` is terminal.
export const LEAD_STATUS_TRANSITIONS = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['lost'],
  lost: ['contacted', 'qualified'],
  won: [],
}

// Manual status <Select> options for a lead in `currentStatus`: the current value plus every
// transition the backend will accept. `won` returns just itself (locked).
export function manualStatusOptionsFor(currentStatus) {
  const status = currentStatus || 'new'
  if (status === 'won') return [{ value: 'won', label: 'Converted' }]
  const allowed = new Set([status, ...(LEAD_STATUS_TRANSITIONS[status] || [])])
  return LEAD_MANUAL_STATUS_OPTIONS.filter((option) => allowed.has(option.value))
}

export const LEAD_SOURCE_OPTIONS = [
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Data Calling', label: 'Data Calling' },
]

// What kind of business the lead is (carries over as the customer type on conversion).
export const LEAD_TYPE_OPTIONS = [
  'Retailer',
  'Distributor',
  'Wholesaler',
  'Restaurant',
  'Private Company',
  'Business',
  'Individual',
  'Other',
].map((value) => ({ value, label: value }))

// Commercial size / importance of the lead - kept separate from Lead Type.
export const LEAD_SEGMENT_OPTIONS = [
  'Small',
  'Medium',
  'Large',
  'Key / High Value',
  'Group Company',
].map((value) => ({ value, label: value }))

function buildLeadBody(payload) {
  const body = {
    lead_source: payload.leadSource || payload.lead_source || '',
    mobile_number: (payload.mobileNumber || payload.mobile_number || '').trim(),
    lead_status: payload.leadStatus || payload.lead_status || 'new',
  }

  // Lead <-> Customer relationship fields (`customer_id`, `converted_customer_id`) are NEVER
  // sent from the normal create/edit form (crm_changes Phase 1 §8/§14). That link is only
  // created by POST /leads/{id}/convert-to-customer.

  const assignedSalespersonId = payload.assignedSalespersonId || payload.assigned_salesperson_id
  if (assignedSalespersonId) body.assigned_salesperson_id = assignedSalespersonId

  if (payload.name !== undefined) body.name = payload.name?.trim() || ''
  if (payload.contactPerson !== undefined || payload.contact_person !== undefined) {
    body.contact_person = (payload.contactPerson ?? payload.contact_person)?.trim() || ''
  }
  if (payload.email !== undefined) body.email = payload.email?.trim() || ''
  // Interested products (crm_changes addendum §1). The form works in { id, name } objects
  // (`interestedProductList`); we derive BOTH payload fields from it - the normalized
  // `interested_product_ids` (real catalog matches) and the legacy `interested_product`
  // string (all names incl. free text). Backend prefers the ids and keeps the string.
  const list = payload.interestedProductList
  if (Array.isArray(list)) {
    body.interested_product_ids = list.filter((product) => product && product.id).map((product) => product.id)
    body.interested_product = list.map((product) => product && product.name).filter(Boolean).join(', ')
  } else {
    if (payload.interestedProduct !== undefined || payload.interested_product !== undefined) {
      body.interested_product = (payload.interestedProduct ?? payload.interested_product)?.trim() || ''
    }
    const productIds = payload.interestedProductIds ?? payload.interested_product_ids
    if (Array.isArray(productIds)) {
      body.interested_product_ids = productIds.filter(Boolean)
    }
  }
  if (payload.leadType !== undefined || payload.lead_type !== undefined) {
    body.lead_type = (payload.leadType ?? payload.lead_type) || ''
  }
  if (payload.segment !== undefined) body.segment = payload.segment || ''
  if (payload.notes !== undefined) body.notes = payload.notes?.trim() || ''

  return body
}

// The initial InterestedProductsField selection for a normalized lead: prefer the
// structured `interestedProducts` briefs, fall back to splitting the legacy text string.
export function leadInterestedProductList(lead) {
  if (!lead) return []
  if (Array.isArray(lead.interestedProducts) && lead.interestedProducts.length > 0) {
    return lead.interestedProducts.map((product) => ({
      id: product.id || null,
      name: product.name || '',
      sku: product.sku || '',
    }))
  }
  return String(lead.interestedProduct || '')
    .split(/\s*(?:,|;|\n|\||•)\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: null, name, sku: '' }))
}

function normalizeLead(lead) {
  if (!lead) return lead

  const customer = lead.customer || null
  const salesperson = lead.assigned_salesperson || null

  return {
    id: lead.id,
    leadId: lead.lead_id || lead.id,
    organizationId: lead.organization_id,
    name: lead.name || '',
    contactPerson: lead.contact_person || '',
    email: lead.email || '',
    interestedProduct: lead.interested_product || '',
    // Normalized multi-product relation (crm addendum §1). `interestedProducts` is a list of
    // { id, name, sku } briefs; `interestedProductIds` is the id-only list for form payloads.
    interestedProducts: Array.isArray(lead.interested_products)
      ? lead.interested_products.map((product) => ({
          id: product.id,
          name: product.name || product.product_name || '',
          sku: product.sku || '',
        }))
      : [],
    interestedProductIds: Array.isArray(lead.interested_product_ids)
      ? lead.interested_product_ids.filter(Boolean)
      : (Array.isArray(lead.interested_products) ? lead.interested_products.map((p) => p.id).filter(Boolean) : []),
    leadType: lead.lead_type || lead.type || '',
    segment: lead.segment || lead.customer_segment || '',
    notes: lead.notes || '',
    leadSource: lead.lead_source || '',
    leadStatus: lead.lead_status || 'new',
    mobileNumber: lead.mobile_number || '',
    customerId: lead.customer_id || customer?.id || '',
    customerName: customer?.name || customer?.customer_name || '',
    convertedCustomerId: lead.converted_customer_id || '',
    convertedAt: lead.converted_at || null,
    assignedSalespersonId: lead.assigned_salesperson_id || salesperson?.id || '',
    assignedSalespersonName: salesperson?.name || '',
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  }
}

export async function listLeads(params = {}) {
  try {
    // All filters are optional & additive (crm_changes Phase 1 §11-12). Existing callers
    // that pass nothing keep working; the backend default limit is 100.
    const queryParams = {}
    if (params.status) queryParams.status = params.status
    if (params.search) queryParams.search = params.search
    if (params.leadSource || params.lead_source) queryParams.lead_source = params.leadSource || params.lead_source
    if (params.assignedSalespersonId || params.assigned_salesperson_id) {
      queryParams.assigned_salesperson_id = params.assignedSalespersonId || params.assigned_salesperson_id
    }
    if (params.createdFrom || params.created_from) queryParams.created_from = params.createdFrom || params.created_from
    if (params.createdTo || params.created_to) queryParams.created_to = params.createdTo || params.created_to
    if (params.limit != null) queryParams.limit = params.limit
    if (params.offset != null) queryParams.offset = params.offset

    const { data } = await apiClient.get('/leads', {
      headers: authHeader(),
      params: queryParams,
    })

    const leads = Array.isArray(data) ? data : data?.leads || []
    return { success: true, leads: leads.map(normalizeLead) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load leads. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getLead(leadId) {
  try {
    const { data } = await apiClient.get(`/leads/${leadId}`, {
      headers: authHeader(),
    })

    return { success: true, lead: normalizeLead(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load lead details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createLead(payload) {
  try {
    const { data } = await apiClient.post('/leads', buildLeadBody(payload), {
      headers: authHeader(),
    })

    return { success: true, lead: normalizeLead(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create lead. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateLead(leadId, payload) {
  try {
    const { data } = await apiClient.patch(`/leads/${leadId}`, buildLeadBody(payload), {
      headers: authHeader(),
    })

    return { success: true, lead: normalizeLead(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update lead. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function convertLeadToCustomer(leadId, payload = {}) {
  try {
    const body = {}

    if (payload.name) body.name = payload.name.trim()
    if (payload.businessName) body.business_name = payload.businessName.trim()
    if (payload.phone) body.phone = payload.phone.trim()
    if (payload.email) body.email = payload.email.trim()
    if (payload.gstNumber) body.gst_number = payload.gstNumber.trim()
    if (payload.billingAddress) body.billing_address = payload.billingAddress.trim()
    if (payload.deliveryAddress) body.delivery_address = payload.deliveryAddress.trim()
    if (payload.assignedSalesOfficerId) body.assigned_sales_officer_id = payload.assignedSalesOfficerId
    if (payload.creditLimit !== undefined && payload.creditLimit !== '') body.credit_limit = Number(payload.creditLimit) || 0
    if (payload.openingBalance !== undefined && payload.openingBalance !== '') body.opening_balance = Number(payload.openingBalance) || 0
    if (payload.category) body.category = payload.category
    if (payload.notes) body.notes = payload.notes.trim()
    if (payload.primaryContactPerson) body.primary_contact_person = payload.primaryContactPerson.trim()

    // Backend's LeadConvertToCustomerIn now accepts these 4 fields directly (confirmed live
    // against the OpenAPI schema), so they go in the same single convert call - no more
    // fetch-then-patch round trip needed.
    if (payload.customerType) body.customer_type = payload.customerType
    if (payload.customerSince) body.customer_since = payload.customerSince
    if (payload.status) body.status = payload.status

    const coordinates = parseMapsCoordinates(payload.googleMapsLocation)
    if (coordinates) {
      body.maps_latitude = coordinates.lat
      body.maps_longitude = coordinates.lng
    }

    const { data } = await apiClient.post(`/leads/${leadId}/convert-to-customer`, body, {
      headers: authHeader(),
    })

    return {
      success: true,
      leadId: data?.lead_id || leadId,
      customerId: data?.customer_id || data?.customer?.id || '',
      leadStatus: data?.lead_status || 'won',
      converted: data?.converted !== false,
      customer: data?.customer || null,
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to convert this lead to a customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteLead(leadId) {
  try {
    await apiClient.delete(`/leads/${leadId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete lead. Please try again.',
    )

    return { success: false, error: message }
  }
}
