import { useState } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { products } from '../../mockData/products'
import { useToast } from '../../components/ui/toastContext'

export default function VehicleLoading() {
  const { showToast } = useToast()
  const [loadingItems, setLoadingItems] = useState(
    products.map(p => ({ productId: p.id, productName: p.fullName, quantity: 0 }))
  )
  const [loadingDate, setLoadingDate] = useState(new Date().toISOString().split('T')[0])

  const updateQuantity = (productId, quantity) => {
    setLoadingItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, quantity: Math.max(0, Number(quantity)) }
          : item
      )
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    showToast({ title: 'Opening load recorded', message: 'Opening load recorded successfully.' })
  }

  const totalItems = loadingItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Vehicle Loading</h1>
        <p className="mt-1 text-sm text-neutral-500">Record opening stock for your delivery vehicle</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Loading Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Loading Date"
              type="date"
              value={loadingDate}
              onChange={(e) => setLoadingDate(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Total Items Loaded</label>
              <div className="text-lg font-semibold text-primary-700">{totalItems}</div>
            </div>
          </div>
        </Card>

        <Card title="Products to Load">
          <div className="space-y-4">
            {loadingItems.map(item => (
              <div key={item.productId} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                <div className="md:col-span-2">
                  <p className="font-medium text-neutral-900">{item.productName}</p>
                </div>
                <Input
                  type="number"
                  label="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.productId, e.target.value)}
                  min="0"
                  required
                />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" icon={Save}>
            Save Opening Load
          </Button>
        </div>
      </form>
    </div>
  )
}
