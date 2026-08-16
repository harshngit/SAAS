import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, Download, FileText, IndianRupee, Printer, Send, ShoppingCart, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import {
  convertQuotationToOrder,
  deleteQuotation,
  downloadQuotationPdf,
  getQuotation,
  updateQuotationStatus,
} from '../../api/quotations'
import { listWarehouses } from '../../api/warehouses'

const statusVariant = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'danger',
  converted: 'purple',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/quotations' : '/admin/quotations'
  const ordersBasePath = window.location.pathname.startsWith('/sales') ? '/sales/orders' : '/admin/orders'

  const [quotation, setQuotation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [convertOpen, setConvertOpen] = useState(false)
  const [warehouses, setWarehouses] = useState([])
  const [convertForm, setConvertForm] = useState({ warehouseId: '', deliveryDate: '', fulfilmentMethod: 'delivery' })
  const [isConverting, setIsConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  const loadQuotation = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getQuotation(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setQuotation(result.quotation)
    setIsLoading(false)
  }

  useEffect(() => {
    loadQuotation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading quotation..." />
      </Card>
    )
  }

  if (loadError || !quotation) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Quotation not found"
          description={loadError || 'This quotation may have been removed or the link is out of date.'}
          action={{ label: 'Back to Quotations', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const updateStatus = async (nextStatus) => {
    setIsUpdatingStatus(true)
    setActionError('')

    const result = await updateQuotationStatus(quotation.id, nextStatus)

    if (!result.success) {
      setActionError(result.error)
      setIsUpdatingStatus(false)
      return
    }

    setQuotation(result.quotation)
    setIsUpdatingStatus(false)
  }

  const handlePrint = async () => {
    setIsDownloading(true)
    setActionError('')

    const result = await downloadQuotationPdf(quotation.id, quotation.quotationNumber)

    if (!result.success) setActionError(result.error)
    setIsDownloading(false)
  }

  const openConvertModal = async () => {
    setConvertError('')
    setConvertOpen(true)

    const result = await listWarehouses()
    if (result.success) {
      setWarehouses(result.warehouses)
      const defaultWarehouse = result.warehouses.find((warehouse) => warehouse.isDefault)
      setConvertForm((current) => ({ ...current, warehouseId: defaultWarehouse?.id || result.warehouses[0]?.id || '' }))
    }
  }

  const handleConvert = async () => {
    setIsConverting(true)
    setConvertError('')

    const result = await convertQuotationToOrder(quotation.id, convertForm)

    if (!result.success) {
      setConvertError(result.error)
      setIsConverting(false)
      return
    }

    setIsConverting(false)
    setConvertOpen(false)
    const orderId = result.conversion?.order?.id
    navigate(orderId ? `${ordersBasePath}/${orderId}` : ordersBasePath)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteQuotation(quotation.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    navigate(basePath)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{quotation.quotationNumber}</h1>
              <Badge variant={statusVariant[quotation.status] || 'neutral'}>{quotation.status}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">{quotation.customerName || 'Unlinked customer'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" loading={isDownloading} onClick={handlePrint}>
            {isDownloading ? <Printer className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            Download PDF
          </Button>
          {quotation.status === 'draft' && (
            <Button variant="primary" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('sent')}>
              <Send className="size-4" aria-hidden="true" />
              Mark as Sent
            </Button>
          )}
          {quotation.status === 'sent' && (
            <>
              <Button variant="danger" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('rejected')}>
                <Ban className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button variant="primary" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('accepted')}>
                <Check className="size-4" aria-hidden="true" />
                Mark as Accepted
              </Button>
            </>
          )}
          {quotation.status === 'accepted' && (
            <Button variant="primary" size="sm" onClick={openConvertModal}>
              <ShoppingCart className="size-4" aria-hidden="true" />
              Convert to Order
            </Button>
          )}
          {quotation.status !== 'converted' && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="neutral" label="Subtotal" value={formatCurrency(quotation.subtotal)} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Tax" value={formatCurrency(quotation.taxTotal)} />
        <StatCard icon={IndianRupee} iconVariant="primary" label="Total" value={formatCurrency(quotation.total)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Items" value={String(quotation.itemCount)} />
      </div>

      <Card title="Quotation Items" subtitle="Products included in this estimate" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-5 py-3">UOM</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Discount</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Tax</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {quotation.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-primary-50/35">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-800">{item.productName}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantity}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{item.uom || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.discount ? `${item.discount}%` : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.taxRate ? `${item.taxRate}%` : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Customer & Delivery">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Customer</p>
              <p className="mt-1 text-sm font-medium text-neutral-800">{quotation.customerName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Billing Address</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.billingAddress || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Shipping Address</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.shippingAddress || '—'}</p>
            </div>
          </div>
        </Card>

        <Card title="Quotation Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Quotation Date</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDate(quotation.quotationDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Valid Until</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDate(quotation.validUntil)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Salesperson</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.salespersonName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Currency</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.currency || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment Terms</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.paymentTerms || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Delivery Terms</p>
              <p className="mt-1 text-sm text-neutral-800">{quotation.deliveryTerms || '—'}</p>
            </div>
          </div>
        </Card>
      </div>

      {(quotation.notes || quotation.termsConditions) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {quotation.notes && (
            <Card title="Notes" subtitle="Internal remarks, not printed on the quotation">
              <p className="text-sm leading-6 text-neutral-700">{quotation.notes}</p>
            </Card>
          )}
          {quotation.termsConditions && (
            <Card title="Terms & Conditions" subtitle="Printed on the quotation">
              <p className="text-sm leading-6 text-neutral-700">{quotation.termsConditions}</p>
            </Card>
          )}
        </div>
      )}

      <Modal isOpen={convertOpen} onClose={() => !isConverting && setConvertOpen(false)} title="Convert to Sales Order">
        <div className="space-y-4">
          {convertError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{convertError}</div>
          )}
          <Select
            label="Warehouse"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
            value={convertForm.warehouseId}
            onChange={(event) => setConvertForm((current) => ({ ...current, warehouseId: event.target.value }))}
            placeholder="Use firm default warehouse"
          />
          <Input
            label="Delivery Date"
            type="date"
            value={convertForm.deliveryDate}
            onChange={(event) => setConvertForm((current) => ({ ...current, deliveryDate: event.target.value }))}
          />
          <Select
            label="Fulfilment Method"
            options={[{ value: 'delivery', label: 'Delivery' }, { value: 'pickup', label: 'Customer Pickup' }]}
            value={convertForm.fulfilmentMethod}
            onChange={(event) => setConvertForm((current) => ({ ...current, fulfilmentMethod: event.target.value }))}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isConverting} onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button type="button" loading={isConverting} onClick={handleConvert}>Convert</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)} title="Delete Quotation">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {quotation.quotationNumber}? This cannot be undone.</p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
