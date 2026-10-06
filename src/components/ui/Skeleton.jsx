function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-surface-muted ${className}`}
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

function TableSkeleton({ columns = 5, rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-4 py-3.5">
              <Skeleton
                className={`h-3.5 ${
                  columnIndex === 0
                    ? 'w-28'
                    : columnIndex === columns - 1
                      ? 'w-10'
                      : 'w-20'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export { Skeleton, SkeletonText, SkeletonCard, PageSkeleton, TableSkeleton }
