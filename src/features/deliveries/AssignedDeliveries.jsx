import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Check, Eye, MapPin, Phone, RotateCw } from 'lucide-react'
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
import { formatCurrency, formatDate } from '../../utils/format'

// Filter chips - every option maps through getDeliveryStage() (never raw backend status).
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'picking', label: 'Picking' },
  { value: 'loaded', label: 'Vehicle Loaded' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'exceptions', label: 'Exceptions' },
]
const EXCEPTION_KEYS = ['rejected', 'failed', 'partially_delivered', 'cancelled']

export default function AssignedDeliveries() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [acceptingId, setAcceptingId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === 'all') return deliveries
    return deliveries.filter((delivery) => {
      const key = getDeliveryStage(delivery).key
      return statusFilter === 'exceptions' ? EXCEPTION_KEYS.includes(key) : key === statusFilter
    })
  }, [deliveries, statusFilter])

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
        <h1 className="text-2xl font-semibold text-neutral-900">My Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-500">Everything assigned to you, newest first</p>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-4 py-3">
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:text-primary-700'
                }`}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        <div className="p-4">
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
                {
                  key: 'deliveryNumber',
                  header: 'Delivery / Order #',
                  sortable: true,
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{row.deliveryNumber || '—'}</p>
                      <p className="text-xs text-neutral-400">{row.orderNumber || '—'}</p>
                    </div>
                  ),
                },
                { key: 'customerName', header: 'Customer', sortable: true, render: (row) => row.customerName || '—' },
                {
                  key: 'location',
                  header: 'Location',
                  render: (row) => {
                    const address = row.customerDeliveryAddress || row.deliveryAddress || ''
                    return (
                      <span className="block max-w-52 truncate text-neutral-600" title={address || undefined}>
                        {address || '—'}
                      </span>
                    )
                  },
                },
                { key: 'scheduledDate', header: 'Scheduled Date', sortable: true, render: (row) => formatDate(row.scheduledDate) },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (row) => {
                    const stage = getDeliveryStage(row)
                    return <Badge variant={stage.variant} dot>{stage.label}</Badge>
                  },
                },
                { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue || 0) },
              ]}
              data={filteredDeliveries}
              searchKeys={['deliveryNumber', 'orderNumber', 'customerName']}
              searchPlaceholder="Search delivery #, order # or customer..."
              emptyTitle="No deliveries"
              emptyDescription={statusFilter === 'all' ? 'Deliveries assigned to you will show up here.' : 'No deliveries in this status.'}
              actions={(row) => {
                const phone = row.customerPhone || ''
                const address = row.customerDeliveryAddress || row.deliveryAddress || ''
                return [
                  { label: 'View Delivery', icon: Eye, onClick: () => navigate(`/delivery/deliveries/${row.id}`) },
                  ...(phone
                    ? [{ label: 'Call Customer', icon: Phone, onClick: () => { window.location.href = `tel:${phone}` } }]
                    : []),
                  ...(address
                    ? [{ label: 'Open Maps', icon: MapPin, onClick: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noreferrer') }]
                    : []),
                  ...(getDeliveryStage(row).key === 'assigned'
                    ? [
                        { label: acceptingId === row.id ? 'Accepting…' : 'Accept', icon: Check, onClick: () => handleAccept(row) },
                        { label: 'Reject', icon: Ban, danger: true, onClick: () => setRejectTarget(row) },
                      ]
                    : []),
                ]
              }}
            />
          )}
        </div>
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
