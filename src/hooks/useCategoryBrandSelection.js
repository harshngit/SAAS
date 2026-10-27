import { useEffect, useState } from 'react'
import { listBrands } from '../api/brands'

// GET /categories/{id}/brands is an effective list (all active brands when
// unrestricted). The inline Brand.categories links identify explicit mappings.
export function useCategoryBrandSelection(categoryId, enabled) {
  const [brands, setBrands] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    listBrands().then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.success) { setError(result.error); return }
      setBrands(result.brands)
      setSelectedIds(categoryId ? result.brands.filter((brand) => (brand.categories || []).some((category) => category.id === categoryId)).map((brand) => brand.id) : [])
    })
    return () => { cancelled = true }
  }, [categoryId, enabled, retry])
  return { brands, selectedIds, setSelectedIds, loading, error, reload: () => setRetry((value) => value + 1) }
}
