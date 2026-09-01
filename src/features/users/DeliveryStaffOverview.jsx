import { Box, Clock, MapPin, RefreshCw, Timer, Truck, Wallet } from 'lucide-react'
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatTimeLabel } from '../attendance/attendanceUtils'
import {
  CompoundStatCard,
  CurrentLocationPanel,
  DELIVERY_SUMMARY_FIELDS,
  EmptyPanelState,
  Panel,
  RecentActivityPanel,
  StatCard,
  describeLocation,
  formatCurrency,
  formatMinutes,
} from './staffOverviewShared'

// Top KPI row for the Delivery workspace - shown above the tab bar regardless of active tab.
export function DeliveryStaffStatCards({ overview, todaysAttendance, dutyMinutes }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CompoundStatCard
        icon={Box}
        iconClassName="bg-primary-50 text-primary-700"
        title="Order Summary"
        metrics={[
          { label: 'Total Orders', value: overview?.summary?.deliveries ?? '—' },
          { label: 'Delivered', value: overview?.summary?.completed ?? '—' },
          { label: 'Pending', value: overview?.summary?.pending ?? '—', toneClassName: 'text-amber-600' },
        ]}
      />
      <CompoundStatCard
        icon={Wallet}
        iconClassName="bg-primary-50 text-primary-700"
        title="Payment Summary"
        metrics={[
          {
            label: 'Total Sales',
            value: overview?.summary?.delivery_value != null ? formatCurrency(overview.summary.delivery_value) : '—',
          },
          {
            label: 'Amount Collected',
            value: overview?.summary?.amount_collected != null ? formatCurrency(overview.summary.amount_collected) : '—',
          },
          {
            label: 'Receivable',
            value: overview?.summary?.amount_receivable != null ? formatCurrency(overview.summary.amount_receivable) : '—',
            toneClassName: 'text-amber-600',
          },
        ]}
      />
      <StatCard
        icon={MapPin}
        iconClassName="bg-primary-700"
        label="Current Location"
        value={describeLocation(overview?.current_location) || 'Not tracked'}
        sublabel={describeLocation(overview?.current_location) ? 'From latest GPS ping' : 'No location reported yet'}
      />
      <StatCard
        icon={Clock}
        iconClassName="bg-primary-700"
        label="Check-in / Check-out"
        value={todaysAttendance?.checkIn ? formatTimeLabel(todaysAttendance.checkIn) : 'Not checked in'}
        sublabel={dutyMinutes != null ? `${formatMinutes(dutyMinutes)} active` : todaysAttendance?.checkOut ? `Out ${formatTimeLabel(todaysAttendance.checkOut)}` : ''}
      />
    </div>
  )
}

// Overview-tab panels for the Delivery workspace: delivery progress chart, today's activity,
// recent activity + location, assigned deliveries + delivery summary, and vehicle/loading.
export function DeliveryStaffOverviewPanels({
  overview,
  isLoadingOverview,
  deliveryTrendPoints,
  hasDeliveryPerformance,
  dutyMinutes,
  onViewDeliveries,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Delivery Progress">
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={deliveryTrendPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9aa1ac' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9aa1ac' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip />
                <Bar
                  dataKey="delivered"
                  fill={hasDeliveryPerformance ? '#16a34a' : '#e5e7eb'}
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={hasDeliveryPerformance ? '#2563eb' : '#d4d8dd'}
                  strokeWidth={2}
                  dot={hasDeliveryPerformance}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {!hasDeliveryPerformance && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-400 shadow-(--shadow-xs)">
                  No delivery data tracked for this employee yet
                </p>
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Today's Activity">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Truck className="size-3.5" aria-hidden="true" />Route Status</span>
              <span className="font-semibold text-neutral-900">—</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Timer className="size-3.5" aria-hidden="true" />Active Duration</span>
              <span className="font-semibold text-neutral-900">{dutyMinutes != null ? formatMinutes(dutyMinutes) : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Box className="size-3.5" aria-hidden="true" />Stops Completed</span>
              <span className="font-semibold text-neutral-900">—</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><RefreshCw className="size-3.5" aria-hidden="true" />Last Sync</span>
              <span className="font-semibold text-neutral-900">—</span>
            </div>
          </div>
          <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
            Route and stop tracking isn't available yet - only attendance check-in/out is real.
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Recent Delivery Activity">
          <RecentActivityPanel
            isLoading={isLoadingOverview}
            activity={overview?.recent_activity}
            emptyMessage="No delivery activity recorded yet."
          />
        </Panel>
        <Panel title="Current Location">
          <CurrentLocationPanel isLoading={isLoadingOverview} location={overview?.current_location} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Assigned Deliveries" action={<button type="button" onClick={onViewDeliveries} className="text-sm font-medium text-primary-700 hover:underline">View All Deliveries →</button>}>
          {isLoadingOverview ? (
            <LoadingSpinner label="Loading deliveries..." />
          ) : (overview?.assigned_deliveries || []).length === 0 ? (
            <EmptyPanelState message="No deliveries linked to this staff member yet." />
          ) : (
            <div className="space-y-2">
              {(overview.assigned_deliveries || []).slice(0, 5).map((delivery, index) => (
                <div key={delivery.id || index} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-neutral-800">{delivery.order_number || delivery.id}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{delivery.status || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Delivery Summary">
          {isLoadingOverview ? (
            <LoadingSpinner label="Loading summary..." />
          ) : overview?.summary && Object.keys(overview.summary).length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {DELIVERY_SUMMARY_FIELDS.filter((field) => overview.summary[field.key] !== undefined).map((field) => (
                <div key={field.key} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <p className="text-xs text-neutral-400">{field.label}</p>
                  <p className="mt-0.5 text-base font-semibold text-neutral-900">
                    {field.currency
                      ? formatCurrency(overview.summary[field.key]) || '₹ 0'
                      : String(overview.summary[field.key])}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanelState message="No delivery summary available yet." />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Panel title="Vehicle">
          {isLoadingOverview ? (
            <LoadingSpinner label="Loading vehicle..." />
          ) : !overview?.vehicle ? (
            <EmptyPanelState message="No vehicle assigned or active loading session." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <p className="text-xs text-neutral-400">Vehicle Number</p>
                  <p className="mt-0.5 text-base font-semibold text-neutral-900">
                    {overview.vehicle.vehicle_number || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <p className="text-xs text-neutral-400">Vehicle Type</p>
                  <p className="mt-0.5 text-base font-semibold text-neutral-900">
                    {overview.vehicle.vehicle_type || '—'}
                  </p>
                </div>
              </div>

              {Array.isArray(overview.vehicle.items) && overview.vehicle.items.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Loaded Items
                  </p>
                  <div className="space-y-2">
                    {overview.vehicle.items.map((item, index) => (
                      <div
                        key={item.id || item.product_id || index}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-neutral-800">
                          {item.product_name || item.name || item.product_id || 'Item'}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          Loaded {item.loaded_qty ?? item.loaded_quantity ?? 0}
                          {(item.returned_qty ?? item.returned_quantity) != null
                            ? ` · Returned ${item.returned_qty ?? item.returned_quantity}`
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">No active loading session.</p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
