import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, FileText, IndianRupee, Power, ShoppingBag, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { purchaseInvoices } from '../../mockData/purchaseInvoices'
import { suppliers as seedSuppliers } from '../../mockData/suppliers'
import { formatCurrency } from '../../utils/format'
import SupplierForm from './SupplierForm'

export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const initialSupplier = useMemo(() => seedSuppliers.find((item) => item.id === id), [id])
  const [supplier, setSupplier] = useState(initialSupplier)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  const invoices = useMemo(
    () => (supplier ? purchaseInvoices.filter((invoice) => invoice.supplier === supplier.name) : []),
    [supplier],
  )

  if (!supplier) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingBag}
          title="Supplier not found"
          description="This supplier may have been deleted or the link is out of date."
          action={{ label: 'Back to Suppliers', onClick: () => navigate('/admin/suppliers') }}
        />
      </Card>
    )
  }

  const handleSaveSupplier = (supplierData) => {
    setSupplier((current) => ({ ...current, ...supplierData }))
    setIsFormOpen(false)
  }

  const handleToggleStatus = () => {
    setSupplier((current) => ({ ...current, status: current.status === 'active' ? 'inactive' : 'active' }))
    setIsStatusModalOpen(false)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      navigate('/admin/suppliers')
    }
  }

  if (isFormOpen) {
    return (
      <SupplierForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        supplier={supplier}
        onSave={handleSaveSupplier}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/suppliers')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{supplier.name}</h1>
              <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                {supplier.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="primary">{supplier.category}</Badge>
              <span className="text-xs text-neutral-400">{supplier.city}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
            <Edit className="size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(true)}>
            <Power className="size-4" aria-hidden="true" />
            {supplier.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={IndianRupee} iconVariant="success" label="Total Purchases" value={formatCurrency(supplier.totalPurchases)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(supplier.outstandingPayable)} />
        <StatCard icon={FileText} iconVariant="primary" label="Purchase Invoices" value={invoices.length} />
      </div>

      <Card title="Contact Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Contact Person</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.contactPerson || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Email</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">GST Number</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.gstNumber || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Address</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.address || '—'}</p>
          </div>
        </div>
      </Card>

      <Card title="Purchase History" subtitle="Every invoice recorded against this supplier" className="p-0" bodyClassName="p-0">
        {invoices.length === 0 ? (
          <div className="p-5">
            <p className="py-8 text-center text-sm text-neutral-500">No purchase invoices recorded for this supplier yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Invoice #</th>
                  <th className="whitespace-nowrap px-5 py-3">Date</th>
                  <th className="whitespace-nowrap px-5 py-3">Items</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{invoice.invoiceNumber}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{invoice.date}</td>
                    <td className="px-5 py-3.5 text-neutral-500">{invoice.items.length} items</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                      {formatCurrency(invoice.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`${supplier.status === 'active' ? 'Deactivate' : 'Activate'} Supplier`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {supplier.status === 'active'
              ? 'This supplier will be moved to inactive status. Existing purchase history remains unchanged.'
              : 'This supplier will be marked active and available for new purchases again.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={supplier.status === 'active' ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
            >
              {supplier.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
