import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Folder, ImageIcon, Info, ListTree, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createCategory, listCategories } from '../../api/categories'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { readImageAsDataUrl } from '../../utils/imageFile'

const emptyForm = {
  name: '',
  image: '',
  description: '',
  subcategories: [],
}

const normalizeCategory = (category) => ({
  id: category.id,
  name: category.name || category.category_name || '',
})

export default function CategoryFormPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [subcategoryName, setSubcategoryName] = useState('')

  const descriptionCount = formData.description.length
  const descriptionProgress = Math.min(100, (descriptionCount / 500) * 100)
  const hasImage = Boolean(formData.image)
  const completionItems = [
    { label: 'Name', done: Boolean(formData.name.trim()), required: true },
    { label: 'Image', done: hasImage },
    { label: 'Description', done: Boolean(formData.description.trim()) },
    { label: 'Subcategories', done: formData.subcategories.length > 0 },
  ]

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

  const clearImage = () => {
    updateField('image', '')
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

    const result = await createCategory(formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    navigate('/admin/categories')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary-700">Product Catalog</p>
          <h2 className="mt-1 text-2xl font-semibold text-neutral-900">Add Category</h2>
          <p className="mt-1 text-sm text-neutral-500">Create a category, add media, and group products with optional subcategories.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/categories')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Categories
        </Button>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <Folder className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">Basic Details</p>
                <p className="mt-0.5 text-sm text-neutral-500">Name the category and describe what belongs inside it.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
              <Input
                label="Category Name"
                placeholder="Enter category name"
                value={formData.name}
                onChange={(event) => updateField('name', event.target.value)}
                error={errors.name}
                required
              />
              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <Input
                  as="textarea"
                  label="Category Description"
                  placeholder="Describe where this category appears in the catalog..."
                  maxLength={500}
                  value={formData.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  inputClassName="min-h-28"
                />
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${descriptionProgress}%` }} />
                  </div>
                  <p className="w-16 text-right text-xs font-medium text-neutral-400">{descriptionCount} / 500</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <ImageIcon className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">Category Image</p>
                <p className="mt-0.5 text-sm text-neutral-500">Add a URL or upload an image file.</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:flex-row">
              <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-200 bg-neutral-50">
                {hasImage ? (
                  <img src={formData.image} alt="Category" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-6 text-neutral-300" aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <Input
                  label="Image URL"
                  placeholder="https://example.com/image.jpg"
                  value={formData.image}
                  onChange={(event) => updateField('image', event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-b from-primary-500 to-primary-600 px-4 text-sm font-medium tracking-tight text-white shadow-[0_8px_18px_-8px_rgb(6_59_0/0.45)] transition-all hover:from-primary-500 hover:to-primary-700">
                    <Upload className="size-4" aria-hidden="true" />
                    Upload
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleImageUpload} />
                  </label>
                  <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={!hasImage} onClick={clearImage}>
                    <X className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                  <ListTree className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-semibold text-neutral-900">Subcategories</p>
                  <p className="mt-0.5 text-sm text-neutral-500">Create optional child groups for this category.</p>
                </div>
              </div>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                {formData.subcategories.length} added
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  placeholder="Enter subcategory name"
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
                />
                <Button type="button" className="h-11 min-w-24 rounded-xl" onClick={addSubcategory}>
                  Add
                </Button>
              </div>

              {formData.subcategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {formData.subcategories.map((subcategory) => (
                    <span
                      key={subcategory}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 transition-colors hover:bg-primary-50"
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
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-neutral-700">No subcategories added.</p>
                </div>
              )}

              <p className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                <Info className="size-3.5" aria-hidden="true" />
                Press Enter or click Add to include a subcategory.
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">Save Readiness</p>
            <div className="mt-4 space-y-3">
              {completionItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-neutral-600">
                    {item.label}
                    {item.required && <span className="text-red-500"> *</span>}
                  </span>
                  {item.done ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-white">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="size-6 rounded-full border-2 border-dashed border-neutral-200" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-900">Quick Tip</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Keep category names short and use subcategories only for groups customers or staff need to filter.
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-100 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={isSaving} onClick={() => navigate('/admin/categories')}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!hasChanges}>
            <Check className="size-4" aria-hidden="true" />
            Save Category
          </Button>
        </div>
      </div>
    </form>
  )
}
