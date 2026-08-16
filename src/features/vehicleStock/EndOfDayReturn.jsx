import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { Truck } from 'lucide-react'
import { endOfDayReturn, getCurrentVehicleStock } from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

export default function EndOfDayReturn() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [returns, setReturns] = useState({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!currentUser?.id) return

    getCurrentVehicleStock(currentUser.id).then((result) => {
      if (!result.success) {
        setLoadError(result.error)
        setIsLoading(false)
        return
      }

      setSession(result.session)
      setReturns(Object.fromEntries(result.session.items.map((item) => [item.productId, 0])))
      setIsLoading(false)
    })
  }, [currentUser?.id])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading active session..." />
      </Card>
    )
  }

  if (loadError || !session) {
    return (
      <Card>
        <EmptyState
          icon={Truck}
          title="No active loading session"
          description={loadError || 'Record an opening load before you can return end-of-day stock.'}
          action={{ label: 'Go to Vehicle Loading', onClick: () => navigate('/delivery/vehicle-loading') }}
        />
      </Card>
    )
  }

  const updateReturn = (productId, value) => {
    setReturns((current) => ({ ...current, [productId]: Math.max(0, Number(value)) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setIsSubmitting(true)
    setError('')

    const result = await endOfDayReturn(
      session.id,
      session.items.map((item) => ({ productId: item.productId, returnedQty: returns[item.productId] ?? 0 })),
    )

    if (!result.success) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Return recorded', message: 'End of day return recorded successfully.' })
    setIsSubmitting(false)
    navigate('/delivery/vehicle-stock')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">End of Day Return</h1>
        <p className="mt-1 text-sm text-neutral-500">Record returned stock against what was loaded this morning</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card title="Stock Return">
          <div className="space-y-4">
            {session.items.map((item) => {
              const actualReturn = returns[item.productId] ?? 0
              const sold = item.loadedQuantity - actualReturn
              const hasNegativeSold = sold < 0

              return (
                <div key={item.productId} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                  <div className="md:col-span-2">
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Loaded</label>
                    <p className="font-semibold text-neutral-900">{item.loadedQuantity}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Delivered/Sold (est.)</label>
                    <p className="font-semibold text-primary-700">{sold}</p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      label="Actual Return"
                      value={actualReturn}
                      onChange={(e) => updateReturn(item.productId, e.target.value)}
                      min="0"
                      max={item.loadedQuantity}
                      required
                    />
                    {hasNegativeSold && (
                      <Badge variant="danger" className="mt-1">Return exceeds loaded quantity</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" />
            Save End of Day Return
          </Button>
        </div>
      </form>
    </div>
  )
}
