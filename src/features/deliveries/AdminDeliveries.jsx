import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Truck, CheckCircle2, Clock, XCircle, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { DELIVERY_STATUS_OPTIONS, listDeliveries } from '../../api/deliveries'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  delivered: 'success',
  in_transit: 'warning',
  planned: 'info',
  accepted: 'success',
  rejected: 'danger',
  ready: 'success',
  loaded: 'info',
  partially_delivered: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
}

export default function AdminDeliveries() {
  const navigate = useNavigate()
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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
    const delivered = deliveries.filter((row) => row.status === 'delivered').length
    const inProgress = deliveries.filter((row) => ['planned', 'accepted', 'ready', 'loaded', 'in_transit'].includes(row.status)).length
    const failed = deliveries.filter((row) => row.status === 'failed').length
    const rejected = deliveries.filter((row) => row.status === 'rejected').length
    return { total: deliveries.length, delivered, inProgress, failed, rejected }
  }, [deliveries])

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === 'all') return deliveries
    return deliveries.filter((row) => row.status === statusFilter)
  }, [deliveries, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">Track every delivery across your organization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Truck} label="Total Deliveries" value={stats.total} iconVariant="primary" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} iconVariant="success" />
        <StatCard icon={Clock} label="In Progress" value={stats.inProgress} iconVariant="warning" />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} iconVariant="danger" />
        <button type="button" className="block w-full text-left" onClick={() => setStatusFilter('rejected')}>
          <StatCard icon={Ban} label="Rejected · Needs Reassignment" value={stats.rejected} iconVariant="danger" />
        </button>
      </div>

      <Card title="All Deliveries" subtitle="Planned, loaded, in transit, and completed">
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
            <div className="mb-4 flex justify-end">
              <Select
                options={[{ value: 'all', label: 'All status' }, ...DELIVERY_STATUS_OPTIONS]}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sm:w-52"
              />
            </div>
            <DataTable
              loading={isLoading}
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
                  render: (row) => (
                    <Badge variant={statusVariant[row.status] || 'neutral'} dot>
                      {DELIVERY_STATUS_OPTIONS.find((option) => option.value === row.status)?.label || row.status}
                    </Badge>
                  ),
                },
                { key: 'scheduledDate', header: 'Scheduled Date', sortable: true },
                { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
              ]}
              data={filteredDeliveries}
              searchKeys={['deliveryNumber', 'orderNumber', 'customerName', 'deliveryPartnerName', 'vehicleNumber', 'status']}
              searchPlaceholder="Search deliveries…"
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
