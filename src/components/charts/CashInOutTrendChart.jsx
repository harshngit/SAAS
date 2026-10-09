import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCompactCurrency, formatCurrency } from '../../utils/format'
import { CHART_PRIMARY, CHART_PRIMARY_SOFT, CHART_INK } from './chartTheme'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
      <p className="text-neutral-400">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-0.5 font-semibold text-neutral-900">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// Two-series daily trend (Cash In vs Cash Out) - the one chart shape in this app's Recharts
// infrastructure that doesn't exist yet as every other chart here (SalesLineChart,
// TopProductsBarChart, CategoryPieChart) plots a single series. Reuses the same monochrome
// palette/theme tokens rather than introducing a new (e.g. green/red) color language.
export default function CashInOutTrendChart({ data, dateKey = 'date', cashInKey = 'cash_in', cashOutKey = 'cash_out', height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
        <XAxis
          dataKey={dateKey}
          tick={{ fontSize: 12, fill: CHART_INK.muted }}
          axisLine={{ stroke: CHART_INK.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: CHART_INK.muted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCompactCurrency}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_INK.grid, opacity: 0.4 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
        <Bar dataKey={cashInKey} name="Cash In" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey={cashOutKey} name="Cash Out" fill={CHART_PRIMARY_SOFT} radius={[4, 4, 0, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
