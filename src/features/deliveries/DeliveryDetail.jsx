import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Plus, Trash2, ArrowLeft, FileText, MessageCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { deliveries } from '../../mockData/deliveries'
import { products } from '../../mockData/products'
import { orders } from '../../mockData/orders'
import { customers } from '../../mockData/customers'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit']
const DELIVERY_STATUSES = ['Delivered', 'Partial', 'Failed', 'Rescheduled']

export default function DeliveryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const delivery = deliveries.find(d => d.id === id)
  const order = orders.find(o => o.id === delivery?.orderId)
  const customer = customers.find(c => c.id === order?.customerId)
  
  const [status, setStatus] = useState(delivery?.status || 'Out for Delivery')
  const [paymentMode, setPaymentMode] = useState(delivery?.paymentMode || '')
  const [amountCollected, setAmountCollected] = useState(delivery?.amountCollected || 0)
  const [notes, setNotes] = useState(delivery?.notes || '')
  const [extraSales, setExtraSales] = useState([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [deliveryItems, setDeliveryItems] = useState(order?.items || [])

  const addExtraSale = () => {
    setExtraSales([...extraSales, { productId: '', quantity: 1 }])
  }

  const updateExtraSale = (index, field, value) => {
    setExtraSales(sales =>
      sales.map((sale, i) =>
        i === index ? { ...sale, [field]: value } : sale
      )
    )
  }

  const removeExtraSale = (index) => {
    setExtraSales(sales => sales.filter((_, i) => i !== index))
  }

  const updateDeliveryItemQuantity = (index, quantity) => {
    setDeliveryItems(items =>
      items.map((item, i) =>
        i === index ? { ...item, deliveredQuantity: Math.max(0, Number(quantity)) } : item
      )
    )
  }

  const calculateTotal = () => {
    const orderTotal = deliveryItems.reduce((sum, item) => sum + (item.deliveredQuantity || item.quantity) * item.unitPrice, 0)
    const extraTotal = extraSales.reduce((sum, sale) => {
      const product = products.find(p => p.id === sale.productId)
      return sum + (product ? product.sellingPrice * sale.quantity : 0)
    }, 0)
    return orderTotal + extraTotal
  }

  const totalAmount = calculateTotal()
  const lastPendingAmount = delivery?.amountDue || 0
  const currentTotal = totalAmount
  const grandTotal = lastPendingAmount + currentTotal

  const handleSubmit = (e) => {
    e.preventDefault()
    showToast({ title: 'Delivery saved', message: 'Delivery details saved successfully.' })
  }

  const handleSendWhatsApp = () => {
    const currentPending = grandTotal - amountCollected
    const message = `Receipt for order ${delivery.orderNumber}\nAmount collected: ₹${amountCollected}\nPrevious pending: ₹${lastPendingAmount}\nCurrent pending: ₹${currentPending}`
    const phoneDigits = (customer?.phone || '').replace(/\D/g, '')
    const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  if (!delivery) {
    return <div>Delivery not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Delivery {delivery.id}</h1>
          <p className="mt-1 text-sm text-neutral-500">Order {delivery.orderNumber} • {delivery.customerName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Delivery Status">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Delivery Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={DELIVERY_STATUSES.map(s => ({ value: s, label: s }))}
              required
            />
            <Select
              label="Payment Mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              options={PAYMENT_MODES.map(m => ({ value: m, label: m }))}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any delivery notes…"
            />
          </div>
        </Card>

        <Card title="Delivery Items">
          <div className="space-y-4">
            {deliveryItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                <div className="md:col-span-1">
                  <p className="font-medium text-neutral-900">{item.productName}</p>
                  <p className="text-sm text-neutral-500">Ordered: {item.quantity} • {formatCurrency(item.unitPrice)}/unit</p>
                </div>
                <Input
                  type="number"
                  label="Delivered Quantity"
                  value={item.deliveredQuantity || item.quantity}
                  onChange={(e) => updateDeliveryItemQuantity(index, e.target.value)}
                  min="0"
                  max={item.quantity}
                  required
                />
                <div className="text-right">
                  <p className="font-semibold text-neutral-900">
                    {formatCurrency((item.deliveredQuantity || item.quantity) * item.unitPrice)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Extra Sales (From Vehicle Stock)">
          <div className="space-y-4">
            {extraSales.map((sale, index) => {
              const product = products.find(p => p.id === sale.productId)
              return (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                  <div className="md:col-span-2">
                    <Select
                      label="Product"
                      value={sale.productId}
                      onChange={(e) => updateExtraSale(index, 'productId', e.target.value)}
                      options={products.map(p => ({ value: p.id, label: p.fullName }))}
                      required
                    />
                  </div>
                  <Input
                    type="number"
                    label="Quantity"
                    value={sale.quantity}
                    onChange={(e) => updateExtraSale(index, 'quantity', e.target.value)}
                    min="1"
                    required
                  />
                  <div className="flex items-end gap-2">
                    {product && (
                      <p className="text-right text-sm text-neutral-600">
                        {formatCurrency(product.sellingPrice * sale.quantity)}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Trash2}
                      onClick={() => removeExtraSale(index)}
                    />
                  </div>
                </div>
              )
            })}
            <Button type="button" variant="secondary" icon={Plus} onClick={addExtraSale}>
              Add Extra Sale
            </Button>
          </div>
        </Card>

        <Card title="Payment Collection">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Last Pending Amount"
              type="number"
              value={lastPendingAmount}
              disabled
            />
            <Input
              label="Current Delivery Total"
              type="number"
              value={currentTotal}
              disabled
            />
            <Input
              label="Grand Total (Last Pending + Current)"
              type="number"
              value={grandTotal}
              disabled
            />
            <Input
              label="Amount Collected"
              type="number"
              value={amountCollected}
              onChange={(e) => setAmountCollected(Number(e.target.value))}
              min="0"
              required
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" icon={FileText} onClick={() => setShowReceipt(true)}>
              Preview Receipt
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={MessageCircle}
              disabled={!customer?.phone}
              onClick={handleSendWhatsApp}
            >
              Send via WhatsApp
            </Button>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" icon={Save}>
            Save Delivery Details
          </Button>
        </div>
      </form>

      <Modal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        title="Receipt Preview"
      >
        <div className="space-y-4">
          <div className="border-b pb-4">
            <p className="font-semibold text-lg">SAAS Distributors</p>
            <p className="text-sm text-neutral-500">Receipt for Delivery {delivery.id}</p>
            <p className="text-sm text-neutral-500">Date: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Customer: {delivery.customerName}</p>
            <p className="font-medium">Order #: {delivery.orderNumber}</p>
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Last Pending Amount:</span>
              <span>{formatCurrency(lastPendingAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Delivery Total:</span>
              <span>{formatCurrency(currentTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Grand Total:</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Amount Collected:</span>
              <span>{formatCurrency(amountCollected)}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
