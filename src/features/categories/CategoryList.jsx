import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, CalendarClock, Check, Download, Edit, Eye, Filter, ImageIcon, Plus, RotateCw, Search, Tags, Trash2, Upload } from 'lucide-react'
import {
  createCategory,
  deleteCategoriesBulk,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../../api/categories'
import ActionMenu from '../../components/ui/ActionMenu'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { readImageAsDataUrl } from '../../utils/imageFile'

const emptyForm = {
  name: '',
  image: '',
  description: '',
  parentId: '',
}

const normalizeCategory = (category) => ({
  id: category.id,
  name: category.name || category.category_name || '',
  image: category.image || category.category_image || '',
  description: category.description || category.category_description || '',
  parentId: category.parent_id || category.parentId || '',
  createdAt: category.created_at || category.createdAt || '',
  updatedAt: category.updated_at || category.updatedAt || '',
})

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const formatDateLabel = (value) => {
  if (!value) return 'Not available'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CategoryForm({ category, existingCategories, saving, formError, onClose, onSave }) {
  const parentOptions = [
    { value: '', label: '— None (top-level category) —' },
    ...existingCategories.filter((item) => item.id !== category?.id).map((item) => ({ value: item.id, label: item.name })),
  ]

  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    setFormData(category ? { ...emptyForm, ...category } : emptyForm)
    setErrors({})
    setImageError('')
    setPreviewFailed(false)
  }, [category])

  const validate = () => {
    const nextErrors = {}
    const name = formData.name.trim()
    const duplicate = existingCategories.some(
      (item) => item.id !== category?.id && item.name.trim().toLowerCase() === name.toLowerCase(),
    )

    if (!name || name === '.') {
      nextErrors.name = 'Enter a valid category name.'
    }

    if (duplicate) {
      nextErrors.name = 'Category name already exists.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImageError('')

    try {
      const dataUrl = await readImageAsDataUrl(file)
      setPreviewFailed(false)
      setFormData((current) => ({ ...current, image: dataUrl }))
    } catch (error) {
      setImageError(error.message)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {(formError || imageError) && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError || imageError}
        </div>
      )}

      <Input
        label="Category Name"
        placeholder="Enter category name"
        value={formData.name}
        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
        error={errors.name}
        required
      />
      <Select
        label="Parent Category (optional)"
        searchable
        options={parentOptions}
        value={formData.parentId || ''}
        onChange={(event) => setFormData((current) => ({ ...current, parentId: event.target.value }))}
        placeholder="None — this is a top-level category"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-700">Category Image</label>
        <p className="text-xs font-medium text-neutral-400">Paste image URL or upload an image</p>
        <div className="flex items-start gap-4">
          {formData.image && !previewFailed ? (
            <img
              src={formData.image}
              alt=""
              className="size-20 shrink-0 rounded-2xl border border-neutral-100 object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Tags className="size-7" aria-hidden="true" />
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={formData.image}
              onChange={(event) => {
                setPreviewFailed(false)
                setFormData((current) => ({ ...current, image: event.target.value }))
              }}
            />
            <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium tracking-tight text-primary-700 transition-all hover:border-primary-300 hover:bg-primary-50/60">
              <Upload className="size-4" aria-hidden="true" />
              Upload Image
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleImageUpload} />
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          as="textarea"
          label="Category Description"
          placeholder="Enter a short description about this category..."
          maxLength={500}
          value={formData.description}
          onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
          inputClassName="min-h-24"
        />
        <p className="text-right text-xs font-medium text-neutral-400">{formData.description.length} / 500</p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {category ? (
            'Save Changes'
          ) : (
            <>
              <Check className="size-4" aria-hidden="true" />
              Save Category
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export default function CategoryList() {
  const navigate = useNavigate()
  const filterMenuRef = useRef(null)
  const sortMenuRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categorySort, setCategorySort] = useState('recent')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [viewCategory, setViewCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [detailsError, setDetailsError] = useState('')
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)

  const filteredCategories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = categories.filter((category) => {
      if (categoryFilter === 'with-image' && !category.image) return false
      if (categoryFilter === 'without-image' && category.image) return false
      if (!normalizedSearch) return true

      return [category.name, category.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime()
      const rightTime = new Date(right.createdAt || 0).getTime()

      if (categorySort === 'oldest') return leftTime - rightTime
      return rightTime - leftTime
    })
  }, [categoryFilter, categorySort, categories, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleCategories = filteredCategories.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const allVisibleSelected = visibleCategories.length > 0 && visibleCategories.every((category) => selectedIds.includes(category.id))
  const rangeStart = filteredCategories.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredCategories.length, currentPage * Number(pageSize))

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listCategories({ search: searchTerm.trim() || undefined })

    if (!result.success) {
      setCategories([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setCategories(result.categories.map(normalizeCategory))
    setIsLoading(false)
  }, [searchTerm])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!isFilterMenuOpen && !isSortMenuOpen) return

    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setIsFilterMenuOpen(false)
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setIsSortMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false)
        setIsSortMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isFilterMenuOpen, isSortMenuOpen])

  const openForm = (category = null) => {
    setEditingCategory(category)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingCategory(null)
    setFormError('')
  }

  const handleSaveCategory = async (categoryData) => {
    setIsSaving(true)
    setFormError('')

    const result = editingCategory
      ? await updateCategory(editingCategory.id, categoryData)
      : await createCategory(categoryData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    const normalized = normalizeCategory({ ...categoryData, ...result.category, id: result.category?.id || editingCategory?.id })

    setCategories((current) =>
      editingCategory
        ? current.map((category) => (category.id === editingCategory.id ? normalized : category))
        : [normalized, ...current],
    )
    setIsSaving(false)
    closeForm()
  }

  const handleViewDetails = async (category) => {
    setViewCategory(category)
    setDetailsError('')
    setIsDetailsLoading(true)

    const result = await getCategory(category.id)

    if (!result.success) {
      setDetailsError(result.error)
      setIsDetailsLoading(false)
      return
    }

    setViewCategory(normalizeCategory(result.category))
    setIsDetailsLoading(false)
  }

  const handleEditFromDetails = () => {
    if (!viewCategory) return

    setEditingCategory(viewCategory)
    setViewCategory(null)
    setDetailsError('')
    setIsFormOpen(true)
  }

  const toggleSelected = (categoryId) => {
    setSelectedIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    )
  }

  const toggleVisibleSelected = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleCategories.some((category) => category.id === id)))
      return
    }

    setSelectedIds((current) => [...new Set([...current, ...visibleCategories.map((category) => category.id)])])
  }

  const exportSelectedCategories = () => {
    const rows = [['Category', 'Parent', 'Description'], ...categories.filter((category) => selectedIds.includes(category.id)).map((category) => [category.name, category.parentId ? categories.find((item) => item.id === category.parentId)?.name || '' : '', category.description])]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'categories.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const ids = deleteTarget.type === 'bulk' ? selectedIds : [deleteTarget.category.id]
    const result = deleteTarget.type === 'bulk' ? await deleteCategoriesBulk(ids) : await deleteCategory(ids[0])

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setCategories((current) => current.filter((category) => !ids.includes(category.id)))
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
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Categories</h2>
              <p className="mt-1 text-xs text-neutral-400">Create and manage product categories used across catalog items.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:h-9 [&>button]:rounded-xl [&>button]:px-3.5">
              <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search categories"
                className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div ref={filterMenuRef} className="relative shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl bg-white px-3.5"
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
                  aria-label="Category filters"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-2xl border border-neutral-100 bg-white p-2 shadow-(--shadow-popover)"
                >
                  <p className="px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    Filter
                  </p>
                  {[
                    { value: 'all', label: 'All categories' },
                    { value: 'with-image', label: 'With image' },
                    { value: 'without-image', label: 'Without image' },
                  ].map((option) => {
                    const active = categoryFilter === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setCategoryFilter(option.value)
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
                </div>
              )}
            </div>

            <div ref={sortMenuRef} className="relative shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl bg-white px-3.5"
                onClick={() => setIsSortMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Sort
              </Button>

              {isSortMenuOpen && (
                <div
                  role="menu"
                  aria-label="Category sorting"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-52 rounded-2xl border border-neutral-100 bg-white p-2 shadow-(--shadow-popover)"
                >
                  <p className="px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    Sort by
                  </p>
                  {[
                    { value: 'recent', label: 'Recent' },
                    { value: 'oldest', label: 'Oldest' },
                  ].map((option) => {
                    const active = categorySort === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setCategorySort(option.value)
                          setIsSortMenuOpen(false)
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
                </div>
              )}
            </div>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={exportSelectedCategories}><Download className="size-4" aria-hidden="true" />Download</Button><Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget({ type: 'bulk' })}><Trash2 className="size-4" aria-hidden="true" />Delete Selected</Button></div>
              )}
              <Button type="button" size="sm" onClick={() => navigate('/admin/categories/new')}>
                <Plus className="size-4" aria-hidden="true" />
                Add Category
              </Button>

            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">

        <div className="grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
          {[
            { label: 'Total Categories', value: categories.length, detail: `${categories.filter((category) => category.image).length} with image`, icon: Tags },
            { label: 'With Image', value: categories.filter((category) => category.image).length, detail: 'catalog visuals', icon: ImageIcon },
            { label: 'Top-level', value: categories.filter((category) => !category.parentId).length, detail: 'parent categories', icon: CalendarPlus },
            { label: 'Subcategories', value: categories.filter((category) => category.parentId).length, detail: 'nested categories', icon: CalendarClock },
          ].map(({ label, value, detail, icon: Icon }, index) => (
            <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#6b86ad]">{label}</p><span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" /></span></div><p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p></div>
          ))}
        </div>

        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadCategories}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading categories..." />
          ) : categories.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No categories yet</p>
              <p className="mt-1 text-xs text-neutral-400">Add your first category to organize products.</p>
              <Button type="button" className="mt-4" onClick={() => navigate('/admin/categories/new')}>
                <Plus className="size-4" aria-hidden="true" />
                Add Category
              </Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No categories match this search or filter.</p>
          ) : (
            <table className="listing-table w-full min-w-[64rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelected}
                      aria-label="Select all visible categories"
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="whitespace-nowrap px-6 py-6">Category</th>
                  <th className="whitespace-nowrap px-6 py-6">Parent</th>
                  <th className="whitespace-nowrap px-6 py-6">Image</th>
                  <th className="whitespace-nowrap px-6 py-6">Description</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleCategories.map((category) => (
                  <tr key={category.id} className="bg-white transition-colors hover:bg-primary-50/30">
                    <td className="px-6 py-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(category.id)}
                        onChange={() => toggleSelected(category.id)}
                        aria-label={`Select ${category.name}`}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(category.name) || <Tags className="size-4" aria-hidden="true" />}
                        </div>
                        <span className="font-medium text-neutral-900">{category.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">
                      {category.parentId ? categories.find((item) => item.id === category.parentId)?.name || '—' : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {category.image ? (
                      <img
                          src={category.image}
                          alt={`${category.name} category image`}
                          className="size-10 rounded-lg border border-neutral-100 object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-400">
                          <ImageIcon className="size-4" aria-hidden="true" />
                        </div>
                      )}
                    </td>
                    <td className="max-w-xl px-6 py-5 text-neutral-600">
                      <span className="line-clamp-2">{category.description || '-'}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: Eye, onClick: () => handleViewDetails(category) },
                          { label: 'Edit', icon: Edit, onClick: () => openForm(category) },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget({ type: 'single', category }),
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredCategories.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page">‹</button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page">›</button></div>
        </div>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        className="max-w-lg"
      >
        <CategoryForm
          category={editingCategory}
          existingCategories={categories}
          saving={isSaving}
          formError={formError}
          onClose={closeForm}
          onSave={handleSaveCategory}
        />
      </Modal>

      <Modal
        isOpen={Boolean(viewCategory)}
        onClose={() => {
          setViewCategory(null)
          setDetailsError('')
        }}
        title="Category details"
        className="max-w-xl overflow-hidden"
      >
        {isDetailsLoading ? (
          <LoadingSpinner label="Loading category details..." />
        ) : (
          <div className="space-y-5">
            {detailsError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {detailsError}
              </div>
            )}

            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  {viewCategory?.image ? (
                    <img
                      src={viewCategory.image}
                      alt={`${viewCategory?.name || 'Category'} image`}
                      className="size-20 rounded-lg border border-neutral-200 object-cover"
                    />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-500">
                      <Tags className="size-6" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                      Category
                    </span>
                    <span className="text-xs text-neutral-400">Catalog record</span>
                    {viewCategory && categories.filter((item) => item.parentId === viewCategory.id).length > 0 ? (
                      <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                        {categories.filter((item) => item.parentId === viewCategory.id).length} subcategories
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-neutral-900 text-balance">
                    {viewCategory?.name || 'Unnamed category'}
                  </h3>
                  {viewCategory?.parentId && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Subcategory of{' '}
                      <span className="font-medium text-neutral-700">
                        {categories.find((item) => item.id === viewCategory.parentId)?.name || 'another category'}
                      </span>
                    </p>
                  )}
                  <p className="mt-2 max-w-prose text-sm leading-6 text-neutral-600 text-pretty">
                    {viewCategory?.description || 'No description added.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-500">
                    <CalendarPlus className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Created</p>
                    <p className="mt-0.5 text-sm text-neutral-800">{formatDateLabel(viewCategory?.createdAt)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-500">
                    <CalendarClock className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Updated</p>
                    <p className="mt-0.5 text-sm text-neutral-800">{formatDateLabel(viewCategory?.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-neutral-500">
                This category label is used across catalog filters and product organization.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-md px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setViewCategory(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md border-neutral-300 bg-transparent px-3 py-2 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                  onClick={handleEditFromDetails}
                >
                  <Edit className="size-4" aria-hidden="true" />
                  Edit category
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title={deleteTarget?.type === 'bulk' ? 'Delete Categories' : 'Delete Category'}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {deleteTarget?.type === 'bulk'
              ? `Delete ${selectedIds.length} selected categories? This cannot be undone.`
              : `Delete ${deleteTarget?.category?.name || 'this category'}? This cannot be undone.`}
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
