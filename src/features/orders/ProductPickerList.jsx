import { itemKey, productVariants, readableClassification, selectedProductValues } from '../../utils/productVariants'
import { useMemo, useState } from 'react'
import { AlertTriangle, Minus, Package, Pencil, Plus, Search } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import { getFileUrl } from '../../api/files'
import { formatVariantCurrency } from '../products/productUtils'

const productCategoryOf = (product) =>
  readableClassification(product.category?.name || product.category_name || '')

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
//   onSetQuantity(product, nextQuantity, variantId) - quantity for the exact sellable item
//   onUpdateItem(itemKey, field, value) - inline field edit, scoped to product + variant
//   onRoundBlur(itemKey, field, opts) - existing price-rounding behavior
export default function ProductPickerList({
  products,
  orderItems,
  isLoading,
  onSetQuantity,
  onUpdateItem,
  onRoundBlur,
  showCategories = true,
  enforceVariantStock = true,
  listMaxHeightClass = 'max-h-96',
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [expandedProducts, setExpandedProducts] = useState({})

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
        productVariants(product).some((variant) => [variant.size, variant.sku, variant.variantCode].some((value) => value.toLowerCase().includes(query))) ||
        productCategoryOf(product).toLowerCase().includes(query)
      )
    })
  }, [products, search, category])

  const pickerRows = filtered.flatMap((product) => {
    const variants = productVariants(product)
    if (variants.length <= 1 && !(!variants.length && product.has_variants)) return [{ product, variant: variants[0] || null }]
    const expanded = expandedProducts[product.id] ?? orderItems.some((item) => item.productId === product.id)
    const rows = [{ product, group: true, expanded, variants }]
    if (expanded) rows.push(...variants.map((variant) => ({ product, variant })))
    return rows
  })

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
          className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary-500/12 disabled:opacity-60"
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
                    : 'border-neutral-200 bg-surface text-neutral-600 hover:border-primary-300 hover:text-primary-700'
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
          pickerRows.map(({ product, variant, group, expanded, variants }) => {
            if (group) return (
              <div key={product.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                <button type="button" className="w-full text-left" aria-expanded={Boolean(expanded)}
                  onClick={() => setExpandedProducts((current) => ({ ...current, [product.id]: !expanded }))}>
                  <span className="block text-sm font-semibold text-neutral-900">{product.name}</span>
                  <span className="text-xs text-neutral-500">{variants.length} variants{product.total_stock != null ? ` · ${product.total_stock} total stock` : ''} · Select variant</span>
                </button>
                {expanded && !variants.length && <p className="mt-2 text-xs text-amber-700">Select a variant first. No variants are available for this product.</p>}
              </div>
            )
            const selection = selectedProductValues(product, variant?.id)
            const key = itemKey({ productId: product.id, variantId: variant?.id })
            const item = orderItems.find((entry) => itemKey(entry) === key)
            const quantity = item ? Number(item.quantity) || 0 : 0
            const isSelected = quantity > 0
            const unit = product.sales_unit || product.uom || 'unit'
            const stock = selection?.stock ?? null
            const threshold = variant ? variant.inventory.minimumStockLevel || variant.inventory.reorderLevel || 0 : product.minimum_stock_level ?? product.reorder_level ?? 0
            const isOutOfStock = stock !== null && stock <= 0
            const isLowStock = stock !== null && stock > 0 && stock <= threshold
            const shortStock = isSelected && stock !== null && quantity > stock
            const imageUrl = variant?.imageUrl ? getFileUrl(variant.imageUrl) : productImageUrl(product)
            const displayName = variant ? `${product.name} / ${variant.size}` : product.name
            const canAdd = Boolean(selection) && (!variant || Boolean(variant.id))

            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50/50 ring-1 ring-primary-600'
                    : 'border-neutral-100 bg-surface hover:border-neutral-200'
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
                  {/* Available quantity sits beside the product name, not on its own line. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="truncate text-sm font-medium text-neutral-900">{displayName}</p>
                    <span
                      className={`shrink-0 whitespace-nowrap text-[0.68rem] font-medium ${
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
                    </span>
                  </div>
                  <p className="truncate text-[0.7rem] text-neutral-400">SKU: {(variant ? variant.sku : product.sku) || '—'}</p>
                  {variant?.variantCode && <p className="text-[0.7rem] text-neutral-400">{variant.variantCode}</p>}
                  {!canAdd && <p className="text-xs text-amber-700">Select a variant first.</p>}
                  {selection && selection.unitPrice == null && <p className="text-xs text-amber-700">Selling price unavailable. Enter a unit price.</p>}
                  {/* Base (catalogue) price - always shown under the name. The right column
                      holds the editable line price + stepper only once the row is selected. */}
                  <p className="text-[0.7rem] font-bold text-neutral-900">
                    {selection?.unitPrice != null ? (variant ? formatVariantCurrency(selection.unitPrice, variant.currency) : formatCurrency(selection.unitPrice)) : '—'}
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
                    <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-surface pl-2 pr-1">
                      <span className="text-[0.7rem] text-neutral-400">{variant ? variant.currency : '₹'}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(event) => onUpdateItem(key, 'unitPrice', event.target.value)}
                        onBlur={onRoundBlur(key, 'unitPrice', { min: 0 })}
                        className="h-7 w-16 bg-transparent text-right text-xs font-semibold text-neutral-900 focus:outline-none"
                        aria-label={`Unit price for ${displayName}`}
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
                      onClick={() => onSetQuantity(product, quantity - 1, variant?.id)}
                      disabled={quantity === 0}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
                        isSelected ? 'hover:bg-white/20' : 'hover:bg-neutral-50'
                      }`}
                      aria-label={`Reduce ${displayName}`}
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <input
                      value={quantity}
                      disabled={!canAdd}
                      onChange={(event) => onSetQuantity(product, event.target.value, variant?.id)}
                      inputMode="numeric"
                      className="w-8 min-w-0 bg-transparent text-center text-xs font-semibold focus:outline-none"
                      aria-label={`${displayName} quantity`}
                    />
                    <button
                      type="button"
                      onClick={() => onSetQuantity(product, quantity + 1, variant?.id)}
                      disabled={!canAdd || isOutOfStock || (enforceVariantStock && Boolean(variant) && stock != null && quantity >= stock)}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
                        isSelected ? 'hover:bg-white/20' : 'hover:bg-neutral-50'
                      }`}
                      aria-label={`Add ${displayName}`}
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
