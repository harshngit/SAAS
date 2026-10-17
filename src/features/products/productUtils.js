import { normalizeProductVariant, readableClassification } from '../../utils/productVariants'
import { formatCurrency } from '../../utils/format'
import { getFileUrl } from '../../api/files'

export function formatVariantCurrency(value, currency) {
  if (value === '' || value == null) return '—'
  if (!currency) return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value))
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
  } catch {
    return `${value} ${currency}`
  }
}

function toCommaString(value, fallbackValue = '') {
  if (Array.isArray(value)) return value.join(', ')
  return value || fallbackValue
}

export function normalizeApiProduct(product, fallback = {}) {
  const sourceVariants = Array.isArray(product.variations) ? product.variations : fallback.variants || []
  const categoryLabel =
    product.category?.name ||
    product.category_name ||
    product.categoryName ||
    fallback.categoryLabel ||
    readableClassification(fallback.category) ||
    ''

  return {
    ...fallback,
    id: product.id || fallback.id,
    // Server-generated business ID (e.g. PRD-0001) - distinct from both the internal UUID
    // above and the user-settable SKU/productCode below. Read-only, never generated here.
    productId: product.product_id || fallback.productId || '',
    name: product.name || fallback.name,
    brand: product.brand_ref?.name || product.brand || fallback.brand || '',
    manufacturer: product.manufacturer || fallback.manufacturer || '',
    sku: product.sku ?? fallback.sku ?? '',
    price: product.price ?? fallback.price ?? 0,
    categoryId: product.category_id || fallback.categoryId || fallback.category_id || fallback.category || '',
    category: readableClassification(categoryLabel),
    categoryLabel: readableClassification(categoryLabel),
    productType: readableClassification(product.product_type !== undefined ? product.product_type : fallback.productType),
    barcode: product.barcode || fallback.barcode || '',
    shortName: product.short_name || fallback.shortName || '',
    modelNumber: product.model_number || fallback.modelNumber || '',
    subCategory: product.sub_category_id === null || product.sub_category_id === '' ? '' : readableClassification(product.subcategory?.name || product.sub_category || fallback.subCategory || ''),
    subCategoryId: product.sub_category_id !== undefined ? product.sub_category_id || '' : fallback.subCategoryId || '',
    brandId: product.brand_id || fallback.brandId || '',
    supplierName: product.supplier?.name || fallback.supplierName || '',
    suppliers: Array.isArray(product.suppliers)
      ? product.suppliers
      : product.supplier
        ? [product.supplier]
        : fallback.suppliers || [],
    unitOfMeasure: product.uom || fallback.unitOfMeasure || '',
    taxCategory: product.tax_category || fallback.taxCategory || '',
    hsnSacCode: product.hsn_code || fallback.hsnSacCode || '',
    gstVatRate: product.tax_rate ?? fallback.gstVatRate ?? '',
    taxInclusive: Boolean(product.pricing?.tax_inclusive ?? product.tax_inclusive ?? fallback.taxInclusive ?? false),
    // Backend keeps these under `pricing` for a product record, but `price` (bare, top-level) is
    // what list/detail views and the save payload use as the selling price - fall back to it so
    // a product saved before `pricing` existed, or missing the nested object for any reason,
    // still hydrates a non-empty Selling Price in the edit form.
    purchasePrice: product.pricing?.purchase_price ?? fallback.purchasePrice ?? '',
    sellingPrice: product.pricing?.selling_price ?? product.price ?? fallback.sellingPrice ?? '',
    mrp: product.pricing?.mrp ?? fallback.mrp ?? '',
    wholesalePrice: product.pricing?.wholesale_price ?? fallback.wholesalePrice ?? '',
    dealerPrice: product.pricing?.dealer_price ?? fallback.dealerPrice ?? '',
    discountPercent: product.pricing?.discount_percent ?? fallback.discountPercent ?? '',
    preferredSupplierId: product.preferred_supplier_id || fallback.preferredSupplierId || '',
    supplierProductCode: product.supplier_product_code || fallback.supplierProductCode || '',
    leadTime: product.lead_time ?? fallback.leadTime ?? '',
    minimumOrderQuantity: product.minimum_order_quantity ?? fallback.minimumOrderQuantity ?? '',
    purchaseUnit: product.purchase_unit || fallback.purchaseUnit || '',
    salesUnit: product.sales_unit || fallback.salesUnit || '',
    commissionEligible: Boolean(product.commission_eligible ?? fallback.commissionEligible ?? false),
    commissionPercent: product.commission ?? fallback.commissionPercent ?? '',
    defaultDiscount: product.default_discount ?? fallback.defaultDiscount ?? '',
    weight: product.weight ?? fallback.weight ?? '',
    weightUnit: product.weight_unit || fallback.weightUnit || '',
    length: product.length ?? fallback.length ?? '',
    width: product.width ?? fallback.width ?? '',
    height: product.height ?? fallback.height ?? '',
    volume: product.volume ?? fallback.volume ?? '',
    color: product.color || fallback.color || '',
    size: product.physical_size || fallback.size || '',
    material: product.material || fallback.material || '',
    downloadableProduct: Boolean(product.downloadable_product ?? fallback.downloadableProduct ?? false),
    licenseKeyRequired: Boolean(product.license_key_required ?? fallback.licenseKeyRequired ?? false),
    downloadLimit: product.download_limit ?? fallback.downloadLimit ?? '',
    warrantyPeriod: product.warranty_period || fallback.warrantyPeriod || '',
    warrantyPeriodUnit: product.warranty_period_unit || fallback.warrantyPeriodUnit || '',
    shelfLife: product.shelf_life || fallback.shelfLife || '',
    shelfLifeUnit: product.shelf_life_unit || fallback.shelfLifeUnit || '',
    launchDate: product.launch_date || fallback.launchDate || '',
    endOfLifeDate: product.end_of_life_date || fallback.endOfLifeDate || '',
    productTags: toCommaString(product.product_tags, fallback.productTags || ''),
    variantAttributes: toCommaString(product.variant_attributes, fallback.variantAttributes || ''),
    notes: product.notes || fallback.notes || '',
    currency: product.pricing?.currency || product.currency || fallback.currency || '',
    countryOfOrigin: product.country_of_origin || fallback.countryOfOrigin || '',
    statusValue: product.status || fallback.statusValue || (product.is_active === false ? 'inactive' : 'active'),
    status: product.is_active === false ? 'inactive' : 'active',
    createdAt: product.created_at || product.createdAt || fallback.createdAt || '',
    updatedAt: product.updated_at || product.updatedAt || fallback.updatedAt || '',
    description: product.description || fallback.description || '',
    // Stored as "/files/{id}" (or a bare id) - resolve to a full URL for <img src>.
    coverImage: getFileUrl(product.cover_image) || fallback.coverImage || '',
    images: (product.images || fallback.images || []).map((image) => getFileUrl(image)).filter(Boolean),
    videoUrl: product.product_video || fallback.videoUrl || '',
    catalogBrochure: product.product_catalog_brochure || fallback.catalogBrochure || '',
    productManual: product.product_manual || fallback.productManual || '',
    productDatasheet: product.product_datasheet || fallback.productDatasheet || '',
    complianceCertificate: product.compliance_certificate || fallback.complianceCertificate || '',
    warrantyDocument: product.warranty_document || fallback.warrantyDocument || '',
    downloadFile: product.download_file || fallback.downloadFile || '',
    totalStock: product.total_stock ?? fallback.totalStock ?? 0,
    batchTracking: Boolean(product.batch_tracking ?? fallback.batchTracking ?? false),
    serialNumberTracking: Boolean(product.serial_number_tracking ?? fallback.serialNumberTracking ?? false),
    variants: sourceVariants.map(normalizeProductVariant),
    hasVariants: product.has_variants ?? (sourceVariants.length > 0),
  }
}

export function priceRange(variants) {
  if (!variants?.length) {
    return formatCurrency(0)
  }

  const prices = variants.map((variant) => variant.sellingPrice).filter((price) => price !== '' && price != null).map(Number)
  if (!prices.length) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`
}
