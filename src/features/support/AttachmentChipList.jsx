import { FileText, Image as ImageIcon } from 'lucide-react'

// Read-only attachment chips for a ticket header or a message bubble - images and PDFs both
// just open in a new tab (no in-app lightbox/viewer exists in this app yet).
export default function AttachmentChipList({ attachments, className = '' }) {
  if (!attachments?.length) return null
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id || attachment.fileId}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-surface px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-700"
        >
          {String(attachment.contentType || '').startsWith('image/') ? <ImageIcon className="size-3.5" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
          <span className="max-w-40 truncate">{attachment.filename || 'Attachment'}</span>
        </a>
      ))}
    </div>
  )
}
