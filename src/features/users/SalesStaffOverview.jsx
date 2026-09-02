import { Box, Clock, IndianRupee, MapPin, RefreshCw, Timer, Users } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatOrderStatus } from '../orders/orderHelpers'
import { formatTimeLabel } from '../attendance/attendanceUtils'
import {
  CurrentLocationPanel,
  EmptyPanelState,
  Panel,
  RecentActivityPanel,
  StatCard,
  describeLocation,
  formatCurrency,
  formatMinutes,
} from './staffOverviewShared'

// Top KPI row for the Sales workspace - shown above the tab bar regardless of active tab.
export function SalesStaffStatCards({ overview, todaysAttendance }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        icon={IndianRupee}
        iconClassName="bg-primary-700"
        label="Today's Sales"
        value={overview?.summary?.sales_amount != null ? formatCurrency(overview.summary.sales_amount) : '—'}
        sublabel={overview?.summary?.sales_amount != null ? 'Today' : 'Not tracked yet'}
      />
      <StatCard
        icon={Box}
        iconClassName="bg-amber-500"
        label="Orders"
        value={overview?.summary?.orders ?? '—'}
        sublabel={overview?.summary?.orders != null ? 'Today' : 'Not tracked yet'}
      />
      <StatCard
        icon={Users}
        iconClassName="bg-primary-700"
        label="Visits"
        value="—"
        sublabel="Not tracked yet"
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
        sublabel={todaysAttendance?.checkOut ? `Out ${formatTimeLabel(todaysAttendance.checkOut)}` : todaysAttendance?.checkIn ? 'Still on duty' : ''}
      />
    </div>
  )
}

// Overview-tab panels for the Sales workspace: performance chart, today's activity, recent
// tasks/visits + location, and recent orders + assigned customers.
export function SalesStaffOverviewPanels({
  overview,
  isLoadingOverview,
  salesTrendPoints,
  hasSalesPerformance,
  dutyMinutes,
  todaysAttendance,
  assignedCustomers,
  isLoadingCustomers,
  onViewOrders,
  onViewCustomers,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Sales Performance">
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrendPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9aa1ac' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9aa1ac' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={hasSalesPerformance ? '#16a34a' : '#d4d8dd'}
                  strokeWidth={2}
                  dot={hasSalesPerformance}
                />
              </LineChart>
            </ResponsiveContainer>
            {!hasSalesPerformance && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-400 shadow-(--shadow-xs)">
                  No sales data tracked for this employee yet
                </p>
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Today's Activity">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Clock className="size-3.5" aria-hidden="true" />Check-in Time</span>
              <span className="font-semibold text-neutral-900">{todaysAttendance?.checkIn ? formatTimeLabel(todaysAttendance.checkIn) : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Timer className="size-3.5" aria-hidden="true" />Active Duration</span>
              <span className="font-semibold text-neutral-900">{dutyMinutes != null ? formatMinutes(dutyMinutes) : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><Users className="size-3.5" aria-hidden="true" />Total Visits</span>
              <span className="font-semibold text-neutral-900">—</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-neutral-500"><RefreshCw className="size-3.5" aria-hidden="true" />Last Sync</span>
              <span className="font-semibold text-neutral-900">—</span>
            </div>
          </div>
          <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
            Visit and sync tracking isn't available yet - only attendance check-in/out is real.
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Recent Tasks & Visits">
          <RecentActivityPanel
            isLoading={isLoadingOverview}
            activity={overview?.recent_activity}
            emptyMessage="No tasks or visits recorded yet."
          />
        </Panel>
        <Panel title="Current Location">
          <CurrentLocationPanel isLoading={isLoadingOverview} location={overview?.current_location} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Order List" action={<button type="button" onClick={onViewOrders} className="text-sm font-medium text-primary-700 hover:underline">View All Orders →</button>}>
          {isLoadingOverview ? (
            <LoadingSpinner label="Loading orders..." />
          ) : (overview?.recent_orders || []).length === 0 ? (
            <EmptyPanelState message="No orders linked to this staff member yet." />
          ) : (
            <div className="space-y-2">
              {(overview.recent_orders || []).slice(0, 5).map((order, index) => (
                <Link
                  key={order.id || index}
                  to={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <span className="min-w-0 truncate font-medium text-neutral-800">{order.order_number || order.id}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{order.status ? formatOrderStatus(order.status) : '—'}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Assigned Customers" action={<button type="button" onClick={onViewCustomers} className="text-sm font-medium text-primary-700 hover:underline">View All Customers →</button>}>
          {isLoadingCustomers ? (
            <LoadingSpinner label="Loading customers..." />
          ) : assignedCustomers.length === 0 ? (
            <EmptyPanelState message="No customers assigned yet." />
          ) : (
            <div className="space-y-2">
              {assignedCustomers.slice(0, 5).map((customer) => (
                <Link
                  key={customer.id}
                  to={`/admin/customers/${customer.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <span className="min-w-0 truncate font-medium text-neutral-800">{customer.businessName || customer.name}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{customer.city || '—'}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
