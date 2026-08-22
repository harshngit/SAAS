import { formatCurrency } from '../../utils/format'

function normalizeVariantInventory(variant = {}) {
  const inventory = variant.inventory && typeof variant.inventory === 'object' ? variant.inventory : {}

  return {
    openingStock: Number(inventory.openingStock ?? variant.inventory ?? variant.stock) || 0,
    minimumStockLevel: Number(inventory.minimumStockLevel ?? variant.minimumStockLevel ?? variant.minimum_stock_level) || 0,
    maximumStockLevel: Number(inventory.maximumStockLevel ?? variant.maximumStockLevel ?? variant.maximum_stock_level) || 0,
    reorderLevel: Number(inventory.reorderLevel ?? variant.reorderLevel ?? variant.reorder_level) || 0,
    reorderQuantity: Number(inventory.reorderQuantity ?? variant.reorderQuantity ?? variant.reorder_quantity) || 0,
  }
}

function toCommaString(value, fallbackValue = '') {
  if (Array.isArray(value)) return value.join(', ')
  return value || fallbackValue
}

export function normalizeApiProduct(product, fallback = {}) {
  const sourceVariants = product.variations?.length ? product.variations : fallback.variants || []
  const categoryLabel =
    product.category?.name ||
    product.category_name ||
    product.categoryName ||
    product.product_type ||
    fallback.categoryLabel ||
    fallback.category ||
    ''

  return {
    ...fallback,
    id: product.id || fallback.id,
    name: product.name || fallback.name,
    brand: product.brand_ref?.name || product.brand || fallback.brand || '',
    manufacturer: product.manufacturer || fallback.manufacturer || '',
    sku: product.sku || fallback.sku || fallback.variants?.[0]?.sku || '',
    price: product.price ?? fallback.price ?? 0,
    categoryId: product.category_id || fallback.categoryId || fallback.category_id || fallback.category || '',
    category: categoryLabel || product.category_id || '',
    categoryLabel,
    productType: product.product_type || fallback.productType || '',
    barcode: product.barcode || fallback.barcode || '',
    shortName: product.short_name || fallback.shortName || '',
    modelNumber: product.model_number || fallback.modelNumber || '',
    subCategory: product.subcategory?.name || product.sub_category || fallback.subCategory || '',
    subCategoryId: product.sub_category_id || fallback.subCategoryId || '',
    brandId: product.brand_id || fallback.brandId || '',
    supplierName: product.supplier?.name || fallback.supplierName || '',
    unitOfMeasure: product.uom || fallback.unitOfMeasure || '',
    taxCategory: product.tax_category || fallback.taxCategory || '',
    hsnSacCode: product.hsn_code || fallback.hsnSacCode || '',
    gstVatRate: product.tax_rate ?? fallback.gstVatRate ?? '',
    taxInclusive: Boolean(product.pricing?.tax_inclusive ?? product.tax_inclusive ?? fallback.taxInclusive ?? false),
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
    coverImage: product.cover_image || fallback.coverImage || '',
    images: product.images || fallback.images || [],
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
    variants: sourceVariants.map((variant, index) => {
      const fallbackVariant = fallback.variants?.find((item) => item.id && item.id === (variant.id || variant.variantId || variant.variant_id)) || fallback.variants?.[index] || {}
      const fallbackInventory = normalizeVariantInventory(fallbackVariant)
      const mergedInventory = variant.inventory && typeof variant.inventory === 'object'
        ? { ...fallbackInventory, ...variant.inventory }
        : { ...fallbackInventory, openingStock: variant.inventory ?? variant.stock ?? fallbackInventory.openingStock }
      const inventory = normalizeVariantInventory({
        ...fallbackVariant,
        ...variant,
        inventory: mergedInventory,
      })

      return {
        id: variant.id || variant.variantId || variant.variant_id || fallbackVariant.id,
        size: variant.name || variant.size || '',
        sku: variant.sku || product.sku || fallback.sku || '',
        hsn: variant.hsn || '',
        unit: variant.unit || 'Bottle',
        gstRate: variant.gstRate || 0,
        purchasePrice: variant.purchasePrice || 0,
        sellingPrice: Number(variant.price ?? variant.sellingPrice) || 0,
        imageUrl: variant.image_url || variant.imageUrl || fallbackVariant.imageUrl || '',
        inventory,
      }
    }),
  }
}

export function priceRange(variants) {
  if (!variants?.length) {
    return formatCurrency(0)
  }

  const prices = variants.map((variant) => variant.sellingPrice)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`
}
