import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import { DELIVERY_STATUS_OPTIONS, listDeliveries } from '../../api/deliveries'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  delivered: 'success',
  in_transit: 'warning',
  planned: 'info',
  loaded: 'info',
  partially_delivered: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
}

export default function AssignedDeliveries() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDeliveries = useCallback(async () => {
    if (!currentUser?.id) return

    setIsLoading(true)
    setError('')

    const result = await listDeliveries({ delivery_partner_id: currentUser.id })

    if (!result.success) {
      setDeliveries([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setDeliveries(result.deliveries)
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Assigned Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">View and manage your assigned deliveries</p>
      </div>

      <Card title="My Deliveries" subtitle="Planned, loaded, in transit, and completed">
        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadDeliveries}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : (
          <DataTable
            loading={isLoading}
            columns={[
              { key: 'orderNumber', header: 'Order #', sortable: true },
              { key: 'customerName', header: 'Customer', sortable: true },
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
            data={deliveries}
            searchKeys={['orderNumber', 'customerName', 'status']}
            searchPlaceholder="Search deliveries…"
            emptyTitle="No deliveries assigned"
            emptyDescription="Deliveries assigned to you will show up here."
            actions={(row) => [
              { label: 'View Details', icon: Truck, onClick: () => navigate(`/delivery/deliveries/${row.id}`) },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
