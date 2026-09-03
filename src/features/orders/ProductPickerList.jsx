import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Minus, Package, Pencil, Plus, Search } from 'lucide-react'
import { formatCurrency } from '../../utils/format'

const productCategoryOf = (product) =>
  product.category?.name || product.category_name || product.product_type || ''

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

      <div className={`mt-2 ${listMaxHeightClass} divide-y divide-neutral-50 overflow-y-auto rounded-xl border border-neutral-100`}>
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-400">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-400">No products found.</p>
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

            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? 'bg-primary-50/60' : ''}`}
              >
                <div className="relative size-11 shrink-0">
                  {product.cover_image ? (
                    <img src={product.cover_image} alt="" className="size-11 rounded-lg border border-neutral-100 object-cover" />
                  ) : (
                    <span className="flex size-11 items-center justify-center rounded-lg bg-neutral-50 text-neutral-300 ring-1 ring-neutral-100">
                      <Package className="size-5" aria-hidden="true" />
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary-600 text-white ring-2 ring-white">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                  <p className="truncate text-[0.7rem] text-neutral-400">SKU: {product.sku || '—'}</p>
                  <p
                    className={`text-[0.7rem] font-medium ${
                      isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-neutral-500'
                    }`}
                  >
                    {isOutOfStock
                      ? 'Out of stock'
                      : stock === null
                        ? 'Stock not tracked'
                        : `${isLowStock ? 'Low stock · ' : ''}${stock} ${unit}${isLowStock ? '' : ' available'}`}
                  </p>
                  {shortStock && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-700">
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      Insufficient Stock — need {quantity}, have {stock}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {isSelected ? (
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
                  ) : (
                    <p className="text-right text-sm font-semibold text-neutral-900">
                      {formatCurrency(product.price || 0)}
                      <span className="ml-1 text-[0.64rem] font-normal text-neutral-400">/ {unit}</span>
                    </p>
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
