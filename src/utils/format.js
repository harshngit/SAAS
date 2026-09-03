const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

// A small non-breaking gap between the ₹ symbol and the amount, used everywhere.
const CURRENCY_GAP = ' '

function withCurrencyGap(formatted) {
  return formatted.replace(/₹\s*/, `₹${CURRENCY_GAP}`)
}

export function formatCurrency(value) {
  return withCurrencyGap(currencyFormatter.format(value))
}

export function formatCompactCurrency(value) {
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `₹${CURRENCY_GAP}${(value / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `₹${CURRENCY_GAP}${(value / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `₹${CURRENCY_GAP}${(value / 1_000).toFixed(1)}K`
  return formatCurrency(value)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value)
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

// Friendly date - "05 Sep 2026". Never mutates the raw value; returns it unchanged if unparseable.
export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateFormatter.format(date)
}

// "05 Sep 2026 · 10:00 AM"
export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`
}
