import AllowedBrandsField from '../../components/ui/AllowedBrandsField'
import { useCategoryBrandSelection } from '../../hooks/useCategoryBrandSelection'
import { usePermission } from '../../auth/usePermission'
import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react'
import { ArrowLeft, ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createCategory, createSubcategoryVariant, listCategories, setCategoryBrands } from '../../api/categories'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { readImageAsDataUrl } from '../../utils/imageFile'
import { getFileUrl } from '../../api/files'

const emptyForm = {
  name: '',
  image: '',
  description: '',
  subcategories: [],
}

const normalizeCategory = (category) => ({
  id: category.id,
  name: category.name || category.category_name || '',
  parentId: category.parent_id || category.parentId || '',
})

function CategoryImageUpload({ image, name, disabled, onChange, onRemove }) {
  const inputId = useId()
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-700">Images <span className="ml-1 font-normal text-neutral-400">(optional)</span></p>
      <div className="flex min-h-28 flex-wrap items-center gap-4 py-2">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
          {image
            ? <img src={getFileUrl(image)} alt={`${name} preview`} className="size-full object-contain p-1" />
            : <ImageIcon className="size-7 text-neutral-300" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-neutral-500">PNG, JPG or WebP. Up to 2MB.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className={`relative inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm font-medium text-primary-700 transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary-300 hover:bg-primary-50'}`}>
              <Upload className="size-4" aria-hidden="true" />
              {image ? 'Replace image' : 'Upload image'}
              <input id={inputId} type="file" aria-label={`${image ? 'Replace' : 'Upload'} ${name} image`}
                accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={disabled} onChange={onChange} />
            </label>
            {image && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove} aria-label={`Remove ${name} image`}>
              <Trash2 className="size-4" aria-hidden="true" /> Remove
            </Button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CategoryFormPage() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canSetBrands = can('products', 'edit')
  const brandSelection = useCategoryBrandSelection(null, canSetBrands)
  const [formData, setFormData] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(0)
  const saved = useRef({ categoryId: '', children: {}, variants: new Set() })

  const fieldsDisabled = isSaving || Boolean(saved.current.categoryId)
  const imageControlsDisabled = fieldsDisabled || Boolean(uploadingImages)

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

  const updateSubcategory = (id, changes) => {
    setFormData((current) => ({ ...current, subcategories: current.subcategories.map((item) => item.id === id ? { ...item, ...changes } : item) }))
    setErrors((current) => ({ ...current, [id]: '' }))
    setFormError('')
  }

  const handleImageUpload = async (event, subcategoryId) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFormError('')
    setUploadingImages((count) => count + 1)
    try {
      const image = await readImageAsDataUrl(file)
      if (subcategoryId) updateSubcategory(subcategoryId, { image })
      else updateField('image', image)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setUploadingImages((count) => count - 1)
    }
  }

  const addSubcategory = () => {
    setFormData((current) => ({ ...current, subcategories: [...current.subcategories,
      { id: crypto.randomUUID(), name: '', image: '', variants: [], variantDraft: '' },
    ] }))
  }

  const removeSubcategory = (id) => {
    setFormData((current) => ({ ...current, subcategories: current.subcategories.filter((item) => item.id !== id) }))
  }

  const addVariant = (subcategory) => {
    const name = subcategory.variantDraft.trim()
    if (!name || name.length > 150) {
      setErrors((current) => ({ ...current, [subcategory.id]: 'Enter a Variant name of 1 to 150 characters.' }))
      return
    }
    if (subcategory.variants.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setErrors((current) => ({ ...current, [subcategory.id]: 'This Variant is already added.' }))
      return
    }
    updateSubcategory(subcategory.id, { variants: [...subcategory.variants, name], variantDraft: '' })
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
    const childNames = new Set()
    for (const child of formData.subcategories) {
      const childName = child.name.trim().toLowerCase()
      if (!childName || childName === '.') nextErrors[child.id] = 'Enter a valid Sub Category Name.'
      else if (childNames.has(childName)) nextErrors[child.id] = 'Subcategory name already added.'
      childNames.add(childName)
      if (child.variantDraft.trim()) nextErrors[child.id] = 'Click Add to include the pending Variant before saving.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving || uploadingImages || (canSetBrands && (brandSelection.loading || brandSelection.error)) || !validate()) return

    setIsSaving(true)
    setFormError('')

    const result = saved.current.categoryId
      ? { success: true, category: { id: saved.current.categoryId } }
      : await createCategory({ name: formData.name, image: formData.image, description: formData.description, parentId: null })

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    const parentId = result.category?.id
    if (!parentId) {
      setFormError('The category response did not include an ID. Reload the category list before retrying.')
      setIsSaving(false)
      return
    }
    saved.current.categoryId = parentId
    if (canSetBrands && !saved.current.brandsSaved) {
      const mapping = await setCategoryBrands(parentId, brandSelection.selectedIds)
      if (!mapping.success) {
        setFormError(mapping.error)
        setIsSaving(false)
        return
      }
      saved.current.brandsSaved = true
    }
    if (formData.subcategories.length > 0 && parentId) {
      const childResults = await Promise.all(formData.subcategories.map(async (subcategory) => {
        if (saved.current.children[subcategory.id]) return { success: true }
        const child = await createCategory({ name: subcategory.name, image: subcategory.image, parentId })
        if (child.success && child.category?.id) saved.current.children[subcategory.id] = child.category.id
        else if (child.success) return { success: false }
        return child
      }))
      const failedNames = childResults
        .map((childResult, index) => (childResult.success ? null : formData.subcategories[index].name))
        .filter(Boolean)

      if (failedNames.length > 0) {
        setFormError(`Category saved, but these subcategories could not be created: ${failedNames.join(', ')}.`)
        setIsSaving(false)
        return
      }
    }

    for (const subcategory of formData.subcategories) {
      const target = { id: saved.current.children[subcategory.id] }
      const names = subcategory.variants

      for (const [sortOrder, name] of names.entries()) {
        const savedKey = `${target.id}:${name.toLowerCase()}`
        if (saved.current.variants.has(savedKey)) continue
        const variant = await createSubcategoryVariant(target.id, { name, sort_order: sortOrder })
        if (!variant.success) {
          setFormError(`Category saved, but Variant "${name}" could not be saved: ${variant.error} Retry to continue without duplicating saved categories.`)
          setIsSaving(false)
          return
        }
        saved.current.variants.add(savedKey)
      }
    }

    navigate('/admin/categories')
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/categories')}
          aria-label="Back to Categories"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-surface text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
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

      <div className="space-y-8">
        <section className="space-y-5 pt-1" aria-labelledby="category-details-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="category-details-heading" className="font-semibold text-neutral-900">Category Details</h3>
            <Badge variant="neutral">Draft</Badge>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-5">
              <Input label="Category Name" disabled={fieldsDisabled} placeholder="e.g. Footwear"
                value={formData.name} onChange={(event) => updateField('name', event.target.value)} error={errors.name} required />
              <Input as="textarea" label="Description" disabled={fieldsDisabled} placeholder="Describe the products in this category..."
                maxLength={500} value={formData.description} onChange={(event) => updateField('description', event.target.value)} inputClassName="min-h-24" />
            </div>
            <CategoryImageUpload image={formData.image} name="Category" disabled={imageControlsDisabled}
              onChange={(event) => handleImageUpload(event)} onRemove={() => updateField('image', '')} />
          </div>
          {canSetBrands && <AllowedBrandsField selection={brandSelection} disabled={fieldsDisabled} />}
        </section>

        <section className="space-y-5 border-t border-neutral-200 pt-6" aria-labelledby="subcategories-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="subcategories-heading" className="font-semibold text-neutral-900">Subcategories <span className="ml-2 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600">{formData.subcategories.length}</span></h3>
              <p className="mt-1 text-sm text-neutral-500">Group related products and add Variants for each subcategory.</p>
            </div>
          </div>
          {formData.subcategories.length === 0 && <p className="py-3 text-sm text-neutral-500">No subcategories added. Add one below, or save this Category on its own.</p>}
          {formData.subcategories.map((subcategory, index) => (
            <fieldset key={subcategory.id} disabled={fieldsDisabled} className="min-w-0 space-y-4 border-0 border-b border-neutral-100 pb-6 last:border-b-0">
              <legend className="sr-only">Subcategory {index + 1}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-3 text-sm font-semibold text-neutral-800">
                  <span className="text-xs font-medium tabular-nums text-neutral-400">{index + 1}</span>
                  <span className="break-words">{subcategory.name.trim() || 'New Subcategory'}</span>
                </p>
                <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeSubcategory(subcategory.id)}>
                  <Trash2 className="size-3.5" aria-hidden="true" /> Remove Subcategory
                </Button>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
                  <Input label="Sub Category Name" required value={subcategory.name} placeholder="e.g. Casual Footwear"
                    onChange={(event) => updateSubcategory(subcategory.id, { name: event.target.value })} />
                  <CategoryImageUpload image={subcategory.image} name={`Subcategory ${index + 1}`} disabled={imageControlsDisabled}
                    onChange={(event) => handleImageUpload(event, subcategory.id)} onRemove={() => updateSubcategory(subcategory.id, { image: '' })} />
                </div>
                <div className="space-y-3">
                  <div className="flex max-w-xl items-end gap-2">
                    <Input label="Variants" placeholder="Enter variant name" maxLength={150} value={subcategory.variantDraft} className="min-w-0 flex-1"
                      onChange={(event) => updateSubcategory(subcategory.id, { variantDraft: event.target.value })}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariant(subcategory) } }} />
                    <Button type="button" variant="outline" onClick={() => addVariant(subcategory)}><Plus className="size-4" aria-hidden="true" /> Add</Button>
                  </div>
                  {subcategory.variants.length > 0 && <div className="flex flex-wrap gap-2">
                    {subcategory.variants.map((name) => <span key={name} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm text-primary-700">
                      <span className="min-w-0 break-words">{name}</span>
                      <button type="button" aria-label={`Remove Variant ${name} from ${subcategory.name || `Subcategory ${index + 1}`}`}
                        className="shrink-0 rounded p-0.5 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-primary-500"
                        onClick={() => updateSubcategory(subcategory.id, { variants: subcategory.variants.filter((item) => item !== name) })}>
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>)}
                  </div>}
                </div>
                {errors[subcategory.id] && <p role="alert" className="text-xs text-red-600">{errors[subcategory.id]}</p>}
              </div>
            </fieldset>
          ))}
          <Button type="button" variant="outline" disabled={fieldsDisabled} onClick={addSubcategory}>
            <Plus className="size-4" aria-hidden="true" /> Add Another Subcategory
          </Button>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-neutral-200 bg-surface/95 py-4 backdrop-blur">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={() => navigate('/admin/categories')}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSaving} disabled={!hasChanges || Boolean(uploadingImages) || (canSetBrands && (brandSelection.loading || Boolean(brandSelection.error)))}>
            <Plus className="size-4" aria-hidden="true" />
            Add Category
          </Button>
        </div>
      </div>
    </form>
  )
}
