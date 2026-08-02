import { formatCurrency } from '../../utils/format'

export function normalizeApiProduct(product, fallback = {}) {
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
    totalStock: product.total_stock ?? fallback.totalStock ?? 0,
    variants: (product.variations?.length ? product.variations : fallback.variants || []).map((variant) => ({
      size: variant.name || variant.size || '',
      sku: variant.sku || product.sku || fallback.sku || '',
      hsn: variant.hsn || '',
      unit: variant.unit || 'Bottle',
      gstRate: variant.gstRate || 0,
      purchasePrice: variant.purchasePrice || 0,
      sellingPrice: Number(variant.price ?? variant.sellingPrice) || 0,
      inventory: Number(variant.inventory) || 0,
    })),
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
