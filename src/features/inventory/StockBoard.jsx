import { useState } from 'react'
import { Package, AlertTriangle, TrendingUp } from 'lucide-react'
import Card from '../../components/ui/Card'

const initialStock = [
  { id: 1, product: 'AquaPure 250ml', sku: 'WTR-250', quantity: 1500, minStock: 500, unit: 'bottles' },
  { id: 2, product: 'AquaPure 500ml', sku: 'WTR-500', quantity: 200, minStock: 500, unit: 'bottles' },
  { id: 3, product: 'AquaPure 1L', sku: 'WTR-1L', quantity: 800, minStock: 300, unit: 'bottles' },
  { id: 4, product: 'Sparkling 500ml', sku: 'SPK-500', quantity: 350, minStock: 200, unit: 'bottles' },
  { id: 5, product: 'Sparkling 1L', sku: 'SPK-1L', quantity: 50, minStock: 150, unit: 'bottles' },
]

export default function StockBoard() {
  const [stock, setStock] = useState(initialStock)

  const stats = {
    totalProducts: stock.length,
    lowStock: stock.filter(s => s.quantity < s.minStock).length,
    totalUnits: stock.reduce((sum, item) => sum + item.quantity, 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Inventory Stock</h1>
          <p className="text-sm text-neutral-500">Track stock levels and manage low-stock items</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <Package className="size-6" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Total Products</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-600">{stats.lowStock}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Total Units</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.totalUnits.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Stock Levels</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Current Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Min Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stock.map((item) => {
                  const isLow = item.quantity < item.minStock
                  return (
                    <tr key={item.id} className="hover:bg-neutral-50">
                      <td className="py-4 px-4 font-medium text-neutral-900">{item.product}</td>
                      <td className="py-4 px-4 text-neutral-600 font-mono">{item.sku}</td>
                      <td className="py-4 px-4">
                        <span className={isLow ? 'text-red-600 font-semibold' : 'text-neutral-900'}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-neutral-600">{item.minStock} {item.unit}</td>
                      <td className="py-4 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            <AlertTriangle className="size-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  )
}
