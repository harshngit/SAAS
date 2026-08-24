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
  addMonths,
  subMonths,
  isToday,
  parseISO,
  isValid,
} from 'date-fns'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ label, value, onChange, error, placeholder = 'Select date', className = '' }) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parseISO(value) : null
  const [viewMonth, setViewMonth] = useState(selectedDate && isValid(selectedDate) ? selectedDate : new Date())
  const containerRef = useRef(null)
  const menuRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)

  useEffect(() => {
    if (!open) return

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
  }, [open])

  // Positioned via a portal + measured coordinates (not plain CSS `absolute`) so the panel can
  // flip to stay on-screen - a "To" field near the right edge would otherwise always grow
  // rightward off the viewport, and one near the bottom would grow off the bottom too.
  useEffect(() => {
    if (!open) return undefined

    const PANEL_WIDTH = 288
    const PANEL_HEIGHT = 360

    const updatePosition = () => {
      const trigger = containerRef.current?.querySelector('button[data-datepicker-trigger="true"]')
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const shouldOpenUp = window.innerHeight - rect.bottom < PANEL_HEIGHT + 12 && rect.top > PANEL_HEIGHT
      const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 16)

      setMenuStyle({
        left: Math.max(16, left),
        top: shouldOpenUp ? rect.top - PANEL_HEIGHT - 8 : rect.bottom + 8,
        width: PANEL_WIDTH,
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

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const selectDay = (day) => {
    onChange?.(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          data-datepicker-trigger="true"
          onClick={() => setOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-xl border bg-neutral-50 px-3.5 py-2.5 text-left text-sm transition-all focus:bg-white focus:outline-none focus:ring-4 ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          }`}
        >
          <span className={selectedDate && isValid(selectedDate) ? 'text-neutral-900' : 'text-neutral-400'}>
            {selectedDate && isValid(selectedDate) ? format(selectedDate, 'dd MMM yyyy') : placeholder}
          </span>
          <Calendar className="size-4 text-neutral-400" aria-hidden="true" />
        </button>

        {open && menuStyle && createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="fixed z-50 rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-popover)"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((month) => subMonths(month, 1))}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-medium text-neutral-900">{format(viewMonth, 'MMMM yyyy')}</p>
              <button
                type="button"
                onClick={() => setViewMonth((month) => addMonths(month, 1))}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-400">
              {WEEKDAYS.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = isSameMonth(day, viewMonth)
                const selected = selectedDate && isValid(selectedDate) && isSameDay(day, selectedDate)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`flex size-8 items-center justify-center rounded-full text-sm transition-colors ${
                      selected
                        ? 'bg-primary-600 font-medium text-white shadow-(--shadow-glow-primary)'
                        : isToday(day)
                          ? 'font-medium text-primary-600 hover:bg-primary-50'
                          : inMonth
                            ? 'text-neutral-700 hover:bg-neutral-100'
                            : 'text-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => selectDay(new Date())}
              className="mt-3 w-full rounded-full py-1.5 text-center text-xs font-medium text-primary-600 hover:bg-primary-50"
            >
              Today
            </button>
          </div>,
          document.body,
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
