import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, FileText, IndianRupee, PackageSearch, Pencil, RotateCcw, Trash2, Upload, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { formatCurrency } from '../../utils/format'
import {
  cancelPurchase,
  closePurchase,
  confirmPurchase,
  deletePurchase,
  getPurchase,
  returnPurchaseItems,
  updatePurchasePaymentStatus,
  uploadPurchaseDocument,
} from '../../api/purchases'
import {
  deriveReceivingStatus,
  derivePaymentStatus,
  derivePaymentStatusFromAmount,
  derivePurchaseOutstanding,
  derivePurchaseStatus,
  derivePurchaseTax,
  getPurchaseActions,
  validatePurchasePaymentAmount,
} from './purchaseHelpers'
import { getDemoPurchase, isDemoPurchase, patchDemoPurchase } from './purchaseDemoData'
import { cumulativeAcceptedByProduct, deriveReceivingStatusFromGrns } from './purchaseGrnHelpers'
import { getDemoGrns } from './purchaseGrnDemoData'
import PurchaseGrnPanel from './PurchaseGrnPanel'
import { getDemoSupplierInvoicesForPurchase } from '../supplierInvoices/supplierInvoiceDemoData'
import {
  PURCHASE_RETURNS_DEMO_ENABLED,
  demoReturnablePurchases,
  getDemoPurchaseReturnsForPurchase,
} from '../purchaseReturns/purchaseReturnDemoData'
import { prStatusMeta, totalReturnQty } from '../purchaseReturns/purchaseReturnHelpers'
import {
  invoiceStatusMeta,
  lifecycleMeta,
  paymentStatusMeta,
  resolveSupplierInvoice,
  verificationMeta,
} from '../supplierInvoices/supplierInvoiceHelpers'
import SupplierInvoiceQuickView from '../supplierInvoices/SupplierInvoiceQuickView'
import { listSupplierInvoices } from '../../api/supplierInvoices'
import { useAuthStore } from '../../store/authStore'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function DetailField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{displayValue(value)}</p>
    </div>
  )
}

// Demo-only cross-link: purchase returns raised against this purchase + a start point for a
// new one. Real mode never renders this (no backend Purchase Return module).
function PurchaseReturnsCrossLink({ purchaseId, navigate, refreshTick }) {
  // refreshTick re-reads the localStorage demo store after a GRN / return change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const returns = useMemo(() => getDemoPurchaseReturnsForPurchase(purchaseId), [purchaseId, refreshTick])
  const returnable = useMemo(
    () => demoReturnablePurchases().find((entry) => entry.id === purchaseId)?.hasReturnable,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchaseId, refreshTick],
  )
  if (returns.length === 0 && !returnable) return null
  return (
    <Card
      title="Returns to Supplier"
      subtitle="Goods returned to the supplier against this purchase"
      actions={
        returnable ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/purchase-returns/new?purchase=${encodeURIComponent(purchaseId)}`)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Create Purchase Return
          </Button>
        ) : null
      }
    >
      {returns.length === 0 ? (
        <p className="text-sm text-neutral-400">No returns raised against this purchase yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {returns.map((pr) => {
            const meta = prStatusMeta(pr.status)
            return (
              <li key={pr.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <button
                  type="button"
                  className="font-medium text-primary-700 hover:underline"
                  onClick={() => navigate(`/admin/purchase-returns/${encodeURIComponent(pr.id)}`)}
                >
                  {pr.returnNumber}
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-500">Qty {totalReturnQty(pr)}</span>
                  <span className="text-neutral-400">{formatDate(pr.returnDate)}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function PurchaseInvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/purchases' : '/admin/purchases'
  const isDemo = isDemoPurchase(id)

  const [purchase, setPurchase] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnItems, setReturnItemsState] = useState({})
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [grnRefresh, setGrnRefresh] = useState(0)
  const [quickViewInvoiceId, setQuickViewInvoiceId] = useState(null)
  const [realSupplierInvoices, setRealSupplierInvoices] = useState([])

  const loadPurchase = async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      const record = getDemoPurchase(id)
      setPurchase(record)
      setLoadError(record ? '' : 'Demo purchase not found.')
      setIsLoading(false)
      return
    }

    const result = await getPurchase(id)
    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }
    setPurchase(result.purchase)
    setIsLoading(false)
  }

  useEffect(() => {
    setActionError('')
    loadPurchase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const actions = useMemo(() => getPurchaseActions(purchase), [purchase])
  const purchaseStatus = useMemo(() => derivePurchaseStatus(purchase), [purchase])
  // grnRefresh is bumped by the Goods Receipts panel after a demo GRN is added, so the
  // Receiving card / tab count re-read the local demo store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demoGrns = useMemo(() => (isDemo && purchase ? getDemoGrns(purchase.id) : []), [isDemo, purchase, grnRefresh])
  const receiving = useMemo(() => {
    if (isDemo && demoGrns.length > 0) return deriveReceivingStatusFromGrns(purchase?.items, demoGrns)
    return deriveReceivingStatus(purchase)
  }, [isDemo, demoGrns, purchase])
  const linkedSupplierInvoices = useMemo(
    () =>
      isDemo && purchase
        ? getDemoSupplierInvoicesForPurchase(purchase.id).map((invoice) =>
            resolveSupplierInvoice(invoice, { purchase, grns: demoGrns }),
          )
        : [],
    [isDemo, purchase, demoGrns],
  )

  // Real mode: GET /supplier-invoices?purchase_id={id} (never Purchase.grn_number / legacy routes).
  useEffect(() => {
    if (isDemo || !purchase?.id) return
    let active = true
    listSupplierInvoices({ purchaseId: purchase.id }).then((result) => {
      if (active && result.success) setRealSupplierInvoices(result.invoices)
    })
    return () => {
      active = false
    }
  }, [isDemo, purchase?.id])
  const payment = useMemo(() => derivePaymentStatus(purchase), [purchase])
  const outstanding = useMemo(() => derivePurchaseOutstanding(purchase), [purchase])

  // Per-item Ordered / Received / Remaining. Real mode: backend-controlled item fields.
  // Demo mode: cumulative accepted from local demo GRNs (never a fabricated field).
  const demoAcceptedByProduct = useMemo(
    () => (isDemo ? cumulativeAcceptedByProduct(demoGrns) : {}),
    [isDemo, demoGrns],
  )
  // GRN count shown on the tab: demo count locally, real count from the backend Purchase.
  const [realGrnCount, setRealGrnCount] = useState(0)
  const grnTabCount = isDemo ? demoGrns.length : realGrnCount || purchase?.grnCount || 0
  const itemQty = (item, which) => {
    const ordered = Number(item.orderedQty ?? item.quantity) || 0
    if (isDemo) {
      const received = Number(demoAcceptedByProduct[item.productId]) || 0
      if (which === 'ordered') return ordered
      if (which === 'received') return received
      return Math.max(ordered - received, 0)
    }
    if (which === 'ordered') return ordered
    if (which === 'received') return Number(item.receivedQty) || 0
    return item.remainingQty ?? Math.max(ordered - (Number(item.receivedQty) || 0), 0)
  }
  const tax = useMemo(() => derivePurchaseTax(purchase), [purchase])
  const paymentPreview = useMemo(
    () => derivePaymentStatus({ paymentStatus: derivePaymentStatusFromAmount(paymentAmount, purchase?.total) }),
    [paymentAmount, purchase],
  )

  const applyDemo = (partial) => {
    patchDemoPurchase(id, partial)
    setPurchase((current) => ({ ...current, ...partial }))
  }

  // Purchase confirm is a purely commercial transition - it moves NO stock. Only a confirmed
  // GRN receives goods into the warehouse.
  const handleConfirm = async () => {
    setIsActing(true)
    setActionError('')

    if (isDemo) {
      applyDemo({ status: 'confirmed' })
      setIsActing(false)
      showToast({ title: 'Purchase confirmed', message: 'This purchase is now Confirmed. Receive goods via a Goods Receipt.' })
      return
    }

    const result = await confirmPurchase(id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setPurchase(result.purchase)
    showToast({ title: 'Purchase confirmed', message: 'This purchase is now Confirmed.' })
  }

  // Close is only valid once fully received (backend also blocks an early close). No stock move.
  const handleClose = async () => {
    setIsActing(true)
    setActionError('')

    if (isDemo) {
      applyDemo({ status: 'closed' })
      setIsActing(false)
      showToast({ title: 'Purchase closed', message: 'This purchase is now Closed.' })
      return
    }

    const result = await closePurchase(id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setPurchase(result.purchase)
    showToast({ title: 'Purchase closed', message: 'This purchase is now Closed.' })
  }

  const openCancelModal = () => {
    setCancelError('')
    setCancelReason('')
    setCancelOpen(true)
  }

  const handleCancel = async () => {
    setIsActing(true)
    setCancelError('')

    if (isDemo) {
      applyDemo({ status: 'cancelled' })
      setIsActing(false)
      setCancelOpen(false)
      return
    }

    const result = await cancelPurchase(id, cancelReason.trim() || undefined)
    setIsActing(false)
    if (!result.success) {
      setCancelError(result.error)
      return
    }
    setPurchase(result.purchase)
    setCancelOpen(false)
  }

  const openPaymentModal = () => {
    setPaymentError('')
    setPaymentAmount(String(purchase.amountPaid ?? 0))
    setPaymentOpen(true)
  }

  const handleUpdatePayment = async () => {
    setPaymentError('')
    const grandTotal = purchase.total
    const validationError = validatePurchasePaymentAmount(paymentAmount, grandTotal)
    if (validationError) {
      setPaymentError(validationError)
      return
    }

    setIsActing(true)
    const amountPaid = Number(paymentAmount) || 0
    const paymentStatus = derivePaymentStatusFromAmount(amountPaid, grandTotal)

    if (isDemo) {
      applyDemo({ paymentStatus, amountPaid, outstandingAmount: derivePurchaseOutstanding({ total: grandTotal, amountPaid }) })
      setIsActing(false)
      setPaymentOpen(false)
      return
    }

    const result = await updatePurchasePaymentStatus(id, { paymentStatus, amountPaid })
    setIsActing(false)
    if (!result.success) {
      setPaymentError(result.error)
      return
    }
    setPurchase(result.purchase)
    setPaymentOpen(false)
  }

  const openReturnModal = () => {
    setReturnError('')
    setReturnReason('')
    const initial = {}
    purchase.items.forEach((purchaseItem) => {
      initial[purchaseItem.productId] = { checked: false, quantity: purchaseItem.quantity, variantId: purchaseItem.variantId }
    })
    setReturnItemsState(initial)
    setReturnOpen(true)
  }

  const updateReturnItem = (productId, field, value) => {
    setReturnItemsState((current) => ({ ...current, [productId]: { ...current[productId], [field]: value } }))
  }

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

    setIsActing(true)
    setReturnError('')

    if (isDemo) {
      showToast({ title: 'Items returned', message: 'Recorded locally for this demo purchase.' })
      setIsActing(false)
      setReturnOpen(false)
      return
    }

    const result = await returnPurchaseItems(id, { items, reason: returnReason.trim() || undefined })
    setIsActing(false)
    if (!result.success) {
      setReturnError(result.error)
      return
    }
    setReturnOpen(false)
    await loadPurchase()
  }

  const handleDelete = async () => {
    setIsActing(true)

    if (isDemo) {
      setIsActing(false)
      setDeleteOpen(false)
      navigate(basePath)
      return
    }

    const result = await deletePurchase(id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      setDeleteOpen(false)
      return
    }
    navigate(basePath)
  }

  const handleUploadDocument = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    setActionError('')

    if (isDemo) {
      applyDemo({ attachmentUrl: file.name })
      setIsUploading(false)
      showToast({ title: 'Document attached', message: 'Recorded locally for this demo purchase.' })
      return
    }

    const result = await uploadPurchaseDocument(id, file)
    setIsUploading(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    await loadPurchase()
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading purchase..." />
  }

  if (loadError || !purchase) {
    return (
      <Card>
        <EmptyState
          icon={PackageSearch}
          title="Purchase not found"
          description={loadError || 'This purchase may have been removed.'}
          action={{ label: 'Back to Purchases', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{purchase.invoiceNumber}</h1>
              <Badge variant={purchaseStatus.variant}>{purchaseStatus.label}</Badge>
              {isDemo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
              <span>{purchase.supplierName || '—'}</span>
              <span>·</span>
              <span>{purchase.purchaseType || '—'}</span>
              <span>·</span>
              <span>{formatDate(purchase.purchaseDate || purchase.invoiceDate)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.includes('edit') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/${id}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {actions.includes('confirm') && (
            <Button variant="primary" size="sm" loading={isActing} onClick={handleConfirm}>
              <Check className="size-4" aria-hidden="true" />
              Confirm Purchase
            </Button>
          )}
          {actions.includes('close') && (
            <Button variant="primary" size="sm" loading={isActing} onClick={handleClose}>
              <Check className="size-4" aria-hidden="true" />
              Close Purchase
            </Button>
          )}
          {purchaseStatus.key === 'confirmed' && receiving.key !== 'fully_received' && !actions.includes('close') && (
            <span className="rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-500">
              Close available once fully received
            </span>
          )}
          {actions.includes('return') && (
            <Button variant="outline" size="sm" onClick={openReturnModal}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Return Items
            </Button>
          )}
          {actions.includes('recordPayment') && (
            <Button variant="outline" size="sm" onClick={openPaymentModal}>
              <IndianRupee className="size-4" aria-hidden="true" />
              Record / Update Payment
            </Button>
          )}
          {actions.includes('cancel') && (
            <Button variant="danger" size="sm" onClick={openCancelModal}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          )}
          {actions.includes('delete') && (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Grand Total" value={formatCurrency(purchase.total)} />
        <StatCard icon={PackageSearch} iconVariant="info" label="Receiving" value={receiving.label} />
        <StatCard icon={Wallet} iconVariant="success" label="Amount Paid" value={formatCurrency(purchase.amountPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(outstanding)} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="receipts">Goods Receipts{grnTabCount > 0 ? ` (${grnTabCount})` : ''}</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents / Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card title="Purchase Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Purchase #" value={purchase.purchaseNumber || purchase.invoiceNumber} />
              <DetailField label="Supplier" value={purchase.supplierName} />
              <DetailField label="Supplier Reference / Invoice #" value={purchase.invoiceNumber} />
              <DetailField label="Purchase Type" value={purchase.purchaseType} />
              <DetailField label="Purchase Date" value={formatDate(purchase.purchaseDate || purchase.invoiceDate)} />
              <DetailField label="Warehouse" value={purchase.warehouseName} />
              <DetailField label="Billing Address" value={purchase.billingAddress} />
              <DetailField label="Financial Year" value={purchase.financialYear} />
              <DetailField label="Purchase Status" value={purchaseStatus.label} />
              <DetailField label="Receiving Status" value={receiving.label} />
              <DetailField label="Payment Status" value={payment.label} />
              {purchase.notes && <DetailField label="Notes" value={purchase.notes} className="sm:col-span-2 lg:col-span-3" />}
            </div>
          </Card>

          <Card title="Commercial Summary">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <DetailField label="Subtotal" value={formatCurrency(purchase.subtotal)} />
              <DetailField label="Discount" value={formatCurrency(purchase.discount)} />
              <DetailField label="Tax" value={formatCurrency(tax)} />
              <DetailField label="Grand Total" value={formatCurrency(purchase.total)} />
              <DetailField label="Amount Paid" value={formatCurrency(purchase.amountPaid)} />
              <DetailField label="Outstanding" value={formatCurrency(outstanding)} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <Card title="Items" className="p-0" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3 text-right">Ordered</th>
                    <th className="px-5 py-3 text-right">Received</th>
                    <th className="px-5 py-3 text-right">Remaining</th>
                    <th className="px-5 py-3 text-right">Purchase Price</th>
                    <th className="px-5 py-3 text-right">Discount</th>
                    <th className="px-5 py-3 text-right">Tax</th>
                    <th className="px-5 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {purchase.items.map((purchaseItem) => {
                    const ordered = itemQty(purchaseItem, 'ordered')
                    const received = itemQty(purchaseItem, 'received')
                    const remaining = itemQty(purchaseItem, 'remaining')
                    return (
                    <tr key={purchaseItem.id || purchaseItem.productId} className="hover:bg-primary-50/35">
                      <td className="px-5 py-3.5 font-medium text-neutral-900">{purchaseItem.productName || 'Item'}</td>
                      <td className="px-5 py-3.5 text-neutral-600">{displayValue(purchaseItem.sku)}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{ordered}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{received}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{remaining}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{formatCurrency(purchaseItem.purchasePrice)}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{purchaseItem.discount ? `${purchaseItem.discount}%` : '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{purchaseItem.tax ? `${purchaseItem.tax}%` : '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(purchaseItem.lineTotal)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-4">
          <PurchaseGrnPanel
            purchase={purchase}
            isDemo={isDemo}
            currentUserName={currentUser?.name}
            purchaseStatusKey={purchaseStatus.key}
            receivingKey={receiving.key}
            onGrnCount={setRealGrnCount}
            onGrnChange={() => {
              setGrnRefresh((tick) => tick + 1)
              // Real mode: a confirmed GRN rolls up received_qty / receiving_status on the
              // Purchase - refresh from the server so the Items tab + Receiving card update.
              if (!isDemo) loadPurchase()
            }}
          />
          {isDemo && PURCHASE_RETURNS_DEMO_ENABLED && (
            <PurchaseReturnsCrossLink purchaseId={purchase.id} navigate={navigate} refreshTick={grnRefresh} />
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          <Card title="Supplier Invoice Reference">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="Supplier Reference / Invoice #" value={purchase.invoiceNumber} />
              <DetailField label="Invoice Date" value={formatDate(purchase.invoiceDate)} />
            </div>
          </Card>

          {(() => {
            const rows = isDemo
              ? linkedSupplierInvoices.map((invoice) => ({
                  id: invoice.id,
                  number: invoice.supplierInvoiceNumber,
                  invoiceDate: invoice.invoiceDate,
                  total: invoice.invoiceTotal,
                  outstanding: invoice.outstanding,
                  payment: paymentStatusMeta(invoice.paymentStatus),
                  lifecycle: invoiceStatusMeta(invoice.invoiceStatus),
                  verification: invoice.match || null,
                }))
              : realSupplierInvoices.map((invoice) => ({
                  id: invoice.id,
                  number: invoice.supplierInvoiceNumber,
                  invoiceDate: invoice.invoiceDate,
                  total: invoice.grandTotal,
                  outstanding: invoice.outstandingAmount,
                  payment: paymentStatusMeta(invoice.paymentStatus),
                  lifecycle: lifecycleMeta(invoice.status),
                  verification: verificationMeta(invoice.verificationStatus),
                }))
            if (rows.length === 0) {
              return (
                <Card>
                  <EmptyState
                    icon={FileText}
                    title="No supplier invoices linked"
                    description="Supplier invoices billed against this purchase will appear here."
                  />
                </Card>
              )
            }
            return (
              <Card title="Linked Supplier Invoices" className="p-0" bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-4xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-5 py-3">Supplier Invoice #</th>
                        <th className="px-5 py-3">Invoice Date</th>
                        <th className="px-5 py-3 text-right">Invoice Total</th>
                        <th className="px-5 py-3 text-right">Outstanding</th>
                        <th className="px-5 py-3">Payment Status</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Verification</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {rows.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-primary-50/35">
                          <td className="px-5 py-3.5 font-medium text-primary-700">{invoice.number}</td>
                          <td className="px-5 py-3.5 text-neutral-600">{formatDate(invoice.invoiceDate)}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(invoice.total)}</td>
                          <td className="px-5 py-3.5 text-right text-neutral-700">{formatCurrency(invoice.outstanding)}</td>
                          <td className="px-5 py-3.5"><Badge variant={invoice.payment.variant} dot>{invoice.payment.label}</Badge></td>
                          <td className="px-5 py-3.5"><Badge variant={invoice.lifecycle.variant}>{invoice.lifecycle.label}</Badge></td>
                          <td className="px-5 py-3.5">{invoice.verification ? <Badge variant={invoice.verification.variant}>{invoice.verification.label}</Badge> : <span className="text-neutral-400">—</span>}</td>
                          <td className="px-5 py-3.5 text-right">
                            {isDemo ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickViewInvoiceId(invoice.id)}>Quick View</Button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/admin/supplier-invoices/${invoice.id}`)}>Open</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })()}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card
            title="Payments"
            subtitle="Aggregate payment amount and status for this purchase."
            actions={
              actions.includes('recordPayment') ? (
                <Button type="button" size="sm" onClick={openPaymentModal}>
                  <IndianRupee className="size-4" aria-hidden="true" />
                  Record / Update Payment
                </Button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailField label="Amount Paid" value={formatCurrency(purchase.amountPaid)} />
              <DetailField label="Outstanding" value={formatCurrency(outstanding)} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment Status</p>
                <div className="mt-1"><Badge variant={payment.variant}>{payment.label}</Badge></div>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
              This tracks one aggregate amount/status for the purchase. Itemised supplier payment records are not yet supported.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card
            title="Attached Document"
            actions={
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                <Upload className="size-4" aria-hidden="true" />
                {isUploading ? 'Uploading...' : 'Attach Document'}
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadDocument} disabled={isUploading} />
              </label>
            }
          >
            {purchase.attachmentUrl ? (
              <p className="text-sm text-neutral-700">{purchase.attachmentUrl}</p>
            ) : (
              <p className="text-sm text-neutral-400">No document uploaded yet.</p>
            )}
          </Card>
          <Card title="Notes">
            {purchase.notes ? (
              <p className="whitespace-pre-line text-sm text-neutral-700">{purchase.notes}</p>
            ) : (
              <p className="text-sm text-neutral-400">No notes added.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Modal isOpen={cancelOpen} onClose={() => !isActing && setCancelOpen(false)} title="Cancel Purchase">
        <div className="space-y-4">
          {cancelError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{cancelError}</div>}
          <p className="text-sm leading-6 text-neutral-600">
            Cancelling this purchase may reverse related inventory effects. Continue only if the purchase has not been operationally completed.
          </p>
          <Input as="textarea" label="Reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Optional reason for cancellation" />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setCancelOpen(false)}>Back</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={handleCancel}>Cancel Purchase</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={paymentOpen} onClose={() => !isActing && setPaymentOpen(false)} title="Record / Update Payment">
        <div className="space-y-4">
          {paymentError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</div>}
          <p className="text-sm text-neutral-500">Grand Total: <span className="font-medium text-neutral-800">{formatCurrency(purchase.total)}</span></p>
          <Input label="Amount Paid" type="number" min="0" max={purchase.total} step="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            Payment Status: <Badge variant={paymentPreview.variant}>{paymentPreview.label}</Badge>
            <span className="text-xs text-neutral-400">(derived from amount)</span>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={handleUpdatePayment}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={returnOpen} onClose={() => !isActing && setReturnOpen(false)} title="Return Items to Supplier" className="max-w-2xl">
        <div className="space-y-4">
          {returnError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{returnError}</div>}
          <div className="space-y-3">
            {purchase.items.map((purchaseItem) => {
              const values = returnItems[purchaseItem.productId] || { checked: false, quantity: purchaseItem.quantity }
              return (
                <div key={purchaseItem.productId} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                      <input
                        type="checkbox"
                        checked={values.checked}
                        onChange={(event) => updateReturnItem(purchaseItem.productId, 'checked', event.target.checked)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      {purchaseItem.productName || 'Item'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={purchaseItem.quantity}
                      step="1"
                      value={values.quantity}
                      onChange={(event) => updateReturnItem(purchaseItem.productId, 'quantity', event.target.value)}
                      onBlur={roundReturnQuantityOnBlur(purchaseItem.productId, purchaseItem.quantity)}
                      className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Input as="textarea" label="Reason" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Why are these items being returned?" />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={handleReturn}>Return Items</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !isActing && setDeleteOpen(false)} title="Delete Purchase">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {purchase.invoiceNumber}? This cannot be undone.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>

      <SupplierInvoiceQuickView
        invoiceId={quickViewInvoiceId}
        isOpen={Boolean(quickViewInvoiceId)}
        onClose={() => setQuickViewInvoiceId(null)}
        onOpenFull={() => navigate(`/admin/supplier-invoices/${quickViewInvoiceId}`)}
      />
    </div>
  )
}
