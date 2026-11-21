// New transactions (Sales Order, Quotation, Purchase, Direct Invoice) must not offer a product that has been
// deactivated. Existing documents keep showing their products - an inactive product that is already on the
// document being edited stays selectable / visible, and detail pages are never filtered.
export function isActiveProduct(product) {
  if (!product) return false
  if (product.is_active === false || product.isActive === false) return false
  return String(product.status || 'active').toLowerCase() !== 'inactive'
}

// products: the loaded catalogue, selectedIds: product ids already on the document being edited.
export function pickableProducts(products = [], selectedIds = []) {
  const keep = new Set(selectedIds.filter(Boolean))
  return products.filter((product) => isActiveProduct(product) || keep.has(product.id))
}
