import { ListHeader, ListOverview, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, Eye, Package, PackagePlus, PowerOff, RotateCw, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { getExpiringBatches, getStockBoard, recordStockAdjustment } from '../../api/inventory'
import { listProducts } from '../../api/products'
import { getFileUrl } from '../../api/files'
import StockEntryForm from './StockEntryForm'

function ExpiringBatchesPanel() {
  const [batches, setBatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    getExpiringBatches({ within_days: 30 }).then((result) => {
      if (!isMounted) return
      if (result.success) setBatches(result.batches)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading || batches.length === 0) return null

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-5 py-3.5">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-amber-800">{batches.length} batch(es) expired or expiring within 30 days</p>
      </div>
      <div className="max-h-56 overflow-y-auto px-5 py-3">
        <table className="listing-table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
              <th className="py-6 pr-4">Product</th>
              <th className="py-6 pr-4">Batch</th>
              <th className="py-6 pr-4">Warehouse</th>
              <th className="py-6 pr-4">Qty</th>
              <th className="py-6 text-right">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {batches.map((batch, index) => (
              <tr key={batch.id || index}>
                <td className="py-2 pr-4 font-medium text-neutral-800">{batch.product_name || batch.product?.name || '—'}</td>
                <td className="py-2 pr-4 text-neutral-500">{batch.batch_number || '—'}</td>
                <td className="py-2 pr-4 text-neutral-500">{batch.warehouse_name || batch.warehouse?.name || '—'}</td>
                <td className="py-2 pr-4 text-neutral-600">{batch.quantity ?? batch.in_stock_quantity ?? '—'}</td>
                <td className="py-2 text-right">
                  <Badge variant={batch.is_expired ? 'danger' : 'warning'} dot>
                    {batch.is_expired ? 'Expired' : `${batch.days_to_expiry ?? '?'}d left`}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const stockStatusOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'inactive', label: 'Inactive' },
]

const sortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'stock-desc', label: 'Stock (High to Low)' },
  { value: 'stock-asc', label: 'Stock (Low to High)' },
  { value: 'sku-asc', label: 'SKU (A-Z)' },
  { value: 'recent', label: 'Recently Added' },
]

function sortItems(items, sortBy) {
  const sorted = [...items]

  switch (sortBy) {
    case 'name-desc':
      return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    case 'stock-desc':
      return sorted.sort((a, b) => (b.total_stock || 0) - (a.total_stock || 0))
    case 'stock-asc':
      return sorted.sort((a, b) => (a.total_stock || 0) - (b.total_stock || 0))
    case 'sku-asc':
      return sorted.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''))
    case 'recent':
      return sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    case 'name-asc':
    default:
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }
}

export default function StockBoard({ readOnly = false }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [adjustingProduct, setAdjustingProduct] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterTriggerRef = useRef(null)
  const filterCloseRef = useRef(null)

  useEffect(() => {
    if (!isFilterOpen) return
    const trigger = filterTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    filterCloseRef.current?.focus()
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsFilterOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      trigger?.focus()
    }
  }, [isFilterOpen])


  const categoryFilterOptions = useMemo(() => {
    const categories = items.reduce((options, item) => {
      const value = item.category_id || item.product_type
      if (!value || options.some((option) => option.value === value)) {
        return options
      }

      options.push({ value, label: item.product_type || value })
      return options
    }, [])

    return [{ value: 'all', label: 'All categories' }, ...categories]
  }, [items])

  const loadStock = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const [result, productsResult] = await Promise.all([
      getStockBoard({
        search: searchTerm.trim() || undefined,
        category_id: categoryFilter === 'all' ? undefined : categoryFilter,
      }),
      // The stock board endpoint doesn't return created_at - pull it from /products so
      // "Recently Added" sorting reflects a real timestamp instead of guessing from row order.
      listProducts(),
    ])

    if (!result.success) {
      setItems([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    // /inventory rows don't carry created_at or the product image - pull both from /products.
    const productMetaById = new Map(
      productsResult.success
        ? productsResult.products.map((product) => [
            product.id,
            {
              created_at: product.created_at,
              image: getFileUrl(
                product.cover_image ||
                  product.cover_image_url ||
                  (Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : '') ||
                  '',
              ),
            },
          ])
        : [],
    )

    setItems(
      result.items.map((item) => {
        const meta = productMetaById.get(item.id) || {}
        return { ...item, created_at: meta.created_at || null, image: meta.image || null }
      }),
    )
    setIsLoading(false)
  }, [categoryFilter, searchTerm])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  const stats = useMemo(
    () => ({
      totalProducts: items.length,
      totalStock: items.reduce((sum, item) => sum + (item.total_stock || 0), 0),
      outOfStock: items.filter((item) => (item.total_stock || 0) <= 0).length,
      inactive: items.filter((item) => !item.is_active).length,
    }),
    [items],
  )

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (statusFilter === 'active') return item.is_active
      if (statusFilter === 'inactive') return !item.is_active
      if (statusFilter === 'out') return (item.total_stock || 0) <= 0
      return true
    })

    return sortItems(filtered, sortBy)
  }, [items, statusFilter, sortBy])

  const handleOpenEntryForm = (item) => {
    setAdjustingProduct(item)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleCloseEntryForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setAdjustingProduct(null)
    setFormError('')
  }

  const handleSaveEntry = async (movements) => {
    setIsSaving(true)
    setFormError('')

    for (const movement of movements) {
      const result = await recordStockAdjustment(movement)

      if (!result.success) {
        setIsSaving(false)
        setFormError(result.error)
        return
      }
    }

    setIsSaving(false)
    setIsFormOpen(false)
    setAdjustingProduct(null)
    await loadStock()
  }

  if (isFormOpen && !readOnly) {
    return (
      <StockEntryForm
        isOpen={isFormOpen}
        onClose={handleCloseEntryForm}
        product={adjustingProduct}
        saving={isSaving}
        formError={formError}
        onSave={handleSaveEntry}
      />
    )
  }

  return (
    <div className="listing-page space-y-4">

      <ListOverview>
        <ListHeader>
          <div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Inventory</h1></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products, brands, SKU"
                aria-label="Search products, brands, SKU"
                className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Button ref={filterTriggerRef} type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)} aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="inventory-filter-panel">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
            </Button>
          </div>
        </ListHeader>
        <ListSummary className="grid-cols-2  lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Tracked Products" value={stats.totalProducts} />
        <StatCard icon={Package} iconVariant="info" label="Total Stock Units" value={stats.totalStock.toLocaleString()} />
        <StatCard icon={XCircle} iconVariant="danger" label="Out of Stock" value={stats.outOfStock} />
        <StatCard icon={PowerOff} iconVariant="warning" label="Inactive" value={stats.inactive} />
      </ListSummary>
      </ListOverview>

      {!readOnly && <ExpiringBatchesPanel />}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadStock}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading stock board..." />
          ) : filteredItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No stock items match these filters.</p>
          ) : (
            <table className="listing-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="whitespace-nowrap px-6 py-6">Product</th>
                  <th className="whitespace-nowrap px-6 py-6">SKU</th>
                  <th className="whitespace-nowrap px-6 py-6">Variants</th>
                  <th className="whitespace-nowrap px-6 py-6">Current Stock</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  {!readOnly && <th className="whitespace-nowrap px-6 py-6 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredItems.map((item) => {
                  const isOutOfStock = (item.total_stock || 0) <= 0

                  return (
                    <tr
                      key={item.id}
                      onClick={readOnly ? undefined : () => navigate(`/admin/inventory/${item.id}`)}
                      className={`bg-white transition-colors hover:bg-primary-50/30 ${readOnly ? '' : 'cursor-pointer'}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="relative size-9 shrink-0">
                            <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                              <Package className="size-4" aria-hidden="true" />
                            </span>
                            {item.image && (
                              <img
                                src={item.image}
                                alt=""
                                className="absolute inset-0 size-9 rounded-full object-cover ring-1 ring-primary-100"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-neutral-900">{item.name}</span>
                            {item.brand && <p className="mt-0.5 text-xs text-neutral-400">{item.brand}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-mono text-neutral-600">{item.sku || '—'}</td>
                      <td className="px-6 py-5 text-neutral-600">{item.variations?.length || 0}</td>
                      <td className="px-6 py-5">
                        <span className={isOutOfStock ? 'font-semibold text-red-600' : 'font-medium text-neutral-900'}>
                          {item.total_stock}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!item.is_active && <Badge variant="neutral">Inactive</Badge>}
                          {isOutOfStock ? (
                            <Badge variant="danger" dot>Out of Stock</Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </div>
                      </td>
                      {!readOnly && (
                        <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                          <ActionMenu
                            items={[
                              { label: 'View Details', icon: Eye, onClick: () => navigate(`/admin/inventory/${item.id}`) },
                              { label: 'Adjust Stock', icon: PackagePlus, onClick: () => handleOpenEntryForm(item) },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
          <span>
            {filteredItems.length === 0 ? '0' : `1 to ${filteredItems.length}`} of {items.length}
          </span>
          <span>Stock Items</span>
        </div>
      </Card>

      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="inventory-filter-title" id="inventory-filter-panel">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" tabIndex={-1} />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 id="inventory-filter-title" className="text-lg font-semibold text-neutral-900">Filter Inventory</h2>
                <p className="mt-0.5 text-xs text-neutral-400">Refine the products shown in the table.</p>
              </div>
              <button ref={filterCloseRef} type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close filters">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <Select label="Category" options={categoryFilterOptions} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} />
              <Select label="Sort by" options={sortOptions} value={sortBy} onChange={(event) => setSortBy(event.target.value)} />
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-neutral-700">Stock status</legend>
                {stockStatusOptions.map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${statusFilter === option.value ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-neutral-100 text-neutral-700 hover:bg-neutral-50'}`}>
                    <input type="radio" name="inventory-stock-status" value={option.value} checked={statusFilter === option.value} onChange={() => setStatusFilter(option.value)} className="size-4 accent-primary-600 focus-visible:outline-primary-500" />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <button type="button" onClick={() => { setCategoryFilter('all'); setSortBy('name-asc'); setStatusFilter('all'); setSearchTerm('') }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
              <Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
