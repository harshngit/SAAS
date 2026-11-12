import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import { ListDataTable } from '../../components/ui/ListPresentation'
import { listTickets, TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS } from '../../api/support'
import { formatDateTime } from '../../utils/format'
import { TICKET_STATUS_VARIANT, TICKET_PRIORITY_VARIANT, ticketStatusLabel, ticketPriorityLabel, ticketCategoryLabel } from './supportHelpers'

const PAGE_SIZE = 20

// My org's tickets (Admin sees every ticket in the org; Staff sees only their own - enforced
// server-side, this just renders whatever the backend returns). `reloadToken` is bumped by the
// parent after a new ticket is created so this list picks it up without owning that modal itself.
export default function TicketsTab({ reloadToken }) {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    listTickets({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: PAGE_SIZE,
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
  }, [statusFilter, categoryFilter, priorityFilter, debouncedSearch, page])

  useEffect(() => { load() }, [load, reloadToken])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); setPage(1) }}
            placeholder="Search tickets..."
            aria-label="Search tickets"
            className="h-9 w-full rounded-xl border border-neutral-200 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select options={[{ value: 'all', label: 'All status' }, ...TICKET_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
          <Select options={[{ value: 'all', label: 'All categories' }, ...TICKET_CATEGORY_OPTIONS]} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
          <Select options={[{ value: 'all', label: 'All priorities' }, ...TICKET_PRIORITY_OPTIONS]} value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }} triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs" />
        </div>
      </div>

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
          emptyTitle="No tickets yet"
          emptyDescription="Raise a ticket above and it will show up here."
          columns={[
            { key: 'ticketNumber', header: 'Ticket #', sortable: true },
            { key: 'subject', header: 'Subject', sortable: true, render: (row) => <span className="line-clamp-1">{row.subject}</span> },
            { key: 'category', header: 'Category', sortable: true, render: (row) => ticketCategoryLabel(row.category) },
            { key: 'priority', header: 'Priority', sortable: true, render: (row) => <Badge variant={TICKET_PRIORITY_VARIANT[row.priority] || 'neutral'}>{ticketPriorityLabel(row.priority)}</Badge> },
            { key: 'status', header: 'Status', sortable: true, render: (row) => <Badge variant={TICKET_STATUS_VARIANT[row.status] || 'neutral'} dot>{ticketStatusLabel(row.status)}</Badge> },
            { key: 'lastActivityAt', header: 'Last Activity', sortable: true, render: (row) => formatDateTime(row.lastActivityAt) },
          ]}
          data={tickets}
          onRowClick={(row) => navigate(`/support/tickets/${row.id}`)}
        />
      )}
    </div>
  )
}
