import { Droplet } from 'lucide-react'
import { Skeleton } from './Skeleton'

export default function FullScreenLoader({ label = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-neutral-50/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-popover)" role="status" aria-live="polite" aria-label={label}>
        <div className="flex items-center gap-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
            <Droplet className="size-6 animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 rounded-lg" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}
