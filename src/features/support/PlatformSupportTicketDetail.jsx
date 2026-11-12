import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import AttachmentChipList from './AttachmentChipList'
import { getPlatformSupportTicket, replyToPlatformSupportTicket, updatePlatformSupportTicket } from '../../api/platformSupport'
import { listPlatformStaff } from '../../api/platform'
import { useAuthStore } from '../../store/authStore'
import { platformRoleForUser } from '../../auth/platformRoles'
import { formatDateTime } from '../../utils/format'
import { TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS } from '../../api/support'
import {
  TICKET_PRIORITY_VARIANT,
  TICKET_STATUS_VARIANT,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from './supportHelpers'

export default function PlatformSupportTicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSuperAdmin = platformRoleForUser(currentUser) === 'super_admin'
  const basePath = isSuperAdmin ? '/superadmin' : '/platform'

  const [ticket, setTicket] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [staff, setStaff] = useState([])

  const [replyBody, setReplyBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  const [controlError, setControlError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    getPlatformSupportTicket(id).then((result) => {
      if (!result.success) {
        setTicket(null)
        setLoadError(result.error)
      } else {
        setTicket(result.ticket)
      }
      setIsLoading(false)
    })
  }, [id])

  useEffect(() => { load() }, [load])

  // Only Super Admin can assign to anyone else, so only Super Admin needs the full roster.
  useEffect(() => {
    if (!isSuperAdmin) return
    listPlatformStaff({ page_size: 100 }).then((result) => {
      if (result.success) setStaff(result.staff)
    })
  }, [isSuperAdmin])

  const applyUpdate = async (patch, errorFallback) => {
    if (isUpdating) return
    setIsUpdating(true)
    setControlError('')
    const result = await updatePlatformSupportTicket(id, patch)
    setIsUpdating(false)
    if (!result.success) {
      setControlError(result.error || errorFallback)
      return
    }
    setTicket(result.ticket)
  }

  const handleReply = async () => {
    if (isReplying || !replyBody.trim()) return
    setIsReplying(true)
    setReplyError('')
    const result = await replyToPlatformSupportTicket(id, { body: replyBody, isInternal })
    setIsReplying(false)
    if (!result.success) {
      setReplyError(result.error)
      return
    }
    setTicket(result.ticket)
    setReplyBody('')
    setIsInternal(false)
  }

  if (isLoading) {
    return <LoadingSpinner variant="detail" label="Loading ticket…" />
  }

  if (!ticket) {
    return (
      <Card>
        <EmptyState title="Ticket not found" description={loadError || 'This ticket may not exist.'} action={{ label: 'Back to Tickets', onClick: () => navigate(`${basePath}/support-tickets`) }} />
      </Card>
    )
  }

  const currentUserId = currentUser?.id

  return (
    <div className="listing-page space-y-4">
      <button type="button" onClick={() => navigate(`${basePath}/support-tickets`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Tickets
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-400">{ticket.ticketNumber} · {ticket.organizationName}</p>
            <h1 className="mt-0.5 text-lg font-semibold text-neutral-900">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={TICKET_STATUS_VARIANT[ticket.status] || 'neutral'} dot>{ticketStatusLabel(ticket.status)}</Badge>
              <Badge variant={TICKET_PRIORITY_VARIANT[ticket.priority] || 'neutral'}>{ticketPriorityLabel(ticket.priority)}</Badge>
              <Badge variant="neutral">{ticketCategoryLabel(ticket.category)}</Badge>
            </div>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{ticket.description}</p>
        <AttachmentChipList attachments={ticket.attachments} className="mt-3" />
        <p className="mt-4 text-xs text-neutral-400">Raised by {ticket.createdByName} on {formatDateTime(ticket.createdAt)}</p>

        <div className="mt-5 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-3">
          <Select
            label="Status"
            options={TICKET_STATUS_OPTIONS}
            value={ticket.status}
            disabled={isUpdating}
            onChange={(event) => applyUpdate({ status: event.target.value }, 'Unable to update status.')}
          />
          <Select
            label="Priority"
            options={TICKET_PRIORITY_OPTIONS}
            value={ticket.priority}
            disabled={isUpdating}
            onChange={(event) => applyUpdate({ priority: event.target.value }, 'Unable to update priority.')}
          />
          {isSuperAdmin ? (
            <Select
              label="Assignee"
              options={[{ value: '', label: 'Unassigned' }, ...staff.map((member) => ({ value: member.id, label: member.name }))]}
              value={ticket.assignedToUserId || ''}
              disabled={isUpdating}
              onChange={(event) => applyUpdate({ assignedToUserId: event.target.value || null }, 'Unable to update the assignee.')}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Assignee</label>
              {ticket.assignedToUserId === currentUserId ? (
                <Button type="button" variant="outline" size="sm" disabled={isUpdating} onClick={() => applyUpdate({ assignedToUserId: null }, 'Unable to unassign.')}>Unassign</Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUpdating || Boolean(ticket.assignedToUserId)}
                  onClick={() => applyUpdate({ assignedToUserId: currentUserId }, 'Unable to assign to you.')}
                >
                  {ticket.assignedToUserId ? `Assigned to ${ticket.assignedToName}` : 'Assign to me'}
                </Button>
              )}
            </div>
          )}
        </div>
        {controlError && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{controlError}</div>
        )}
      </Card>

      <Card title="Conversation">
        <div className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-neutral-400">No replies yet.</p>
          ) : (
            ticket.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl px-4 py-3 text-sm ${
                  message.isInternal
                    ? 'border border-amber-200 bg-amber-50 text-amber-900'
                    : message.authorType === 'customer'
                      ? 'bg-neutral-100 text-neutral-800'
                      : 'bg-primary-50 text-primary-950'
                }`}
              >
                <p className="flex items-center gap-2 text-xs font-semibold">
                  {message.authorName || (message.authorType === 'customer' ? 'Customer' : 'Platform')}
                  {message.isInternal && <Badge variant="warning">Internal note</Badge>}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                <AttachmentChipList attachments={message.attachments} className="mt-2" />
                <p className="mt-1.5 text-[0.68rem] opacity-70">{formatDateTime(message.createdAt)}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
          <label className="text-sm font-medium text-neutral-700">Reply</label>
          <textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            maxLength={5000}
            placeholder={isInternal ? 'Internal note - the organization never sees this…' : 'Reply to the organization…'}
            className="h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
            Internal note (platform-only, the organization is never notified)
          </label>
          {replyError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{replyError}</div>
          )}
          <div className="flex justify-end">
            <Button type="button" loading={isReplying} disabled={!replyBody.trim()} onClick={handleReply}>
              <Send className="size-4" aria-hidden="true" />
              {isInternal ? 'Add Internal Note' : 'Send Reply'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
