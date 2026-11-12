import { platformRequest } from './platform'

// =============================================================================
// Platform-side Support Tickets API (/platform/support/...) - Super Admin and Sales Manager
// only. Unlike the org side, the detail response includes every message, internal notes
// included (`is_internal: true`), and PATCH can change status/priority/assigned_to_user_id.
// Platform replies never take attachments - there is no upload step on this side at all.
// =============================================================================

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
    isInternal: Boolean(raw.is_internal),
    createdAt: raw.created_at || null,
    attachments: (raw.attachments || []).map(normalizeAttachment),
  }
}

function normalizeTicket(raw) {
  if (!raw) return raw
  return {
    id: raw.id,
    ticketNumber: raw.ticket_number || '',
    organizationId: raw.organization_id || '',
    organizationName: raw.organization_name || '',
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

function query(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
}

export async function getPlatformSupportSummary() {
  const result = await platformRequest('get', '/support/summary')
  if (!result.success) return result
  const data = result.data || {}
  return {
    success: true,
    total: data.total ?? 0,
    byStatus: data.by_status || {},
    byPriority: data.by_priority || {},
    unassigned: data.unassigned ?? 0,
    noPublicReplyOver24h: data.no_public_reply_over_24h ?? 0,
  }
}

export async function listPlatformSupportTickets(params = {}) {
  const result = await platformRequest('get', '/support/tickets', {
    params: query({
      organization_id: params.organizationId,
      status: params.status,
      priority: params.priority,
      category: params.category,
      assigned_to_user_id: params.assignedToUserId,
      assigned_to_me: params.assignedToMe,
      unassigned: params.unassigned,
      search: params.search,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      page: params.page,
      page_size: params.pageSize || 20,
    }),
  })
  if (!result.success) return result
  const data = result.data
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return {
    success: true,
    tickets: rows.map(normalizeTicket),
    total: data?.total ?? rows.length,
    page: data?.page ?? params.page ?? 1,
    totalPages: data?.total_pages ?? 1,
  }
}

export async function getPlatformSupportTicket(ticketId) {
  const result = await platformRequest('get', `/support/tickets/${encodeURIComponent(ticketId)}`)
  if (!result.success) return result
  return { success: true, ticket: normalizeTicket(result.data) }
}

// Any of { status, priority, assignedToUserId } - null unassigns. Only the fields actually
// passed are sent, so a partial update never clobbers a field the caller didn't touch.
export async function updatePlatformSupportTicket(ticketId, { status, priority, assignedToUserId } = {}) {
  const body = {}
  if (status !== undefined) body.status = status
  if (priority !== undefined) body.priority = priority
  if (assignedToUserId !== undefined) body.assigned_to_user_id = assignedToUserId

  const result = await platformRequest('patch', `/support/tickets/${encodeURIComponent(ticketId)}`, { body })
  if (!result.success) return result
  return { success: true, ticket: normalizeTicket(result.data) }
}

// is_internal defaults false (a public reply, which moves open -> in_progress server-side).
// Never pass attachments here - the platform side has no upload step.
export async function replyToPlatformSupportTicket(ticketId, { body, isInternal = false }) {
  const result = await platformRequest('post', `/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
    body: { body: (body || '').trim(), is_internal: isInternal },
  })
  if (!result.success) return result
  return { success: true, ticket: normalizeTicket(result.data) }
}
