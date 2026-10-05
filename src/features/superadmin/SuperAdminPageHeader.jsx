export default function SuperAdminPageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-(--shadow-card) sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary-700">Platform control</p>
          <h1 className="mt-1 truncate font-(--font-display) text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
