import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { ListDataTable, ListTableToolbar } from '../../components/ui/ListPresentation'
import { listTickets, TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS } from '../../api/support'
import { formatDateTime } from '../../utils/format'
import { TICKET_STATUS_VARIANT, TICKET_PRIORITY_VARIANT, ticketStatusLabel, ticketPriorityLabel, ticketCategoryLabel } from './supportHelpers'

// My org's tickets (Admin sees every ticket in the org; Staff sees only their own - enforced
// server-side, this just renders whatever the backend returns). `reloadToken` is bumped by the
// parent after a new ticket is created so this list picks it up without owning that modal itself.
export default function TicketsTab({ reloadToken }) {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
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
      page_size: pageSize,
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
  }, [statusFilter, categoryFilter, priorityFilter, debouncedSearch, page, pageSize])

  useEffect(() => { load() }, [load, reloadToken])

  const appliedFilters = { statusFilter, categoryFilter, priorityFilter }
  const defaultFilters = { statusFilter: 'all', categoryFilter: 'all', priorityFilter: 'all' }
  const applyFilters = (next) => {
    setStatusFilter(next.statusFilter)
    setCategoryFilter(next.categoryFilter)
    setPriorityFilter(next.priorityFilter)
    setPage(1)
  }

  return (
    <div className="border-t border-neutral-100">
      <ListTableToolbar
        title="Tickets"
        resultCount={isLoading || loadError ? undefined : total}
        search={searchInput}
        onSearchChange={(event) => { setSearchInput(event.target.value); setPage(1) }}
        searchPlaceholder="Search tickets..."
        actions={(
          <ListFilterPanel title="Filter Tickets" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters}>
            {({ draft, set }) => (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                  <Select options={[{ value: 'all', label: 'All status' }, ...TICKET_STATUS_OPTIONS]} value={draft.statusFilter} onChange={(event) => set('statusFilter', event.target.value)} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Category
                  <Select options={[{ value: 'all', label: 'All categories' }, ...TICKET_CATEGORY_OPTIONS]} value={draft.categoryFilter} onChange={(event) => set('categoryFilter', event.target.value)} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Priority
                  <Select options={[{ value: 'all', label: 'All priorities' }, ...TICKET_PRIORITY_OPTIONS]} value={draft.priorityFilter} onChange={(event) => set('priorityFilter', event.target.value)} />
                </label>
              </>
            )}
          </ListFilterPanel>
        )}
      />

      {loadError ? (
        <div className="mx-5 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <ListDataTable
          loading={isLoading}
          searchable={false}
          renderToolbar={() => null}
          serverPagination
          page={page}
          pageSize={pageSize}
          onPageSizeChange={(next) => { setPageSize(next); setPage(1) }}
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
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
