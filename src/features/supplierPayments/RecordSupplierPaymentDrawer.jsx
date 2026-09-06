import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wand2, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { formatCurrency } from '../../utils/format'
import { safeNumber } from '../purchases/purchaseHelpers'
import { demoSuppliers } from '../suppliers/supplierDemoData'
import { getDemoSupplierInvoicesForSupplier } from '../supplierInvoices/supplierInvoiceDemoData'
import { resolveSupplierInvoice } from '../supplierInvoices/supplierInvoiceHelpers'
import {
  autoAllocate,
  PAYMENT_MODE_OPTIONS,
  REAL_MODE_NOTE,
  validateSupplierPayment,
} from './supplierPaymentHelpers'
import { recordSupplierPaymentDemo, SUPPLIER_PAYMENTS_DEMO_ENABLED } from './supplierPaymentDemoData'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function outstandingInvoicesForSupplier(supplierId) {
  if (!supplierId) return []
  return getDemoSupplierInvoicesForSupplier(supplierId)
    .map((invoice) => resolveSupplierInvoice(invoice))
    .filter((invoice) => invoice.invoiceStatus !== 'cancelled' && safeNumber(invoice.outstanding) > 0)
}

export default function RecordSupplierPaymentDrawer({ isOpen, onClose, onRecorded, preset }) {
  const demoOn = SUPPLIER_PAYMENTS_DEMO_ENABLED
  const [supplierId, setSupplierId] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentMode, setPaymentMode] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [allocations, setAllocations] = useState({})
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setPaymentDate(todayIso())
    setPaymentMode('bank_transfer')
    setReference('')
    setNotes('')
    setError('')
    setIsSaving(false)
    const presetSupplier = preset?.supplierId || ''
    setSupplierId(presetSupplier)
    if (preset?.invoiceId && preset?.amount != null) {
      setAllocations({ [preset.invoiceId]: String(preset.amount) })
      setPaymentAmount(String(preset.amount))
    } else {
      setAllocations({})
      setPaymentAmount('')
    }
  }, [isOpen, preset])

  const supplierOptions = useMemo(
    () => [{ value: '', label: 'Select supplier' }, ...demoSuppliers.map((s) => ({ value: s.id, label: s.name }))],
    [],
  )
  const invoices = useMemo(() => outstandingInvoicesForSupplier(supplierId), [supplierId])
  const supplierName = demoSuppliers.find((s) => s.id === supplierId)?.name || ''

  // With a single outstanding invoice the allocation is just the payment amount (capped) - keep
  // them in sync so the common "pay one invoice" case needs no manual allocation edit.
  useEffect(() => {
    if (invoices.length !== 1 || paymentAmount === '') return
    const only = invoices[0]
    const capped = Math.min(Number(paymentAmount) || 0, safeNumber(only.outstanding))
    setAllocations({ [only.id]: capped > 0 ? String(capped) : '0' })
  }, [paymentAmount, invoices])

  const allocatedTotal = invoices.reduce((sum, invoice) => sum + (Number(allocations[invoice.id]) || 0), 0)
  const remainingUnallocated = (Number(paymentAmount) || 0) - allocatedTotal
  const validationError = validateSupplierPayment({ supplierId, paymentDate, paymentMode, paymentAmount, allocations, invoices })

  const handleSupplierChange = (value) => {
    setSupplierId(value)
    setAllocations({})
    setPaymentAmount('')
    setError('')
  }

  const handleAutoAllocate = () => {
    setAllocations(autoAllocate(paymentAmount, invoices))
  }

  const handleRecord = () => {
    setError('')
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSaving(true)
    recordSupplierPaymentDemo({
      supplierId,
      supplierName,
      paymentDate,
      paymentMode,
      reference,
      notes,
      allocations: invoices
        .map((invoice) => ({ invoiceId: invoice.id, amount: Number(allocations[invoice.id]) || 0 }))
        .filter((line) => line.amount > 0),
    })
    setIsSaving(false)
    onRecorded?.()
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-(--shadow-popover)"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Record Supplier Payment</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Pay one or more outstanding supplier invoices.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        {!demoOn ? (
          <div className="flex-1 px-6 py-10 text-center text-sm text-neutral-500">{REAL_MODE_NOTE}</div>
        ) : (
          <>
            <div className="flex-1 space-y-5 px-6 py-5">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select label="Supplier" required options={supplierOptions} value={supplierId} onChange={(event) => handleSupplierChange(event.target.value)} disabled={Boolean(preset?.supplierId)} />
                <Input label="Payment Date" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                <Select label="Payment Mode" required options={PAYMENT_MODE_OPTIONS} value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} />
                <Input label="Reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR / cheque / UPI ref (optional)" />
                <Input as="textarea" label="Notes" className="sm:col-span-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
                <Input label="Payment Amount" type="number" min="0" step="1" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </div>

              {supplierId && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Allocate Payment To Invoices</p>
                    <Button type="button" variant="outline" size="sm" disabled={invoices.length === 0} onClick={handleAutoAllocate}>
                      <Wand2 className="size-4" aria-hidden="true" />
                      Auto Allocate
                    </Button>
                  </div>

                  {invoices.length === 0 ? (
                    <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                      This supplier has no invoices with an outstanding balance.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-100">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-400">
                            <th className="px-3 py-2">Invoice #</th>
                            <th className="px-3 py-2">Due Date</th>
                            <th className="px-3 py-2 text-right">Invoice Total</th>
                            <th className="px-3 py-2 text-right">Already Paid</th>
                            <th className="px-3 py-2 text-right">Outstanding</th>
                            <th className="px-3 py-2 text-right">Allocate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {invoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td className="px-3 py-2 font-medium text-primary-700">{invoice.supplierInvoiceNumber}</td>
                              <td className="px-3 py-2 text-neutral-600">{formatDate(invoice.dueDate)}</td>
                              <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(invoice.invoiceTotal)}</td>
                              <td className="px-3 py-2 text-right text-neutral-600">{formatCurrency(invoice.amountPaid)}</td>
                              <td className="px-3 py-2 text-right text-neutral-800">{formatCurrency(invoice.outstanding)}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={invoice.outstanding}
                                  step="1"
                                  value={allocations[invoice.id] ?? ''}
                                  onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: event.target.value }))}
                                  className="w-24 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-3 space-y-1 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                    <div className="flex justify-between"><span className="text-neutral-500">Payment Amount</span><span className="font-medium text-neutral-800">{formatCurrency(Number(paymentAmount) || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">Allocated Amount</span><span className="font-medium text-neutral-800">{formatCurrency(allocatedTotal)}</span></div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Remaining Unallocated</span>
                      <span className={`font-semibold ${Math.abs(remainingUnallocated) < 0.001 ? 'text-primary-700' : 'text-amber-600'}`}>{formatCurrency(remainingUnallocated)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-neutral-100 px-6 py-4">
              <Button type="button" variant="secondary" className="flex-1" disabled={isSaving} onClick={onClose}>Cancel</Button>
              <Button type="button" className="flex-1" loading={isSaving} disabled={Boolean(validationError)} onClick={handleRecord}>Record Payment</Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
