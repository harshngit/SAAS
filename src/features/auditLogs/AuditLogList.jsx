import { useEffect, useMemo, useState } from 'react'
import { History, CreditCard, CircleUserRound, MapPin, Image as ImageIcon, Globe, FileText, Users, CheckCircle2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { getOrganizationOverview } from '../../api/organizations'

// Same real recent_activity vocabulary already proven correct in CompanySettings.jsx's own
// overview dashboard (GET /organizations/overview?activity_limit=N). Kept as its own local copy
// here rather than importing from CompanySettings.jsx, which isn't a shared module.
const ACTION_ICON_BY_TYPE = {
  company_profile: CheckCircle2,
  billing: CreditCard,
  authorized_person: CircleUserRound,
  address: MapPin,
  branding: ImageIcon,
  online_presence: Globe,
  document: FileText,
  employee: Users,
}

const ACTION_COLOR_BY_TYPE = {
  company_profile: 'text-green-600 bg-green-50',
  billing: 'text-blue-600 bg-blue-50',
  authorized_person: 'text-sky-600 bg-sky-50',
  address: 'text-orange-600 bg-orange-50',
  branding: 'text-violet-600 bg-violet-50',
  online_presence: 'text-blue-600 bg-blue-50',
  document: 'text-amber-600 bg-amber-50',
  employee: 'text-green-600 bg-green-50',
}

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const ACTIVITY_LIMIT = 50

export default function AuditLogList() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const load = async () => {
    setIsLoading(true)
    setLoadError('')

    // Canonical source: GET /organizations/overview?activity_limit=N -> recent_activity.
    // No separate /audit-logs endpoint exists or is invented here.
    const result = await getOrganizationOverview(ACTIVITY_LIMIT)

    if (!result.success) {
      setLogs([])
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    const recentActivity = Array.isArray(result.overview?.recent_activity) ? result.overview.recent_activity : []
    setLogs(recentActivity)
    setIsLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const filteredLogs = useMemo(() => logs.filter((log) => isWithinDateRange(log.at, dateFrom, dateTo)), [logs, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Audit Logs</h1>
          <p className="text-sm text-neutral-500">Recent changes to your organization's profile, billing, documents and team</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} className="w-44" />
          <p className="text-[0.68rem] text-neutral-400">Filters only the {ACTIVITY_LIMIT} most recent entries loaded.</p>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6">
            <LoadingSpinner label="Loading activity..." />
          </div>
        ) : loadError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={History} title="No recent activity" description="Changes to your organization will show up here." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState icon={History} title="No activity in this date range" description="Try widening the date range." />
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              {filteredLogs.map((log, index) => {
                const Icon = ACTION_ICON_BY_TYPE[log.type] || History
                const colorClass = ACTION_COLOR_BY_TYPE[log.type] || 'text-neutral-600 bg-neutral-50'
                return (
                  <div key={log.id || index} className="flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-neutral-50">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${colorClass}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-900">{log.title || 'Update'}</span>
                        <span className="text-xs text-neutral-400">{formatTimestamp(log.at)}</span>
                      </div>
                      {log.description && <p className="mt-1 text-sm text-neutral-600">{log.description}</p>}
                      {log.by && <p className="mt-1 text-xs text-neutral-500">By: {log.by}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
