import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { getCustomer, recordCustomerPayment } from '../../api/customers'
import { formatCurrency } from '../../utils/format'

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyPaymentForm = {
  amount: '',
  paymentMode: 'cash',
  reference: '',
  note: '',
  orderId: '',
  invoiceId: '',
  receivedOn: today(),
}

export default function RecordCustomerPayment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customer, setCustomer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true

    getCustomer(id).then((result) => {
      if (!isMounted) return
      setIsLoading(false)
      if (!result.success) {
        setLoadError(result.error)
        return
      }
      setCustomer(result.customer)
    })

    return () => {
      isMounted = false
    }
  }, [id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      setFormError('Enter a valid payment amount.')
      return
    }

    setIsSaving(true)

    const result = await recordCustomerPayment(id, {
      amount,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim(),
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

    showToast({ title: 'Payment recorded', message: `${formatCurrency(amount)} recorded for ${customer?.businessName || customer?.name || 'this customer'}.` })
    navigate(`/admin/customers/${id}`)
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading customer..." />
      </Card>
    )
  }

  if (loadError || !customer) {
    return (
      <Card>
        <EmptyState
          title="Customer not found"
          description={loadError || 'This customer may have been removed or the link is out of date.'}
          action={{ label: 'Back to Customers', onClick: () => navigate('/admin/customers') }}
        />
      </Card>
    )
  }

  const customerName = customer.businessName || customer.name

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/customers/${id}`)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Customer
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Record Payment</h1>
          <p className="text-sm text-neutral-500">Record a payment received from {customerName}.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-5">
            {formError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
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
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Payment Mode"
                options={paymentModeOptions}
                value={paymentForm.paymentMode}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMode: event.target.value }))}
                required
              />
              <DatePicker
                label="Received On"
                value={paymentForm.receivedOn}
                onChange={(value) => setPaymentForm((current) => ({ ...current, receivedOn: value }))}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Settle Against (Optional)</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={isSaving} onClick={() => navigate(`/admin/customers/${id}`)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving}>
                Record Payment
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  )
}
