import { toLocalDateString } from '../../utils/format'
import { REPORT_CONFIG } from './reportConfig'

// Derived from REPORT_CONFIG - the one canonical report registry - instead of a second,
// independently-maintained list that can (and did) drift out of sync with it. Kept around only
// for whatever still imports the flat {value,label} shape; new code should read REPORT_CONFIG /
// reportsByCategory() directly.
export const REPORT_TYPES = Object.entries(REPORT_CONFIG).map(([value, config]) => ({ value, label: config.label }))

// One standard period set reused across every report + report-style screen.
export const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Today' },
  { value: 'last-7', label: 'Last 7 Days' },
  { value: 'last-30', label: 'Last 30 Days' },
  { value: 'monthly', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'fy', label: 'Financial Year' },
  { value: 'custom', label: 'Custom Range' },
]

// LOCAL calendar date - `date.toISOString().slice(0,10)` would roll back a day at local
// midnight in IST (+5:30) and similar zones, sending the wrong date_from/date_to.
const toIsoDate = (date) => toLocalDateString(date)

export function getDateRangeForPeriod(period, customFrom, customTo) {
  const today = new Date()
  const todayStr = toIsoDate(today)

  if (period === 'daily') {
    return { dateFrom: todayStr, dateTo: todayStr }
  }

  // Today plus the previous 6 calendar days = 7 days total.
  if (period === 'last-7') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
  }

  // Today plus the previous 29 calendar days = 30 days total.
  if (period === 'last-30') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
  }

  if (period === 'monthly') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
  }

  if (period === 'last-month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) }
  }

  if (period === 'fy') {
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
    const from = new Date(fyStartYear, 3, 1)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
  }

  return { dateFrom: customFrom || todayStr, dateTo: customTo || todayStr }
}

export function humanizeKey(key = '') {
  return key
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
