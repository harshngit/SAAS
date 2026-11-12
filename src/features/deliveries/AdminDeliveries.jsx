import { ListOverview, ListSummary, ListDataTable as DataTable, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Truck, CheckCircle2, Clock, Search, UserX, XCircle, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { listDeliveries, listDeliveryPartners, getDeliverySummary } from '../../api/deliveries'
import { DELIVERY_STAGE_FILTER_OPTIONS, getDeliveryStage } from './deliveryStage'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'

const PAGE_SIZE = 20

// Maps this page's fine-grained UI stage keys to the backend's own `GET /deliveries?status=`
// filter value. 'picking' has no backend `status` value of its own - it's filtered via the
// separate `picking_status=picking` param instead (see loadDeliveries). 'failed' maps to the
// backend's `returned` status - the backend has no distinct "failed" status; a failed delivery
// is represented as `returned`.
const STATUS_FILTER_TO_BACKEND = {
  unassigned: 'unassigned',
  assigned: 'pending',
  accepted: 'accepted',
  ready: 'ready',
  loaded: 'loaded',
  in_transit: 'in_transit',
  delivered: 'delivered',
  rejected: 'rejected',
  partially_delivered: 'partially_delivered',
  failed: 'returned',
  cancelled: 'cancelled',
}

// Date-only value at UTC midnight (e.g. "2026-11-10T00:00:00Z") - formatted off the UTC date
// parts directly so the calendar day never shifts for a viewer whose local timezone is behind
// UTC (a plain local-timezone format would roll it back a day for them).
function formatScheduledDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${day} ${month} ${date.getUTCFullYear()}`
}

export default function AdminDeliveries() {
  const navigate = useNavigate()
  const [deliveries, setDeliveries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [partners, setPartners] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [partnerFilter, setPartnerFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  // Summary card numbers - ONE GET /deliveries/summary call (honoring the search and delivery
  // partner filters, like the table below, but never the vehicle/date/status filters, which the
  // summary endpoint doesn't take). Null = the call failed -> every card shows "—" instead of a
  // wrong number.
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [orgTotal, setOrgTotal] = useState(null)
  const [orgUnassigned, setOrgUnassigned] = useState(null)
  const [orgDelivered, setOrgDelivered] = useState(null)
  const [orgInProgress, setOrgInProgress] = useState(null)
  const [orgFailed, setOrgFailed] = useState(null)
  const [orgAwaiting, setOrgAwaiting] = useState(null)
  // Server-side search (GET /deliveries?search=) - matches delivery number, notes, customer
  // name or order number. Debounced so typing doesn't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const hasActiveFilters = statusFilter !== 'all' || partnerFilter !== 'all' || vehicleFilter !== 'all' || datePreset !== 'all' || Boolean(debouncedSearch)
  const clearFilters = () => {
    setStatusFilter('all')
    setPartnerFilter('all')
    setVehicleFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
    setSearchInput('')
    setDebouncedSearch('')
    setPage(1)
  }

  // Delivery partner is a documented GET /deliveries filter (unlike status/vehicle/date below),
  // so it's applied server-side and needs the full partner roster, not just names seen on the
  // currently loaded page.
  useEffect(() => {
    listDeliveryPartners().then((result) => {
      if (result.success) setPartners(result.partners)
    })
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listDeliveries({
      page,
      page_size: PAGE_SIZE,
      delivery_partner_id: partnerFilter !== 'all' ? partnerFilter : undefined,
      status: statusFilter === 'picking' ? undefined : STATUS_FILTER_TO_BACKEND[statusFilter],
      picking_status: statusFilter === 'picking' ? 'picking' : undefined,
      search: debouncedSearch || undefined,
    })

    if (!result.success) {
      setDeliveries([])
      setTotal(0)
      setError(result.error)
      setIsLoading(false)
      return
    }

    setDeliveries(result.deliveries)
    setTotal(result.total)
    setIsLoading(false)
  }, [page, partnerFilter, statusFilter, debouncedSearch])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Summary cards, no overlap between any two cards: Unassigned = by_status.unassigned;
  // Awaiting Response = pending + rejected; In Progress = accepted + in_transit; Delivered =
  // delivered; Failed = returned ONLY (never by_internal_status.failed - the backend has no
  // separate "failed" status, a failed delivery IS `returned`). partially_delivered and
  // cancelled are intentionally not surfaced as their own cards, only as status-filter options.
  const loadOrgStats = useCallback(async () => {
    setIsLoadingStats(true)
    const result = await getDeliverySummary({
      delivery_partner_id: partnerFilter !== 'all' ? partnerFilter : undefined,
      search: debouncedSearch || undefined,
    })

    if (!result.success) {
      setOrgTotal(null)
      setOrgUnassigned(null)
      setOrgAwaiting(null)
      setOrgInProgress(null)
      setOrgDelivered(null)
      setOrgFailed(null)
      setIsLoadingStats(false)
      return
    }

    const by = result.byStatus
    setOrgTotal(result.total)
    setOrgUnassigned(by.unassigned ?? 0)
    setOrgAwaiting((by.pending ?? 0) + (by.rejected ?? 0))
    setOrgInProgress((by.accepted ?? 0) + (by.in_transit ?? 0))
    setOrgDelivered(by.delivered ?? 0)
    setOrgFailed(by.returned ?? 0)
    setIsLoadingStats(false)
  }, [partnerFilter, debouncedSearch])

  useEffect(() => {
    loadOrgStats()
  }, [loadOrgStats])

  const partnerOptions = useMemo(
    () => [{ value: 'all', label: 'All partners' }, ...partners.map((partner) => ({ value: partner.id, label: partner.name }))],
    [partners],
  )
  const vehicleOptions = useMemo(() => uniqueOptions(deliveries, 'vehicleNumber', 'All vehicles'), [deliveries])

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((row) => {
      if (statusFilter !== 'all' && getDeliveryStage(row).key !== statusFilter) return false
      if (vehicleFilter !== 'all' && row.vehicleNumber !== vehicleFilter) return false
      if (!isWithinDateRange(row.scheduledDate, dateFrom, dateTo)) return false
      return true
    })
  }, [deliveries, statusFilter, vehicleFilter, dateFrom, dateTo])

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Deliveries</h1>
      </div>

      <ListOverview>
      <ListSummary loading={isLoadingStats} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <button type="button" className="block w-full text-left" onClick={() => { setStatusFilter('all'); setPage(1) }}>
          <StatCard icon={Truck} label="Total Deliveries" value={orgTotal ?? '—'} iconVariant="primary" />
        </button>
        <button type="button" className="block w-full text-left" onClick={() => { setStatusFilter('unassigned'); setPage(1) }}>
          <StatCard icon={UserX} label="Unassigned" value={orgUnassigned ?? '—'} iconVariant="neutral" />
        </button>
        {/* Awaiting Response (pending+rejected) and In Progress (accepted+in_transit) each
            combine two backend status values - GET /deliveries?status= only takes one value at a
            time, so these two cards aren't a single click-to-filter; the Status dropdown below
            still lets you pick Pending/Rejected or Accepted/In Transit individually. */}
        <div title="Combines two statuses - use the Status filter below to narrow to one">
          <StatCard icon={Ban} label="Awaiting Response" value={orgAwaiting ?? '—'} iconVariant="danger" />
        </div>
        <div title="Combines two statuses - use the Status filter below to narrow to one">
          <StatCard icon={Clock} label="In Progress" value={orgInProgress ?? '—'} iconVariant="warning" />
        </div>
        <button type="button" className="block w-full text-left" onClick={() => { setStatusFilter('delivered'); setPage(1) }}>
          <StatCard icon={CheckCircle2} label="Delivered" value={orgDelivered ?? '—'} iconVariant="success" />
        </button>
        <button type="button" className="block w-full text-left" onClick={() => { setStatusFilter('failed'); setPage(1) }}>
          <StatCard icon={XCircle} label="Failed" value={orgFailed ?? '—'} iconVariant="danger" />
        </button>
      </ListSummary>
      </ListOverview>

      <Card title={error ? 'All Deliveries' : undefined} subtitle={error ? 'Every delivery across the organization' : undefined} className="overflow-hidden p-0">
        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadDeliveries}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              key={`${statusFilter}-${vehicleFilter}-${datePreset}-${customFrom}-${customTo}`}
              renderToolbar={() => (
                <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-neutral-900">All Deliveries</h3>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-500" aria-live="polite">{total} {total === 1 ? 'result' : 'results'}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">Every delivery across the organization</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:shrink-0">
                    <div className="relative min-w-0 flex-1 lg:w-64">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(event) => { setSearchInput(event.target.value); setPage(1) }}
                        placeholder="Search deliveries..."
                        aria-label="Search deliveries"
                        className="h-9 w-full rounded-xl border border-neutral-200 bg-surface py-1.5 pl-9 pr-3 text-xs text-neutral-700 shadow-(--shadow-xs) transition-colors placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                      />
                    </div>
                    <ListFilterPanel title="Filter Deliveries">
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                        Status
                        <Select options={[{ value: 'all', label: 'All status' }, ...DELIVERY_STAGE_FILTER_OPTIONS]} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery Partner
                        <Select options={partnerOptions} value={partnerFilter} onChange={(event) => { setPartnerFilter(event.target.value); setPage(1) }} />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                        Vehicle<span className="font-normal text-neutral-400"> (this page only)</span>
                        <Select options={vehicleOptions} value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} />
                      </label>
                      <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                        Scheduled Date<span className="font-normal text-neutral-400"> (this page only)</span>
                        <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} />
                      </div>
                      {hasActiveFilters && (
                        <button type="button" onClick={clearFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
                      )}
                    </ListFilterPanel>
                  </div>
                </div>
              )}
              loading={isLoading}
              emptyTitle={hasActiveFilters ? 'No deliveries match these filters' : 'No deliveries found'}
              emptyDescription={hasActiveFilters ? 'Try widening the date range or clearing filters.' : undefined}
              columns={[
                { key: 'customerName', header: 'Customer', sortable: true, render: (row) => row.customerName || 'No customer' },
                { key: 'deliveryPartnerName', header: 'Delivery Partner', sortable: true, render: (row) => row.deliveryPartnerName || 'Unassigned' },
                { key: 'vehicleNumber', header: 'Vehicle', sortable: true, render: (row) => row.vehicleNumber || '—' },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  // The badge always comes from the delivery's own `status` (via
                  // getDeliveryStage), never `order_status` - a cancelled parent order shows an
                  // extra small "Order cancelled" badge alongside the delivery's real, current
                  // stage instead of overriding it.
                  render: (row) => {
                    const stage = getDeliveryStage(row)
                    return (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={stage.variant} dot>{stage.label}</Badge>
                        {stage.orderCancelled && <Badge variant="neutral">Order cancelled</Badge>}
                      </div>
                    )
                  },
                },
                { key: 'scheduledDate', header: 'Scheduled Date', sortable: true, render: (row) => formatScheduledDate(row.scheduledDate) },
                { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
              ]}
              data={filteredDeliveries}
              onRowClick={(row) => navigate(`/admin/deliveries/${row.id}`)}
              actions={(row) => [
                {
                  label: 'View Details',
                  icon: Truck,
                  onClick: () => navigate(`/admin/deliveries/${row.id}`),
                },
              ]}
              serverPagination
              page={page}
              totalPages={totalPages}
              totalCount={total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  )
}
