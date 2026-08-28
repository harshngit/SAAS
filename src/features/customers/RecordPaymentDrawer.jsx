import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { recordCustomerPayment } from '../../api/customers'
import { formatCurrency } from '../../utils/format'
import {
  getPaymentMethodFlags,
  paymentMethodOptions,
  sanitizePaymentDetails,
} from '../payments/paymentMethodUtils'

const paymentModeOptions = [
  ...paymentMethodOptions,
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyPaymentForm = {
  amount: '',
  paymentMode: 'cash',
  reference: '',
  upiId: '',
  cardType: '',
  cardLastFour: '',
  collectionInstructions: '',
  paymentStatus: 'pending',
  note: '',
  orderId: '',
  invoiceId: '',
  receivedOn: today(),
}

const TRANSITION_MS = 300

export default function RecordPaymentDrawer({ isOpen, onClose, customer, onSaved }) {
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Kept mounted a beat after isOpen flips false so the slide-out/fade-out can actually play -
  // an instant unmount would just make the drawer vanish instead of transitioning closed.
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setPaymentForm(emptyPaymentForm)
    setFormError('')
  }, [isOpen, customer])

  const paymentFlags = getPaymentMethodFlags(paymentForm.paymentMode)

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Two rAFs, not one: the first just lands in the same paint as the initial
      // (hidden) render, so the browser never actually paints the "before" state to
      // transition from - the drawer would pop open instead of sliding in. The second
      // rAF runs after that paint has happened, so the transition has something to animate from.
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return () => cancelAnimationFrame(raf)
    }

    setIsVisible(false)
    const timeout = setTimeout(() => setShouldRender(false), TRANSITION_MS)
    return () => clearTimeout(timeout)
  }, [isOpen])

  if (!shouldRender || !customer) return null

  const customerName = customer.businessName || customer.name

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const amount = Number(paymentForm.amount)
    if (paymentForm.paymentMode !== 'cod' && (!amount || amount <= 0)) {
      setFormError('Enter a valid payment amount.')
      return
    }

    if (paymentFlags.showUpiFields && !paymentForm.upiId.trim()) {
      setFormError('Enter a UPI ID.')
      return
    }

    if (paymentFlags.showCardFields) {
      if (!paymentForm.cardType.trim()) {
        setFormError('Enter the card type.')
        return
      }

      if (!/^\d{4}$/.test(paymentForm.cardLastFour.trim())) {
        setFormError('Enter the last 4 digits of the card.')
        return
      }
    }

    if (paymentFlags.showReferenceField && !paymentForm.reference.trim()) {
      setFormError('Enter a transaction/reference ID.')
      return
    }

    if (paymentFlags.showCodFields && !paymentForm.collectionInstructions.trim()) {
      setFormError('Add collection or delivery instructions.')
      return
    }

    setIsSaving(true)

    const paymentDetails = sanitizePaymentDetails(paymentForm.paymentMode, {
      upiId: paymentForm.upiId.trim(),
      transactionReference: paymentForm.reference.trim(),
      cardType: paymentForm.cardType.trim(),
      cardLastFour: paymentForm.cardLastFour.trim(),
      collectionInstructions: paymentForm.collectionInstructions.trim(),
      paymentStatus: paymentForm.paymentStatus,
    })

    const result = await recordCustomerPayment(customer.id, {
      amount,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim(),
      ...paymentDetails,
      note: paymentForm.note.trim(),
      orderId: paymentForm.orderId.trim(),
      invoiceId: paymentForm.invoiceId.trim(),
      receivedOn: paymentForm.receivedOn ? `${paymentForm.receivedOn}T00:00:00.000Z` : undefined,
    })

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    onSaved(amount)
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-neutral-900/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className={`flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-(--shadow-popover) transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Record Payment</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Record a payment received from {customerName}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">Customer</p>
              <p className="truncate text-sm font-medium text-neutral-900">{customerName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-neutral-400">Outstanding</p>
              <p className={`text-sm font-semibold ${(customer.outstandingBalance || 0) > 0 ? 'text-amber-600' : 'text-neutral-900'}`}>
                {formatCurrency(customer.outstandingBalance || 0)}
              </p>
            </div>
          </div>

          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={paymentForm.amount}
            onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
            inputClassName="text-lg font-semibold"
            required={paymentForm.paymentMode !== 'cod'}
          />

          <div className="grid grid-cols-2 gap-3">
          <Select
            label="Payment Mode"
            options={paymentModeOptions}
            value={paymentForm.paymentMode}
            onChange={(event) => setPaymentForm((current) => ({
              ...current,
              paymentMode: event.target.value,
              reference: '',
              upiId: '',
              cardType: '',
              cardLastFour: '',
              collectionInstructions: '',
              paymentStatus: event.target.value === 'cod' ? 'pending' : '',
            }))}
            required
          />
          <DatePicker
            label="Received On"
            value={paymentForm.receivedOn}
            onChange={(value) => setPaymentForm((current) => ({ ...current, receivedOn: value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {paymentFlags.showUpiFields && (
            <>
              <Input
                label="UPI ID"
                value={paymentForm.upiId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, upiId: event.target.value }))}
                required
              />
              <Input
                label="Transaction / Reference ID"
                value={paymentForm.reference}
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                required
              />
            </>
          )}

          {paymentFlags.showCardFields && (
            <>
              <Input
                label="Card Type"
                value={paymentForm.cardType}
                onChange={(event) => setPaymentForm((current) => ({ ...current, cardType: event.target.value }))}
                placeholder="Debit / Credit / RuPay"
                required
              />
              <Input
                label="Last 4 Digits"
                value={paymentForm.cardLastFour}
                onChange={(event) => setPaymentForm((current) => ({ ...current, cardLastFour: event.target.value }))}
                inputClassName="tracking-[0.25em]"
                maxLength={4}
                required
              />
              <Input
                label="Transaction / Reference ID"
                value={paymentForm.reference}
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                required
              />
            </>
          )}

          {paymentFlags.showReferenceField && !paymentFlags.showUpiFields && !paymentFlags.showCardFields && (
            <Input
              label="Transaction / Reference ID"
              value={paymentForm.reference}
              onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
              required
            />
          )}
        </div>

        {paymentFlags.showCodFields && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Collection / Delivery Instructions</label>
            <textarea
              value={paymentForm.collectionInstructions}
              onChange={(event) => setPaymentForm((current) => ({ ...current, collectionInstructions: event.target.value }))}
              className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
            <p className="text-xs text-amber-700">Payment status stays pending until the cash is collected.</p>
          </div>
        )}

        <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Settle Against (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Invoice ID"
                placeholder="Leave blank for advance"
                value={paymentForm.invoiceId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, invoiceId: event.target.value }))}
              />
              <Input
                label="Order ID"
                placeholder="Optional order ID"
                value={paymentForm.orderId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, orderId: event.target.value }))}
              />
            </div>
          </div>

          <Input
            label="Reference"
            placeholder="Transaction ID, cheque no., etc."
            value={paymentForm.reference}
            onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
          />
          <Input
            label="Note"
            as="textarea"
            placeholder="Optional note about this payment"
            value={paymentForm.note}
            onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" loading={isSaving}>
            <Upload className="size-4" />
            Record Payment
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
