import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Download, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import CashInOutTrendChart from '../../components/charts/CashInOutTrendChart'
import { exportReport, getReport } from '../../api/reports'
import { usePermission } from '../../auth/usePermission'
import { DEMO_MODE } from '../../config/demoMode'
import { PERIOD_OPTIONS, getDateRangeForPeriod } from './reportConstants'
import { col } from './reportConfig'
import { resolveColumns } from './reportDataUtils'
import ReportSummaryCards from './components/ReportSummaryCards'
import ReportTable from './components/ReportTable'
import CashFlowStatement from './components/CashFlowStatement'

const REPORT_TYPE = 'cash-flow-sheet'

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
]

// Exact backend summary keys confirmed for GET /reports/cash-flow-sheet.
const SUMMARY_CARDS = [
  { keys: ['cash_in'], label: 'Cash In', format: 'currency' },
  { keys: ['cash_out'], label: 'Cash Out', format: 'currency' },
  { keys: ['net_cash_flow'], label: 'Net Cash Flow', format: 'currency' },
  { keys: ['customer_payments_count'], label: 'Customer Payments', format: 'number' },
  { keys: ['supplier_payments_count'], label: 'Supplier Payments', format: 'number' },
  { keys: ['paid_expenses_count'], label: 'Paid Expenses', format: 'number' },
  { keys: ['total_transactions'], label: 'Total Transactions', format: 'number' },
]

// Fallback row schema (used only when the response has no meta.columns of its own). `cash_in`/
// `cash_out` here are THIS ROW's movement, not the summary totals above. `running_balance` is
// named directly in the confirmed backend contract - a report-period net-movement trajectory,
// not an actual bank/cash ledger balance, so it is deliberately labelled "Running Net Movement"
// here rather than "Balance".
const CASH_FLOW_COLUMNS = [
  col('date', 'Date', 'date'),
  col('transaction_type', 'Transaction Type', 'status'),
  col('reference', 'Reference', 'text'),
  col('party', 'Party / Payee', 'text'),
  col('cash_in', 'Cash In', 'currency', { align: 'right' }),
  col('cash_out', 'Cash Out', 'currency', { align: 'right' }),
  col('payment_mode', 'Payment Mode', 'status'),
  col('category', 'Category', 'text'),
  col('running_balance', 'Running Net Movement', 'currency', { align: 'right' }),
]

// Only renders the trend chart when the response actually carries a usable daily Cash In/Cash
// Out series - never reconstructed from the paginated `rows`, and never shown on a guess.
function hasCashTrendData(chart) {
  const data = Array.isArray(chart?.data) ? chart.data : []
  if (data.length === 0) return false
  const point = data[0]
  return 'date' in point && 'cash_in' in point && 'cash_out' in point
}

// Real GET /reports/cash-flow-sheet report - a truthful record of recorded cash inflows/outflows
// for the period, not a React-computed cash-flow calculation. Balance Sheet stays a separate,
// genuinely unavailable page (no Chart of Accounts/ledger backend exists for that one).
export default function CashFlowSheet() {
  const { can } = usePermission()
  const canExport = can('reports', 'export')

  const [period, setPeriod] = useState('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')

  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isExporting, setIsExporting] = useState('')
  const [exportError, setExportError] = useState('')

  const { dateFrom, dateTo } = useMemo(
    () => getDateRangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const requestParams = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    page,
    page_size: Number(pageSize),
  }), [dateFrom, dateTo, page, pageSize])

  const requestIdRef = useRef(0)

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setLoadError('')

    const result = await getReport(REPORT_TYPE, requestParams)
    if (requestIdRef.current !== requestId) return

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      setReport(null)
      return
    }

    if (result.report?.demoUnavailable) {
      setLoadError('demo-unavailable')
      setReport(null)
      return
    }

    setReport(result.report)
  }, [requestParams])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExport = async (format) => {
    setIsExporting(format)
    setExportError('')

    const { page: _page, page_size: _pageSize, ...exportParams } = requestParams
    const result = await exportReport(REPORT_TYPE, exportParams, format)

    setIsExporting('')
    if (!result.success) setExportError(result.error)
  }

  const rows = Array.isArray(report?.rows) ? report.rows : []
  const columns = useMemo(() => resolveColumns(report, CASH_FLOW_COLUMNS), [report])
  const pagination = report?.pagination
  const total = pagination?.total ?? rows.length
  const totalPages = pagination?.total_pages ?? 1
  const currentPage = pagination?.page ?? page
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * Number(pageSize), total)

  const isDemoUnavailable = loadError === 'demo-unavailable'
  const hasSummary = Object.keys(report?.summary || {}).length > 0
  const showChart = hasCashTrendData(report?.chart)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Cash Flow Sheet</h1>
        <p className="mt-1 text-sm text-neutral-500">Recorded cash inflows and outflows for the selected period.</p>
      </div>

      <Card className="p-0">
        <div className="space-y-3 border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-wrap items-end gap-2">
            <Select options={PERIOD_OPTIONS} value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }} className="w-44" />
            {period === 'custom' && (
              <>
                <DatePicker value={customFrom} onChange={(value) => { setCustomFrom(value); setPage(1) }} placeholder="From date" className="w-36" />
                <DatePicker value={customTo} onChange={(value) => { setCustomTo(value); setPage(1) }} placeholder="To date" className="w-36" />
              </>
            )}

            <Button type="button" variant="outline" size="sm" onClick={loadReport} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>

            {canExport && !DEMO_MODE && (
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" loading={isExporting === 'pdf'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('pdf')}>
                  <Download className="size-4" aria-hidden="true" />
                  Export PDF
                </Button>
                <Button type="button" variant="secondary" size="sm" loading={isExporting === 'excel'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('excel')}>
                  <Download className="size-4" aria-hidden="true" />
                  Export Excel
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          {exportError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{exportError}</div>
          )}
          {DEMO_MODE && (
            <p className="mb-4 text-xs text-neutral-400">Report export (PDF / Excel) is disabled in demo mode.</p>
          )}

          {isLoading ? (
            <LoadingSpinner label="Loading cash flow sheet…" />
          ) : loadError && !isDemoUnavailable ? (
            <EmptyState icon={Activity} title="Couldn't load the cash flow sheet" description={loadError} action={{ label: 'Try again', onClick: loadReport }} />
          ) : isDemoUnavailable ? (
            <EmptyState icon={Activity} title="Not available in demo mode" description="This report isn't simulated in demo mode. Connect the real backend to view it." />
          ) : !hasSummary && rows.length === 0 ? (
            <EmptyState icon={Activity} title="No cash movement found" description="No recorded cash transactions match the selected period." />
          ) : (
            <div className="space-y-5">
              <ReportSummaryCards summary={report?.summary} cards={SUMMARY_CARDS} />
              <CashFlowStatement summary={report?.summary} />

              {showChart && (
                <Card title="Cash In vs Cash Out" bodyClassName="pt-1">
                  <CashInOutTrendChart data={report.chart.data} />
                </Card>
              )}

              {rows.length > 0 && (
                <>
                  <ReportTable columns={columns} rows={rows} />

                  <div className="flex flex-col items-center justify-between gap-3 pt-1 text-sm text-neutral-500 sm:flex-row">
                    <div className="flex items-center gap-3">
                      <span>Showing <span className="font-semibold text-neutral-900">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-neutral-900">{total}</span></span>
                      <Select
                        options={PAGE_SIZE_OPTIONS}
                        value={pageSize}
                        onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                        triggerClassName="h-8 bg-surface py-1 text-xs"
                        className="w-28"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Previous</button>
                      <span className="min-w-16 text-center font-medium text-neutral-700">{currentPage} / {totalPages || 1}</span>
                      <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
