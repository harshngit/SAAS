// Shared date-range filtering - one preset catalog + resolver used by every list/table page's
// Date filter (see components/ui/DateRangeFilter.jsx), so the UX and the day-boundary math are
// identical everywhere instead of reinvented per page.
//
// Every value here is a plain `yyyy-MM-dd` LOCAL calendar-day string, never a full timestamp and
// never produced via `toISOString()` (which shifts by the viewer's UTC offset and can silently
// move a selected day). This is the same shape the backend's own `date_from`/`date_to` params
// already use where they exist (purchase-returns, supplier-payments, leaves, attendance).
import { format, startOfMonth, endOfMonth, startOfQuarter, startOfYear, subDays, subMonths } from 'date-fns'

const fmt = (date) => format(date, 'yyyy-MM-dd')

export const DATE_RANGE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

// -> { dateFrom, dateTo } as yyyy-MM-dd strings, both inclusive. '' means unbounded on that side.
export function resolveDateRange(preset, customFrom = '', customTo = '') {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { dateFrom: fmt(now), dateTo: fmt(now) }
    case 'yesterday': {
      const yesterday = subDays(now, 1)
      return { dateFrom: fmt(yesterday), dateTo: fmt(yesterday) }
    }
    case 'last7':
      return { dateFrom: fmt(subDays(now, 6)), dateTo: fmt(now) }
    case 'last30':
      return { dateFrom: fmt(subDays(now, 29)), dateTo: fmt(now) }
    case 'thisMonth':
      return { dateFrom: fmt(startOfMonth(now)), dateTo: fmt(now) }
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1)
      return { dateFrom: fmt(startOfMonth(lastMonth)), dateTo: fmt(endOfMonth(lastMonth)) }
    }
    case 'thisQuarter':
      return { dateFrom: fmt(startOfQuarter(now)), dateTo: fmt(now) }
    case 'thisYear':
      return { dateFrom: fmt(startOfYear(now)), dateTo: fmt(now) }
    case 'custom':
      return { dateFrom: customFrom || '', dateTo: customTo || '' }
    default:
      return { dateFrom: '', dateTo: '' }
  }
}

// Client-side predicate for modules with no backend date_from/date_to support (see
// FRONTEND_AUDIT.md-style gap notes at each call site) - only ever applied to a dataset the page
// already loads in full (never to one page of a paginated result, which would undercount).
// Lexicographic comparison on the yyyy-MM-dd prefix - never Date-object/UTC math - so both
// boundary days are included exactly as picked, with no timezone shift.
export function isWithinDateRange(value, dateFrom, dateTo) {
  if (!value) return !dateFrom && !dateTo
  const day = String(value).slice(0, 10)
  if (dateFrom && day < dateFrom) return false
  if (dateTo && day > dateTo) return false
  return true
}
