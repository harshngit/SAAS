import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ChevronLeft, ChevronRight, ClipboardList, Download, Edit, Eye, PackageSearch, Plus, RotateCw, Search, SlidersHorizontal, Trash2, Warehouse as WarehouseIcon, X } from 'lucide-react'
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
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { safeNumber } from '../purchases/purchaseHelpers'
import {
  warehouseStatusMeta,
  WAREHOUSE_SORT_OPTIONS,
  WAREHOUSE_STATUS_FILTER_OPTIONS,
} from './warehouseHelpers'
import {
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
  // Explicit demo split (task section 27): demo mode -> demo fixtures only, no real API call;
  // real mode -> real API only, an empty response is a real empty state (never a demo fallback).
  const isDemo = DEMO_MODE
  const demoHasFixtures = DEMO_MODE && !DEMO_EMPTY

  const [warehouses, setWarehouses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

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

    // Demo mode: local fixtures only, no real API call.
    if (isDemo) {
      setWarehouses(demoHasFixtures ? getDemoWarehouses() : [])
      setIsLoading(false)
      return
    }

    const [result, stockResult] = await Promise.all([listWarehouses(), getWarehouseStock()])
    const stockByWarehouse = {}
    if (stockResult.success) {
      ;(stockResult.stock || []).forEach((row) => {
        const wid = row.warehouse_id
        if (!stockByWarehouse[wid]) stockByWarehouse[wid] = { productCount: 0, stockUnits: 0, lowStockCount: 0 }
        stockByWarehouse[wid].productCount += 1
        stockByWarehouse[wid].stockUnits += safeNumber(row.on_hand)
        const available = safeNumber(row.available ?? safeNumber(row.on_hand) - safeNumber(row.reserved))
        // Low Stock only: minimum > 0 AND 0 < Available <= minimum (Out of Stock is separate).
        const minimum = safeNumber(row.minimum_stock_level)
        if (minimum > 0 && available > 0 && available <= minimum) stockByWarehouse[wid].lowStockCount += 1
      })
    }

    // Real mode: a failure is a real error; an empty list is a truthful empty state.
    if (!result.success) {
      setWarehouses([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setWarehouses(
      result.warehouses.map((warehouse) => ({
        ...warehouse,
        ...(stockByWarehouse[warehouse.id] || { productCount: 0, stockUnits: 0, lowStockCount: 0 }),
      })),
    )
    setIsLoading(false)
  }, [isDemo, demoHasFixtures])

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

  const totalPages = Math.max(1, Math.ceil(rows.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = rows.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(rows.length, currentPage * Number(pageSize))
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((warehouse) => selectedIds.includes(warehouse.id))

  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleRows.some((warehouse) => warehouse.id === id))
    : [...new Set([...current, ...visibleRows.map((warehouse) => warehouse.id)])])

  const exportWarehousesCsv = (onlySelected = false) => {
    const rowsToExport = onlySelected ? rows.filter((warehouse) => selectedIds.includes(warehouse.id)) : rows
    const data = [['Warehouse', 'Code', 'Location', 'Manager', 'Products', 'Stock Units', 'Low Stock', 'Status'], ...rowsToExport.map((warehouse) => [warehouse.name, warehouse.code, [warehouse.city, warehouse.state].filter(Boolean).join(', '), warehouse.managerName, safeNumber(warehouse.productCount), safeNumber(warehouse.stockUnits), safeNumber(warehouse.lowStockCount), warehouse.isActive ? 'Active' : 'Inactive'])]
    const csv = data.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = 'warehouses.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(`Remove ${selectedIds.length} selected warehouse${selectedIds.length === 1 ? '' : 's'}?`)) return
    setIsDeleting(true)
    const results = await Promise.all(selectedIds.map((id) => isDemoWarehouse(id) ? Promise.resolve({ success: true }) : deleteWarehouse(id)))
    const failed = results.find((result) => !result.success)
    if (failed) { setDeleteError(failed.error || 'Some warehouses could not be removed.'); setIsDeleting(false); return }
    setWarehouses((current) => current.filter((warehouse) => !selectedIds.includes(warehouse.id))); setSelectedIds([]); setIsDeleting(false)
  }

  const openForm = (warehouse = null) => {
    setEditingWarehouse(warehouse)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSave = async (formData) => {
    setIsSaving(true)
    setFormError('')

    if (isDemo || (editingWarehouse && isDemoWarehouse(editingWarehouse.id))) {
      if (editingWarehouse) patchDemoWarehouse(editingWarehouse.id, formData)
      else createDemoWarehouse(formData)
      await loadWarehouses()
      setIsSaving(false)
      setIsFormOpen(false)
      setEditingWarehouse(null)
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
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Warehouses</h1><p className="mt-1 text-xs text-neutral-400">{rows.length} warehouses in view</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search warehouses..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" />Filter</Button><Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportWarehousesCsv()}><Download className="size-4" />Export</Button><Button type="button" onClick={() => openForm()} size="sm" className="h-9 rounded-2xl px-3.5"><Plus className="size-4" />Add Warehouse</Button></div></div></div>
          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">{[{ label: 'Total Warehouses', value: stats.total, detail: `${stats.active} active`, icon: WarehouseIcon }, { label: 'Active Warehouses', value: stats.active, detail: 'currently active', icon: ClipboardList }, { label: 'Stock Units', value: stats.stockUnits, detail: `${stats.lowStock} low stock`, icon: Boxes }, { label: 'Low Stock Items', value: stats.lowStock, detail: 'needs attention', icon: PackageSearch }].map(({ label, value, detail, icon: Icon }, index) => <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#6b86ad]">{label}</p><span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" /></span></div><p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p></div>)}</div>
        </div>
      </Card>
      {adjustSuccess && <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{adjustSuccess}</div>}
      {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3"><p className="text-sm font-medium text-primary-900">{selectedIds.length} warehouse{selectedIds.length === 1 ? '' : 's'} selected</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportWarehousesCsv(true)}><Download className="size-4" />Download</Button><Button type="button" variant="danger" size="sm" className="h-8 rounded-lg px-3" loading={isDeleting} onClick={handleBulkDelete}><Trash2 className="size-4" />Delete</Button></div></div>}
      <Card className="overflow-hidden p-0">

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
                {visibleRows.map((warehouse) => {
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
              <table className="listing-table hidden w-full min-w-[72rem] text-left text-sm md:table">
              <thead>
                  <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                    <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all warehouses" /></th>
                    <th className="whitespace-nowrap px-6 py-6">Warehouse</th><th className="whitespace-nowrap px-6 py-6">Location</th><th className="whitespace-nowrap px-6 py-6">Manager / In-Charge</th><th className="whitespace-nowrap px-6 py-6">Products</th><th className="whitespace-nowrap px-6 py-6">Stock Units</th><th className="whitespace-nowrap px-6 py-6">Low Stock</th><th className="whitespace-nowrap px-6 py-6">Status</th><th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {visibleRows.map((warehouse) => {
                    const status = warehouseStatusMeta(warehouse.isActive)
                    return (
                      <tr key={warehouse.id} className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30" onClick={() => navigate(`/admin/warehouses/${warehouse.id}`)}>
                        <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(warehouse.id)} onChange={() => setSelectedIds((current) => current.includes(warehouse.id) ? current.filter((id) => id !== warehouse.id) : [...current, warehouse.id])} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${warehouse.name}`} /></td>
                        <td className="whitespace-nowrap px-6 py-5">
                          <span className="font-medium text-neutral-900">{warehouse.name}</span>
                          <span className="ml-2 text-xs text-neutral-400">{warehouse.code}</span>
                          {isDemoWarehouse(warehouse.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 text-neutral-600">{[warehouse.city, warehouse.state].filter(Boolean).join(', ') || '—'}</td>
                        <td className="whitespace-nowrap px-6 py-5 text-neutral-600">{warehouse.managerName || '—'}</td>
                        <td className="whitespace-nowrap px-6 py-5 text-neutral-700">{safeNumber(warehouse.productCount)}</td>
                        <td className="whitespace-nowrap px-6 py-5 font-medium text-neutral-900">{safeNumber(warehouse.stockUnits)}</td>
                        <td className="whitespace-nowrap px-6 py-5 text-neutral-700">{safeNumber(warehouse.lowStockCount)}</td>
                        <td className="whitespace-nowrap px-6 py-5"><Badge variant={status.variant} dot>{status.label}</Badge></td>
                        <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]"><div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{rows.length}</span></span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div><div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button></div></div>
      {isFilterOpen && <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Warehouse filters"><button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" /><aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-neutral-900">Filter Warehouses</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the warehouses shown in the table.</p></div><button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button></div><div className="flex-1 space-y-5 overflow-y-auto px-5 py-6"><label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status<Select options={WAREHOUSE_STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} /></label><label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sort<Select options={WAREHOUSE_SORT_OPTIONS} value={sortFilter} onChange={(event) => { setSortFilter(event.target.value); setPage(1) }} /></label></div><div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setStatusFilter('all'); setSortFilter('recent'); setSearch(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div></aside></div>}
      <Modal isOpen={isFormOpen} onClose={() => !isSaving && (setIsFormOpen(false), setEditingWarehouse(null))} title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'} size="2xl">
        <WarehouseForm
          warehouse={editingWarehouse}
          demoMode={editingWarehouse ? isDemoWarehouse(editingWarehouse.id) : isDemo}
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
