import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BadgeInfo,
  Boxes,
  ClipboardList,
  DollarSign,
  FileText,
  ImagePlus,
  Layers3,
  PackageCheck,
  Ruler,
  ShoppingBag,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { readImageAsDataUrl } from '../../utils/imageFile'

const MAX_TOTAL_IMAGES = 5

const emptyVariant = { size: '', sku: '', hsn: '', unit: 'Piece', gstRate: '', purchasePrice: '', sellingPrice: '', inventory: '' }

const emptyForm = {
  productId: '',
  productCode: '',
  barcode: '',
  name: '',
  shortName: '',
  productType: '',
  category: '',
  subCategory: '',
  brand: '',
  manufacturer: '',
  modelNumber: '',
  description: '',
  status: 'active',
  coverImage: '',
  images: [],
  videoUrl: '',
  videoFileName: '',
  catalogBrochureName: '',
  productManualName: '',
  purchasePrice: '',
  sellingPrice: '',
  mrp: '',
  wholesalePrice: '',
  dealerPrice: '',
  discountPercent: '',
  taxInclusivePrice: false,
  currency: 'INR',
  inventoryTracking: true,
  unitOfMeasure: 'Piece',
  openingStock: '',
  minimumStockLevel: '',
  maximumStockLevel: '',
  reorderLevel: '',
  reorderQuantity: '',
  binShelfLocation: '',
  batchTracking: false,
  serialNumberTracking: false,
  expiryTracking: false,
  taxCategory: '',
  gstVatRate: '',
  hsnSacCode: '',
  taxInclusive: false,
  preferredSupplier: '',
  supplierProductCode: '',
  leadTime: '',
  minimumOrderQuantity: '',
  purchaseUnit: '',
  salesUnit: '',
  commissionEligible: false,
  commissionPercent: '',
  defaultDiscount: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  volume: '',
  color: '',
  size: '',
  material: '',
  hasVariants: false,
  variantAttributes: '',
  variantSku: '',
  variantBarcode: '',
  variantPrice: '',
  downloadableProduct: false,
  downloadFileName: '',
  licenseKeyRequired: false,
  downloadLimit: '',
  warrantyPeriod: '',
  shelfLife: '',
  countryOfOrigin: '',
  launchDate: '',
  endOfLifeDate: '',
  productTags: '',
  notes: '',
  productDatasheetName: '',
  complianceCertificateName: '',
  warrantyDocumentName: '',
  otherAttachmentsName: '',
  variants: [{ ...emptyVariant }],
}

const options = {
  productType: ['Physical Product', 'Service', 'Digital Product', 'Raw Material', 'Finished Goods', 'Asset', 'Consumable'],
  category: ['Beverages', 'Food', 'Retail', 'Raw Material', 'Equipment', 'Services', 'Accessories'],
  subCategory: ['Standard', 'Premium', 'Bulk', 'Refill', 'Trial'],
  brand: ['In-house', 'AquaPure', 'FreshFlow', 'Vendor Brand'],
  manufacturer: ['In-house', 'Third-party', 'OEM'],
  status: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'discontinued', label: 'Discontinued' },
  ],
  currency: ['INR', 'USD', 'AED', 'SGD', 'GBP'],
  unitOfMeasure: ['Piece', 'Kg', 'Litre', 'Meter', 'Box', 'Bottle', 'Pack'],
  taxCategory: ['GST', 'VAT', 'Exempt', 'Zero Rated'],
  purchaseUnit: ['Piece', 'Kg', 'Litre', 'Box', 'Pack'],
  salesUnit: ['Piece', 'Kg', 'Litre', 'Box', 'Pack'],
  countryOfOrigin: ['India', 'United States', 'United Arab Emirates', 'Singapore', 'United Kingdom'],
}

const sectionMeta = {
  'Basic Information': { icon: BadgeInfo, description: 'Product identity, classification, and status.' },
  'Product Images & Media': { icon: ImagePlus, description: 'Images, video, catalog, and manual uploads.' },
  'Pricing Information': { icon: DollarSign, description: 'Purchase, selling, retail, discount, and currency details.' },
  'Inventory Information': { icon: Boxes, description: 'Stock tracking, UOM, levels, locations, and inventory controls.' },
  'Tax Information': { icon: ClipboardList, description: 'Tax category, rates, HSN/SAC, and inclusive tax settings.' },
  'Purchase Information': { icon: ShoppingBag, description: 'Supplier, purchase unit, lead time, and order quantities.' },
  'Sales Information': { icon: Tags, description: 'Sales unit, commission, and discount details.' },
  'Physical Specifications': { icon: Ruler, description: 'Weight, dimensions, color, size, and material.' },
  'Variants & Attributes': { icon: Layers3, description: 'Variant settings, attributes, SKU, barcode, and pricing.' },
  'Digital Product Information': { icon: PackageCheck, description: 'Downloadable product file and license settings.' },
  'Additional Information': { icon: FileText, description: 'Warranty, lifecycle, origin, tags, and internal notes.' },
  Documents: { icon: FileText, description: 'Datasheets, certificates, warranty documents, and attachments.' },
}

function toOptions(values = []) {
  return values.map((value) => (typeof value === 'string' ? { value, label: value } : value))
}

function section(title, fields) {
  const meta = sectionMeta[title] || {}

  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    title,
    description: meta.description || '',
    icon: meta.icon || BadgeInfo,
    fields,
  }
}

const productSections = [
  section('Basic Information', [
    { name: 'productId', label: 'Product ID', input: 'readonly', required: true },
    { name: 'productCode', label: 'Product Code / SKU', required: true, maxLength: 50 },
    { name: 'barcode', label: 'Barcode' },
    { name: 'name', label: 'Product Name', required: true, maxLength: 150 },
    { name: 'shortName', label: 'Short Name' },
    { name: 'productType', label: 'Product Type', input: 'select' },
    { name: 'category', label: 'Category', input: 'select', required: true },
    { name: 'subCategory', label: 'Sub Category', input: 'select' },
    { name: 'brand', label: 'Brand', input: 'select' },
    { name: 'manufacturer', label: 'Manufacturer', input: 'select' },
    { name: 'modelNumber', label: 'Model Number' },
    { name: 'status', label: 'Product Status', input: 'select', required: true },
    { name: 'description', label: 'Product Description', input: 'textarea', wide: true },
  ]),
  section('Product Images & Media', [
    { name: 'coverImage', label: 'Primary Product Image', input: 'image', required: true },
    { name: 'images', label: 'Additional Images', input: 'multiImage' },
    { name: 'videoUrl', label: 'Product Video', input: 'video', wide: true },
    { name: 'catalogBrochureName', label: 'Product Catalog/Brochure', input: 'file', accept: '.pdf' },
    { name: 'productManualName', label: 'Product Manual', input: 'file', accept: '.pdf' },
  ]),
  section('Pricing Information', [
    { name: 'purchasePrice', label: 'Purchase Price', input: 'number', required: true },
    { name: 'sellingPrice', label: 'Selling Price', input: 'number', required: true },
    { name: 'mrp', label: 'MSRP/MRP', input: 'number' },
    { name: 'wholesalePrice', label: 'Wholesale Price', input: 'number' },
    { name: 'dealerPrice', label: 'Dealer Price', input: 'number' },
    { name: 'discountPercent', label: 'Discount (%)', input: 'number' },
    { name: 'taxInclusivePrice', label: 'Tax Inclusive Price', input: 'checkbox' },
    { name: 'currency', label: 'Currency', input: 'select' },
  ]),
  section('Inventory Information', [
    { name: 'unitOfMeasure', label: 'Unit of Measure (UOM)', input: 'select', required: true },
    { name: 'inventoryTracking', label: 'Inventory Tracking', input: 'checkbox', required: true },
    { name: 'openingStock', label: 'Opening Stock', input: 'number' },
    { name: 'minimumStockLevel', label: 'Minimum Stock Level', input: 'number' },
    { name: 'maximumStockLevel', label: 'Maximum Stock Level', input: 'number' },
    { name: 'reorderLevel', label: 'Reorder Level', input: 'number' },
    { name: 'reorderQuantity', label: 'Reorder Quantity', input: 'number' },
    { name: 'binShelfLocation', label: 'Bin/Shelf Location' },
    { name: 'batchTracking', label: 'Batch Tracking', input: 'checkbox' },
    { name: 'serialNumberTracking', label: 'Serial Number Tracking', input: 'checkbox' },
    { name: 'expiryTracking', label: 'Expiry Tracking', input: 'checkbox' },
  ]),
  section('Tax Information', [
    { name: 'taxCategory', label: 'Tax Category', input: 'select' },
    { name: 'gstVatRate', label: 'GST/VAT Rate', input: 'number' },
    { name: 'hsnSacCode', label: 'HSN/SAC Code' },
    { name: 'taxInclusive', label: 'Tax Inclusive', input: 'checkbox' },
  ]),
  section('Purchase Information', [
    { name: 'preferredSupplier', label: 'Preferred Supplier' },
    { name: 'supplierProductCode', label: 'Supplier Product Code' },
    { name: 'leadTime', label: 'Lead Time', input: 'number' },
    { name: 'minimumOrderQuantity', label: 'Minimum Order Quantity', input: 'number' },
    { name: 'purchaseUnit', label: 'Purchase Unit', input: 'select' },
  ]),
  section('Sales Information', [
    { name: 'salesUnit', label: 'Sales Unit', input: 'select' },
    { name: 'commissionPercent', label: 'Commission (%)', input: 'number' },
    { name: 'defaultDiscount', label: 'Default Discount', input: 'number' },
    { name: 'commissionEligible', label: 'Commission Eligible', input: 'checkbox' },
  ]),
  section('Physical Specifications', [
    { name: 'weight', label: 'Weight', input: 'number' },
    { name: 'length', label: 'Length', input: 'number' },
    { name: 'width', label: 'Width', input: 'number' },
    { name: 'height', label: 'Height', input: 'number' },
    { name: 'volume', label: 'Volume', input: 'number' },
    { name: 'color', label: 'Color' },
    { name: 'size', label: 'Size' },
    { name: 'material', label: 'Material' },
  ]),
  section('Variants & Attributes', [
    { name: 'variantAttributes', label: 'Variant Attributes' },
    { name: 'variantSku', label: 'Variant SKU' },
    { name: 'variantBarcode', label: 'Variant Barcode' },
    { name: 'variantPrice', label: 'Variant Price', input: 'number' },
    { name: 'hasVariants', label: 'Has Variants', input: 'checkbox' },
  ]),
  section('Digital Product Information', [
    { name: 'downloadableProduct', label: 'Downloadable Product', input: 'checkbox' },
    { name: 'licenseKeyRequired', label: 'License Key Required', input: 'checkbox' },
    { name: 'downloadLimit', label: 'Download Limit', input: 'number' },
    { name: 'downloadFileName', label: 'Download File', input: 'compactFile', accept: '.zip,.pdf,image/*' },
  ]),
  section('Additional Information', [
    { name: 'warrantyPeriod', label: 'Warranty Period' },
    { name: 'shelfLife', label: 'Shelf Life' },
    { name: 'countryOfOrigin', label: 'Country of Origin', input: 'select' },
    { name: 'launchDate', label: 'Launch Date', input: 'date' },
    { name: 'endOfLifeDate', label: 'End of Life Date', input: 'date' },
    { name: 'productTags', label: 'Product Tags' },
    { name: 'notes', label: 'Notes' },
  ]),
  section('Documents', [
    { name: 'productDatasheetName', label: 'Product Datasheet', input: 'file', accept: '.pdf' },
    { name: 'complianceCertificateName', label: 'Compliance Certificate', input: 'file', accept: '.pdf' },
    { name: 'warrantyDocumentName', label: 'Warranty Document', input: 'file', accept: '.pdf' },
    { name: 'otherAttachmentsName', label: 'Other Attachments', input: 'file', accept: '.pdf,.docx,.png,.jpg,.jpeg', multiple: true },
  ]),
]

function makeProductId() {
  return `PROD-${new Date().getFullYear()}-AUTO`
}

function hydrateProduct(product) {
  const firstVariant = product?.variants?.[0] || {}
  const productCode = product?.productCode || product?.sku || firstVariant.sku || ''

  return {
    ...emptyForm,
    ...product,
    productId: product?.productId || product?.id || makeProductId(),
    productCode,
    category: product?.category || product?.categoryId || '',
    productType: product?.productType || product?.category || '',
    purchasePrice: product?.purchasePrice ?? firstVariant.purchasePrice ?? '',
    sellingPrice: product?.sellingPrice ?? firstVariant.sellingPrice ?? '',
    unitOfMeasure: product?.unitOfMeasure || firstVariant.unit || 'Piece',
    openingStock: product?.openingStock ?? firstVariant.inventory ?? '',
    hsnSacCode: product?.hsnSacCode || firstVariant.hsn || '',
    gstVatRate: product?.gstVatRate ?? firstVariant.gstRate ?? '',
    coverImage: product?.coverImage || '',
    images: product?.images || [],
    status: product?.status || 'active',
    variants: product?.variants?.length ? product.variants.map((variant) => ({ ...emptyVariant, ...variant })) : [{ ...emptyVariant }],
  }
}

function ProductUploadField({ field, value, onChange, onRemove }) {
  return (
    <div className="flex min-h-28 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(10rem,1fr)_auto_auto] xl:items-center">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold leading-5 text-neutral-900">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </p>
          {value && <p className="mt-1 truncate text-xs font-medium text-primary-700">{value}</p>}
        </div>
        <button
          type="button"
          className="flex h-16 min-w-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-400"
          style={{ cursor: 'pointer' }}
        >
          Preview
        </button>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
            <Upload className="size-3.5" aria-hidden="true" />
            Upload
            <input
              type="file"
              multiple={field.multiple}
              accept={field.accept || '.pdf,.docx,.png,.jpg,.jpeg,.webp'}
              className="sr-only"
              onChange={(event) => {
                const fileNames = Array.from(event.target.files || []).map((file) => file.name).join(', ')
                onChange(fileNames)
                event.target.value = ''
              }}
            />
          </label>
          <Button type="button" variant="outline" size="sm" className="h-8 w-24 rounded-full px-3 text-xs" disabled={!value} onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ProductForm({ isOpen, onClose, product, onSave, saving = false, formError = '' }) {
  const [formData, setFormData] = useState(emptyForm)
  const [initialFormData, setInitialFormData] = useState(emptyForm)
  const [activeSection, setActiveSection] = useState(productSections[0].id)
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState('')

  const activeFormSection = useMemo(
    () => productSections.find((sectionItem) => sectionItem.id === activeSection) || productSections[0],
    [activeSection],
  )
  const activeSectionIndex = productSections.findIndex((sectionItem) => sectionItem.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === productSections.length - 1
  const hasChanges = !product || JSON.stringify(formData) !== JSON.stringify(initialFormData)
  const totalImageCount = (formData.coverImage ? 1 : 0) + formData.images.length

  useEffect(() => {
    if (!isOpen) return

    const nextForm = hydrateProduct(product)
    setFormData(nextForm)
    setInitialFormData(nextForm)
    setActiveSection(productSections[0].id)
    setErrors({})
    setImageError('')
  }, [product, isOpen])

  if (!isOpen) return null

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.name.trim()) nextErrors.name = 'Product name is required.'
    if (formData.name.trim().length > 150) nextErrors.name = 'Product name must be 150 characters or fewer.'
    if (!formData.productCode.trim()) nextErrors.productCode = 'Product code / SKU is required.'
    if (!formData.category) nextErrors.category = 'Category is required.'
    if (!formData.status) nextErrors.status = 'Status is required.'
    if (Number(formData.purchasePrice) < 0) nextErrors.purchasePrice = 'Purchase price cannot be negative.'
    if (!formData.purchasePrice && formData.purchasePrice !== 0) nextErrors.purchasePrice = 'Purchase price is required.'
    if (Number(formData.sellingPrice) < 0) nextErrors.sellingPrice = 'Selling price cannot be negative.'
    if (!formData.sellingPrice && formData.sellingPrice !== 0) nextErrors.sellingPrice = 'Selling price is required.'
    if (formData.inventoryTracking && !formData.unitOfMeasure) nextErrors.unitOfMeasure = 'UOM is required for inventory-managed products.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCoverImageChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImageError('')

    try {
      const dataUrl = await readImageAsDataUrl(file)
      updateField('coverImage', dataUrl)
    } catch (error) {
      setImageError(error.message)
    }
  }

  const handleAdditionalImagesChange = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setImageError('')

    const remainingSlots = MAX_TOTAL_IMAGES - totalImageCount
    if (remainingSlots <= 0) {
      setImageError(`You can upload up to ${MAX_TOTAL_IMAGES} images per product.`)
      return
    }

    const filesToRead = files.slice(0, remainingSlots)
    if (files.length > remainingSlots) {
      setImageError(`Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added.`)
    }

    const results = await Promise.allSettled(filesToRead.map((file) => readImageAsDataUrl(file)))
    const nextImages = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
    const failure = results.find((result) => result.status === 'rejected')

    if (nextImages.length > 0) {
      updateField('images', [...formData.images, ...nextImages])
    }

    if (failure) {
      setImageError(failure.reason.message)
    }
  }

  const removeImage = (index) => {
    updateField('images', formData.images.filter((_, imageIndex) => imageIndex !== index))
  }

  const syncVariants = (nextData) => {
    const nextVariant = {
      ...emptyVariant,
      ...nextData.variants[0],
      sku: nextData.productCode,
      hsn: nextData.hsnSacCode,
      unit: nextData.unitOfMeasure,
      gstRate: nextData.gstVatRate,
      purchasePrice: nextData.purchasePrice,
      sellingPrice: nextData.sellingPrice,
      inventory: nextData.openingStock,
    }

    return { ...nextData, variants: [nextVariant] }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    const syncedData = syncVariants(formData)

    onSave({
      ...syncedData,
      sku: syncedData.productCode.trim(),
      name: syncedData.name.trim(),
      brand: syncedData.brand,
      category: syncedData.category,
      categoryId: syncedData.category,
      productType: syncedData.productType || syncedData.category,
      price: Number(syncedData.sellingPrice) || 0,
      totalInventory: Number(syncedData.openingStock) || 0,
      isActive: syncedData.status === 'active',
      variants: syncedData.variants.map((variant) => ({
        ...variant,
        size: variant.size || syncedData.unitOfMeasure || 'Default',
        sku: variant.sku || syncedData.productCode,
        hsn: variant.hsn || syncedData.hsnSacCode,
        unit: variant.unit || syncedData.unitOfMeasure,
        gstRate: Number(variant.gstRate) || 0,
        purchasePrice: Number(variant.purchasePrice) || 0,
        sellingPrice: Number(variant.sellingPrice) || 0,
        inventory: Number(variant.inventory) || 0,
      })),
    })
  }

  const goToPreviousSection = () => {
    if (isFirstSection) return
    setActiveSection(productSections[activeSectionIndex - 1].id)
  }

  const goToNextSection = () => {
    if (isLastSection) return
    setActiveSection(productSections[activeSectionIndex + 1].id)
  }

  const renderField = (field) => {
    const commonProps = {
      label: field.label,
      value: formData[field.name] ?? '',
      onChange: (event) => updateField(field.name, event.target.value),
      error: errors[field.name],
      required: field.required,
      maxLength: field.maxLength,
    }

    if (field.input === 'select') {
      return (
        <Select
          {...commonProps}
          className="w-full max-w-full"
          triggerClassName="w-full max-w-full"
          options={toOptions(options[field.name] || [])}
          placeholder={`Select ${field.label.toLowerCase()}`}
        />
      )
    }

    if (field.input === 'textarea') {
      return <Input {...commonProps} as="textarea" />
    }

    if (field.input === 'checkbox') {
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-transparent select-none" aria-hidden="true">
            {field.label}
          </span>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={Boolean(formData[field.name])}
              onChange={(event) => updateField(field.name, event.target.checked)}
              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
            />
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>
        </div>
      )
    }

    if (field.input === 'readonly') {
      return <Input label={field.label} value={formData[field.name] || makeProductId()} readOnly disabled error={errors[field.name]} required={field.required} />
    }

    if (field.input === 'file') {
      return (
        <ProductUploadField
          field={field}
          value={formData[field.name]}
          onChange={(value) => updateField(field.name, value)}
          onRemove={() => updateField(field.name, '')}
        />
      )
    }

    if (field.input === 'compactFile') {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">{field.label}</label>
          <div className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2">
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium text-neutral-400"
              style={{ cursor: 'pointer' }}
            >
              {formData[field.name] || 'Preview'}
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-3.5" aria-hidden="true" />
                Upload
                <input
                  type="file"
                  multiple={field.multiple}
                  accept={field.accept || '.zip,.pdf,image/*'}
                  className="sr-only"
                  onChange={(event) => {
                    const fileNames = Array.from(event.target.files || []).map((file) => file.name).join(', ')
                    updateField(field.name, fileNames)
                    event.target.value = ''
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-24 rounded-full px-3 text-xs"
                disabled={!formData[field.name]}
                onClick={() => updateField(field.name, '')}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (field.input === 'video') {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">{field.label}</label>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <Input
              value={formData.videoUrl}
              type="url"
              placeholder="Paste video URL"
              onChange={(event) => updateField('videoUrl', event.target.value)}
              error={errors.videoUrl}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 w-28 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-sm font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-4" aria-hidden="true" />
                Upload
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/*"
                  className="sr-only"
                  onChange={(event) => {
                    const fileName = event.target.files?.[0]?.name || ''
                    updateField('videoFileName', fileName)
                    event.target.value = ''
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-28 rounded-full px-3 text-sm"
                disabled={!formData.videoFileName}
                onClick={() => updateField('videoFileName', '')}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
          {formData.videoFileName && (
            <p className="truncate text-xs font-medium text-primary-700">{formData.videoFileName}</p>
          )}
        </div>
      )
    }

    if (field.input === 'image') {
      return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4" style={{ minHeight: '13rem' }}>
          <div className="flex h-full flex-col gap-3">
            <div className="min-h-10 min-w-0">
              <p className="text-sm font-semibold leading-5 text-neutral-900">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </p>
              <p className="mt-1 text-xs font-medium text-neutral-400">PNG, JPG, JPEG, or WebP</p>
            </div>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-400"
              style={{ height: '4.75rem', cursor: 'pointer' }}
            >
              {formData.coverImage ? (
                <img src={formData.coverImage} alt="Primary product" className="h-full w-full object-cover" />
              ) : (
                'Preview'
              )}
            </button>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-3.5" aria-hidden="true" />
                Upload
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleCoverImageChange} />
              </label>
              <Button type="button" variant="outline" size="sm" className="h-8 w-24 rounded-full px-3 text-xs" disabled={!formData.coverImage} onClick={() => updateField('coverImage', '')}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (field.input === 'multiImage') {
      return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4" style={{ minHeight: '13rem' }}>
          <div className="flex h-full flex-col gap-3">
            <div className="min-h-10 min-w-0">
              <p className="text-sm font-semibold leading-5 text-neutral-900">{field.label}</p>
              <p className="mt-1 text-xs font-medium text-neutral-400">Up to {MAX_TOTAL_IMAGES} total images</p>
            </div>
            {formData.images.length > 0 ? (
              <div
                className="flex w-full cursor-pointer items-center rounded-lg border border-dashed border-neutral-200 bg-white p-2"
                style={{ height: '4.75rem', cursor: 'pointer' }}
              >
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((image, index) => (
                    <div key={image} className="relative">
                      <img src={image} alt={`Additional product ${index + 1}`} className="size-12 rounded-lg border border-neutral-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label="Remove additional image"
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-neutral-500 shadow-(--shadow-xs) ring-1 ring-neutral-200 hover:text-red-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-lg border border-dashed border-neutral-200 bg-white p-2"
                style={{ height: '4.75rem', cursor: 'pointer' }}
              >
                <span className="mx-auto text-xs font-medium text-neutral-400">Preview</span>
              </button>
            )}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <ImagePlus className="size-3.5" aria-hidden="true" />
                Add
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple className="sr-only" onChange={handleAdditionalImagesChange} />
              </label>
              <Button type="button" variant="outline" size="sm" className="h-8 w-24 rounded-full px-3 text-xs" disabled={formData.images.length === 0} onClick={() => updateField('images', [])}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Input
        {...commonProps}
        type={field.input === 'number' ? 'number' : field.input === 'date' ? 'date' : field.input === 'url' ? 'url' : 'text'}
        min={field.input === 'number' ? '0' : undefined}
        step={field.input === 'number' ? '0.01' : undefined}
      />
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white shadow-(--shadow-card)"
    >
      <div className="grid min-h-[34rem]" style={{ gridTemplateColumns: '17rem minmax(0, 1fr)' }}>
        <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <nav className="sticky top-6 flex flex-col gap-3">
            {productSections.map((sectionItem) => {
              const Icon = sectionItem.icon
              const isActive = sectionItem.id === activeSection

              return (
                <button
                  key={sectionItem.id}
                  type="button"
                  onClick={() => setActiveSection(sectionItem.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-primary-700 shadow-(--shadow-xs) ring-1 ring-neutral-200'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{sectionItem.title}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{activeFormSection.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeFormSection.description}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Back to Products
            </Button>
          </div>

          {(formError || imageError) && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError || imageError}
            </div>
          )}

          <section className="border-b border-neutral-100 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeFormSection.fields.map((field) => (
                <Fragment key={field.name}>
                  <div className={`min-w-0 ${field.wide ? 'lg:col-span-2' : ''}`}>
                    {renderField(field)}
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={goToPreviousSection} disabled={saving || isFirstSection}>
              Back
            </Button>
            {isLastSection ? (
              <Button type="submit" loading={saving} disabled={!hasChanges}>
                {product ? 'Save Changes' : 'Add Product'}
              </Button>
            ) : (
              <Button type="button" onClick={goToNextSection} disabled={saving}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
