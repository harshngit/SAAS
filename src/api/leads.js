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

// The only statuses a user may set by hand. "Converted" is applied automatically
// by the Convert-to-Customer flow, never chosen manually.
export const LEAD_MANUAL_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
]

export const LEAD_SOURCE_OPTIONS = [
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Data Calling', label: 'Data Calling' },
]

function buildLeadBody(payload) {
  const body = {
    lead_source: payload.leadSource || payload.lead_source || '',
    mobile_number: (payload.mobileNumber || payload.mobile_number || '').trim(),
    lead_status: payload.leadStatus || payload.lead_status || 'new',
  }

  const customerId = payload.customerId || payload.customer_id
  if (customerId) body.customer_id = customerId

  const assignedSalespersonId = payload.assignedSalespersonId || payload.assigned_salesperson_id
  if (assignedSalespersonId) body.assigned_salesperson_id = assignedSalespersonId

  if (payload.name !== undefined) body.name = payload.name?.trim() || ''
  if (payload.contactPerson !== undefined || payload.contact_person !== undefined) {
    body.contact_person = (payload.contactPerson ?? payload.contact_person)?.trim() || ''
  }
  if (payload.email !== undefined) body.email = payload.email?.trim() || ''
  if (payload.interestedProduct !== undefined || payload.interested_product !== undefined) {
    body.interested_product = (payload.interestedProduct ?? payload.interested_product)?.trim() || ''
  }
  if (payload.notes !== undefined) body.notes = payload.notes?.trim() || ''

  return body
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
    const queryParams = {}
    if (params.status) queryParams.status = params.status

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
