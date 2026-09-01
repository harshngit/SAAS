import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const MODAL_SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
}

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', className = '' }) {
  // A width class passed via `className` still wins; otherwise the `size` prop drives it.
  const hasWidthOverride = /(^|\s)(max-w-|w-\[)/.test(className)
  const sizeClass = MODAL_SIZE_CLASS[size] || MODAL_SIZE_CLASS.md
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-xl border border-neutral-200 bg-[#fbfbfa] shadow-[0_1px_0_rgba(0,0,0,0.02)] ${hasWidthOverride ? '' : sizeClass} ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id="modal-title" className="text-sm font-semibold tracking-[-0.01em] text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
