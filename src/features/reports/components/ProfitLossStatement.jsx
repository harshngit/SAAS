import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { resolveSummaryValue, formatPercent } from '../reportDataUtils'
import { formatCurrency } from '../../../utils/format'
import { exportReportRow } from '../../../api/reports'

// Each statement line IS one of P&L's "summary rows" - row export's row_id here is the exact
// backend summary bucket key the line's own value came from (confirmed pattern: e.g.
// "gross_sales", "net_profit") - never a made-up id, and never shown on a ratio line (Gross/Net
// Margin % aren't exportable documents, just derived percentages).
function RowExportButtons({ reportType, requestParams, bucketKey }) {
  const [isExporting, setIsExporting] = useState(null)
  if (!reportType || !bucketKey) return null

  const handleExport = async (format) => {
    if (isExporting) return
    setIsExporting(format)
    try {
      const { page: _page, page_size: _pageSize, ...filters } = requestParams || {}
      await exportReportRow(reportType, bucketKey, filters, format)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={Boolean(isExporting)}
        title="Export this line as PDF"
        onClick={() => handleExport('pdf')}
        className="flex size-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isExporting === 'pdf' ? <span className="size-2.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" aria-hidden="true" /> : <FileText className="size-3" aria-hidden="true" />}
      </button>
      <button
        type="button"
        disabled={Boolean(isExporting)}
        title="Export this line as Excel"
        onClick={() => handleExport('excel')}
        className="flex size-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isExporting === 'excel' ? <span className="size-2.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" aria-hidden="true" /> : <FileSpreadsheet className="size-3" aria-hidden="true" />}
      </button>
    </div>
  )
}

function ValueRow({ label, value, bold = false, indent = false, subtract = false, percent = false, bucketKey, reportType, requestParams }) {
  if (value === undefined) return null
  const numericValue = Number(value) || 0
  const displayValue = percent
    ? formatPercent(value)
    : subtract
      ? `(${formatCurrency(Math.abs(numericValue))})`
      : formatCurrency(numericValue)

  return (
    <tr className={bold ? 'bg-neutral-50/70 font-semibold text-neutral-900' : 'text-neutral-700'}>
      <td className={`px-4 py-2.5 ${indent ? 'pl-8' : ''}`}>{subtract ? `Less: ${label}` : label}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        <div className="flex items-center justify-end gap-3">
          {displayValue}
          {!percent && <RowExportButtons reportType={reportType} requestParams={requestParams} bucketKey={bucketKey} />}
        </div>
      </td>
    </tr>
  )
}

function SectionRow({ children }) {
  return (
    <tr className="border-y border-neutral-100 bg-neutral-50/80">
      <th colSpan="2" className="px-4 py-2 text-left text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
        {children}
      </th>
    </tr>
  )
}

export default function ProfitLossStatement({ summary, reportType, requestParams }) {
  const grossSales = resolveSummaryValue(summary, ['gross_sales'])
  const salesReturns = resolveSummaryValue(summary, ['sales_returns', 'sales_credits', 'returns_credits'])
  const netSales = resolveSummaryValue(summary, ['net_sales'])
  const cogs = resolveSummaryValue(summary, ['cogs'])
  const grossProfit = resolveSummaryValue(summary, ['gross_profit'])
  const operatingExpenses = resolveSummaryValue(summary, ['operating_expenses'])
  const netProfit = resolveSummaryValue(summary, ['net_profit'])
  const grossMargin = resolveSummaryValue(summary, ['gross_margin_percent', 'gross_margin'])
  const netMargin = resolveSummaryValue(summary, ['net_margin_percent', 'net_margin'])
  const hasRevenue = grossSales !== undefined || salesReturns !== undefined || netSales !== undefined
  const hasCostOrGrossProfit = cogs !== undefined || grossProfit !== undefined
  const hasExpensesOrNetProfit = operatingExpenses !== undefined || netProfit !== undefined

  if (netSales === undefined && grossProfit === undefined && netProfit === undefined) return null

  const rowProps = { reportType, requestParams }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
            <th className="px-4 py-2.5">Particulars</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {hasRevenue && (
            <>
              <SectionRow>Revenue</SectionRow>
              <ValueRow label="Gross Sales" value={grossSales} indent bucketKey="gross_sales" {...rowProps} />
              <ValueRow label="Sales Returns / Credits" value={salesReturns} indent subtract bucketKey="sales_returns" {...rowProps} />
              <ValueRow label="Net Sales" value={netSales} bold bucketKey="net_sales" {...rowProps} />
            </>
          )}

          {hasCostOrGrossProfit && (
            <>
              <SectionRow>Cost of Goods Sold</SectionRow>
              <ValueRow label="COGS" value={cogs} indent bucketKey="cogs" {...rowProps} />
              <ValueRow label="Gross Profit" value={grossProfit} bold bucketKey="gross_profit" {...rowProps} />
            </>
          )}

          {hasExpensesOrNetProfit && (
            <>
              <SectionRow>Operating Expenses</SectionRow>
              <ValueRow label="Operating Expenses" value={operatingExpenses} indent bucketKey="operating_expenses" {...rowProps} />
              <ValueRow label="Net Profit" value={netProfit} bold bucketKey="net_profit" {...rowProps} />
            </>
          )}

          {(grossMargin !== undefined || netMargin !== undefined) && <SectionRow>Margins</SectionRow>}
          <ValueRow label="Gross Margin %" value={grossMargin} percent />
          <ValueRow label="Net Margin %" value={netMargin} percent />
        </tbody>
      </table>
    </div>
  )
}
