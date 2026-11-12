import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, RotateCw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import TicketAttachmentsField from './TicketAttachmentsField'
import AttachmentChipList from './AttachmentChipList'
import { closeTicket, getTicket, reopenTicket, replyToTicket } from '../../api/support'
import { formatDateTime } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import {
  TICKET_PRIORITY_VARIANT,
  TICKET_STATUS_VARIANT,
  canReply,
  isWithinReopenWindow,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from './supportHelpers'

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [ticket, setTicket] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replyAttachments, setReplyAttachments] = useState([])
  const [replyError, setReplyError] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    getTicket(id).then((result) => {
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

  const handleReply = async () => {
    if (isReplying || !replyBody.trim()) return
    setIsReplying(true)
    setReplyError('')
    const result = await replyToTicket(id, { body: replyBody, attachmentFileIds: replyAttachments.map((a) => a.fileId) })
    setIsReplying(false)
    if (!result.success) {
      // Verbatim backend text - including the 409 "Reopen window expired..." case.
      setReplyError(result.error)
      return
    }
    setTicket(result.ticket)
    setReplyBody('')
    setReplyAttachments([])
    showToast({ title: 'Reply sent' })
  }

  const handleClose = async () => {
    if (isClosing) return
    setIsClosing(true)
    setActionError('')
    const result = await closeTicket(id)
    setIsClosing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setTicket(result.ticket)
    showToast({ title: 'Ticket closed' })
  }

  const handleReopen = async () => {
    if (isReopening) return
    setIsReopening(true)
    setActionError('')
    const result = await reopenTicket(id)
    setIsReopening(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setTicket(result.ticket)
    showToast({ title: 'Ticket reopened' })
  }

  if (isLoading) {
    return <LoadingSpinner variant="detail" label="Loading ticket…" />
  }

  if (!ticket) {
    return (
      <Card>
        <EmptyState title="Ticket not found" description={loadError || 'This ticket may not exist, or belongs to someone else.'} action={{ label: 'Back to Tickets', onClick: () => navigate('/admin/settings/help') }} />
      </Card>
    )
  }

  const isClosed = ticket.status === 'closed'
  const isResolved = ticket.status === 'resolved'
  const reopenEligibleStatus = isClosed || isResolved
  const withinReopenWindow = isWithinReopenWindow(ticket)
  const showReopen = reopenEligibleStatus && withinReopenWindow
  // Resolved/closed but past the 7-day window - Reopen hides rather than being left clickable
  // to 409, and the reason is shown explicitly instead of the button just silently vanishing.
  const showReopenExpiredHint = reopenEligibleStatus && !withinReopenWindow
  const showClose = !isClosed
  const replyAllowed = canReply(ticket)

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-400">{ticket.ticketNumber}</p>
            <h1 className="mt-0.5 text-lg font-semibold text-neutral-900">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={TICKET_STATUS_VARIANT[ticket.status] || 'neutral'} dot>{ticketStatusLabel(ticket.status)}</Badge>
              <Badge variant={TICKET_PRIORITY_VARIANT[ticket.priority] || 'neutral'}>{ticketPriorityLabel(ticket.priority)}</Badge>
              <Badge variant="neutral">{ticketCategoryLabel(ticket.category)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showClose && (
              <Button type="button" variant="outline" size="sm" loading={isClosing} onClick={handleClose}>Close Ticket</Button>
            )}
            {showReopen && (
              <Button type="button" variant="outline" size="sm" loading={isReopening} onClick={handleReopen}>
                <RotateCw className="size-4" aria-hidden="true" />
                Reopen
              </Button>
            )}
          </div>
        </div>
        {showReopenExpiredHint && (
          <p className="mt-2 text-xs text-neutral-400">Reopen window expired, please raise a new ticket.</p>
        )}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{ticket.description}</p>
        <AttachmentChipList attachments={ticket.attachments} className="mt-3" />
        <p className="mt-4 text-xs text-neutral-400">
          Raised by {ticket.createdByName || 'you'} on {formatDateTime(ticket.createdAt)}
          {ticket.assignedToName ? ` · Assigned to ${ticket.assignedToName}` : ''}
        </p>
        {actionError && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
        )}
      </Card>

      <Card title="Conversation">
        <div className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-neutral-400">No replies yet.</p>
          ) : (
            ticket.messages.map((message) => (
              <div key={message.id} className={`flex ${message.authorType === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm ${message.authorType === 'customer' ? 'bg-primary-50 text-primary-950' : 'bg-neutral-100 text-neutral-800'}`}>
                  <p className="text-xs font-semibold">{message.authorName || (message.authorType === 'customer' ? 'You' : 'Support')}</p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <AttachmentChipList attachments={message.attachments} className="mt-2" />
                  <p className="mt-1.5 text-[0.68rem] text-neutral-400">{formatDateTime(message.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {replyAllowed ? (
          <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
            <label className="text-sm font-medium text-neutral-700">Reply</label>
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              maxLength={5000}
              placeholder="Add a reply…"
              className="h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
            <TicketAttachmentsField attachments={replyAttachments} onChange={setReplyAttachments} disabled={isReplying} />
            {replyError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{replyError}</div>
            )}
            <div className="flex justify-end">
              <Button type="button" loading={isReplying} disabled={!replyBody.trim()} onClick={handleReply}>
                <BadgeCheck className="size-4" aria-hidden="true" />
                Send Reply
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            This ticket is {ticketStatusLabel(ticket.status).toLowerCase()} and the 7-day reopen window has passed. Please raise a new ticket if you still need help.
          </div>
        )}
      </Card>
    </div>
  )
}
