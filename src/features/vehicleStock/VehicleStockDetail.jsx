import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackageSearch, RotateCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getVehicleStockSession } from '../../api/vehicleStock'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { demoVehicleSessionResolved } from '../orders/orderDemoData'
import { ItemDetailModal, VehicleSessionPanel } from './VehicleStockOverview'

const basePath = '/admin/vehicle-stock'

// Admin "Detail View" of one vehicle load (active or closed) - GET /vehicle-stock/{id}. The body is
// the same panel the single-vehicle page uses (VehicleSessionPanel), so both stay identical.
export default function VehicleStockDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    if (DEMO_MODE && !DEMO_EMPTY) {
      setSession(demoVehicleSessionResolved())
      setIsLoading(false)
      return
    }
    const result = await getVehicleStockSession(id)
    if (!result.success) {
      setSession(null)
      setError(result.error)
    } else {
      setSession(result.session)
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const backButton = (
    <Button type="button" variant="secondary" size="sm" onClick={() => navigate(basePath)}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back
    </Button>
  )

  return (
    <div className="listing-page space-y-4">
      <div className="flex items-center gap-4">
        {backButton}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Vehicle Load Detail</h1>
          <p className="mt-1 text-xs text-neutral-400">Stock loaded on this vehicle for the selected run.</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <LoadingSpinner variant="vehicle-stock" count={1} label="Loading vehicle load..." />
        </Card>
      ) : error ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={load}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Card>
      ) : !session ? (
        <Card>
          <EmptyState
            icon={PackageSearch}
            title="Vehicle load not found"
            description="This vehicle load may not exist any more, or the link is out of date."
            action={{ label: 'Back to Vehicle Stock', onClick: () => navigate(basePath) }}
          />
        </Card>
      ) : (
        <VehicleSessionPanel session={session} heading={null} onViewDetails={setSelectedItem} />
      )}

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}
