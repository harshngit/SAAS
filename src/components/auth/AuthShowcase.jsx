export default function AuthShowcase() {
  return (
    <aside className="relative hidden min-h-0 w-1/2 overflow-hidden rounded-2xl border border-neutral-200 bg-surface shadow-(--shadow-popover) lg:block">
      <img
        src="/image/digital illustration .jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-linear-to-b from-white/72 via-white/12 to-white/16" />

      <div className="relative flex h-full flex-col justify-between p-8 xl:p-10">
        <div className="flex items-center gap-2.5">
          <img src="/image/sass-logo.png" alt="Beas Suite" className="h-20 w-auto object-contain" />
        </div>
      </div>
    </aside>
  )
}
