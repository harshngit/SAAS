import { useEffect, useState } from 'react'
import { Car, Package, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { ROLES } from '../../auth/roles'
import { getCurrentVehicleStock, listVehicleStockSessions } from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'

function SessionCard({ session }) {
  const totalStock = session.items.reduce((sum, item) => sum + item.loadedQuantity, 0)

  return (
    <Card>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Car className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">{session.vehicleNumber || 'Vehicle'}</h3>
            <p className="text-sm text-neutral-500">Driver: {session.deliveryPartnerName || '—'}</p>
          </div>
          <Badge variant={session.status === 'active' ? 'success' : 'neutral'} className="ml-auto">{session.status}</Badge>
        </div>
        <div className="space-y-3">
          {session.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">{item.productName}</span>
              </div>
              <span className="text-sm font-semibold text-primary-700">{item.loadedQuantity} units</span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Total Stock</span>
            <span className="text-lg font-bold text-neutral-900">{totalStock} units</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function VehicleStockOverview() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    setError('')

    if (isAdmin) {
      const result = await listVehicleStockSessions()
      if (!result.success) {
        setError(result.error)
        setSessions([])
      } else {
        setSessions(result.sessions)
      }
    } else if (currentUser?.id) {
      const result = await getCurrentVehicleStock(currentUser.id)
      if (!result.success) {
        setError(result.error)
        setSessions([])
      } else {
        setSessions([result.session])
      }
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isAdmin])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Vehicle Stock</h1>
        <p className="text-sm text-neutral-500">Track stock levels in delivery vehicles</p>
      </div>

      {isLoading ? (
        <Card><LoadingSpinner label="Loading vehicle stock..." /></Card>
      ) : error ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadData}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState icon={Car} title="No active loading sessions" description="Vehicle stock sessions will appear here once a delivery partner loads a vehicle." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
