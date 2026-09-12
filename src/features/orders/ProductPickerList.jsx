import { useMemo, useState } from 'react'
import { AlertTriangle, Minus, Package, Pencil, Plus, Search } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import { getFileUrl } from '../../api/files'

const productCategoryOf = (product) =>
  product.category?.name || product.category_name || product.product_type || ''

// Raw product rows store "/files/{id}" (or a bare id) - resolve for <img src>.
const productImageUrl = (product) =>
  getFileUrl(
    product.cover_image ||
      product.cover_image_url ||
      product.image_url ||
      (Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : '') ||
      '',
  )

// The Amazon-style inline product picker: search + category chips + a scrollable list where
// every row is the editing surface (stepper always visible, inline unit price when selected).
// Shared by Create Order (Build Order + Takeaway Preview) and Create Quotation so they stay identical.
//
// `orderItems` is the current line-item array; each entry must expose `productId`, `quantity`
// and `unitPrice`. Callbacks:
//   onSetQuantity(product, nextQuantity)  - 0 removes the line, first non-zero creates it
//   onUpdateItem(productId, field, value) - inline field edit (unit price)
//   onRoundBlur(productId, field, opts)   - returns an onBlur handler that rounds to a whole number
export default function ProductPickerList({
  products,
  orderItems,
  isLoading,
  onSetQuantity,
  onUpdateItem,
  onRoundBlur,
  showCategories = true,
  listMaxHeightClass = 'max-h-96',
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const categories = useMemo(() => {
    const byKey = new Map()
    products.forEach((product) => {
      const name = productCategoryOf(product).trim()
      if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name)
    })
    return [...byKey.values()].sort((a, b) => a.localeCompare(b))
  }, [products])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      if (category !== 'all' && productCategoryOf(product).trim().toLowerCase() !== category) return false
      if (!query) return true
      // Match the name, SKU, or the product's category name - so typing "wires" also
      // surfaces everything in the "Wires & Cables" category.
      return (
        product.name?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        productCategoryOf(product).toLowerCase().includes(query)
      )
    })
  }, [products, search, category])

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products by name or SKU..."
          disabled={isLoading}
          className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-60"
        />
      </div>

      {showCategories && categories.length > 0 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {['all', ...categories].map((entry) => {
            const value = entry === 'all' ? 'all' : entry.toLowerCase()
            const isActive = category === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:text-primary-700'
                }`}
              >
                {entry === 'all' ? 'All' : entry}
              </button>
            )
          })}
        </div>
      )}

      <div className={`mt-2 ${listMaxHeightClass} space-y-2 overflow-y-auto px-1.5 py-1`}>
        {isLoading ? (
          <p className="rounded-2xl border border-neutral-100 px-3 py-6 text-center text-sm text-neutral-400">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-neutral-100 px-3 py-6 text-center text-sm text-neutral-400">No products found.</p>
        ) : (
          filtered.map((product) => {
            const item = orderItems.find((entry) => entry.productId === product.id)
            const quantity = item ? Number(item.quantity) || 0 : 0
            const isSelected = quantity > 0
            const unit = product.sales_unit || product.uom || 'unit'
            const stock = product.total_stock ?? product.total_inventory ?? null
            const threshold = product.minimum_stock_level ?? product.reorder_level ?? 0
            const isOutOfStock = stock !== null && stock <= 0
            const isLowStock = stock !== null && stock > 0 && stock <= threshold
            const shortStock = isSelected && stock !== null && quantity > stock
            const imageUrl = productImageUrl(product)

            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50/50 ring-1 ring-primary-600'
                    : 'border-neutral-100 bg-white hover:border-neutral-200'
                }`}
              >
                <div className="relative size-14 shrink-0">
                  <span className="flex size-14 items-center justify-center rounded-xl bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                    <Package className="size-5" aria-hidden="true" />
                  </span>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="absolute inset-0 size-14 rounded-xl border border-neutral-100 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                  <p className="truncate text-[0.7rem] text-neutral-400">SKU: {product.sku || '—'}</p>
                  <p
                    className={`text-[0.7rem] font-medium ${
                      isOutOfStock
                        ? 'text-red-600'
                        : isLowStock
                          ? 'text-amber-600'
                          : stock === null
                            ? 'text-neutral-400'
                            : 'text-emerald-600'
                    }`}
                  >
                    {isOutOfStock
                      ? 'Out of stock'
                      : stock === null
                        ? 'Stock not tracked'
                        : `${isLowStock ? 'Low stock · ' : ''}${stock} ${unit}${isLowStock ? '' : ' available'}`}
                  </p>
                  {/* Base (catalogue) price - always shown under the name. The right column
                      holds the editable line price + stepper only once the row is selected. */}
                  <p className="text-[0.7rem] font-medium text-neutral-500">
                    {formatCurrency(product.price || 0)}
                    <span className="ml-1 font-normal text-neutral-400">/ {unit}</span>
                  </p>
                  {shortStock && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-700">
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      Insufficient Stock — need {quantity}, have {stock}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {isSelected && (
                    <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white pl-2 pr-1">
                      <span className="text-[0.7rem] text-neutral-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(event) => onUpdateItem(product.id, 'unitPrice', event.target.value)}
                        onBlur={onRoundBlur(product.id, 'unitPrice', { min: 0 })}
                        className="h-7 w-16 bg-transparent text-right text-xs font-semibold text-neutral-900 focus:outline-none"
                        aria-label={`Unit price for ${product.name}`}
                      />
                      <Pencil className="size-3 text-neutral-300" aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`flex items-center rounded-lg p-0.5 ${
                      isSelected ? 'bg-primary-600 text-white' : 'border border-neutral-200 text-neutral-500'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSetQuantity(product, quantity - 1)}
                      disabled={quantity === 0}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
                        isSelected ? 'hover:bg-white/20' : 'hover:bg-neutral-50'
                      }`}
                      aria-label={`Reduce ${product.name}`}
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <input
                      value={quantity}
                      onChange={(event) => onSetQuantity(product, event.target.value)}
                      inputMode="numeric"
                      className="w-8 min-w-0 bg-transparent text-center text-xs font-semibold focus:outline-none"
                      aria-label={`${product.name} quantity`}
                    />
                    <button
                      type="button"
                      onClick={() => onSetQuantity(product, quantity + 1)}
                      disabled={isOutOfStock}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
                        isSelected ? 'hover:bg-white/20' : 'hover:bg-neutral-50'
                      }`}
                      aria-label={`Add ${product.name}`}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
