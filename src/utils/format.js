const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatCurrency(value) {
  return currencyFormatter.format(value)
}

export function formatCompactCurrency(value) {
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`
  return currencyFormatter.format(value)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value)
}
