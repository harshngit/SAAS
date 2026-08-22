import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Calendar,
  Download,
  Edit,
  IndianRupee,
  Package,
  Paperclip,
  Percent,
  Power,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import {
  addProductAttachments,
  deleteProduct,
  deleteProductAttachment,
  getProduct,
  getProductBatches,
  getProductSerials,
  listProductAttachments,
  updateProduct,
} from '../../api/products'
import { formatCurrency } from '../../utils/format'
import { normalizeApiProduct } from './productUtils'
import ProductForm from './ProductForm'

function formatDateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value || '—'}</p>
    </div>
  )
}

function DocumentLink({ label, url }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
        >
          <Download className="size-3.5" aria-hidden="true" />
          View file
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium text-neutral-900">—</p>
      )}
    </div>
  )
}

function HeroThumbnail({ src, alt }) {
  const [hasError, setHasError] = useState(false)

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className="size-16 shrink-0 rounded-xl border border-neutral-100 object-cover sm:size-20"
      />
    )
  }

  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 text-neutral-300 sm:size-20">
      <Package className="size-6" aria-hidden="true" />
    </div>
  )
}

const statusLabel = { active: 'Active', inactive: 'Inactive', discontinued: 'Discontinued' }

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

  const [batches, setBatches] = useState([])
  const [serials, setSerials] = useState([])
  const [attachments, setAttachments] = useState([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [deletingAttachmentId, setDeletingAttachmentId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProduct() {
      setIsLoading(true)
      setLoadError('')

      const [result, batchesResult, serialsResult, attachmentsResult] = await Promise.all([
        getProduct(id),
        getProductBatches(id),
        getProductSerials(id),
        listProductAttachments(id),
      ])

      if (!isMounted) return

      setIsLoading(false)

      // Batches/serials/attachments are best-effort extras - a product that isn't
      // batch/serial-tracked simply returns an empty list, not an error.
      if (batchesResult.success) setBatches(batchesResult.batches)
      if (serialsResult.success) setSerials(serialsResult.serials)
      if (attachmentsResult.success) setAttachments(attachmentsResult.attachments)

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

  const handleUploadAttachments = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setIsUploadingAttachment(true)
    setAttachmentError('')

    const result = await addProductAttachments(product.id, files)

    setIsUploadingAttachment(false)

    if (!result.success) {
      setAttachmentError(result.error)
      return
    }

    setAttachments(result.attachments)
  }

  const handleDeleteAttachment = async (attachmentId) => {
    setDeletingAttachmentId(attachmentId)
    setAttachmentError('')

    const result = await deleteProductAttachment(product.id, attachmentId)

    setDeletingAttachmentId('')

    if (!result.success) {
      setAttachmentError(result.error)
      return
    }

    setAttachments((current) => current.filter((attachment) => (attachment.id || attachment.file_id) !== attachmentId))
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
          <HeroThumbnail src={product.coverImage} alt={product.name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{product.name}</h1>
              <Badge variant={product.status === 'active' ? 'success' : 'danger'}>
                {product.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {product.sku && <p className="mt-0.5 text-xs text-neutral-400">SKU: {product.sku}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {product.brand && <Badge variant="neutral">{product.brand}</Badge>}
              {(product.categoryLabel || product.category) && <Badge variant="primary">{product.categoryLabel || product.category}</Badge>}
              {product.subCategory && <Badge variant="neutral">{product.subCategory}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
              {product.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" aria-hidden="true" />
                  Created {formatDateLabel(product.createdAt)}
                </span>
              )}
              {product.updatedAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" aria-hidden="true" />
                  Updated {formatDateLabel(product.updatedAt)}
                </span>
              )}
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Boxes} iconVariant="primary" label="Variants" value={product.variants.length} />
        <StatCard icon={IndianRupee} iconVariant="success" label="Selling Price" value={priceRange} />
        <StatCard icon={Percent} iconVariant="info" label="Avg. GST Rate" value={`${avgGst}%`} />
        <StatCard icon={Percent} iconVariant="warning" label="Avg. Margin" value={`${avgMargin}%`} />
        <StatCard icon={Package} iconVariant="neutral" label="Total Stock" value={product.totalStock} />
      </div>

      {(product.coverImage || product.images?.length > 0 || product.videoUrl) && (
        <Card title="Images & Media">
          <div className="flex flex-wrap gap-3">
            {product.coverImage && (
              <img
                src={product.coverImage}
                alt={product.name}
                className="size-32 rounded-xl border-2 border-primary-100 object-cover"
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
            {product.videoUrl && (
              <a
                href={product.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-500 hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700"
              >
                <Video className="size-5" aria-hidden="true" />
                <span className="text-xs font-medium">Video</span>
              </a>
            )}
          </div>
        </Card>
      )}

      {product.description && (
        <Card title="Overview">
          <p className="text-sm leading-6 text-neutral-600">{product.description}</p>
        </Card>
      )}

      <Card title="Specifications">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Classification</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Lifecycle Status" value={statusLabel[product.statusValue] || statusLabel[product.status]} />
              <Field label="Product Type" value={product.productType} />
              <Field label="Sub Category" value={product.subCategory} />
              <Field label="Manufacturer" value={product.manufacturer} />
              <Field label="Model Number" value={product.modelNumber} />
              <Field label="Short Name" value={product.shortName} />
              <Field label="Barcode" value={product.barcode} />
              <Field label="Unit of Measure" value={product.unitOfMeasure} />
              <Field label="Currency" value={product.currency} />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Pricing</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="MRP" value={product.mrp !== '' ? formatCurrency(product.mrp) : ''} />
              <Field label="Wholesale Price" value={product.wholesalePrice !== '' ? formatCurrency(product.wholesalePrice) : ''} />
              <Field label="Dealer Price" value={product.dealerPrice !== '' ? formatCurrency(product.dealerPrice) : ''} />
              <Field label="Discount %" value={product.discountPercent !== '' ? `${product.discountPercent}%` : ''} />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Tax &amp; Purchase</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="HSN/SAC Code" value={product.hsnSacCode} />
              <Field label="Tax Category" value={product.taxCategory} />
              <Field label="GST/VAT Rate" value={product.gstVatRate !== '' ? `${product.gstVatRate}%` : ''} />
              <Field label="Tax Inclusive" value={product.taxInclusive ? 'Yes' : 'No'} />
              <Field label="Preferred Supplier" value={product.supplierName} />
              <Field label="Supplier Code" value={product.supplierProductCode} />
              <Field label="Lead Time" value={product.leadTime} />
              <Field label="Min. Order Qty" value={product.minimumOrderQuantity} />
              <Field label="Purchase Unit" value={product.purchaseUnit} />
              <Field label="Sales Unit" value={product.salesUnit} />
              <Field label="Commission Eligible" value={product.commissionEligible ? 'Yes' : 'No'} />
              <Field label="Commission %" value={product.commissionPercent !== '' ? `${product.commissionPercent}%` : ''} />
              <Field label="Default Discount" value={product.defaultDiscount !== '' ? `${product.defaultDiscount}%` : ''} />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Physical Specifications</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Weight" value={product.weight !== '' ? `${product.weight} ${product.weightUnit || ''}`.trim() : ''} />
              <Field
                label="Dimensions (L×W×H)"
                value={product.length || product.width || product.height ? `${product.length || 0} × ${product.width || 0} × ${product.height || 0}` : ''}
              />
              <Field label="Volume" value={product.volume} />
              <Field label="Color" value={product.color} />
              <Field label="Material" value={product.material} />
              <Field label="Size" value={product.size} />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Additional Information</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Warranty" value={product.warrantyPeriod ? `${product.warrantyPeriod} ${product.warrantyPeriodUnit || ''}`.trim() : ''} />
              <Field label="Shelf Life" value={product.shelfLife ? `${product.shelfLife} ${product.shelfLifeUnit || ''}`.trim() : ''} />
              <Field label="Country of Origin" value={product.countryOfOrigin} />
              <Field label="Launch Date" value={formatDateLabel(product.launchDate)} />
              <Field label="End of Life Date" value={formatDateLabel(product.endOfLifeDate)} />
              <Field label="Attribute Types" value={product.variantAttributes} />
              <Field label="Tags" value={product.productTags} />
            </div>
            {product.notes && (
              <div className="mt-4">
                <p className="text-xs text-neutral-400">Internal Notes</p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{product.notes}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {(product.downloadableProduct || product.downloadFile) && (
        <Card title="Digital Product Information">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="Downloadable Product" value={product.downloadableProduct ? 'Yes' : 'No'} />
            <Field label="License Key Required" value={product.licenseKeyRequired ? 'Yes' : 'No'} />
            <Field label="Download Limit" value={product.downloadLimit} />
            <DocumentLink label="Download File" url={product.downloadFile} />
          </div>
        </Card>
      )}

      {(product.catalogBrochure || product.productManual || product.productDatasheet || product.complianceCertificate || product.warrantyDocument) && (
        <Card title="Documents">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <DocumentLink label="Catalog / Brochure" url={product.catalogBrochure} />
            <DocumentLink label="Product Manual" url={product.productManual} />
            <DocumentLink label="Datasheet" url={product.productDatasheet} />
            <DocumentLink label="Compliance Certificate" url={product.complianceCertificate} />
            <DocumentLink label="Warranty Document" url={product.warrantyDocument} />
          </div>
        </Card>
      )}

      <Card title="Variants" subtitle="Size, tax and pricing configuration for this product" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3" />
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
                    <td className="px-5 py-2">
                      {variant.imageUrl ? (
                        <img src={variant.imageUrl} alt={variant.size} className="size-9 rounded-lg border border-neutral-100 object-cover" />
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-300">
                          <Package className="size-4" aria-hidden="true" />
                        </div>
                      )}
                    </td>
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

      {batches.length > 0 && (
        <Card title="Batches" subtitle="Batch/expiry-tracked stock lots for this product" className="p-0" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Batch #</th>
                  <th className="whitespace-nowrap px-5 py-3">Warehouse</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Quantity</th>
                  <th className="whitespace-nowrap px-5 py-3">Expiry</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {batches.map((batch, index) => (
                  <tr key={batch.id || index}>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-neutral-800">{batch.batch_number || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{batch.warehouse_name || batch.warehouse?.name || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-neutral-600">{batch.quantity ?? batch.in_stock_quantity ?? 0}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{formatDateLabel(batch.expiry_date)}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge variant={batch.is_expired ? 'danger' : 'success'} dot>
                        {batch.is_expired ? 'Expired' : `${batch.days_to_expiry ?? '?'}d left`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {serials.length > 0 && (
        <Card title="Serial Numbers" subtitle="Individually tracked units for this product" className="p-0" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Serial Number</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3">Sold At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {serials.map((serial, index) => (
                  <tr key={serial.id || index}>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-neutral-800">{serial.serial_number}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge variant={serial.status === 'sold' ? 'neutral' : 'success'}>{serial.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{formatDateLabel(serial.sold_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Attachments"
        subtitle="Extra files attached to this product (up to 10)"
        action={
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3.5 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
            {isUploadingAttachment ? 'Uploading...' : <><Upload className="size-3.5" aria-hidden="true" />Upload</>}
            <input type="file" multiple className="sr-only" disabled={isUploadingAttachment || attachments.length >= 10} onChange={handleUploadAttachments} />
          </label>
        }
      >
        {attachmentError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{attachmentError}</div>
        )}
        {attachments.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">No attachments uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const attachmentId = attachment.id || attachment.file_id
              return (
                <div key={attachmentId} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
                  >
                    <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{attachment.name || attachment.filename || 'Attachment'}</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={deletingAttachmentId === attachmentId}
                    onClick={() => handleDeleteAttachment(attachmentId)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
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
