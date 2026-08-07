import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, Edit, IndianRupee, Package, Percent, Power, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { deleteProduct, getProduct, updateProduct } from '../../api/products'
import { formatCurrency } from '../../utils/format'
import { normalizeApiProduct } from './productUtils'
import ProductForm from './ProductForm'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProduct() {
      setIsLoading(true)
      setLoadError('')

      const result = await getProduct(id)

      if (!isMounted) return

      setIsLoading(false)

      if (!result.success) {
        setLoadError(result.error)
        return
      }

      setProduct(normalizeApiProduct(result.product))
    }

    loadProduct()

    return () => {
      isMounted = false
    }
  }, [id])

  if (isLoading) {
    return <LoadingSpinner label="Loading product details..." />
  }

  if (!product) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="Product not found"
          description={loadError || 'This product may have been deleted or the link is out of date.'}
          action={{ label: 'Back to Products', onClick: () => navigate('/admin/products') }}
        />
      </Card>
    )
  }

  const sellingPrices = product.variants.map((variant) => variant.sellingPrice)
  const purchasePrices = product.variants.map((variant) => variant.purchasePrice)
  const priceRange =
    sellingPrices.length === 0
      ? formatCurrency(0)
      : Math.min(...sellingPrices) === Math.max(...sellingPrices)
        ? formatCurrency(sellingPrices[0])
        : `${formatCurrency(Math.min(...sellingPrices))} – ${formatCurrency(Math.max(...sellingPrices))}`
  const avgGst = product.variants.length
    ? Math.round(product.variants.reduce((sum, variant) => sum + variant.gstRate, 0) / product.variants.length)
    : 0
  const avgMargin =
    product.variants.length && purchasePrices.some(Boolean)
      ? Math.round(
          product.variants.reduce((sum, variant, _, arr) => {
            const margin = variant.sellingPrice ? ((variant.sellingPrice - variant.purchasePrice) / variant.sellingPrice) * 100 : 0
            return sum + margin / arr.length
          }, 0),
        )
      : 0

  const handleSaveProduct = async (productData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateProduct(product.id, productData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setProduct(normalizeApiProduct(result.product, productData))
    setIsFormOpen(false)
  }

  const handleToggleStatus = async () => {
    const nextIsActive = product.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

    const result = await updateProduct(product.id, { isActive: nextIsActive })

    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    setProduct(normalizeApiProduct(result.product, product))
    setIsStatusModalOpen(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteProduct(product.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    navigate('/admin/products')
  }

  if (isFormOpen) {
    return (
      <ProductForm
        isOpen={isFormOpen}
        onClose={() => {
          if (isSaving) return
          setFormError('')
          setIsFormOpen(false)
        }}
        product={product}
        onSave={handleSaveProduct}
        saving={isSaving}
        formError={formError}
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
              {product.brand && <Badge variant="neutral">{product.brand}</Badge>}
              {product.category && <Badge variant="primary">{product.category}</Badge>}
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
          <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
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

      {(product.coverImage || product.images?.length > 0) && (
        <Card title="Images">
          <div className="flex flex-wrap gap-3">
            {product.coverImage && (
              <img
                src={product.coverImage}
                alt={product.name}
                className="size-24 rounded-xl border border-neutral-100 object-cover"
              />
            )}
            {product.images?.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`${product.name} ${index + 1}`}
                className="size-24 rounded-xl border border-neutral-100 object-cover"
              />
            ))}
          </div>
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
                <th className="whitespace-nowrap px-5 py-3 text-right">Stock</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {product.variants.map((variant, index) => {
                const margin = variant.sellingPrice
                  ? Math.round(((variant.sellingPrice - variant.purchasePrice) / variant.sellingPrice) * 100)
                  : 0

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
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {variant.inventory?.openingStock ?? variant.inventory ?? 0}
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
        onClose={() => {
          if (isUpdatingStatus) return
          setStatusError('')
          setIsStatusModalOpen(false)
        }}
        title={`${product.status === 'active' ? 'Deactivate' : 'Activate'} Product`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {product.status === 'active'
              ? 'This product will be hidden from new orders. Existing invoices and stock records will remain unchanged.'
              : 'This product will be marked active and available for sales and inventory workflows again.'}
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingStatus}
              onClick={() => {
                setStatusError('')
                setIsStatusModalOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={product.status === 'active' ? 'danger' : 'primary'}
              loading={isUpdatingStatus}
              onClick={handleToggleStatus}
            >
              {product.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setIsDeleteModalOpen(false)
        }}
        title="Delete Product"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {product.name}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setIsDeleteModalOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
