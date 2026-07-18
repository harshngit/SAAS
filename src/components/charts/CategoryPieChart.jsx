import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatNumber } from '../../utils/format'
import { CATEGORICAL_COLORS, foldToOther } from './chartTheme'

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const percent = total ? Math.round((item.value / total) * 100) : 0
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
      <p className="text-neutral-400">{item.name}</p>
      <p className="mt-0.5 font-semibold text-neutral-900">
        {formatNumber(item.value)} <span className="font-normal text-neutral-400">({percent}%)</span>
      </p>
    </div>
  )
}

export default function CategoryPieChart({ data, dataKey = 'value', nameKey = 'name', height = 240, centerLabel }) {
  const prepared = foldToOther(data, { valueKey: dataKey, labelKey: nameKey })
  const total = prepared.reduce((sum, item) => sum + item[dataKey], 0)

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={prepared}
              dataKey={dataKey}
              nameKey={nameKey}
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              cornerRadius={3}
              stroke="none"
            >
              {prepared.map((entry, index) => (
                <Cell key={entry[nameKey]} fill={CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-semibold text-neutral-900">{centerLabel.value}</p>
            <p className="text-xs text-neutral-400">{centerLabel.label}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {prepared.map((entry, index) => {
          const percent = total ? Math.round((entry[dataKey] / total) * 100) : 0
          return (
            <div key={entry[nameKey]} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="text-neutral-600">{entry[nameKey]}</span>
              <span className="font-medium text-neutral-900">{percent}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
