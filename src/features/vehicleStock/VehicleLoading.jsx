import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, Minus, Package, PackageCheck, Plus, RotateCw, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listDeliveries, loadDeliveryOntoVehicle, markDeliveryReady } from '../../api/deliveries'
import { listProducts } from '../../api/products'
import {
  demoDeliveriesResolved,
  isDemoDelivery,
  simulateDemoVehicleLoad,
} from '../orders/orderDemoData'
import { getDeliveryStage } from '../deliveries/deliveryStage'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

// Deliveries eligible for loading: the goods are picked and waiting to go on the van.
const LOADABLE_STAGES = ['accepted', 'picking']
// Still operationally onboard the vehicle. A fully Delivered delivery is NOT onboard any
// more, so it is not shown here - My Deliveries owns completed-delivery history.
const ONBOARD_STAGES = ['loaded', 'in_transit']

const hasRemainingOnboard = (delivery) =>
  (delivery.items || []).some((item) => (Number(item.remainingQuantity ?? item.pendingQuantity) || 0) > 0)

const isParentCancelled = (delivery) =>
  String(delivery.order?.status || delivery.orderStatus || '').toLowerCase() === 'cancelled'

const pickedTotal = (delivery) =>
  (delivery.items || []).reduce((sum, item) => sum + (Number(item.pickedQuantity) || 0), 0)

const stepInput = 'h-9 w-14 shrink-0 rounded-lg border border-neutral-200 bg-white text-center text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25'

export default function VehicleLoading() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [deliveries, setDeliveries] = useState([])
  const [productMeta, setProductMeta] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadQty, setLoadQty] = useState({}) // `${deliveryId}::${productId}` -> number
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const load = useCallback(async () => {
    if (!currentUser?.id) return
    setIsLoading(true)
    setError('')

    const [result, productsResult] = await Promise.all([
      listDeliveries({ delivery_partner_id: currentUser.id }),
      listProducts(),
    ])
    const demoRows = demoDeliveriesResolved()

    if (productsResult.success) {
      const meta = {}
      productsResult.products.forEach((product) => {
        meta[product.id] = { sku: product.sku || '', weight: Number(product.weight) || null }
      })
      setProductMeta(meta)
    }

    const rows = result.success ? [...result.deliveries, ...demoRows] : demoRows
    if (!result.success && demoRows.length === 0) setError(result.error)
    setDeliveries(rows)
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    load()
  }, [load])

  const eligible = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          !isParentCancelled(delivery) &&
          LOADABLE_STAGES.includes(getDeliveryStage(delivery).key) &&
          pickedTotal(delivery) > 0,
      ),
    [deliveries],
  )

  const waitingForPicking = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          !isParentCancelled(delivery) &&
          LOADABLE_STAGES.includes(getDeliveryStage(delivery).key) &&
          pickedTotal(delivery) === 0,
      ),
    [deliveries],
  )

  const alreadyLoaded = useMemo(
    () =>
      deliveries.filter((delivery) => {
        if (isParentCancelled(delivery)) return false
        const stageKey = getDeliveryStage(delivery).key
        if (ONBOARD_STAGES.includes(stageKey)) return true
        // A partial delivery is only still "on the vehicle" while undelivered units remain.
        return stageKey === 'partially_delivered' && hasRemainingOnboard(delivery)
      }),
    [deliveries],
  )

  // Seed the load quantities + selection once the eligible list resolves.
  useEffect(() => {
    setLoadQty((current) => {
      const next = { ...current }
      eligible.forEach((delivery) => {
        ;(delivery.items || []).forEach((item) => {
          const key = `${delivery.id}::${item.productId}`
          if (next[key] == null) next[key] = Number(item.pickedQuantity) || 0
        })
      })
      return next
    })
    setSelectedIds((current) => {
      if (current.size > 0) return current
      return new Set(eligible.map((delivery) => delivery.id))
    })
  }, [eligible])

  const vehicle = useMemo(() => {
    const withVehicle = [...eligible, ...alreadyLoaded].find((delivery) => delivery.vehicleNumber)
    return withVehicle
      ? {
          number: withVehicle.vehicleNumber,
          type: withVehicle.vehicleType || '',
          capacityKg: withVehicle.vehicleCapacityKg ?? null,
        }
      : null
  }, [eligible, alreadyLoaded])

  const warehouses = useMemo(
    () => [...new Set(eligible.map((delivery) => delivery.warehouseName).filter(Boolean))],
    [eligible],
  )

  const selectedDeliveries = eligible.filter((delivery) => selectedIds.has(delivery.id))

  const summary = useMemo(() => {
    const productIds = new Set()
    let units = 0
    let weight = 0
    let weightKnown = true
    selectedDeliveries.forEach((delivery) => {
      ;(delivery.items || []).forEach((item) => {
        const qty = Number(loadQty[`${delivery.id}::${item.productId}`]) || 0
        if (qty <= 0) return
        productIds.add(item.productId)
        units += qty
        const w = productMeta[item.productId]?.weight
        if (w == null) weightKnown = false
        else weight += w * qty
      })
    })
    return { deliveries: selectedDeliveries.length, products: productIds.size, units, weight, weightKnown }
  }, [selectedDeliveries, loadQty, productMeta])

  const overCapacity =
    summary.weightKnown && vehicle?.capacityKg != null && summary.weight > vehicle.capacityKg
  const anyPartial = selectedDeliveries.some((delivery) =>
    (delivery.items || []).some((item) => (Number(loadQty[`${delivery.id}::${item.productId}`]) || 0) < (Number(item.pickedQuantity) || 0)),
  )

  const setQty = (deliveryId, item, value) => {
    const rounded = Math.round(Number(value))
    const max = Number(item.pickedQuantity) || 0
    const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), max)
    setLoadQty((current) => ({ ...current, [`${deliveryId}::${item.productId}`]: clamped }))
  }

  const toggleDelivery = (deliveryId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(deliveryId)) next.delete(deliveryId)
      else next.add(deliveryId)
      return next
    })
  }

  const allSelected = eligible.length > 0 && selectedIds.size >= eligible.length
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(eligible.map((delivery) => delivery.id)))

  const handleConfirm = async () => {
    if (isSubmitting || selectedDeliveries.length === 0) return
    setIsSubmitting(true)
    setSubmitError('')

    const failures = []
    for (const delivery of selectedDeliveries) {
      const items = (delivery.items || [])
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          qty: Number(loadQty[`${delivery.id}::${item.productId}`]) || 0,
        }))
        .filter((entry) => entry.qty > 0)
      if (items.length === 0) continue

      if (isDemoDelivery(delivery.id)) {
        simulateDemoVehicleLoad(delivery.id, items)
        continue
      }

      // Real delivery: reuse the existing per-delivery load endpoints (no new API). The
      // backend loads the full picked quantity - partial per-item load isn't persisted.
      const readyResult = await markDeliveryReady(delivery.id)
      if (!readyResult.success && !/already|ready|state|status/i.test(readyResult.error || '')) {
        failures.push(`${delivery.deliveryNumber || delivery.orderNumber}: ${readyResult.error}`)
        continue
      }
      const loadResult = await loadDeliveryOntoVehicle(delivery.id)
      if (!loadResult.success) failures.push(`${delivery.deliveryNumber || delivery.orderNumber}: ${loadResult.error}`)
    }

    setIsSubmitting(false)

    if (failures.length) {
      setSubmitError(failures.join(' · '))
      return
    }

    showToast({
      title: 'Vehicle loaded',
      message: `${selectedDeliveries.length} deliver${selectedDeliveries.length === 1 ? 'y' : 'ies'} moved onto ${vehicle?.number || 'your vehicle'}.`,
    })
    navigate('/delivery/deliveries')
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading vehicle loading plan..." />
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Vehicle Loading</h1>
        <p className="mt-1 text-sm text-neutral-500">Prepare your assigned vehicle for today&apos;s deliveries.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button type="button" variant="outline" size="sm" className="ml-3" onClick={load}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {/* Vehicle + warehouse */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Assigned Vehicle">
          {vehicle ? (
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                <Truck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-semibold text-neutral-900">{vehicle.number}</p>
                <p className="text-xs text-neutral-500">
                  {[vehicle.type, vehicle.capacityKg != null ? `${vehicle.capacityKg} kg` : null].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-neutral-500">No vehicle is assigned to you.</p>
          )}
        </Card>

        <Card title="Warehouse">
          {warehouses.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">—</p>
          ) : warehouses.length === 1 ? (
            <p className="py-4 text-sm font-medium text-neutral-900">{warehouses[0]}</p>
          ) : (
            <div className="py-2 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Multiple warehouses</p>
              <p className="mt-0.5 text-xs text-neutral-500">{warehouses.join(', ')} — loaded per delivery.</p>
            </div>
          )}
        </Card>

        <Card title="Load Summary">
          <div className="grid grid-cols-3 gap-3 py-2 text-center">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{summary.deliveries}</p>
              <p className="text-[0.7rem] text-neutral-500">Deliveries</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">{summary.products}</p>
              <p className="text-[0.7rem] text-neutral-500">Products</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">{summary.units}</p>
              <p className="text-[0.7rem] text-neutral-500">Units</p>
            </div>
          </div>
          {vehicle?.capacityKg != null && (
            <p className={`mt-2 text-center text-xs ${overCapacity ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
              {summary.weightKnown
                ? `Capacity: ${summary.weight} / ${vehicle.capacityKg} kg${overCapacity ? ' — over capacity' : ''}`
                : `Vehicle capacity: ${vehicle.capacityKg} kg (product weights unavailable)`}
            </p>
          )}
        </Card>
      </div>

      {/* Empty states */}
      {eligible.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title={waitingForPicking.length > 0 ? 'Nothing picked yet' : 'No deliveries are ready to load'}
            description={
              waitingForPicking.length > 0
                ? 'Complete picking for an accepted delivery before loading.'
                : 'Accept a delivery and pick its items — they will appear here to load onto the vehicle.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900">Deliveries to Load</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              Select all ready
            </label>
          </div>

          {eligible.map((delivery) => {
            const stage = getDeliveryStage(delivery)
            const isSelected = selectedIds.has(delivery.id)
            return (
              <div
                key={delivery.id}
                className={`rounded-2xl border bg-white shadow-(--shadow-card) transition-colors ${
                  isSelected ? 'border-primary-200' : 'border-neutral-100'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 p-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDelivery(delivery.id)}
                    className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    aria-label={`Include ${delivery.deliveryNumber || delivery.orderNumber}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">
                      {delivery.deliveryNumber || '—'} <span className="text-neutral-400">·</span> {delivery.orderNumber || '—'}
                    </p>
                    <p className="text-xs text-neutral-500">{delivery.customerName || '—'}</p>
                  </div>
                  <Badge variant={stage.variant} dot>{stage.label}</Badge>
                </div>

                <div className="overflow-x-auto p-4">
                  <table className="w-full min-w-lg text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 text-right">Picked</th>
                        <th className="px-2 py-2 text-center">Load Qty</th>
                        <th className="px-2 py-2">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {(delivery.items || []).map((item) => {
                        const key = `${delivery.id}::${item.productId}`
                        const qty = loadQty[key] ?? 0
                        const picked = Number(item.pickedQuantity) || 0
                        const sku = productMeta[item.productId]?.sku
                        const available = item.warehouseAvailable
                        const shortStock = available != null && available < qty
                        return (
                          <tr key={item.id || item.productId}>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-neutral-900">{item.productName}</p>
                              {sku && <p className="text-[0.7rem] text-neutral-400">SKU: {sku}</p>}
                              {shortStock && (
                                <p className="text-[0.7rem] text-red-600">Only {available} units available in warehouse.</p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-right text-neutral-500">{picked}</td>
                            <td className="px-2 py-2.5">
                              <div className="mx-auto flex w-fit items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!isSelected || qty <= 0}
                                  onClick={() => setQty(delivery.id, item, qty - 1)}
                                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                                  aria-label={`Reduce ${item.productName}`}
                                >
                                  <Minus className="size-3.5" aria-hidden="true" />
                                </button>
                                <input
                                  value={qty}
                                  inputMode="numeric"
                                  disabled={!isSelected}
                                  onChange={(event) => setQty(delivery.id, item, event.target.value)}
                                  className={`${stepInput} disabled:opacity-50`}
                                  aria-label={`Load quantity for ${item.productName}`}
                                />
                                <button
                                  type="button"
                                  disabled={!isSelected || qty >= picked}
                                  onClick={() => setQty(delivery.id, item, qty + 1)}
                                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                                  aria-label={`Add ${item.productName}`}
                                >
                                  <Plus className="size-3.5" aria-hidden="true" />
                                </button>
                              </div>
                              {qty < picked && (
                                <p className="mt-1 text-center text-[0.68rem] text-amber-600">Remaining to load: {picked - qty}</p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-neutral-500">{item.uom || item.variantId || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {anyPartial && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Loading less than the picked quantity is shown here for the record. For a real delivery the full picked
              quantity is moved onto the vehicle — partial loading isn&apos;t saved yet.
            </p>
          )}
          {overCapacity && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              The selected load ({summary.weight} kg) is over the vehicle capacity ({vehicle.capacityKg} kg).
            </p>
          )}

          {/* Confirm bar */}
          <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-neutral-500">
                {vehicle?.number || 'Vehicle'} · {warehouses[0] || 'Warehouse'} · {summary.deliveries} deliveries ·{' '}
                {summary.products} products · {summary.units} units
              </p>
              <Button
                type="button"
                loading={isSubmitting}
                disabled={selectedDeliveries.length === 0 || summary.units === 0}
                onClick={handleConfirm}
              >
                <PackageCheck className="size-4" aria-hidden="true" />
                Confirm Vehicle Load
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Confirming the load moves the picked stock from the warehouse onto your vehicle.
            </p>
            {submitError && (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
            )}
          </div>
        </>
      )}

      {/* Already on the vehicle - read-only context, no re-load */}
      {alreadyLoaded.length > 0 && (
        <Card title="Already on Vehicle" subtitle="Still onboard — Vehicle Loaded or In Transit.">
          <ul className="divide-y divide-neutral-100">
            {alreadyLoaded.map((delivery) => {
              const stage = getDeliveryStage(delivery)
              const loadedUnits = (delivery.items || []).reduce((sum, item) => sum + (Number(item.loadedQuantity) || 0), 0)
              return (
                <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-neutral-900">
                        {delivery.deliveryNumber || '—'} <span className="text-neutral-400">·</span> {delivery.orderNumber || '—'}
                      </p>
                      <p className="text-xs text-neutral-500">{delivery.customerName || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{loadedUnits} units loaded</span>
                    <Badge variant={stage.variant} dot>{stage.label}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/delivery/deliveries/${delivery.id}`)}
                    >
                      View Delivery
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
