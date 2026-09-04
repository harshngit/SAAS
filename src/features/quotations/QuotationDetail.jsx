import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRightCircle,
  Ban,
  Check,
  Clock,
  Copy,
  Download,
  FileText,
  Pencil,
  Send,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/toastContext'
import { formatCurrency } from '../../utils/format'
import {
  convertQuotationToOrder,
  deleteQuotation,
  downloadQuotationPdf,
  getQuotation,
  updateQuotationStatus,
} from '../../api/quotations'
import { listWarehouses } from '../../api/warehouses'
import ConvertLeadModal from '../leads/ConvertLeadModal'
import {
  QUOTATION_STATUS_VARIANT,
  buildQuotationTimeline,
  deriveQuotationStatus,
  describeExpiry,
  formatQuotationStatus,
  getQuotationActions,
  getQuotationMeta,
  patchQuotationMeta,
  quotationParty,
  quotationTotals,
} from './quotationHelpers'
import { getDemoQuotation, isDemoQuotation, patchDemoQuotation } from './quotationDemoData'

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
  return `${formatDate(value)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function TimelineItem({ icon: Icon, iconClass, title, subtitle, timestamp, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-neutral-100" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="text-xs text-neutral-400">{formatDateTime(timestamp)}</p>
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/quotations' : '/admin/quotations'
  const ordersBasePath = isSalesPath ? '/sales/orders' : '/admin/orders'
  const customersBasePath = isSalesPath ? '/sales/customers' : '/admin/customers'
  const isDemo = isDemoQuotation(id)

  const [quotation, setQuotation] = useState(null)
  const [meta, setMetaState] = useState(null)
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
  const [convertLeadOpen, setConvertLeadOpen] = useState(false)

  const loadQuotation = async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      const demo = getDemoQuotation(id)
      setQuotation(demo)
      // Meta now only holds display-only edit-flow flags; the lead link is on the object.
      setMetaState(getQuotationMeta(id) || {})
      setLoadError(demo ? '' : 'Demo quotation not found.')
      setIsLoading(false)
      return
    }

    const result = await getQuotation(id)
    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }
    setQuotation(result.quotation)
    setMetaState(getQuotationMeta(id) || {})
    setIsLoading(false)
  }

  useEffect(() => {
    loadQuotation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const timeline = useMemo(() => buildQuotationTimeline(quotation, meta), [quotation, meta])
  const totals = useMemo(() => quotationTotals(quotation?.items || []), [quotation])

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

  const displayStatus = deriveQuotationStatus(quotation)
  const actions = getQuotationActions(quotation)
  const expiry = describeExpiry(quotation.validUntil)
  const hasCustomer = Boolean(quotation.customerId)
  const party = quotationParty(quotation)
  const hasParty = Boolean(party.id)
  const entityLabel = hasParty ? (party.type === 'customer' ? 'Customer' : 'Lead') : ''
  const entityName = party.name || '—'

  const applyMetaPatch = (partial) => {
    if (!isDemo) patchQuotationMeta(id, partial)
    setMetaState((current) => ({ ...current, ...partial }))
  }

  const updateStatus = async (nextStatus) => {
    setIsUpdatingStatus(true)
    setActionError('')

    // Sending a quote that was edited after a previous send counts as "sent again".
    const isResend = nextStatus === 'sent' && meta?.updatedAfterSend

    if (isDemo) {
      patchDemoQuotation(id, { status: nextStatus })
      if (isResend) applyMetaPatch({ resent: true })
      setQuotation((current) => ({ ...current, status: nextStatus, updatedAt: new Date().toISOString() }))
      setIsUpdatingStatus(false)
      showToast({ title: 'Quotation updated', message: isResend ? 'Quotation sent again.' : `Status set to ${formatQuotationStatus(nextStatus)}.` })
      return
    }

    const result = await updateQuotationStatus(quotation.id, nextStatus)
    if (!result.success) {
      setActionError(result.error)
      setIsUpdatingStatus(false)
      return
    }
    if (isResend) applyMetaPatch({ resent: true })
    setQuotation(result.quotation)
    setIsUpdatingStatus(false)
  }

  const handlePrint = async () => {
    if (isDemo) {
      showToast({ title: 'Demo quotation', message: 'PDF download is disabled for demo rows.' })
      return
    }
    setIsDownloading(true)
    setActionError('')
    const result = await downloadQuotationPdf(quotation.id, quotation.quotationNumber)
    if (!result.success) setActionError(result.error)
    setIsDownloading(false)
  }

  const openConvertModal = async () => {
    if (!hasCustomer) {
      setActionError('Customer required before creating an order. Convert the lead to a customer first.')
      return
    }
    setConvertError('')
    setActionError('')
    setConvertOpen(true)

    if (isDemo) return
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

    if (isDemo) {
      setIsConverting(false)
      setConvertOpen(false)
      patchDemoQuotation(id, { status: 'converted', convertedOrderId: 'demo-order' })
      setQuotation((current) => ({ ...current, status: 'converted', convertedOrderId: 'demo-order', convertedAt: new Date().toISOString() }))
      showToast({ title: 'Converted to Order', message: 'A sales order would be created (simulated for demo).' })
      return
    }

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

  const handleLeadConverted = async ({ customerId, customer }) => {
    if (isDemo) {
      setQuotation((current) => ({ ...current, customerId, customerName: customer?.name || party.name || 'New customer' }))
      showToast({ title: 'Lead converted', message: 'The customer is now linked to this quotation (demo).' })
      return
    }
    // The backend auto-attaches the new customer_id to this lead's quotations on conversion
    // (crm_changes Phase 3 §3). Just refetch and trust it - the frontend never PATCHes the
    // quotation's party itself. If the link is genuinely missing, surface it rather than
    // silently fixing it client-side.
    const refreshed = await getQuotation(quotation.id)
    if (refreshed.success) setQuotation(refreshed.quotation)

    if (refreshed.success && !refreshed.quotation.customerId) {
      setActionError(
        'The lead was converted, but the backend has not linked the new customer to this quotation yet. Refresh in a moment; if it stays unlinked, contact support.',
      )
      return
    }
    showToast({ title: 'Lead converted', message: 'The customer is now linked to this quotation.' })
  }

  const handleDelete = async () => {
    if (isDemo) {
      navigate(basePath)
      return
    }
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

  const has = (key) => actions.includes(key)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{quotation.quotationNumber}</h1>
              {isDemo && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
              )}
              <Badge variant={QUOTATION_STATUS_VARIANT[displayStatus] || 'neutral'}>{formatQuotationStatus(displayStatus)}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">
              {entityLabel ? (
                <>
                  <span className="font-medium text-neutral-700">{entityLabel}:</span> {entityName}
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[0.62rem] font-medium ${party.type === 'customer' ? 'bg-neutral-100 text-neutral-500' : 'bg-blue-50 text-blue-600'}`}>
                    {entityLabel}
                  </span>
                  {quotation.leadId && quotation.customerId && (
                    <span className="ml-1.5 rounded bg-green-50 px-1.5 py-0.5 text-[0.62rem] font-medium text-green-600">from lead</span>
                  )}
                </>
              ) : (
                'No customer or lead linked'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {has('edit') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/${encodeURIComponent(id)}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {has('editResend') && (
            <Button variant="primary" size="sm" onClick={() => navigate(`${basePath}/${encodeURIComponent(id)}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit &amp; Resend
            </Button>
          )}
          {has('download') && (
            <Button variant="outline" size="sm" loading={isDownloading} onClick={handlePrint}>
              <Download className="size-4" aria-hidden="true" />
              Download PDF
            </Button>
          )}
          {has('send') && (
            <Button variant="primary" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('sent')}>
              <Send className="size-4" aria-hidden="true" />
              Send
            </Button>
          )}
          {has('reject') && (
            <Button variant="danger" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('rejected')}>
              <Ban className="size-4" aria-hidden="true" />
              Reject
            </Button>
          )}
          {has('accept') && (
            <Button variant="primary" size="sm" loading={isUpdatingStatus} onClick={() => updateStatus('accepted')}>
              <Check className="size-4" aria-hidden="true" />
              Accept
            </Button>
          )}
          {has('convertToCustomer') && (
            <Button variant="primary" size="sm" onClick={() => setConvertLeadOpen(true)}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              Convert to Customer
            </Button>
          )}
          {has('viewCustomer') && quotation.customerId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (isDemo || String(quotation.customerId).startsWith('demo-')
                ? showToast({ title: 'Demo quotation', message: 'On a real quotation this opens the linked customer.' })
                : navigate(`${customersBasePath}/${quotation.customerId}`))}
            >
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              View Customer
            </Button>
          )}
          {has('convertToOrder') && (
            <Button variant="primary" size="sm" onClick={openConvertModal}>
              <ShoppingCart className="size-4" aria-hidden="true" />
              Convert to Order
            </Button>
          )}
          {has('viewOrder') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => (isDemo
                ? showToast({ title: 'Demo quotation', message: 'On a real quotation this opens the sales order.' })
                : navigate(quotation.convertedOrderId ? `${ordersBasePath}/${quotation.convertedOrderId}` : ordersBasePath))}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
              View Order
            </Button>
          )}
          {has('duplicate') && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`${basePath}/new?from=${encodeURIComponent(id)}`)}>
              <Copy className="size-4" aria-hidden="true" />
              Duplicate
            </Button>
          )}
          {has('delete') && (
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

      {expiry.label && displayStatus !== 'converted' && displayStatus !== 'rejected' && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${expiry.tone === 'danger' ? 'border-red-100 bg-red-50 text-red-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {expiry.label}
        </div>
      )}

      {displayStatus === 'accepted' && !hasCustomer && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>An order needs a customer. Convert this lead to a customer to continue.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Subtotal" value={formatCurrency(totals.subtotal)} />
        <SummaryTile label="Discount" value={`− ${formatCurrency(totals.discount)}`} />
        <SummaryTile label="Tax" value={formatCurrency(totals.tax)} />
        <SummaryTile label="Grand Total" value={formatCurrency(totals.grandTotal)} strong />
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
                  <td className="px-5 py-3.5"><p className="font-medium text-neutral-800">{item.productName}</p></td>
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
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{entityLabel || 'Customer / Prospect'}</p>
              <p className="mt-1 text-sm font-medium text-neutral-800">{entityName}</p>
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
            <Info label="Quotation Date" value={formatDate(quotation.quotationDate)} />
            <Info label="Valid Until" value={formatDate(quotation.validUntil)} />
            <Info label="Salesperson" value={quotation.salespersonName || '—'} />
            <Info label="Currency" value={quotation.currency || '—'} />
            <Info label="Payment Terms" value={quotation.paymentTerms || '—'} />
            <Info label="Delivery Terms" value={quotation.deliveryTerms || '—'} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {(quotation.notes || quotation.termsConditions) && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {quotation.notes && (
                <Card title="Notes" subtitle="Internal — not printed on the customer quotation">
                  <p className="text-sm leading-6 text-neutral-700">{quotation.notes}</p>
                </Card>
              )}
              {quotation.termsConditions && (
                <Card title="Terms & Conditions" subtitle="Printed on the customer quotation PDF">
                  <p className="text-sm leading-6 text-neutral-700">{quotation.termsConditions}</p>
                </Card>
              )}
            </div>
          )}
        </div>

        <Card title="Activity">
          {timeline.length === 0 ? (
            <p className="text-sm text-neutral-400">No activity yet.</p>
          ) : (
            <div>
              {timeline.map((event, index) => (
                <TimelineItem key={event.id} {...event} isLast={index === timeline.length - 1} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={convertOpen} onClose={() => !isConverting && setConvertOpen(false)} title="Convert to Sales Order">
        <div className="space-y-4">
          {convertError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{convertError}</div>
          )}
          <p className="text-sm text-neutral-500">
            The order inherits this quotation's customer, products, quantities, pricing, discounts, taxes,
            salesperson, addresses and reference — you only set the fields below.
          </p>
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

      <ConvertLeadModal
        isOpen={convertLeadOpen}
        onClose={() => setConvertLeadOpen(false)}
        leadId={quotation.leadId || ''}
        onConverted={handleLeadConverted}
      />

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

function SummaryTile({ label, value, strong }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-(--shadow-card) ${strong ? 'border-primary-100 bg-primary-50/60' : 'border-neutral-100 bg-white'}`}>
      <p className="text-xs font-medium text-neutral-400">{label}</p>
      <p className={`mt-1.5 font-semibold ${strong ? 'text-lg text-primary-900' : 'text-base text-neutral-900'}`}>{value}</p>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value}</p>
    </div>
  )
}
