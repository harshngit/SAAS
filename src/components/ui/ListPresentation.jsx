import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import DataTable from './DataTable'

// Opt-in presentation for the list pages. Existing shared components and Leads
// keep their current appearance and behavior.
export function ListHeader({ children }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white/95 shadow-(--shadow-card)">
      <div className="flex flex-col flex-wrap gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-xl [&_h2]:tracking-tight [&_p]:text-xs [&_p]:text-neutral-400 [&_button]:h-9 [&_button]:rounded-xl [&_button]:text-xs">
        {children}
      </div>
    </div>
  )
}

export function ListSummary({ children, className = '' }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 shadow-(--shadow-card) [&>*]:min-w-0 [&>*]:bg-white ${className}`}>
      {children}
    </div>
  )
}

export function ListOverview({ children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white/95 shadow-(--shadow-card) [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none [&>div+div]:border-t [&>div+div]:border-neutral-100">
      {children}
    </div>
  )
}

export function ListStatCard({ icon: Icon, label, value, delta, actions, className = '' }) {
  return (
    <div className={`h-full min-h-32 bg-white px-5 py-4 lg:px-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#6b86ad]">{label}</p>
        <div className="flex shrink-0 items-center gap-1">
          {Icon && (
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
          {actions}
        </div>
      </div>
      <p className="mt-4 break-words font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
      {delta && (
        <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${delta.positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {delta.trend === 'up' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
          {delta.label}
        </p>
      )}
    </div>
  )
}

export function ListTableToolbar({ title, subtitle, search, onSearchChange, searchPlaceholder, resultCount, actions }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-neutral-900">{title}</h3>
          {resultCount != null && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-500" aria-live="polite">{resultCount} {resultCount === 1 ? 'result' : 'results'}</span>}
        </div>
        {subtitle && <p className="mt-1 text-xs leading-5 text-neutral-400">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:shrink-0">
        {onSearchChange && (
          <div className="relative min-w-0 flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input type="search" aria-label={searchPlaceholder || `Search ${title}`} value={search} onChange={onSearchChange} placeholder={searchPlaceholder}
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white py-1.5 pl-9 pr-3 text-xs text-neutral-700 shadow-(--shadow-xs) transition-colors placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
          </div>
        )}
        {actions && <div className="w-full shrink-0 sm:w-44">{actions}</div>}
      </div>
    </div>
  )
}

export function ListDataTable({ title, subtitle, toolbarActions, ...props }) {
  if (title) {
    return (
      <div className="[&>div>div.overflow-x-auto]:rounded-none [&>div>div.overflow-x-auto]:border-x-0 [&>div>div:last-child:not(.overflow-x-auto)]:px-5 [&>div>div:last-child:not(.overflow-x-auto)]:pb-4">
        <DataTable {...props} renderToolbar={({ search, onSearchChange, resultCount, searchable }) => (
          <ListTableToolbar title={title} subtitle={subtitle} search={search} onSearchChange={searchable ? onSearchChange : undefined} searchPlaceholder={props.searchPlaceholder} resultCount={resultCount} actions={toolbarActions} />
        )} />
      </div>
    )
  }
  return (
    <div className="[&_input]:h-9 [&_input]:rounded-xl [&_input]:bg-white [&_input]:py-1.5 [&_input]:text-xs [&>div>div:first-child]:px-5 [&>div>div:first-child]:pt-4 [&>div>div:first-child]:sm:flex-row-reverse [&>div>div.overflow-x-auto]:rounded-none [&>div>div.overflow-x-auto]:border-x-0 [&>div>div:last-child:not(.overflow-x-auto)]:px-5 [&>div>div:last-child:not(.overflow-x-auto)]:pb-4">
      <DataTable {...props} />
    </div>
  )
}
