// Product classification and sellable identity are shared by product editing and both pickers.
export const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
export const readableClassification = (value) => typeof value === 'string' && !isUuidLike(value) ? value.trim() : ''

export function normalizeProductVariant(variant = {}) {
  const pricing = variant.pricing || {}
  const inventory = variant.inventory && typeof variant.inventory === 'object' ? variant.inventory : {}
  return {
    ...variant,
    id: variant.id || variant.variantId || variant.variant_id || '',
    variantCode: variant.variant_code ?? variant.variantCode ?? '',
    size: variant.name ?? variant.size ?? '',
    sku: variant.sku ?? '',
    purchasePrice: pricing.purchase_price ?? variant.purchasePrice ?? '',
    sellingPrice: pricing.selling_price ?? variant.sellingPrice ?? variant.price ?? '',
    mrp: pricing.mrp ?? variant.mrp ?? '',
    wholesalePrice: pricing.wholesale_price ?? variant.wholesalePrice ?? '',
    dealerPrice: pricing.dealer_price ?? variant.dealerPrice ?? '',
    discountPercent: pricing.discount_percent ?? variant.discountPercent ?? '',
    taxInclusive: pricing.tax_inclusive ?? variant.taxInclusive ?? null,
    currency: pricing.currency ?? variant.currency ?? '',
    imageUrl: variant.image_url ?? variant.imageUrl ?? '',
    inventory: {
      openingStock: inventory.openingStock ?? (typeof variant.inventory === 'number' ? variant.inventory : variant.stock) ?? '',
      minimumStockLevel: inventory.minimumStockLevel ?? variant.minimumStockLevel ?? variant.minimum_stock_level ?? '',
      maximumStockLevel: inventory.maximumStockLevel ?? variant.maximumStockLevel ?? variant.maximum_stock_level ?? '',
      reorderLevel: inventory.reorderLevel ?? variant.reorderLevel ?? variant.reorder_level ?? '',
      reorderQuantity: inventory.reorderQuantity ?? variant.reorderQuantity ?? variant.reorder_quantity ?? '',
    },
  }
}

export const productVariants = (product) => (product?.variations ?? product?.variants ?? []).map(normalizeProductVariant)
export const itemKey = (item) => `${item.productId || item.product_id}::${item.variantId || item.variant_id || ''}`

export function selectedProductValues(product, variantId = '') {
  if (!product) return null
  const variants = productVariants(product)
  const variant = variantId ? variants.find((entry) => entry.id === variantId) : variants.length === 1 ? variants[0] : null
  if ((variants.length || product.has_variants) && !variant) return null
  if (variantId && !variant) return null
  const price = variant ? variant.sellingPrice : product.pricing?.selling_price ?? product.price
  const stock = variant ? variant.inventory.openingStock : product.total_stock ?? product.total_inventory
  return {
    productId: product.id,
    variantId: variant?.id || '',
    variantName: variant?.size || '',
    variantCode: variant?.variantCode || '',
    sku: variant ? variant.sku : product.sku || '',
    unitPrice: price === '' || price == null ? null : Number(price),
    stock: stock === '' || stock == null ? null : Number(stock),
  }
}

export function variantMargin(variant) {
  if (variant.purchasePrice === '' || variant.purchasePrice == null || variant.sellingPrice === '' || variant.sellingPrice == null || Number(variant.sellingPrice) <= 0) return null
  return ((Number(variant.sellingPrice) - Number(variant.purchasePrice)) / Number(variant.sellingPrice)) * 100
}

export function validateVariantItems(items, products, { enforceStock = false } = {}) {
  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) return 'A selected product is unavailable. Please select it again.'
    const variants = productVariants(product)
    // Existing lines must explicitly retain their selection; never guess a replacement UUID.
    if ((variants.length || product.has_variants) && !item.variantId) return 'Select a variant first.'
    const selected = selectedProductValues(product, item.variantId)
    if (!selected) return 'The selected variant does not belong to this product. Please select it again.'
    if (enforceStock && item.variantId && selected.stock != null && Number(item.quantity) > selected.stock) {
      return `${product.name} (${selected.variantName || 'variant'}): only ${selected.stock} available.`
    }
  }
  return ''
}
