import { linkSupplierProduct, unlinkSupplierProduct } from '../../api/suppliers'

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

// Which of `products` are linked to this supplier.
//  - real mode: `linkedProductIds` comes from GET /suppliers/{id}/products (the M2M join)
//  - demo mode: fall back to the by-name demo mapping + the supplier's own `productsSupplied`
export function getSupplierProducts(supplier, products = [], { demoMode = false, linkedProductIds = null } = {}) {
  if (Array.isArray(linkedProductIds)) {
    const linked = new Set(linkedProductIds.map(String))
    return products.filter((product) => linked.has(String(product.id)))
  }

  const selectedIds = new Set((supplier?.productsSupplied || []).map(getProductId))
  const demoNames = new Set(getDemoSupplierProductNames(supplier?.name).map((name) => name.toLowerCase()))

  return products.filter((product) => {
    // `preferredSupplierId` is still read here as a legacy signal so the Purchase form's
    // "products from this supplier" hint keeps working - the Supplier module itself uses the
    // real M2M list (`linkedProductIds`) above and never writes preferred_supplier_id.
    const isConfigured = selectedIds.has(product.id) || product.preferredSupplierId === supplier?.id
    const isDemoMatch = demoMode && demoNames.has(String(product.name || '').trim().toLowerCase())
    return isConfigured || isDemoMatch
  })
}

// -----------------------------------------------------------------------------
// REAL-SUPPLIER write side of the Supplier <-> Product many-to-many relationship.
// Uses the canonical link endpoints only - it never touches Product master and never sets
// Product.preferred_supplier_id (that field is managed independently by the Product module).
// Demo suppliers never call this - their productsSupplied selection stays local demo state.
// -----------------------------------------------------------------------------
export async function syncSupplierProductM2M(supplierId, { previousProducts = [], nextProducts = [] } = {}) {
  const previousIds = new Set(previousProducts.map(getProductId).filter(Boolean).map(String))
  const nextIds = new Set(nextProducts.map(getProductId).filter(Boolean).map(String))

  const toLink = [...nextIds].filter((id) => !previousIds.has(id))
  const toUnlink = [...previousIds].filter((id) => !nextIds.has(id))

  const failed = []
  let succeeded = 0

  for (const productId of toLink) {
    // eslint-disable-next-line no-await-in-loop
    const result = await linkSupplierProduct(supplierId, productId)
    // An "already linked" 400 is not a real failure for a bulk sync - the desired state is met.
    if (result.success || result.alreadyLinked) succeeded += 1
    else failed.push({ productId, action: 'link', error: result.error })
  }

  for (const productId of toUnlink) {
    // eslint-disable-next-line no-await-in-loop
    const result = await unlinkSupplierProduct(supplierId, productId)
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
