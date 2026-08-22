import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Eye, Package, Plus, Power, RotateCw, ScanBarcode, Search, Trash2 } from 'lucide-react'
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

export default function ProductList() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [searchTerm, setSearchTerm] = useState('')
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
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-5">
              {productStatusTabs.map((tab) => {
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
            <Button onClick={handleAddProduct} size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={handleBarcodeScan} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(event) => {
                    setBarcodeInput(event.target.value)
                    setBarcodeError('')
                  }}
                  placeholder="Scan or enter barcode"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" loading={isScanningBarcode} disabled={!barcodeInput.trim()}>
                Find
              </Button>
            </form>
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
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'oldest', label: 'Oldest' },
                ]}
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value)}
                className="sm:w-40"
              />
            </div>
          </div>
          {barcodeError && <p className="mt-2 text-xs text-red-600">{barcodeError}</p>}
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Product</th>
                  <th className="whitespace-nowrap px-4 py-3">Brand</th>
                  <th className="whitespace-nowrap px-4 py-3">Category</th>
                  <th className="whitespace-nowrap px-4 py-3">Variants</th>
                  <th className="whitespace-nowrap px-4 py-3">Price</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <Package className="size-4" aria-hidden="true" />
                        </div>
                        <span className="font-medium text-neutral-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{product.brand}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{product.categoryLabel || product.category || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {product.variants.length} {product.variants.length === 1 ? 'size' : 'sizes'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-neutral-700">
                      {formatCurrency(Number(product.price ?? product.variants?.[0]?.sellingPrice ?? 0))}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={product.status === 'active' ? 'success' : 'danger'}>
                        {product.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
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

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredProducts.length === 0 ? '0' : `1 to ${filteredProducts.length}`} of {products.length}
          </span>
          <span>Products</span>
        </div>
      </Card>

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
