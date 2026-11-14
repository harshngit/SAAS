import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addDays,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  isValid,
} from 'date-fns'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1))
const YEAR_RANGE_SIZE = 72

// Extra props (all optional, defaults keep every existing caller unchanged) are what let Input.jsx
// use this as the app-wide replacement for <input type="date">:
//   displayFormat  - date-fns pattern for the trigger text (Input passes 'dd-MM-yyyy')
//   min / max      - 'yyyy-MM-dd' bounds; days outside are disabled
//   clearable      - shows a Clear button (optional date fields could be emptied natively)
//   required/name  - mirrored onto an invisible input so native form validation + FormData still work
//   triggerClassName / compact / ariaLabel / title / disabled - presentation + a11y
// The value in and out is always the 'yyyy-MM-dd' string, same as before.
export default function DatePicker({
  label,
  value,
  onChange,
  error,
  invalid = false,
  placeholder = 'Select date',
  className = '',
  displayFormat = 'dd MMM yyyy',
  min,
  max,
  clearable = false,
  required = false,
  disabled = false,
  name,
  id,
  compact = false,
  triggerClassName,
  ariaLabel,
  title,
}) {
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState('day')
  const selectedDate = value ? parseISO(value) : null
  const [viewMonth, setViewMonth] = useState(selectedDate && isValid(selectedDate) ? selectedDate : new Date())
  const containerRef = useRef(null)
  const menuRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)

  useEffect(() => {
    if (!open) return
    setViewMode('day')
    // Edit forms often receive their date after first render - jump to the selected month on open.
    const current = value ? parseISO(value) : null
    if (current && isValid(current)) setViewMonth(current)

    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) setOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when opened/closed
  }, [open])

  // Positioned via a portal + measured coordinates (not plain CSS `absolute`) so the panel can
  // flip to stay on-screen - a "To" field near the right edge would otherwise always grow
  // rightward off the viewport, and one near the bottom would grow off the bottom too.
  useEffect(() => {
    if (!open) return undefined

    const MAX_PANEL_HEIGHT = 332
    // Below this, prefer scrolling the panel's own content over flipping it to the other side -
    // a flip that leaps the full MAX_PANEL_HEIGHT past the trigger (e.g. a "Joined"/"Created"
    // field a few rows down inside a filter drawer) ends up covering the OTHER fields in that
    // same drawer instead of just page content, which reads as broken, not as "smart" flipping.
    const MIN_PANEL_HEIGHT = 260
    const VIEWPORT_GAP = 16

    const updatePosition = () => {
      const trigger = containerRef.current?.querySelector('button[data-datepicker-trigger="true"]')
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const panelWidth = Math.min(Math.max(rect.width, 320), window.innerWidth - (VIEWPORT_GAP * 2))
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP
      const spaceAbove = rect.top - VIEWPORT_GAP
      const shouldOpenUp = spaceBelow < MIN_PANEL_HEIGHT && spaceAbove > spaceBelow
      // Shrink to whatever room the chosen side actually has (down to MIN_PANEL_HEIGHT, below
      // which the day grid itself scrolls) instead of always reserving the full 332px - that's
      // what let the panel spill past the available space and overlap unrelated content above it.
      const panelHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, shouldOpenUp ? spaceAbove : spaceBelow))
      const preferredTop = shouldOpenUp ? rect.top - panelHeight - 8 : rect.bottom + 8
      const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - panelHeight - VIEWPORT_GAP)
      const left = Math.min(rect.left, window.innerWidth - panelWidth - VIEWPORT_GAP)

      setMenuStyle({
        left: Math.max(VIEWPORT_GAP, left),
        top: Math.min(Math.max(VIEWPORT_GAP, preferredTop), maxTop),
        width: panelWidth,
        maxHeight: panelHeight,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const visibleYear = viewMonth.getFullYear()
  const visibleMonth = viewMonth.getMonth()
  const yearGridStart = visibleYear - 60
  const yearGridEnd = yearGridStart + YEAR_RANGE_SIZE - 1
  const years = Array.from({ length: YEAR_RANGE_SIZE }, (_, index) => yearGridEnd - index)
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart)
  const naturalGridEnd = endOfWeek(monthEnd)
  const gridEnd = addDays(gridStart, 41) > naturalGridEnd ? addDays(gridStart, 41) : naturalGridEnd
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const isOutOfRange = (day) => {
    const iso = format(day, 'yyyy-MM-dd')
    return Boolean((min && iso < min) || (max && iso > max))
  }

  const selectDay = (day) => {
    if (isOutOfRange(day)) return
    onChange?.(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const clearDate = () => {
    onChange?.('')
    setOpen(false)
  }

  const changeCalendarPage = (direction) => {
    if (viewMode === 'year') {
      setViewMonth((month) => {
        const next = new Date(month)
        next.setFullYear(next.getFullYear() + (direction * YEAR_RANGE_SIZE))
        return next
      })
      return
    }

    if (viewMode === 'month') {
      setViewMonth((month) => {
        const next = new Date(month)
        next.setFullYear(next.getFullYear() + direction)
        return next
      })
      return
    }

    setViewMonth((month) => direction > 0 ? addMonths(month, 1) : subMonths(month, 1))
  }

  const selectMonth = (monthIndex) => {
    setViewMonth((month) => {
      const next = new Date(month)
      next.setMonth(monthIndex)
      return next
    })
    setViewMode('day')
  }

  const selectYear = (year) => {
    setViewMonth((month) => {
      const next = new Date(month)
      next.setFullYear(year)
      return next
    })
    setViewMode('day')
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          id={id}
          data-datepicker-trigger="true"
          disabled={disabled}
          title={title}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={triggerClassName
            ? `flex w-full items-center justify-between text-left ${triggerClassName} ${error || invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15' : ''}`
            : `flex w-full items-center justify-between rounded-xl border bg-neutral-50 px-3.5 py-2.5 text-left text-sm transition-all focus:bg-(--modal-bg) focus:outline-none focus:ring-4 ${
              error || invalid
                ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
            }`}
        >
          <span className={selectedDate && isValid(selectedDate) ? 'text-neutral-900' : 'text-neutral-400'}>
            {selectedDate && isValid(selectedDate) ? format(selectedDate, displayFormat) : placeholder}
          </span>
          <Calendar className="size-4 text-neutral-400" aria-hidden="true" />
        </button>
        {(required || name) && (
          // Invisible mirror of the value so a native `required` still blocks form submit and the
          // value still reaches FormData; not focusable/readable for users or screen readers.
          <input
            tabIndex={-1}
            aria-hidden="true"
            name={name}
            required={required}
            value={value || ''}
            onChange={() => {}}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
          />
        )}

        {open && menuStyle && createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            // bg-(--modal-bg), not bg-surface: this portaled calendar popover must stay solid and
            // readable regardless of image-background mode - same token Modal.jsx/Tabs.jsx use.
            // overflow-y-auto: when menuStyle.maxHeight had to shrink below the panel's natural
            // height (cramped viewport), the day grid scrolls internally instead of the panel
            // spilling past its box.
            className="app-calendar-popover fixed z-[140] overflow-y-auto rounded-[1.25rem] border border-surface-border bg-(--modal-bg) px-5 pb-4 pt-4 shadow-(--shadow-popover) app-scrollbar"
          >
            <div className="flex h-8 items-center justify-between">
              <button
                type="button"
                onClick={() => changeCalendarPage(-1)}
                className="app-calendar-nav flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label={viewMode === 'year' ? 'Previous years' : viewMode === 'month' ? 'Previous year' : 'Previous month'}
              >
                <ChevronLeft className="size-4" />
              </button>
              {viewMode === 'year' ? (
                <p className="text-sm font-semibold text-fg">{yearGridStart} - {yearGridEnd}</p>
              ) : viewMode === 'month' ? (
                <button
                  type="button"
                  onClick={() => setViewMode('year')}
                  className="rounded-full px-3 py-1 text-sm font-semibold text-fg transition-colors hover:bg-surface-muted"
                >
                  {format(viewMonth, 'yyyy')}
                </button>
              ) : (
                <p className="flex items-center gap-3 text-sm font-semibold text-fg">
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className="rounded-full px-2 py-1 transition-colors hover:bg-surface-muted"
                    aria-label="Choose month"
                  >
                    {format(viewMonth, 'MMMM')}
                  </button>
                  <span className="h-4 w-px bg-surface-border" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setViewMode('year')}
                    className="rounded-full px-2 py-1 transition-colors hover:bg-surface-muted"
                    aria-label="Choose year"
                  >
                    {format(viewMonth, 'yyyy')}
                  </button>
                </p>
              )}
              <button
                type="button"
                onClick={() => changeCalendarPage(1)}
                className="app-calendar-nav flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label={viewMode === 'year' ? 'Next years' : viewMode === 'month' ? 'Next year' : 'Next month'}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {viewMode === 'month' ? (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {MONTHS.map((monthDate, monthIndex) => (
                  <button
                    key={monthIndex}
                    type="button"
                    onClick={() => selectMonth(monthIndex)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                      monthIndex === visibleMonth
                        ? 'app-calendar-day-selected'
                        : 'text-fg hover:bg-surface-muted'
                    }`}
                  >
                    {format(monthDate, 'MMM')}
                  </button>
                ))}
              </div>
            ) : viewMode === 'year' ? (
              <div className="mt-5 grid max-h-[218px] grid-cols-3 gap-2 overflow-y-auto pr-1 app-scrollbar">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                      year === visibleYear
                        ? 'app-calendar-day-selected'
                        : 'text-fg hover:bg-surface-muted'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-7 text-center text-[0.78rem] font-semibold text-fg-muted">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="flex h-6 items-center justify-center">{day}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-y-1">
                  {days.map((day) => {
                    const inMonth = isSameMonth(day, viewMonth)
                    const selected = selectedDate && isValid(selectedDate) && isSameDay(day, selectedDate)
                    const outOfRange = isOutOfRange(day)
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={outOfRange}
                        onClick={() => selectDay(day)}
                        className={`app-calendar-day mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-all disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
                          selected
                            ? 'app-calendar-day-selected font-semibold'
                            : isToday(day)
                              ? 'app-calendar-day-today font-semibold text-fg hover:bg-surface-muted'
                              : inMonth
                                ? 'text-fg hover:bg-surface-muted'
                                : 'text-neutral-300 hover:bg-surface-muted/70 hover:text-fg-muted'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isOutOfRange(new Date())}
                    onClick={() => selectDay(new Date())}
                    className="w-full rounded-full py-1.5 text-center text-sm font-semibold text-fg transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Today
                  </button>
                  {clearable && value && (
                    <button
                      type="button"
                      onClick={clearDate}
                      className="w-full rounded-full py-1.5 text-center text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
