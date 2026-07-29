import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, ExternalLink, Gauge, Package, Plus } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { movementTypes, stockItems as initialStockItems } from '../../mockData/stockItems'
import StockEntryForm from './StockEntryForm'

const movementMeta = (type) => movementTypes.find((entry) => entry.value === type) || { label: type, badge: 'neutral' }

export default function StockDetail() {
  const { sku } = useParams()
  const navigate = useNavigate()

  const initialItem = useMemo(() => initialStockItems.find((item) => item.sku === sku), [sku])
  const [item, setItem] = useState(initialItem)
  const [isFormOpen, setIsFormOpen] = useState(false)

  if (!item) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="Stock item not found"
          description="This SKU may have been removed or the link is out of date."
          action={{ label: 'Back to Inventory', onClick: () => navigate('/admin/inventory') }}
        />
      </Card>
    )
  }

  const status = item.currentStock <= 0 ? 'out' : item.currentStock < item.minStock ? 'low' : 'in'

  const handleSaveEntry = (entries) => {
    const entry = entries.find((candidate) => candidate.sku === item.sku)
    if (entry) {
      const { sku: _sku, ...rest } = entry
      setItem((current) => {
        const balanceAfter = current.currentStock + rest.quantity
        return {
          ...current,
          currentStock: balanceAfter,
          movements: [...current.movements, { id: current.movements.length + 1, ...rest, balanceAfter }],
        }
      })
    }
    setIsFormOpen(false)
  }

  if (isFormOpen) {
    return (
      <StockEntryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        stockItem={item}
        onSave={handleSaveEntry}
      />
    )
  }

  const sortedMovements = [...item.movements].sort((a, b) => (a.date < b.date ? 1 : -1))

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
              <h1 className="text-2xl font-semibold text-neutral-900">
                {item.productName} · {item.size}
              </h1>
              {status === 'out' ? (
                <Badge variant="danger" dot>Out of Stock</Badge>
              ) : status === 'low' ? (
                <Badge variant="warning" dot>Low Stock</Badge>
              ) : (
                <Badge variant="success">In Stock</Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{item.brand}</Badge>
              <Badge variant="primary">{item.category}</Badge>
              <span className="font-mono text-xs text-neutral-400">{item.sku}</span>
            </div>
          </div>
        </div>

        <Button size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Record Movement
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Current Stock" value={`${item.currentStock} ${item.unit}s`} />
        <StatCard icon={Gauge} iconVariant="warning" label="Minimum Stock" value={`${item.minStock} ${item.unit}s`} />
        <StatCard icon={Package} iconVariant="info" label="Opening Stock" value={`${item.openingStock} ${item.unit}s`} />
        <StatCard icon={Package} iconVariant="neutral" label="Movements Logged" value={item.movements.length} />
      </div>

      <Card title="Stock Movement History" subtitle="Every receipt, deduction, adjustment and correction for this SKU" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Date</th>
                <th className="whitespace-nowrap px-5 py-3">Type</th>
                <th className="whitespace-nowrap px-5 py-3">Direction</th>
                <th className="whitespace-nowrap px-5 py-3">PO Number / Reference</th>
                <th className="whitespace-nowrap px-5 py-3">Supplier</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Quantity</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {sortedMovements.map((movement) => {
                const meta = movementMeta(movement.type)

                return (
                  <tr key={movement.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{movement.date}</td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={movement.quantity < 0 ? 'danger' : 'success'} dot>
                        {movement.quantity < 0 ? 'OUT' : 'IN'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500">
                      {movement.poNumber ? (
                        <Link
                          to="/admin/purchases"
                          className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline"
                        >
                          {movement.poNumber}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        movement.reference || '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500">{movement.supplier || '—'}</td>
                    <td
                      className={`whitespace-nowrap px-5 py-3.5 text-right font-medium ${
                        movement.quantity < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {movement.quantity > 0 ? '+' : ''}
                      {movement.quantity} {item.unit}s
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                      {movement.balanceAfter} {item.unit}s
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
