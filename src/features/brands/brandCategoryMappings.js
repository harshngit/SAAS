import { linkBrandCategory, listBrands, unlinkBrandCategory } from '../../api/brands'

// Change only this Brand's links. Category-side replacement would overwrite the
// other Brands assigned to each Category. Read fresh links on every retry because
// the existing backend exposes individual add/remove operations, not a transaction.
export async function syncBrandCategories(brandId, selectedIds, topCategories) {
  const wanted = [...new Set(selectedIds)]
  if (wanted.some((id) => !topCategories.some((category) => category.id === id && !category.parentId))) {
    return { success: false, error: 'Only top-level Categories can be assigned to a Brand.' }
  }
  const result = await listBrands()
  if (!result.success) return { success: false, error: result.error }
  const brand = result.brands.find((item) => item.id === brandId)
  if (!brand) return { success: false, error: 'This Brand is no longer available. Reload and try again.' }
  const current = new Map((brand.categories || []).map((category) => [category.id, category]))
  for (const id of current.keys()) {
    if (wanted.includes(id)) continue
    const removed = await unlinkBrandCategory(brandId, id)
    if (!removed.success) return { success: false, error: removed.error, categories: [...current.values()] }
    current.delete(id)
  }
  for (const id of wanted) {
    if (current.has(id)) continue
    const added = await linkBrandCategory(brandId, id)
    if (!added.success) return { success: false, error: added.error, categories: [...current.values()] }
    const category = topCategories.find((item) => item.id === id)
    current.set(id, { id, name: category.name })
  }
  return { success: true, categories: [...current.values()] }
}
