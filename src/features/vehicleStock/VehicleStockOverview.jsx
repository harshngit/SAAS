import { useState } from 'react'
import { Car, Package } from 'lucide-react'
import Card from '../../components/ui/Card'

const initialVehicles = [
  { id: 1, name: 'Vehicle MH-01-AB-1234', driver: 'Rajesh Kumar', stock: [
    { product: '250ml', qty: 200 }, { product: '500ml', qty: 150 }, { product: '1L', qty: 80 }
  ] },
  { id: 2, name: 'Vehicle MH-02-CD-5678', driver: 'Suresh Singh', stock: [
    { product: '250ml', qty: 100 }, { product: '500ml', qty: 120 }, { product: '1L', qty: 60 }
  ] },
  { id: 3, name: 'Vehicle MH-03-EF-9012', driver: 'Amit Patel', stock: [
    { product: '250ml', qty: 300 }, { product: '500ml', qty: 200 }, { product: '1L', qty: 100 }
  ] },
]

export default function VehicleStockOverview() {
  const [vehicles, setVehicles] = useState(initialVehicles)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Vehicle Stock</h1>
        <p className="text-sm text-neutral-500">Track stock levels in delivery vehicles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Car className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">{vehicle.name}</h3>
                  <p className="text-sm text-neutral-500">Driver: {vehicle.driver}</p>
                </div>
              </div>
              <div className="space-y-3">
                {vehicle.stock.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-neutral-500" />
                      <span className="text-sm font-medium text-neutral-700">{item.product}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary-700">{item.qty} units</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Total Stock</span>
                  <span className="text-lg font-bold text-neutral-900">
                    {vehicle.stock.reduce((sum, item) => sum + item.qty, 0)} units
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
