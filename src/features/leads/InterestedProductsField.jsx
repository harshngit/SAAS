import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { listProducts } from '../../api/products'

const DELIMITERS = /\s*(?:,|;|\n|\||•)\s*/

function splitInterestedProducts(value) {
  return String(value || '')
    .split(DELIMITERS)
    .map((item) => item.trim())
    .filter(Boolean)
}

// Multi-product picker for a lead's "Interested Products".
//
// BACKEND INTEGRATION POINT: the lead API only exposes a single `interested_product` text
// field, so the selected list is persisted as a comma-joined string (it round-trips back into
// chips on load - see splitInterestedProducts). When the backend adds `interested_product_ids`,
// switch `onChange` to emit the id array instead of the joined string.
export default function InterestedProductsField({ value, onChange, label = 'Interested Products', className = '' }) {
  const [selected, setSelected] = useState(() => splitInterestedProducts(value))
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  // Keep in sync when the parent form resets / loads a lead.
  useEffect(() => {
    setSelected(splitInterestedProducts(value))
  }, [value])

  useEffect(() => {
    let alive = true
    listProducts().then((result) => {
      if (alive && result.success) setProducts(result.products)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const commit = (next) => {
    setSelected(next)
    onChange(next.join(', '))
  }

  const addProduct = (name) => {
    const clean = String(name || '').trim()
    if (!clean) return
    if (!selected.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      commit([...selected, clean])
    }
    setQuery('')
    setOpen(false)
  }

  const removeProduct = (name) => commit(selected.filter((item) => item !== name))

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .map((product) => ({ id: product.id, name: product.name || product.product_name || '', sku: product.sku || '' }))
      .filter((product) => {
        if (!product.name) return false
        if (selected.some((item) => item.toLowerCase() === product.name.toLowerCase())) return false
        if (!q) return true
        return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [products, query, selected])

  const canAddFreeText =
    query.trim() && !suggestions.some((product) => product.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={boxRef}>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-2 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/12">
        {selected.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {selected.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-primary-100 py-1 pl-2.5 pr-1 text-xs font-medium text-primary-700"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeProduct(name)}
                  className="rounded-full p-0.5 text-primary-600 transition-colors hover:bg-primary-200"
                  aria-label={`Remove ${name}`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addProduct(query)
              }
            }}
            placeholder={selected.length ? 'Add another product…' : 'Search or type a product…'}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
        </div>

        {open && (suggestions.length > 0 || canAddFreeText) && (
          <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-neutral-100 bg-white shadow-md">
            {suggestions.map((product) => (
              <button
                key={product.id || product.name}
                type="button"
                onClick={() => addProduct(product.name)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50/60"
              >
                <span className="truncate text-neutral-800">{product.name}</span>
                {product.sku && <span className="shrink-0 text-[0.7rem] text-neutral-400">{product.sku}</span>}
              </button>
            ))}
            {canAddFreeText && (
              <button
                type="button"
                onClick={() => addProduct(query)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary-700 hover:bg-primary-50/60"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add “{query.trim()}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
