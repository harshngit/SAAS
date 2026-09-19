import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Edit, Eye, Plus, Power, RotateCw, Search, SlidersHorizontal, Trash2, Users, Wallet, X } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import {
  createSupplier,
  deleteSupplier,
  getSupplierProductLinks,
  listSuppliers,
  updateSupplier,
  updateSupplierStatus,
} from '../../api/suppliers'
import { listProducts } from '../../api/products'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import SupplierForm from './SupplierForm'
import { normalizeApiSupplier, supplierFormFallback } from './supplierUtils'
import { getSupplierProducts, syncSupplierProductM2M } from './supplierProductUtils'
import { normalizeApiProduct } from '../products/productUtils'
import { demoProducts, demoSuppliers } from './supplierDemoData'

const supplierStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const getInitials = (name = '') =>
  name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

const formatSupplierStatus = (status) => (status === 'active' ? 'Active' : 'Inactive')

export default function SupplierList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const useDemoSuppliers = DEMO_MODE && !DEMO_EMPTY
  const [suppliers, setSuppliers] = useState([])
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
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [isPreparingEdit, setIsPreparingEdit] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusSupplier, setStatusSupplier] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [products, setProducts] = useState([])

  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState([])

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Explicit demo split: DEMO_MODE (true OR empty) never calls the real API.
    if (DEMO_MODE) {
      setSuppliers(useDemoSuppliers ? demoSuppliers : [])
      setIsLoading(false)
      return
    }

    const result = await listSuppliers({
      search: searchTerm.trim() || undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    })

    if (!result.success) {
      setSuppliers([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setSuppliers(result.suppliers.map((supplier) => normalizeApiSupplier(supplier)))
    setIsLoading(false)
  }, [categoryFilter, searchTerm, statusFilter, useDemoSuppliers])

  const loadSupplierCategoryOptions = useCallback(async () => {
    if (DEMO_MODE) {
      setSupplierCategoryOptions(
        useDemoSuppliers ? [...new Set(demoSuppliers.map((supplier) => supplier.category).filter(Boolean))] : [],
      )
      return
    }

    const result = await listSuppliers()

    if (!result.success) return

    const categories = []
    result.suppliers.forEach((supplier) => {
      const value = supplier.category?.trim()
      if (value && !categories.includes(value)) {
        categories.push(value)
      }
    })

    setSupplierCategoryOptions(categories)
  }, [useDemoSuppliers])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    loadSupplierCategoryOptions()
  }, [loadSupplierCategoryOptions])

  const loadProducts = useCallback(async () => {
    if (DEMO_MODE) {
      setProducts(useDemoSuppliers ? demoProducts : [])
      return
    }

    const result = await listProducts()
    if (result.success) setProducts(result.products.map((product) => normalizeApiProduct(product)))
  }, [useDemoSuppliers])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Truthful count only. Supplier <-> Product is many-to-many; preferred_supplier_id is an
  // independent single reference and is NOT used to estimate here, and no per-row
  // GET /suppliers/{id}/products is made. Real mode shows the backend `products_count` when
  // present, otherwise "—" (Supplier Detail -> Products is the authoritative linked view).
  const getProductCount = (supplier) => {
    if (supplier.productCount != null) return supplier.productCount
    if (useDemoSuppliers) {
      return getSupplierProducts(supplier, products, { demoMode: true }).length
    }
    return '—'
  }

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = suppliers.filter((supplier) => {
      const matchesSearch =
        !normalizedSearch ||
        [supplier.name, supplier.contactPerson, supplier.phone, supplier.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })

    return filtered.sort((left, right) => {
      // "Recent" means most recently active, not just most recently created - prefer
      // updatedAt (bumped by any edit/status change/payment) and fall back to createdAt
      // for a record that has never been touched since creation.
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime()

      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [categoryFilter, searchTerm, sortFilter, statusFilter, suppliers])

  const supplierSummary = useMemo(() => ({
    total: filteredSuppliers.length,
    active: filteredSuppliers.filter((supplier) => supplier.status === 'active').length,
    inactive: filteredSuppliers.filter((supplier) => supplier.status !== 'active').length,
    payable: filteredSuppliers.reduce((sum, supplier) => sum + Number(supplier.outstandingPayable || 0), 0),
  }), [filteredSuppliers])

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleSuppliers = filteredSuppliers.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredSuppliers.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredSuppliers.length, currentPage * Number(pageSize))
  const allVisibleSelected = visibleSuppliers.length > 0 && visibleSuppliers.every((supplier) => selectedIds.includes(supplier.id))

  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleSuppliers.some((supplier) => supplier.id === id))
    : [...new Set([...current, ...visibleSuppliers.map((supplier) => supplier.id)])])

  const exportSuppliersCsv = (onlySelected = false) => {
    const rows = [
      ['Supplier', 'Category', 'Contact', 'City', 'Product Count', 'Total Purchases', 'Outstanding Payable', 'Status'],
      ...filteredSuppliers.filter((supplier) => !onlySelected || selectedIds.includes(supplier.id)).map((supplier) => [supplier.name, supplier.category, supplier.contactPerson, supplier.city, getProductCount(supplier), formatCurrency(supplier.totalPurchases), formatCurrency(supplier.outstandingPayable), formatSupplierStatus(supplier.status)]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'suppliers.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected supplier${selectedIds.length === 1 ? '' : 's'}?`)) return
    setIsDeleting(true)
    const results = await Promise.all(selectedIds.map((id) => DEMO_MODE ? Promise.resolve({ success: true }) : deleteSupplier(id)))
    const failed = results.find((result) => !result.success)
    if (failed) { setDeleteError(failed.error || 'Some suppliers could not be deleted.'); setIsDeleting(false); return }
    setSuppliers((current) => current.filter((supplier) => !selectedIds.includes(supplier.id)))
    setSelectedIds([])
    setIsDeleting(false)
  }

  const handleOpenForm = async (supplier = null) => {
    setFormError('')

    if (!supplier) {
      setEditingSupplier(null)
      setIsFormOpen(true)
      return
    }

    // Demo mode: keep the local by-name / productsSupplied mapping.
    if (useDemoSuppliers) {
      const productsSupplied = getSupplierProducts(supplier, products, { demoMode: true }).map((product) => ({ id: product.id, name: product.name }))
      setEditingSupplier({ ...supplier, productsSupplied })
      setIsFormOpen(true)
      return
    }

    // Real mode: the authoritative "Products Supplied" selection is the Supplier <-> Product
    // M2M link list, never Product.preferred_supplier_id. Fetch it before opening the form so
    // the picker (and the save-time `previousProducts` diff) reflect real links.
    setIsPreparingEdit(true)
    const linksResult = await getSupplierProductLinks(supplier.id)
    setIsPreparingEdit(false)
    if (!linksResult.success) {
      showToast({ title: 'Unable to load linked products', message: linksResult.error, variant: 'error' })
      return
    }
    const productsSupplied = linksResult.links.map((link) => ({ id: link.productId, name: link.productName }))
    setEditingSupplier({ ...supplier, productsSupplied })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingSupplier(null)
    setFormError('')
  }

  const handleSaveSupplier = async (supplierData) => {
    setIsSaving(true)
    setFormError('')

    if (DEMO_MODE) {
      const demoSupplier = {
        ...supplierData,
        id: editingSupplier?.id || `demo-supplier-custom-${Date.now()}`,
        status: supplierData.status || 'active',
        totalPurchases: editingSupplier?.totalPurchases || 0,
        totalPaid: editingSupplier?.totalPaid || 0,
        outstandingPayable: editingSupplier?.outstandingPayable || supplierData.openingBalance || 0,
      }
      setSuppliers((current) => editingSupplier
        ? current.map((supplier) => supplier.id === editingSupplier.id ? demoSupplier : supplier)
        : [demoSupplier, ...current])
      setIsSaving(false)
      handleCloseForm()
      return
    }

    const result = editingSupplier
      ? await updateSupplier(editingSupplier.id, supplierData)
      : await createSupplier(supplierData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    // The supplier record itself is saved past this point - a subsequent product-link failure
    // must never look like the whole save failed, and (for create) must never delete the
    // supplier that was just created.
    const savedId = result.supplier.id || editingSupplier?.id
    const desiredIsActive = supplierData.status !== 'inactive'
    const currentIsActive = editingSupplier ? editingSupplier.status === 'active' : true
    let savedSupplier = result.supplier
    if (savedId && desiredIsActive !== currentIsActive) {
      const statusResult = await updateSupplierStatus(savedId, desiredIsActive)
      if (!statusResult.success) {
        setFormError(statusResult.error)
        return
      }
      savedSupplier = statusResult.supplier
    }
    const fallback = supplierFormFallback(supplierData, savedId)

    setSuppliers((current) =>
      editingSupplier
        ? current.map((supplier) =>
            supplier.id === editingSupplier.id ? normalizeApiSupplier(savedSupplier, fallback) : supplier,
          )
        : [normalizeApiSupplier(savedSupplier, fallback), ...current],
    )
    handleCloseForm()

    // Products Supplied -> Supplier <-> Product M2M links (POST/DELETE /suppliers/{id}/products).
    // Demo suppliers are handled above and never reach here.
    const syncResult = await syncSupplierProductM2M(savedId, {
      previousProducts: editingSupplier?.productsSupplied || [],
      nextProducts: supplierData.productsSupplied || [],
    })
    if (syncResult.attempted > 0) {
      await loadProducts()
      if (!syncResult.success) {
        showToast({
          title: 'Supplier saved, but product links need attention',
          message: `${syncResult.failed.length} of ${syncResult.attempted} product link update${syncResult.attempted === 1 ? '' : 's'} failed. Edit this supplier again to retry.`,
          variant: 'error',
        })
      }
    }
  }

  const handleToggleStatus = async () => {
    if (!statusSupplier) return

    const nextIsActive = statusSupplier.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

    if (DEMO_MODE) {
      setSuppliers((current) => current.map((supplier) => supplier.id === statusSupplier.id ? { ...supplier, status: nextIsActive ? 'active' : 'inactive' } : supplier))
      setIsUpdatingStatus(false)
      setStatusSupplier(null)
      return
    }

    const result = await updateSupplierStatus(statusSupplier.id, nextIsActive)

    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    setSuppliers((current) =>
      current.map((supplier) =>
        supplier.id === statusSupplier.id ? normalizeApiSupplier(result.supplier, supplier) : supplier,
      ),
    )
    setStatusSupplier(null)
  }

  const handleDeleteSupplier = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    if (DEMO_MODE) {
      setSuppliers((current) => current.filter((supplier) => supplier.id !== deleteTarget.id))
      setIsDeleting(false)
      setDeleteTarget(null)
      return
    }

    const result = await deleteSupplier(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setSuppliers((current) => current.filter((supplier) => supplier.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  if (isPreparingEdit) {
    return (
      <div className="p-10">
        <LoadingSpinner label="Loading supplier products..." />
      </div>
    )
  }

  if (isFormOpen) {
    return (
      <SupplierForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        supplier={editingSupplier}
        onSave={handleSaveSupplier}
        saving={isSaving}
        formError={formError}
        categoryOptions={supplierCategoryOptions}
      />
    )
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Suppliers</h1><p className="mt-1 text-xs text-neutral-400">{filteredSuppliers.length} suppliers in view</p></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search suppliers..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" />Filter</Button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportSuppliersCsv()}><Download className="size-4" />Export</Button>
                <Button onClick={() => handleOpenForm()} size="sm" className="h-9 rounded-2xl px-3.5"><Plus className="size-4" />Add Supplier</Button>
              </div>
            </div>
          </div>
          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Suppliers', value: supplierSummary.total, detail: `${supplierSummary.active} active`, icon: Users },
              { label: 'Active Suppliers', value: supplierSummary.active, detail: 'currently active', icon: Power },
              { label: 'Inactive Suppliers', value: supplierSummary.inactive, detail: 'needs review', icon: Users },
              { label: 'Outstanding Payable', value: formatCurrency(supplierSummary.payable), detail: 'total balance', icon: Wallet },
            ].map(({ label, value, detail, icon: Icon }, index) => (
              <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#6b86ad]">{label}</p><span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" /></span></div><p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p></div>
            ))}
          </div>
        </div>
      </Card>

      {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3"><p className="text-sm font-medium text-primary-900">{selectedIds.length} supplier{selectedIds.length === 1 ? '' : 's'} selected</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportSuppliersCsv(true)}><Download className="size-4" />Download</Button><Button type="button" variant="danger" size="sm" className="h-8 rounded-lg px-3" loading={isDeleting} onClick={handleBulkDelete}><Trash2 className="size-4" />Delete</Button></div></div>}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadSuppliers}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading suppliers..." />
          ) : suppliers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">
                {statusFilter === 'active' ? 'No active suppliers' : statusFilter === 'inactive' ? 'No inactive suppliers' : 'No suppliers yet'}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {statusFilter === 'all' ? 'Add your first supplier to start tracking purchases and payments.' : 'No suppliers are available in this status.'}
              </p>
              <Button type="button" className="mt-4" onClick={() => handleOpenForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Supplier
              </Button>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              {searchTerm.trim() ? 'No suppliers match your search.' : 'No suppliers match the selected filters.'}
            </p>
          ) : (
            <>
            <div className="space-y-3 px-4 md:hidden">
              {filteredSuppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">{getInitials(supplier.name)}</div>
                      <div className="min-w-0"><p className="truncate font-medium text-neutral-900">{supplier.name}</p><p className="truncate text-xs text-neutral-500">{supplier.contactPerson || '—'}</p></div>
                    </button>
                    <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>{formatSupplierStatus(supplier.status)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-neutral-400">Contact</p><p className="mt-1 truncate text-neutral-700">{supplier.phone || supplier.email || '—'}</p></div>
                    <div><p className="text-xs text-neutral-400">Outstanding</p><p className="mt-1 font-medium text-neutral-800">{formatCurrency(supplier.outstandingPayable)}</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="text-xs text-neutral-500">{getProductCount(supplier)} products</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}><Eye className="size-4" aria-hidden="true" /> View</Button>
                  </div>
                </div>
              ))}
            </div>
            <table className="listing-table hidden w-full min-w-[72rem] text-left text-sm md:table">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all suppliers" /></th>
                  <th className="whitespace-nowrap px-6 py-6">Supplier</th>
                  <th className="whitespace-nowrap px-6 py-6">Contact</th>
                  <th className="whitespace-nowrap px-6 py-6">City</th>
                  <th className="whitespace-nowrap px-6 py-6">Product Count</th>
                  <th className="whitespace-nowrap px-6 py-6">Total Purchases</th>
                  <th className="whitespace-nowrap px-6 py-6">Outstanding Payable</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(supplier.id)} onChange={() => setSelectedIds((current) => current.includes(supplier.id) ? current.filter((id) => id !== supplier.id) : [...current, supplier.id])} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${supplier.name}`} /></td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(supplier.name)}
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900">{supplier.name}</span>
                          <p className="mt-0.5 text-xs text-neutral-400">{supplier.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">
                      <span>{supplier.contactPerson || '-'}</span>
                      <p className="mt-0.5 text-xs text-neutral-400">{supplier.phone}</p>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{supplier.city || '-'}</td>
                    <td className="px-6 py-5 text-neutral-600">{getProductCount(supplier)}</td>
                    <td className="px-6 py-5 font-medium text-neutral-700">
                      {formatCurrency(supplier.totalPurchases)}
                    </td>
                    <td className="px-6 py-5">
                      {supplier.outstandingPayable > 0 ? (
                        <Badge variant="warning">{formatCurrency(supplier.outstandingPayable)}</Badge>
                      ) : (
                        <span className="font-medium text-neutral-700">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                        {formatSupplierStatus(supplier.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: Eye, onClick: () => navigate(`/admin/suppliers/${supplier.id}`) },
                          { label: 'Edit', icon: Edit, onClick: () => handleOpenForm(supplier) },
                          {
                            label: supplier.status === 'active' ? 'Deactivate' : 'Activate',
                            icon: Power,
                            onClick: () => setStatusSupplier(supplier),
                          },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(supplier),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredSuppliers.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button></div>
        </div>
      </Card>

      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Supplier filters">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-neutral-900">Filter Suppliers</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the suppliers shown in the table.</p></div><button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button></div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status<Select options={supplierStatusTabs.map((tab) => ({ value: tab.value, label: tab.label }))} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Category<Select options={[{ value: 'all', label: 'All supplier types' }, ...supplierCategoryOptions.map((category) => ({ value: category, label: category }))]} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort<Select options={[{ value: 'recent', label: 'Recent' }, { value: 'oldest', label: 'Oldest' }]} value={sortFilter} onChange={(event) => { setSortFilter(event.target.value); setPage(1) }} /></label>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSortFilter('recent'); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div>
          </aside>
        </div>
      )}

      <Modal
        isOpen={Boolean(statusSupplier)}
        onClose={() => {
          if (isUpdatingStatus) return
          setStatusError('')
          setStatusSupplier(null)
        }}
        title={`${statusSupplier?.status === 'active' ? 'Deactivate' : 'Activate'} Supplier`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {statusSupplier?.status === 'active'
              ? 'This supplier will be moved to inactive status. Existing purchase history remains unchanged.'
              : 'This supplier will be marked active and available for new purchases again.'}
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
                setStatusSupplier(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusSupplier?.status === 'active' ? 'danger' : 'primary'}
              loading={isUpdatingStatus}
              onClick={handleToggleStatus}
            >
              {statusSupplier?.status === 'active' ? 'Deactivate' : 'Activate'}
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
        title="Delete Supplier"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.name || 'this supplier'}? This cannot be undone.
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
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteSupplier}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
