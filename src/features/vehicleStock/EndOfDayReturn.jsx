import { useState } from 'react'
import { Save } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { products } from '../../mockData/products'

export default function EndOfDayReturn() {
  const [returnItems, setReturnItems] = useState(
    products.map(p => ({
      productId: p.id,
      productName: p.fullName,
      openingLoad: 10, // Mock opening load
      extraLoad: 0,
      deliveredSold: 5, // Mock delivered/sold
      actualReturn: 0,
    }))
  )
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])

  const updateActualReturn = (productId, value) => {
    setReturnItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, actualReturn: Math.max(0, Number(value)) }
          : item
      )
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('End of day return recorded successfully!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">End of Day Return</h1>
        <p className="mt-1 text-sm text-neutral-500">Record returned stock and verify against expected</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Return Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Return Date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>
        </Card>

        <Card title="Stock Return">
          <div className="space-y-4">
            {returnItems.map(item => {
              const expectedReturn = item.openingLoad + item.extraLoad - item.deliveredSold
              const variance = item.actualReturn - expectedReturn
              const hasVariance = variance !== 0

              return (
                <div key={item.productId} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                  <div className="md:col-span-2">
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Opening Load</label>
                    <p className="font-semibold text-neutral-900">{item.openingLoad}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">+ Extra Load</label>
                    <p className="font-semibold text-neutral-900">{item.extraLoad}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">- Delivered/Sold</label>
                    <p className="font-semibold text-neutral-900">{item.deliveredSold}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Expected Return</label>
                    <p className="font-semibold text-primary-700">{expectedReturn}</p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      label="Actual Return"
                      value={item.actualReturn}
                      onChange={(e) => updateActualReturn(item.productId, e.target.value)}
                      min="0"
                      required
                    />
                    {hasVariance && (
                      <Badge variant="danger" className="mt-1">
                        Variance: {variance > 0 ? `+${variance}` : variance}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" icon={Save}>
            Save End of Day Return
          </Button>
        </div>
      </form>
    </div>
  )
}
