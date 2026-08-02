import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { exportReport, getReport } from '../../api/reports'
import { PERIOD_OPTIONS, REPORT_TYPES, getDateRangeForPeriod, humanizeKey } from './reportConstants'

export default function FinancialReports() {
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value)
  const [period, setPeriod] = useState('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isExporting, setIsExporting] = useState('')
  const [exportError, setExportError] = useState('')

  const { dateFrom, dateTo } = useMemo(
    () => getDateRangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      setIsLoading(true)
      setLoadError('')
      setExportError('')

      const result = await getReport(reportType, { date_from: dateFrom, date_to: dateTo })

      if (!isMounted) return
      setIsLoading(false)

      if (!result.success) {
        setReport(null)
        setLoadError(result.error)
        return
      }

      setReport(result.report)
    }

    loadReport()

    return () => {
      isMounted = false
    }
  }, [reportType, dateFrom, dateTo])

  const handleExport = async (format) => {
    setIsExporting(format)
    setExportError('')

    const result = await exportReport(reportType, { date_from: dateFrom, date_to: dateTo }, format)

    setIsExporting('')

    if (!result.success) {
      setExportError(result.error)
    }
  }

  const summaryEntries = report?.summary && typeof report.summary === 'object' ? Object.entries(report.summary) : []
  const rows = Array.isArray(report?.rows) ? report.rows : []
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  const currentReportLabel = REPORT_TYPES.find((item) => item.value === reportType)?.label

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Financial Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">Generate, review and export every accounting report for your firm</p>
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Select
              options={REPORT_TYPES}
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              className="lg:w-72"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                options={PERIOD_OPTIONS}
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="sm:w-44"
              />
              {period === 'custom' && (
                <>
                  <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="From date" />
                  <DatePicker value={customTo} onChange={setCustomTo} placeholder="To date" />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {exportError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {exportError}
            </div>
          )}

          {isLoading ? (
            <LoadingSpinner label={`Loading ${currentReportLabel}...`} />
          ) : loadError || rows.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No data for the selected period"
              description={loadError || `${currentReportLabel} will appear here once there is data for ${dateFrom} to ${dateTo}.`}
            />
          ) : (
            <div className="space-y-5">
              {summaryEntries.length > 0 && (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {summaryEntries.map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{humanizeKey(key)}</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      {columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-4 py-2.5">{humanizeKey(column)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rows.map((row, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td key={column} className="whitespace-nowrap px-4 py-2.5 text-neutral-700">
                            {String(row[column] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              loading={isExporting === 'pdf'}
              disabled={Boolean(isExporting) || isLoading}
              onClick={() => handleExport('pdf')}
            >
              <Download className="size-4" aria-hidden="true" />
              Export PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={isExporting === 'excel'}
              disabled={Boolean(isExporting) || isLoading}
              onClick={() => handleExport('excel')}
            >
              <Download className="size-4" aria-hidden="true" />
              Export Excel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
