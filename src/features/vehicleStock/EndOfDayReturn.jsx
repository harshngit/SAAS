import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Save, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { endOfDayReturn, getCurrentVehicleStock, reconcileVehicleStock } from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

function varianceBadge(varianceQty) {
  if (varianceQty === 0) return <Badge variant="success">Matched</Badge>
  if (varianceQty < 0) return <Badge variant="danger">{varianceQty} Shortage</Badge>
  return <Badge variant="warning">+{varianceQty} Surplus</Badge>
}

export default function EndOfDayReturn() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  // return -> record end-of-day returns; reconcile -> physical count per item; done -> variance summary
  const [phase, setPhase] = useState('return')
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [returns, setReturns] = useState({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [physicalCounts, setPhysicalCounts] = useState({})
  const [reconcileNotes, setReconcileNotes] = useState('')
  const [reconcileError, setReconcileError] = useState('')
  const [isReconciling, setIsReconciling] = useState(false)
  const [reconciliation, setReconciliation] = useState(null)

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
    setReturns((current) => ({ ...current, [productId]: value }))
  }

  // Rounds/clamps on blur, not on every keystroke - forcing the value while a "5." is still
  // being typed jumps the input's cursor to the end, mangling the next digit typed.
  const roundReturnOnBlur = (productId, maxQuantity) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    const safe = Number.isFinite(rounded) ? rounded : 0
    setReturns((current) => ({ ...current, [productId]: Math.min(Math.max(safe, 0), maxQuantity) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setIsSubmitting(true)
    setError('')

    const result = await endOfDayReturn(
      session.id,
      session.items.map((item) => ({ productId: item.productId, returnedQty: Math.round(Number(returns[item.productId])) || 0 })),
    )

    if (!result.success) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Return recorded', message: 'End of day return recorded successfully.' })
    setSession(result.session)
    setPhysicalCounts(Object.fromEntries(result.session.items.map((item) => [item.id, item.expectedClosingQty])))
    setIsSubmitting(false)
    setPhase('reconcile')
  }

  const updatePhysicalCount = (itemId, value) => {
    setPhysicalCounts((current) => ({ ...current, [itemId]: value }))
  }

  // Rounds/clamps on blur, not on every keystroke - see roundReturnOnBlur above for why.
  const roundPhysicalCountOnBlur = (itemId) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    setPhysicalCounts((current) => ({ ...current, [itemId]: Math.max(Number.isFinite(rounded) ? rounded : 0, 0) }))
  }

  const handleReconcile = async (event) => {
    event.preventDefault()

    setIsReconciling(true)
    setReconcileError('')

    const result = await reconcileVehicleStock(session.id, {
      notes: reconcileNotes.trim() || undefined,
      items: session.items.map((item) => ({
        loadingItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        physicalQty: physicalCounts[item.id] !== undefined ? Math.round(Number(physicalCounts[item.id])) || 0 : item.expectedClosingQty,
      })),
    })

    if (!result.success) {
      setReconcileError(result.error)
      setIsReconciling(false)
      return
    }

    showToast({ title: 'Reconciliation recorded', message: 'Physical stock count has been saved.' })
    setReconciliation(result.reconciliation)
    setIsReconciling(false)
    setPhase('done')
  }

  if (phase === 'reconcile') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Stock Reconciliation</h1>
          <p className="mt-1 text-sm text-neutral-500">Count the physical stock remaining on the vehicle against the expected closing quantity.</p>
        </div>

        <form onSubmit={handleReconcile} className="space-y-6">
          {reconcileError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{reconcileError}</div>
          )}

          <Card title="Physical Count">
            <div className="space-y-4">
              {session.items.map((item) => {
                const physicalQty = physicalCounts[item.id] ?? item.expectedClosingQty
                const variance = physicalQty - item.expectedClosingQty

                return (
                  <div key={item.id} className="grid grid-cols-1 items-center gap-4 rounded-lg bg-neutral-50 p-3 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <p className="font-medium text-neutral-900">{item.productName}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">Expected Closing</label>
                      <p className="font-semibold text-neutral-900">{item.expectedClosingQty}</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        label="Physical Count"
                        value={physicalQty}
                        onChange={(event) => updatePhysicalCount(item.id, event.target.value)}
                        onBlur={roundPhysicalCountOnBlur(item.id)}
                        min="0"
                        step="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">Variance</label>
                      {varianceBadge(variance)}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Notes">
            <Input
              as="textarea"
              value={reconcileNotes}
              onChange={(event) => setReconcileNotes(event.target.value)}
              placeholder="e.g. 2 units missing/damaged"
              inputClassName="min-h-20"
            />
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="submit" loading={isReconciling}>
              <ClipboardCheck className="size-4" aria-hidden="true" />
              Save Reconciliation
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Reconciliation Summary</h1>
          <p className="mt-1 text-sm text-neutral-500">Physical count variance against expected closing stock.</p>
        </div>

        <Card title="Variance by Product">
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Product</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Expected</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Physical</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {(reconciliation?.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-neutral-900">{item.productName}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-600">{item.expectedClosingQty}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-600">{item.physicalQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">{varianceBadge(item.varianceQuantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => navigate('/delivery/vehicle-stock')}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Done
          </Button>
        </div>
      </div>
    )
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
                      onBlur={roundReturnOnBlur(item.productId, item.loadedQuantity)}
                      min="0"
                      max={item.loadedQuantity}
                      step="1"
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
