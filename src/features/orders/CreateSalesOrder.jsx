import { useState } from 'react'
import { Plus, Trash2, Package, CheckCircle, AlertCircle } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'

const mockProducts = [
  { id: 1, name: 'AquaPure 250ml', sku: 'WTR-250', price: 10, mrp: 15, stock: 1500, variants: ['250ml'] },
  { id: 2, name: 'AquaPure 500ml', sku: 'WTR-500', price: 18, mrp: 25, stock: 200, variants: ['500ml'] },
  { id: 3, name: 'AquaPure 1L', sku: 'WTR-1L', price: 35, mrp: 45, stock: 800, variants: ['1L'] },
]

const mockCustomers = [
  { id: 1, name: 'Rajesh Kumar', email: 'rajesh@example.com' },
  { id: 2, name: 'Priya Desai', email: 'priya@example.com' },
  { id: 3, name: 'Amit Sharma', email: 'amit@example.com' },
]

const initialOrders = [
  { id: 1, customerId: 1, customerName: 'Rajesh Kumar', date: '2024-07-17', total: 500, items: [{ productId: 1, name: 'AquaPure 250ml', quantity: 50, price: 10 }] },
]

export default function CreateSalesOrder() {
  const [orders, setOrders] = useState(initialOrders)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [orderItems, setOrderItems] = useState([{ productId: null, quantity: 1 }])
  const [discount, setDiscount] = useState(0)
  const [showOrderList, setShowOrderList] = useState(true)

  const calculateItemTotal = (item) => {
    const product = mockProducts.find(p => p.id === item.productId)
    return product ? product.price * item.quantity : 0
  }

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    return subtotal - (subtotal * discount / 100)
  }

  const handleAddItem = () => {
    setOrderItems([...orderItems, { productId: null, quantity: 1 }])
  }

  const handleRemoveItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems]
    newItems[index][field] = value
    setOrderItems(newItems)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedCustomer) return alert('Please select a customer')
    if (orderItems.some(item => !item.productId)) return alert('Please select all products')
    const newOrder = {
      id: Date.now(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      date: new Date().toISOString().split('T')[0],
      total: calculateTotal(),
      items: orderItems.map(item => {
        const product = mockProducts.find(p => p.id === item.productId)
        return { productId: item.productId, name: product?.name, quantity: item.quantity, price: product?.price }
      }),
    }
    setOrders([newOrder, ...orders])
    setSelectedCustomer(null)
    setOrderItems([{ productId: null, quantity: 1 }])
    setDiscount(0)
    alert('Order created successfully!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Sales Orders</h1>
          <p className="text-sm text-neutral-500">Create and manage sales orders</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Button variant={showOrderList ? 'primary' : 'secondary'} onClick={() => setShowOrderList(true)}>Orders List</Button>
        <Button variant={!showOrderList ? 'primary' : 'secondary'} onClick={() => setShowOrderList(false)}>Create Order</Button>
      </div>

      {showOrderList ? (
        <div className="grid grid-cols-1 gap-6">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-neutral-900">Order #{order.id}</h3>
                    <p className="text-sm text-neutral-500">{order.customerName} • {order.date}</p>
                  </div>
                  <span className="text-xl font-bold text-primary-700">₹{order.total}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm text-neutral-600">
                      <span>{item.quantity}x {item.name}</span>
                      <span>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-neutral-900">Customer</h3>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700">Select Customer</label>
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => setSelectedCustomer(mockCustomers.find(c => c.id === Number(e.target.value)))}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                  >
                    <option value="">-- Select Customer --</option>
                    {mockCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name} ({customer.email})</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900">Order Items</h3>
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                    <Plus className="size-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-4">
                  {orderItems.map((item, index) => {
                    const product = mockProducts.find(p => p.id === item.productId)
                    const isLowStock = product && item.quantity > product.stock
                    return (
                      <div key={index} className="p-4 bg-neutral-50 rounded-xl space-y-3">
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-6">
                            <label className="text-xs font-medium text-neutral-600 mb-1 block">Product</label>
                            <select
                              value={item.productId || ''}
                              onChange={(e) => handleItemChange(index, 'productId', Number(e.target.value))}
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                            >
                              <option value="">-- Select --</option>
                              {mockProducts.map((prod) => (
                                <option key={prod.id} value={prod.id}>{prod.name} (₹{prod.price})</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="text-xs font-medium text-neutral-600 mb-1 block">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <div className="text-sm font-semibold text-neutral-900">₹{calculateItemTotal(item)}</div>
                          </div>
                          <div className="col-span-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                        {product && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isLowStock ? <AlertCircle className="size-3" /> : <CheckCircle className="size-3" />}
                              Stock: {product.stock} {isLowStock ? '(Low!)' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:sticky lg:top-6 space-y-6">
            <Card>
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-neutral-900">Order Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Subtotal</span>
                    <span className="text-sm font-medium text-neutral-900">₹{calculateSubtotal()}</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                    />
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Discount</span>
                      <span className="text-sm font-medium text-red-600">-₹{calculateSubtotal() * discount / 100}</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 pt-4 flex items-center justify-between">
                    <span className="text-base font-semibold text-neutral-900">Total</span>
                    <span className="text-2xl font-bold text-primary-700">₹{calculateTotal()}</span>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={!selectedCustomer}>
                  Create Order
                </Button>
              </div>
            </Card>
          </div>
        </form>
      )}
    </div>
  )
}
