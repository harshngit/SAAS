import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CircleUserRound,
  CreditCard,
  Download,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  MapPin,
  Users,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import PaginationFooter from '../../components/ui/PaginationFooter'
import { ListTableToolbar } from '../../components/ui/ListPresentation'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'
import { getOrganizationOverview } from '../../api/organizations'

// Same real recent_activity vocabulary already proven correct in CompanySettings.jsx's own
// overview dashboard (GET /organizations/overview?activity_limit=N -> OverviewActivity.type).
// This IS the real audit trail - no separate /audit-logs endpoint exists or is invented here.
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

const TYPE_LABEL = {
  company_profile: 'Company Profile',
  billing: 'Billing',
  authorized_person: 'Authorized Person',
  address: 'Address',
  branding: 'Branding',
  online_presence: 'Online Presence',
  document: 'Document',
  employee: 'Employee',
}

const TYPE_BADGE_VARIANT = {
  company_profile: 'success',
  billing: 'info',
  authorized_person: 'primary',
  address: 'warning',
  branding: 'purple',
  online_presence: 'info',
  document: 'neutral',
  employee: 'success',
}

function typeLabel(type) {
  return TYPE_LABEL[type] || (type ? type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Update')
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// The backend's own documented max for this query param (GET /organizations/overview's
// activity_limit, 1-100) - the fullest real audit trail this endpoint can return in one call.
const ACTIVITY_LIMIT = 100

function exportAuditLogs(rows) {
  const headers = ['Date', 'Type', 'Title', 'Description', 'By']
  const dataRows = rows.map((log) => [log.at, typeLabel(log.type), log.title || '', log.description || '', log.by || ''])
  exportRowsToExcel('audit-log', [headers, ...dataRows], 'Audit Log', { columns: [{ type: 'datetime' }, { type: 'text' }, { type: 'text', width: 30 }, { type: 'longtext', width: 46 }, { type: 'text' }] })
}

export default function AuditLogList() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  const load = async () => {
    setIsLoading(true)
    setLoadError('')

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

  // Options derived from whatever is actually loaded - never a guessed list - so a type/actor
  // that doesn't appear in the current activity never shows as a dead filter option.
  const typeOptions = useMemo(() => {
    const distinct = Array.from(new Set(logs.map((log) => log.type).filter(Boolean)))
    distinct.sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)))
    return [{ value: '', label: 'All types' }, ...distinct.map((type) => ({ value: type, label: typeLabel(type) }))]
  }, [logs])

  const actorOptions = useMemo(() => {
    const distinct = Array.from(new Set(logs.map((log) => log.by).filter(Boolean)))
    distinct.sort((a, b) => a.localeCompare(b))
    return [{ value: '', label: 'All team members' }, ...distinct.map((by) => ({ value: by, label: by }))]
  }, [logs])

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const filteredLogs = useMemo(
    () =>
      logs
        .filter((log) => isWithinDateRange(log.at, dateFrom, dateTo))
        .filter((log) => !typeFilter || log.type === typeFilter)
        .filter((log) => !actorFilter || log.by === actorFilter),
    [logs, dateFrom, dateTo, typeFilter, actorFilter],
  )

  // This activity feed (getOrganizationOverview) loads its full matching set in one call with
  // no backend sort_by - sorting is done locally over the already-loaded array.
  const { sortBy, sortOrder, toggleSort } = useSortState()
  const visibleLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const base = !query
      ? filteredLogs
      : filteredLogs.filter((log) =>
          [log.title, log.description, log.by, typeLabel(log.type)].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)),
        )

    if (!sortBy) return base

    const accessors = {
      title: (log) => log.title?.toLowerCase() || '',
      type: (log) => typeLabel(log.type)?.toLowerCase() || '',
      by: (log) => log.by?.toLowerCase() || '',
      at: (log) => new Date(log.at || 0).getTime(),
    }
    const accessor = accessors[sortBy]
    if (!accessor) return base

    const sorted = [...base].sort((a, b) => {
      const valueA = accessor(a)
      const valueB = accessor(b)
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    })
    return sortOrder === 'desc' ? sorted.reverse() : sorted
  }, [filteredLogs, searchTerm, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedLogs = useMemo(
    () => visibleLogs.slice((safeCurrentPage - 1) * rowsPerPage, safeCurrentPage * rowsPerPage),
    [visibleLogs, rowsPerPage, safeCurrentPage],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeFilter, actorFilter, datePreset, customFrom, customTo, rowsPerPage, sortBy, sortOrder])

  const appliedFilters = { typeFilter, actorFilter, datePreset, customFrom, customTo }
  const defaultFilters = { typeFilter: '', actorFilter: '', datePreset: 'all', customFrom: '', customTo: '' }
  const applyFilters = (next) => {
    setTypeFilter(next.typeFilter)
    setActorFilter(next.actorFilter)
    setDatePreset(next.datePreset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
  }

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Audit Log</h1>
      </div>

      <Card className="overflow-hidden p-0">
        <ListTableToolbar
          title="Audit Logs"
          subtitle={`The last ${logs.length} recorded changes to your organization's profile, billing, documents and team.`}
          resultCount={isLoading || loadError ? undefined : visibleLogs.length}
          search={searchTerm}
          onSearchChange={(event) => setSearchTerm(event.target.value)}
          searchPlaceholder="Search audit log..."
          actions={(
            <>
              <ListFilterPanel title="Filter Audit Log" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters}>
                {({ draft, set, errors }) => (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Type
                      <Select options={typeOptions} value={draft.typeFilter} onChange={(event) => set('typeFilter', event.target.value)} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Team member
                      <Select searchable options={actorOptions} value={draft.actorFilter} onChange={(event) => set('actorFilter', event.target.value)} />
                    </label>
                    <FilterDateRange label="Date" draft={draft} set={set} errors={errors} />
                    <p className="text-xs text-neutral-400">Filters apply only to the {ACTIVITY_LIMIT} most recent entries loaded.</p>
                  </>
                )}
              </ListFilterPanel>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportAuditLogs(visibleLogs)}>
                <Download className="size-4" aria-hidden="true" />
                Export
              </Button>
            </>
          )}
        />

        <div className="overflow-x-auto border-t border-neutral-100 bg-surface">
          {isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-[56rem]" columns={["Action", "Type", "By", "Date"]} label="Loading activity..." />
          ) : loadError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState icon={History} title="No recent activity" description="Changes to your organization will show up here." />
          ) : visibleLogs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No activity found</p>
              <p className="mt-1 text-sm text-neutral-500">Try changing the search or filters.</p>
            </div>
          ) : (
            <table className="listing-table w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <SortableHeaderCell label="Action" sortKey="title" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                  <SortableHeaderCell label="Type" sortKey="type" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                  <SortableHeaderCell label="By" sortKey="by" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                  <SortableHeaderCell label="Date" sortKey="at" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => {
                  const Icon = ACTION_ICON_BY_TYPE[log.type] || History
                  const colorClass = ACTION_COLOR_BY_TYPE[log.type] || 'text-neutral-600 bg-neutral-50'
                  return (
                    <tr key={log.id || index} className="bg-surface transition-colors hover:bg-primary-50/30">
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                            <Icon className="size-4.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900">{log.title || 'Update'}</p>
                            {log.description && <p className="mt-0.5 max-w-md text-xs text-neutral-500">{log.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={TYPE_BADGE_VARIANT[log.type] || 'neutral'}>{typeLabel(log.type)}</Badge>
                      </td>
                      <td className="px-6 py-5 text-neutral-600">{log.by || '—'}</td>
                      <td className="px-6 py-5 whitespace-nowrap text-neutral-600">{formatTimestamp(log.at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && !loadError && visibleLogs.length > 0 && (
          <PaginationFooter page={safeCurrentPage} pageSize={rowsPerPage} total={visibleLogs.length} onPageChange={setCurrentPage} onPageSizeChange={setRowsPerPage} />
        )}
      </Card>
    </div>
  )
}
