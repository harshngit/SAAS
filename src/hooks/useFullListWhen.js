import { useEffect, useState } from 'react'

// Loads every page of a list (100 rows per request, the backend maximum) - used only for the
// filters a list endpoint cannot apply itself (e.g. a date range on an endpoint with no date
// parameter). Filtering one server page of 20 would make a valid range look empty, so the page
// filters the complete list instead and paginates it locally.
// fetchPage(page, pageSize) must resolve { success, rows, total } or { success: false, error }.
export async function fetchAllPages(fetchPage, { pageSize = 100, maxPages = 50 } = {}) {
  let rows = []
  let expected = Infinity
  for (let page = 1; rows.length < expected && page <= maxPages; page += 1) {
    const result = await fetchPage(page, pageSize)
    if (!result.success) return result
    rows = rows.concat(result.rows)
    expected = result.total ?? rows.length
    if (result.rows.length === 0) break
  }
  return { success: true, rows, total: rows.length }
}

// Runs fetchAll() (usually fetchAllPages) while `enabled`, and again whenever `deps` change; a
// stale response is dropped. Returns { rows, loading, error }.
export function useFullListWhen(enabled, fetchAll, deps) {
  const [state, setState] = useState({ rows: [], loading: false, error: '' })

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    fetchAll().then((result) => {
      if (!active) return
      setState(result.success ? { rows: result.rows, loading: false, error: '' } : { rows: [], loading: false, error: result.error || 'Unable to load the list.' })
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return state
}
