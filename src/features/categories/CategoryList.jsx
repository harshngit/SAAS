import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Edit, Eye, ImageIcon, Plus, RotateCw, Search, Tags, Trash2, Upload } from 'lucide-react'
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
import { readImageAsDataUrl } from '../../utils/imageFile'

const emptyForm = {
  name: '',
  image: '',
  description: '',
}

const seedCategories = [
  {
    id: 'cat-water',
    name: 'Water',
    image: '',
    description: 'Packaged drinking water products and size variants.',
    createdAt: '2026-07-31',
  },
  {
    id: 'cat-soft-drinks',
    name: 'Soft Drinks',
    image: '',
    description: 'Carbonated drinks, juices, and refreshment items.',
    createdAt: '2026-07-31',
  },
]

const normalizeCategory = (category) => ({
  id: category.id,
  name: category.name || category.category_name || '',
  image: category.image || category.category_image || '',
  description: category.description || category.category_description || '',
  subcategories: category.subcategories || category.sub_categories || [],
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

function CategoryForm({ category, existingCategories, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    setFormData(category ? { ...emptyForm, ...category } : emptyForm)
    setErrors({})
    setImageError('')
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
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-700">Category Image</label>
        <p className="text-xs font-medium text-neutral-400">Paste image URL or upload an image</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            placeholder="https://example.com/image.jpg"
            value={formData.image}
            onChange={(event) => setFormData((current) => ({ ...current, image: event.target.value }))}
          />
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium tracking-tight text-primary-700 transition-all hover:border-primary-300 hover:bg-primary-50/60">
            <Upload className="size-4" aria-hidden="true" />
            Upload
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleImageUpload} />
          </label>
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
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
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

    return categories.filter((category) => {
      if (!normalizedSearch) return true

      return [category.name, category.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [categories, searchTerm])

  const allVisibleSelected =
    filteredCategories.length > 0 && filteredCategories.every((category) => selectedIds.includes(category.id))

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listCategories({ search: searchTerm.trim() || undefined })

    if (!result.success) {
      setCategories(seedCategories)
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

  const toggleSelected = (categoryId) => {
    setSelectedIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    )
  }

  const toggleVisibleSelected = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredCategories.some((category) => category.id === id)))
      return
    }

    setSelectedIds((current) => [...new Set([...current, ...filteredCategories.map((category) => category.id)])])
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
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Categories</h2>
              <p className="mt-1 text-sm text-neutral-500">Create and manage product categories used across catalog items.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget({ type: 'bulk' })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete Selected
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => navigate('/admin/categories/new')}>
                <Plus className="size-4" aria-hidden="true" />
                Add Category
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex justify-end">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search categories"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <p className="mt-1 text-xs text-neutral-400">Showing local sample categories until the API responds.</p>
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
              <p className="mt-1 text-sm text-neutral-500">Add your first category to organize products.</p>
              <Button type="button" className="mt-4" onClick={() => navigate('/admin/categories/new')}>
                <Plus className="size-4" aria-hidden="true" />
                Add Category
              </Button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No categories match this search.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelected}
                      aria-label="Select all visible categories"
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">Category</th>
                  <th className="whitespace-nowrap px-4 py-3">Image</th>
                  <th className="whitespace-nowrap px-4 py-3">Description</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35">
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(category.id)}
                        onChange={() => toggleSelected(category.id)}
                        aria-label={`Select ${category.name}`}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(category.name) || <Tags className="size-4" aria-hidden="true" />}
                        </div>
                        <span className="font-medium text-neutral-900">{category.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {category.image ? (
                        <img
                          src={category.image}
                          alt=""
                          className="size-10 rounded-lg border border-neutral-100 object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-400">
                          <ImageIcon className="size-4" aria-hidden="true" />
                        </div>
                      )}
                    </td>
                    <td className="max-w-xl px-4 py-3.5 text-neutral-600">
                      <span className="line-clamp-2">{category.description || '-'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
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

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredCategories.length === 0 ? '0' : `1 to ${filteredCategories.length}`} of {categories.length}
          </span>
          <span>Categories</span>
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
        title="Category Details"
        className="max-w-lg"
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
            <div className="flex items-start gap-4">
              {viewCategory?.image ? (
                <img
                  src={viewCategory.image}
                  alt=""
                  className="size-16 rounded-xl border border-neutral-100 object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                  <Tags className="size-6" aria-hidden="true" />
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-neutral-900">{viewCategory?.name}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">{viewCategory?.description || 'No description added.'}</p>
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
