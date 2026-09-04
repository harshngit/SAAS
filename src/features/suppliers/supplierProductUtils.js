import { updateProduct } from '../../api/products'

export const DEMO_SUPPLIER_PRODUCT_NAMES = {
  'reliance industries': ['Anchor Roma 6A One-Way Switch', 'Industrial Extension Board', 'Havells LED Batten'],
  'coastal beverages': ['Mineral Water', 'Juice', 'Soft Drinks'],
}

export function getDemoSupplierProductNames(supplierName = '') {
  return DEMO_SUPPLIER_PRODUCT_NAMES[supplierName.trim().toLowerCase()] || []
}

export function getProductId(product) {
  return product?.id || product?.productId || product?.product_id || product
}

export function getSupplierProducts(supplier, products = [], { demoMode = false } = {}) {
  const selectedIds = new Set((supplier?.productsSupplied || []).map(getProductId))
  const demoNames = new Set(getDemoSupplierProductNames(supplier?.name).map((name) => name.toLowerCase()))

  return products.filter((product) => {
    const isConfigured = selectedIds.has(product.id) || product.preferredSupplierId === supplier?.id
    const isDemoMatch = demoMode && demoNames.has(String(product.name || '').trim().toLowerCase())
    return isConfigured || isDemoMatch
  })
}

// -----------------------------------------------------------------------------
// REAL-SUPPLIER write side of the Supplier <-> Product relationship.
//
// The backend has no Supplier<->Product join table yet - the only relationship it persists is
// Product.preferred_supplier_id, a single ("one preferred supplier per product") field already
// writable via updateProduct(). This is an interim mapping, NOT true many-to-many support.
// BACKEND LATER: a real Supplier <-> many Products / Product <-> many Suppliers relationship.
//
// Demo suppliers never call this - their productsSupplied selection stays local/demo state only.
// -----------------------------------------------------------------------------
export async function syncSupplierProductLinks(supplierId, { previousProducts = [], nextProducts = [], allProducts = [] } = {}) {
  const previousIds = new Set(previousProducts.map(getProductId).filter(Boolean))
  const nextIds = new Set(nextProducts.map(getProductId).filter(Boolean))
  const productIndex = new Map(allProducts.map((product) => [product.id, product]))

  const toLink = [...nextIds].filter((id) => !previousIds.has(id))
  const toUnlink = [...previousIds].filter((id) => !nextIds.has(id))

  const failed = []
  let succeeded = 0

  for (const productId of toLink) {
    // eslint-disable-next-line no-await-in-loop
    const result = await updateProduct(productId, { preferredSupplierId: supplierId })
    if (result.success) succeeded += 1
    else failed.push({ productId, action: 'link', error: result.error })
  }

  for (const productId of toUnlink) {
    const current = productIndex.get(productId)
    // Only clear the relationship if this supplier is still the one actually holding it - never
    // steal/clear a link that has since been reassigned to a different supplier.
    if (current && current.preferredSupplierId && current.preferredSupplierId !== supplierId) continue
    // eslint-disable-next-line no-await-in-loop
    const result = await updateProduct(productId, { preferredSupplierId: '' })
    if (result.success) succeeded += 1
    else failed.push({ productId, action: 'unlink', error: result.error })
  }

  return {
    success: failed.length === 0,
    attempted: toLink.length + toUnlink.length,
    succeeded,
    failed,
  }
}
