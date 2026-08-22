import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BadgeInfo,
  Barcode,
  Boxes,
  ClipboardList,
  DollarSign,
  FileText,
  ImagePlus,
  Layers3,
  PackageCheck,
  Plus,
  Ruler,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { listCategories } from '../../api/categories'
import { listBrands } from '../../api/brands'
import { listSuppliers } from '../../api/suppliers'
import { mapProductBackendField } from '../../api/products'
import { readImageAsDataUrl } from '../../utils/imageFile'
import { uploadFile } from '../../api/files'

const MAX_TOTAL_IMAGES = 5

const emptyVariantInventory = {
  openingStock: '',
  minimumStockLevel: '',
  maximumStockLevel: '',
  reorderLevel: '',
  reorderQuantity: '',
}

function makeVariantId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function makeEmptyVariant(overrides = {}) {
  return {
    size: '',
    sku: '',
    hsn: '',
    unit: 'Piece',
    gstRate: '',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    imageUrl: '',
    inventory: { ...emptyVariantInventory },
    ...overrides,
    id: overrides.id || makeVariantId(),
  }
}

const emptyForm = {
  productId: '',
  productCode: '',
  barcode: '',
  name: '',
  shortName: '',
  productType: '',
  category: '',
  subCategory: '',
  subCategoryId: '',
  brand: '',
  brandId: '',
  manufacturer: '',
  modelNumber: '',
  description: '',
  status: 'active',
  coverImage: '',
  images: [],
  videoUrl: '',
  videoFileName: '',
  catalogBrochure: '',
  productManual: '',
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
  preferredSupplierId: '',
  supplierProductCode: '',
  leadTime: '',
  minimumOrderQuantity: '',
  purchaseUnit: '',
  salesUnit: '',
  commissionEligible: false,
  commissionPercent: '',
  defaultDiscount: '',
  weight: '',
  weightUnit: 'kg',
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
  downloadFile: '',
  licenseKeyRequired: false,
  downloadLimit: '',
  warrantyPeriod: '',
  warrantyPeriodUnit: 'months',
  shelfLife: '',
  shelfLifeUnit: 'months',
  countryOfOrigin: '',
  launchDate: '',
  endOfLifeDate: '',
  productTags: '',
  notes: '',
  productDatasheet: '',
  complianceCertificate: '',
  warrantyDocument: '',
  otherAttachmentsName: '',
  variants: [],
}

const options = {
  status: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'discontinued', label: 'Discontinued' },
  ],
  weightUnit: [
    { value: 'kg', label: 'kg' },
    { value: 'g', label: 'g' },
    { value: 'lb', label: 'lb' },
    { value: 'oz', label: 'oz' },
  ],
  durationUnit: [
    { value: 'days', label: 'Days' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' },
  ],
}

const sectionMeta = {
  'Basic Information': { icon: BadgeInfo, description: 'Product identity, classification, and status.' },
  'Product Images & Media': { icon: ImagePlus, description: 'Images, video, catalog, and manual uploads.' },
  'Pricing Information': { icon: DollarSign, description: 'Purchase, selling, retail, discount, and currency details.' },
  'Inventory Information': { icon: Boxes, description: 'Stock tracking, UOM, levels, locations, and inventory controls.' },
  'Tax Information': { icon: ClipboardList, description: 'Tax category, rates, HSN/SAC, and inclusive tax settings.' },
  'Purchase Information': { icon: ShoppingBag, description: 'Supplier, purchase unit, lead time, and order quantities.' },
  'Variants & Attributes': { icon: Layers3, description: 'Variant settings, attributes, SKU, barcode, and pricing.' },
  'Physical Specifications': { icon: Ruler, description: 'Weight, dimensions, color, size, and material.' },
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

function findSectionForErrorField(sections, fieldName) {
  if (fieldName.startsWith('variantInventory.')) {
    return sections.find((sectionItem) => sectionItem.id === 'variants-attributes')
  }

  return sections.find((sectionItem) => sectionItem.fields.some((field) => field.name === fieldName))
}

const productSections = [
  section('Basic Information', [
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
    { name: 'catalogBrochure', label: 'Product Catalog/Brochure', input: 'file', accept: '.pdf' },
    { name: 'productManual', label: 'Product Manual', input: 'file', accept: '.pdf' },
  ]),
  section('Variants & Attributes', [
    {
      name: 'variantAttributes',
      label: 'Attribute Types',
      placeholder: 'e.g. Color, Size',
      wide: true,
    },
    { name: 'variants', label: 'Variants', input: 'variants', wide: true },
  ]),
  section('Inventory Information', [
    { name: 'unitOfMeasure', label: 'Unit of Measure (UOM)', input: 'select', required: true },
    { name: 'variantInventory', label: 'Variant Inventory', input: 'variantInventory', wide: true },
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
  section('Tax Information', [
    { name: 'taxCategory', label: 'Tax Category', input: 'select' },
    { name: 'gstVatRate', label: 'GST/VAT Rate', input: 'number' },
    { name: 'hsnSacCode', label: 'HSN/SAC Code' },
    { name: 'taxInclusive', label: 'Tax Inclusive', input: 'checkbox' },
  ]),
  section('Purchase Information', [
    { name: 'preferredSupplier', label: 'Preferred Supplier', input: 'select' },
    { name: 'supplierProductCode', label: 'Supplier Product Code' },
    { name: 'leadTime', label: 'Lead Time', placeholder: 'e.g. 7 days' },
    { name: 'minimumOrderQuantity', label: 'Minimum Order Quantity', input: 'number' },
    { name: 'purchaseUnit', label: 'Purchase Unit', input: 'select' },
  ]),
  section('Physical Specifications', [
    { name: 'weight', label: 'Weight', input: 'number' },
    { name: 'weightUnit', label: 'Weight Unit', input: 'select' },
    { name: 'length', label: 'Length', input: 'number' },
    { name: 'width', label: 'Width', input: 'number' },
    { name: 'height', label: 'Height', input: 'number' },
    { name: 'volume', label: 'Volume', input: 'number' },
    { name: 'color', label: 'Color' },
    { name: 'size', label: 'Size' },
    { name: 'material', label: 'Material' },
  ]),
  section('Digital Product Information', [
    { name: 'downloadableProduct', label: 'Downloadable Product', input: 'checkbox' },
    { name: 'licenseKeyRequired', label: 'License Key Required', input: 'checkbox' },
    { name: 'downloadLimit', label: 'Download Limit', input: 'number' },
    { name: 'downloadFile', label: 'Download File', input: 'compactFile', accept: '.zip,.pdf,image/*' },
  ]),
  section('Additional Information', [
    { name: 'warrantyPeriod', label: 'Warranty Period' },
    { name: 'warrantyPeriodUnit', label: 'Warranty Period Unit', input: 'select' },
    { name: 'shelfLife', label: 'Shelf Life' },
    { name: 'shelfLifeUnit', label: 'Shelf Life Unit', input: 'select' },
    { name: 'countryOfOrigin', label: 'Country of Origin', input: 'select' },
    { name: 'launchDate', label: 'Launch Date', input: 'date' },
    { name: 'endOfLifeDate', label: 'End of Life Date', input: 'date' },
    { name: 'productTags', label: 'Product Tags', placeholder: 'e.g. bestseller, new' },
    { name: 'notes', label: 'Notes' },
  ]),
  section('Documents', [
    { name: 'productDatasheet', label: 'Product Datasheet', input: 'file', accept: '.pdf' },
    { name: 'complianceCertificate', label: 'Compliance Certificate', input: 'file', accept: '.pdf' },
    { name: 'warrantyDocument', label: 'Warranty Document', input: 'file', accept: '.pdf' },
    { name: 'otherAttachmentsName', label: 'Other Attachments', input: 'file', accept: '.pdf,.docx,.png,.jpg,.jpeg', multiple: true },
  ]),
]

function makeProductId() {
  return `PROD-${new Date().getFullYear()}-AUTO`
}

function normalizeVariantInventory(variant = {}, fallbackOpeningStock = '') {
  const inventory = variant.inventory && typeof variant.inventory === 'object' ? variant.inventory : {}

  return {
    ...emptyVariantInventory,
    ...inventory,
    openingStock: inventory.openingStock ?? variant.inventory ?? variant.stock ?? fallbackOpeningStock ?? '',
    minimumStockLevel: inventory.minimumStockLevel ?? variant.minimumStockLevel ?? variant.minimum_stock_level ?? '',
    maximumStockLevel: inventory.maximumStockLevel ?? variant.maximumStockLevel ?? variant.maximum_stock_level ?? '',
    reorderLevel: inventory.reorderLevel ?? variant.reorderLevel ?? variant.reorder_level ?? '',
    reorderQuantity: inventory.reorderQuantity ?? variant.reorderQuantity ?? variant.reorder_quantity ?? '',
  }
}

function getVariantName(variant, index) {
  return variant.size || variant.name || variant.sku || `Variant ${index + 1}`
}

function getVariantInventoryNumber(variant, field) {
  const inventory = normalizeVariantInventory(variant)
  return Number(inventory[field]) || 0
}

function hydrateProduct(product) {
  const firstVariant = product?.variants?.[0] || {}
  const productCode = product?.productCode || product?.sku || firstVariant.sku || ''
  const firstVariantInventory = normalizeVariantInventory(firstVariant)

  return {
    ...emptyForm,
    ...product,
    productId: product?.productId || product?.id || makeProductId(),
    productCode,
    category: String(product?.category_id || product?.categoryId || product?.category || ''),
    categoryId: String(product?.category_id || product?.categoryId || ''),
    productType: product?.productType || product?.category || '',
    purchasePrice: product?.purchasePrice ?? firstVariant.purchasePrice ?? '',
    sellingPrice: product?.sellingPrice ?? firstVariant.sellingPrice ?? '',
    unitOfMeasure: product?.unitOfMeasure || firstVariant.unit || 'Piece',
    openingStock: product?.openingStock ?? firstVariantInventory.openingStock ?? '',
    hsnSacCode: product?.hsnSacCode || firstVariant.hsn || '',
    gstVatRate: product?.gstVatRate ?? firstVariant.gstRate ?? '',
    coverImage: product?.coverImage || '',
    images: product?.images || [],
    status: product?.statusValue || product?.status || 'active',
    variants: product?.variants?.length
      ? product.variants.map((variant, index) => ({
        ...makeEmptyVariant(),
        ...variant,
        id: variant.id || variant.variantId || variant.variant_id || `${product?.id || productCode || 'product'}-${index + 1}`,
        sellingPrice: variant.sellingPrice ?? variant.price ?? '',
        mrp: variant.mrp ?? '',
        inventory: normalizeVariantInventory(variant, index === 0 ? product?.openingStock : ''),
      }))
      : [],
  }
}

function ProductUploadField({ field, value, isUploading, onFileSelected, onRemove }) {
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
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex h-16 min-w-28 items-center justify-center rounded-lg border border-dashed border-primary-200 bg-white px-3 text-xs font-medium text-primary-600"
          >
            Preview
          </a>
        ) : (
          <span className="flex h-16 min-w-28 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-400">
            {isUploading ? 'Uploading...' : 'No file'}
          </span>
        )}
        <div className="flex shrink-0 flex-col items-start gap-2">
          <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
            <Upload className="size-3.5" aria-hidden="true" />
            {isUploading ? 'Uploading' : 'Upload'}
            <input
              type="file"
              accept={field.accept || '.pdf,.docx,.png,.jpg,.jpeg,.webp'}
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onFileSelected(file)
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

export default function ProductForm({
  isOpen,
  onClose,
  product,
  onSave,
  saving = false,
  formError = '',
  formErrorFields = [],
  catalogProducts = [],
}) {
  const [formData, setFormData] = useState(emptyForm)
  const [initialFormData, setInitialFormData] = useState(emptyForm)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [subCategoryOptionsAll, setSubCategoryOptionsAll] = useState([])
  const [brandOptions, setBrandOptions] = useState([])
  const [supplierOptions, setSupplierOptions] = useState([])
  const [activeSection, setActiveSection] = useState(productSections[0].id)
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState('')
  const [uploadingFields, setUploadingFields] = useState({})
  const [documentUploadError, setDocumentUploadError] = useState('')
  const [validationBanner, setValidationBanner] = useState('')

  const activeFormSection = useMemo(
    () => productSections.find((sectionItem) => sectionItem.id === activeSection) || productSections[0],
    [activeSection],
  )
  const activeSectionIndex = productSections.findIndex((sectionItem) => sectionItem.id === activeSection)
  const isFirstSection = activeSectionIndex <= 0
  const isLastSection = activeSectionIndex === productSections.length - 1
  const hasChanges = !product || JSON.stringify(formData) !== JSON.stringify(initialFormData)
  const totalImageCount = (formData.coverImage ? 1 : 0) + formData.images.length
  const suggestionOptions = useMemo(() => {
    const collect = (...groups) =>
      Array.from(
        new Set(
          groups
            .flat()
            .map((value) => String(value ?? '').trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value }))

    return {
      productType: collect(catalogProducts.map((item) => item.productType || item.categoryLabel || item.category)),
      subCategory: collect(catalogProducts.map((item) => item.subCategory)),
      brand: collect(catalogProducts.map((item) => item.brand)),
      manufacturer: collect(catalogProducts.map((item) => item.manufacturer)),
      unitOfMeasure: collect(
        catalogProducts.flatMap((item) => [item.unitOfMeasure, ...(item.variants || []).map((variant) => variant.unit)]),
      ),
      taxCategory: collect(catalogProducts.map((item) => item.taxCategory)),
      purchaseUnit: collect(catalogProducts.map((item) => item.purchaseUnit)),
      salesUnit: collect(catalogProducts.map((item) => item.salesUnit)),
      currency: collect(catalogProducts.map((item) => item.currency)),
      countryOfOrigin: collect(catalogProducts.map((item) => item.countryOfOrigin)),
    }
  }, [catalogProducts])

  useEffect(() => {
    if (!isOpen) return

    const nextForm = hydrateProduct(product)
    setFormData(nextForm)
    setInitialFormData(nextForm)
    setActiveSection(productSections[0].id)
    setErrors({})
    setImageError('')
  }, [product, isOpen])

  useEffect(() => {
    if (!isOpen) return

    Promise.all([listCategories(), listBrands(), listSuppliers()]).then(([categoriesResult, brandsResult, suppliersResult]) => {
      if (categoriesResult.success) {
        const allCategories = categoriesResult.categories
          .map((category) => ({
            value: String(category.id),
            label: category.name || category.category_name || '',
            parentId: category.parent_id || category.parentId || '',
          }))
          .filter((option) => option.value && option.label)

        setCategoryOptions(allCategories.filter((option) => !option.parentId))
        setSubCategoryOptionsAll(allCategories)
      }

      if (brandsResult.success) {
        setBrandOptions(
          brandsResult.brands
            .map((brand) => ({ value: String(brand.id), label: brand.name || '' }))
            .filter((option) => option.value && option.label),
        )
      }

      if (suppliersResult.success) {
        setSupplierOptions(
          suppliersResult.suppliers
            .map((supplier) => ({ value: String(supplier.id), label: supplier.name || supplier.supplier_name || '' }))
            .filter((option) => option.value && option.label),
        )
      }
    })
  }, [isOpen])

  const subCategoryOptions = useMemo(
    () => subCategoryOptionsAll.filter((option) => option.parentId === formData.category),
    [subCategoryOptionsAll, formData.category],
  )

  useEffect(() => {
    if (!categoryOptions.length || !formData.category) return
    if (categoryOptions.some((option) => option.value === formData.category)) return

    const match = categoryOptions.find(
      (option) => option.label.trim().toLowerCase() === String(formData.category).trim().toLowerCase(),
    )

    if (!match) return

    setFormData((current) => ({
      ...current,
      category: match.value,
      categoryId: match.value,
    }))
  }, [categoryOptions, formData.category])

  // Server-side validation errors (e.g. a 422 on save) carry the same weight as the client-side
  // ones handleSubmit already jumps to a tab for - just sourced from the backend's field names
  // instead of the local validate() function.
  useEffect(() => {
    if (!formErrorFields || formErrorFields.length === 0) return

    const mappedFieldName = formErrorFields.map(mapProductBackendField).find(Boolean)
    if (!mappedFieldName) return

    const sectionWithError = findSectionForErrorField(productSections, mappedFieldName)
    if (sectionWithError) setActiveSection(sectionWithError.id)
  }, [formErrorFields])

  if (!isOpen) return null

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  // Uploads immediately via the universal file endpoint (no product id required) and stores
  // the real URL, so it's part of the form payload the same way coverImage/images already are -
  // no more filename-only fields that quietly never reach the backend.
  const handleDocumentUpload = async (field, file) => {
    if (!file) return

    setDocumentUploadError('')
    setUploadingFields((current) => ({ ...current, [field]: true }))

    const result = await uploadFile(file)

    setUploadingFields((current) => ({ ...current, [field]: false }))

    if (!result.success) {
      setDocumentUploadError(result.error)
      return
    }

    updateField(field, result.file.url)
  }

  // Same immediate upload-then-store pattern as handleDocumentUpload, just writing into a
  // variant's own imageUrl instead of a top-level field - works identically whether the product
  // is new or already saved, since the image only rides along inside `variations` on Save.
  const handleVariantImageUpload = async (index, file) => {
    if (!file) return

    const fieldKey = `variantImage-${index}`
    setDocumentUploadError('')
    setUploadingFields((current) => ({ ...current, [fieldKey]: true }))

    const result = await uploadFile(file)

    setUploadingFields((current) => ({ ...current, [fieldKey]: false }))

    if (!result.success) {
      setDocumentUploadError(result.error)
      return
    }

    updateVariant(index, 'imageUrl', result.file.url)
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
    formData.variants.forEach((variant, index) => {
      const inventory = normalizeVariantInventory(variant, index === 0 ? formData.openingStock : '')
      const variantLabel = getVariantName(variant, index)

      Object.entries(inventory).forEach(([field, value]) => {
        if (value !== '' && Number(value) < 0) {
          nextErrors[`variantInventory.${variant.id}.${field}`] = `${variantLabel}: stock values cannot be negative.`
        }
      })

      if (
        inventory.minimumStockLevel !== ''
        && inventory.maximumStockLevel !== ''
        && Number(inventory.minimumStockLevel) > Number(inventory.maximumStockLevel)
      ) {
        nextErrors[`variantInventory.${variant.id}.minimumStockLevel`] = `${variantLabel}: Min must be less than or equal to Max.`
      }
    })

    setErrors(nextErrors)
    return nextErrors
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
    const variants = nextData.variants

    return {
      ...nextData,
      variants: variants.map((variant, index) => ({
        ...makeEmptyVariant(),
        ...variant,
        id: variant.id || makeVariantId(),
        size: variant.size || variant.name || `Variant ${index + 1}`,
        sku: variant.sku || (index === 0 ? nextData.productCode : `${nextData.productCode}-${index + 1}`),
        hsn: variant.hsn || nextData.hsnSacCode,
        unit: variant.unit || nextData.unitOfMeasure,
        gstRate: variant.gstRate || nextData.gstVatRate,
        purchasePrice: variant.purchasePrice || nextData.purchasePrice,
        sellingPrice: variant.sellingPrice || nextData.sellingPrice,
        inventory: normalizeVariantInventory(variant, index === 0 ? nextData.openingStock : ''),
      })),
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setValidationBanner('')

    const nextErrors = validate()
    const errorFieldNames = Object.keys(nextErrors)

    if (errorFieldNames.length > 0) {
      const sectionWithError = findSectionForErrorField(productSections, errorFieldNames[0])

      if (sectionWithError && sectionWithError.id !== activeSection) {
        setActiveSection(sectionWithError.id)
      }

      setValidationBanner(
        `Can't save yet — ${errorFieldNames.length} field${errorFieldNames.length > 1 ? 's' : ''} need${errorFieldNames.length > 1 ? '' : 's'} attention${sectionWithError ? ` on the "${sectionWithError.title}" tab` : ''}.`,
      )
      return
    }

    const syncedData = syncVariants(formData)

    const totalVariantInventory = syncedData.variants.reduce((sum, variant) => sum + getVariantInventoryNumber(variant, 'openingStock'), 0)

    onSave({
      ...syncedData,
      sku: syncedData.productCode.trim(),
      name: syncedData.name.trim(),
      brand: syncedData.brand,
      category: syncedData.category,
      categoryId: syncedData.categoryId || syncedData.category,
      productType: syncedData.productType || syncedData.category,
      price: Number(syncedData.sellingPrice) || 0,
      totalInventory: totalVariantInventory || Number(syncedData.openingStock) || 0,
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
        mrp: Number(variant.mrp) || 0,
        inventory: {
          ...emptyVariantInventory,
          ...variant.inventory,
          openingStock: getVariantInventoryNumber(variant, 'openingStock'),
          minimumStockLevel: getVariantInventoryNumber(variant, 'minimumStockLevel'),
          maximumStockLevel: getVariantInventoryNumber(variant, 'maximumStockLevel'),
          reorderLevel: getVariantInventoryNumber(variant, 'reorderLevel'),
          reorderQuantity: getVariantInventoryNumber(variant, 'reorderQuantity'),
        },
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

  const updateVariant = (index, field, value) => {
    setFormData((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => (
        variantIndex === index
          ? {
            ...variant,
            [field]: field === 'inventory'
              ? { ...normalizeVariantInventory(variant), openingStock: value }
              : value,
          }
          : variant
      )),
    }))
  }

  const updateVariantInventory = (variantId, field, value) => {
    setFormData((current) => ({
      ...current,
      variants: current.variants.map((variant) => (
        variant.id === variantId
          ? {
            ...variant,
            inventory: {
              ...normalizeVariantInventory(variant),
              [field]: value,
            },
          }
          : variant
      )),
    }))
    setErrors((current) => ({
      ...current,
      [`variantInventory.${variantId}.${field}`]: '',
    }))
  }

  const addVariant = () => {
    setFormData((current) => ({
      ...current,
      hasVariants: true,
      variants: [
        ...current.variants,
        {
          ...makeEmptyVariant(),
          unit: current.unitOfMeasure,
          hsn: current.hsnSacCode,
          gstRate: current.gstVatRate,
          purchasePrice: current.purchasePrice,
          sellingPrice: current.sellingPrice,
        },
      ],
    }))
  }

  const removeVariant = (index) => {
    const nextVariantCount = formData.variants.length - 1
    setFormData((current) => ({
      ...current,
      hasVariants: nextVariantCount > 0,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }))
  }

  const renderField = (field) => {
    const commonProps = {
      label: field.label,
      value: formData[field.name] ?? '',
      onChange: (event) => updateField(field.name, event.target.value),
      error: errors[field.name],
      required: field.required,
      maxLength: field.maxLength,
      placeholder: field.placeholder,
    }

    if (field.input === 'select') {
      if (field.name === 'category') {
        return (
          <Select
            {...commonProps}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={categoryOptions}
            placeholder={`Type or select ${field.label.toLowerCase()}`}
            onChange={(event) => {
              setFormData((current) => ({
                ...current,
                category: event.target.value,
                categoryId: event.target.value,
                subCategory: '',
                subCategoryId: '',
              }))
              setErrors((current) => ({ ...current, category: '' }))
            }}
            searchable
          />
        )
      }

      if (field.name === 'status') {
        return (
          <Select
            {...commonProps}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={toOptions(options.status)}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        )
      }

      if (field.name === 'subCategory') {
        return (
          <Select
            label={field.label}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={subCategoryOptions}
            value={formData.subCategoryId}
            onChange={(event) => {
              const option = subCategoryOptions.find((opt) => opt.value === event.target.value)
              setFormData((current) => ({ ...current, subCategoryId: event.target.value, subCategory: option?.label || '' }))
            }}
            placeholder={formData.category ? 'Select sub category' : 'Select a category first'}
            disabled={!formData.category}
            searchable
          />
        )
      }

      if (field.name === 'brand') {
        return (
          <Select
            label={field.label}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={brandOptions}
            value={formData.brandId}
            onChange={(event) => {
              const option = brandOptions.find((opt) => opt.value === event.target.value)
              setFormData((current) => ({ ...current, brandId: event.target.value, brand: option?.label || '' }))
            }}
            placeholder="Search and select a brand"
            searchable
          />
        )
      }

      if (field.name === 'preferredSupplier') {
        return (
          <Select
            label={field.label}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={supplierOptions}
            value={formData.preferredSupplierId}
            onChange={(event) => {
              const option = supplierOptions.find((opt) => opt.value === event.target.value)
              setFormData((current) => ({ ...current, preferredSupplierId: event.target.value, preferredSupplier: option?.label || '' }))
            }}
            placeholder="Search and select a supplier"
            searchable
          />
        )
      }

      if (field.name === 'weightUnit' || field.name === 'warrantyPeriodUnit' || field.name === 'shelfLifeUnit') {
        return (
          <Select
            {...commonProps}
            className="w-full max-w-full"
            triggerClassName="w-full max-w-full"
            options={field.name === 'weightUnit' ? options.weightUnit : options.durationUnit}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        )
      }

      const suggestionListId = `product-${field.name}-options`
      const suggestions = suggestionOptions[field.name] || []

      return (
        <div className="flex flex-col gap-1.5">
          <Input
            {...commonProps}
            list={suggestionListId}
            placeholder={`Type or pick ${field.label.toLowerCase()}`}
          />
          <datalist id={suggestionListId}>
            {suggestions.map((option) => (
              <option key={option.value} value={option.value} />
            ))}
          </datalist>
        </div>
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

    if (field.input === 'button') {
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-transparent select-none" aria-hidden="true">
            {field.label}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-center border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
          >
            <Barcode className="size-4" aria-hidden="true" />
            {field.label}
          </Button>
        </div>
      )
    }

    if (field.input === 'variantInventory') {
      const inventoryFields = [
        { key: 'openingStock', label: 'Opening Stock', width: 'w-32' },
        { key: 'minimumStockLevel', label: 'Min', width: 'w-24' },
        { key: 'maximumStockLevel', label: 'Max', width: 'w-24' },
        { key: 'reorderLevel', label: 'Reorder Level', width: 'w-32' },
        { key: 'reorderQuantity', label: 'Reorder Quantity', width: 'w-36' },
      ]
      const variantInventoryErrors = Object.entries(errors).filter(([key, value]) => key.startsWith('variantInventory.') && value)

      if (formData.variants.length === 0) {
        return (
          <div className="rounded-2xl border border-neutral-100 bg-white shadow-[0_14px_35px_-32px_rgb(15_23_42/0.55)]">
            <div className="border-b border-neutral-100 px-4 py-4 sm:px-5">
              <p className="text-base font-semibold text-neutral-950">{field.label}</p>
            </div>
            <div className="p-3 sm:p-4">
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-neutral-700">No variants added yet.</p>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{field.label}</p>
          </div>
          <div className="max-h-[350px] overflow-auto rounded-xl border border-neutral-100 bg-white shadow-(--shadow-xs)">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-neutral-100 bg-neutral-50/95 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="w-full min-w-72 whitespace-nowrap px-4 py-3">Variant Name</th>
                  {inventoryFields.map((inventoryField) => (
                    <th key={inventoryField.key} className={`whitespace-nowrap px-3 py-3 ${inventoryField.width}`}>
                      {inventoryField.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {formData.variants.map((variant, index) => {
                  const inventory = normalizeVariantInventory(variant, index === 0 ? formData.openingStock : '')
                  const variantName = getVariantName(variant, index)

                  return (
                    <tr key={variant.id} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-800">{variantName}</td>
                      {inventoryFields.map((inventoryField) => {
                        const errorKey = `variantInventory.${variant.id}.${inventoryField.key}`
                        return (
                          <td key={inventoryField.key} className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={inventory[inventoryField.key] ?? ''}
                              onChange={(event) => updateVariantInventory(variant.id, inventoryField.key, event.target.value)}
                              aria-label={`${variantName} ${inventoryField.label}`}
                              className={`h-9 ${inventoryField.width} rounded-lg border bg-neutral-50 px-2.5 text-sm text-neutral-900 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                                errors[errorKey]
                                  ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                                  : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
                              }`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {variantInventoryErrors.length > 0 && (
            <div className="space-y-1">
              {variantInventoryErrors.map(([key, value]) => (
                <p key={key} className="text-xs text-red-600">{value}</p>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (field.input === 'variants') {
      return (
        <div className="rounded-2xl border border-neutral-100 bg-white shadow-[0_14px_35px_-32px_rgb(15_23_42/0.55)]">
          <div className="flex flex-col gap-4 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-neutral-950">Variant List</p>
                {/* <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                  {formData.variants.length} {formData.variants.length === 1 ? 'variant' : 'variants'}
                </span> */}
              </div>
              <p className="mt-1 text-sm text-neutral-500">Add every sellable variant with its stock, MRP, and selling price.</p>
            </div>
            <Button type="button" size="sm" className="h-10 px-4 shadow-[0_12px_26px_-14px_rgb(6_59_0/0.9)]" onClick={addVariant}>
              <Plus className="size-4" aria-hidden="true" />
              New Variant
            </Button>
          </div>

          {formData.variants.length === 0 ? (
            <div className="p-3 sm:p-4">
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-neutral-700">No variants added yet.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-5 py-3">Variant</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3 text-center">Stock</th>
                    <th className="px-3 py-3">Selling Price (₹)</th>
                    <th className="px-3 py-3">MRP (₹)</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {formData.variants.map((variant, index) => {
                    const variantInventory = normalizeVariantInventory(variant, index === 0 ? formData.openingStock : '')
                    const isUploadingImage = Boolean(uploadingFields[`variantImage-${index}`])

                    return (
                      <tr key={variant.id}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <label className="group relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                              {variant.imageUrl ? (
                                <img src={variant.imageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <ImagePlus className="size-4 text-neutral-300" aria-hidden="true" />
                              )}
                              <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex">
                                <Upload className="size-3.5 text-white" aria-hidden="true" />
                              </span>
                              {isUploadingImage && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[0.6rem] font-medium text-white">
                                  ...
                                </span>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="sr-only"
                                disabled={isUploadingImage}
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  event.target.value = ''
                                  if (file) handleVariantImageUpload(index, file)
                                }}
                              />
                              {variant.imageUrl && !isUploadingImage && (
                                <button
                                  type="button"
                                  title="Remove variant image"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    updateVariant(index, 'imageUrl', '')
                                  }}
                                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-neutral-200"
                                >
                                  <X className="size-2.5" aria-hidden="true" />
                                </button>
                              )}
                            </label>
                            <input
                              type="text"
                              value={variant.size}
                              placeholder="e.g. Red / Large"
                              onChange={(event) => updateVariant(index, 'size', event.target.value)}
                              className="h-9 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <input
                            type="text"
                            value={variant.sku}
                            onChange={(event) => updateVariant(index, 'sku', event.target.value)}
                            className="h-9 w-28 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={variantInventory.openingStock}
                            onChange={(event) => updateVariant(index, 'inventory', event.target.value)}
                            className="h-9 w-20 rounded-lg border border-neutral-200 bg-white px-2.5 text-center text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.sellingPrice}
                            onChange={(event) => updateVariant(index, 'sellingPrice', event.target.value)}
                            className="h-9 w-24 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.mrp}
                            onChange={(event) => updateVariant(index, 'mrp', event.target.value)}
                            className="h-9 w-24 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                            aria-label={`Remove ${getVariantName(variant, index)}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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
          isUploading={Boolean(uploadingFields[field.name])}
          onFileSelected={(file) => handleDocumentUpload(field.name, file)}
          onRemove={() => updateField(field.name, '')}
        />
      )
    }

    if (field.input === 'compactFile') {
      const isUploading = Boolean(uploadingFields[field.name])

      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">{field.label}</label>
          <div className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2">
            {formData[field.name] ? (
              <a href={formData[field.name]} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-primary-700">
                {formData[field.name]}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-400">
                {isUploading ? 'Uploading...' : 'No file'}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-2">
              <label className="inline-flex h-8 w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-xs font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-3.5" aria-hidden="true" />
                {isUploading ? 'Uploading' : 'Upload'}
                <input
                  type="file"
                  accept={field.accept || '.zip,.pdf,image/*'}
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) handleDocumentUpload(field.name, file)
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
      const isUploading = Boolean(uploadingFields.videoUrl)

      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">{field.label}</label>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <Input
              value={formData.videoUrl}
              type="url"
              placeholder="Paste video URL, or upload a file"
              onChange={(event) => updateField('videoUrl', event.target.value)}
              error={errors.videoUrl}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 w-28 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-primary-500 to-primary-600 px-3 text-sm font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-4" aria-hidden="true" />
                {isUploading ? 'Uploading' : 'Upload'}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/*"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) handleDocumentUpload('videoUrl', file)
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-28 rounded-full px-3 text-sm"
                disabled={!formData.videoUrl}
                onClick={() => updateField('videoUrl', '')}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
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

          {(formError || imageError || documentUploadError || validationBanner) && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError || imageError || documentUploadError || validationBanner}
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
