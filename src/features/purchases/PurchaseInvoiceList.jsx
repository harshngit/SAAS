import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileText, IndianRupee, Pencil, Plus, RotateCw, Search, ShoppingBag, Trash2 } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { deletePurchase, listPurchases, PURCHASE_PAYMENT_STATUS_OPTIONS, PURCHASE_STATUS_OPTIONS } from '../../api/purchases'
import PurchaseInvoiceForm from './PurchaseInvoiceForm'
import PurchaseInvoiceDetail from './PurchaseInvoiceDetail'

const statusVariant = { pending: 'warning', approved: 'success', cancelled: 'danger' }
const paymentStatusVariant = { unpaid: 'danger', partial: 'warning', paid: 'success' }

const statusFilterOptions = [{ value: 'all', label: 'All Statuses' }, ...PURCHASE_STATUS_OPTIONS]
const paymentStatusFilterOptions = [{ value: 'all', label: 'All Payment Statuses' }, ...PURCHASE_PAYMENT_STATUS_OPTIONS]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)

  const [detailId, setDetailId] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listPurchases({
      status: statusFilter === 'all' ? undefined : statusFilter,
      payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
      search: search.trim() || undefined,
    })

    if (!result.success) {
      setInvoices([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setInvoices(result.purchases)
    setIsLoading(false)
  }, [statusFilter, paymentStatusFilter, search])

  useEffect(() => {
    const timeout = setTimeout(loadInvoices, search ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [loadInvoices, search])

  const stats = useMemo(() => {
    const totalPayable = invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
    const totalValue = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const pendingCount = invoices.filter((invoice) => invoice.status === 'pending').length

    return { totalInvoices: invoices.length, totalPayable, totalValue, pendingCount }
  }, [invoices])

  const openAddForm = () => {
    setEditingInvoice(null)
    setIsFormOpen(true)
  }

  const openEditForm = (invoice) => {
    setEditingInvoice(invoice)
    setIsFormOpen(true)
    setDetailId(null)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingInvoice(null)
  }

  const handleSaved = () => {
    loadInvoices()
  }

  const handleDetailChanged = () => {
    loadInvoices()
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deletePurchase(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setIsDeleting(false)
    setDeleteTarget(null)
    loadInvoices()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Purchase Invoices</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage invoices raised by your suppliers</p>
        </div>
        <Button type="button" onClick={openAddForm}>
          <Plus className="size-4" aria-hidden="true" />
          Add Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} iconVariant="primary" label="Total Invoices" value={stats.totalInvoices} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Total Value" value={formatCurrency(stats.totalValue)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Payable" value={formatCurrency(stats.totalPayable)} />
        <StatCard icon={ShoppingBag} iconVariant="success" label="Pending Approval" value={stats.pendingCount} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice number..."
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <Select options={statusFilterOptions} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-48" triggerClassName="bg-white" />
          <Select options={paymentStatusFilterOptions} value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="w-56" triggerClassName="bg-white" />
        </div>

        <div className="overflow-x-auto">
          {listError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadInvoices}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-10">
              <LoadingSpinner label="Loading purchase invoices..." />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No purchase invoices yet</p>
              <p className="mt-1 text-sm text-neutral-500">Add your first supplier invoice to get started.</p>
              <Button type="button" className="mt-4" onClick={openAddForm}>
                <Plus className="size-4" aria-hidden="true" />
                Add Invoice
              </Button>
            </div>
          ) : (
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80">
                  <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Invoice #</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Total</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Due</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Payment</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-primary-50/30">
                    <td className="cursor-pointer whitespace-nowrap px-4 py-3.5 font-medium text-primary-700" onClick={() => setDetailId(invoice.id)}>
                      {invoice.invoiceNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-800">{invoice.supplierName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-neutral-500">{formatDate(invoice.invoiceDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(invoice.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-neutral-600">{formatCurrency(invoice.outstandingAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Badge variant={paymentStatusVariant[invoice.paymentStatus] || 'neutral'} dot>{invoice.paymentStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Badge variant={statusVariant[invoice.status] || 'neutral'}>{invoice.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'View', icon: Eye, onClick: () => setDetailId(invoice.id) },
                          ...(invoice.status === 'pending'
                            ? [{ label: 'Edit', icon: Pencil, onClick: () => openEditForm(invoice) }]
                            : []),
                          ...(invoice.status === 'pending'
                            ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(invoice) }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <PurchaseInvoiceForm isOpen={isFormOpen} onClose={closeForm} invoice={editingInvoice} onSaved={handleSaved} />

      <PurchaseInvoiceDetail
        purchaseId={detailId}
        isOpen={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onChanged={handleDetailChanged}
        onEdit={(invoice) => openEditForm(invoice)}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Invoice"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete invoice {deleteTarget?.invoiceNumber || 'this invoice'}? This cannot be undone.
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
