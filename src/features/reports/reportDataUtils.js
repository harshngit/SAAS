import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'

// Tries each candidate key in order and returns the first one actually present on `summary`
// (including falsy-but-real values like 0) - never invents a number, only picks which of a few
// plausible backend spellings a given value is sitting under. Returns undefined (card omitted,
// not shown as a fabricated zero) when none of the candidates are present.
export function resolveSummaryValue(summary, keys = []) {
  if (!summary || typeof summary !== 'object') return undefined
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(summary, key) && summary[key] !== null && summary[key] !== undefined) {
      return summary[key]
    }
  }
  return undefined
}

export function formatPercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  // Backend may send either a 0-1 fraction or an already-scaled percent - a value <= 1 (and not
  // itself a literal 0%) is almost certainly a fraction that still needs x100.
  const percent = Math.abs(num) <= 1 ? num * 100 : num
  return `${percent.toFixed(1)}%`
}

export function formatSummaryValue(value, format) {
  if (value === undefined || value === null || value === '') return '—'
  if (format === 'currency') return formatCurrency(Number(value) || 0)
  if (format === 'percent') return formatPercent(value)
  if (format === 'number') return formatNumber(Number(value) || 0)
  return String(value)
}

export function formatCellValue(value, column) {
  if (value === undefined || value === null || value === '') return '—'
  switch (column.type) {
    case 'currency':
      return formatCurrency(Number(value) || 0)
    case 'number': {
      const num = Number(value)
      if (!Number.isFinite(num)) return String(value)
      const formatted = formatNumber(Math.abs(num))
      if (column.signed && num > 0) return `+${formatted}`
      if (column.signed && num < 0) return `-${formatted}`
      return formatted
    }
    case 'percent':
      return formatPercent(value)
    case 'date':
      return formatDate(value)
    case 'datetime':
      return formatDateTime(value)
    default:
      return String(value)
  }
}

// Normalizes ONE backend meta.columns entry (a plain key string, or {key,label,type,...}) into
// the same shape fallback columns use, inheriting type/align/reference hints from the matching
// fallback column (by key) when the backend entry itself doesn't specify them - the backend owns
// WHICH columns/order exist, the frontend config only adds presentation hints for keys it knows.
function normalizeBackendColumn(entry, fallbackByKey) {
  const key = typeof entry === 'string' ? entry : entry.key
  const fallback = fallbackByKey.get(key)
  if (typeof entry === 'string') {
    return fallback || { key, label: fallback?.label || humanizeKeyLocal(key), type: 'text' }
  }
  return {
    key,
    label: entry.label || fallback?.label || humanizeKeyLocal(key),
    type: entry.type || fallback?.type || 'text',
    align: entry.align || fallback?.align,
    refType: fallback?.refType,
    idKey: fallback?.idKey,
    signed: fallback?.signed,
  }
}

function humanizeKeyLocal(key = '') {
  return key.toString().replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

// Source of truth for a report's table schema: backend `meta.columns` when the response sends a
// non-empty array, the report's own fallback column config otherwise. NEVER Object.keys(rows[0]) -
// an empty page, or a row missing a field another row has, would silently mis-render the table.
export function resolveColumns(report, fallbackColumns = []) {
  const metaColumns = report?.meta?.columns
  if (Array.isArray(metaColumns) && metaColumns.length > 0) {
    const fallbackByKey = new Map(fallbackColumns.map((column) => [column.key, column]))
    return metaColumns.map((entry) => normalizeBackendColumn(entry, fallbackByKey))
  }
  return fallbackColumns
}
