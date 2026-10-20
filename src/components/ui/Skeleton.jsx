import { useEffect, useState } from 'react'

function Skeleton({ className = '', style }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block animate-pulse rounded-full bg-neutral-200/60 motion-reduce:animate-none ${className}`}
    />
  )
}

function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

// Keep previously loaded summary values visible during table-only refreshes.
function SkeletonValue({ loading, children, className = '' }) {
  const [hasLoaded, setHasLoaded] = useState(!loading)
  useEffect(() => { if (!loading) setHasLoaded(true) }, [loading])
  return loading && !hasLoaded ? <Skeleton className={className} /> : <>{children}</>
}

function SkeletonCard({ lines = 4, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={lines} />
        </div>
      </div>
    </div>
  )
}

function PageSkeleton({ label, rows = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-live="polite" aria-label={label || 'Loading'}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-6 w-44 max-w-full rounded-lg" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-28 rounded-full sm:block" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonCard key={index} lines={index % 2 === 0 ? 4 : 3} />
        ))}
      </div>
      {label && <span className="sr-only">{label}</span>}
    </div>
  )
}

function TableSkeleton({ columns = 5, rows = 6, avatarColumn = -1, checkboxColumn = -1, cellClassName = 'px-4 py-3.5' }) {
  const cells = Array.isArray(columns) ? columns : Array.from({ length: columns }, () => ({}))
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {cells.map((column, columnIndex) => (
            <td key={columnIndex} className={cellClassName}>
              {columnIndex === avatarColumn ? <div className="flex items-center gap-3"><Skeleton className="size-10 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3 w-28 max-w-full" /><Skeleton className="h-2.5 w-36 max-w-full" /></div></div> :
              <Skeleton
                className={`${columnIndex === checkboxColumn ? 'size-4 rounded' : `h-3.5 ${
                  column.align === 'right' ? 'ml-auto w-16' : columnIndex === 0
                    ? 'w-28'
                    : columnIndex === cells.length - 1
                      ? 'w-10'
                      : 'w-20'
                } max-w-full`}`}
              />}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export { Skeleton, SkeletonValue, SkeletonText, SkeletonCard, PageSkeleton, TableSkeleton }
