import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, Edit, Eye, PackageSearch, Plus, RotateCw, Search, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import {
  adjustWarehouseStock,
  createWarehouse,
  deleteWarehouse,
  getWarehouseStock,
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
import StatCard from '../../components/ui/StatCard'
import { safeNumber } from '../purchases/purchaseHelpers'
import {
  warehouseStatusMeta,
  WAREHOUSE_SORT_OPTIONS,
  WAREHOUSE_STATUS_FILTER_OPTIONS,
} from './warehouseHelpers'
import {
  WAREHOUSES_DEMO_ENABLED,
  createDemoWarehouse,
  getDemoWarehouses,
  isDemoWarehouse,
  patchDemoWarehouse,
} from './warehouseDemoData'
import WarehouseForm from './WarehouseForm'

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
      {formError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
      <p className="text-sm text-neutral-500">Adjusting stock at <span className="font-medium text-neutral-800">{warehouse?.name}</span></p>
      <Select label="Product" required options={productOptions} value={productId} onChange={(event) => setProductId(event.target.value)} placeholder={isLoadingProducts ? 'Loading products...' : 'Select product'} disabled={isLoadingProducts} />
      <Select label="Movement Type" options={movementTypeOptions} value={movementType} onChange={(event) => setMovementType(event.target.value)} />
      <Input label="Quantity" type="number" required step="1" placeholder="Positive to add, negative to remove" value={quantity} onChange={(event) => setQuantity(event.target.value)} onBlur={(event) => { const rounded = Math.round(Number(event.target.value)); setQuantity(Number.isFinite(rounded) ? String(rounded) : '') }} />
      <Input label="Note" placeholder="Reason for this adjustment" value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Adjustment</Button>
      </div>
    </form>
  )
}

export default function WarehouseList() {
  const navigate = useNavigate()
  const demoOn = WAREHOUSES_DEMO_ENABLED

  const [warehouses, setWarehouses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [adjustTarget, setAdjustTarget] = useState(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState('')
  const [adjustSuccess, setAdjustSuccess] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const [result, stockResult] = await Promise.all([listWarehouses(), getWarehouseStock()])
    const stockByWarehouse = {}
    if (stockResult.success) {
      ;(stockResult.stock || []).forEach((row) => {
        const wid = row.warehouse_id
        if (!stockByWarehouse[wid]) stockByWarehouse[wid] = { productCount: 0, stockUnits: 0, lowStockCount: 0 }
        stockByWarehouse[wid].productCount += 1
        stockByWarehouse[wid].stockUnits += safeNumber(row.on_hand)
        const available = safeNumber(row.available ?? safeNumber(row.on_hand) - safeNumber(row.reserved))
        // Low Stock only: Available > 0 AND Available <= reorder level (Out of Stock is separate).
        if (available > 0 && available <= safeNumber(row.minimum_stock_level)) stockByWarehouse[wid].lowStockCount += 1
      })
    }

    const demoRows = demoOn ? getDemoWarehouses() : []

    if (!result.success) {
      setWarehouses(demoRows)
      setListError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    const realRows = result.warehouses.map((warehouse) => ({
      ...warehouse,
      ...(stockByWarehouse[warehouse.id] || { productCount: 0, stockUnits: 0, lowStockCount: 0 }),
    }))
    setWarehouses([...realRows, ...demoRows])
    setIsLoading(false)
  }, [demoOn])

  useEffect(() => {
    loadWarehouses()
  }, [loadWarehouses])

  const stats = useMemo(() => {
    return warehouses.reduce(
      (acc, warehouse) => ({
        total: acc.total + 1,
        active: acc.active + (warehouse.isActive ? 1 : 0),
        stockUnits: acc.stockUnits + safeNumber(warehouse.stockUnits),
        lowStock: acc.lowStock + safeNumber(warehouse.lowStockCount),
      }),
      { total: 0, active: 0, stockUnits: 0, lowStock: 0 },
    )
  }, [warehouses])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = warehouses.filter((warehouse) => {
      const matchesSearch =
        !query ||
        [warehouse.name, warehouse.code, warehouse.city].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? warehouse.isActive : !warehouse.isActive)
      return matchesSearch && matchesStatus
    })

    return filtered.sort((left, right) => {
      if (sortFilter === 'name') return String(left.name).localeCompare(String(right.name))
      if (sortFilter === 'stock') return safeNumber(right.stockUnits) - safeNumber(left.stockUnits)
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    })
  }, [warehouses, search, statusFilter, sortFilter])

  const openForm = (warehouse = null) => {
    setEditingWarehouse(warehouse)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    setFormError('')

    if (editingWarehouse && isDemoWarehouse(editingWarehouse.id)) {
      patchDemoWarehouse(editingWarehouse.id, formData)
      await loadWarehouses()
      setIsSaving(false)
      setIsFormOpen(false)
      setEditingWarehouse(null)
      return
    }
    if (!editingWarehouse && demoOn) {
      createDemoWarehouse(formData)
      await loadWarehouses()
      setIsSaving(false)
      setIsFormOpen(false)
      return
    }

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
    setIsFormOpen(false)
    setEditingWarehouse(null)
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
    loadWarehouses()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')

    if (isDemoWarehouse(deleteTarget.id)) {
      setWarehouses((current) => current.filter((warehouse) => warehouse.id !== deleteTarget.id))
      setIsDeleting(false)
      setDeleteTarget(null)
      return
    }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Warehouses</h1>
          <p className="mt-1 text-sm text-neutral-500">Stock locations and what each one holds.</p>
        </div>
        <Button type="button" onClick={() => openForm()}>
          <Plus className="size-4" aria-hidden="true" />
          Add Warehouse
        </Button>
      </div>

      {adjustSuccess && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{adjustSuccess}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={WarehouseIcon} iconVariant="primary" label="Total Warehouses" value={stats.total} />
        <StatCard icon={ClipboardList} iconVariant="success" label="Active Warehouses" value={stats.active} />
        <StatCard icon={Boxes} iconVariant="info" label="Total Stock Units" value={stats.stockUnits} />
        <StatCard icon={PackageSearch} iconVariant="warning" label="Low Stock Items" value={stats.lowStock} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Warehouse / Code / City"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <Select options={WAREHOUSE_STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
          <Select options={WAREHOUSE_SORT_OPTIONS} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
        </div>

        <div className="overflow-x-auto">
          {listError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadWarehouses}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-10"><LoadingSpinner label="Loading warehouses..." /></div>
          ) : warehouses.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No warehouses yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first stock location to start assigning inventory.</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No warehouses match the selected filters.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {rows.map((warehouse) => {
                  const status = warehouseStatusMeta(warehouse.isActive)
                  return (
                    <div key={warehouse.id} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)" onClick={() => navigate(`/admin/warehouses/${warehouse.id}`)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">
                            {warehouse.name}
                            {isDemoWarehouse(warehouse.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                          </p>
                          <p className="truncate text-xs text-neutral-500">{warehouse.code} · {warehouse.city || '—'}</p>
                        </div>
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-neutral-400">Stock Units</p><p className="font-medium text-neutral-800">{safeNumber(warehouse.stockUnits)}</p></div>
                        <div><p className="text-xs text-neutral-400">Low Stock</p><p className="text-neutral-700">{safeNumber(warehouse.lowStockCount)}</p></div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <table className="hidden w-full min-w-4xl text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    <th className="whitespace-nowrap px-4 py-3.5">Warehouse</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Location</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Manager / In-Charge</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right">Products</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right">Stock Units</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right">Low Stock</th>
                    <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {rows.map((warehouse) => {
                    const status = warehouseStatusMeta(warehouse.isActive)
                    return (
                      <tr key={warehouse.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`/admin/warehouses/${warehouse.id}`)}>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="font-medium text-neutral-900">{warehouse.name}</span>
                          <span className="ml-2 text-xs text-neutral-400">{warehouse.code}</span>
                          {isDemoWarehouse(warehouse.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{[warehouse.city, warehouse.state].filter(Boolean).join(', ') || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{warehouse.managerName || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{safeNumber(warehouse.productCount)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{safeNumber(warehouse.stockUnits)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-700">{safeNumber(warehouse.lowStockCount)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={status.variant} dot>{status.label}</Badge></td>
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                          <ActionMenu
                            items={[
                              { label: 'View', icon: Eye, onClick: () => navigate(`/admin/warehouses/${warehouse.id}`) },
                              { label: 'Edit', icon: Edit, onClick: () => openForm(warehouse) },
                              ...(isDemoWarehouse(warehouse.id)
                                ? []
                                : [{ label: 'Adjust Stock', icon: Boxes, onClick: () => { setAdjustError(''); setAdjustSuccess(''); setAdjustTarget(warehouse) } }]),
                              { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(warehouse) },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Card>

      <Modal isOpen={isFormOpen} onClose={() => !isSaving && (setIsFormOpen(false), setEditingWarehouse(null))} title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'} size="2xl">
        <WarehouseForm
          warehouse={editingWarehouse}
          demoMode={editingWarehouse ? isDemoWarehouse(editingWarehouse.id) : demoOn}
          saving={isSaving}
          formError={formError}
          onClose={() => { setIsFormOpen(false); setEditingWarehouse(null) }}
          onSave={handleSave}
        />
      </Modal>

      <Modal isOpen={Boolean(adjustTarget)} onClose={() => !isAdjusting && setAdjustTarget(null)} title="Adjust Warehouse Stock" size="lg">
        <StockAdjustForm warehouse={adjustTarget} saving={isAdjusting} formError={adjustError} onClose={() => setAdjustTarget(null)} onSave={handleAdjustStock} />
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !isDeleting && setDeleteTarget(null)} title="Remove Warehouse">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Remove {deleteTarget?.name || 'this warehouse'}? Warehouses that still hold stock or have active reservations can&apos;t be removed — set them to Inactive instead.
          </p>
          {deleteError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Remove</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
