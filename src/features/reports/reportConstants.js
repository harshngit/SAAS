// Values must match the backend's report_type path segments exactly (hyphenated) -
// GET /reports/{report_type} 404s on anything else.
export const REPORT_TYPES = [
  { value: 'daily-transaction', label: 'Daily Transaction' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'customer-outstanding', label: 'Customer Outstanding' },
  { value: 'supplier-outstanding', label: 'Supplier Outstanding' },
  { value: 'payment-collection', label: 'Payment Collection' },
  { value: 'expense', label: 'Expense' },
  { value: 'cash-collection', label: 'Cash Collection' },
  { value: 'gst-summary', label: 'GST Summary' },
  { value: 'sales-return', label: 'Sales Return' },
  { value: 'purchase-return', label: 'Purchase Return' },
  { value: 'profit-loss', label: 'Profit & Loss' },
]

export const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'fy', label: 'Financial Year' },
  { value: 'custom', label: 'Custom Range' },
]

const toIsoDate = (date) => date.toISOString().slice(0, 10)

export function getDateRangeForPeriod(period, customFrom, customTo) {
  const today = new Date()
  const todayStr = toIsoDate(today)

  if (period === 'daily') {
    return { dateFrom: todayStr, dateTo: todayStr }
  }

  if (period === 'weekly') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
  }

  if (period === 'monthly') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { dateFrom: toIsoDate(from), dateTo: todayStr }
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
