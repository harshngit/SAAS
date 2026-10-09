import { resolveSummaryValue } from '../reportDataUtils'
import { formatCurrency } from '../../../utils/format'

function Line({ label, value, bold, indent }) {
  if (value === undefined) return null
  return (
    <div className={`flex items-baseline justify-between py-2 ${bold ? 'font-semibold text-neutral-900' : 'text-neutral-600'} ${indent ? 'pl-4' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(Number(value) || 0)}</span>
    </div>
  )
}

// A real statement layout, same idiom as ProfitLossStatement.jsx - every figure read straight
// from the backend summary, nothing computed in React. `customer_collections`/`supplier_payments`/
// `expenses` are the same confirmed field names this Reports domain already uses for the sibling
// Daily Transactions report; this report shows them only when the backend actually sends that
// breakdown, and otherwise falls back to the always-confirmed cash_in/cash_out totals so the
// statement is never left showing nothing under Cash Inflows/Cash Outflows.
export default function CashFlowStatement({ summary }) {
  const cashIn = resolveSummaryValue(summary, ['cash_in'])
  const cashOut = resolveSummaryValue(summary, ['cash_out'])
  const netCashFlow = resolveSummaryValue(summary, ['net_cash_flow'])
  const customerCollections = resolveSummaryValue(summary, ['customer_collections'])
  const supplierPayments = resolveSummaryValue(summary, ['supplier_payments'])
  const paidExpenses = resolveSummaryValue(summary, ['expenses'])

  if (cashIn === undefined && cashOut === undefined && netCashFlow === undefined) return null

  const hasOutflowBreakdown = supplierPayments !== undefined || paidExpenses !== undefined

  return (
    <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100 px-5">
      <p className="pt-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Operating Cash Activities</p>

      <section className="py-1">
        <p className="pt-3 text-xs font-medium text-neutral-500">Cash Inflows</p>
        {customerCollections !== undefined ? (
          <Line label="Customer Collections" value={customerCollections} indent />
        ) : (
          <Line label="Total Cash In" value={cashIn} indent />
        )}
      </section>

      <section className="py-1">
        <p className="pt-3 text-xs font-medium text-neutral-500">Cash Outflows</p>
        {hasOutflowBreakdown ? (
          <>
            <Line label="Supplier Payments" value={supplierPayments} indent />
            <Line label="Paid Operating Expenses" value={paidExpenses} indent />
          </>
        ) : (
          <Line label="Total Cash Out" value={cashOut} indent />
        )}
      </section>

      <section className="py-1">
        <Line label="Net Recorded Cash Flow" value={netCashFlow} bold />
      </section>

      <p className="py-3 text-xs text-neutral-400">
        Investing and financing activities are not yet tracked as formal accounting categories.
      </p>
    </div>
  )
}
