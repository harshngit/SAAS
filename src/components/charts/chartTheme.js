// Validated categorical order (dataviz skill): fixed hue sequence, never cycled/reordered per render.
// Worst adjacent CVD deltaE 9.1 light (>=8 target); worst adjacent normal-vision deltaE 19.6 (>=15 floor).
export const CATEGORICAL_COLORS = [
  '#2a78d6', // 1 blue
  '#008300', // 2 green
  '#e87ba4', // 3 magenta
  '#eda100', // 4 yellow
  '#1baf7a', // 5 aqua
  '#eb6834', // 6 orange
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
]

// Single-hue data color for one-series charts (line/bar) — our brand primary, not the generic reference blue.
export const CHART_PRIMARY = '#1c6f8c'
export const CHART_PRIMARY_SOFT = '#268aa9'

export const CHART_INK = {
  primary: '#111827', // neutral-900 — tooltip values, axis emphasis
  secondary: '#4b5563', // neutral-600 — legend text
  muted: '#9aa1ac', // neutral-400 — axis ticks
  grid: '#e4e6e9', // neutral-200 — hairline gridlines
  axis: '#d1d5db', // neutral-300 — baseline/axis line
}

export function foldToOther(data, { max = 5, labelKey = 'name', valueKey = 'value', otherLabel = 'Other' } = {}) {
  if (data.length <= max) return data
  const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey])
  const head = sorted.slice(0, max - 1)
  const tail = sorted.slice(max - 1)
  const otherTotal = tail.reduce((sum, item) => sum + item[valueKey], 0)
  return [...head, { [labelKey]: otherLabel, [valueKey]: otherTotal }]
}
