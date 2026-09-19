import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Edit, Eye, Package, Plus, Power, RotateCw, ScanBarcode, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { listCategories } from '../../api/categories'
import { createProduct, deleteProduct, listProducts, updateProduct } from '../../api/products'
import { formatCurrency } from '../../utils/format'
import { normalizeApiProduct } from './productUtils'
import ProductForm from './ProductForm'

const productStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function ProductThumbnail({ src, alt }) {
  const [hasError, setHasError] = useState(false)

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className="size-9 shrink-0 rounded-full border border-neutral-100 object-cover"
      />
    )
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
      <Package className="size-4" aria-hidden="true" />
    </div>
  )
}

export default function ProductList() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [statusProduct, setStatusProduct] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formErrorFields, setFormErrorFields] = useState([])
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanningBarcode, setIsScanningBarcode] = useState(false)
  const [barcodeError, setBarcodeError] = useState('')

  const categoryFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...categoryOptions],
    [categoryOptions],
  )

  const loadCategoryOptions = useCallback(async () => {
    const result = await listCategories()

    if (!result.success) {
      return
    }

    setCategoryOptions(
      result.categories
        .map((category) => ({
          value: String(category.id),
          label: category.name || category.category_name || '',
        }))
        .filter((option) => option.value && option.label),
    )
  }, [])

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listProducts({
      search: searchTerm.trim() || undefined,
      category_id: categoryFilter === 'all' ? undefined : categoryFilter,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    })

    if (!result.success) {
      setProducts([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setProducts(result.products.map((product) => normalizeApiProduct(product)))
    setIsLoading(false)
  }, [categoryFilter, searchTerm, statusFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadCategoryOptions()
  }, [loadCategoryOptions])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          product.name,
          product.brand,
          product.sku,
          product.categoryLabel || product.category,
          ...product.variants.map((variant) => variant.sku),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesCategory =
        categoryFilter === 'all' || product.categoryId === categoryFilter || product.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime()
      const rightTime = new Date(right.createdAt || 0).getTime()

      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [categoryFilter, products, searchTerm, sortFilter, statusFilter])

  const productSummary = useMemo(() => ({
    total: filteredProducts.length,
    active: filteredProducts.filter((product) => product.status === 'active').length,
    inactive: filteredProducts.filter((product) => product.status !== 'active').length,
    value: filteredProducts.reduce((sum, product) => sum + Number(product.price ?? product.variants?.[0]?.sellingPrice ?? 0), 0),
  }), [filteredProducts])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleProducts = filteredProducts.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredProducts.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredProducts.length, currentPage * Number(pageSize))
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.includes(product.id))

  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleProducts.some((product) => product.id === id))
    : [...new Set([...current, ...visibleProducts.map((product) => product.id)])])

  const exportProductsCsv = (onlySelected = false) => {
    const rows = [['Product', 'Brand', 'Category', 'Variants', 'Price', 'Status'], ...filteredProducts.filter((product) => !onlySelected || selectedIds.includes(product.id)).map((product) => [product.name, product.brand, product.categoryLabel || product.category, product.variants.length, formatCurrency(Number(product.price ?? product.variants?.[0]?.sellingPrice ?? 0)), product.status])]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'products.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected product${selectedIds.length === 1 ? '' : 's'}?`)) return
    setIsDeleting(true)
    const results = await Promise.all(selectedIds.map((id) => deleteProduct(id)))
    const failed = results.find((result) => !result.success)
    if (failed) { setDeleteError(failed.error || 'Some products could not be deleted.'); setIsDeleting(false); return }
    setProducts((current) => current.filter((product) => !selectedIds.includes(product.id))); setSelectedIds([]); setIsDeleting(false)
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    setFormError('')
    setFormErrorFields([])
    setIsFormOpen(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setFormError('')
    setFormErrorFields([])
    setIsFormOpen(true)
  }

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteProduct(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setProducts((current) => current.filter((product) => product.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const handleSaveProduct = async (productData) => {
    setIsSaving(true)
    setFormError('')
    setFormErrorFields([])

    const result = editingProduct
      ? await updateProduct(editingProduct.id, productData)
      : await createProduct(productData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      setFormErrorFields(result.errorFields || [])
      return
    }

    setProducts((current) =>
      editingProduct
        ? current.map((product) =>
            product.id === editingProduct.id ? normalizeApiProduct(result.product, productData) : product,
          )
        : [normalizeApiProduct(result.product, productData), ...current],
    )
    setIsFormOpen(false)
  }

  const handleBarcodeScan = async (event) => {
    event.preventDefault()
    const barcode = barcodeInput.trim()
    if (!barcode) return

    setIsScanningBarcode(true)
    setBarcodeError('')

    const result = await listProducts({ barcode })

    setIsScanningBarcode(false)

    if (!result.success) {
      setBarcodeError(result.error)
      return
    }

    const [match] = result.products
    if (!match) {
      setBarcodeError(`No product found for barcode "${barcode}".`)
      return
    }

    setBarcodeInput('')
    navigate(`/admin/products/${match.id}`)
  }

  const handleToggleStatus = async () => {
    if (!statusProduct) return

    const nextIsActive = statusProduct.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

    const result = await updateProduct(statusProduct.id, { isActive: nextIsActive })

    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === statusProduct.id ? normalizeApiProduct(result.product, product) : product,
      ),
    )
    setStatusProduct(null)
  }

  if (isFormOpen) {
    return (
      <ProductForm
        isOpen={isFormOpen}
        onClose={() => {
          if (isSaving) return
          setFormError('')
          setFormErrorFields([])
          setIsFormOpen(false)
        }}
        product={editingProduct}
        onSave={handleSaveProduct}
        saving={isSaving}
        formError={formError}
        formErrorFields={formErrorFields}
        catalogProducts={products}
      />
    )
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Products</h1><p className="mt-1 text-xs text-neutral-400">{filteredProducts.length} products in view</p></div>
            <div className="flex flex-wrap items-center justify-end gap-2"><div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search products..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" />Filter</Button><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportProductsCsv()}><Download className="size-4" />Export</Button><Button onClick={handleAddProduct} size="sm" className="h-9 rounded-2xl px-3.5"><Plus className="size-4" />Add Product</Button></div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
          {[
            { label: 'Total Products', value: productSummary.total, detail: `${productSummary.active} active`, icon: Package },
            { label: 'Active Products', value: productSummary.active, detail: 'currently active', icon: Power },
            { label: 'Inactive Products', value: productSummary.inactive, detail: 'needs review', icon: Package },
            { label: 'Catalog Value', value: formatCurrency(productSummary.value), detail: 'current total', icon: ScanBarcode },
          ].map(({ label, value, detail, icon: Icon }, index) => (
            <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#6b86ad]">{label}</p><span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" /></span></div><p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p></div>
          ))}
        </div>
      </Card>

      {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3"><p className="text-sm font-medium text-primary-900">{selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportProductsCsv(true)}><Download className="size-4" />Download</Button><Button type="button" variant="danger" size="sm" className="h-8 rounded-lg px-3" loading={isDeleting} onClick={handleBulkDelete}><Trash2 className="size-4" />Delete</Button></div></div>}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadProducts}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading products..." />
          ) : products.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No products yet</p>
              <p className="mt-1 text-sm text-neutral-500">
                Create the first product to begin tracking variants, pricing, and inventory.
              </p>
              <Button type="button" className="mt-4" onClick={handleAddProduct}>
                <Plus className="size-4" aria-hidden="true" />
                Add Product
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No products match these filters.</p>
          ) : (
            <table className="listing-table w-full min-w-[64rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all products" /></th>
                  <th className="whitespace-nowrap px-6 py-6">Product</th><th className="whitespace-nowrap px-6 py-6">Brand</th><th className="whitespace-nowrap px-6 py-6">Category</th><th className="whitespace-nowrap px-6 py-6">Variants</th><th className="whitespace-nowrap px-6 py-6">Price</th><th className="whitespace-nowrap px-6 py-6">Status</th><th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => setSelectedIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${product.name}`} /></td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <ProductThumbnail src={product.coverImage} alt={product.name} />
                        <span className="font-medium text-neutral-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{product.brand}</td>
                    <td className="px-6 py-5 text-neutral-600">{product.categoryLabel || product.category || '-'}</td>
                    <td className="px-6 py-5 text-neutral-600">
                      {product.variants.length} {product.variants.length === 1 ? 'size' : 'sizes'}
                    </td>
                    <td className="px-6 py-5 font-medium text-neutral-700">
                      {formatCurrency(Number(product.price ?? product.variants?.[0]?.sellingPrice ?? 0))}
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={product.status === 'active' ? 'success' : 'danger'}>
                        {product.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View details', icon: Eye, onClick: () => navigate(`/admin/products/${product.id}`) },
                          { label: 'Edit', icon: Edit, onClick: () => handleEditProduct(product) },
                          {
                            label: product.status === 'active' ? 'Deactivate' : 'Activate',
                            icon: Power,
                            onClick: () => setStatusProduct(product),
                          },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(product),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredProducts.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button></div>
        </div>
      </Card>

      {isFilterOpen && <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Product filters"><button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" /><aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-neutral-900">Filter Products</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the products shown in the table.</p></div><button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button></div><div className="flex-1 space-y-5 overflow-y-auto px-5 py-6"><label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status<Select options={productStatusTabs} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} /></label><label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Category<Select options={categoryFilterOptions} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} /></label><label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort<Select options={[{ value: 'recent', label: 'Recent' }, { value: 'oldest', label: 'Oldest' }]} value={sortFilter} onChange={(event) => { setSortFilter(event.target.value); setPage(1) }} /></label></div><div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSortFilter('recent'); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div></aside></div>}

      <Modal
        isOpen={Boolean(statusProduct)}
        onClose={() => {
          if (isUpdatingStatus) return
          setStatusError('')
          setStatusProduct(null)
        }}
        title={`${statusProduct?.status === 'active' ? 'Deactivate' : 'Activate'} Product`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {statusProduct?.status === 'active'
              ? 'This product will be hidden from new orders. Existing invoices and stock records will remain unchanged.'
              : 'This product will be marked active and available for sales and inventory workflows again.'}
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingStatus}
              onClick={() => {
                setStatusError('')
                setStatusProduct(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusProduct?.status === 'active' ? 'danger' : 'primary'}
              loading={isUpdatingStatus}
              onClick={handleToggleStatus}
            >
              {statusProduct?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Product"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.name || 'this product'}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteProduct}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
