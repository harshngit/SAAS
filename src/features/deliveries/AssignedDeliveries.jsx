import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Check, Truck, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import { acceptDelivery, listDeliveries } from '../../api/deliveries'
import { demoDeliveriesResolved, getDemoDelivery, isDemoDelivery, patchDemoDelivery } from '../orders/orderDemoData'
import { getDeliveryStage } from './deliveryStage'
import RejectDeliveryModal from './RejectDeliveryModal'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

export default function AssignedDeliveries() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [acceptingId, setAcceptingId] = useState('')

  const loadDeliveries = useCallback(async () => {
    if (!currentUser?.id) return

    setIsLoading(true)
    setError('')

    const result = await listDeliveries({ delivery_partner_id: currentUser.id })
    const demoRows = demoDeliveriesResolved()

    if (!result.success) {
      setDeliveries(demoRows)
      setError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    setDeliveries([...result.deliveries, ...demoRows])
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const handleAccept = async (delivery) => {
    if (acceptingId) return
    setAcceptingId(delivery.id)

    if (isDemoDelivery(delivery.id)) {
      patchDemoDelivery(delivery.id, { status: 'accepted', pickingStatus: 'not_started' })
      setAcceptingId('')
      setDeliveries((current) => current.map((item) => (item.id === delivery.id ? getDemoDelivery(delivery.id) : item)))
      showToast({ title: 'Delivery accepted', message: `${delivery.deliveryNumber || delivery.orderNumber} — start picking next.` })
      return
    }

    const result = await acceptDelivery(delivery.id)
    setAcceptingId('')

    if (!result.success) {
      showToast({ title: 'Unable to accept', message: result.error, variant: 'error' })
      return
    }

    setDeliveries((current) => current.map((item) => (item.id === delivery.id ? result.delivery : item)))
    showToast({ title: 'Delivery accepted', message: `${delivery.deliveryNumber || delivery.orderNumber} — start picking next.` })
  }

  const handleRejected = (updatedDelivery) => {
    setDeliveries((current) =>
      updatedDelivery
        ? current.map((item) => (item.id === updatedDelivery.id ? updatedDelivery : item))
        : current.filter((item) => item.id !== rejectTarget?.id),
    )
    showToast({ title: 'Delivery rejected', message: 'The sales team has been notified to reassign this delivery.' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Assigned Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">View and manage your assigned deliveries</p>
      </div>

      <Card title="My Deliveries" subtitle="Everything assigned to you, newest first">
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
              { key: 'orderNumber', header: 'Delivery / Order #', sortable: true, render: (row) => row.deliveryNumber || row.orderNumber || '—' },
              { key: 'customerName', header: 'Customer', sortable: true },
              {
                key: 'location',
                header: 'Location',
                render: (row) => row.customerDeliveryAddress || row.deliveryAddress || '—',
              },
              { key: 'scheduledDate', header: 'Delivery Date', sortable: true },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                render: (row) => {
                  const stage = getDeliveryStage(row)
                  return <Badge variant={stage.variant} dot>{stage.label}</Badge>
                },
              },
            ]}
            data={deliveries}
            searchKeys={['deliveryNumber', 'orderNumber', 'customerName']}
            searchPlaceholder="Search deliveries…"
            emptyTitle="No deliveries assigned"
            emptyDescription="Deliveries assigned to you will show up here."
            actions={(row) => [
              { label: 'View Details', icon: Truck, onClick: () => navigate(`/delivery/deliveries/${row.id}`) },
              ...(getDeliveryStage(row).key === 'assigned'
                ? [
                    { label: acceptingId === row.id ? 'Accepting…' : 'Accept', icon: Check, onClick: () => handleAccept(row) },
                    { label: 'Reject', icon: Ban, danger: true, onClick: () => setRejectTarget(row) },
                  ]
                : []),
            ]}
          />
        )}
      </Card>

      <RejectDeliveryModal
        delivery={rejectTarget}
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onRejected={handleRejected}
      />
    </div>
  )
}
