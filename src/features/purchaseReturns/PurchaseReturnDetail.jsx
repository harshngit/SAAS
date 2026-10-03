import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, PackageX, RotateCcw, Send, Trash2, Truck } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import StatCard from '../../components/ui/StatCard'
import { usePermission } from '../../auth/usePermission'
import {
  PURCHASE_RETURNS_DEMO_ENABLED,
  cancelDemoPurchaseReturn,
  completeDemoPurchaseReturn,
  confirmDemoPurchaseReturn,
  deleteDemoPurchaseReturn,
  dispatchDemoPurchaseReturn,
  getDemoPurchaseReturn,
  isDemoPurchaseReturn,
} from './purchaseReturnDemoData'
import {
  cancelPurchaseReturn,
  completePurchaseReturn,
  confirmPurchaseReturn,
  dispatchPurchaseReturn,
  getPurchaseReturn,
} from '../../api/purchaseReturns'
import { buildReturnActivity, prNextActions, prStatusMeta, totalReturnQty } from './purchaseReturnHelpers'

const basePath = '/admin/purchase-returns'

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

export default function PurchaseReturnDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = usePermission()
  const canManage = can('purchases', 'create')

  const [purchaseReturn, setPurchaseReturn] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    if (PURCHASE_RETURNS_DEMO_ENABLED && isDemoPurchaseReturn(id)) {
      setPurchaseReturn(getDemoPurchaseReturn(id))
      setIsLoading(false)
      return
    }

    if (PURCHASE_RETURNS_DEMO_ENABLED) {
      setPurchaseReturn(null)
      setIsLoading(false)
      return
    }

    const result = await getPurchaseReturn(id)
    if (!result.success) {
      setPurchaseReturn(null)
      setLoadError(result.error)
      setIsLoading(false)
      return
    }
    setPurchaseReturn(result.purchaseReturn)
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading purchase return..." />
      </Card>
    )
  }

  if (!purchaseReturn) {
    return (
      <Card>
        <EmptyState
          icon={PackageX}
          title={loadError ? 'Unable to load this purchase return' : 'Purchase return not found'}
          description={loadError || 'This purchase return may have been removed or the link is out of date.'}
          action={{ label: 'Back to Purchase Returns', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const meta = prStatusMeta(purchaseReturn.status)
  const nextActions = canManage ? prNextActions(purchaseReturn.status) : []
  const activity = buildReturnActivity(purchaseReturn)

  // Real mode: call the backend, wait for success, then reload from GET /purchase-returns/{id} -
  // never update local state optimistically. Demo mode keeps its existing local simulation.
  const runRealAction = async (apiCall) => {
    setIsActing(true)
    setActionError('')
    const result = await apiCall(purchaseReturn.id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    await load()
  }

  const runDemoAction = (fn, next) => {
    setIsActing(true)
    setActionError('')
    const updated = fn(purchaseReturn.id)
    setPurchaseReturn(updated || getDemoPurchaseReturn(purchaseReturn.id))
    setIsActing(false)
    if (next) next()
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
              <h1 className="text-2xl font-semibold text-neutral-900">{purchaseReturn.returnNumber}</h1>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {PURCHASE_RETURNS_DEMO_ENABLED && <Badge variant="warning">Demo</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {purchaseReturn.supplierName || 'Supplier'}
              {purchaseReturn.purchaseNumber ? ` · ${purchaseReturn.purchaseNumber}` : ''}
              {purchaseReturn.grnNumber ? ` · ${purchaseReturn.grnNumber}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {nextActions.includes('edit') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/${encodeURIComponent(purchaseReturn.id)}/edit`)}>
              Edit
            </Button>
          )}
          {nextActions.includes('confirm') && (
            <Button
              variant="primary"
              size="sm"
              loading={isActing}
              onClick={() => (PURCHASE_RETURNS_DEMO_ENABLED ? runDemoAction(confirmDemoPurchaseReturn) : runRealAction(confirmPurchaseReturn))}
            >
              <Check className="size-4" aria-hidden="true" />
              Confirm
            </Button>
          )}
          {nextActions.includes('dispatch') && (
            <Button
              variant="primary"
              size="sm"
              loading={isActing}
              onClick={() => (PURCHASE_RETURNS_DEMO_ENABLED ? runDemoAction(dispatchDemoPurchaseReturn) : runRealAction(dispatchPurchaseReturn))}
            >
              <Send className="size-4" aria-hidden="true" />
              Dispatch Return
            </Button>
          )}
          {nextActions.includes('complete') && (
            <Button
              variant="primary"
              size="sm"
              loading={isActing}
              onClick={() => (PURCHASE_RETURNS_DEMO_ENABLED ? runDemoAction(completeDemoPurchaseReturn) : runRealAction(completePurchaseReturn))}
            >
              <Truck className="size-4" aria-hidden="true" />
              Complete Return
            </Button>
          )}
          {nextActions.includes('cancel') && (
            <Button variant="danger" size="sm" onClick={() => { setCancelReason(''); setActionError(''); setCancelOpen(true) }}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          )}
          {/* No DELETE /purchase-returns/{id} exists in the canonical backend contract - delete
              stays a demo-only convenience, never sent to the real API. */}
          {PURCHASE_RETURNS_DEMO_ENABLED && canManage && meta.key === 'draft' && (
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
        <StatCard icon={RotateCcw} iconVariant="info" label="Return Qty" value={String(purchaseReturn.totalReturnQty ?? totalReturnQty(purchaseReturn))} />
        <StatCard icon={PackageX} iconVariant="neutral" label="Line Items" value={String(purchaseReturn.items.length)} />
        <StatCard icon={Send} iconVariant="warning" label="Dispatched" value={formatDate(purchaseReturn.dispatchedAt)} />
        <StatCard icon={Check} iconVariant="success" label="Completed" value={formatDate(purchaseReturn.completedAt)} />
      </div>

      <Card title="Items" subtitle="Received goods being returned to the supplier" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Received</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Previously Returned</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">This Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {purchaseReturn.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-primary-50/35">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-800">{item.productName || 'Item'}</p>
                    {item.sku && <p className="mt-0.5 text-xs text-neutral-400">{item.sku}</p>}
                    {(item.batchNumber || item.expiryDate) && (
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {[item.batchNumber && `Batch ${item.batchNumber}`, item.expiryDate && `Exp ${formatDate(item.expiryDate)}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.receivedQty}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.previouslyReturned}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{item.returnQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Overview">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Supplier" value={purchaseReturn.supplierName} />
            <Field label="Purchase" value={purchaseReturn.purchaseNumber} />
            <Field label="Goods Receipt (GRN)" value={purchaseReturn.grnNumber} />
            <Field label="Warehouse" value={purchaseReturn.warehouseName || (purchaseReturn.warehouseId ? purchaseReturn.warehouseId : '—')} />
            <Field label="Return Reason" value={purchaseReturn.returnReason} className="sm:col-span-2" />
            <Field label="Return Date" value={formatDate(purchaseReturn.returnDate)} />
            <Field label="Return Type" value={purchaseReturn.returnType} />
            {purchaseReturn.notes && <Field label="Notes" value={purchaseReturn.notes} className="sm:col-span-2" />}
            {meta.key === 'cancelled' && (
              <Field label="Cancellation Reason" value={purchaseReturn.cancelReason} className="sm:col-span-2" />
            )}
          </div>
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
            Supplier credit/debit note, payable adjustment and warehouse stock movement are handled by the backend as
            part of this return's lifecycle - never calculated or applied from this screen.
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

      <Modal isOpen={cancelOpen} onClose={() => !isActing && setCancelOpen(false)} title="Cancel Purchase Return">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            A return can only be cancelled before it is dispatched. This does not change any stock.
          </p>
          <Input
            as="textarea"
            label="Cancellation Reason"
            required
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Why is this return being cancelled?"
            maxLength={300}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>Keep Return</Button>
            <Button
              type="button"
              variant="danger"
              loading={isActing}
              onClick={() => {
                if (!cancelReason.trim()) {
                  setActionError('A cancellation reason is required.')
                  return
                }
                if (PURCHASE_RETURNS_DEMO_ENABLED) {
                  runDemoAction((rid) => cancelDemoPurchaseReturn(rid, cancelReason.trim()), () => setCancelOpen(false))
                } else {
                  runRealAction((rid) => cancelPurchaseReturn(rid, cancelReason.trim())).then(() => setCancelOpen(false))
                }
              }}
            >
              Cancel Return
            </Button>
          </div>
        </div>
      </Modal>

      {PURCHASE_RETURNS_DEMO_ENABLED && (
        <Modal isOpen={deleteOpen} onClose={() => !isActing && setDeleteOpen(false)} title="Delete Purchase Return">
          <div className="space-y-5">
            <p className="text-sm text-neutral-600">Delete {purchaseReturn.returnNumber}? This cannot be undone.</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                type="button"
                variant="danger"
                loading={isActing}
                onClick={() => {
                  deleteDemoPurchaseReturn(purchaseReturn.id)
                  navigate(basePath)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
