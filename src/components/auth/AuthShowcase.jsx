import { Droplet } from 'lucide-react'

export default function AuthShowcase() {
  return (
    <aside className="relative hidden min-h-0 w-1/2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-(--shadow-popover) lg:block">
      <img
        src="/image/digital illustration .jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-linear-to-b from-white/72 via-white/12 to-white/16" />

      <div className="relative flex h-full flex-col justify-between p-8 xl:p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
            <Droplet className="size-5" />
          </div>
          <span className="font-(--font-display) text-lg font-semibold tracking-tight text-neutral-900">SAAS CRM</span>
        </div>
      </div>
    </aside>
  )
}
