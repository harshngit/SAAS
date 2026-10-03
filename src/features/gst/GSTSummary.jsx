import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { TrendingUp, TrendingDown, IndianRupee, FileSpreadsheet } from 'lucide-react'
import { formatCurrency, toLocalDateString } from '../../utils/format'
import { getReport } from '../../api/reports'
import { humanizeKey } from '../reports/reportConstants'

// Same real report the Reports module already calls - GET /reports/gst-summary via getReport().
// No separate GST API exists or is needed; this page is just a GST-focused view onto it.
const REPORT_TYPE = 'gst-summary'

function dateRangeForTab(tab) {
  const today = new Date()
  const todayStr = toLocalDateString(today)

  if (tab === 'monthly') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { dateFrom: toLocalDateString(from), dateTo: todayStr }
  }

  if (tab === 'quarterly') {
    const from = new Date(today.getFullYear(), today.getMonth() - 2, 1)
    return { dateFrom: toLocalDateString(from), dateTo: todayStr }
  }

  // yearly -> current financial year (Apr-Mar), matching the Reports module's own "fy" period.
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  const from = new Date(fyStartYear, 3, 1)
  return { dateFrom: toLocalDateString(from), dateTo: todayStr }
}

// Tries a few plausible real key names for each headline figure before giving up - never
// fabricates a number. If none match, the card honestly shows "Not available" rather than 0.
function pickSummaryValue(summary, keys) {
  if (!summary || typeof summary !== 'object') return null
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') return summary[key]
  }
  return null
}

function GstPeriodPanel({ tab, isActive }) {
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isActive) return undefined
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setLoadError('')
      const { dateFrom, dateTo } = dateRangeForTab(tab)
      const result = await getReport(REPORT_TYPE, { date_from: dateFrom, date_to: dateTo })
      if (!isMounted) return
      setIsLoading(false)

      if (!result.success) {
        setReport(null)
        setLoadError(result.error)
        return
      }
      if (result.report?.demoUnavailable) {
        setReport(null)
        setLoadError('GST summary data is not available yet.')
        return
      }
      setReport(result.report)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [tab, isActive])

  const summary = report?.summary && typeof report.summary === 'object' ? report.summary : null
  const summaryEntries = summary ? Object.entries(summary) : []
  const rows = Array.isArray(report?.rows) ? report.rows : []
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading GST summary..." />
      </Card>
    )
  }

  if (loadError || (summaryEntries.length === 0 && rows.length === 0)) {
    return (
      <Card>
        <EmptyState
          icon={FileSpreadsheet}
          title="No GST data for this period"
          description={loadError || 'GST summary data is not available yet.'}
        />
      </Card>
    )
  }

  return (
    <Card>
      {summaryEntries.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryEntries.map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{humanizeKey(key)}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">{String(value)}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
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
      )}
    </Card>
  )
}

export default function GSTSummary() {
  const [activeTab, setActiveTab] = useState('monthly')
  const [headline, setHeadline] = useState(null)
  const [isHeadlineLoading, setIsHeadlineLoading] = useState(true)

  // Headline cards track whichever tab is active, same real GET /reports/gst-summary call.
  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsHeadlineLoading(true)
      const { dateFrom, dateTo } = dateRangeForTab(activeTab)
      const result = await getReport(REPORT_TYPE, { date_from: dateFrom, date_to: dateTo })
      if (!isMounted) return
      setIsHeadlineLoading(false)
      setHeadline(result.success && !result.report?.demoUnavailable ? result.report : null)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [activeTab])

  const summary = headline?.summary && typeof headline.summary === 'object' ? headline.summary : null
  const outputGst = pickSummaryValue(summary, ['output_gst', 'outputGst', 'output_gst_collected', 'gst_collected', 'output'])
  const inputGst = pickSummaryValue(summary, ['input_gst', 'inputGst', 'input_gst_paid', 'gst_paid', 'input'])
  const netPayable = pickSummaryValue(summary, ['net_gst_payable', 'netGstPayable', 'net_payable', 'net_gst'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">GST Summary</h1>
        <p className="mt-1 text-sm text-neutral-500">View GST payable and input tax credit summary</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          iconVariant="warning"
          label="Output GST (Collected)"
          value={isHeadlineLoading ? '…' : outputGst !== null ? formatCurrency(outputGst) : 'Not available'}
        />
        <StatCard
          icon={TrendingDown}
          iconVariant="info"
          label="Input GST (Paid)"
          value={isHeadlineLoading ? '…' : inputGst !== null ? formatCurrency(inputGst) : 'Not available'}
        />
        <StatCard
          icon={IndianRupee}
          iconVariant="danger"
          label="Net GST Payable"
          value={isHeadlineLoading ? '…' : netPayable !== null ? formatCurrency(netPayable) : 'Not available'}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <GstPeriodPanel tab="monthly" isActive={activeTab === 'monthly'} />
        </TabsContent>
        <TabsContent value="quarterly">
          <GstPeriodPanel tab="quarterly" isActive={activeTab === 'quarterly'} />
        </TabsContent>
        <TabsContent value="yearly">
          <GstPeriodPanel tab="yearly" isActive={activeTab === 'yearly'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
