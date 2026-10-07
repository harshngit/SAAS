import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { reportsByCategory } from '../reportConfig'

const PANEL_WIDTH = 360

// Compact categorized report library - a single trigger button that opens one grouped panel
// (category headings, each with its reports as name + short description), rather than 15
// permanent tabs. Keeps the selector itself small; the grouping does the scanning work.
export default function ReportSelector({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState(null)
  const containerRef = useRef(null)
  const panelRef = useRef(null)
  const triggerRef = useRef(null)

  const categories = reportsByCategory()
  const current = categories.flatMap((category) => category.reports).find((report) => report.value === value)

  const normalizedQuery = query.trim().toLowerCase()
  const visibleCategories = categories
    .map((category) => ({
      ...category,
      reports: category.reports.filter(
        (report) => !normalizedQuery || report.label.toLowerCase().includes(normalizedQuery) || report.description?.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter((category) => category.reports.length > 0)

  useEffect(() => {
    if (!open) return
    setQuery('')

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 16)
      setPosition({ top: rect.bottom + 6, left: Math.max(16, left) })
    }

    updatePosition()

    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        panelRef.current && !panelRef.current.contains(event.target)
      ) setOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full min-w-[220px] items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-surface px-3.5 text-left text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-300"
      >
        <span className="truncate">{current?.label || 'Select report'}</span>
        <ChevronDown className={`size-4 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && position && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{ position: 'fixed', top: position.top, left: position.left, width: PANEL_WIDTH, maxHeight: Math.min(480, window.innerHeight - position.top - 16) }}
          className="z-[130] flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-(--modal-bg) shadow-(--shadow-popover)"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports…"
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto app-scrollbar px-2 py-2">
            {visibleCategories.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-neutral-400">No reports match “{query}”.</p>
            )}
            {visibleCategories.map((category) => (
              <div key={category.key} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  {category.label}
                </p>
                {category.reports.map((report) => (
                  <button
                    key={report.value}
                    type="button"
                    role="option"
                    aria-selected={report.value === value}
                    onClick={() => {
                      setOpen(false)
                      onChange(report.value)
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      report.value === value ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="text-sm font-medium">{report.label}</span>
                    {report.description && <span className="text-xs text-neutral-400">{report.description}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
