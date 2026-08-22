import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, IndianRupee, PackageCheck, RotateCcw, Trash2, Undo2 } from 'lucide-react'
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
  approveSalesReturn,
  deleteSalesReturn,
  getSalesReturn,
  receiveSalesReturn,
  rejectSalesReturn,
} from '../../api/salesReturns'
import { listWarehouses } from '../../api/warehouses'

const basePath = '/admin/sales-returns'

const statusVariant = {
  requested: 'info',
  received: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const conditionOptions = [
  { value: 'saleable', label: 'Saleable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function SalesReturnDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [salesReturn, setSalesReturn] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [warehouses, setWarehouses] = useState([])

  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveItems, setReceiveItems] = useState({})
  const [receiveNotes, setReceiveNotes] = useState('')
  const [isReceiving, setIsReceiving] = useState(false)
  const [receiveError, setReceiveError] = useState('')

  const [approveOpen, setApproveOpen] = useState(false)
  const [approveItems, setApproveItems] = useState({})
  const [approveWarehouseId, setApproveWarehouseId] = useState('')
  const [approveCreditNote, setApproveCreditNote] = useState(true)
  const [approveNotes, setApproveNotes] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState('')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadSalesReturn = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getSalesReturn(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setSalesReturn(result.salesReturn)
    setIsLoading(false)
  }

  useEffect(() => {
    loadSalesReturn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading sales return..." />
      </Card>
    )
  }

  if (loadError || !salesReturn) {
    return (
      <Card>
        <EmptyState
          icon={Undo2}
          title="Sales return not found"
          description={loadError || 'This sales return may have been removed or the link is out of date.'}
          action={{ label: 'Back to Sales Returns', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const openReceiveModal = () => {
    setReceiveError('')
    setReceiveNotes('')
    const initial = {}
    salesReturn.items.forEach((item) => {
      initial[item.id] = {
        receivedQuantity: item.quantityReturned,
        condition: 'saleable',
        restock: true,
      }
    })
    setReceiveItems(initial)
    setReceiveOpen(true)
  }

  const updateReceiveItem = (itemId, field, value) => {
    setReceiveItems((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }))
  }

  const handleReceive = async () => {
    const hasFractionalQuantity = Object.values(receiveItems).some(
      (values) => !Number.isInteger(Number(values.receivedQuantity)),
    )
    if (hasFractionalQuantity) {
      setReceiveError('Received quantity must be a whole number.')
      return
    }

    setIsReceiving(true)
    setReceiveError('')

    const result = await receiveSalesReturn(salesReturn.id, {
      items: Object.entries(receiveItems).map(([returnItemId, values]) => ({
        returnItemId,
        receivedQuantity: values.receivedQuantity,
        condition: values.condition,
        restock: values.restock,
      })),
      notes: receiveNotes.trim() || undefined,
    })

    if (!result.success) {
      setReceiveError(result.error)
      setIsReceiving(false)
      return
    }

    setSalesReturn(result.salesReturn)
    setIsReceiving(false)
    setReceiveOpen(false)
  }

  const openApproveModal = async () => {
    setApproveError('')
    setApproveNotes('')
    setApproveCreditNote(true)
    const initial = {}
    salesReturn.items.forEach((item) => {
      initial[item.id] = {
        condition: item.condition || 'saleable',
        restock: true,
      }
    })
    setApproveItems(initial)
    setApproveWarehouseId(salesReturn.warehouseId || '')
    setApproveOpen(true)

    const result = await listWarehouses()
    if (result.success) {
      setWarehouses(result.warehouses)
      if (!salesReturn.warehouseId) {
        const defaultWarehouse = result.warehouses.find((warehouse) => warehouse.isDefault)
        setApproveWarehouseId(defaultWarehouse?.id || result.warehouses[0]?.id || '')
      }
    }
  }

  const updateApproveItem = (itemId, field, value) => {
    setApproveItems((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }))
  }

  const handleApprove = async () => {
    setIsApproving(true)
    setApproveError('')

    const result = await approveSalesReturn(salesReturn.id, {
      items: Object.entries(approveItems).map(([returnItemId, values]) => ({
        returnItemId,
        condition: values.condition,
        restock: values.restock,
      })),
      warehouseId: approveWarehouseId || undefined,
      creditNote: approveCreditNote,
      notes: approveNotes.trim() || undefined,
    })

    if (!result.success) {
      setApproveError(result.error)
      setIsApproving(false)
      return
    }

    setSalesReturn(result.salesReturn)
    setIsApproving(false)
    setApproveOpen(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('A reason is required to reject a return.')
      return
    }

    setIsRejecting(true)
    setRejectError('')

    const result = await rejectSalesReturn(salesReturn.id, rejectReason.trim())

    if (!result.success) {
      setRejectError(result.error)
      setIsRejecting(false)
      return
    }

    setSalesReturn(result.salesReturn)
    setIsRejecting(false)
    setRejectOpen(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteSalesReturn(salesReturn.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    navigate(basePath)
  }

  const canReceive = salesReturn.status === 'requested'
  const canApprove = salesReturn.status === 'requested' || salesReturn.status === 'received'
  const canReject = salesReturn.status === 'requested' || salesReturn.status === 'received'
  const canDelete = salesReturn.status !== 'approved'

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
              <h1 className="text-2xl font-semibold text-neutral-900">{salesReturn.returnNumber}</h1>
              <Badge variant={statusVariant[salesReturn.status] || 'neutral'}>{salesReturn.status}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">{salesReturn.customerName || 'Unlinked customer'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canReceive && (
            <Button variant="outline" size="sm" onClick={openReceiveModal}>
              <PackageCheck className="size-4" aria-hidden="true" />
              Mark Received
            </Button>
          )}
          {canApprove && (
            <Button variant="primary" size="sm" onClick={openApproveModal}>
              <Check className="size-4" aria-hidden="true" />
              Approve
            </Button>
          )}
          {canReject && (
            <Button variant="danger" size="sm" onClick={() => { setRejectError(''); setRejectReason(''); setRejectOpen(true) }}>
              <Ban className="size-4" aria-hidden="true" />
              Reject
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Credit Amount" value={formatCurrency(salesReturn.creditAmount)} />
        <StatCard icon={RotateCcw} iconVariant="info" label="Items" value={String(salesReturn.items.length)} />
        <StatCard icon={PackageCheck} iconVariant="warning" label="Received" value={formatDate(salesReturn.receivedAt)} />
        <StatCard icon={Check} iconVariant="success" label="Approved" value={formatDate(salesReturn.approvedAt)} />
      </div>

      <Card title="Return Items" subtitle="Products included in this return" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Returned Qty</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Received Qty</th>
                <th className="whitespace-nowrap px-5 py-3">Condition</th>
                <th className="whitespace-nowrap px-5 py-3">Restocked</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {salesReturn.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-primary-50/35">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-800">{item.productName || 'Item'}</p>
                    {item.sku && <p className="mt-0.5 text-xs text-neutral-400">{item.sku}</p>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantityReturned}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.receivedQuantity ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{item.condition || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{item.restock ? 'Yes' : 'No'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Return Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Return Date</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDate(salesReturn.returnDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Return Type</p>
              <p className="mt-1 text-sm text-neutral-800">{salesReturn.returnType || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Reason</p>
              <p className="mt-1 text-sm text-neutral-800">{salesReturn.returnReason || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Received At</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDateTime(salesReturn.receivedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Approved At</p>
              <p className="mt-1 text-sm text-neutral-800">{formatDateTime(salesReturn.approvedAt)}</p>
            </div>
            {salesReturn.status === 'rejected' && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Rejection Reason</p>
                <p className="mt-1 text-sm text-neutral-800">{salesReturn.rejectedReason || '—'}</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Invoice & Credit Note">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Invoice</p>
              <p className="mt-1 text-sm text-neutral-800">{salesReturn.invoiceNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Customer</p>
              <p className="mt-1 text-sm text-neutral-800">{salesReturn.customerName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Credit Note</p>
              <p className="mt-1 text-sm text-neutral-800">{salesReturn.creditNoteId || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Credit Amount</p>
              <p className="mt-1 text-sm text-neutral-800">{formatCurrency(salesReturn.creditAmount)}</p>
            </div>
          </div>
        </Card>
      </div>

      {salesReturn.notes && (
        <Card title="Notes" subtitle="Internal remarks">
          <p className="text-sm leading-6 text-neutral-700">{salesReturn.notes}</p>
        </Card>
      )}

      <Modal isOpen={receiveOpen} onClose={() => !isReceiving && setReceiveOpen(false)} title="Mark Return as Received" className="max-w-2xl">
        <div className="space-y-4">
          {receiveError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{receiveError}</div>
          )}
          <div className="space-y-3">
            {salesReturn.items.map((item) => {
              const values = receiveItems[item.id] || { receivedQuantity: item.quantityReturned, condition: 'saleable', restock: true }

              return (
                <div key={item.id} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <p className="text-sm font-medium text-neutral-800">{item.productName || 'Item'}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Received Qty"
                      type="number"
                      min="0"
                      max={item.quantityReturned}
                      step="1"
                      value={values.receivedQuantity}
                      onChange={(event) => updateReceiveItem(item.id, 'receivedQuantity', event.target.value)}
                    />
                    <Select
                      label="Condition"
                      options={conditionOptions}
                      value={values.condition}
                      onChange={(event) => updateReceiveItem(item.id, 'condition', event.target.value)}
                    />
                    <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={values.restock}
                        onChange={(event) => updateReceiveItem(item.id, 'restock', event.target.checked)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      Restock on approval
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
          <Input
            as="textarea"
            label="Notes"
            value={receiveNotes}
            onChange={(event) => setReceiveNotes(event.target.value)}
            placeholder="Optional remarks about the goods received"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isReceiving} onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="button" loading={isReceiving} onClick={handleReceive}>Mark Received</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={approveOpen} onClose={() => !isApproving && setApproveOpen(false)} title="Approve Sales Return" className="max-w-2xl">
        <div className="space-y-4">
          {approveError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{approveError}</div>
          )}
          <p className="text-sm leading-6 text-neutral-600">
            Only lines marked saleable and restock will re-enter stock. The customer will be credited for everything received unless credit note is disabled.
          </p>
          <div className="space-y-3">
            {salesReturn.items.map((item) => {
              const values = approveItems[item.id] || { condition: 'saleable', restock: true }

              return (
                <div key={item.id} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <p className="text-sm font-medium text-neutral-800">{item.productName || 'Item'}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                      label="Condition"
                      options={conditionOptions}
                      value={values.condition}
                      onChange={(event) => updateApproveItem(item.id, 'condition', event.target.value)}
                    />
                    <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={values.restock}
                        onChange={(event) => updateApproveItem(item.id, 'restock', event.target.checked)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      Restock this line
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
          <Select
            label="Warehouse"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
            value={approveWarehouseId}
            onChange={(event) => setApproveWarehouseId(event.target.value)}
            placeholder="Use firm default warehouse"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={approveCreditNote}
              onChange={(event) => setApproveCreditNote(event.target.checked)}
              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Raise a credit note for the customer
          </label>
          <Input
            as="textarea"
            label="Notes"
            value={approveNotes}
            onChange={(event) => setApproveNotes(event.target.value)}
            placeholder="Optional approval remarks"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isApproving} onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button type="button" loading={isApproving} onClick={handleApprove}>Approve Return</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={rejectOpen} onClose={() => !isRejecting && setRejectOpen(false)} title="Reject Sales Return">
        <div className="space-y-4">
          {rejectError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{rejectError}</div>
          )}
          <Input
            as="textarea"
            label="Rejection Reason"
            required
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain why this return is being rejected"
            maxLength={500}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isRejecting} onClick={handleReject}>Reject</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)} title="Delete Sales Return">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {salesReturn.returnNumber}? This cannot be undone.</p>
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
