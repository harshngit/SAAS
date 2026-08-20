import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, Layers, Package, PackagePlus } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatCard from '../../components/ui/StatCard'
import { getProductStock, recordStockAdjustment } from '../../api/inventory'
import { getWarehouseStock } from '../../api/warehouses'
import { getMovementMeta } from './inventoryConstants'
import StockEntryForm from './StockEntryForm'

export default function StockDetail() {
  const { product_id: productId } = useParams()
  const navigate = useNavigate()

  const [stock, setStock] = useState(null)
  const [warehouseStock, setWarehouseStock] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadStock = async () => {
    setIsLoading(true)
    setLoadError('')

    const [result, warehouseResult] = await Promise.all([
      getProductStock(productId),
      getWarehouseStock({ product_id: productId }),
    ])

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return
    }

    setStock(result.stock)
    setWarehouseStock(warehouseResult.success ? warehouseResult.stock : [])
  }

  useEffect(() => {
    loadStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (isLoading) {
    return <LoadingSpinner label="Loading stock details..." />
  }

  if (!stock) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="Stock item not found"
          description={loadError || 'This product may have been removed or the link is out of date.'}
          action={{ label: 'Back to Inventory', onClick: () => navigate('/admin/inventory') }}
        />
      </Card>
    )
  }

  const isOutOfStock = (stock.total_stock || 0) <= 0
  const variantName = (variantId) =>
    stock.variations?.find((variation) => variation.id === variantId)?.name || 'Product level'

  const handleSaveEntry = async (movements) => {
    setIsSaving(true)
    setFormError('')

    for (const movement of movements) {
      const result = await recordStockAdjustment(movement)

      if (!result.success) {
        setIsSaving(false)
        setFormError(result.error)
        return
      }
    }

    setIsSaving(false)
    setIsFormOpen(false)
    await loadStock()
  }

  if (isFormOpen) {
    return (
      <StockEntryForm
        isOpen={isFormOpen}
        onClose={() => {
          if (isSaving) return
          setFormError('')
          setIsFormOpen(false)
        }}
        product={stock}
        saving={isSaving}
        formError={formError}
        onSave={handleSaveEntry}
      />
    )
  }

  const sortedMovements = [...(stock.movements || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/inventory')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{stock.name}</h1>
              {!stock.is_active && <Badge variant="neutral">Inactive</Badge>}
              {isOutOfStock ? (
                <Badge variant="danger" dot>Out of Stock</Badge>
              ) : (
                <Badge variant="success">In Stock</Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {stock.brand && <Badge variant="neutral">{stock.brand}</Badge>}
              {stock.product_type && <Badge variant="primary">{stock.product_type}</Badge>}
              {stock.sku && <span className="font-mono text-xs text-neutral-400">{stock.sku}</span>}
            </div>
          </div>
        </div>

        <Button size="sm" onClick={() => setIsFormOpen(true)}>
          <PackagePlus className="size-4" aria-hidden="true" />
          Record Movement
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={Boxes} iconVariant="primary" label="Current Stock" value={stock.total_stock} />
        <StatCard icon={Layers} iconVariant="info" label="Variants" value={stock.variations?.length || 0} />
        <StatCard icon={Package} iconVariant="neutral" label="Movements Logged" value={sortedMovements.length} />
      </div>

      <Card title="Warehouse Stock" subtitle="Physical, reserved, and available quantities as tracked by the warehouse" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Warehouse</th>
                <th className="whitespace-nowrap px-5 py-3">Variant</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Physical / On Hand</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Reserved</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {warehouseStock.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No warehouse stock records for this product yet.
                  </td>
                </tr>
              ) : (
                warehouseStock.map((row, index) => (
                  <tr key={`${row.warehouse_id}-${row.variant_id || 'base'}-${index}`} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{row.warehouse_name || row.warehouse_id}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{row.variant_name || 'Product level'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{row.on_hand ?? 0}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-amber-600">{row.reserved ?? 0}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-green-600">{row.available ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {stock.variations?.length > 0 && (
        <Card title="Variant Stock" className="p-0" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Variant</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {stock.variations.map((variation) => (
                  <tr key={variation.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{variation.name}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-900">{variation.inventory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Stock Movement History" subtitle="Every receipt, deduction, adjustment and correction for this product" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Date</th>
                <th className="whitespace-nowrap px-5 py-3">Variant</th>
                <th className="whitespace-nowrap px-5 py-3">Type</th>
                <th className="whitespace-nowrap px-5 py-3">Direction</th>
                <th className="whitespace-nowrap px-5 py-3">Note</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Quantity</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {sortedMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No movements recorded yet.
                  </td>
                </tr>
              ) : (
                sortedMovements.map((movement) => {
                  const meta = getMovementMeta(movement.movement_type)

                  return (
                    <tr key={movement.id} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {new Date(movement.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {movement.variant_id ? variantName(movement.variant_id) : 'Product level'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant={movement.quantity < 0 ? 'danger' : 'success'} dot>
                          {movement.quantity < 0 ? 'OUT' : 'IN'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-500">{movement.note || '—'}</td>
                      <td
                        className={`whitespace-nowrap px-5 py-3.5 text-right font-medium ${
                          movement.quantity < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {movement.quantity > 0 ? '+' : ''}
                        {movement.quantity}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                        {movement.balance_after}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
