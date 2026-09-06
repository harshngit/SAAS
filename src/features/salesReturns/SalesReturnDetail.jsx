import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { usePermission } from '../../auth/usePermission'
import {
  approveSalesReturn,
  deleteSalesReturn,
  getSalesReturn,
  receiveSalesReturn,
  rejectSalesReturn,
} from '../../api/salesReturns'
import { listWarehouses } from '../../api/warehouses'
import {
  SALES_RETURNS_DEMO_ENABLED,
  approveDemoSalesReturn,
  deleteDemoSalesReturn,
  getDemoSalesReturn,
  isDemoSalesReturn,
  receiveDemoSalesReturn,
  rejectDemoSalesReturn,
} from './salesReturnDemoData'
import {
  buildReturnActivity,
  itemDamagedQty,
  itemRestockableQty,
  srNextActions,
  srStatusMeta,
  totalReceivedQty,
  totalReturnQty,
} from './salesReturnHelpers'

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
  const { pathname } = useLocation()
  const { can } = usePermission()
  const basePath = pathname.startsWith('/sales') ? '/sales/sales-returns' : '/admin/sales-returns'
  // Canonical `sales_returns` module actions (backend authority; `can` already grants
  // everything to a full-access admin). Reject is the flip side of the review decision, so
  // it follows the same permission as approve.
  const canEditReturn = can('sales_returns', 'edit')
  const canApproveReturn = can('sales_returns', 'approve')
  const canDeleteReturn = can('sales_returns', 'delete')

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

    if (SALES_RETURNS_DEMO_ENABLED && isDemoSalesReturn(id)) {
      const record = getDemoSalesReturn(id)
      if (!record) setLoadError('Demo sales return not found.')
      else setSalesReturn(record)
      setIsLoading(false)
      return
    }

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

  const isDemo = isDemoSalesReturn(salesReturn.id)
  const meta = srStatusMeta(salesReturn.status)
  // srNextActions gives the lifecycle-valid steps; each is then gated by its own permission.
  const nextActions = srNextActions(salesReturn.status)
  const showReceive = nextActions.includes('receive') && canEditReturn
  const showComplete = nextActions.includes('complete') && canApproveReturn
  const showReject = nextActions.includes('reject') && canApproveReturn
  const canDelete = canDeleteReturn && meta.key === 'pending'
  const activity = buildReturnActivity(salesReturn)

  const openReceiveModal = () => {
    setReceiveError('')
    setReceiveNotes('')
    const initial = {}
    salesReturn.items.forEach((item) => {
      initial[item.id] = { receivedQuantity: item.quantityReturned, condition: 'saleable', restock: true }
    })
    setReceiveItems(initial)
    setReceiveOpen(true)
  }

  const updateReceiveItem = (itemId, field, value) => {
    setReceiveItems((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }))
  }

  const handleReceive = async () => {
    const bad = salesReturn.items.some((item) => {
      const values = receiveItems[item.id] || {}
      const received = Number(values.receivedQuantity)
      return !Number.isInteger(received) || received < 0 || received > item.quantityReturned
    })
    if (bad) {
      setReceiveError('Received quantity must be a whole number from 0 up to the approved return quantity.')
      return
    }

    setIsReceiving(true)
    setReceiveError('')
    const payload = {
      items: Object.entries(receiveItems).map(([returnItemId, values]) => ({
        returnItemId,
        receivedQuantity: Number(values.receivedQuantity) || 0,
        condition: values.condition,
        restock: values.restock,
      })),
      notes: receiveNotes.trim() || undefined,
    }

    const result = isDemo
      ? { success: true, salesReturn: receiveDemoSalesReturn(salesReturn.id, payload) }
      : await receiveSalesReturn(salesReturn.id, payload)

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
        restock: item.condition ? item.restock : true,
      }
    })
    setApproveItems(initial)
    setApproveWarehouseId(salesReturn.warehouseId || '')
    setApproveOpen(true)

    if (!isDemo) {
      const result = await listWarehouses()
      if (result.success) {
        setWarehouses(result.warehouses)
        if (!salesReturn.warehouseId) {
          const def = result.warehouses.find((warehouse) => warehouse.isDefault)
          setApproveWarehouseId(def?.id || result.warehouses[0]?.id || '')
        }
      }
    }
  }

  const updateApproveItem = (itemId, field, value) => {
    setApproveItems((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }))
  }

  const handleApprove = async () => {
    setIsApproving(true)
    setApproveError('')
    const payload = {
      items: Object.entries(approveItems).map(([returnItemId, values]) => ({
        returnItemId,
        condition: values.condition,
        restock: values.restock,
      })),
      warehouseId: approveWarehouseId || undefined,
      creditNote: approveCreditNote,
      notes: approveNotes.trim() || undefined,
    }

    const result = isDemo
      ? { success: true, salesReturn: approveDemoSalesReturn(salesReturn.id, payload) }
      : await approveSalesReturn(salesReturn.id, payload)

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

    const result = isDemo
      ? { success: true, salesReturn: rejectDemoSalesReturn(salesReturn.id, rejectReason.trim()) }
      : await rejectSalesReturn(salesReturn.id, rejectReason.trim())

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
    const result = isDemo ? deleteDemoSalesReturn(salesReturn.id) : await deleteSalesReturn(salesReturn.id)
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
              <h1 className="text-2xl font-semibold text-neutral-900">{salesReturn.returnNumber}</h1>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {isDemo && <Badge variant="warning">Demo</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {salesReturn.customerName || 'Unlinked customer'}
              {salesReturn.orderNumber ? ` · Order ${salesReturn.orderNumber}` : salesReturn.invoiceNumber ? ` · ${salesReturn.invoiceNumber}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showReceive && (
            <Button variant="outline" size="sm" onClick={openReceiveModal}>
              <PackageCheck className="size-4" aria-hidden="true" />
              Receive Return
            </Button>
          )}
          {showComplete && (
            <Button variant="primary" size="sm" onClick={openApproveModal}>
              <Check className="size-4" aria-hidden="true" />
              Complete Return
            </Button>
          )}
          {showReject && (
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
        <StatCard icon={RotateCcw} iconVariant="info" label="Return Qty" value={String(totalReturnQty(salesReturn))} />
        <StatCard icon={PackageCheck} iconVariant="warning" label="Received Qty" value={String(totalReceivedQty(salesReturn))} />
        <StatCard icon={IndianRupee} iconVariant="primary" label="Credit Amount" value={formatCurrency(salesReturn.creditAmount)} />
        <StatCard icon={Check} iconVariant="success" label="Completed" value={formatDate(salesReturn.approvedAt)} />
      </div>

      {/* ---- Items ---- */}
      <Card title="Items" subtitle="Delivered goods being sent back" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">This Return</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Received</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Restockable</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Damaged</th>
                <th className="whitespace-nowrap px-5 py-3">Condition</th>
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
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                    {item.receivedQuantity == null ? '—' : itemRestockableQty(item)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                    {item.receivedQuantity == null ? '—' : itemDamagedQty(item)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{item.condition || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---- Overview + Activity ---- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Overview">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer" value={salesReturn.customerName} />
            <Field label="Order / Invoice" value={salesReturn.orderNumber || salesReturn.invoiceNumber} />
            <Field label="Reason" value={salesReturn.returnReason} className="sm:col-span-2" />
            <Field label="Return Date" value={formatDate(salesReturn.returnDate)} />
            <Field
              label="Receiving Warehouse"
              value={salesReturn.warehouseName || (salesReturn.warehouseId ? salesReturn.warehouseId : '—')}
            />
            {salesReturn.notes && <Field label="Notes" value={salesReturn.notes} className="sm:col-span-2" />}
            {meta.key === 'rejected' && (
              <Field label="Rejection Reason" value={salesReturn.rejectedReason} className="sm:col-span-2" />
            )}
          </div>
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Credit / refund handling is managed separately.
            {salesReturn.creditNoteId
              ? ` A credit note (${formatCurrency(salesReturn.creditAmount)}) was raised on completion.`
              : meta.key === 'completed'
                ? ' No credit note was raised for this return.'
                : ' A credit note is raised when the return is completed.'}
          </p>
        </Card>

        <Card title="Activity">
          {activity.length === 0 ? (
            <p className="text-sm text-neutral-500">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {activity.map((event, index) => (
                <li key={`${event.label}-${index}`} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800">{event.label}</p>
                    <p className="text-xs text-neutral-400">{formatDateTime(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ---- Receive modal ---- */}
      <Modal isOpen={receiveOpen} onClose={() => !isReceiving && setReceiveOpen(false)} title="Receive Returned Goods" className="max-w-2xl">
        <div className="space-y-4">
          {receiveError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{receiveError}</div>
          )}
          <p className="text-sm text-neutral-500">Record what physically arrived. Received cannot exceed the return quantity.</p>
          <div className="space-y-3">
            {salesReturn.items.map((item) => {
              const values = receiveItems[item.id] || { receivedQuantity: item.quantityReturned, condition: 'saleable', restock: true }
              return (
                <div key={item.id} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <p className="text-sm font-medium text-neutral-800">{item.productName || 'Item'} <span className="text-neutral-400">· return {item.quantityReturned}</span></p>
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
                      Restock on completion
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
          <Input as="textarea" label="Notes" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} placeholder="Optional remarks about the goods received" />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isReceiving} onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="button" loading={isReceiving} onClick={handleReceive}>Confirm Received</Button>
          </div>
        </div>
      </Modal>

      {/* ---- Complete (approve) modal ---- */}
      <Modal isOpen={approveOpen} onClose={() => !isApproving && setApproveOpen(false)} title="Complete Sales Return" className="max-w-2xl">
        <div className="space-y-4">
          {approveError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{approveError}</div>
          )}
          <p className="text-sm leading-6 text-neutral-600">
            Only lines marked <span className="font-medium">saleable</span> and restock re-enter available stock. The customer is
            credited for everything received unless the credit note is switched off. This does not change the original order.
          </p>
          <div className="space-y-3">
            {salesReturn.items.map((item) => {
              const values = approveItems[item.id] || { condition: 'saleable', restock: true }
              return (
                <div key={item.id} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <p className="text-sm font-medium text-neutral-800">
                    {item.productName || 'Item'}
                    <span className="text-neutral-400"> · received {item.receivedQuantity ?? item.quantityReturned}</span>
                  </p>
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
          {!isDemo && (
            <Select
              label="Warehouse"
              options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
              value={approveWarehouseId}
              onChange={(event) => setApproveWarehouseId(event.target.value)}
              placeholder="Use firm default warehouse"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={approveCreditNote}
              onChange={(event) => setApproveCreditNote(event.target.checked)}
              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Raise a credit note for the customer
          </label>
          <Input as="textarea" label="Notes" value={approveNotes} onChange={(event) => setApproveNotes(event.target.value)} placeholder="Optional remarks" />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isApproving} onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button type="button" loading={isApproving} onClick={handleApprove}>Complete Return</Button>
          </div>
        </div>
      </Modal>

      {/* ---- Reject modal ---- */}
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

function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800 break-words">{value || '—'}</p>
    </div>
  )
}
