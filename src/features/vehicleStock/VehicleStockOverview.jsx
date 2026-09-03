import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, PackageSearch, RotateCw, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { ROLES } from '../../auth/roles'
import { getCurrentVehicleStock, listVehicleStockSessions } from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'
import { demoDeliveriesResolved, demoVehicleSessionResolved } from '../orders/orderDemoData'
import { formatDateTime } from '../../utils/format'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const looksLikeUuid = (value) => UUID_RE.test(String(value || ''))
const friendly = (value) => (value && !looksLikeUuid(value) ? value : '')

const availableOf = (item) => Number(item.remainingQuantity) || 0
const loadedOf = (item) => (Number(item.loadedQuantity) || 0) + (Number(item.extraQuantity) || 0)

function stockStatus(item) {
  return availableOf(item) > 0
    ? { label: 'Available', variant: 'success' }
    : { label: 'Out of Stock', variant: 'danger' }
}

function skuVariantLabel(item) {
  return friendly(item.sku) || friendly(item.variantId) || '—'
}

function SummaryTiles({ items }) {
  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        loaded: acc.loaded + loadedOf(item),
        delivered: acc.delivered + (Number(item.deliveredQuantity) || 0),
        available: acc.available + availableOf(item),
      }),
      { loaded: 0, delivered: 0, available: 0 },
    )
  }, [items])

  const tiles = [
    { label: 'Products On Vehicle', value: items.filter((item) => availableOf(item) > 0).length },
    { label: 'Loaded Units', value: totals.loaded },
    { label: 'Delivered Units', value: totals.delivered },
    { label: 'Available Units', value: totals.available, strong: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
          <p className={`text-2xl font-semibold ${tile.strong ? 'text-primary-700' : 'text-neutral-900'}`}>{tile.value}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{tile.label}</p>
        </div>
      ))}
    </div>
  )
}

function QtyCell({ value, className = '' }) {
  return <span className={`tabular-nums ${className}`}>{Number(value) || 0}</span>
}

function VehicleSessionPanel({ session, onViewDetails, onEndDayReturn }) {
  const items = session.items || []
  const totalRemaining = items.reduce((sum, item) => sum + availableOf(item), 0)
  const contextBits = [
    session.vehicleNumber || 'Vehicle not assigned',
    session.vehicleType,
    friendly(session.deliveryPartnerName) ? `Driver: ${session.deliveryPartnerName}` : null,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-neutral-900">{contextBits[0]}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {contextBits.slice(1).join(' · ') || 'Assigned vehicle'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                {friendly(session.warehouseName) && <span>Warehouse: {session.warehouseName}</span>}
                {(session.lastLoadedAt || session.date) && (
                  <span>Last loaded: {formatDateTime(session.lastLoadedAt || session.date)}</span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={session.status === 'active' ? 'success' : 'neutral'} dot>
            {session.status === 'active' ? 'Active session' : session.status || 'Session'}
          </Badge>
        </div>
      </Card>

      <SummaryTiles items={items} />

      {items.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-neutral-500">Nothing is loaded on this vehicle.</p>
        </Card>
      ) : (
        <Card className="p-0" bodyClassName="p-0">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU / Variant</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3 text-right">Loaded</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Returned</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map((item, idx) => {
                  const status = stockStatus(item)
                  const name = friendly(item.productName)
                  return (
                    <tr key={item.id || item.productId || idx}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{name || '—'}</td>
                      <td className="px-4 py-3 text-neutral-500">{skuVariantLabel(item)}</td>
                      <td className="px-4 py-3 text-neutral-500">{item.uom || '—'}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        <QtyCell value={loadedOf(item)} />
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        <QtyCell value={item.deliveredQuantity} />
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        <QtyCell value={item.returnedQuantity} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <QtyCell value={availableOf(item)} className="text-base font-semibold text-neutral-900" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => onViewDetails(item)}>
                          View Details
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-neutral-100 md:hidden">
            {items.map((item, idx) => {
              const status = stockStatus(item)
              const name = friendly(item.productName)
              return (
                <div key={item.id || item.productId || idx} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{name || '—'}</p>
                      <p className="text-xs text-neutral-500">
                        {skuVariantLabel(item)}
                        {item.uom ? ` · ${item.uom}` : ''}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Loaded', loadedOf(item)],
                      ['Delivered', Number(item.deliveredQuantity) || 0],
                      ['Returned', Number(item.returnedQuantity) || 0],
                      ['Available', availableOf(item)],
                    ].map(([label, value], i) => (
                      <div key={label}>
                        <p className={`text-sm font-semibold ${i === 3 ? 'text-primary-700' : 'text-neutral-900'}`}>{value}</p>
                        <p className="text-[0.65rem] uppercase tracking-wide text-neutral-400">{label}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onViewDetails(item)}
                  >
                    View Details
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {totalRemaining > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onEndDayReturn}>
            <Boxes className="size-4" aria-hidden="true" />
            End Day Return
          </Button>
        </div>
      )}
    </div>
  )
}

function ItemDetailModal({ item, onClose }) {
  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} title="Product stock details" size="lg">
      {item && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-400">Product</p>
              <p className="font-medium text-neutral-900">{friendly(item.productName) || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">SKU</p>
              <p className="font-medium text-neutral-900">{friendly(item.sku) || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Variant</p>
              <p className="font-medium text-neutral-900">{friendly(item.variantId) || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">UOM</p>
              <p className="font-medium text-neutral-900">{item.uom || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Loaded Qty', loadedOf(item)],
              ['Delivered Qty', Number(item.deliveredQuantity) || 0],
              ['Returned Qty', Number(item.returnedQuantity) || 0],
              ['Available Qty', availableOf(item)],
            ].map(([label, value], i) => (
              <div key={label} className="rounded-xl bg-neutral-50 p-3 text-center">
                <p className={`text-lg font-semibold ${i === 3 ? 'text-primary-700' : 'text-neutral-900'}`}>{value}</p>
                <p className="mt-0.5 text-[0.7rem] text-neutral-500">{label}</p>
              </div>
            ))}
          </div>

          <p className="rounded-xl bg-primary-50 px-4 py-3 text-xs text-primary-800">
            Available for delivery adjustments: <span className="font-semibold">{availableOf(item)} units</span>. You can
            increase a delivered quantity or add this product to an active delivery from My Deliveries → Delivery Detail.
          </p>
        </div>
      )}
    </Modal>
  )
}

export default function VehicleStockOverview() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPER_ADMIN

  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

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
      setIsLoading(false)
      return
    }

    if (currentUser?.id) {
      const result = await getCurrentVehicleStock(currentUser.id)
      if (!result.success) {
        setError(result.error)
        setSessions([])
      } else if (result.session) {
        setSessions([result.session])
      } else {
        // No real active session - fall back to the shared demo session so the delivery
        // flow stays explorable. Demo ids never reach a mutation endpoint.
        const demoSession = demoDeliveriesResolved().length > 0 ? demoVehicleSessionResolved() : null
        setSessions(demoSession ? [demoSession] : [])
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
        <h1 className="text-2xl font-semibold text-neutral-900">Vehicle Stock</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isAdmin ? 'Stock currently loaded on delivery vehicles.' : 'Current stock available on your assigned vehicle.'}
        </p>
      </div>

      {isLoading ? (
        <Card>
          <LoadingSpinner label="Loading vehicle stock..." />
        </Card>
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
          <EmptyState
            icon={PackageSearch}
            title={isAdmin ? 'No vehicle stock sessions' : 'No active vehicle load'}
            description={
              isAdmin
                ? 'Vehicle stock will appear here once a delivery partner confirms a vehicle load.'
                : 'Load your assigned deliveries first. Vehicle stock will appear here after the load is confirmed.'
            }
            action={
              isAdmin
                ? undefined
                : { label: 'Go to Vehicle Loading', onClick: () => navigate('/delivery/vehicle-loading') }
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {sessions.map((session) => (
            <VehicleSessionPanel
              key={session.id}
              session={session}
              onViewDetails={setSelectedItem}
              onEndDayReturn={() => navigate('/delivery/end-of-day')}
            />
          ))}
        </div>
      )}

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}
