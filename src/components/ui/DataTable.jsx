import { useMemo, useState } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import ActionMenu from './ActionMenu'
import EmptyState from './EmptyState'
import LoadingSpinner from './LoadingSpinner'

function compareValues(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export default function DataTable({
  columns,
  data,
  rowKey = 'id',
  searchable = true,
  searchPlaceholder = 'Search…',
  searchKeys,
  pageSize = 10,
  actions,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription,
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: null, direction: 'asc' })
  const [page, setPage] = useState(1)

  const effectiveSearchKeys = searchKeys || columns.map((column) => column.key)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const term = search.trim().toLowerCase()
    return data.filter((row) =>
      effectiveSearchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(term)),
    )
  }, [data, search, effectiveSearchKeys])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      const result = compareValues(a[sort.key], b[sort.key])
      return sort.direction === 'asc' ? result : -result
    })
    return copy
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const colSpan = columns.length + (actions ? 1 : 0)

  const handleSearchChange = (event) => {
    setSearch(event.target.value)
    setPage(1)
  }

  const toggleSort = (column) => {
    if (!column.sortable) return
    setSort((prev) => {
      if (prev.key !== column.key) return { key: column.key, direction: 'asc' }
      if (prev.direction === 'asc') return { key: column.key, direction: 'desc' }
      return { key: null, direction: 'asc' }
    })
  }

  const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left')

  return (
    <div>
      {searchable && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <p className="text-xs font-medium text-neutral-400">
            {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-[1rem] border border-neutral-100 bg-white shadow-(--shadow-xs)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400 ${alignClass(column.align)}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="inline-flex items-center gap-1 hover:text-neutral-700"
                    >
                      {column.header}
                      {sort.key === column.key ? (
                        sort.direction === 'asc' ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 text-neutral-300" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {actions && <th className="w-12 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {loading ? (
              <tr>
                <td colSpan={colSpan}>
                  <LoadingSpinner label="Loading…" />
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row[rowKey]} className="transition-colors hover:bg-primary-50/35">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3.5 text-neutral-700 ${alignClass(column.align)}`}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu items={actions(row)} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
