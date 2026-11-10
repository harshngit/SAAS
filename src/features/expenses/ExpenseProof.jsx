import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { getFileUrl } from '../../api/files'

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/i

function proofHref(expense) {
  if (!expense?.receiptUrl) return ''
  return expense.isDemo ? expense.receiptUrl : getFileUrl(expense.receiptUrl)
}

function isImageProof(url) {
  return url.startsWith('data:image') || IMAGE_EXTENSION_RE.test(url)
}

// Shows an expense's receipt/proof: an image gets a thumbnail + full-size preview, anything
// else (PDF, etc.) gets a "View Receipt" link. Never fabricates a URL - renders nothing to show
// when the expense has no receiptUrl (caller decides the "No receipt" copy). The stored
// receiptUrl is a "/files/{id}" path with no original filename attached - showing the last URL
// segment as a "filename" was really showing the raw file UUID, so this never derives one.
export default function ExpenseProof({ expense }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const href = proofHref(expense)

  if (!href) return null

  if (isImageProof(href)) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="group relative block size-20 overflow-hidden rounded-xl border border-neutral-200"
        >
          <img src={href} alt="Receipt" className="size-full object-cover transition-transform group-hover:scale-105" />
        </button>
        <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Receipt" size="2xl">
          <img src={href} alt="Receipt" className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain" />
          <div className="mt-4 flex justify-end">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Open full size
            </a>
          </div>
        </Modal>
      </>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 hover:underline"
    >
      <FileText className="size-4 shrink-0" aria-hidden="true" />
      View Receipt
    </a>
  )
}
