import { ListOverview, ListSummary, ListDataTable as DataTable, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Truck, CheckCircle2, Clock, XCircle, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { listDeliveries, listDeliveryPartners } from '../../api/deliveries'
import { DELIVERY_STAGE_FILTER_OPTIONS, getDeliveryStage } from './deliveryStage'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'

const PAGE_SIZE = 20

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
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const hasActiveFilters = statusFilter !== 'all' || partnerFilter !== 'all' || vehicleFilter !== 'all' || datePreset !== 'all'
  const clearFilters = () => {
    setStatusFilter('all')
    setPartnerFilter('all')
    setVehicleFilter('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
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

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listDeliveries({
      page,
      page_size: PAGE_SIZE,
      delivery_partner_id: partnerFilter !== 'all' ? partnerFilter : undefined,
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
  }, [page, partnerFilter])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Status/Vehicle/Scheduled Date aren't supported by GET /deliveries (only status*, order_id,
  // delivery_partner_id, open_only are - and "status" there is the backend's raw collapsed
  // vocabulary, not this page's derived stage labels like "picking"/"ready"), so these stay
  // page-local filters applied on top of whichever page is currently loaded.
  const stats = useMemo(() => {
    const stageOf = (row) => getDeliveryStage(row).key
    const delivered = deliveries.filter((row) => stageOf(row) === 'delivered').length
    const inProgress = deliveries.filter((row) => ['accepted', 'picking', 'ready', 'loaded', 'in_transit'].includes(stageOf(row))).length
    const failed = deliveries.filter((row) => stageOf(row) === 'failed').length
    const awaiting = deliveries.filter((row) => ['assigned', 'rejected'].includes(stageOf(row))).length
    return { delivered, inProgress, failed, awaiting }
  }, [deliveries])

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
      <ListSummary loading={isLoading} className="grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Truck} label="Total Deliveries" value={total} iconVariant="primary" />
        <StatCard icon={CheckCircle2} label="Delivered (this page)" value={stats.delivered} iconVariant="success" />
        <StatCard icon={Clock} label="In Progress (this page)" value={stats.inProgress} iconVariant="warning" />
        <StatCard icon={XCircle} label="Failed (this page)" value={stats.failed} iconVariant="danger" />
        <button type="button" className="block w-full text-left" onClick={() => setStatusFilter('assigned')}>
          <StatCard icon={Ban} label="Awaiting Response (this page)" value={stats.awaiting} iconVariant="danger" />
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
              title="All Deliveries"
              subtitle="Every delivery across the organization"
              toolbarActions={
                <ListFilterPanel title="Filter Deliveries">
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                    Status<span className="font-normal text-neutral-400"> (this page only)</span>
                    <Select options={[{ value: 'all', label: 'All status' }, ...DELIVERY_STAGE_FILTER_OPTIONS]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
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
              }
              loading={isLoading}
              emptyTitle={hasActiveFilters ? 'No deliveries match these filters' : 'No deliveries found'}
              emptyDescription={hasActiveFilters ? 'Try widening the date range or clearing filters.' : undefined}
              columns={[
                { key: 'deliveryNumber', header: 'Delivery #', sortable: true },
                { key: 'orderNumber', header: 'Order #', sortable: true },
                { key: 'customerName', header: 'Customer', sortable: true },
                { key: 'deliveryPartnerName', header: 'Delivery Partner', sortable: true, render: (row) => row.deliveryPartnerName || 'Unassigned' },
                { key: 'vehicleNumber', header: 'Vehicle', sortable: true, render: (row) => row.vehicleNumber || '—' },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (row) => {
                    const stage = getDeliveryStage(row)
                    return <Badge variant={stage.variant} dot>{stage.label}</Badge>
                  },
                },
                { key: 'scheduledDate', header: 'Scheduled Date', sortable: true },
                { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
              ]}
              data={filteredDeliveries}
              searchKeys={['deliveryNumber', 'orderNumber', 'customerName', 'deliveryPartnerName', 'vehicleNumber', 'status']}
              searchPlaceholder="Search this page…"
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
