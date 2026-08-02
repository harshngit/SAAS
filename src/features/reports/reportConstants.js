export const REPORT_TYPES = [
  { value: 'daily_transaction', label: 'Daily Transaction' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'customer_outstanding', label: 'Customer Outstanding' },
  { value: 'supplier_outstanding', label: 'Supplier Outstanding' },
  { value: 'payment_collection', label: 'Payment Collection' },
  { value: 'expense', label: 'Expense' },
  { value: 'cash_collection', label: 'Cash Collection' },
  { value: 'gst_summary', label: 'GST Summary' },
  { value: 'sales_return', label: 'Sales Return' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'profit_loss_summary', label: 'Profit & Loss Summary' },
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
