// Existing list wrappers expose `total` and accept page/page_size.
export async function loadDashboardOptions(list, key) {
  const rows = new Map()
  let page = 1
  while (true) {
    const result = await list({ page, page_size: 100 })
    if (!result.success) return result
    const batch = result[key] || []
    const previousSize = rows.size
    batch.forEach((row) => rows.set(row.id, row))
    if (rows.size >= (result.total ?? batch.length)) {
      return { success: true, [key]: [...rows.values()] }
    }
    if (!batch.length || rows.size === previousSize) {
      return { success: false, error: 'Unable to load all filter records. Please retry.' }
    }
    page += 1
  }
}

export function validateDashboardDates(preset, range) {
  if (preset !== 'custom') return ''
  if (!range.from || !range.to) return 'Choose both From and To dates.'
  if (range.from > range.to) return 'From date must be on or before To date.'
  return ''
}
