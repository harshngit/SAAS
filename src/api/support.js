import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { uploadFile } from './files'

// =============================================================================
// Org-side Support Tickets API (GET/POST /support/tickets...).
// Org Admins see every ticket in their organization; Staff see only the tickets they
// personally raised - that scoping is enforced server-side, not here. Someone else's ticket
// (or another org's) 404s rather than 403, which the UI shows as a plain "not found".
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
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }
  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const TICKET_CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'billing', label: 'Billing' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'how_to', label: 'How To' },
  { value: 'other', label: 'Other' },
]

export const TICKET_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const TICKET_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_customer', label: 'Waiting on You' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function requestError(error, fallback) {
  const status = error.response?.status
  const data = error.response?.data
  const detail = data?.detail ?? data?.message ?? data?.error ?? data
  // Every status here must surface the backend's own wording verbatim (429 limit, 409 reopen
  // rules, 400/422 attachment validation) - never collapsed into a generic message.
  return { status, error: formatApiError(detail, fallback) }
}

function normalizeAttachment(raw) {
  if (!raw) return raw
  return {
    id: raw.id,
    fileId: raw.file_id,
    messageId: raw.message_id || null,
    filename: raw.filename || '',
    contentType: raw.content_type || '',
    size: raw.size ?? 0,
    url: raw.url || '',
  }
}

function normalizeMessage(raw) {
  if (!raw) return raw
  return {
    id: raw.id,
    authorType: raw.author_type || 'platform',
    authorName: raw.author_name || '',
    body: raw.body || '',
    createdAt: raw.created_at || null,
    attachments: (raw.attachments || []).map(normalizeAttachment),
  }
}

function normalizeTicket(raw) {
  if (!raw) return raw
  return {
    id: raw.id,
    ticketNumber: raw.ticket_number || '',
    subject: raw.subject || '',
    description: raw.description || '',
    category: raw.category || 'other',
    priority: raw.priority || 'medium',
    status: raw.status || 'open',
    createdByUserId: raw.created_by_user_id || '',
    createdByName: raw.created_by_name || '',
    assignedToUserId: raw.assigned_to_user_id || null,
    assignedToName: raw.assigned_to_name || '',
    lastActivityAt: raw.last_activity_at || raw.updated_at || null,
    resolvedAt: raw.resolved_at || null,
    closedAt: raw.closed_at || null,
    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
    attachments: (raw.attachments || []).map(normalizeAttachment),
    messages: (raw.messages || []).map(normalizeMessage),
  }
}

// Reusable upload step - the two Attachments bullets ("upload first, then send ids") always
// go through the same shared /files/upload endpoint every other upload in this app uses.
export async function uploadTicketAttachment(file) {
  const result = await uploadFile(file)
  if (!result.success) return result
  return {
    success: true,
    fileId: result.file.file_id || result.file.id,
    url: result.file.url,
    filename: result.file.filename || result.file.name || file.name,
    contentType: result.file.content_type || result.file.contentType || file.type,
    size: result.file.size ?? file.size,
  }
}

export async function createTicket({ subject, description, category, priority, attachmentFileIds }) {
  try {
    const body = {
      subject: (subject || '').trim(),
      description: (description || '').trim(),
      category,
    }
    if (priority) body.priority = priority
    if (attachmentFileIds?.length) body.attachment_file_ids = attachmentFileIds

    const { data } = await apiClient.post('/support/tickets', body, { headers: authHeader() })
    return { success: true, ticket: normalizeTicket(data) }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to create this ticket. Please try again.') }
  }
}

export async function listTickets(params = {}) {
  try {
    const queryParams = { page_size: params.page_size || 20 }
    if (params.page !== undefined) queryParams.page = params.page
    if (params.status) queryParams.status = params.status
    if (params.category) queryParams.category = params.category
    if (params.priority) queryParams.priority = params.priority
    if (params.search) queryParams.search = params.search

    const { data } = await apiClient.get('/support/tickets', { headers: authHeader(), params: queryParams })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return {
      success: true,
      tickets: rows.map(normalizeTicket),
      total: data?.total ?? rows.length,
      page: data?.page ?? params.page ?? 1,
      totalPages: data?.total_pages ?? 1,
    }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to load tickets. Please try again.') }
  }
}

export async function getTicket(ticketId) {
  try {
    const { data } = await apiClient.get(`/support/tickets/${encodeURIComponent(ticketId)}`, { headers: authHeader() })
    return { success: true, ticket: normalizeTicket(data) }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to load this ticket. Please try again.') }
  }
}

export async function replyToTicket(ticketId, { body, attachmentFileIds }) {
  try {
    const payload = { body: (body || '').trim() }
    if (attachmentFileIds?.length) payload.attachment_file_ids = attachmentFileIds

    const { data } = await apiClient.post(`/support/tickets/${encodeURIComponent(ticketId)}/messages`, payload, { headers: authHeader() })
    return { success: true, ticket: normalizeTicket(data) }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to send this reply. Please try again.') }
  }
}

export async function closeTicket(ticketId) {
  try {
    const { data } = await apiClient.post(`/support/tickets/${encodeURIComponent(ticketId)}/close`, {}, { headers: authHeader() })
    return { success: true, ticket: normalizeTicket(data) }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to close this ticket. Please try again.') }
  }
}

export async function reopenTicket(ticketId) {
  try {
    const { data } = await apiClient.post(`/support/tickets/${encodeURIComponent(ticketId)}/reopen`, {}, { headers: authHeader() })
    return { success: true, ticket: normalizeTicket(data) }
  } catch (error) {
    return { success: false, ...requestError(error, 'Unable to reopen this ticket. Please try again.') }
  }
}
