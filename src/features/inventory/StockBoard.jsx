import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, Edit, Package, Plus, Power, Search, Trash2, XCircle } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { stockItems as initialStockItems } from '../../mockData/stockItems'
import StockEntryForm from './StockEntryForm'

const stockStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
]

const getStockStatus = (item) => {
  if (item.currentStock <= 0) return 'out'
  if (item.currentStock < item.minStock) return 'low'
  return 'in'
}

export default function StockBoard() {
  const navigate = useNavigate()
  const [stock, setStock] = useState(initialStockItems)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [statusItem, setStatusItem] = useState(null)

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...[...new Set(stock.map((item) => item.category))].map((category) => ({ value: category, label: category })),
    ],
    [stock],
  )

  const stats = useMemo(
    () => ({
      totalSkus: stock.length,
      lowStock: stock.filter((item) => getStockStatus(item) === 'low').length,
      outOfStock: stock.filter((item) => getStockStatus(item) === 'out').length,
      totalUnits: stock.reduce((sum, item) => sum + item.currentStock, 0),
    }),
    [stock],
  )

  const filteredStock = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return stock.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [item.productName, item.sku, item.brand]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || getStockStatus(item) === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, searchTerm, statusFilter, stock])

  const handleSaveEntry = (entries) => {
    setStock((current) =>
      current.map((item) => {
        const entry = entries.find((candidate) => candidate.sku === item.sku)
        if (!entry) return item
        const { sku: _sku, ...rest } = entry
        const balanceAfter = item.currentStock + rest.quantity
        return {
          ...item,
          currentStock: balanceAfter,
          movements: [...item.movements, { id: item.movements.length + 1, ...rest, balanceAfter }],
        }
      }),
    )
  }

  const handleEditItem = (item) => {
    setEditingItem(item)
    setEditForm({
      productName: item.productName,
      size: item.size,
      brand: item.brand,
      category: item.category,
      unit: item.unit,
      minStock: item.minStock,
    })
  }

  const handleSaveEdit = (event) => {
    event.preventDefault()
    setStock((current) =>
      current.map((item) =>
        item.sku === editingItem.sku
          ? { ...item, ...editForm, minStock: Number(editForm.minStock) || 0 }
          : item,
      ),
    )
    setEditingItem(null)
    setEditForm(null)
  }

  const handleToggleStatus = () => {
    if (!statusItem) return

    setStock((current) =>
      current.map((item) =>
        item.sku === statusItem.sku
          ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
          : item,
      ),
    )
    setStatusItem(null)
  }

  const handleDeleteItem = (sku) => {
    if (confirm('Are you sure you want to delete this inventory item?')) {
      setStock((current) => current.filter((item) => item.sku !== sku))
    }
  }

  if (isFormOpen) {
    return (
      <StockEntryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEntry}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} iconVariant="primary" label="Tracked SKUs" value={stats.totalSkus} />
        <StatCard icon={Package} iconVariant="info" label="Total Units" value={stats.totalUnits.toLocaleString()} />
        <StatCard icon={AlertTriangle} iconVariant="warning" label="Low Stock" value={stats.lowStock} />
        <StatCard icon={XCircle} iconVariant="danger" label="Out of Stock" value={stats.outOfStock} />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-5">
              {stockStatusTabs.map((tab) => {
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
            <Button onClick={() => setIsFormOpen(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Add Stock Entry
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
                  placeholder="Search products, brands, SKU"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={categoryFilterOptions}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="sm:w-52"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {filteredStock.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No stock items match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Product</th>
                  <th className="whitespace-nowrap px-4 py-3">SKU</th>
                  <th className="whitespace-nowrap px-4 py-3">Category</th>
                  <th className="whitespace-nowrap px-4 py-3">Current Stock</th>
                  <th className="whitespace-nowrap px-4 py-3">Min Stock</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((item) => {
                  const status = getStockStatus(item)
                  const isInactive = item.status === 'inactive'

                  return (
                    <tr
                      key={item.sku}
                      onClick={() => navigate(`/admin/inventory/${item.sku}`)}
                      className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                            <Package className="size-4" aria-hidden="true" />
                          </div>
                          <div>
                            <span className="font-medium text-neutral-900">{item.productName}</span>
                            <p className="mt-0.5 text-xs text-neutral-400">{item.size}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-neutral-600">{item.sku}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{item.category}</td>
                      <td className="px-4 py-3.5">
                        <span className={status !== 'in' ? 'font-semibold text-red-600' : 'font-medium text-neutral-900'}>
                          {item.currentStock} {item.unit}
                          {item.unit === 'Bottle' ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">
                        {item.minStock} {item.unit}
                        {item.unit === 'Bottle' ? 's' : ''}
                      </td>
                      <td className="px-4 py-3.5">
                        {isInactive ? (
                          <Badge variant="neutral">Inactive</Badge>
                        ) : status === 'out' ? (
                          <Badge variant="danger" dot>Out of Stock</Badge>
                        ) : status === 'low' ? (
                          <Badge variant="warning" dot>Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'Edit Inventory', icon: Edit, onClick: () => handleEditItem(item) },
                            {
                              label: isInactive ? 'Activate' : 'Deactivate',
                              icon: Power,
                              onClick: () => setStatusItem(item),
                            },
                            {
                              label: 'Delete Inventory',
                              icon: Trash2,
                              danger: true,
                              onClick: () => handleDeleteItem(item.sku),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredStock.length === 0 ? '0' : `1 to ${filteredStock.length}`} of {stock.length}
          </span>
          <span>Stock Items</span>
        </div>
      </Card>

      <Modal isOpen={Boolean(editingItem)} onClose={() => setEditingItem(null)} title="Edit Inventory Item">
        {editForm && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Product Name"
                value={editForm.productName}
                onChange={(event) => setEditForm({ ...editForm, productName: event.target.value })}
                required
              />
              <Input
                label="Size"
                value={editForm.size}
                onChange={(event) => setEditForm({ ...editForm, size: event.target.value })}
                required
              />
              <Input
                label="Brand"
                value={editForm.brand}
                onChange={(event) => setEditForm({ ...editForm, brand: event.target.value })}
                required
              />
              <Input
                label="Category"
                value={editForm.category}
                onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                required
              />
              <Input
                label="Unit"
                value={editForm.unit}
                onChange={(event) => setEditForm({ ...editForm, unit: event.target.value })}
                required
              />
              <Input
                label="Minimum Stock"
                type="number"
                min="0"
                value={editForm.minStock}
                onChange={(event) => setEditForm({ ...editForm, minStock: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(statusItem)}
        onClose={() => setStatusItem(null)}
        title={`${statusItem?.status === 'active' ? 'Deactivate' : 'Activate'} Inventory Item`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {statusItem?.status === 'active'
              ? 'This SKU will be excluded from low-stock and out-of-stock alerts, but its history stays intact.'
              : 'This SKU will be marked active and included in stock alerts again.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setStatusItem(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusItem?.status === 'active' ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
            >
              {statusItem?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
