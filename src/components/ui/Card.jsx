export default function Card({ title, subtitle, actions, className = '', bodyClassName = '', children }) {
  // A padding class passed via `className` (e.g. `p-0` on list cards) has to win. Tailwind
  // can't guarantee that from class order alone (`.p-5` is emitted after `.p-0`), so drop the
  // default `p-5` whenever the caller sets any padding class of their own.
  const hasPaddingOverride = /(^|\s)-?(p|px|py|pt|pb|pl|pr)-/.test(className)
  // Only when the override ZEROES the card padding does the title header need its own inset,
  // so the heading isn't flush against the border. If the override just resizes it (e.g. `p-4`),
  // the card's own padding already spaces the header.
  const zeroedPadding = /(^|\s)(p|px|pt|pl)-0(?![.\d])/.test(className)

  return (
    <div
      className={`rounded-2xl border border-neutral-100 bg-white/95 ${hasPaddingOverride ? '' : 'p-5'} shadow-(--shadow-card) transition-all duration-200 hover:shadow-(--shadow-card-hover) ${className}`}
    >
      {(title || actions) && (
        <div className={`mb-5 flex items-start justify-between gap-3 ${zeroedPadding ? 'px-5 pt-5' : ''}`}>
          {title && (
            <div>
              <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-neutral-900">{title}</h3>
              {subtitle && <p className="mt-1 text-xs leading-5 text-neutral-400">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
