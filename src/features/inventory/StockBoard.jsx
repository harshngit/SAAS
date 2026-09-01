import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, Eye, Package, PackagePlus, PowerOff, RotateCw, Search, XCircle } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { getExpiringBatches, getStockBoard, recordStockAdjustment } from '../../api/inventory'
import { listProducts } from '../../api/products'
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-400">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Batch</th>
              <th className="py-2 pr-4">Warehouse</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 text-right">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
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

const stockStatusTabs = [
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

    const createdAtById = new Map(
      productsResult.success ? productsResult.products.map((product) => [product.id, product.created_at]) : [],
    )

    setItems(result.items.map((item) => ({ ...item, created_at: createdAtById.get(item.id) || null })))
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Tracked Products" value={stats.totalProducts} />
        <StatCard icon={Package} iconVariant="info" label="Total Stock Units" value={stats.totalStock.toLocaleString()} />
        <StatCard icon={XCircle} iconVariant="danger" label="Out of Stock" value={stats.outOfStock} />
        <StatCard icon={PowerOff} iconVariant="warning" label="Inactive" value={stats.inactive} />
      </div>

      {!readOnly && <ExpiringBatchesPanel />}

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-wrap gap-5">
            {stockStatusTabs.map((tab) => {
              const isActive = statusFilter === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`relative py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search products, brands, SKU"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={categoryFilterOptions}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="sm:w-52"
              />
              <Select
                options={sortOptions}
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="sm:w-48"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Product</th>
                  <th className="whitespace-nowrap px-4 py-3">SKU</th>
                  <th className="whitespace-nowrap px-4 py-3">Variants</th>
                  <th className="whitespace-nowrap px-4 py-3">Current Stock</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  {!readOnly && <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isOutOfStock = (item.total_stock || 0) <= 0

                  return (
                    <tr
                      key={item.id}
                      onClick={readOnly ? undefined : () => navigate(`/admin/inventory/${item.id}`)}
                      className={`bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35 ${readOnly ? '' : 'cursor-pointer'}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                            <Package className="size-4" aria-hidden="true" />
                          </div>
                          <div>
                            <span className="font-medium text-neutral-900">{item.name}</span>
                            {item.brand && <p className="mt-0.5 text-xs text-neutral-400">{item.brand}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-neutral-600">{item.sku || '—'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{item.variations?.length || 0}</td>
                      <td className="px-4 py-3.5">
                        <span className={isOutOfStock ? 'font-semibold text-red-600' : 'font-medium text-neutral-900'}>
                          {item.total_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
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
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
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
    </div>
  )
}
