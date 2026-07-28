export default function Card({ title, subtitle, actions, className = '', bodyClassName = '', children }) {
  return (
    <div
      className={`rounded-[1.5rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card) transition-all duration-200 hover:shadow-(--shadow-card-hover) ${className}`}
    >
      {(title || actions) && (
        <div className="mb-5 flex items-start justify-between gap-3">
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
