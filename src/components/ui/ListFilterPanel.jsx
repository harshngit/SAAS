import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import Button from './Button'

// Keeps each page's existing controlled filters and handlers intact.
export default function ListFilterPanel({ title, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
      if (event.key === 'Tab') {
        const controls = Array.from(panelRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter((element) => element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <Button ref={triggerRef} type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filter
      </Button>
      {open && createPortal(
        <div id={id} className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setOpen(false)} aria-label="Close filters" tabIndex={-1} />
          <aside ref={panelRef} className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 id={`${id}-title`} className="text-lg font-semibold text-neutral-900">{title}</h2>
                <p className="mt-0.5 text-xs text-neutral-400">Refine the records shown in the table.</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close filters">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">{children}</div>
            <div className="flex justify-end border-t border-neutral-100 px-5 py-4">
              <Button type="button" onClick={() => setOpen(false)}>Apply filters</Button>
            </div>
          </aside>
        </div>, document.body,
      )}
    </>
  )
}
