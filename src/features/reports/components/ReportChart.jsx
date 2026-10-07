import Card from '../../../components/ui/Card'
import SalesLineChart from '../../../components/charts/SalesLineChart'
import TopProductsBarChart from '../../../components/charts/TopProductsBarChart'
import CategoryPieChart from '../../../components/charts/CategoryPieChart'

// Resolves which keys in a chart.data point to plot WITHOUT guessing: either the report's own
// explicit chartKeys config (confirmed backend key names - see reportConfig.js), or, failing
// that, the one generic shape the backend contract itself names as valid ("label -> value").
// Anything else returns null and the chart stays hidden rather than picking an arbitrary
// numeric field, which is unsafe once a point can carry more than one number (e.g. a P&L point
// with net_sales, cogs and net_profit all on one row - "first numeric field" would silently pick
// whichever happens to serialize first).
function resolveSeriesKeys(point, chartKeys) {
  if (chartKeys && point && chartKeys.labelKey in point && chartKeys.valueKey in point) {
    return { labelKey: chartKeys.labelKey, valueKey: chartKeys.valueKey, valueType: chartKeys.valueType || 'number' }
  }
  if (point && 'label' in point && 'value' in point) {
    return { labelKey: 'label', valueKey: 'value', valueType: chartKeys?.valueType || 'number' }
  }
  return null
}

// Renders only when the backend actually sent chart data AND this report has a confirmed key
// mapping for it (or the data itself uses the generic label/value shape) - never forced onto a
// report, never guessed, cleanly hidden for chart.type "none", empty data, or an unrecognized
// point shape.
export default function ReportChart({ chart, fallbackTitle, chartKeys }) {
  const data = Array.isArray(chart?.data) ? chart.data : []
  if (!chart || chart.type === 'none' || data.length === 0) return null

  const resolved = resolveSeriesKeys(data[0], chartKeys)
  if (!resolved) return null

  const { labelKey, valueKey, valueType } = resolved
  const title = chart.title || fallbackTitle

  return (
    <Card title={title} bodyClassName="pt-1">
      {chart.type === 'line' && <SalesLineChart data={data} dataKey={valueKey} labelKey={labelKey} valueType={valueType} />}
      {chart.type === 'bar' && <TopProductsBarChart data={data} dataKey={valueKey} nameKey={labelKey} />}
      {chart.type === 'pie' && <CategoryPieChart data={data} dataKey={valueKey} nameKey={labelKey} />}
    </Card>
  )
}
