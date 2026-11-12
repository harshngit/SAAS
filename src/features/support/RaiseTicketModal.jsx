import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import TicketAttachmentsField from './TicketAttachmentsField'
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, createTicket } from '../../api/support'

const MAX_SUBJECT = 200
const MAX_DESCRIPTION = 5000

export default function RaiseTicketModal({ isOpen, onClose, onCreated }) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('bug')
  const [priority, setPriority] = useState('medium')
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setSubject('')
    setDescription('')
    setCategory('bug')
    setPriority('medium')
    setAttachments([])
    setError('')
  }

  const close = () => {
    if (isSaving) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (isSaving) return
    if (!subject.trim() || !description.trim()) {
      setError('Subject and description are required.')
      return
    }
    setIsSaving(true)
    setError('')

    const result = await createTicket({
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
      attachmentFileIds: attachments.map((attachment) => attachment.fileId),
    })

    setIsSaving(false)
    if (!result.success) {
      // 429 (10 tickets / 24h) and validation errors both come through here verbatim.
      setError(result.error)
      return
    }
    reset()
    onCreated(result.ticket)
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Raise a Ticket" size="lg" footer={
      <>
        <Button type="button" variant="secondary" disabled={isSaving} onClick={close}>Cancel</Button>
        <Button type="button" loading={isSaving} onClick={handleSubmit}>Submit Ticket</Button>
      </>
    }>
      <div className="space-y-4">
        <Input
          label="Subject"
          required
          value={subject}
          maxLength={MAX_SUBJECT}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="A short summary of the issue"
        />
        <Input
          label="Description"
          required
          as="textarea"
          value={description}
          maxLength={MAX_DESCRIPTION}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What happened, and what did you expect instead?"
          className="h-28"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" required options={TICKET_CATEGORY_OPTIONS} value={category} onChange={(event) => setCategory(event.target.value)} />
          <Select label="Priority" options={TICKET_PRIORITY_OPTIONS} value={priority} onChange={(event) => setPriority(event.target.value)} />
        </div>
        <TicketAttachmentsField attachments={attachments} onChange={setAttachments} disabled={isSaving} />
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
      </div>
    </Modal>
  )
}
