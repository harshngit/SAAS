import { useCallback, useMemo, useState } from 'react'

const NEXT_ORDER = { asc: 'desc', desc: null }

// Shared sort-state primitive for every server-side-sorted listing table in the app. Clicking a
// column cycles unsorted -> asc -> desc -> unsorted; clicking a DIFFERENT column always starts
// that column fresh at asc, never carrying over the previous column's direction.
//
// `sortParams` is the exact { sort_by, sort_order } shape ready to spread into a backend list
// request - it's an EMPTY object while unsorted, so an unsorted table never sends a stale/empty
// sort_by param to the API (the list simply falls back to the backend's own default order).
export function useSortState() {
  const [sort, setSort] = useState({ sortBy: null, sortOrder: 'asc' })

  const toggleSort = useCallback((field) => {
    setSort((current) => {
      if (current.sortBy !== field) return { sortBy: field, sortOrder: 'asc' }
      const nextOrder = NEXT_ORDER[current.sortOrder]
      return nextOrder ? { sortBy: field, sortOrder: nextOrder } : { sortBy: null, sortOrder: 'asc' }
    })
  }, [])

  const resetSort = useCallback(() => setSort({ sortBy: null, sortOrder: 'asc' }), [])

  // Memoized on the underlying values, not re-created every render, so callers can safely put
  // `sortParams` in a useCallback/useEffect dependency array without triggering an infinite
  // refetch loop (a fresh {} literal on every render would change identity even when unsorted).
  const sortParams = useMemo(
    () => (sort.sortBy ? { sort_by: sort.sortBy, sort_order: sort.sortOrder } : {}),
    [sort.sortBy, sort.sortOrder],
  )

  return { sortBy: sort.sortBy, sortOrder: sort.sortOrder, toggleSort, resetSort, sortParams }
}
