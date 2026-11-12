import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Search, UserX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import DatePicker from '../../components/ui/DatePicker'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { ListHeader, ListSummary, ListStatCard as StatCard, ListDataTable } from '../../components/ui/ListPresentation'
import { listPlatformSupportTickets, getPlatformSupportSummary } from '../../api/platformSupport'
import { listPlatformOrganizations } from '../../api/platform'
import { useAuthStore } from '../../store/authStore'
import { platformRoleForUser } from '../../auth/platformRoles'
import { formatDateTime } from '../../utils/format'
import {
  TICKET_PRIORITY_VARIANT,
  TICKET_STATUS_VARIANT,
  ticketPriorityLabel,
  ticketStatusLabel,
} from './supportHelpers'
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS } from '../../api/support'

const PAGE_SIZE = 20

export default function PlatformSupportTickets() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSuperAdmin = platformRoleForUser(currentUser) === 'super_admin'

  const [tickets, setTickets] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [organizations, setOrganizations] = useState([])
  const [summary, setSummary] = useState(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)

  const [organizationId, setOrganizationId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    listPlatformOrganizations().then((result) => {
      if (result.success) setOrganizations(result.organizations)
    })
  }, [])

  const loadSummary = useCallback(() => {
    setIsLoadingSummary(true)
    getPlatformSupportSummary().then((result) => {
      setSummary(result.success ? result : null)
      setIsLoadingSummary(false)
    })
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary])

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    listPlatformSupportTickets({
      organizationId: organizationId !== 'all' ? organizationId : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      assignedToMe: assignedToMe || undefined,
      unassigned: unassignedOnly || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then((result) => {
      if (!result.success) {
        setTickets([])
        setTotal(0)
        setLoadError(result.error)
      } else {
        setTickets(result.tickets)
        setTotal(result.total)
      }
      setIsLoading(false)
    })
  }, [organizationId, statusFilter, priorityFilter, categoryFilter, assignedToMe, unassignedOnly, dateFrom, dateTo, debouncedSearch, page])

  useEffect(() => { load() }, [load])

  const organizationOptions = useMemo(
    () => [{ value: 'all', label: 'All organizations' }, ...organizations.map((org) => ({ value: org.id, label: org.name }))],
    [organizations],
  )

  const hasExtraFilters = organizationId !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || assignedToMe || unassignedOnly || Boolean(dateFrom) || Boolean(dateTo)
  const clearFilters = () => {
    setOrganizationId('all')
    setPriorityFilter('all')
    setCategoryFilter('all')
    setAssignedToMe(false)
    setUnassignedOnly(false)
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const by = summary?.byPriority || {}

  return (
    <div className="listing-page space-y-4">
      <ListHeader>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Support Tickets</h1>
          <p className="mt-1 text-xs text-neutral-400">Every organization's support tickets across the platform.</p>
        </div>
      </ListHeader>

      <ListSummary loading={isLoadingSummary} className="grid-cols-2 lg:grid-cols-5">
        <StatCard icon={HelpCircle} label="Total" value={summary?.total ?? '—'} />
        <StatCard icon={Clock} label="Open" value={summary?.byStatus?.open ?? '—'} />
        <StatCard icon={AlertTriangle} label="In Progress" value={summary?.byStatus?.in_progress ?? '—'} />
        <StatCard icon={UserX} label="Unassigned (active)" value={summary?.unassigned ?? '—'} />
        <StatCard icon={CheckCircle2} label="No Reply > 24h" value={summary?.noPublicReplyOver24h ?? '—'} />
      </ListSummary>

      {summary && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-100 bg-surface px-5 py-3">
          <span className="text-xs font-medium text-neutral-400">By priority:</span>
          {TICKET_PRIORITY_OPTIONS.map((option) => (
            <Badge key={option.value} variant={TICKET_PRIORITY_VARIANT[option.value] || 'neutral'}>{option.label}: {by[option.value] ?? 0}</Badge>
          ))}
        </div>
      )}

      {loadError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <ListDataTable
          loading={isLoading}
          searchable={false}
          serverPagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          totalCount={total}
          onPageChange={setPage}
          rowKey="id"
          emptyTitle="No tickets match these filters"
          renderToolbar={() => (
            <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-neutral-900">Tickets</h3>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-500">{total} {total === 1 ? 'result' : 'results'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                  <input type="search" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(1) }} placeholder="Search tickets..." aria-label="Search tickets"
                    className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
                </div>
                <Select options={[{ value: 'all', label: 'All status' }, ...TICKET_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
                <ListFilterPanel title="Filter Tickets">
                  <Select label="Organization" options={organizationOptions} value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPage(1) }} className="w-full" triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
                  <Select label="Priority" options={[{ value: 'all', label: 'All priorities' }, ...TICKET_PRIORITY_OPTIONS]} value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }} className="w-full" triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
                  <Select label="Category" options={[{ value: 'all', label: 'All categories' }, ...TICKET_CATEGORY_OPTIONS]} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} className="w-full" triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                    <input type="checkbox" checked={assignedToMe} onChange={(event) => { setAssignedToMe(event.target.checked); setPage(1) }} />
                    Assigned to me
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                    <input type="checkbox" checked={unassignedOnly} onChange={(event) => { setUnassignedOnly(event.target.checked); setPage(1) }} />
                    Unassigned only
                  </label>
                  <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Date Range
                    <div className="flex gap-2">
                      <DatePicker value={dateFrom} onChange={(value) => { setDateFrom(value); setPage(1) }} placeholder="From date" />
                      <DatePicker value={dateTo} onChange={(value) => { setDateTo(value); setPage(1) }} placeholder="To date" />
                    </div>
                  </div>
                  {hasExtraFilters && (
                    <button type="button" onClick={clearFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
                  )}
                </ListFilterPanel>
              </div>
            </div>
          )}
          columns={[
            { key: 'organizationName', header: 'Organization', sortable: true, render: (row) => row.organizationName || '—' },
            { key: 'ticketNumber', header: 'Ticket #', sortable: true },
            { key: 'subject', header: 'Subject', sortable: true, render: (row) => <span className="line-clamp-1">{row.subject}</span> },
            { key: 'priority', header: 'Priority', sortable: true, render: (row) => <Badge variant={TICKET_PRIORITY_VARIANT[row.priority] || 'neutral'}>{ticketPriorityLabel(row.priority)}</Badge> },
            { key: 'status', header: 'Status', sortable: true, render: (row) => <Badge variant={TICKET_STATUS_VARIANT[row.status] || 'neutral'} dot>{ticketStatusLabel(row.status)}</Badge> },
            { key: 'assignedToName', header: 'Assignee', sortable: true, render: (row) => row.assignedToName || 'Unassigned' },
            { key: 'lastActivityAt', header: 'Last Activity', sortable: true, render: (row) => formatDateTime(row.lastActivityAt) },
          ]}
          data={tickets}
          onRowClick={(row) => navigate(`${isSuperAdmin ? '/superadmin' : '/platform'}/support-tickets/${row.id}`)}
        />
      )}
    </div>
  )
}
