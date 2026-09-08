import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, Check, IndianRupee, Pencil, Trash2, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { DEMO_MODE } from '../../config/demoMode'
import { formatCurrency } from '../../utils/format'
import { safeNumber } from '../purchases/purchaseHelpers'
import { getDemoPurchase } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import {
  buildMatchRows,
  computeInvoiceLine,
  computeInvoiceTotals,
  derivePaymentStatusFromAmount,
  invoiceOutstanding,
  invoiceStatusMeta,
  lifecycleMeta,
  paymentStatusMeta,
  summarizeMatch,
  verificationMeta,
} from './supplierInvoiceHelpers'
import {
  getDemoSupplierInvoice,
  isDemoSupplierInvoice,
  patchDemoSupplierInvoice,
} from './supplierInvoiceDemoData'
import {
  cancelSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoice,
  recordSupplierInvoice,
} from '../../api/supplierInvoices'
import { paymentModeLabel, paymentStatusMeta as supplierPaymentStatusMeta } from '../supplierPayments/supplierPaymentHelpers'
import { getSupplierPayments } from '../supplierPayments/supplierPaymentDemoData'
import { getSupplierInvoicePayments } from '../../api/supplierPayments'
import RecordSupplierPaymentDrawer from '../supplierPayments/RecordSupplierPaymentDrawer'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value === 0 ? '0' : value || '—'}</p>
    </div>
  )
}

export default function SupplierInvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { can } = usePermission()
  const basePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const isDemo = DEMO_MODE && isDemoSupplierInvoice(id)

  const canEdit = isDemo || can('supplier_invoices', 'edit')
  const canApprove = isDemo || can('supplier_invoices', 'approve')
  const canDelete = isDemo || can('supplier_invoices', 'delete')

  const [invoice, setInvoice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [tick, setTick] = useState(0)
  const [recordOpen, setRecordOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    if (isDemo) {
      const record = getDemoSupplierInvoice(id)
      setInvoice(record || null)
      setLoadError(record ? '' : 'Demo supplier invoice not found.')
      setIsLoading(false)
      return
    }
    const result = await getSupplierInvoice(id)
    if (!result.success) {
      setInvoice(null)
      setLoadError(result.error)
      setIsLoading(false)
      return
    }
    setInvoice(result.invoice)
    setIsLoading(false)
  }, [id, isDemo])

  useEffect(() => {
    load()
  }, [load, tick])

  // ---- real payment history (GET /supplier-invoices/{id}/payments) ------
  const [realPayments, setRealPayments] = useState([])
  useEffect(() => {
    if (isDemo || !id) return
    let active = true
    getSupplierInvoicePayments(id).then((result) => {
      if (active && result.success) setRealPayments(result.payments)
    })
    return () => {
      active = false
    }
  }, [isDemo, id, tick])

  // ---- demo derived values ----------------------------------------------
  const demoTotals = useMemo(
    () => (isDemo && invoice ? computeInvoiceTotals(invoice.items, invoice.charges) : null),
    [isDemo, invoice],
  )
  const demoPurchase = useMemo(() => (isDemo && invoice?.purchaseId ? getDemoPurchase(invoice.purchaseId) : null), [isDemo, invoice])
  const demoGrns = useMemo(() => (isDemo && invoice?.purchaseId ? getDemoGrns(invoice.purchaseId) : []), [isDemo, invoice])
  const demoMatchRows = useMemo(
    () => (isDemo && invoice ? buildMatchRows(invoice, demoPurchase, demoGrns) : []),
    [isDemo, invoice, demoPurchase, demoGrns],
  )
  const demoMatchSummary = useMemo(() => summarizeMatch(demoMatchRows), [demoMatchRows])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demoPayments = useMemo(() => (isDemo && invoice ? getSupplierPayments({ invoiceId: id }) : []), [isDemo, invoice, id, tick])

  const applyDemoPatch = (partial) => {
    patchDemoSupplierInvoice(id, partial)
    setTick((value) => value + 1)
  }

  // ---- real actions ---------------------------------------------------
  const runAction = async (kind) => {
    setIsActing(true)
    setActionError('')
    let result
    if (kind === 'record') result = await recordSupplierInvoice(id)
    else if (kind === 'cancel') result = await cancelSupplierInvoice(id)
    else result = await deleteSupplierInvoice(id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      setCancelOpen(false)
      setDeleteOpen(false)
      return
    }
    if (kind === 'delete') {
      navigate(basePath)
      return
    }
    if (kind === 'record') {
      const verified = result.invoice.verificationStatus
      showToast({
        title: 'Supplier invoice recorded.',
        message: verified === 'mismatched' ? 'Verification flagged a mismatch — review required.' : 'Verification matched.',
      })
    } else {
      showToast({ title: 'Supplier invoice cancelled.' })
    }
    setCancelOpen(false)
    setInvoice(result.invoice)
  }

  if (isLoading) return <LoadingSpinner label="Loading supplier invoice..." />

  if (loadError || !invoice) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Supplier invoice not found"
          description={loadError || 'This supplier invoice may have been removed.'}
          action={{ label: 'Back to Supplier Invoices', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  // ---- unify demo + real into one view model --------------------------
  const view = isDemo
    ? {
        number: invoice.supplierInvoiceNumber,
        supplierName: invoice.supplierName,
        purchaseNumber: invoice.purchaseNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        systemRef: invoice.systemRef,
        lifecycle: invoiceStatusMeta(invoice.invoiceStatus),
        lifecycleKey: invoice.invoiceStatus,
        verification: demoMatchRows.length > 0 ? demoMatchSummary.overall : null,
        payment: paymentStatusMeta(derivePaymentStatusFromAmount(invoice.amountPaid, demoTotals?.invoiceTotal)),
        subtotal: demoTotals?.subtotal ?? 0,
        discountTotal: demoTotals?.discount ?? 0,
        taxTotal: demoTotals?.tax ?? 0,
        additionalCharges:
          (demoTotals?.freight ?? 0) + (demoTotals?.packing ?? 0) + (demoTotals?.insurance ?? 0) + (demoTotals?.otherCharges ?? 0) + (demoTotals?.roundOff ?? 0),
        grandTotal: demoTotals?.invoiceTotal ?? 0,
        amountPaid: safeNumber(invoice.amountPaid),
        outstanding: invoiceOutstanding({ invoiceTotal: demoTotals?.invoiceTotal, amountPaid: invoice.amountPaid }),
        items: (invoice.items || []).map((item) => ({
          ...item,
          billedQty: safeNumber(item.invoiceQty),
          tax: safeNumber(item.taxRate),
          lineTotal: computeInvoiceLine(item).lineTotal,
          taxAmount: computeInvoiceLine(item).taxAmount,
        })),
        matching: null,
      }
    : {
        number: invoice.supplierInvoiceNumber,
        supplierName: invoice.supplierName,
        purchaseNumber: invoice.purchaseNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        systemRef: invoice.systemRef,
        lifecycle: lifecycleMeta(invoice.status),
        lifecycleKey: invoice.status,
        verification: verificationMeta(invoice.verificationStatus),
        payment: paymentStatusMeta(invoice.paymentStatus),
        subtotal: invoice.subtotal,
        discountTotal: invoice.discountTotal,
        taxTotal: invoice.taxTotal,
        additionalCharges: invoice.additionalCharges,
        grandTotal: invoice.grandTotal,
        amountPaid: invoice.amountPaid,
        outstanding: invoice.outstandingAmount,
        items: invoice.items,
        matching: invoice.matching,
      }

  const isDraft = view.lifecycleKey === 'draft'
  const isCancelled = view.lifecycleKey === 'cancelled'
  const isRecorded = view.lifecycleKey === 'recorded'
  const canCancel = !isDemo && isRecorded && safeNumber(view.amountPaid) <= 0

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
              <h1 className="text-2xl font-semibold text-neutral-900">{view.number}</h1>
              <Badge variant={view.lifecycle.variant}>{view.lifecycle.label}</Badge>
              {view.verification && <Badge variant={view.verification.variant}>{view.verification.label}</Badge>}
              {isDemo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
              <span>{view.supplierName || '—'}</span>
              <span>·</span>
              <span>Invoice {formatDate(view.invoiceDate)}</span>
              <span>·</span>
              <span>Due {formatDate(view.dueDate)}</span>
              {view.purchaseNumber && (<><span>·</span><span>Purchase {view.purchaseNumber}</span></>)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDraft && canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/${id}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {!isDemo && isDraft && canApprove && (
            <Button variant="primary" size="sm" loading={isActing} onClick={() => runAction('record')}>
              <Check className="size-4" aria-hidden="true" />
              Record Invoice
            </Button>
          )}
          {!isDemo && canCancel && canApprove && (
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          )}
          {!isDemo && isDraft && canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          )}
          {isDemo && !isCancelled && (
            <>
              {view.payment.key !== 'paid' && (
                <Button variant="outline" size="sm" onClick={() => setRecordOpen(true)}>
                  <IndianRupee className="size-4" aria-hidden="true" />
                  Record Payment
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => applyDemoPatch({ invoiceStatus: 'cancelled' })}>
                <Ban className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      {view.verification?.key === 'mismatched' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Mismatch — Review Required. The recorded invoice differs from confirmed received quantities or the purchase price. It stays payable; no dispute lifecycle.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Invoice Total" value={formatCurrency(view.grandTotal)} />
        <StatCard icon={Wallet} iconVariant="success" label="Amount Paid" value={formatCurrency(view.amountPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding" value={formatCurrency(view.outstanding)} />
        <StatCard icon={Wallet} iconVariant="info" label="Payment Status" value={view.payment.label} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="match">Verification</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card title="Invoice Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Supplier" value={view.supplierName} />
              <Field label="Supplier Invoice #" value={view.number} />
              <Field label="Invoice Date" value={formatDate(view.invoiceDate)} />
              <Field label="Due Date" value={formatDate(view.dueDate)} />
              <Field label="Purchase #" value={view.purchaseNumber} />
              <Field label="Status" value={view.lifecycle.label} />
              <Field label="Verification Status" value={view.verification ? view.verification.label : 'Pending Verification'} />
              <Field label="Payment Status" value={view.payment.label} />
              {!isDemo && <Field label="Recorded At" value={invoice.recordedAt ? formatDate(invoice.recordedAt) : '—'} />}
              {!isDemo && <Field label="Created At" value={invoice.createdAt ? formatDate(invoice.createdAt) : '—'} />}
              {view.notes && <Field label="Notes" value={view.notes} className="sm:col-span-2 lg:col-span-3" />}
            </div>
          </Card>

          <Card title="Commercial Summary">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Subtotal" value={formatCurrency(view.subtotal)} />
              <Field label="Discount" value={formatCurrency(view.discountTotal)} />
              <Field label="Tax" value={formatCurrency(view.taxTotal)} />
              <Field label="Additional Charges" value={formatCurrency(view.additionalCharges)} />
              <Field label="Invoice Total" value={formatCurrency(view.grandTotal)} />
              <Field label="Amount Paid" value={formatCurrency(view.amountPaid)} />
              <Field label="Outstanding" value={formatCurrency(view.outstanding)} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <Card title="Items" className="p-0" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3 text-right">Ordered</th>
                    <th className="px-5 py-3 text-right">Received</th>
                    <th className="px-5 py-3 text-right">Billed Qty</th>
                    <th className="px-5 py-3 text-right">Unit Price</th>
                    <th className="px-5 py-3 text-right">Purchase Price</th>
                    <th className="px-5 py-3 text-right">Discount</th>
                    <th className="px-5 py-3 text-right">Tax</th>
                    <th className="px-5 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(view.items || []).map((item, index) => (
                    <tr key={item.id || item.productId || index}>
                      <td className="px-5 py-3.5 font-medium text-neutral-900">{item.productName || 'Item'}</td>
                      <td className="px-5 py-3.5 text-neutral-600">{item.sku || '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{item.orderedQty ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{item.receivedQty ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-900">{safeNumber(item.billedQty)}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-500">{item.purchasePrice != null ? formatCurrency(item.purchasePrice) : '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{item.discount ? `${item.discount}%` : '—'}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{item.tax ? `${item.tax}%` : '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="match" className="mt-4 space-y-4">
          {isRecorded || isDemo ? (
            <>
              <Card title="3-Way Verification">
                <p className="text-sm text-neutral-600">
                  Matched against confirmed received quantities for this Purchase (cumulative accepted quantity across all confirmed goods receipts) and the purchase price.
                </p>
                {!isDemo && view.matching ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Field label="Quantity Match" value={view.matching.quantityMatch == null ? '—' : view.matching.quantityMatch ? 'Matched' : 'Mismatch'} />
                      <Field label="Price Match" value={view.matching.priceMatch == null ? '—' : view.matching.priceMatch ? 'Matched' : 'Mismatch'} />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Overall Verification</p>
                        <div className="mt-1"><Badge variant={view.verification.variant}>{view.verification.label}</Badge></div>
                      </div>
                    </div>
                    {view.matching.issues.length > 0 && (
                      <ul className="mt-4 space-y-1.5 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                        {view.matching.issues.map((issue, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : isDemo ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Field label="Ordered Value" value={formatCurrency(demoMatchSummary.orderedValue)} />
                    <Field label="Received Value" value={formatCurrency(demoMatchSummary.receivedValue)} />
                    <Field label="Billed Value" value={formatCurrency(demoMatchSummary.invoicedValue)} />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Verification</p>
                      <div className="mt-1"><Badge variant={demoMatchSummary.overall.variant}>{demoMatchSummary.overall.label}</Badge></div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-neutral-500">The backend has not returned a verification breakdown for this invoice.</p>
                )}
              </Card>

              {isDemo && demoMatchRows.length > 0 && (
                <Card title="Per-item comparison" className="p-0" bodyClassName="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-4xl text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                          <th className="px-5 py-3">Product</th>
                          <th className="px-5 py-3 text-right">Ordered</th>
                          <th className="px-5 py-3 text-right">Received</th>
                          <th className="px-5 py-3 text-right">Billed</th>
                          <th className="px-5 py-3 text-right">Qty Difference</th>
                          <th className="px-5 py-3 text-right">Price Difference</th>
                          <th className="px-5 py-3">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {demoMatchRows.map((row) => (
                          <tr key={row.productId}>
                            <td className="px-5 py-3.5 font-medium text-neutral-900">{row.productName}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{row.orderedQty}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{row.receivedQty}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{row.invoiceQty}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{row.qtyVariance}</td>
                            <td className="px-5 py-3.5 text-right text-neutral-600">{formatCurrency(row.priceVariance)}</td>
                            <td className="px-5 py-3.5"><Badge variant={row.match.variant}>{row.match.label}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={Check}
                title="Not verified yet"
                description="Verification runs when this Draft supplier invoice is Recorded."
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          <Card title="Payments" subtitle="Aggregate amount and status for this supplier invoice.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Amount Paid" value={formatCurrency(view.amountPaid)} />
              <Field label="Outstanding" value={formatCurrency(view.outstanding)} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment Status</p>
                <div className="mt-1"><Badge variant={view.payment.variant}>{view.payment.label}</Badge></div>
              </div>
            </div>
            {!isDemo && (
              <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                Payments are recorded from the Supplier Payments module — not here. Accounts Payable is a read-only liability view.
              </p>
            )}
          </Card>

          {!isDemo && (
            <Card title="Payment History" className="p-0" bodyClassName="p-0">
              {realPayments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-500">No supplier payments have been allocated to this invoice yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-3xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-5 py-3">Payment #</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3 text-right">Amount Allocated</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {realPayments.map((entry) => {
                        const allocated = (entry.allocations || [])
                          .filter((allocation) => allocation.supplierInvoiceId === id)
                          .reduce((sum, allocation) => sum + safeNumber(allocation.amount), 0)
                        const status = supplierPaymentStatusMeta(entry.status)
                        return (
                          <tr key={entry.id} className="hover:bg-primary-50/35">
                            <td className="px-5 py-3.5 font-medium text-primary-700">{entry.paymentNumber}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.paymentDate)}</td>
                            <td className="px-5 py-3.5 text-right font-medium text-neutral-900">
                              {formatCurrency(allocated || entry.allocatedAmount)}
                            </td>
                            <td className="px-5 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {isDemo && (
            <Card title="Payment Allocation History" className="p-0" bodyClassName="p-0">
              {demoPayments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-500">No supplier payments have been allocated to this invoice yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-3xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="px-5 py-3">Payment #</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3 text-right">Allocated Amount</th>
                        <th className="px-5 py-3">Payment Mode</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {demoPayments.map((entry) => {
                        const allocated = (entry.allocations || [])
                          .filter((allocation) => allocation.invoiceId === id)
                          .reduce((sum, allocation) => sum + safeNumber(allocation.amount), 0)
                        const status = supplierPaymentStatusMeta(entry.status)
                        return (
                          <tr key={entry.id} className="hover:bg-primary-50/35">
                            <td className="px-5 py-3.5 font-medium text-primary-700">{entry.paymentNumber}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{formatDate(entry.paymentDate)}</td>
                            <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(allocated)}</td>
                            <td className="px-5 py-3.5 text-neutral-600">{paymentModeLabel(entry.paymentMode)}</td>
                            <td className="px-5 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {isDemo && (
        <RecordSupplierPaymentDrawer
          isOpen={recordOpen}
          preset={invoice ? { supplierId: invoice.supplierId, invoiceId: invoice.id, amount: view.outstanding } : null}
          onClose={() => setRecordOpen(false)}
          onRecorded={() => {
            setRecordOpen(false)
            setTick((value) => value + 1)
          }}
        />
      )}

      <Modal isOpen={cancelOpen} onClose={() => !isActing && setCancelOpen(false)} title="Cancel Supplier Invoice">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            Cancel {view.number}? It stays in history for audit. This is blocked by the backend if any amount has been paid.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setCancelOpen(false)}>Back</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={() => runAction('cancel')}>Cancel Invoice</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !isActing && setDeleteOpen(false)} title="Delete Draft Supplier Invoice">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">Delete {view.number}? Only a Draft can be deleted and this cannot be undone.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={() => runAction('delete')}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
