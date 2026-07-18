import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format'
import { CHART_PRIMARY, CHART_INK } from './chartTheme'

function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
      <p className="text-neutral-400">{label}</p>
      <p className="mt-0.5 font-semibold text-neutral-900">{formatValue(payload[0].value)}</p>
    </div>
  )
}

export default function SalesLineChart({
  data,
  dataKey = 'value',
  labelKey = 'label',
  height = 260,
  valueType = 'currency',
  tickInterval,
  showDots = true,
}) {
  const formatValue = valueType === 'currency' ? formatCurrency : formatNumber
  const formatTick = valueType === 'currency' ? formatCompactCurrency : formatNumber

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesLineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
        <XAxis
          dataKey={labelKey}
          tick={{ fontSize: 12, fill: CHART_INK.muted }}
          axisLine={{ stroke: CHART_INK.axis }}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fontSize: 12, fill: CHART_INK.muted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatTick}
          allowDecimals={false}
          width={56}
        />
        <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={CHART_PRIMARY}
          strokeWidth={2}
          fill="url(#salesLineFill)"
          dot={showDots ? { r: 3, fill: CHART_PRIMARY, stroke: '#fff', strokeWidth: 2 } : false}
          activeDot={{ r: 6, fill: CHART_PRIMARY, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
