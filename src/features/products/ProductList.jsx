import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Eye, Package, Plus, Power, RotateCw, Search, Trash2 } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { createProduct, listProducts } from '../../api/products'
import { formatCurrency } from '../../utils/format'
import ProductForm from './ProductForm'

const productStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const priceRange = (variants) => {
  if (!variants?.length) {
    return formatCurrency(0)
  }

  const prices = variants.map((variant) => variant.sellingPrice)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`
}

const normalizeApiProduct = (product, fallback = {}) => ({
  ...fallback,
  id: product.id || fallback.id,
  name: product.name || fallback.name,
  brand: product.brand || fallback.brand || '',
  sku: product.sku || fallback.sku || fallback.variants?.[0]?.sku || '',
  categoryId: product.category_id || fallback.categoryId || fallback.category_id || fallback.category || '',
  category: fallback.category || product.product_type || product.category_id || '',
  status: product.is_active === false ? 'inactive' : 'active',
  description: product.description || fallback.description || '',
  variants: (product.variations?.length ? product.variations : fallback.variants || []).map((variant) => ({
    size: variant.name || variant.size || '',
    sku: variant.sku || fallback.sku || '',
    hsn: variant.hsn || '',
    unit: variant.unit || 'Bottle',
    gstRate: variant.gstRate || 0,
    purchasePrice: variant.purchasePrice || 0,
    sellingPrice: Number(variant.price ?? variant.sellingPrice) || 0,
    inventory: Number(variant.inventory) || 0,
  })),
})

export default function ProductList() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [statusProduct, setStatusProduct] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const categoryFilterOptions = useMemo(
    () => {
      const categories = products.reduce((options, product) => {
        const value = product.categoryId || product.category
        if (!value || options.some((option) => option.value === value)) {
          return options
        }

        options.push({ value, label: product.category || value })
        return options
      }, [])

      return [{ value: 'all', label: 'All categories' }, ...categories]
    },
    [products],
  )

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

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          product.name,
          product.brand,
          product.sku,
          product.category,
          ...product.variants.map((variant) => variant.sku),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesCategory =
        categoryFilter === 'all' || product.categoryId === categoryFilter || product.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, products, searchTerm, statusFilter])

  const handleAddProduct = () => {
    setEditingProduct(null)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleDeleteProduct = (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter((product) => product.id !== id))
    }
  }

  const handleSaveProduct = async (productData) => {
    setIsSaving(true)
    setFormError('')

    if (editingProduct) {
      setProducts(
        products.map((product) =>
          product.id === editingProduct.id ? { ...product, ...productData, id: editingProduct.id } : product,
        ),
      )
      setIsSaving(false)
      setIsFormOpen(false)
      return
    }

    const createResult = await createProduct(productData)

    if (!createResult.success) {
      setFormError(createResult.error)
      setIsSaving(false)
      return
    }

    setProducts((current) => [normalizeApiProduct(createResult.product, productData), ...current])
    setIsSaving(false)
    setIsFormOpen(false)
  }

  const handleToggleStatus = () => {
    if (!statusProduct) return

    setProducts((current) =>
      current.map((product) =>
        product.id === statusProduct.id
          ? { ...product, status: product.status === 'active' ? 'inactive' : 'active' }
          : product,
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
          setIsFormOpen(false)
        }}
        product={editingProduct}
        onSave={handleSaveProduct}
        saving={isSaving}
        formError={formError}
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
            </div>
          </div>
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
                  <th className="whitespace-nowrap px-4 py-3">Price Range</th>
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
                    <td className="px-4 py-3.5 text-neutral-600">{product.category}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {product.variants.length} {product.variants.length === 1 ? 'size' : 'sizes'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-neutral-700">{priceRange(product.variants)}</td>
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
                            onClick: () => handleDeleteProduct(product.id),
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
        onClose={() => setStatusProduct(null)}
        title={`${statusProduct?.status === 'active' ? 'Deactivate' : 'Activate'} Product`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {statusProduct?.status === 'active'
              ? 'This product will be hidden from new orders. Existing invoices and stock records will remain unchanged.'
              : 'This product will be marked active and available for sales and inventory workflows again.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setStatusProduct(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusProduct?.status === 'active' ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
            >
              {statusProduct?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
