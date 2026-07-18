import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { formatCompactCurrency, formatCurrency } from '../../utils/format'
import { CHART_PRIMARY, CHART_INK } from './chartTheme'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
      <p className="text-neutral-400">{item.payload.name}</p>
      <p className="mt-0.5 font-semibold text-neutral-900">{formatCurrency(item.value)}</p>
    </div>
  )
}

export default function TopProductsBarChart({ data, dataKey = 'value', nameKey = 'name', height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }} barCategoryGap={12}>
        <CartesianGrid horizontal={false} stroke={CHART_INK.grid} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={{ fontSize: 12, fill: CHART_INK.secondary }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_INK.grid, opacity: 0.4 }} />
        <Bar dataKey={dataKey} fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} barSize={20}>
          <LabelList
            dataKey={dataKey}
            position="right"
            formatter={formatCompactCurrency}
            fill={CHART_INK.primary}
            fontSize={12}
            fontWeight={600}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
