import { useEffect, useMemo, useRef, useState } from 'react'
import { Package, Plus, Search, X } from 'lucide-react'
import { listProducts } from '../../api/products'
import { getFileUrl } from '../../api/files'

const DELIMITERS = /\s*(?:,|;|\n|\||•)\s*/

// Raw product rows store "/files/{id}" (or a bare id) - resolve for <img src>. Same field
// priority as ProductPickerList.jsx's picker (orders) - keep these two in sync if either changes.
const productImageUrl = (product) =>
  getFileUrl(
    product.cover_image ||
      product.cover_image_url ||
      product.image_url ||
      (Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : '') ||
      '',
  )

// Split a legacy comma/pipe-joined `interested_product` string into loose name entries.
function splitInterestedProductNames(value) {
  return String(value || '')
    .split(DELIMITERS)
    .map((name) => name.trim())
    .filter(Boolean)
}

// Multi-product picker for a lead's "Interested Products" - a checkbox list of the catalog
// (with product images) instead of a search-and-add combobox, so a rep can scan and tick
// everything the prospect is interested in without retyping each name.
//
// Backend contract (crm_changes addendum §1): the lead now has a normalized
// `interested_product_ids` relation plus `interested_products` briefs, and still keeps the
// legacy `interested_product` text field. This field works in { id, name, sku } objects:
//   - real catalog matches carry an `id` -> sent as `interested_product_ids`
//   - free-text entries have `id: null` -> preserved only in the legacy text string (still
//     supported for a product not in the catalog, via the "Add" row below the checklist)
// The parent derives both payload fields from the emitted list.
export default function InterestedProductsField({
  selected = [],
  legacyText = '',
  onChange,
  label = 'Interested Products',
  className = '',
}) {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [customText, setCustomText] = useState('')
  const seededRef = useRef(false)

  useEffect(() => {
    let alive = true
    listProducts().then((result) => {
      if (alive && result.success) setProducts(result.products)
    })
    return () => {
      alive = false
    }
  }, [])

  // One-time seed from a legacy text string when the parent has no structured selection yet
  // (editing a lead created before the normalized relation existed). Names are matched to the
  // catalog where possible so a later save upgrades them to real ids.
  useEffect(() => {
    if (seededRef.current) return
    if (selected.length > 0 || !legacyText) return
    if (products.length === 0) return
    seededRef.current = true
    const byName = new Map(products.map((p) => [String(p.name || p.product_name || '').toLowerCase(), p]))
    const seeded = splitInterestedProductNames(legacyText).map((name) => {
      const match = byName.get(name.toLowerCase())
      return match
        ? { id: match.id, name: match.name || match.product_name || name, sku: match.sku || '', image: productImageUrl(match) }
        : { id: null, name, sku: '' }
    })
    if (seeded.length > 0) onChange(seeded)
  }, [legacyText, selected.length, products, onChange])

  // Backfill the image/SKU on already-structured selections (e.g. editing a lead - its
  // interested_products briefs don't carry an image) once the catalog has loaded.
  useEffect(() => {
    if (products.length === 0 || selected.length === 0) return
    const byId = new Map(products.map((p) => [p.id, p]))
    let changed = false
    const next = selected.map((entry) => {
      if (!entry.id || entry.image) return entry
      const match = byId.get(entry.id)
      if (!match) return entry
      changed = true
      return { ...entry, sku: entry.sku || match.sku || '', image: productImageUrl(match) }
    })
    if (changed) onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const toggleProduct = (product) => {
    const isSelected = selected.some((p) => p.id === product.id)
    if (isSelected) {
      onChange(selected.filter((p) => p.id !== product.id))
      return
    }
    onChange([...selected, { id: product.id, name: product.name, sku: product.sku, image: product.image }])
  }

  const removeEntry = (target) => onChange(selected.filter((p) => p !== target))

  const addFreeText = () => {
    const name = customText.trim()
    if (!name) return
    if (selected.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setCustomText('')
      return
    }
    onChange([...selected, { id: null, name, sku: '' }])
    setCustomText('')
  }

  const catalogRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .map((product) => ({
        id: product.id,
        name: product.name || product.product_name || '',
        sku: product.sku || '',
        image: productImageUrl(product),
      }))
      .filter((product) => {
        if (!product.name) return false
        if (!q) return true
        return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q)
      })
  }, [products, query])

  const freeTextEntries = selected.filter((entry) => !entry.id)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-medium text-neutral-700">{label}</label>

      {freeTextEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {freeTextEntries.map((product, index) => (
            <span
              key={`${product.name}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 py-1 pl-2.5 pr-1 text-xs font-medium text-primary-700"
            >
              {product.name}
              <span className="text-[0.62rem] text-primary-500">(text)</span>
              <button
                type="button"
                onClick={() => removeEntry(product)}
                className="rounded-full p-0.5 text-primary-600 transition-colors hover:bg-primary-200"
                aria-label={`Remove ${product.name}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            className="h-6 min-w-0 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          {selected.length > 0 && (
            <span className="shrink-0 text-xs font-medium text-primary-600">{selected.length} selected</span>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {catalogRows.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-neutral-400">No products match.</p>
          ) : (
            catalogRows.map((product) => {
              const checked = selected.some((p) => p.id === product.id)
              return (
                <label
                  key={product.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    checked ? 'bg-primary-50' : 'hover:bg-surface'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product)}
                    className="size-4 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30"
                  />
                  {product.image ? (
                    <img
                      src={product.image}
                      alt=""
                      className="size-8 shrink-0 rounded-lg border border-neutral-100 object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                      <Package className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-neutral-800">{product.name}</span>
                  {product.sku && <span className="shrink-0 text-[0.7rem] text-neutral-400">{product.sku}</span>}
                </label>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2">
          <input
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addFreeText()
              }
            }}
            placeholder="Not in catalog? Type a product name…"
            className="h-7 min-w-0 flex-1 bg-transparent text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={addFreeText}
            disabled={!customText.trim()}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300 disabled:no-underline"
          >
            <Plus className="size-3" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
