import { MapPin } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatChartDate(value) {
  if (!value) return ''

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return ''
  const amount = Number(value)
  if (Number.isNaN(amount)) return ''
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatMinutes(minutes) {
  if (minutes == null) return ''
  return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`
}

export function describeLocation(location) {
  if (!location) return null
  if (typeof location === 'string') return location
  if (location.label) return location.label
  if (location.latitude != null && location.longitude != null) return `${location.latitude}, ${location.longitude}`
  if (location.lat != null && location.lng != null) return `${location.lat}, ${location.lng}`
  return null
}

// Exactly the fields the backend's delivery-workspace overview `summary` object supports -
// no invented stats. Currency ones get formatted, everything else prints as-is.
export const DELIVERY_SUMMARY_FIELDS = [
  { key: 'deliveries', label: 'Total Deliveries' },
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'partial', label: 'Partial' },
  { key: 'failed', label: 'Failed' },
  { key: 'delivery_value', label: 'Delivery Value', currency: true },
  { key: 'amount_collected', label: 'Amount Collected', currency: true },
  { key: 'amount_receivable', label: 'Amount Receivable', currency: true },
  { key: 'pod_completed', label: 'POD Completed' },
]

// Flat placeholder series for the Sales Performance chart - keeps the chart's shape/axes
// visible instead of a blank box when overview.performance is empty/missing.
export const emptyTrendPoints = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'].map((label) => ({ label, value: 0 }))

// Flat placeholder series for the Delivery Progress chart - mirrors emptyTrendPoints but with
// a second series so the bar+line combo shape stays visible with no real data.
export const emptyDeliveryPoints = ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM'].map((label) => ({ label, delivered: 0, amount: 0 }))

export function StatCard({ icon: Icon, iconClassName, label, value, caption, sublabel, onAction, actionLabel }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-white ${iconClassName}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      {caption && <p className="mt-2 text-xs text-neutral-400">{caption}</p>}
      <p className="mt-1 font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {onAction ? (
        <button type="button" onClick={onAction} className="mt-1 text-xs font-medium text-primary-700 hover:underline">
          {actionLabel} →
        </button>
      ) : (
        sublabel && <p className="mt-1 text-xs text-neutral-400">{sublabel}</p>
      )}
    </div>
  )
}

// A stat card with several small metrics side by side (e.g. Order Summary: Total / Delivered /
// Pending) instead of one headline number.
export function CompoundStatCard({ icon: Icon, iconClassName, title, metrics }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-center gap-2.5">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </div>
        <p className="truncate text-sm font-medium text-neutral-600">{title}</p>
      </div>
      <div className="mt-3 flex items-end gap-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <p className={`truncate text-lg font-semibold tracking-tight ${metric.toneClassName || 'text-neutral-900'}`}>{metric.value}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-400">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function EmptyPanelState({ message, note }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
      {note && <p className="mt-1 text-xs text-neutral-400">{note}</p>}
    </div>
  )
}

export function RecentActivityPanel({ isLoading, activity, emptyMessage, emptyNote }) {
  if (isLoading) {
    return <LoadingSpinner label="Loading recent activity..." />
  }

  if (!activity || activity.length === 0) {
    return <EmptyPanelState message={emptyMessage} note={emptyNote} />
  }

  return (
    <div className="space-y-3">
      {activity.slice(0, 6).map((item, index) => (
        <div key={item.id || index} className="flex items-start justify-between gap-3 border-b border-neutral-50 pb-3 last:border-b-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-800">{item.title || item.description || item.type || 'Activity'}</p>
            {item.detail && <p className="mt-0.5 truncate text-xs text-neutral-400">{item.detail}</p>}
          </div>
          {(item.created_at || item.date) && (
            <span className="shrink-0 text-xs text-neutral-400">{formatDate(item.created_at || item.date)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function CurrentLocationPanel({ isLoading, location }) {
  const label = describeLocation(location)

  if (isLoading) {
    return <LoadingSpinner label="Loading location..." />
  }

  if (!label) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 text-center">
        <MapPin className="size-5 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-500">No location reported yet</p>
        <p className="text-xs text-neutral-400">Shows once this staff member sends a live GPS ping.</p>
      </div>
    )
  }

  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 text-center">
      <MapPin className="size-5 text-primary-600" aria-hidden="true" />
      <p className="text-sm font-medium text-neutral-800">{label}</p>
      {location?.captured_at && <p className="text-xs text-neutral-400">as of {formatDate(location.captured_at)}</p>}
    </div>
  )
}
