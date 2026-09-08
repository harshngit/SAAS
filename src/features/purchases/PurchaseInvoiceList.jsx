import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Edit, Eye, IndianRupee, PackageSearch, Plus, RotateCw, Search, Trash2 } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { DEMO_MODE } from '../../config/demoMode'
import { deletePurchase, listPurchases } from '../../api/purchases'
import { deriveReceivingStatus, derivePaymentStatus, derivePurchaseOutstanding, derivePurchaseStatus, getPurchaseActions } from './purchaseHelpers'
import { DEMO_PURCHASES_ENABLED, demoPurchasesResolved, isDemoPurchase } from './purchaseDemoData'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const purchaseStatusFilterOptions = [
  { value: 'all', label: 'All Purchase Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]
const receivingStatusFilterOptions = [
  { value: 'all', label: 'All Receiving Statuses' },
  { value: 'not_received', label: 'Not Received' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'fully_received', label: 'Fully Received' },
]
const paymentStatusFilterOptions = [
  { value: 'all', label: 'All Payment Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
]
const sortOptions = [
  { value: 'recent', label: 'Recent' },
  { value: 'oldest', label: 'Oldest' },
]

export default function PurchaseInvoiceList() {
  const navigate = useNavigate()
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/purchases' : '/admin/purchases'

  const [purchases, setPurchases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState('all')
  const [receivingStatusFilter, setReceivingStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('recent')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadPurchases = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    // Explicit demo split: demo mode (true OR empty) never calls the real API and never
    // appends demo rows to real results; empty demo mode is an intentional empty state.
    if (DEMO_MODE) {
      setPurchases(DEMO_PURCHASES_ENABLED ? demoPurchasesResolved() : [])
      setIsLoading(false)
      return
    }

    const result = await listPurchases({})
    if (!result.success) {
      setPurchases([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setPurchases(result.purchases)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  const supplierOptions = useMemo(() => {
    const names = [...new Set(purchases.map((purchase) => purchase.supplierName).filter(Boolean))]
    return [{ value: 'all', label: 'All Suppliers' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [purchases])

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = purchases.filter((purchase) => {
      const matchesSearch =
        !query ||
        [purchase.invoiceNumber, purchase.purchaseNumber, purchase.supplierName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesSupplier = supplierFilter === 'all' || purchase.supplierName === supplierFilter
      const matchesPurchaseStatus = purchaseStatusFilter === 'all' || derivePurchaseStatus(purchase).key === purchaseStatusFilter
      const matchesReceiving = receivingStatusFilter === 'all' || deriveReceivingStatus(purchase).key === receivingStatusFilter
      const matchesPayment = paymentStatusFilter === 'all' || derivePaymentStatus(purchase).key === paymentStatusFilter
      return matchesSearch && matchesSupplier && matchesPurchaseStatus && matchesReceiving && matchesPayment
    })

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.purchaseDate || left.invoiceDate || left.createdAt || 0).getTime()
      const rightTime = new Date(right.purchaseDate || right.invoiceDate || right.createdAt || 0).getTime()
      return sortFilter === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [purchases, search, supplierFilter, purchaseStatusFilter, receivingStatusFilter, paymentStatusFilter, sortFilter])

  const stats = useMemo(() => {
    const totalValue = purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0)
    const outstanding = purchases.reduce((sum, purchase) => sum + derivePurchaseOutstanding(purchase), 0)
    const pendingReceipts = purchases.filter((purchase) => {
      const status = derivePurchaseStatus(purchase).key
      const receiving = deriveReceivingStatus(purchase).key
      return (status === 'confirmed' || status === 'closed') && receiving !== 'fully_received'
    }).length
    return { total: purchases.length, totalValue, outstanding, pendingReceipts }
  }, [purchases])

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError('')

    if (isDemoPurchase(deleteTarget.id)) {
      setPurchases((current) => current.filter((purchase) => purchase.id !== deleteTarget.id))
      setIsDeleting(false)
      setDeleteTarget(null)
      return
    }

    const result = await deletePurchase(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setIsDeleting(false)
    setDeleteTarget(null)
    loadPurchases()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Purchases</h1>
          <p className="mt-1 text-sm text-neutral-500">Track what you buy from suppliers, end to end.</p>
        </div>
        <Button type="button" onClick={() => navigate(`${basePath}/create`)}>
          <Plus className="size-4" aria-hidden="true" />
          Create Purchase
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} iconVariant="primary" label="Total Purchases" value={stats.total} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Total Purchase Value" value={formatCurrency(stats.totalValue)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(stats.outstanding)} />
        <StatCard icon={PackageSearch} iconVariant="success" label="Pending Receipts" value={stats.pendingReceipts} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Purchase # / Supplier / Reference"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <Select options={supplierOptions} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="w-44" triggerClassName="bg-white" />
          <Select options={purchaseStatusFilterOptions} value={purchaseStatusFilter} onChange={(event) => setPurchaseStatusFilter(event.target.value)} className="w-48" triggerClassName="bg-white" />
          <Select options={receivingStatusFilterOptions} value={receivingStatusFilter} onChange={(event) => setReceivingStatusFilter(event.target.value)} className="w-52" triggerClassName="bg-white" />
          <Select options={paymentStatusFilterOptions} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="w-48" triggerClassName="bg-white" />
          <Select options={sortOptions} value={sortFilter} onChange={(event) => setSortFilter(event.target.value)} className="w-32" triggerClassName="bg-white" />
        </div>

        <div className="overflow-x-auto">
          {listError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadPurchases}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-10">
              <LoadingSpinner label="Loading purchases..." />
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No purchases yet</p>
              <p className="mt-1 text-sm text-neutral-500">Create your first purchase to start tracking supplier buying.</p>
              <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/create`)}>
                <Plus className="size-4" aria-hidden="true" />
                Create Purchase
              </Button>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No purchases match the selected filters.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {filteredPurchases.map((purchase) => {
                  const purchaseStatus = derivePurchaseStatus(purchase)
                  const receiving = deriveReceivingStatus(purchase)
                  const payment = derivePaymentStatus(purchase)
                  return (
                    <div
                      key={purchase.id}
                      className="rounded-xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)"
                      onClick={() => navigate(`${basePath}/${purchase.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary-700">
                            {purchase.invoiceNumber}
                            {isDemoPurchase(purchase.id) && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-neutral-500">{purchase.supplierName || '—'}</p>
                        </div>
                        <Badge variant={purchaseStatus.variant}>{purchaseStatus.label}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-neutral-400">Grand Total</p><p className="font-medium text-neutral-800">{formatCurrency(purchase.total)}</p></div>
                        <div><p className="text-xs text-neutral-400">Date</p><p className="text-neutral-700">{formatDate(purchase.purchaseDate || purchase.invoiceDate)}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge variant={receiving.variant}>{receiving.label}</Badge>
                        <Badge variant={payment.variant}>{payment.label}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <table className="hidden w-full min-w-6xl text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80">
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Purchase #</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Supplier</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Purchase Date</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Warehouse</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Grand Total</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Receiving Status</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Payment Status</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Purchase Status</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredPurchases.map((purchase) => {
                    const purchaseStatus = derivePurchaseStatus(purchase)
                    const receiving = deriveReceivingStatus(purchase)
                    const payment = derivePaymentStatus(purchase)
                    const actions = getPurchaseActions(purchase)
                    return (
                      <tr key={purchase.id} className="cursor-pointer transition-colors hover:bg-primary-50/30" onClick={() => navigate(`${basePath}/${purchase.id}`)}>
                        <td className="whitespace-nowrap px-4 py-3.5 font-medium text-primary-700">
                          {purchase.invoiceNumber}
                          {isDemoPurchase(purchase.id) && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{purchase.supplierName || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(purchase.purchaseDate || purchase.invoiceDate)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{purchase.warehouseName || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(purchase.total)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={receiving.variant}>{receiving.label}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={payment.variant} dot>{payment.label}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3.5"><Badge variant={purchaseStatus.variant}>{purchaseStatus.label}</Badge></td>
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                          <ActionMenu
                            items={[
                              { label: 'View', icon: Eye, onClick: () => navigate(`${basePath}/${purchase.id}`) },
                              ...(actions.includes('edit') ? [{ label: 'Edit', icon: Edit, onClick: () => navigate(`${basePath}/${purchase.id}/edit`) }] : []),
                              ...(actions.includes('delete') ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(purchase) }] : []),
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

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Purchase"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete purchase {deleteTarget?.invoiceNumber || 'this purchase'}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
