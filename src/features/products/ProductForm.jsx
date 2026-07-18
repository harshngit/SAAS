import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

export default function ProductForm({ isOpen, onClose, product, onSave }) {
  const [formData, setFormData] = useState(
    product || {
      name: '',
      description: '',
      category: 'Water',
      variants: [
        { size: '250ml', price: 10, mrp: 15, sku: 'WTR-250' },
        { size: '500ml', price: 18, mrp: 25, sku: 'WTR-500' },
        { size: '1L', price: 35, mrp: 45, sku: 'WTR-1L' },
      ]
    }
  )

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...formData.variants]
    newVariants[index][field] = value
    setFormData({ ...formData, variants: newVariants })
  }

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [...formData.variants, { size: '', price: '', mrp: '', sku: '' }]
    })
  }

  const removeVariant = (index) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Product' : 'Add Product'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            >
              <option value="Water">Water</option>
              <option value="Juice">Juice</option>
              <option value="Soda">Soda</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <Input
          label="Description"
          as="textarea"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Variants</h3>
            <Button type="button" variant="secondary" onClick={addVariant} size="sm">
              <Plus className="size-4 mr-1" />
              Add Variant
            </Button>
          </div>
          <div className="space-y-3">
            {formData.variants.map((variant, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 bg-neutral-50 rounded-xl">
                <div className="col-span-3">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Size</label>
                  <input
                    type="text"
                    value={variant.size}
                    onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 2L"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Price</label>
                  <input
                    type="number"
                    value={variant.price}
                    onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">MRP</label>
                  <input
                    type="number"
                    value={variant.mrp}
                    onChange={(e) => handleVariantChange(index, 'mrp', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">SKU</label>
                  <input
                    type="text"
                    value={variant.sku}
                    onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X className="size-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{product ? 'Update' : 'Add'} Product</Button>
        </div>
      </form>
    </Modal>
  )
}
