import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, IndianRupee, Pencil, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
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
  paymentStatusMeta,
  summarizeMatch,
} from './supplierInvoiceHelpers'
import {
  SUPPLIER_INVOICES_DEMO_ENABLED,
  getDemoSupplierInvoice,
  isDemoSupplierInvoice,
  patchDemoSupplierInvoice,
} from './supplierInvoiceDemoData'
import { paymentModeLabel, paymentStatusMeta as supplierPaymentStatusMeta } from '../supplierPayments/supplierPaymentHelpers'
import { getSupplierPayments } from '../supplierPayments/supplierPaymentDemoData'
import RecordSupplierPaymentDrawer from '../supplierPayments/RecordSupplierPaymentDrawer'

const DOCS_NOTE = 'Supplier invoice attachments and supporting documents will be available once document storage is enabled.'

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
  const basePath = window.location.pathname.startsWith('/accounts')
    ? '/accounts/supplier-invoices'
    : '/admin/supplier-invoices'
  const demoOn = SUPPLIER_INVOICES_DEMO_ENABLED
  const isDemo = isDemoSupplierInvoice(id)

  const [invoice, setInvoice] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [tick, setTick] = useState(0)
  const [recordOpen, setRecordOpen] = useState(false)

  useEffect(() => {
    if (!demoOn || !isDemo) {
      setNotFound(true)
      return
    }
    const record = getDemoSupplierInvoice(id)
    if (!record) {
      setNotFound(true)
      return
    }
    setInvoice(record)
    setNotFound(false)
  }, [id, demoOn, isDemo, tick])

  const totals = useMemo(() => (invoice ? computeInvoiceTotals(invoice.items, invoice.charges) : null), [invoice])
  const outstanding = useMemo(
    () => (invoice && totals ? invoiceOutstanding({ invoiceTotal: totals.invoiceTotal, amountPaid: invoice.amountPaid }) : 0),
    [invoice, totals],
  )
  const paymentStatus = useMemo(
    () => (invoice && totals ? derivePaymentStatusFromAmount(invoice.amountPaid, totals.invoiceTotal) : 'unpaid'),
    [invoice, totals],
  )
  const purchase = useMemo(() => (invoice?.purchaseId ? getDemoPurchase(invoice.purchaseId) : null), [invoice])
  const grns = useMemo(() => (invoice?.purchaseId ? getDemoGrns(invoice.purchaseId) : []), [invoice])
  const matchRows = useMemo(() => (invoice ? buildMatchRows(invoice, purchase, grns) : []), [invoice, purchase, grns])
  const matchSummary = useMemo(() => summarizeMatch(matchRows), [matchRows])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoicePayments = useMemo(() => (invoice ? getSupplierPayments({ invoiceId: id }) : []), [invoice, id, tick])
  const recordPaymentPreset = useMemo(
    () => (invoice ? { supplierId: invoice.supplierId, invoiceId: invoice.id, amount: outstanding } : null),
    [invoice, outstanding],
  )

  // Invoice-status edits only (Disputed / Cancelled). Amount Paid is NEVER written here - it is
  // updated only through the canonical Supplier Payment allocation flow (RecordSupplierPaymentDrawer).
  const applyPatch = (partial) => {
    patchDemoSupplierInvoice(id, partial)
    setTick((value) => value + 1)
  }

  if (!demoOn || notFound) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title={demoOn ? 'Supplier invoice not found' : 'Supplier invoicing not enabled'}
          description={
            demoOn
              ? 'This demo supplier invoice may have been removed.'
              : 'Supplier invoice recording will be available once the supplier invoicing backend is enabled.'
          }
          action={{ label: 'Back to Supplier Invoices', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  if (!invoice || !totals) return null

  const status = invoiceStatusMeta(invoice.invoiceStatus)
  const payment = paymentStatusMeta(paymentStatus)
  const isCancelled = invoice.invoiceStatus === 'cancelled'

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
              <h1 className="text-2xl font-semibold text-neutral-900">{invoice.supplierInvoiceNumber}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              {matchRows.length > 0 && <Badge variant={matchSummary.overall.variant}>{matchSummary.overall.label}</Badge>}
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
              <span>{invoice.supplierName || '—'}</span>
              <span>·</span>
              <span>Invoice {formatDate(invoice.invoiceDate)}</span>
              <span>·</span>
              <span>Due {formatDate(invoice.dueDate)}</span>
              {invoice.systemRef && (<><span>·</span><span>Ref {invoice.systemRef}</span></>)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isCancelled && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/${id}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {!isCancelled && paymentStatus !== 'paid' && (
            <Button variant="outline" size="sm" onClick={() => setRecordOpen(true)}>
              <IndianRupee className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          )}
          {!isCancelled && invoice.invoiceStatus !== 'disputed' && (
            <Button variant="outline" size="sm" onClick={() => applyPatch({ invoiceStatus: 'disputed' })}>
              <AlertTriangle className="size-4" aria-hidden="true" />
              Mark Disputed
            </Button>
          )}
          {!isCancelled && (
            <Button variant="danger" size="sm" onClick={() => applyPatch({ invoiceStatus: 'cancelled' })}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="primary" label="Invoice Total" value={formatCurrency(totals.invoiceTotal)} />
        <StatCard icon={Wallet} iconVariant="success" label="Amount Paid" value={formatCurrency(invoice.amountPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding" value={formatCurrency(outstanding)} />
        <StatCard icon={Wallet} iconVariant="info" label="Payment Status" value={payment.label} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="match">Verification</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents / Notes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card title="Invoice Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Supplier" value={invoice.supplierName} />
              <Field label="Supplier Invoice #" value={invoice.supplierInvoiceNumber} />
              <Field label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
              <Field label="Due Date" value={formatDate(invoice.dueDate)} />
              <Field label="Purchase #" value={invoice.purchaseNumber} />
              <Field label="GRN #" value={invoice.grnNumber} />
              <Field label="Currency" value={invoice.currency} />
              <Field label="Payment Terms" value={invoice.paymentTerms} />
              <Field label="Invoice Status" value={status.label} />
              <Field label="Verification" value={matchRows.length > 0 ? matchSummary.overall.label : '—'} />
              <Field label="Payment Status" value={payment.label} />
              {invoice.notes && <Field label="Notes" value={invoice.notes} className="sm:col-span-2 lg:col-span-3" />}
            </div>
          </Card>

          <Card title="Commercial Summary">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <Field label="Discount" value={formatCurrency(totals.discount)} />
              <Field label="Tax" value={formatCurrency(totals.tax)} />
              <Field label="Other Charges" value={formatCurrency(totals.freight + totals.packing + totals.insurance + totals.otherCharges + totals.roundOff)} />
              <Field label="Invoice Total" value={formatCurrency(totals.invoiceTotal)} />
              <Field label="Amount Paid" value={formatCurrency(invoice.amountPaid)} />
              <Field label="Outstanding" value={formatCurrency(outstanding)} />
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
                    <th className="px-5 py-3">UOM</th>
                    <th className="px-5 py-3 text-right">Invoice Qty</th>
                    <th className="px-5 py-3 text-right">Unit Price</th>
                    <th className="px-5 py-3 text-right">Discount</th>
                    <th className="px-5 py-3 text-right">Tax</th>
                    <th className="px-5 py-3 text-right">Tax Amount</th>
                    <th className="px-5 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(invoice.items || []).map((item, index) => {
                    const line = computeInvoiceLine(item)
                    return (
                      <tr key={item.productId || index}>
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{item.productName || 'Item'}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{item.sku || '—'}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{item.uom || '—'}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600">{safeNumber(item.invoiceQty)}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600">{item.discount ? `${item.discount}%` : '—'}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600">{item.taxRate ? `${item.taxRate}%` : '—'}</td>
                        <td className="px-5 py-3.5 text-right text-neutral-600">{formatCurrency(line.taxAmount)}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(line.lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="match" className="mt-4 space-y-4">
          <Card title="Verification">
            <p className="text-sm text-neutral-600">We compare what was ordered, what was received, and what the supplier billed.</p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Ordered Value" value={formatCurrency(matchSummary.orderedValue)} />
              <Field label="Received Value" value={formatCurrency(matchSummary.receivedValue)} />
              <Field label="Billed Value" value={formatCurrency(matchSummary.invoicedValue)} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Verification</p>
                <div className="mt-1"><Badge variant={matchSummary.overall.variant}>{matchSummary.overall.label}</Badge></div>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">Difference (Billed − Received): {formatCurrency(matchSummary.variance)}. For review only — nothing is blocked.</p>
          </Card>

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
                  {matchRows.map((row) => (
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
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          <Card title="Payments" subtitle="Aggregate amount and status for this supplier invoice.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Amount Paid" value={formatCurrency(invoice.amountPaid)} />
              <Field label="Outstanding" value={formatCurrency(outstanding)} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment Status</p>
                <div className="mt-1"><Badge variant={payment.variant}>{payment.label}</Badge></div>
              </div>
            </div>
          </Card>

          <Card title="Payment Allocation History" className="p-0" bodyClassName="p-0">
            {invoicePayments.length === 0 ? (
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
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {invoicePayments.map((entry) => {
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
                          <td className="px-5 py-3.5 text-neutral-500">{entry.reference || '—'}</td>
                          <td className="px-5 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card title="Documents">
            <p className="text-sm text-neutral-500">{DOCS_NOTE}</p>
          </Card>
          <Card title="Notes">
            {invoice.notes ? (
              <p className="whitespace-pre-line text-sm text-neutral-700">{invoice.notes}</p>
            ) : (
              <p className="text-sm text-neutral-400">No notes added.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <RecordSupplierPaymentDrawer
        isOpen={recordOpen}
        preset={recordPaymentPreset}
        onClose={() => setRecordOpen(false)}
        onRecorded={() => {
          setRecordOpen(false)
          setTick((value) => value + 1)
        }}
      />
    </div>
  )
}
