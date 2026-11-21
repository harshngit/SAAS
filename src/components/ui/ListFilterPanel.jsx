import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import Button from './Button'
import DateRangeFilter from './DateRangeFilter'
import { validateCustomRange } from '../../utils/dateRange'

export const DEFAULT_DATE_KEYS = { preset: 'datePreset', from: 'customFrom', to: 'customTo' }
const asList = (dateKeys) => (Array.isArray(dateKeys) ? dateKeys : [dateKeys]).filter(Boolean)

// How many filters differ from their defaults. A date range counts once (the preset and its two
// custom dates are one filter). `ignore` lists keys that never count (e.g. a sort order).
export function countActiveFilters(applied = {}, defaults = {}, dateKeys = DEFAULT_DATE_KEYS, ignore = []) {
  const dateParts = new Set(asList(dateKeys).flatMap((keys) => [keys.from, keys.to]))
  return Object.keys(defaults).filter((key) => {
    if (ignore.includes(key) || dateParts.has(key)) return false
    return String(applied[key] ?? '') !== String(defaults[key] ?? '')
  }).length
}

// Draft vs applied filters for a list page.
//   applied  - the values the page is CURRENTLY filtering by (the page keeps owning its state).
//   defaults - the "nothing filtered" values; also what Clear Filters restores.
//   onApply  - called with the full draft object when the user presses Apply Filters (the page
//              copies it into its real state and resets to page 1). Clear Filters calls it with
//              `defaults`.
// The drawer works on a private draft copy: nothing the user picks reaches the table until they
// press Apply Filters, and closing the drawer without applying throws the draft away, so reopening
// always shows what is really applied. `children` is a render function ({ draft, set, errors }).
// Without `applied` the component keeps its old behaviour (children render as-is, the footer button
// just closes), so a page that has not been migrated yet still works.
export default function ListFilterPanel({ title, children, applied, defaults, onApply, dateKeys = DEFAULT_DATE_KEYS, validate, ignoreKeys = [], openRequest }) {
  const managed = Boolean(applied && defaults && onApply)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState({})
  const id = useId()
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const panelRef = useRef(null)

  const activeCount = managed ? countActiveFilters(applied, defaults, dateKeys, ignoreKeys) : 0
  const hasActive = activeCount > 0

  const openPanel = () => {
    if (managed) { setDraft({ ...defaults, ...applied }); setErrors({}) }
    setOpen(true)
  }
  const set = (patch, value) => {
    const next = typeof patch === 'string' ? { [patch]: value } : patch
    setDraft((previous) => ({ ...previous, ...next }))
    setErrors({})
  }
  const apply = () => {
    if (!managed) { setOpen(false); return }
    const found = {}
    asList(dateKeys).forEach((keys) => {
      const message = validateCustomRange(draft[keys.preset], draft[keys.from], draft[keys.to])
      if (message) found[keys.preset] = message
    })
    Object.assign(found, validate?.(draft) || {})
    if (Object.keys(found).length > 0) { setErrors(found); return }
    onApply(draft)
    setOpen(false)
  }
  // A page can open the drawer itself (e.g. a toolbar "Custom Range" choice): pass { id, patch } and a
  // new id opens it with the patch applied to the draft. Nothing is applied until Apply Filters.
  const requestId = openRequest?.id
  useEffect(() => {
    if (!requestId || !managed) return
    setDraft({ ...defaults, ...applied, ...(openRequest.patch || {}) })
    setErrors({})
    setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const clear = () => {
    onApply({ ...defaults })
    setDraft({ ...defaults })
    setErrors({})
    setOpen(false)
  }

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
      <div className="flex items-center gap-2">
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="sm"
          className={`h-9 rounded-xl px-3.5 ${hasActive ? 'border-primary-400 bg-primary-50/70 text-primary-700' : ''}`}
          onClick={openPanel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          data-filters-active={hasActive ? 'true' : 'false'}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter
          {hasActive && <span className="flex size-5 items-center justify-center rounded-full bg-primary-600 text-[0.65rem] font-semibold leading-none text-white" aria-label={`${activeCount} filters applied`}>{activeCount}</span>}
        </Button>
        {managed && hasActive && (
          <button type="button" onClick={clear} className="h-9 whitespace-nowrap rounded-xl px-2 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Clear Filters</button>
        )}
      </div>
      {open && (!managed || draft) && createPortal(
        <div id={id} className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setOpen(false)} aria-label="Close filters" tabIndex={-1} />
          {/* bg-(--modal-bg), not bg-surface: this portaled slide-over panel must stay solid and
              readable regardless of image-background mode - same token Modal.jsx/Tabs.jsx use. */}
          <aside ref={panelRef} className="relative z-10 flex h-full w-full max-w-sm flex-col bg-(--modal-bg) shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 id={`${id}-title`} className="text-lg font-semibold text-neutral-900">{title}</h2>
                <p className="mt-0.5 text-xs text-neutral-400">{managed ? 'Choose filters, then press Apply Filters.' : 'Refine the records shown in the table.'}</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close filters">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">{managed ? children({ draft, set, errors }) : children}</div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
              {managed ? <button type="button" onClick={clear} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear Filters</button> : <span />}
              <Button type="button" onClick={apply}>{managed ? 'Apply Filters' : 'Apply filters'}</Button>
            </div>
          </aside>
        </div>, document.body,
      )}
    </>
  )
}

// A labelled Date control bound to the draft object: a preset dropdown that reveals From/To for
// Custom Range, with the validation message under it. `keys` defaults to datePreset/customFrom/customTo.
export function FilterDateRange({ label, draft, set, errors = {}, keys = DEFAULT_DATE_KEYS, hint, options }) {
  const error = errors[keys.preset]
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
      <span>{label}{hint && <span className="font-normal text-neutral-400"> {hint}</span>}</span>
      <DateRangeFilter
        options={options}
        preset={draft[keys.preset]}
        onPresetChange={(value) => set({ [keys.preset]: value, ...(value === 'custom' ? {} : { [keys.from]: '', [keys.to]: '' }) })}
        customFrom={draft[keys.from]}
        customTo={draft[keys.to]}
        onCustomChange={({ from, to }) => set({ [keys.from]: from, [keys.to]: to })}
      />
      {error && <p role="alert" className="text-xs font-normal text-red-600">{error}</p>}
    </div>
  )
}
