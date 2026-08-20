import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Check, Truck, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { DELIVERY_STATUS_OPTIONS, acceptDelivery, listDeliveries, rejectDelivery } from '../../api/deliveries'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
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

export default function AssignedDeliveries() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')

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

  const handleAccept = async (delivery) => {
    const result = await acceptDelivery(delivery.id)

    if (!result.success) {
      showToast({ title: 'Unable to accept', message: result.error, variant: 'error' })
      return
    }

    setDeliveries((current) => current.map((item) => (item.id === delivery.id ? result.delivery : item)))
    showToast({ title: 'Delivery accepted', message: `${delivery.orderNumber} is ready to load.` })
  }

  const handleReject = async () => {
    if (!rejectTarget) return

    if (!rejectReason.trim()) {
      setRejectError('Enter a reason for rejecting this delivery.')
      return
    }

    setIsRejecting(true)
    setRejectError('')

    const result = await rejectDelivery(rejectTarget.id, rejectReason.trim())

    if (!result.success) {
      setRejectError(result.error)
      setIsRejecting(false)
      return
    }

    setDeliveries((current) => current.filter((item) => item.id !== rejectTarget.id))
    setIsRejecting(false)
    setRejectTarget(null)
    setRejectReason('')
    showToast({ title: 'Delivery rejected', message: 'The admin has been notified to reassign this delivery.' })
  }

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
              ...(row.status === 'planned'
                ? [
                    { label: 'Accept', icon: Check, onClick: () => handleAccept(row) },
                    { label: 'Reject', icon: Ban, danger: true, onClick: () => setRejectTarget(row) },
                  ]
                : []),
            ]}
          />
        )}
      </Card>

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => {
          if (isRejecting) return
          setRejectError('')
          setRejectReason('')
          setRejectTarget(null)
        }}
        title="Reject Delivery"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Reject {rejectTarget?.orderNumber || 'this delivery'}? It will be cleared from your assignments and the admin will be notified to reassign it.
          </p>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Reason for rejecting this delivery (required)"
            maxLength={500}
            className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          {rejectError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {rejectError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isRejecting}
              onClick={() => {
                setRejectError('')
                setRejectReason('')
                setRejectTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isRejecting} onClick={handleReject}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
