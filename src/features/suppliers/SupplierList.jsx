import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Eye, Plus, Power, RotateCw, Search, Trash2 } from 'lucide-react'
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
  listSuppliers,
  updateSupplier,
  updateSupplierStatus,
} from '../../api/suppliers'
import { formatCurrency } from '../../utils/format'
import SupplierForm from './SupplierForm'
import { normalizeApiSupplier } from './supplierUtils'

const supplierStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const getInitials = (name = '') =>
  name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

export default function SupplierList() {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusSupplier, setStatusSupplier] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [supplierCategoryOptions, setSupplierCategoryOptions] = useState([])

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true)
    setListError('')

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
  }, [categoryFilter, searchTerm, statusFilter])

  const loadSupplierCategoryOptions = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    loadSupplierCategoryOptions()
  }, [loadSupplierCategoryOptions])

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = suppliers.filter((supplier) => {
      const matchesSearch =
        !normalizedSearch ||
        [supplier.name, supplier.contactPerson, supplier.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime()
      const rightTime = new Date(right.createdAt || 0).getTime()

      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [categoryFilter, searchTerm, sortFilter, statusFilter, suppliers])

  const handleOpenForm = (supplier = null) => {
    setEditingSupplier(supplier)
    setFormError('')
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

    const result = editingSupplier
      ? await updateSupplier(editingSupplier.id, supplierData)
      : await createSupplier(supplierData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setSuppliers((current) =>
      editingSupplier
        ? current.map((supplier) =>
            supplier.id === editingSupplier.id ? normalizeApiSupplier(result.supplier, supplierData) : supplier,
          )
        : [normalizeApiSupplier(result.supplier, supplierData), ...current],
    )
    handleCloseForm()
  }

  const handleToggleStatus = async () => {
    if (!statusSupplier) return

    const nextIsActive = statusSupplier.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

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

    const result = await deleteSupplier(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setSuppliers((current) => current.filter((supplier) => supplier.id !== deleteTarget.id))
    setDeleteTarget(null)
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
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-5">
              {supplierStatusTabs.map((tab) => {
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
            <Button onClick={() => handleOpenForm()} size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Add Supplier
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
                  placeholder="Search suppliers, contact, phone"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={[{ value: 'all', label: 'All categories' }, ...supplierCategoryOptions.map((category) => ({ value: category, label: category }))]}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="sm:w-48"
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
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
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
              <p className="text-sm font-medium text-neutral-900">No suppliers yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first supplier to start tracking purchases and payments.</p>
              <Button type="button" className="mt-4" onClick={() => handleOpenForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Supplier
              </Button>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No suppliers match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3">Contact</th>
                  <th className="whitespace-nowrap px-4 py-3">City</th>
                  <th className="whitespace-nowrap px-4 py-3">Total Purchases</th>
                  <th className="whitespace-nowrap px-4 py-3">Outstanding Payable</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
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
                    <td className="px-4 py-3.5 text-neutral-600">
                      <span>{supplier.contactPerson || '-'}</span>
                      <p className="mt-0.5 text-xs text-neutral-400">{supplier.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{supplier.city || '-'}</td>
                    <td className="px-4 py-3.5 font-medium text-neutral-700">
                      {formatCurrency(supplier.totalPurchases)}
                    </td>
                    <td className="px-4 py-3.5">
                      {supplier.outstandingPayable > 0 ? (
                        <Badge variant="warning">{formatCurrency(supplier.outstandingPayable)}</Badge>
                      ) : (
                        <span className="font-medium text-neutral-700">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                        {supplier.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
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
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredSuppliers.length === 0 ? '0' : `1 to ${filteredSuppliers.length}`} of {suppliers.length}
          </span>
          <span>Suppliers</span>
        </div>
      </Card>

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
