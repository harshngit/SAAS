import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Check, Download, Edit, Eye, Filter, Plus, RotateCw, Search, Trash2 } from 'lucide-react'
import {
  createBrand,
  deleteBrand,
  deleteBrandsBulk,
  listBrands,
  updateBrand,
} from '../../api/brands'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'

const emptyForm = {
  name: '',
  description: '',
  isActive: true,
}

const normalizeBrand = (brand) => ({
  id: brand.id,
  name: brand.name || '',
  description: brand.description || '',
  isActive: brand.is_active !== false,
  createdAt: brand.created_at || brand.createdAt || '',
})

function BrandForm({ brand, existingBrands, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(brand ? { ...emptyForm, ...brand } : emptyForm)
    setErrors({})
  }, [brand])

  const validate = () => {
    const nextErrors = {}
    const name = formData.name.trim()
    const duplicate = existingBrands.some(
      (item) => item.id !== brand?.id && item.name.trim().toLowerCase() === name.toLowerCase(),
    )

    if (!name) nextErrors.name = 'Enter a valid brand name.'
    if (duplicate) nextErrors.name = 'Brand name already exists.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <Button type="submit" loading={saving}>
          {brand ? 'Save Changes' : (
            <>
              <Check className="size-4" aria-hidden="true" />
              Save Brand
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export default function BrandList() {
  const [brands, setBrands] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
      if (!normalizedSearch) return true

      return [brand.name, brand.code, brand.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [brands, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleBrands = filteredBrands.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const allVisibleSelected = visibleBrands.length > 0 && visibleBrands.every((brand) => selectedIds.includes(brand.id))
  const rangeStart = filteredBrands.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredBrands.length, currentPage * Number(pageSize))

  const openForm = (brand = null) => {
    setEditingBrand(brand)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingBrand(null)
    setFormError('')
  }

  const handleSaveBrand = async (brandData) => {
    setIsSaving(true)
    setFormError('')

    const result = editingBrand
      ? await updateBrand(editingBrand.id, brandData)
      : await createBrand(brandData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    const normalized = normalizeBrand({ ...brandData, ...result.brand, id: result.brand?.id || editingBrand?.id })

    setBrands((current) =>
      editingBrand
        ? current.map((brand) => (brand.id === editingBrand.id ? normalized : brand))
        : [normalized, ...current],
    )
    setIsSaving(false)
    closeForm()
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

  const exportSelectedBrands = () => {
    const rows = [['Brand', 'Description', 'Status'], ...brands.filter((brand) => selectedIds.includes(brand.id)).map((brand) => [brand.name, brand.description, brand.isActive ? 'Active' : 'Inactive'])]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'brands.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Brands</h2>
              <p className="mt-1 text-sm text-neutral-500">Create and manage product brands used across catalog items.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={exportSelectedBrands}><Download className="size-4" aria-hidden="true" />Download</Button>
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

        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-96">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search brands"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <div className="relative shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 rounded-xl bg-white px-4"
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
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 rounded-2xl border border-neutral-100 bg-white p-2 shadow-(--shadow-popover)"
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadBrands}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading brands..." />
          ) : brands.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No brands yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first brand to organize products.</p>
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
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelected}
                      aria-label="Select all visible brands"
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="whitespace-nowrap px-6 py-6">Brand</th>
                  <th className="whitespace-nowrap px-6 py-6">Description</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBrands.map((brand) => (
                  <tr key={brand.id} className="bg-white transition-colors hover:bg-primary-50/30">
                    <td className="px-6 py-5">
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
                    <td className="max-w-xl px-6 py-5 text-neutral-600">
                      <span className="line-clamp-2">{brand.description || '-'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={brand.isActive ? 'success' : 'neutral'} dot>{brand.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: Eye, onClick: () => setEditingBrand(brand) },
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredBrands.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page">‹</button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page">›</button></div>
        </div>
      </Card>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingBrand ? 'Edit Brand' : 'Add Brand'} className="max-w-lg">
        <BrandForm
          brand={editingBrand}
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
