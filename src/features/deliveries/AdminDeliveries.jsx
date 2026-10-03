import { ListOverview, ListHeader, ListSummary, ListDataTable as DataTable, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Truck, CheckCircle2, Clock, XCircle, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { listDeliveries } from '../../api/deliveries'
import { DELIVERY_STAGE_FILTER_OPTIONS, getDeliveryStage } from './deliveryStage'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { uniqueOptions } from '../../utils/filterOptions'

export default function AdminDeliveries() {
  const navigate = useNavigate()
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
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
  }

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listDeliveries()

    if (!result.success) {
      setDeliveries([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setDeliveries(result.deliveries)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const stats = useMemo(() => {
    const stageOf = (row) => getDeliveryStage(row).key
    const delivered = deliveries.filter((row) => stageOf(row) === 'delivered').length
    const inProgress = deliveries.filter((row) => ['accepted', 'picking', 'ready', 'loaded', 'in_transit'].includes(stageOf(row))).length
    const failed = deliveries.filter((row) => stageOf(row) === 'failed').length
    const awaiting = deliveries.filter((row) => ['assigned', 'rejected'].includes(stageOf(row))).length
    return { total: deliveries.length, delivered, inProgress, failed, awaiting }
  }, [deliveries])

  const partnerOptions = useMemo(() => uniqueOptions(deliveries, 'deliveryPartnerName', 'All partners'), [deliveries])
  const vehicleOptions = useMemo(() => uniqueOptions(deliveries, 'vehicleNumber', 'All vehicles'), [deliveries])

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((row) => {
      if (statusFilter !== 'all' && getDeliveryStage(row).key !== statusFilter) return false
      if (partnerFilter !== 'all' && row.deliveryPartnerName !== partnerFilter) return false
      if (vehicleFilter !== 'all' && row.vehicleNumber !== vehicleFilter) return false
      if (!isWithinDateRange(row.scheduledDate, dateFrom, dateTo)) return false
      return true
    })
  }, [deliveries, statusFilter, partnerFilter, vehicleFilter, dateFrom, dateTo])

  return (
    <div className="listing-page space-y-4">
      <ListOverview>
      <ListHeader>
        <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Deliveries</h1>
        <p className="mt-1 text-xs text-neutral-400">Track every delivery across your organization</p>
        </div>
      </ListHeader>

      <ListSummary className="grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Truck} label="Total Deliveries" value={stats.total} iconVariant="primary" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} iconVariant="success" />
        <StatCard icon={Clock} label="In Progress" value={stats.inProgress} iconVariant="warning" />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} iconVariant="danger" />
        <button type="button" className="block w-full text-left" onClick={() => setStatusFilter('assigned')}>
          <StatCard icon={Ban} label="Awaiting Response" value={stats.awaiting} iconVariant="danger" />
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
              key={`${statusFilter}-${partnerFilter}-${vehicleFilter}-${datePreset}-${customFrom}-${customTo}`}
              title="All Deliveries"
              subtitle="Every delivery across the organization"
              toolbarActions={
                <ListFilterPanel title="Filter Deliveries">
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                    <Select options={[{ value: 'all', label: 'All status' }, ...DELIVERY_STAGE_FILTER_OPTIONS]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery Partner
                    <Select options={partnerOptions} value={partnerFilter} onChange={(event) => setPartnerFilter(event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Vehicle
                    <Select options={vehicleOptions} value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} />
                  </label>
                  <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Scheduled Date
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
              searchPlaceholder="Search deliveries…"
              onRowClick={(row) => navigate(`/admin/deliveries/${row.id}`)}
              actions={(row) => [
                {
                  label: 'View Details',
                  icon: Truck,
                  onClick: () => navigate(`/admin/deliveries/${row.id}`),
                },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  )
}
