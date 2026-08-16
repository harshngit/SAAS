import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, Edit, MapPin, Plus, RotateCw, Search, Star, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import {
  adjustWarehouseStock,
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
} from '../../api/warehouses'
import { listProducts } from '../../api/products'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'

const movementTypeOptions = [
  { value: 'adjustment', label: 'Stock Take Adjustment' },
  { value: 'opening', label: 'Opening Balance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'purchase_in', label: 'Goods Received' },
]

function StockAdjustForm({ warehouse, saving, formError, onClose, onSave }) {
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [movementType, setMovementType] = useState('adjustment')
  const [note, setNote] = useState('')

  useEffect(() => {
    listProducts().then((result) => {
      if (result.success) setProducts(result.products)
      setIsLoadingProducts(false)
    })
  }, [])

  const productOptions = useMemo(() => products.map((product) => ({ value: product.id, label: product.name })), [products])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!productId || !quantity) return
    onSave({ productId, quantity, movementType, note: note || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}
      <p className="text-sm text-neutral-500">Adjusting stock at <span className="font-medium text-neutral-800">{warehouse?.name}</span></p>
      <Select
        label="Product"
        required
        options={productOptions}
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        placeholder={isLoadingProducts ? 'Loading products...' : 'Select product'}
        disabled={isLoadingProducts}
      />
      <Select
        label="Movement Type"
        options={movementTypeOptions}
        value={movementType}
        onChange={(event) => setMovementType(event.target.value)}
      />
      <Input
        label="Quantity"
        type="number"
        required
        placeholder="Positive to add, negative to remove"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <Input
        label="Note"
        placeholder="Reason for this adjustment"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save Adjustment
        </Button>
      </div>
    </form>
  )
}

const emptyForm = {
  name: '',
  code: '',
  address: '',
  city: '',
  contactNumber: '',
  isDefault: false,
  isActive: true,
}

function WarehouseForm({ warehouse, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(warehouse ? { ...emptyForm, ...warehouse } : emptyForm)
    setErrors({})
  }, [warehouse])

  const validate = () => {
    const nextErrors = {}
    if (!formData.name.trim()) nextErrors.name = 'Enter a warehouse name.'
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
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}

      <Input
        label="Warehouse Name"
        placeholder="Enter warehouse name"
        value={formData.name}
        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
        error={errors.name}
        required
      />
      <Input
        label="Code"
        placeholder="Auto-generated if left blank (WH-001)"
        value={formData.code}
        onChange={(event) => setFormData((current) => ({ ...current, code: event.target.value }))}
      />
      <Input
        label="Address"
        placeholder="Warehouse address"
        value={formData.address}
        onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="City"
          placeholder="City"
          value={formData.city}
          onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
        />
        <Input
          label="Contact Number"
          placeholder="Contact number"
          value={formData.contactNumber}
          onChange={(event) => setFormData((current) => ({ ...current, contactNumber: event.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={formData.isDefault}
            onChange={(event) => setFormData((current) => ({ ...current, isDefault: event.target.checked }))}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Set as default warehouse
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Active
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {warehouse ? 'Save Changes' : 'Add Warehouse'}
        </Button>
      </div>
    </form>
  )
}

export default function WarehouseList() {
  const [warehouses, setWarehouses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState('')
  const [adjustSuccess, setAdjustSuccess] = useState('')

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listWarehouses()

    if (!result.success) {
      setWarehouses([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setWarehouses(result.warehouses)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadWarehouses()
  }, [loadWarehouses])

  const filteredWarehouses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return warehouses

    return warehouses.filter((warehouse) =>
      [warehouse.name, warehouse.code, warehouse.city, warehouse.address]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    )
  }, [warehouses, searchTerm])

  const openForm = (warehouse = null) => {
    setEditingWarehouse(warehouse)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingWarehouse(null)
    setFormError('')
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = editingWarehouse
      ? await updateWarehouse(editingWarehouse.id, formData)
      : await createWarehouse(formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    await loadWarehouses()
    setIsSaving(false)
    closeForm()
  }

  const handleAdjustStock = async (payload) => {
    if (!adjustTarget) return

    setIsAdjusting(true)
    setAdjustError('')

    const result = await adjustWarehouseStock(adjustTarget.id, payload)

    if (!result.success) {
      setAdjustError(result.error)
      setIsAdjusting(false)
      return
    }

    setIsAdjusting(false)
    setAdjustTarget(null)
    setAdjustSuccess('Stock adjustment recorded.')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteWarehouse(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setWarehouses((current) => current.filter((warehouse) => warehouse.id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-5">
      {adjustSuccess && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{adjustSuccess}</div>
      )}
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Warehouses</h2>
              <p className="mt-1 text-sm text-neutral-500">Manage stock locations used across orders, purchases, and products.</p>
            </div>
            <Button type="button" size="sm" onClick={() => openForm()}>
              <Plus className="size-4" aria-hidden="true" />
              Add Warehouse
            </Button>
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
                placeholder="Search warehouses"
                className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadWarehouses}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading warehouses..." />
          ) : warehouses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No warehouses yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first stock location to start assigning inventory.</p>
              <Button type="button" className="mt-4" onClick={() => openForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Warehouse
              </Button>
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No warehouses match this search.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Warehouse</th>
                  <th className="whitespace-nowrap px-4 py-3">Code</th>
                  <th className="whitespace-nowrap px-4 py-3">Location</th>
                  <th className="whitespace-nowrap px-4 py-3">Contact</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <WarehouseIcon className="size-4" aria-hidden="true" />
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900">{warehouse.name}</span>
                          {warehouse.isDefault && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                              <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{warehouse.code || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        {(warehouse.city || warehouse.address) && <MapPin className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />}
                        {[warehouse.city, warehouse.address].filter(Boolean).join(' · ') || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{warehouse.contactNumber || '-'}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={warehouse.isActive ? 'success' : 'neutral'} dot>
                        {warehouse.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => openForm(warehouse) },
                          {
                            label: 'Adjust Stock',
                            icon: Boxes,
                            onClick: () => { setAdjustError(''); setAdjustSuccess(''); setAdjustTarget(warehouse) },
                          },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(warehouse),
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
            {filteredWarehouses.length === 0 ? '0' : `1 to ${filteredWarehouses.length}`} of {warehouses.length}
          </span>
          <span>Warehouses</span>
        </div>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        className="max-w-lg"
      >
        <WarehouseForm
          warehouse={editingWarehouse}
          saving={isSaving}
          formError={formError}
          onClose={closeForm}
          onSave={handleSave}
        />
      </Modal>

      <Modal
        isOpen={Boolean(adjustTarget)}
        onClose={() => {
          if (isAdjusting) return
          setAdjustError('')
          setAdjustTarget(null)
        }}
        title="Adjust Warehouse Stock"
        className="max-w-lg"
      >
        <StockAdjustForm
          warehouse={adjustTarget}
          saving={isAdjusting}
          formError={adjustError}
          onClose={() => setAdjustTarget(null)}
          onSave={handleAdjustStock}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Warehouse"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.name || 'this warehouse'}? This cannot be undone. Warehouses that still hold stock or have
            active reservations can't be deleted.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
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
