import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ClipboardList, ImageIcon, Info, Plus, Upload, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createCategory, listCategories } from '../../api/categories'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { readImageAsDataUrl } from '../../utils/imageFile'

const emptyForm = {
  name: '',
  image: '',
  description: '',
  parentId: '',
  subcategories: [],
}

const normalizeCategory = (category) => ({
  id: category.id,
  name: category.name || category.category_name || '',
  parentId: category.parent_id || category.parentId || '',
})

export default function CategoryFormPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [subcategoryName, setSubcategoryName] = useState('')

  const hasImage = Boolean(formData.image)

  const loadCategories = useCallback(async () => {
    const result = await listCategories()

    if (result.success) {
      setCategories(result.categories.map(normalizeCategory))
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const hasChanges = useMemo(() => JSON.stringify(formData) !== JSON.stringify(emptyForm), [formData])

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setFormError('')
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFormError('')

    try {
      const dataUrl = await readImageAsDataUrl(file)
      updateField('image', dataUrl)
    } catch (error) {
      setFormError(error.message)
    }
  }

  const addSubcategory = () => {
    const name = subcategoryName.trim()
    if (!name) return

    const duplicate = formData.subcategories.some((subcategory) => subcategory.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      setErrors((current) => ({ ...current, subcategories: 'Subcategory already added.' }))
      return
    }

    setFormData((current) => ({
      ...current,
      subcategories: [...current.subcategories, name],
    }))
    setSubcategoryName('')
    setErrors((current) => ({ ...current, subcategories: '' }))
    setFormError('')
  }

  const removeSubcategory = (subcategoryName) => {
    setFormData((current) => ({
      ...current,
      subcategories: current.subcategories.filter((subcategory) => subcategory !== subcategoryName),
    }))
  }

  const validate = () => {
    const nextErrors = {}
    const name = formData.name.trim()
    const duplicate = categories.some((category) => category.name.trim().toLowerCase() === name.toLowerCase())

    if (!name || name === '.') {
      nextErrors.name = 'Enter a valid category name.'
    }

    if (duplicate) {
      nextErrors.name = 'Category name already exists.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    setFormError('')

    const result = await createCategory({ name: formData.name, image: formData.image, description: formData.description, parentId: formData.parentId })

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    const parentId = result.category?.id
    if (formData.subcategories.length > 0 && parentId) {
      const childResults = await Promise.all(
        formData.subcategories.map((name) => createCategory({ name, parentId })),
      )
      const failedNames = childResults
        .map((childResult, index) => (childResult.success ? null : formData.subcategories[index]))
        .filter(Boolean)

      if (failedNames.length > 0) {
        setFormError(`Category saved, but these subcategories could not be created: ${failedNames.join(', ')}.`)
        setIsSaving(false)
        return
      }
    }

    navigate('/admin/categories')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/categories')}
          aria-label="Back to Categories"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-neutral-400">
          <Link to="/admin/products" className="hover:text-primary-700">Catalog</Link>
          <span aria-hidden="true">/</span>
          <Link to="/admin/categories" className="hover:text-primary-700">Categories</Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-600">Create Category</span>
        </nav>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Create Category</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Add a new category and organize products with optional subcategories.</p>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="space-y-3.5 rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">Category Details</p>

          <div className="flex flex-col gap-1">
            <Input
              label="Category Name"
              placeholder="e.g. Mineral Water"
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              error={errors.name}
              required
              compact
            />
            <p className="text-xs text-neutral-400">Choose a clear and descriptive name for the category.</p>
          </div>

          <div className="flex flex-col gap-1">
            <Select
              label="Parent Category (optional)"
              searchable
              options={[{ value: '', label: '— None (top-level category) —' }, ...categories.map((item) => ({ value: item.id, label: item.name }))]}
              value={formData.parentId}
              onChange={(event) => updateField('parentId', event.target.value)}
              placeholder="None — this is a top-level category"
            />
            <p className="text-xs text-neutral-400">Pick an existing category to make this a subcategory of it.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Image URL</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Paste image URL"
                value={formData.image}
                onChange={(event) => updateField('image', event.target.value)}
                className="flex-1"
                compact
              />
              <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-linear-to-b from-primary-500 to-primary-600 px-3.5 text-sm font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                <Upload className="size-4" aria-hidden="true" />
                Upload
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleImageUpload} />
              </label>
            </div>
            <p className="text-xs text-neutral-400">Add a link to an image or upload a file from your device.</p>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              as="textarea"
              label="Category Description"
              placeholder="Write a short description about this category..."
              maxLength={500}
              value={formData.description}
              onChange={(event) => updateField('description', event.target.value)}
              inputClassName="min-h-16"
              compact
            />
            <p className="text-xs text-neutral-400">This description will help your team and customers understand this category.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Subcategories</label>
            <p className="text-xs text-neutral-400">Each name here is created as its own category under this one. Press Enter or click Add.</p>
            <div className="mt-0.5 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                placeholder="Type a subcategory name"
                value={subcategoryName}
                onChange={(event) => {
                  setSubcategoryName(event.target.value)
                  setErrors((current) => ({ ...current, subcategories: '' }))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSubcategory()
                  }
                }}
                error={errors.subcategories}
                compact
              />
              <Button type="button" variant="outline" size="sm" className="h-9 min-w-24 rounded-xl" onClick={addSubcategory}>
                Add
              </Button>
            </div>

            {formData.subcategories.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {formData.subcategories.map((subcategory) => (
                  <span
                    key={subcategory}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 transition-colors hover:bg-primary-100"
                  >
                    {subcategory}
                    <button
                      type="button"
                      aria-label={`Remove ${subcategory}`}
                      className="rounded-full text-primary-500 hover:text-primary-800"
                      onClick={() => removeSubcategory(subcategory)}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-neutral-900">Image Preview</p>
              <Info className="size-3.5 text-neutral-300" aria-hidden="true" />
            </div>
            <div className="mt-3 flex h-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-center">
              {hasImage ? (
                <img src={formData.image} alt="Category preview" className="size-full rounded-lg object-cover" />
              ) : (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-white text-neutral-300 ring-1 ring-neutral-200">
                    <ImageIcon className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">No image yet</p>
                    <p className="mt-0.5 text-xs text-neutral-400">Add an image URL to see preview</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-neutral-900">Preview Summary</p>
            </div>
            <div className="mt-3 divide-y divide-neutral-100">
              <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-600">Status</span>
                <Badge variant="warning">Draft</Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-600">Subcategories</span>
                <span className="text-sm font-semibold text-neutral-900">{formData.subcategories.length}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-600">Products</span>
                <span className="text-sm font-semibold text-neutral-900">0</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-100 bg-white/90 px-4 py-2.5 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={() => navigate('/admin/categories')}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSaving} disabled={!hasChanges}>
            <Plus className="size-4" aria-hidden="true" />
            Add Category
          </Button>
        </div>
      </div>
    </form>
  )
}
