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

  return {
    ...fallback,
    id: product.id || fallback.id,
    name: product.name || fallback.name,
    brand: product.brand || fallback.brand || '',
    sku: product.sku || fallback.sku || fallback.variants?.[0]?.sku || '',
    categoryId: product.category_id || fallback.categoryId || fallback.category_id || fallback.category || '',
    category: fallback.category || product.product_type || product.category_id || '',
    status: product.is_active === false ? 'inactive' : 'active',
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
