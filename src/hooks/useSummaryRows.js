import { useEffect, useState } from 'react'
import { loadSummaryRows } from '../utils/listSummary'

// Only data refreshes invalidate this source. Table filters, sort and page are not inputs.
export function useSummaryRows(list, rowsKey, enabled, refreshKey = 0) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    setError('')
    loadSummaryRows(list, rowsKey).then((result) => {
      if (!active) return
      if (result.success) setRows(result[rowsKey])
      else setError(result.error)
    }).catch(() => {
      if (active) setError('Unable to load the summary. Please retry.')
    })
    return () => { active = false }
  }, [list, rowsKey, enabled, refreshKey])
  return { rows, error }
}
