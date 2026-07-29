import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const emptyVariant = { size: '', sku: '', hsn: '', unit: 'Bottle', gstRate: '', purchasePrice: '', sellingPrice: '' }

const emptyForm = {
  name: '',
  brand: '',
  category: '',
  status: 'active',
  description: '',
  variants: [{ ...emptyVariant }],
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default function ProductForm({ isOpen, onClose, product, onSave }) {
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    if (!isOpen) return
    setFormData(
      product
        ? { ...emptyForm, ...product, variants: product.variants.map((variant) => ({ ...variant })) }
        : { ...emptyForm, variants: [{ ...emptyVariant }] },
    )
  }, [product, isOpen])

  if (!isOpen) return null

  const handleVariantChange = (index, field, value) => {
    const nextVariants = formData.variants.map((variant, i) =>
      i === index ? { ...variant, [field]: value } : variant,
    )
    setFormData({ ...formData, variants: nextVariants })
  }

  const addVariant = () => {
    setFormData({ ...formData, variants: [...formData.variants, { ...emptyVariant }] })
  }

  const removeVariant = (index) => {
    setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== index) })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...formData,
      variants: formData.variants.map((variant) => ({
        ...variant,
        gstRate: Number(variant.gstRate) || 0,
        purchasePrice: Number(variant.purchasePrice) || 0,
        sellingPrice: Number(variant.sellingPrice) || 0,
      })),
    })
    onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">{product ? 'Update product' : 'Add a new product'}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Manage brand, category and every size variant with its own SKU, tax and pricing.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Back to Products
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">1</span>
            <p className="text-sm font-semibold text-neutral-900">Basic information</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Input
              label="Product Name"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              required
            />
            <Input
              label="Brand"
              value={formData.brand}
              onChange={(event) => setFormData({ ...formData, brand: event.target.value })}
              required
            />
            <Input
              label="Category"
              value={formData.category}
              onChange={(event) => setFormData({ ...formData, category: event.target.value })}
              required
            />
            <Select
              label="Status"
              options={statusOptions}
              value={formData.status}
              onChange={(event) => setFormData({ ...formData, status: event.target.value })}
            />
            <Input
              label="Description"
              as="textarea"
              className="lg:col-span-2"
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">2</span>
              <p className="text-sm font-semibold text-neutral-900">Variants</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addVariant}>
              <Plus className="size-4" aria-hidden="true" />
              Add Variant
            </Button>
          </div>

          <div className="space-y-3">
            {formData.variants.map((variant, index) => (
              <div key={index} className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                {formData.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    aria-label="Remove variant"
                    className="absolute right-3 top-3 rounded-lg p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3 pr-8 sm:grid-cols-3 lg:grid-cols-7">
                  <Input label="Size" placeholder="e.g. 500 ml" value={variant.size} onChange={(event) => handleVariantChange(index, 'size', event.target.value)} required />
                  <Input label="SKU" value={variant.sku} onChange={(event) => handleVariantChange(index, 'sku', event.target.value)} required />
                  <Input label="HSN/SAC" value={variant.hsn} onChange={(event) => handleVariantChange(index, 'hsn', event.target.value)} />
                  <Input label="Unit" placeholder="Bottle" value={variant.unit} onChange={(event) => handleVariantChange(index, 'unit', event.target.value)} />
                  <Input label="GST %" type="number" min="0" value={variant.gstRate} onChange={(event) => handleVariantChange(index, 'gstRate', event.target.value)} />
                  <Input label="Purchase ₹" type="number" min="0" value={variant.purchasePrice} onChange={(event) => handleVariantChange(index, 'purchasePrice', event.target.value)} />
                  <Input label="Selling ₹" type="number" min="0" value={variant.sellingPrice} onChange={(event) => handleVariantChange(index, 'sellingPrice', event.target.value)} required />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{product ? 'Save Changes' : 'Save Product'}</Button>
      </div>
    </form>
  )
}
