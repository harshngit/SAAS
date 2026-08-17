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

export function normalizeApiProduct(product, fallback = {}) {
  const sourceVariants = product.variations?.length ? product.variations : fallback.variants || []
  const categoryLabel =
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
    brand: product.brand || fallback.brand || '',
    manufacturer: product.manufacturer || fallback.manufacturer || '',
    sku: product.sku || fallback.sku || fallback.variants?.[0]?.sku || '',
    price: product.price ?? fallback.price ?? 0,
    categoryId: product.category_id || fallback.categoryId || fallback.category_id || fallback.category || '',
    category: categoryLabel || product.category_id || '',
    categoryLabel,
    productType: product.product_type || fallback.productType || '',
    subCategory: product.sub_category || fallback.subCategory || '',
    unitOfMeasure: product.unit_of_measure || fallback.unitOfMeasure || '',
    taxCategory: product.tax_category || fallback.taxCategory || '',
    purchaseUnit: product.purchase_unit || fallback.purchaseUnit || '',
    salesUnit: product.sales_unit || fallback.salesUnit || '',
    currency: product.currency || fallback.currency || '',
    countryOfOrigin: product.country_of_origin || fallback.countryOfOrigin || '',
    status: product.is_active === false ? 'inactive' : 'active',
    createdAt: product.created_at || product.createdAt || fallback.createdAt || '',
    updatedAt: product.updated_at || product.updatedAt || fallback.updatedAt || '',
    description: product.description || fallback.description || '',
    coverImage: product.cover_image || fallback.coverImage || '',
    images: product.images || fallback.images || [],
    videoUrl: product.product_video || fallback.videoUrl || '',
    catalogBrochure: product.catalog_brochure || fallback.catalogBrochure || '',
    productManual: product.manual || fallback.productManual || '',
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
