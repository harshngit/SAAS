export const CATEGORICAL_COLORS = [
  '#063b00',
  '#111827',
  '#4b5563',
  '#9aa1ac',
  '#d1d5db',
  '#0a0e14',
]

export const CHART_PRIMARY = '#063b00'
export const CHART_PRIMARY_SOFT = '#4b5563'

export const CHART_INK = {
  primary: '#111827',
  secondary: '#4b5563',
  muted: '#9aa1ac',
  grid: '#f1f2f4',
  axis: '#d1d5db',
}

export function foldToOther(data, { max = 5, labelKey = 'name', valueKey = 'value', otherLabel = 'Other' } = {}) {
  if (data.length <= max) return data
  const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey])
  const head = sorted.slice(0, max - 1)
  const tail = sorted.slice(max - 1)
  const otherTotal = tail.reduce((sum, item) => sum + item[valueKey], 0)
  return [...head, { [labelKey]: otherLabel, [valueKey]: otherTotal }]
}
