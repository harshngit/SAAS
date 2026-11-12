import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'
import { uploadTicketAttachment } from '../../api/support'

const MAX_FILES = 3
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPE = /^image\/|^application\/pdf$/

// Shared by the "Raise a Ticket" form and the reply box - stages files, validates them
// client-side (count / type / size / duplicate) before ever calling the upload endpoint, then
// uploads one at a time and reports back the resolved { fileId, filename, contentType, size,
// url } list for the caller to send as attachment_file_ids.
export default function TicketAttachmentsField({ attachments, onChange, disabled = false }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handlePick = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setError('')

    if (attachments.length + files.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files.`)
      return
    }
    for (const file of files) {
      if (!ALLOWED_TYPE.test(file.type)) {
        setError(`${file.name} isn't an image or PDF file.`)
        return
      }
      if (file.size > MAX_SIZE) {
        setError(`${file.name} is larger than 10 MB.`)
        return
      }
      if (attachments.some((existing) => existing.filename === file.name && existing.size === file.size)) {
        setError(`${file.name} is already attached.`)
        return
      }
    }

    setIsUploading(true)
    const uploaded = []
    for (const file of files) {
      const result = await uploadTicketAttachment(file)
      if (!result.success) {
        setError(result.error)
        setIsUploading(false)
        if (uploaded.length) onChange([...attachments, ...uploaded])
        return
      }
      uploaded.push(result)
    }
    setIsUploading(false)
    onChange([...attachments, ...uploaded])
  }

  const removeAt = (index) => onChange(attachments.filter((_, i) => i !== index))

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-700">Attachments</label>
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map((attachment, index) => (
          <span key={attachment.fileId} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700">
            {String(attachment.contentType || '').startsWith('image/') ? <ImageIcon className="size-3.5" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
            <span className="max-w-32 truncate">{attachment.filename}</span>
            {!disabled && (
              <button type="button" onClick={() => removeAt(index)} aria-label={`Remove ${attachment.filename}`} className="text-neutral-400 hover:text-red-600">
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}
        {attachments.length < MAX_FILES && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:opacity-60"
          >
            <Paperclip className="size-3.5" aria-hidden="true" />
            {isUploading ? 'Uploading…' : 'Add file'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" multiple onChange={handlePick} className="hidden" />
      <p className="text-xs text-neutral-400">Up to {MAX_FILES} images or PDF files, 10 MB each.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
