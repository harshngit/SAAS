import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, Package, PackageCheck, RotateCw, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { listDeliveries, loadDeliveriesBatch, markDeliveryReady } from '../../api/deliveries'
import { listProducts } from '../../api/products'
import { listVehicles } from '../../api/vehicles'
import {
  DEMO_VEHICLES,
  demoDeliveriesResolved,
  isDemoDelivery,
  simulateDemoVehicleLoad,
} from '../orders/orderDemoData'
import { getDeliveryStage } from '../deliveries/deliveryStage'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

// Explicit dev switch only (VITE_DEMO_DATA=true). Demo is NEVER inferred from a failed / empty
// deliveries API.
const DEMO_VEHICLE_STOCK_ENABLED = DEMO_MODE && !DEMO_EMPTY

// A delivery only reaches "Deliveries to Load" once every planned line is fully picked (or the
// backend has already moved it to `ready`). A partially-picked delivery waits under "Picking
// in progress" instead of failing a backend 400 at load time.
const LOADABLE_STAGES = ['accepted', 'picking', 'ready']
// Still operationally onboard the vehicle. A fully Delivered delivery is NOT onboard any
// more, so it is not shown here - My Deliveries owns completed-delivery history.
const ONBOARD_STAGES = ['loaded', 'in_transit']

const hasRemainingOnboard = (delivery) =>
  (delivery.items || []).some((item) => (Number(item.remainingQuantity ?? item.pendingQuantity) || 0) > 0)

const isParentCancelled = (delivery) =>
  String(delivery.order?.status || delivery.orderStatus || '').toLowerCase() === 'cancelled'

// Every planned line picked in full. `ready` deliveries are already past picking.
const isFullyPicked = (delivery) => {
  const items = delivery.items || []
  if (items.length === 0) return false
  const totalPlanned = items.reduce((sum, it) => sum + (Number(it.plannedQuantity) || 0), 0)
  if (totalPlanned <= 0) return false
  return items.every((it) => (Number(it.pickedQuantity) || 0) >= (Number(it.plannedQuantity) || 0))
}

const isLoadable = (delivery) => {
  if (isParentCancelled(delivery)) return false
  const key = getDeliveryStage(delivery).key
  if (!LOADABLE_STAGES.includes(key)) return false
  return key === 'ready' || isFullyPicked(delivery)
}

// The demo driver's assigned vehicle - matches DEMO_VEHICLES[0], the same vehicle the shared
// demo delivery records and the Vehicle Stock demo session already assume for this partner.
const demoAssignedVehicle = () => {
  const demoVehicle = DEMO_VEHICLES[0]
  return demoVehicle
    ? { number: demoVehicle.vehicleNumber, type: demoVehicle.vehicleType, capacityKg: demoVehicle.capacityKg }
    : null
}

const getRemainingLoadQuantity = (item) => Number(item.remainingLoadQuantity ?? item.pickedQuantity ?? item.plannedQuantity ?? 0) || 0

const getLoadWeight = (item) => {
  const quantity = getRemainingLoadQuantity(item)
  const weight = item.weightKg == null ? null : Number(item.weightKg)
  return quantity > 0 && Number.isFinite(weight) ? quantity * weight : 0
}

const getBatchResults = (data, requestedIds) => {
  const treatsDeliveryArrayAsSuccess = Array.isArray(data?.deliveries)
    || Array.isArray(data?.loaded_deliveries)
    || Array.isArray(data?.loaded)
    || Array.isArray(data?.successful)
    || Array.isArray(data?.succeeded)
  const rawResults = Array.isArray(data)
    ? data
    : data?.results
      || data?.delivery_results
      || data?.deliveries
      || data?.loaded_deliveries
      || data?.loaded
      || data?.successful
      || data?.succeeded
      || []
  const results = rawResults.map((entry) => ({
    deliveryId: typeof entry === 'string' ? entry : entry.delivery_id || entry.deliveryId || entry.delivery?.id || entry.id,
    success: typeof entry === 'string'
      ? true
      : entry.success ?? entry.ok ?? entry.loaded ?? (treatsDeliveryArrayAsSuccess || entry.status === 'loaded' || entry.status === 'success'),
    delivery: entry.delivery,
    error: entry.detail || entry.error || entry.message || entry.reason || '',
  })).filter((entry) => entry.deliveryId)

  const failed = data?.failed_deliveries || data?.failed || []
  failed.forEach((entry) => {
    const deliveryId = entry.delivery_id || entry.deliveryId || entry.id
    if (deliveryId && !results.some((result) => result.deliveryId === deliveryId)) {
      results.push({ deliveryId, success: false, delivery: null, error: entry.detail || entry.error || entry.message || '' })
    }
  })

  if (results.length === 0) {
    return requestedIds.map((deliveryId) => ({ deliveryId, success: true, delivery: null, error: '' }))
  }

  return requestedIds.map((deliveryId) => results.find((result) => result.deliveryId === deliveryId) || {
    deliveryId,
    success: false,
    delivery: null,
    error: 'The backend did not return a result for this delivery. Please retry.',
  })
}

export default function VehicleLoading() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [deliveries, setDeliveries] = useState([])
  const [productMeta, setProductMeta] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [deliveryErrors, setDeliveryErrors] = useState({})
  // The delivery partner's own active vehicle - fetched independently of the deliveries list,
  // never derived from whichever delivery happens to already carry vehicle data.
  const [assignedVehicle, setAssignedVehicle] = useState(null)
  const [vehicleError, setVehicleError] = useState('')

  const load = useCallback(async () => {
    if (!currentUser?.id) return
    setIsLoading(true)
    setError('')
    setVehicleError('')

    // Explicit demo mode: demo deliveries + the demo driver's demo vehicle only, no real API call.
    if (DEMO_VEHICLE_STOCK_ENABLED) {
      setDeliveries(demoDeliveriesResolved())
      setProductMeta({})
      setAssignedVehicle(demoAssignedVehicle())
      setIsLoading(false)
      return
    }

    const [result, productsResult, vehiclesResult] = await Promise.all([
      listDeliveries({ delivery_partner_id: currentUser.id }),
      listProducts(),
      listVehicles({ default_driver_id: currentUser.id, status: 'active' }),
    ])

    if (productsResult.success) {
      const meta = {}
      productsResult.products.forEach((product) => {
        meta[product.id] = { sku: product.sku || '' }
      })
      setProductMeta(meta)
    }

    // The driver's assigned vehicle - real mode only, never a demo vehicle, never guessed from
    // a delivery's own vehicle fields. A fetch failure is a real error, not "no vehicle".
    if (vehiclesResult.success) {
      const activeVehicle = vehiclesResult.vehicles[0] || null
      setAssignedVehicle(
        activeVehicle
          ? { number: activeVehicle.vehicleNumber, type: activeVehicle.vehicleType, capacityKg: activeVehicle.capacityKg }
          : null,
      )
    } else {
      setAssignedVehicle(null)
      setVehicleError(vehiclesResult.error)
    }

    // Real mode: the delivery list is authoritative. A failure shows the real error; an empty
    // list is a truthful empty state - never a demo fallback.
    if (!result.success) {
      setError(result.error)
      setDeliveries([])
      setIsLoading(false)
      return
    }
    setDeliveries(result.deliveries)
    setIsLoading(false)
  }, [currentUser?.id])

  useEffect(() => {
    load()
  }, [load])

  const eligible = useMemo(() => deliveries.filter(isLoadable), [deliveries])

  // Loadable stage but picking is not yet complete on every line.
  const waitingForPicking = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          !isParentCancelled(delivery) &&
          ['accepted', 'picking'].includes(getDeliveryStage(delivery).key) &&
          !isFullyPicked(delivery),
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

  // Select every eligible delivery by default.
  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size > 0) return current
      return new Set(eligible.map((delivery) => delivery.id))
    })
  }, [eligible])

  // The driver's actual assigned vehicle (state, fetched in `load`) - never derived from
  // whichever delivery happens to carry vehicle data.
  const vehicle = assignedVehicle

  const selectedDeliveries = eligible.filter((delivery) => selectedIds.has(delivery.id))

  const warehouses = useMemo(
    () => [...new Set(selectedDeliveries.map((delivery) => delivery.warehouse?.name || delivery.warehouseName).filter(Boolean))],
    [selectedDeliveries],
  )

  // Load quantity is always the full picked quantity - POST /deliveries/{id}/load moves the
  // delivery's picked stock as the backend holds it; the frontend does not send per-item
  // quantities, so there is nothing to edit.
  const summary = useMemo(() => {
    const productIds = new Set()
    let units = 0
    let weight = 0
    const missingWeightProducts = new Set()
    selectedDeliveries.forEach((delivery) => {
      ;(delivery.items || []).forEach((item) => {
        const qty = getRemainingLoadQuantity(item)
        if (qty <= 0) return
        productIds.add(item.productId)
        units += qty
        if (item.weightKg == null || !Number.isFinite(Number(item.weightKg))) missingWeightProducts.add(item.productName || item.productId)
        else weight += getLoadWeight(item)
      })
    })
    return {
      deliveries: selectedDeliveries.length,
      products: productIds.size,
      units,
      weight,
      missingWeightProducts: [...missingWeightProducts],
    }
  }, [selectedDeliveries])

  const overCapacity =
    summary.missingWeightProducts.length === 0 && vehicle?.capacityKg != null && summary.weight > vehicle.capacityKg

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
    const selectedAtSubmit = [...selectedDeliveries]
    const failures = {}
    const readyIds = []
    const demoIds = []

    selectedAtSubmit.forEach((delivery) => {
      if (isDemoDelivery(delivery.id)) demoIds.push(delivery.id)
    })

    demoIds.forEach((deliveryId) => {
      const delivery = selectedAtSubmit.find((entry) => entry.id === deliveryId)
      const items = (delivery?.items || [])
        .map((item) => ({ productId: item.productId, productName: item.productName, qty: getRemainingLoadQuantity(item) }))
        .filter((entry) => entry.qty > 0)
      simulateDemoVehicleLoad(deliveryId, items)
    })

    for (const delivery of selectedAtSubmit.filter((entry) => !isDemoDelivery(entry.id))) {
      const stage = getDeliveryStage(delivery).key
      if (stage === 'ready') {
        readyIds.push(delivery.id)
        continue
      }

      const readyResult = await markDeliveryReady(delivery.id)
      if (readyResult.success || /already\s+ready|already\s+in\s+ready/i.test(readyResult.error || '')) {
        readyIds.push(delivery.id)
      } else {
        failures[delivery.id] = readyResult.error || 'Unable to mark this delivery ready.'
      }
    }

    if (readyIds.length > 0) {
      const batchResult = await loadDeliveriesBatch(readyIds)
      if (!batchResult.success) {
        readyIds.forEach((deliveryId) => {
          failures[deliveryId] = batchResult.error
        })
      } else {
        getBatchResults(batchResult.data, readyIds).forEach((result) => {
          if (!result.success) failures[result.deliveryId] = result.error || 'Vehicle loading failed. Please try again.'
        })
      }
    }

    const successfulIds = selectedAtSubmit.map((delivery) => delivery.id).filter((deliveryId) => !failures[deliveryId])
    setSelectedIds((current) => new Set([...current].filter((deliveryId) => !successfulIds.includes(deliveryId))))
    setDeliveryErrors(failures)
    setSubmitError(
      `${successfulIds.length} loaded successfully${Object.keys(failures).length ? ` · ${Object.keys(failures).length} need attention` : ''}`,
    )
    await load()
    setIsSubmitting(false)

    if (Object.keys(failures).length > 0) return

    showToast({
      title: 'Vehicle loaded',
      message: `${successfulIds.length} deliver${successfulIds.length === 1 ? 'y' : 'ies'} moved onto ${vehicle?.number || 'your vehicle'}.`,
    })
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
          {vehicleError ? (
            <p className="py-4 text-sm text-red-600">{vehicleError}</p>
          ) : vehicle ? (
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
          {selectedDeliveries.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">Select deliveries to see warehouse</p>
          ) : warehouses.length === 0 ? (
            <p className="py-4 text-sm font-medium text-amber-700">Not set — contact admin</p>
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
              Known load: {summary.weight} / {vehicle.capacityKg} kg{overCapacity ? ' — over capacity' : ''}
            </p>
          )}
          {summary.missingWeightProducts.length > 0 && (
            <p className="mt-1 text-center text-xs text-amber-700">
              Weight not set: {summary.missingWeightProducts.join(', ')}
            </p>
          )}
        </Card>
      </div>

      {/* Empty states */}
      {eligible.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title={waitingForPicking.length > 0 ? 'Picking in progress' : 'No deliveries are ready to load'}
            description={
              waitingForPicking.length > 0
                ? 'Finish picking every line of a delivery before it can be loaded onto the vehicle.'
                : 'Accept a delivery and pick its items in full — they will appear here to load onto the vehicle.'
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
                className={`rounded-2xl border bg-surface shadow-(--shadow-card) transition-colors ${
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
                    <p className={`text-xs ${delivery.warehouse?.name || delivery.warehouseName ? 'text-neutral-500' : 'font-medium text-amber-700'}`}>
                      Warehouse: {delivery.warehouse?.name || delivery.warehouseName || 'Not set — contact admin'}
                    </p>
                  </div>
                  <Badge variant={stage.variant} dot>{stage.label}</Badge>
                </div>

                {deliveryErrors[delivery.id] && (
                  <div className="mx-4 mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {deliveryErrors[delivery.id]}
                  </div>
                )}

                <div className="overflow-x-auto p-4">
                  <table className="w-full min-w-lg text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 text-right">Remaining</th>
                        <th className="px-2 py-2 text-center">Load Qty</th>
                        <th className="px-2 py-2">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {(delivery.items || []).map((item) => {
                        const remainingQty = getRemainingLoadQuantity(item)
                        const sku = productMeta[item.productId]?.sku
                        const available = item.warehouseAvailable
                        const shortStock = available != null && available < remainingQty
                        return (
                          <tr key={item.id || item.productId}>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-neutral-900">{item.productName}</p>
                              {sku && <p className="text-[0.7rem] text-neutral-400">SKU: {sku}</p>}
                              {shortStock && (
                                <p className="text-[0.7rem] text-red-600">Only {available} available for this delivery.</p>
                              )}
                              {item.weightKg == null && remainingQty > 0 && (
                                <p className="text-[0.7rem] text-amber-700">Weight not set for this product.</p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-right text-neutral-500">{remainingQty}</td>
                            <td className="px-2 py-2.5 text-center font-semibold text-neutral-900">{remainingQty}</td>
                            <td className="px-2 py-2.5 text-neutral-500">{item.uom || 'Not set'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {overCapacity && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              The selected load ({summary.weight} kg) is over the vehicle capacity ({vehicle.capacityKg} kg).
            </p>
          )}

          {/* Confirm bar */}
          <div className="rounded-2xl border border-neutral-100 bg-surface p-4 shadow-(--shadow-card)">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-neutral-500">
                {vehicle?.number || 'Vehicle'} · {warehouses.length > 1 ? 'Multiple warehouses' : warehouses[0] || 'Warehouse'} · {summary.deliveries} deliveries ·{' '}
                {summary.products} products · {summary.units} units
              </p>
              <Button
                type="button"
                loading={isSubmitting}
                disabled={selectedDeliveries.length === 0 || summary.units === 0}
                onClick={handleConfirm}
              >
                <PackageCheck className="size-4" aria-hidden="true" />
                {isSubmitting ? 'Loading vehicle...' : 'Confirm Vehicle Load'}
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Confirming the load moves the picked stock from the warehouse onto your vehicle.
            </p>
            {submitError && (
              <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${Object.keys(deliveryErrors).length ? 'border-red-100 bg-red-50 text-red-700' : 'border-green-100 bg-green-50 text-green-700'}`}>
                {submitError}
              </div>
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
              const onboardUnits = (delivery.items || []).reduce(
                (sum, item) => sum + (Number(item.remainingQuantity ?? item.loadedQuantity) || 0),
                0,
              )
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
                    <span className="text-xs text-neutral-500">{onboardUnits} units onboard</span>
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
