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

// Local calendar date as YYYY-MM-DD. NEVER use `new Date().toISOString().slice(0,10)` for a
// date-only business field: at local midnight in a positive-offset zone (IST is +5:30) that
// returns the previous day. This reads the local Y/M/D directly. Keep real ISO timestamps
// (`toISOString()`) for actual points in time (createdAt, reconciledAt, …).
export function toLocalDateString(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024

// Strips a trailing ".0"/".00" instead of showing it - 2147483648 bytes reads as "2 GB", not
// "2.00 GB", while 350000000 still reads as "334 MB" (1 decimal below 10 units, none above).
function trimDecimal(value, decimals) {
  return parseFloat(value.toFixed(decimals)).toString()
}

// Binary (1024-based) byte formatting - the storage backend's own stated convention
// (1 GB = 1024^3 bytes), used consistently everywhere storage is shown. Never NaN/undefined/
// Infinity: any non-finite or missing input returns "—" instead.
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < KIB) return `${bytes} B`
  if (bytes < MIB) return `${trimDecimal(bytes / KIB, 1)} KB`
  if (bytes < GIB) return `${trimDecimal(bytes / MIB, bytes / MIB >= 10 ? 0 : 1)} MB`
  return `${trimDecimal(bytes / GIB, bytes / GIB >= 10 ? 1 : 2)} GB`
}

// null when the value is missing/non-finite (e.g. unlimited storage, where the backend sends
// percentage_used: null) - callers render nothing rather than ever showing "NaN%"/"Infinity%".
export function formatStoragePercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return `${Math.round(value)}%`
}
