import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Boxes, CheckCircle2, Lock, PackageSearch, Pencil, Search, Warehouse as WarehouseIcon, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { getWarehouse, getWarehouseStock, updateWarehouse } from '../../api/warehouses'
import { safeNumber } from '../purchases/purchaseHelpers'
import {
  availableQty,
  deriveStockStatus,
  movementTypeLabel,
  STOCK_STATUS_FILTER_OPTIONS,
  summarizeStock,
  transferStatusMeta,
  validateTransfer,
  warehouseStatusMeta,
  WAREHOUSE_MOVEMENTS_NOTE,
  WAREHOUSE_TRANSFERS_NOTE,
} from './warehouseHelpers'
import {
  createDemoTransfer,
  getDemoTransfers,
  getDemoWarehouse,
  getDemoWarehouseMovements,
  getDemoWarehouses,
  getDemoWarehouseStock,
  isDemoWarehouse,
  patchDemoWarehouse,
} from './warehouseDemoData'
import WarehouseForm from './WarehouseForm'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function normalizeRealStockRow(row) {
  const onHand = safeNumber(row.on_hand)
  const reserved = safeNumber(row.reserved)
  return {
    productId: row.product_id,
    productName: row.product_name || row.variant_name || 'Product',
    sku: row.sku || '',
    category: row.category || '—',
    onHand,
    reserved,
    reorderLevel: safeNumber(row.minimum_stock_level),
  }
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value === 0 ? '0' : value || '—'}</p>
    </div>
  )
}

export default function WarehouseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDemo = isDemoWarehouse(id)

  const [warehouse, setWarehouse] = useState(null)
  const [stock, setStock] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [stockSearch, setStockSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockStatusFilter, setStockStatusFilter] = useState('all')

  const [transferOpen, setTransferOpen] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      const record = getDemoWarehouse(id)
      setWarehouse(record)
      setStock(record ? getDemoWarehouseStock(id) : [])
      setLoadError(record ? '' : 'Demo warehouse not found.')
      setIsLoading(false)
      return
    }

    const [warehouseResult, stockResult] = await Promise.all([getWarehouse(id), getWarehouseStock({ warehouse_id: id })])
    if (!warehouseResult.success) {
      setLoadError(warehouseResult.error)
      setIsLoading(false)
      return
    }
    setWarehouse(warehouseResult.warehouse)
    setStock(stockResult.success ? (stockResult.stock || []).map(normalizeRealStockRow) : [])
    setIsLoading(false)
  }, [id, isDemo])

  useEffect(() => {
    load()
  }, [load, refresh])

  const summary = useMemo(() => summarizeStock(stock), [stock])
  const categoryOptions = useMemo(() => {
    const names = [...new Set(stock.map((row) => row.category).filter((value) => value && value !== '—'))]
    return [{ value: 'all', label: 'All Categories' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [stock])

  const stockRows = useMemo(() => {
    const query = stockSearch.trim().toLowerCase()
    return stock.filter((row) => {
      const matchesSearch = !query || [row.productName, row.sku].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'all' || row.category === categoryFilter
      const matchesStatus = stockStatusFilter === 'all' || deriveStockStatus(row).key === stockStatusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [stock, stockSearch, categoryFilter, stockStatusFilter])

  // refresh is bumped after edit / transfer so these re-read the demo store.
  /* eslint-disable react-hooks/exhaustive-deps */
  const movements = useMemo(() => (isDemo ? getDemoWarehouseMovements(id) : []), [isDemo, id, refresh])
  const transfers = useMemo(() => (isDemo ? getDemoTransfers(id) : []), [isDemo, id, refresh])
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleEditSave = async (formData) => {
    setIsSaving(true)
    setEditError('')
    if (isDemo) {
      patchDemoWarehouse(id, formData)
      setIsSaving(false)
      setEditOpen(false)
      setRefresh((value) => value + 1)
      return
    }
    const result = await updateWarehouse(id, formData)
    if (!result.success) {
      setEditError(result.error)
      setIsSaving(false)
      return
    }
    setIsSaving(false)
    setEditOpen(false)
    setRefresh((value) => value + 1)
  }

  if (isLoading) return <LoadingSpinner label="Loading warehouse..." />

  if (loadError || !warehouse) {
    return (
      <Card>
        <EmptyState
          icon={WarehouseIcon}
          title="Warehouse not found"
          description={loadError || 'This warehouse may have been removed.'}
          action={{ label: 'Back to Warehouses', onClick: () => navigate('/admin/warehouses') }}
        />
      </Card>
    )
  }

  const status = warehouseStatusMeta(warehouse.isActive)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/warehouses')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{warehouse.name}</h1>
              <span className="text-sm text-neutral-400">{warehouse.code}</span>
              <Badge variant={status.variant} dot>{status.label}</Badge>
              {isDemo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditError(''); setEditOpen(true) }}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit Warehouse
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={PackageSearch} iconVariant="primary" label="Products" value={summary.products} />
        <StatCard icon={Boxes} iconVariant="info" label="Total Stock Units" value={summary.onHand} />
        <StatCard icon={Lock} iconVariant="neutral" label="Reserved Stock" value={summary.reserved} />
        <StatCard icon={CheckCircle2} iconVariant="success" label="Available Stock" value={summary.available} />
        <StatCard icon={WarehouseIcon} iconVariant="warning" label="Low Stock Items" value={summary.lowStock} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Warehouse Name" value={warehouse.name} />
              <Field label="Code" value={warehouse.code} />
              <Field label="Address" value={[warehouse.address, warehouse.addressLine2, warehouse.city, warehouse.state, warehouse.pinCode].filter(Boolean).join(', ')} />
              <Field label="Manager / In-Charge" value={warehouse.managerName} />
              <Field label="Phone" value={warehouse.contactNumber} />
              <Field label="Email" value={warehouse.email} />
              <Field label="Status" value={status.label} />
              {warehouse.notes && <Field label="Notes" value={warehouse.notes} />}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Card title="Warehouse Stock" subtitle="Available = On Hand − Reserved." className="p-0" bodyClassName="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(event) => setStockSearch(event.target.value)}
                  placeholder="Search Product / SKU"
                  className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select options={categoryOptions} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
              <Select options={STOCK_STATUS_FILTER_OPTIONS} value={stockStatusFilter} onChange={(event) => setStockStatusFilter(event.target.value)} className="w-40" triggerClassName="bg-white" />
            </div>

            {stock.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-neutral-500">No stock recorded for this warehouse yet.</p>
            ) : stockRows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-neutral-500">No products match the selected filters.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="space-y-3 p-4 md:hidden">
                  {stockRows.map((row) => {
                    const st = deriveStockStatus(row)
                    return (
                      <div key={row.productId} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{row.productName}</p>
                            <p className="truncate text-xs text-neutral-500">{row.sku || '—'}</p>
                          </div>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div><p className="text-xs text-neutral-400">Available</p><p className="font-medium text-neutral-800">{availableQty(row)}</p></div>
                          <div><p className="text-xs text-neutral-400">Reserved</p><p className="text-neutral-700">{safeNumber(row.reserved)}</p></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-4xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-5 py-3">Product</th>
                        <th className="px-5 py-3">SKU</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3 text-right">On Hand</th>
                        <th className="px-5 py-3 text-right">Reserved</th>
                        <th className="px-5 py-3 text-right">Available</th>
                        <th className="px-5 py-3 text-right">Reorder Level</th>
                        <th className="px-5 py-3">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {stockRows.map((row) => {
                        const st = deriveStockStatus(row)
                        return (
                          <tr key={row.productId} className="hover:bg-primary-50/35">
                            <td className="px-5 py-3.5 font-medium text-neutral-900">{row.productName}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{row.sku || '—'}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{row.category || '—'}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-700">{safeNumber(row.onHand)}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-700">{safeNumber(row.reserved)}</td>
                            <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{availableQty(row)}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{safeNumber(row.reorderLevel)}</td>
                            <td className="px-5 py-3.5"><Badge variant={st.variant}>{st.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          {!isDemo ? (
            <Card><EmptyState icon={ArrowLeftRight} title="Movement history not available" description={WAREHOUSE_MOVEMENTS_NOTE} /></Card>
          ) : movements.length === 0 ? (
            <Card><p className="py-8 text-center text-sm text-neutral-500">No movements recorded for this warehouse.</p></Card>
          ) : (
            <Card title="Movements" className="p-0" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Quantity</th>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">From / To</th>
                      <th className="px-5 py-3">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 text-neutral-600">{formatDate(movement.date)}</td>
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{movement.productName}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{movementTypeLabel(movement.type)}</td>
                        <td className={`px-5 py-3.5 text-right font-medium ${movement.quantity < 0 ? 'text-red-600' : 'text-neutral-900'}`}>{movement.quantity}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{movement.reference || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{movement.fromTo || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-500">{movement.performedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="mt-4 space-y-4">
          {!isDemo ? (
            <Card><EmptyState icon={ArrowLeftRight} title="Transfers not available" description={WAREHOUSE_TRANSFERS_NOTE} /></Card>
          ) : (
            <Card
              title="Warehouse Transfers"
              subtitle="Warehouse → warehouse stock moves (separate from vehicle loading)."
              className="p-0"
              bodyClassName="p-0"
              actions={
                <Button type="button" size="sm" disabled={warehouse.isActive === false} title={warehouse.isActive === false ? 'Inactive warehouses cannot start a transfer.' : undefined} onClick={() => setTransferOpen(true)}>
                  <ArrowLeftRight className="size-4" aria-hidden="true" />
                  Create Transfer
                </Button>
              }
            >
              {transfers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-500">No transfers involving this warehouse yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-4xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-5 py-3">Transfer #</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">From</th>
                        <th className="px-5 py-3">To</th>
                        <th className="px-5 py-3">Products</th>
                        <th className="px-5 py-3 text-right">Quantity</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {transfers.map((transfer) => {
                        const st = transferStatusMeta(transfer.status)
                        const qty = (transfer.items || []).reduce((sum, item) => sum + safeNumber(item.quantity), 0)
                        return (
                          <tr key={transfer.id} className="hover:bg-primary-50/35">
                            <td className="px-5 py-3.5 font-medium text-primary-700">{transfer.transferNumber}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{formatDate(transfer.date)}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{transfer.fromWarehouseName}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{transfer.toWarehouseName}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{(transfer.items || []).length}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-700">{qty}</td>
                            <td className="px-5 py-3.5"><Badge variant={st.variant}>{st.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Modal isOpen={editOpen} onClose={() => !isSaving && setEditOpen(false)} title="Edit Warehouse" size="2xl">
        <WarehouseForm warehouse={warehouse} demoMode={isDemo} saving={isSaving} formError={editError} onClose={() => setEditOpen(false)} onSave={handleEditSave} />
      </Modal>

      {isDemo && (
        <CreateTransferDrawer
          isOpen={transferOpen}
          fromWarehouse={warehouse}
          stock={stock}
          onClose={() => setTransferOpen(false)}
          onCreated={() => {
            setTransferOpen(false)
            setRefresh((value) => value + 1)
          }}
        />
      )}
    </div>
  )
}

function CreateTransferDrawer({ isOpen, fromWarehouse, stock, onClose, onCreated }) {
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [quantities, setQuantities] = useState({})
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setToWarehouseId('')
      setTransferDate(new Date().toISOString().slice(0, 10))
      setQuantities({})
      setError('')
    }
  }, [isOpen])

  const destinationOptions = useMemo(() => {
    const others = getDemoWarehouses().filter((w) => w.id !== fromWarehouse.id && w.isActive !== false)
    return [{ value: '', label: 'Select destination' }, ...others.map((w) => ({ value: w.id, label: w.name }))]
  }, [fromWarehouse.id])

  const transferItems = stock
    .filter((row) => availableQty(row) > 0)
    .map((row) => ({ productId: row.productId, productName: row.productName, available: availableQty(row), quantity: safeNumber(quantities[row.productId]) }))

  if (!isOpen) return null

  const toWarehouse = getDemoWarehouses().find((w) => w.id === toWarehouseId) || null

  const handleCreate = () => {
    setError('')
    const validationError = validateTransfer({ fromWarehouse, toWarehouse, transferDate, items: transferItems })
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSaving(true)
    createDemoTransfer({
      fromWarehouseId: fromWarehouse.id,
      fromWarehouseName: fromWarehouse.name,
      toWarehouseId: toWarehouse.id,
      toWarehouseName: toWarehouse.name,
      date: transferDate,
      items: transferItems.filter((item) => item.quantity > 0),
    })
    setIsSaving(false)
    onCreated()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-(--shadow-popover)">
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Create Transfer</h2>
            <p className="mt-0.5 text-sm text-neutral-500">From {fromWarehouse.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <Input label="From Warehouse" value={fromWarehouse.name} disabled />
          <Select label="To Warehouse" required options={destinationOptions} value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)} />
          <Input label="Transfer Date" type="date" required value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Items</p>
            {transferItems.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">Nothing with available stock to transfer.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Available</th>
                      <th className="px-3 py-2 text-right">Transfer Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {transferItems.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-3 py-2 font-medium text-neutral-900">{item.productName}</td>
                        <td className="px-3 py-2 text-right text-neutral-600">{item.available}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.available}
                            step="1"
                            value={quantities[item.productId] ?? ''}
                            onChange={(event) => setQuantities((current) => ({ ...current, [item.productId]: event.target.value }))}
                            className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="secondary" className="flex-1" disabled={isSaving} onClick={onClose}>Cancel</Button>
          <Button type="button" className="flex-1" loading={isSaving} onClick={handleCreate}>Create Transfer</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
