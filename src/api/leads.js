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

// Backend LeadCreate/LeadUpdate only model: source, an optional link to an existing customer,
// a contact mobile number, assignment, and status - there is no room for free-text prospect
// name/email/budget/products/notes, so the form only collects what actually persists.
export const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won', label: 'Won' },
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
    leadSource: lead.lead_source || '',
    leadStatus: lead.lead_status || 'new',
    mobileNumber: lead.mobile_number || '',
    customerId: lead.customer_id || customer?.id || '',
    customerName: customer?.name || customer?.customer_name || '',
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
    const { data } = await apiClient.put(`/leads/${leadId}`, buildLeadBody(payload), {
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
