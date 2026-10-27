import { listCategories } from '../../api/categories'
import { usePermission } from '../../auth/usePermission'
import { syncBrandCategories } from './brandCategoryMappings'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Award, Check, Download, Edit, Eye, Filter, Plus, RotateCw, Search, Trash2, X } from 'lucide-react'
import {
  createBrand,
  deleteBrand,
  deleteBrandsBulk,
  listBrands,
  updateBrand,
} from '../../api/brands'
import { listProducts } from '../../api/products'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'

const emptyForm = {
  name: '',
  description: '',
  isActive: true,
  categoryIds: [],
}

const normalizeBrand = (brand) => ({
  id: brand.id,
  name: brand.name || '',
  description: brand.description || '',
  categories: Array.isArray(brand.categories) ? brand.categories : [],
  isActive: brand.is_active !== false,
  createdAt: brand.created_at || brand.createdAt || '',
})

function BrandForm({ brand, persistedBrandId, existingBrands, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const { can } = usePermission()
  const canMapCategories = can('products', 'edit')
  const [topCategories, setTopCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(canMapCategories)
  const [categoriesError, setCategoriesError] = useState('')
  const [categoryReload, setCategoryReload] = useState(0)

  useEffect(() => {
    if (!canMapCategories) return undefined
    let cancelled = false
    setCategoriesLoading(true)
    setCategoriesError('')
    listCategories().then((result) => {
      if (cancelled) return
      setCategoriesLoading(false)
      if (!result.success) { setCategoriesError(result.error); return }
      setTopCategories(result.categories.filter((category) => !(category.parent_id || category.parentId)).map((category) => ({ id: category.id, name: category.name || category.category_name || '' })))
    })
    return () => { cancelled = true }
  }, [canMapCategories, categoryReload])

  useEffect(() => {
    setFormData(brand ? { ...emptyForm, ...brand, categoryIds: brand.categories.map((category) => category.id) } : emptyForm)
    setErrors({})
  }, [brand])

  const validate = () => {
    const nextErrors = {}
    const name = formData.name.trim()
    const duplicate = existingBrands.some(
      (item) => item.id !== (brand?.id || persistedBrandId) && item.name.trim().toLowerCase() === name.toLowerCase(),
    )

    if (!name) nextErrors.name = 'Enter a valid brand name.'
    if (duplicate) nextErrors.name = 'Brand name already exists.'

    if (canMapCategories && formData.categoryIds.some((id) => !topCategories.some((category) => category.id === id))) nextErrors.categories = 'Remove unavailable Categories. Only top-level Categories can be assigned.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (saving || (canMapCategories && (categoriesLoading || categoriesError)) || !validate()) return
    onSave({ ...formData, categoryIds: canMapCategories ? formData.categoryIds : undefined, topCategories })
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={saving} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <Input
        label="Brand Name"
        placeholder="Enter brand name"
        value={formData.name}
        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
        error={errors.name}
        required
      />
      <div className="flex flex-col gap-1.5">
        <Input
          as="textarea"
          label="Description"
          placeholder="Enter a short description about this brand..."
          maxLength={500}
          value={formData.description}
          onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
          inputClassName="min-h-24"
        />
        <p className="text-right text-xs font-medium text-neutral-400">{formData.description.length} / 500</p>
      </div>
      <div className="space-y-2">
        <Select key={formData.categoryIds.join(',')} label="Applicable Categories" searchable value=""
          disabled={!canMapCategories || categoriesLoading || Boolean(categoriesError)}
          placeholder={categoriesLoading ? 'Loading Categories...' : 'Add a Category'}
          options={topCategories.filter((category) => !formData.categoryIds.includes(category.id)).map((category) => ({ value: category.id, label: category.name }))}
          onChange={(event) => { if (event.target.value) setFormData((current) => ({ ...current, categoryIds: [...new Set([...current.categoryIds, event.target.value])] })) }} />
        <p className="text-xs leading-5 text-neutral-500">If no Categories are assigned, this Brand remains available through the default fallback for unmapped Categories.</p>
        {formData.categoryIds.length > 0 && <div className="flex flex-wrap items-center gap-2">
          {formData.categoryIds.map((id) => {
            const name = topCategories.find((category) => category.id === id)?.name || brand?.categories.find((category) => category.id === id)?.name || 'Unavailable Category'
            return <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-sm text-primary-700">
              <span title={name} className="max-w-56 truncate">{name}</span>
              {canMapCategories && <button type="button" aria-label={`Remove Category ${name}`} className="rounded p-1 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-primary-500"
                onClick={() => setFormData((current) => ({ ...current, categoryIds: current.categoryIds.filter((value) => value !== id) }))}><X className="size-3.5" aria-hidden="true" /></button>}
            </span>
          })}
          {canMapCategories && <Button type="button" variant="ghost" size="sm" onClick={() => setFormData((current) => ({ ...current, categoryIds: [] }))}>Clear mappings</Button>}
        </div>}
        {errors.categories && <p role="alert" className="text-xs text-red-600">{errors.categories}</p>}
        {categoriesError && <div className="flex items-center gap-2"><p role="alert" className="text-sm text-red-600">{categoriesError}</p><Button type="button" variant="ghost" size="sm" onClick={() => setCategoryReload((value) => value + 1)}>Retry</Button></div>}
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
        />
        Active
      </label>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={canMapCategories && (categoriesLoading || Boolean(categoriesError))}>
          {brand ? 'Save Changes' : (
            <>
              <Check className="size-4" aria-hidden="true" />
              Save Brand
            </>
          )}
        </Button>
      </div>
      </fieldset>
    </form>
  )
}

export default function BrandList() {
  const [brands, setBrands] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const pendingBrandId = useRef('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  // Product count per brand - derived from the existing listProducts() API (one call for the
  // whole page, not per row), never a fake/invented number. Absent entries just show '-'.
  const [productCountByBrandId, setProductCountByBrandId] = useState({})
  // GET /brands has no sort_by/sort_order support (confirmed against the live backend contract)
  // and this page already loads its full matching set in one call (no server pagination) - so
  // sorting here is done locally over the already-loaded array, never against the backend.
  const { sortBy, sortOrder, toggleSort } = useSortState()

  const handleSort = (field) => {
    toggleSort(field)
    setPage(1)
  }

  useEffect(() => {
    listProducts().then((result) => {
      if (!result.success) return
      const counts = {}
      result.products.forEach((product) => {
        const brandId = product.brand_id
        if (!brandId) return
        counts[brandId] = (counts[brandId] || 0) + 1
      })
      setProductCountByBrandId(counts)
    })
  }, [])

  const loadBrands = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listBrands({ search: searchTerm.trim() || undefined })

    if (!result.success) {
      setBrands([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setBrands(result.brands.map(normalizeBrand))
    setIsLoading(false)
  }, [searchTerm])

  useEffect(() => {
    loadBrands()
  }, [loadBrands])

  const filteredBrands = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return brands.filter((brand) => {
      if (statusFilter === 'active' && !brand.isActive) return false
      if (statusFilter === 'inactive' && brand.isActive) return false
      if (!isWithinDateRange(brand.createdAt, dateFrom, dateTo)) return false
      if (!normalizedSearch) return true

      return [brand.name, brand.code, brand.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [brands, searchTerm, statusFilter, dateFrom, dateTo])

  const sortedBrands = useMemo(() => {
    if (!sortBy) return filteredBrands

    const accessors = {
      name: (brand) => brand.name?.toLowerCase() || '',
      description: (brand) => brand.description?.toLowerCase() || '',
      products: (brand) => productCountByBrandId[brand.id] || 0,
      status: (brand) => (brand.isActive ? 1 : 0),
    }
    const accessor = accessors[sortBy]
    if (!accessor) return filteredBrands

    const sorted = [...filteredBrands].sort((a, b) => {
      const valueA = accessor(a)
      const valueB = accessor(b)
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    })
    return sortOrder === 'desc' ? sorted.reverse() : sorted
  }, [filteredBrands, sortBy, sortOrder, productCountByBrandId])

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleBrands = sortedBrands.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const allVisibleSelected = visibleBrands.length > 0 && visibleBrands.every((brand) => selectedIds.includes(brand.id))
  const rangeStart = filteredBrands.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredBrands.length, currentPage * Number(pageSize))

  const openForm = (brand = null) => {
    pendingBrandId.current = ''
    setEditingBrand(brand)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    pendingBrandId.current = ''
    setEditingBrand(null)
    setFormError('')
  }

  const handleSaveBrand = async (brandData) => {
    if (isSaving) return
    setIsSaving(true)
    setFormError('')
    const savedId = editingBrand?.id || pendingBrandId.current
    const result = savedId ? await updateBrand(savedId, brandData) : await createBrand(brandData)
    if (!result.success) { setFormError(result.error); setIsSaving(false); return }
    const id = result.brand?.id || savedId
    if (!id) {
      setFormError('The saved Brand did not include an ID. Reload the Brands list before retrying.')
      setIsSaving(false)
      return
    }
    pendingBrandId.current = id
    const normalized = normalizeBrand({ ...brandData, ...result.brand, id })
    const updateSavedRow = (row) => setBrands((current) => current.some((brand) => brand.id === id)
      ? current.map((brand) => brand.id === id ? row : brand) : [row, ...current])
    updateSavedRow(normalized)
    if (brandData.categoryIds !== undefined) {
      const mapping = await syncBrandCategories(id, brandData.categoryIds, brandData.topCategories)
      if (!mapping.success) {
        if (mapping.categories) updateSavedRow({ ...normalized, categories: mapping.categories })
        setFormError(`Brand saved, but Category mappings could not be completed: ${mapping.error} Retry to continue saving this Brand.`)
        setIsSaving(false)
        return
      }
      updateSavedRow({ ...normalized, categories: mapping.categories })
    }
    setIsSaving(false)
    setIsFormOpen(false)
    setEditingBrand(null)
    pendingBrandId.current = ''
  }

  const toggleSelected = (brandId) => {
    setSelectedIds((current) =>
      current.includes(brandId) ? current.filter((id) => id !== brandId) : [...current, brandId],
    )
  }

  const toggleVisibleSelected = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleBrands.some((brand) => brand.id === id)))
      return
    }

    setSelectedIds((current) => [...new Set([...current, ...visibleBrands.map((brand) => brand.id)])])
  }

  const exportBrands = (onlySelected = false) => {
    const brandsToExport = onlySelected ? brands.filter((brand) => selectedIds.includes(brand.id)) : sortedBrands
    const rows = [['Brand', 'Categories', 'Description', 'Status'], ...brandsToExport.map((brand) => [brand.name, brand.categories.map((category) => category.name).join(', '), brand.description, brand.isActive ? 'Active' : 'Inactive'])]
    exportRowsToExcel('brands', rows)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const ids = deleteTarget.type === 'bulk' ? selectedIds : [deleteTarget.brand.id]
    const result = deleteTarget.type === 'bulk' ? await deleteBrandsBulk(ids) : await deleteBrand(ids[0])

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setBrands((current) => current.filter((brand) => !ids.includes(brand.id)))
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="p-0">
        <div className="px-5 py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Brands</h2>
              <p className="mt-1 text-xs text-neutral-400">Create and manage product brands used across catalog items.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:h-9 [&>button]:rounded-xl [&>button]:px-3.5">
              <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search brands"
                className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="relative shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl bg-surface px-3.5"
                onClick={() => setIsFilterMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isFilterMenuOpen}
              >
                <Filter className="size-4" aria-hidden="true" />
                Filters
              </Button>

              {isFilterMenuOpen && (
                <div
                  role="menu"
                  aria-label="Brand filters"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border border-neutral-100 bg-surface p-2 shadow-(--shadow-popover)"
                >
                  <p className="px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</p>
                  {[
                    { value: 'all', label: 'All brands' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ].map((option) => {
                    const active = statusFilter === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setStatusFilter(option.value)
                          setIsFilterMenuOpen(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                          active ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <span>{option.label}</span>
                        {active && <Check className="size-4" aria-hidden="true" />}
                      </button>
                    )
                  })}
                  <p className="mt-2 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Created</p>
                  <div className="px-3 py-1.5">
                    <DateRangeFilter preset={datePreset} onPresetChange={setDatePreset} customFrom={customFrom} customTo={customTo} onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }} />
                  </div>
                  {(statusFilter !== 'all' || datePreset !== 'all') && (
                    <button type="button" onClick={() => { setStatusFilter('all'); setDatePreset('all'); setCustomFrom(''); setCustomTo('') }} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
              <Button type="button" variant="outline" size="sm" onClick={() => exportBrands()}><Download className="size-4" aria-hidden="true" />Export</Button>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => exportBrands(true)}><Download className="size-4" aria-hidden="true" />Download</Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget({ type: 'bulk' })}><Trash2 className="size-4" aria-hidden="true" />Delete Selected</Button>
                </div>
              )}
              <Button type="button" size="sm" onClick={() => openForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Brand
              </Button>

            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">

        <div className="overflow-x-auto bg-surface px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadBrands}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-[54rem]" columns={["", "Brand", "Categories", "Description", "Products", "Status", "Actions"]} checkboxColumn={0} avatarColumn={1} label="Loading brands..." />
          ) : brands.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No brands yet</p>
              <p className="mt-1 text-xs text-neutral-400">Add your first brand to organize products.</p>
              <Button type="button" className="mt-4" onClick={() => openForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Brand
              </Button>
            </div>
          ) : filteredBrands.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No brands match this search or filter.</p>
          ) : (
            <table className="listing-table w-full min-w-[54rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <th className="w-14 px-6 py-6">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelected}
                      aria-label="Select all visible brands"
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <SortableHeaderCell label="Brand" sortKey="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="px-6 py-6">Categories</th>
                  <SortableHeaderCell label="Description" sortKey="description" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Products" sortKey="products" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <SortableHeaderCell label="Status" sortKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleBrands.map((brand) => (
                  <tr
                    key={brand.id}
                    onClick={() => openForm(brand)}
                    className="cursor-pointer bg-surface transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(brand.id)}
                        onChange={() => toggleSelected(brand.id)}
                        aria-label={`Select ${brand.name}`}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <Award className="size-4" aria-hidden="true" />
                        </div>
                        <span className="font-medium text-neutral-900">{brand.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex max-w-sm flex-wrap gap-1.5">
                        {brand.categories.length ? <>
                          {brand.categories.slice(0, 3).map((category) => <span key={category.id} title={category.name} className="max-w-40 truncate rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">{category.name}</span>)}
                          {brand.categories.length > 3 && <span title={brand.categories.slice(3).map((category) => category.name).join(', ')} className="rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600">+{brand.categories.length - 3} more</span>}
                        </> : <span className="text-xs text-neutral-400">No category mappings</span>}
                      </div>
                    </td>
                    <td className="max-w-xl px-6 py-5 text-neutral-600">
                      <span className="line-clamp-2">{brand.description || '-'}</span>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{productCountByBrandId[brand.id] || 0}</td>
                    <td className="px-6 py-5">
                      <Badge variant={brand.isActive ? 'success' : 'neutral'} dot>{brand.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: Eye, onClick: () => openForm(brand) },
                          { label: 'Edit', icon: Edit, onClick: () => openForm(brand) },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget({ type: 'single', brand }),
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4 text-xs text-fg-muted">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-fg">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-fg">{filteredBrands.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-surface py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page">‹</button><span className="min-w-14 text-center font-medium text-fg">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page">›</button></div>
        </div>
      </Card>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingBrand ? 'Edit Brand' : 'Add Brand'} className="max-w-lg">
        <BrandForm
          brand={editingBrand}
          persistedBrandId={pendingBrandId.current}
          existingBrands={brands}
          saving={isSaving}
          formError={formError}
          onClose={closeForm}
          onSave={handleSaveBrand}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title={deleteTarget?.type === 'bulk' ? 'Delete Brands' : 'Delete Brand'}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {deleteTarget?.type === 'bulk'
              ? `Delete ${selectedIds.length} selected brands? This cannot be undone.`
              : `Delete ${deleteTarget?.brand?.name || 'this brand'}? This cannot be undone.`}
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
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
