// Summary cards need the complete, unfiltered source, independent of table pagination.
// Keep this separate from table requests so sort order cannot change the sampled records.
export async function loadSummaryRows(list, rowsKey, scope = {}) {
  const rows = []
  const seenIds = new Set()
  for (let page = 1; ; page += 1) {
    const result = await list({ ...scope, page, page_size: 100 })
    if (!result.success) return result
    const batch = result[rowsKey] || []
    const total = result.total ?? batch.length
    if (rows.length < total && (!batch.length || batch.every((row) => row.id && seenIds.has(row.id)))) {
      return { success: false, error: 'Unable to load the complete summary. Please retry.' }
    }
    rows.push(...batch)
    batch.forEach((row) => { if (row.id) seenIds.add(row.id) })
    if (rows.length >= total) return { success: true, [rowsKey]: rows, total }
  }
}
