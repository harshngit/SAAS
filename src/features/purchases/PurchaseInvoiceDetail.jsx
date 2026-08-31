import { useEffect, useState } from 'react'
import { Ban, Check, IndianRupee, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { formatCurrency } from '../../utils/format'
import {
  approvePurchase,
  cancelPurchase,
  deletePurchase,
  getPurchase,
  PURCHASE_PAYMENT_STATUS_OPTIONS,
  returnPurchaseItems,
  updatePurchasePaymentStatus,
  uploadPurchaseDocument,
} from '../../api/purchases'

const statusVariant = { pending: 'warning', approved: 'success', cancelled: 'danger' }
const paymentStatusVariant = { unpaid: 'danger', partial: 'warning', paid: 'success' }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function PurchaseInvoiceDetail({ purchaseId, isOpen, onClose, onChanged, onEdit }) {
  const [purchase, setPurchase] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [isApproving, setIsApproving] = useState(false)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnItems, setReturnItems] = useState({})
  const [returnReason, setReturnReason] = useState('')
  const [isReturning, setIsReturning] = useState(false)
  const [returnError, setReturnError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [isUploading, setIsUploading] = useState(false)

  const loadPurchase = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getPurchase(purchaseId)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setPurchase(result.purchase)
    setIsLoading(false)
  }

  useEffect(() => {
    if (!isOpen || !purchaseId) return

    setActionError('')
    loadPurchase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, purchaseId])

  if (!isOpen) return null

  const canEdit = purchase?.status === 'pending'
  const canApprove = purchase?.status === 'pending'
  const canCancel = purchase?.status === 'approved'
  const canDelete = purchase?.status === 'pending'
  const canReturn = purchase?.status === 'approved'
  const canUpdatePayment = purchase?.status !== 'cancelled'

  const handleApprove = async () => {
    setIsApproving(true)
    setActionError('')

    const result = await approvePurchase(purchase.id)

    if (!result.success) {
      setActionError(result.error)
      setIsApproving(false)
      return
    }

    setPurchase(result.purchase)
    setIsApproving(false)
    onChanged?.(result.purchase)
  }

  const openCancelModal = () => {
    setCancelError('')
    setCancelReason('')
    setCancelOpen(true)
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    setCancelError('')

    const result = await cancelPurchase(purchase.id, cancelReason.trim() || undefined)

    if (!result.success) {
      setCancelError(result.error)
      setIsCancelling(false)
      return
    }

    setPurchase(result.purchase)
    setIsCancelling(false)
    setCancelOpen(false)
    onChanged?.(result.purchase)
  }

  const openPaymentModal = () => {
    setPaymentError('')
    setPaymentStatus(purchase.paymentStatus || 'unpaid')
    setPaymentAmount(String(purchase.amountPaid ?? 0))
    setPaymentOpen(true)
  }

  const handleUpdatePayment = async () => {
    setIsUpdatingPayment(true)
    setPaymentError('')

    const result = await updatePurchasePaymentStatus(purchase.id, {
      paymentStatus,
      amountPaid: paymentAmount === '' ? undefined : paymentAmount,
    })

    if (!result.success) {
      setPaymentError(result.error)
      setIsUpdatingPayment(false)
      return
    }

    setPurchase(result.purchase)
    setIsUpdatingPayment(false)
    setPaymentOpen(false)
    onChanged?.(result.purchase)
  }

  const openReturnModal = () => {
    setReturnError('')
    setReturnReason('')
    const initial = {}
    purchase.items.forEach((item) => {
      initial[item.productId] = { checked: false, quantity: item.quantity, variantId: item.variantId }
    })
    setReturnItems(initial)
    setReturnOpen(true)
  }

  const updateReturnItem = (productId, field, value) => {
    setReturnItems((current) => ({
      ...current,
      [productId]: { ...current[productId], [field]: value },
    }))
  }

  // Rounds/clamps on blur, not on every keystroke - see the identical pattern used for order
  // items elsewhere (rounding mid-typing jumps the cursor and mangles later digits).
  const roundReturnQuantityOnBlur = (productId, maxQuantity) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    const safe = Number.isFinite(rounded) ? rounded : 1
    updateReturnItem(productId, 'quantity', String(Math.min(Math.max(safe, 1), maxQuantity)))
  }

  const handleReturn = async () => {
    const items = Object.entries(returnItems)
      .filter(([, values]) => values.checked)
      .map(([productId, values]) => ({ productId, variantId: values.variantId || undefined, quantity: values.quantity }))

    if (items.length === 0) {
      setReturnError('Select at least one item to return.')
      return
    }

    setIsReturning(true)
    setReturnError('')

    const result = await returnPurchaseItems(purchase.id, { items, reason: returnReason.trim() || undefined })

    if (!result.success) {
      setReturnError(result.error)
      setIsReturning(false)
      return
    }

    setIsReturning(false)
    setReturnOpen(false)
    await loadPurchase()
    onChanged?.()
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deletePurchase(purchase.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setIsDeleting(false)
    setDeleteOpen(false)
    onChanged?.(null)
    onClose()
  }

  const handleUploadDocument = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    setActionError('')

    const result = await uploadPurchaseDocument(purchase.id, file)

    if (!result.success) {
      setActionError(result.error)
      setIsUploading(false)
      return
    }

    setIsUploading(false)
    await loadPurchase()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={purchase?.invoiceNumber || 'Purchase Invoice'} className="w-full max-w-4xl">
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {isLoading ? (
          <LoadingSpinner label="Loading purchase invoice..." />
        ) : loadError || !purchase ? (
          <EmptyState title="Purchase invoice not found" description={loadError || 'This invoice may have been removed.'} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[purchase.status] || 'neutral'}>{purchase.status}</Badge>
                <Badge variant={paymentStatusVariant[purchase.paymentStatus] || 'neutral'} dot>{purchase.paymentStatus}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <Upload className="size-4" aria-hidden="true" />
                  {isUploading ? 'Uploading...' : 'Attach Document'}
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadDocument} disabled={isUploading} />
                </label>
                {canEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(purchase)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                )}
                {canApprove && (
                  <Button type="button" variant="primary" size="sm" loading={isApproving} onClick={handleApprove}>
                    <Check className="size-4" aria-hidden="true" />
                    Approve
                  </Button>
                )}
                {canCancel && (
                  <Button type="button" variant="danger" size="sm" onClick={openCancelModal}>
                    <Ban className="size-4" aria-hidden="true" />
                    Cancel
                  </Button>
                )}
                {canReturn && (
                  <Button type="button" variant="outline" size="sm" onClick={openReturnModal}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Return Items
                  </Button>
                )}
                {canUpdatePayment && (
                  <Button type="button" variant="outline" size="sm" onClick={openPaymentModal}>
                    <IndianRupee className="size-4" aria-hidden="true" />
                    Payment Status
                  </Button>
                )}
                {canDelete && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                <p className="text-xs text-neutral-400">Subtotal</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(purchase.subtotal)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                <p className="text-xs text-neutral-400">Total</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(purchase.total)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                <p className="text-xs text-neutral-400">Paid</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(purchase.amountPaid)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Due</p>
                <p className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(purchase.outstandingAmount)}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-3.5 py-2.5">Product</th>
                    <th className="px-3.5 py-2.5 text-right">Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Purchase Price</th>
                    <th className="px-3.5 py-2.5 text-right">Discount</th>
                    <th className="px-3.5 py-2.5 text-right">Tax</th>
                    <th className="px-3.5 py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {purchase.items.map((item) => (
                    <tr key={item.id || item.productId}>
                      <td className="px-3.5 py-2.5 text-neutral-800">{item.productName || 'Item'}</td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-600">{item.quantity}</td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-600">{formatCurrency(item.purchasePrice)}</td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-600">{item.discount ? `${item.discount}%` : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right text-neutral-600">{item.tax ? `${item.tax}%` : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Supplier</p>
                <p className="mt-1 text-sm text-neutral-800">{purchase.supplierName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Invoice Date</p>
                <p className="mt-1 text-sm text-neutral-800">{formatDate(purchase.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Purchase Type</p>
                <p className="mt-1 text-sm text-neutral-800">{purchase.purchaseType || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Purchase Number</p>
                <p className="mt-1 text-sm text-neutral-800">{purchase.purchaseNumber || '—'}</p>
              </div>
              {purchase.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Notes</p>
                  <p className="mt-1 text-sm text-neutral-800">{purchase.notes}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={cancelOpen} onClose={() => !isCancelling && setCancelOpen(false)} title="Cancel Purchase Invoice">
        <div className="space-y-4">
          {cancelError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{cancelError}</div>
          )}
          <p className="text-sm leading-6 text-neutral-600">
            Cancelling reverses the stock added on approval and reduces the supplier&apos;s total purchases.
          </p>
          <Input
            as="textarea"
            label="Reason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Optional reason for cancellation"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isCancelling} onClick={() => setCancelOpen(false)}>Back</Button>
            <Button type="button" variant="danger" loading={isCancelling} onClick={handleCancel}>Cancel Invoice</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={paymentOpen} onClose={() => !isUpdatingPayment && setPaymentOpen(false)} title="Update Payment Status">
        <div className="space-y-4">
          {paymentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</div>
          )}
          <Select
            label="Payment Status"
            options={PURCHASE_PAYMENT_STATUS_OPTIONS}
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          />
          <Input
            label="Amount Paid"
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isUpdatingPayment} onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button type="button" loading={isUpdatingPayment} onClick={handleUpdatePayment}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={returnOpen} onClose={() => !isReturning && setReturnOpen(false)} title="Return Items to Supplier" className="max-w-2xl">
        <div className="space-y-4">
          {returnError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{returnError}</div>
          )}
          <div className="space-y-3">
            {purchase?.items.map((item) => {
              const values = returnItems[item.productId] || { checked: false, quantity: item.quantity }

              return (
                <div key={item.productId} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                      <input
                        type="checkbox"
                        checked={values.checked}
                        onChange={(event) => updateReturnItem(item.productId, 'checked', event.target.checked)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      {item.productName || 'Item'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={item.quantity}
                      step="1"
                      value={values.quantity}
                      onChange={(event) => updateReturnItem(item.productId, 'quantity', event.target.value)}
                      onBlur={roundReturnQuantityOnBlur(item.productId, item.quantity)}
                      className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Input
            as="textarea"
            label="Reason"
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder="Why are these items being returned?"
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isReturning} onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button type="button" loading={isReturning} onClick={handleReturn}>Return Items</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)} title="Delete Purchase Invoice">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {purchase?.invoiceNumber}? This cannot be undone.</p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}
