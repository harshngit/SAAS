import { Droplet } from 'lucide-react'

export default function FullScreenLoader({ label = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-neutral-50/95 backdrop-blur-sm">
      <div className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary-500/25" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
          <Droplet className="size-8 animate-pulse" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1.5">
          <span className="size-2 animate-bounce rounded-full bg-primary-600 [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-primary-600 [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-primary-600" />
        </div>
        <p className="text-sm font-medium text-neutral-600">{label}</p>
      </div>
    </div>
  )
}
