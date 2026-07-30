import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, Edit, IndianRupee, Package, Percent, Power, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { productCatalog } from '../../mockData/productCatalog'
import { formatCurrency } from '../../utils/format'
import ProductForm from './ProductForm'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const initialProduct = useMemo(
    () => productCatalog.find((item) => String(item.id) === id),
    [id],
  )

  const [product, setProduct] = useState(initialProduct)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  if (!product) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="Product not found"
          description="This product may have been deleted or the link is out of date."
          action={{ label: 'Back to Products', onClick: () => navigate('/admin/products') }}
        />
      </Card>
    )
  }

  const sellingPrices = product.variants.map((variant) => variant.sellingPrice)
  const purchasePrices = product.variants.map((variant) => variant.purchasePrice)
  const priceRange =
    Math.min(...sellingPrices) === Math.max(...sellingPrices)
      ? formatCurrency(sellingPrices[0])
      : `${formatCurrency(Math.min(...sellingPrices))} – ${formatCurrency(Math.max(...sellingPrices))}`
  const avgGst = Math.round(
    product.variants.reduce((sum, variant) => sum + variant.gstRate, 0) / product.variants.length,
  )
  const avgMargin = Math.round(
    product.variants.reduce((sum, variant, _, arr) => {
      const margin = ((variant.sellingPrice - variant.purchasePrice) / variant.sellingPrice) * 100
      return sum + margin / arr.length
    }, 0),
  )

  const handleSaveProduct = (productData) => {
    setProduct((current) => ({ ...current, ...productData, id: current.id }))
    setIsFormOpen(false)
  }

  const handleToggleStatus = () => {
    setProduct((current) => ({ ...current, status: current.status === 'active' ? 'inactive' : 'active' }))
    setIsStatusModalOpen(false)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this product?')) {
      navigate('/admin/products')
    }
  }

  if (isFormOpen) {
    return (
      <ProductForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={product}
        onSave={handleSaveProduct}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/products')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>
              <Badge variant={product.status === 'active' ? 'success' : 'danger'}>
                {product.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{product.brand}</Badge>
              <Badge variant="primary">{product.category}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
            <Edit className="size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(true)}>
            <Power className="size-4" aria-hidden="true" />
            {product.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Variants" value={product.variants.length} />
        <StatCard icon={IndianRupee} iconVariant="success" label="Selling Price" value={priceRange} />
        <StatCard icon={Percent} iconVariant="info" label="Avg. GST Rate" value={`${avgGst}%`} />
        <StatCard icon={Percent} iconVariant="warning" label="Avg. Margin" value={`${avgMargin}%`} />
      </div>

      {product.description && (
        <Card title="Overview">
          <p className="text-sm leading-6 text-neutral-600">{product.description}</p>
        </Card>
      )}

      <Card title="Variants" subtitle="Size, tax and pricing configuration for this product" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Size</th>
                <th className="whitespace-nowrap px-5 py-3">SKU</th>
                <th className="whitespace-nowrap px-5 py-3">HSN/SAC</th>
                <th className="whitespace-nowrap px-5 py-3">Unit</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">GST</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Purchase</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Selling</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {product.variants.map((variant, index) => {
                const margin = Math.round(((variant.sellingPrice - variant.purchasePrice) / variant.sellingPrice) * 100)

                return (
                  <tr key={`${product.id}-${index}`} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{variant.size}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{variant.sku}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{variant.hsn}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{variant.unit}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-500">{variant.gstRate}%</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {formatCurrency(variant.purchasePrice)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                      {formatCurrency(variant.sellingPrice)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-500">{margin}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`${product.status === 'active' ? 'Deactivate' : 'Activate'} Product`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {product.status === 'active'
              ? 'This product will be hidden from new orders. Existing invoices and stock records will remain unchanged.'
              : 'This product will be marked active and available for sales and inventory workflows again.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={product.status === 'active' ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
            >
              {product.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
