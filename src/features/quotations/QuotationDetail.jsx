import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, FileText, IndianRupee, Printer, Send } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { formatCurrency } from '../../utils/format'
import { getQuotationById, upsertStoredQuotation } from './quotationStorage'

const statusVariant = {
  Draft: 'neutral',
  Sent: 'info',
  Accepted: 'success',
  Expired: 'danger',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function lineBreakdown(item) {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.tax) || 0
  const subtotal = quantity * unitPrice
  const discountAmount = subtotal * (discount / 100)
  const discounted = subtotal - discountAmount
  const taxAmount = discounted * (tax / 100)

  return { subtotal, discountAmount, taxAmount, lineTotal: discounted + taxAmount }
}

function quotationTotals(items = []) {
  return items.reduce(
    (totals, item) => {
      const breakdown = lineBreakdown(item)
      totals.subtotal += breakdown.subtotal
      totals.discount += breakdown.discountAmount
      totals.tax += breakdown.taxAmount
      totals.total += breakdown.lineTotal
      return totals
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  )
}

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/quotations' : '/admin/quotations'
  const [quotation, setQuotation] = useState(() => getQuotationById(id))

  if (!quotation) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Quotation not found"
          description="This quotation may have been removed or the link is out of date."
          action={{ label: 'Back to Quotations', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const totals = quotationTotals(quotation.items)

  const updateStatus = (nextStatus) => {
    const nextQuotation = { ...quotation, status: nextStatus }
    upsertStoredQuotation(nextQuotation)
    setQuotation(nextQuotation)
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
              <h1 className="text-2xl font-semibold text-neutral-900">{quotation.id}</h1>
              <Badge variant={statusVariant[quotation.status] || 'neutral'}>{quotation.status}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">{quotation.customer}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
          {quotation.status === 'Draft' && (
            <Button variant="primary" size="sm" onClick={() => updateStatus('Sent')}>
              <Send className="size-4" aria-hidden="true" />
              Mark as Sent
            </Button>
          )}
          {quotation.status === 'Sent' && (
            <>
              <Button variant="danger" size="sm" onClick={() => updateStatus('Expired')}>
                <Ban className="size-4" aria-hidden="true" />
                Mark as Expired
              </Button>
              <Button variant="primary" size="sm" onClick={() => updateStatus('Accepted')}>
                <Check className="size-4" aria-hidden="true" />
                Mark as Accepted
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="neutral" label="Subtotal" value={formatCurrency(totals.subtotal)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Discount" value={formatCurrency(totals.discount)} />
        <StatCard icon={IndianRupee} iconVariant="info" label="Tax" value={formatCurrency(totals.tax)} />
        <StatCard icon={IndianRupee} iconVariant="primary" label="Total" value={formatCurrency(totals.total)} />
      </div>

      <Card title="Quotation Items" subtitle="Products or services included in this estimate" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-5 py-3">Product</th>
                <th className="whitespace-nowrap px-5 py-3">SKU</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-5 py-3">UOM</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Unit Price</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Discount</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Tax</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {(quotation.items || []).map((item, index) => {
                const breakdown = lineBreakdown(item)
                return (
                  <tr key={`${item.sku || item.product}-${index}`} className="transition-colors hover:bg-primary-50/35">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-neutral-800">{item.product}</p>
                      {item.description && <p className="mt-0.5 text-xs text-neutral-400">{item.description}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{item.sku || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.quantity}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{item.uom || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{formatCurrency(Number(item.unitPrice) || 0)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.discount ? `${item.discount}%` : '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">{item.tax ? `${item.tax}%` : '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(breakdown.lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Customer & Delivery">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Customer</p>
              <p className="mt-1 text-sm font-medium text-neutral-800">{quotation.customer || '—'}</p>
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
              <p className="mt-1 text-sm text-neutral-800">{quotation.salesperson || '—'}</p>
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

      {(quotation.notes || quotation.terms) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {quotation.notes && (
            <Card title="Notes" subtitle="Internal remarks, not printed on the quotation">
              <p className="text-sm leading-6 text-neutral-700">{quotation.notes}</p>
            </Card>
          )}
          {quotation.terms && (
            <Card title="Terms & Conditions" subtitle="Printed on the quotation">
              <p className="text-sm leading-6 text-neutral-700">{quotation.terms}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
