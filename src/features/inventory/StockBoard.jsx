import { ListOverview, ListSummary, ListStatCard as StatCard } from '../../components/ui/ListPresentation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, ChevronLeft, ChevronRight, Eye, Package, PackagePlus, PowerOff, RotateCw, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { getExpiringBatches, getStockBoard, recordStockAdjustment } from '../../api/inventory'
import { listCategories } from '../../api/categories'
import { loadSummaryRows } from '../../utils/listSummary'
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
            <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
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

// The server filters on is_active only (GET /inventory has no out-of-stock parameter), so only those are offered.
const stockStatusOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const DEFAULT_FILTERS = { status: 'all', category: 'all', sortBy: 'name-asc' }

// UI sort key -> /inventory sort_by + sort_order
const SORT_PARAMS = {
  'name-asc': { sort_by: 'name', sort_order: 'asc' },
  'name-desc': { sort_by: 'name', sort_order: 'desc' },
  'stock-desc': { sort_by: 'total_stock', sort_order: 'desc' },
  'stock-asc': { sort_by: 'total_stock', sort_order: 'asc' },
  'sku-asc': { sort_by: 'sku', sort_order: 'asc' },
  'sku-desc': { sort_by: 'sku', sort_order: 'desc' },
  recent: { sort_by: 'created_at', sort_order: 'desc' },
}

const sortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'stock-desc', label: 'Stock (High to Low)' },
  { value: 'stock-asc', label: 'Stock (Low to High)' },
  { value: 'sku-asc', label: 'SKU (A-Z)' },
  { value: 'sku-desc', label: 'SKU (Z-A)' },
  { value: 'recent', label: 'Recently Added' },
]

// Column-header clicks (SortableHeaderCell) toggle between the asc/desc pair for the clicked
// column, reusing this same sortBy string + sortItems() that the existing "Sort by" toolbar
// dropdown already drives - one sort mechanism, two entry points, not a parallel system.
const HEADER_SORT_KEYS = {
  name: { asc: 'name-asc', desc: 'name-desc' },
  stock: { asc: 'stock-asc', desc: 'stock-desc' },
  sku: { asc: 'sku-asc', desc: 'sku-desc' },
}

export default function StockBoard({ readOnly = false }) {
  const navigate = useNavigate()
  // Server-side list: one page of rows + the backend's paging numbers. Nothing here filters or sorts rows locally.
  const [items, setItems] = useState([])
  const [paging, setPaging] = useState({ total: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')
  // Search is live (debounced) and always applied; the filter drawer works on a DRAFT that only becomes the APPLIED filters
  // when "Apply filters" is pressed, so opening the drawer and picking values never changes the table by itself.
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS)
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [summaryRows, setSummaryRows] = useState([])
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const requestId = useRef(0)
  const sortBy = appliedFilters.sortBy
  const activeHeaderSortKey = Object.keys(HEADER_SORT_KEYS).find(
    (key) => HEADER_SORT_KEYS[key].asc === sortBy || HEADER_SORT_KEYS[key].desc === sortBy,
  ) || null
  const activeHeaderSortOrder = sortBy.endsWith('-desc') ? 'desc' : 'asc'

  const handleHeaderSort = (key) => {
    const pair = HEADER_SORT_KEYS[key]
    if (!pair) return
    const nextSort = sortBy === pair.asc ? pair.desc : pair.asc
    setAppliedFilters((current) => ({ ...current, sortBy: nextSort }))
    setDraftFilters((current) => ({ ...current, sortBy: nextSort }))
    setPage(1)
  }
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
      if (event.key === 'Escape') closeFilterDrawer()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
      trigger?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFilterOpen])

  // Closing the drawer without pressing Apply drops the draft: the table keeps showing the applied filters.
  const closeFilterDrawer = () => {
    setIsFilterOpen(false)
    setDraftFilters(appliedFilters)
  }

  const applyDraftFilters = () => {
    setAppliedFilters(draftFilters)
    setPage(1)
    setIsFilterOpen(false)
  }

  const hasActiveFilters = Boolean(searchTerm) || appliedFilters.status !== 'all' || appliedFilters.category !== 'all' || appliedFilters.sortBy !== DEFAULT_FILTERS.sortBy

  // Clear Filters: search, status, category and sort back to the defaults, page 1, normal unfiltered list.
  const clearAllFilters = () => {
    setSearchInput('')
    setSearchTerm('')
    setAppliedFilters(DEFAULT_FILTERS)
    setDraftFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  // Debounced server search: wait for a pause in typing, then go back to page 1.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === searchTerm) return undefined
    const timer = setTimeout(() => {
      setSearchTerm(trimmed)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput, searchTerm])

  // Category options for the filter come from the categories API - not from whichever rows happen to be on this page.
  useEffect(() => {
    let isMounted = true
    listCategories().then((result) => {
      if (!isMounted || !result.success) return
      const byId = new Map(result.categories.map((category) => [category.id, category]))
      setCategoryOptions(
        result.categories
          .map((category) => {
            const name = category.name || category.category_name || ''
            const parentId = category.parent_id || category.parentId || ''
            const parentName = category.parent_name || (parentId ? byId.get(parentId)?.name : '') || ''
            return { value: String(category.id), label: parentId && parentName ? `${parentName} › ${name}` : name }
          })
          .filter((option) => option.value && option.label),
      )
    })
    return () => {
      isMounted = false
    }
  }, [])

  const categoryFilterOptions = useMemo(() => [{ value: 'all', label: 'All categories' }, ...categoryOptions], [categoryOptions])

  // GET /inventory?page=&page_size=&search=&category_id=&is_active=&sort_by=&sort_order= - one page per request.
  const loadStock = useCallback(async () => {
    const thisRequest = ++requestId.current
    setIsLoading(true)
    setListError('')

    const result = await getStockBoard({
      page,
      page_size: Number(pageSize),
      search: searchTerm || undefined,
      category_id: appliedFilters.category === 'all' ? undefined : appliedFilters.category,
      is_active: appliedFilters.status === 'all' ? undefined : appliedFilters.status === 'active',
      ...SORT_PARAMS[appliedFilters.sortBy],
    })
    if (thisRequest !== requestId.current) return // a newer request (typing / paging) already took over

    if (!result.success) {
      setItems([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    // The page the person is on no longer exists (rows were removed): go to the last page that does.
    if (result.items.length === 0 && result.total > 0 && page > result.totalPages) {
      setPage(result.totalPages)
      return
    }

    setItems(result.items.map((item) => ({ ...item, image: item.cover_image ? getFileUrl(item.cover_image) : null })))
    setPaging({ total: result.total, totalPages: result.totalPages })
    setIsLoading(false)
  }, [page, pageSize, searchTerm, appliedFilters])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  // The cards describe the WHOLE inventory, not the page on screen: they read every page (100 rows each) once,
  // independent of search / filters / paging, and refresh after a stock adjustment.
  const loadSummary = useCallback(async () => {
    setIsSummaryLoading(true)
    const result = await loadSummaryRows(getStockBoard, 'items')
    if (result.success) setSummaryRows(result.items)
    setIsSummaryLoading(false)
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const stats = useMemo(
    () => ({
      totalProducts: summaryRows.length,
      totalStock: summaryRows.reduce((sum, item) => sum + (item.total_stock || 0), 0),
      outOfStock: summaryRows.filter((item) => (item.total_stock || 0) <= 0).length,
      inactive: summaryRows.filter((item) => !item.is_active).length,
    }),
    [summaryRows],
  )

  const currentPage = Math.min(page, paging.totalPages)
  const rangeStart = paging.total === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(paging.total, rangeStart + items.length - 1)

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
    await Promise.all([loadStock(), loadSummary()])
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

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Inventory</h1>
      </div>

      <ListOverview>
        <ListSummary loading={isSummaryLoading} className="grid-cols-2  lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Tracked Products" value={stats.totalProducts} />
        <StatCard icon={Package} iconVariant="info" label="Total Stock Units" value={stats.totalStock.toLocaleString()} />
        <StatCard icon={XCircle} iconVariant="danger" label="Out of Stock" value={stats.outOfStock} />
        <StatCard icon={PowerOff} iconVariant="warning" label="Inactive" value={stats.inactive} />
      </ListSummary>
      </ListOverview>

      {!readOnly && <ExpiringBatchesPanel />}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-xl font-semibold tracking-tight text-neutral-900">Inventory</h2></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search products, brands, SKU"
                  aria-label="Search products, brands, SKU"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Button ref={filterTriggerRef} type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => { setDraftFilters(appliedFilters); setIsFilterOpen(true) }} aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="inventory-filter-panel">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filter
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={clearAllFilters}>
                  <X className="size-4" aria-hidden="true" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto bg-surface px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadStock}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner variant="table" columns={["Product", "SKU", "Variants", "Current Stock", "Status", "Action"]} label="Loading stock board..." />
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No stock items match these filters.</p>
          ) : (
            <table className="listing-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <SortableHeaderCell label="Product" sortKey="name" sortBy={activeHeaderSortKey} sortOrder={activeHeaderSortOrder} onSort={handleHeaderSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="SKU" sortKey="sku" sortBy={activeHeaderSortKey} sortOrder={activeHeaderSortOrder} onSort={handleHeaderSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Variants</th>
                  <SortableHeaderCell label="Current Stock" sortKey="stock" sortBy={activeHeaderSortKey} sortOrder={activeHeaderSortOrder} onSort={handleHeaderSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  {!readOnly && <th className="whitespace-nowrap px-6 py-6 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item) => {
                  const isOutOfStock = (item.total_stock || 0) <= 0

                  return (
                    <tr
                      key={item.id}
                      onClick={readOnly ? undefined : () => navigate(`/admin/inventory/${item.id}`)}
                      className={`bg-surface transition-colors hover:bg-primary-50/30 ${readOnly ? '' : 'cursor-pointer'}`}
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
                            {item.brand && <p className="mt-0.5 text-3xs text-neutral-400">{item.brand}</p>}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span>Showing <span className="font-semibold text-fg">{rangeStart}-{rangeEnd < rangeStart ? rangeStart - 1 : rangeEnd}</span> of <span className="font-semibold text-fg">{paging.total}</span></span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page<Select options={PAGE_SIZE_OPTIONS} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-surface py-1 text-xs" /></label>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
            <span className="min-w-14 text-center font-medium text-fg">{currentPage} / {paging.totalPages}</span>
            <button type="button" disabled={currentPage >= paging.totalPages || isLoading} onClick={() => setPage((value) => Math.min(paging.totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </Card>

      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="inventory-filter-title" id="inventory-filter-panel">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={closeFilterDrawer} aria-label="Close filters" tabIndex={-1} />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-(--modal-bg) shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 id="inventory-filter-title" className="text-lg font-semibold text-neutral-900">Filter Inventory</h2>
                <p className="mt-0.5 text-xs text-neutral-400">Refine the products shown in the table.</p>
              </div>
              <button ref={filterCloseRef} type="button" onClick={closeFilterDrawer} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close filters">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <Select label="Category" options={categoryFilterOptions} value={draftFilters.category} onChange={(event) => setDraftFilters((current) => ({ ...current, category: event.target.value }))} />
              <Select label="Sort by" options={sortOptions} value={draftFilters.sortBy} onChange={(event) => setDraftFilters((current) => ({ ...current, sortBy: event.target.value }))} />
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-neutral-700">Stock status</legend>
                {stockStatusOptions.map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${draftFilters.status === option.value ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-neutral-100 text-neutral-700 hover:bg-neutral-50'}`}>
                    <input type="radio" name="inventory-stock-status" value={option.value} checked={draftFilters.status === option.value} onChange={() => setDraftFilters((current) => ({ ...current, status: option.value }))} className="size-4 accent-primary-600 focus-visible:outline-primary-500" />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <button type="button" onClick={() => { clearAllFilters(); setIsFilterOpen(false) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
              <Button type="button" onClick={applyDraftFilters}>Apply filters</Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
