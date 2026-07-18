import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

export default function PurchaseInvoiceForm({ isOpen, onClose, invoice, onSave }) {
  const [formData, setFormData] = useState(
    invoice || {
      supplier: '',
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      items: [
        { product: '', quantity: '', price: '', total: '' },
      ]
    }
  )

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value
    if (field === 'quantity' || field === 'price') {
      newItems[index].total = Number(newItems[index].quantity || 0) * Number(newItems[index].price || 0)
    }
    setFormData({ ...formData, items: newItems })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product: '', quantity: '', price: '', total: '' }]
    })
  }

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ ...formData, total: calculateTotal() })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={invoice ? 'Edit Purchase Invoice' : 'Add Purchase Invoice'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Supplier Name"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            required
          />
          <Input
            label="Invoice Number"
            value={formData.invoiceNumber}
            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            required
          />
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Items</h3>
            <Button type="button" variant="secondary" onClick={addItem} size="sm">
              <Plus className="size-4 mr-1" />
              Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 bg-neutral-50 rounded-xl">
                <div className="col-span-5">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Product</label>
                  <input
                    type="text"
                    value={item.product}
                    onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                    placeholder="Product name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Quantity</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Price</label>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Total</label>
                  <div className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900">
                    ₹{item.total || 0}
                  </div>
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X className="size-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end p-4 bg-neutral-50 rounded-xl">
          <div className="text-right">
            <p className="text-sm text-neutral-500">Total Amount</p>
            <p className="text-2xl font-bold text-neutral-900">₹{calculateTotal().toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{invoice ? 'Update' : 'Add'} Invoice</Button>
        </div>
      </form>
    </Modal>
  )
}
