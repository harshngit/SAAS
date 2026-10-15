import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

// Drop-in replacement for a plain <th> in any .listing-table (or generic `main table`) - it
// renders only the click target + sort-direction icon and relies entirely on the page's existing
// thead styling (src/index.css: accent background + accent-contrast text) for color/padding, so
// it never hardcodes its own header colors and stays correct under any theme accent.
//
// Pass `sortKey` + `sortable` (default true) to make a column clickable; omit `sortKey` or pass
// `sortable={false}` for non-sortable columns (checkboxes, Actions, icon-only columns) - those
// render as a plain <th>, no button, no icon, not keyboard-focusable.
export default function SortableHeaderCell({
  label,
  sortKey,
  sortBy,
  sortOrder,
  onSort,
  align = 'left',
  sortable = true,
  className = '',
  children,
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const content = children ?? label

  if (!sortable || !sortKey || typeof onSort !== 'function') {
    return <th className={`${alignClass} ${className}`}>{content}</th>
  }

  const isActive = sortBy === sortKey
  const nextAction = !isActive ? 'Sort ascending' : sortOrder === 'asc' ? 'Sort descending' : 'Clear sorting'

  return (
    <th
      className={`${alignClass} ${className}`}
      aria-sort={isActive ? (sortOrder === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-2 rounded-sm cursor-pointer select-none [text-transform:inherit] hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${
          align === 'right' ? 'flex-row-reverse' : align === 'center' ? 'justify-center' : ''
        }`}
        aria-label={`${label}: ${nextAction.toLowerCase()}`}
        title={`${nextAction}${isActive ? ` (currently ${sortOrder === 'asc' ? 'ascending' : 'descending'})` : ''}`}
      >
        <span>{content}</span>
        <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true">
          {!isActive ? (
            <ChevronsUpDown className="size-3.5 opacity-50" />
          ) : sortOrder === 'asc' ? (
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="size-3.5" strokeWidth={2.5} />
          )}
        </span>
      </button>
    </th>
  )
}
