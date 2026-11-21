import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Select from './Select'

export const PAGE_SIZE_CHOICES = [10, 25, 50, 100]

// The one pagination footer every list page uses (same look as the Customers table):
//   Showing 1–25 of 77  |  Rows per page [25]            [<]  2 / 4  [>]
// Works for both kinds of list: a server-paged one (the caller keeps `page` / `pageSize` in state and
// refetches) and a client-side one (see usePageSlice below). Pass `total` = the number of rows in the
// FILTERED result, so the count always matches what the filters/search show.
export default function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_CHOICES,
  loading = false,
  className = '',
}) {
  const size = Math.max(1, Number(pageSize) || 10)
  const count = Math.max(0, Number(total) || 0)
  const totalPages = Math.max(1, Math.ceil(count / size))
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const from = count === 0 ? 0 : (current - 1) * size + 1
  const to = Math.min(count, current * size)

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-surface px-5 py-4 text-xs text-fg-muted ${className}`} data-testid="pagination-footer">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-live="polite">Showing <span className="font-semibold text-fg">{from}–{to}</span> of <span className="font-semibold text-fg">{count}</span></span>
        {onPageSizeChange && (
          <>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page
              <Select
                options={pageSizeOptions.map((value) => ({ value: String(value), label: String(value) }))}
                value={String(size)}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="w-20"
                triggerClassName="h-8 bg-surface py-1 text-xs"
              />
            </label>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={current <= 1 || loading} onClick={() => onPageChange(current - 1)} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        <span className="min-w-14 text-center font-medium text-fg">{current} / {totalPages}</span>
        <button type="button" disabled={current >= totalPages || loading} onClick={() => onPageChange(current + 1)} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  )
}

// Client-side paging for a list that is fully loaded and filtered in the browser.
//   const { rows, page, pageSize, setPage, setPageSize } = usePageSlice(filteredRows, { resetKey })
// `resetKey` changes whenever a filter / search / sort changes: the list goes back to page 1 (and a page
// beyond the last one - e.g. after the data shrinks - is clamped). Changing rows-per-page also returns to page 1.
export function usePageSlice(items, { initialPageSize = 10, resetKey = '' } = {}) {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => { setPageState(1) }, [resetKey])

  const current = Math.min(page, totalPages)
  const rows = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize])
  const setPage = (next) => setPageState(Math.min(Math.max(1, next), totalPages))
  const setPageSize = (next) => { setPageSizeState(next); setPageState(1) }

  return { rows, page: current, pageSize, total: items.length, setPage, setPageSize }
}
