import { SkeletonText } from './Skeleton'
import { ActivityLoading, CardsLoading, DashboardLoading, DetailLoading, FieldsLoading, FormLoading, ListLoading, MapLoading, PaymentLoading, ReportLoading, SettingsLoading, StatsLoading, TableLoading, VehicleStockLoading } from './LoadingLayouts'

// Layout is explicitly chosen by the caller, never inferred from a route or loading label.
export default function LoadingSpinner({ size = 'md', label = 'Loading...', className = '', variant = 'section', ...props }) {
  const layouts = { table: TableLoading, dashboard: DashboardLoading, detail: DetailLoading,
    form: FormLoading, settings: SettingsLoading, activity: ActivityLoading, cards: CardsLoading,
    stats: StatsLoading, report: ReportLoading, fields: FieldsLoading, map: MapLoading, list: ListLoading, payment: PaymentLoading, 'vehicle-stock': VehicleStockLoading }
  const Layout = layouts[variant]

  return (
    <div className={`min-w-0 ${className}`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <div aria-hidden="true">{Layout ? <Layout {...props} /> : <SkeletonText lines={size === 'sm' ? 2 : 4} className="py-4" />}</div>
      <span className="sr-only">{label}</span>
    </div>
  )
}
