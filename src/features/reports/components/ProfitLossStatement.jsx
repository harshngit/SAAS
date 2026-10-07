import { resolveSummaryValue } from '../reportDataUtils'
import { formatCurrency } from '../../../utils/format'
import { formatPercent } from '../reportDataUtils'

function Line({ label, value, bold, indent, subtract }) {
  if (value === undefined) return null
  return (
    <div className={`flex items-baseline justify-between py-2 ${bold ? 'font-semibold text-neutral-900' : 'text-neutral-600'} ${indent ? 'pl-4' : ''}`}>
      <span>{subtract ? `Less: ${label}` : label}</span>
      <span className="tabular-nums">{subtract ? `(${formatCurrency(Math.abs(Number(value) || 0))})` : formatCurrency(Number(value) || 0)}</span>
    </div>
  )
}

// A real financial-statement layout, not a generic table - every figure is read straight from
// backend summary (section headers are presentation only); nothing here is computed in React.
export default function ProfitLossStatement({ summary }) {
  const grossSales = resolveSummaryValue(summary, ['gross_sales'])
  const salesReturns = resolveSummaryValue(summary, ['sales_returns', 'sales_credits', 'returns_credits'])
  const netSales = resolveSummaryValue(summary, ['net_sales'])
  const cogs = resolveSummaryValue(summary, ['cogs'])
  const grossProfit = resolveSummaryValue(summary, ['gross_profit'])
  const operatingExpenses = resolveSummaryValue(summary, ['operating_expenses'])
  const netProfit = resolveSummaryValue(summary, ['net_profit'])
  const grossMargin = resolveSummaryValue(summary, ['gross_margin_percent', 'gross_margin'])
  const netMargin = resolveSummaryValue(summary, ['net_margin_percent', 'net_margin'])

  if (netSales === undefined && grossProfit === undefined && netProfit === undefined) return null

  return (
    <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100 px-5">
      <section className="py-1">
        <p className="pt-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Revenue</p>
        <Line label="Gross Sales" value={grossSales} indent />
        <Line label="Sales Returns / Credits" value={salesReturns} indent subtract />
        <Line label="Net Sales" value={netSales} bold />
      </section>

      <section className="py-1">
        <p className="pt-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Cost of Goods Sold</p>
        <Line label="COGS" value={cogs} indent />
      </section>

      <section className="py-1">
        <Line label="Gross Profit" value={grossProfit} bold />
      </section>

      <section className="py-1">
        <p className="pt-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Operating Expenses</p>
        <Line label="Operating Expenses" value={operatingExpenses} indent />
      </section>

      <section className="py-1">
        <Line label="Net Profit" value={netProfit} bold />
      </section>

      {(grossMargin !== undefined || netMargin !== undefined) && (
        <section className="flex flex-wrap gap-x-8 gap-y-1 py-3">
          {grossMargin !== undefined && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Gross Margin %</p>
              <p className="mt-0.5 text-base font-semibold text-neutral-900 tabular-nums">{formatPercent(grossMargin)}</p>
            </div>
          )}
          {netMargin !== undefined && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Net Margin %</p>
              <p className="mt-0.5 text-base font-semibold text-neutral-900 tabular-nums">{formatPercent(netMargin)}</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
