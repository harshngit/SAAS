import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Search, Upload, User, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { formatCurrency } from '../../utils/format'
import { getCustomerOutstanding, recordCustomerCollection, searchOutstandingCustomers } from '../../api/customerPayments'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

const TRANSITION_MS = 300
const todayIso = () => new Date().toISOString().slice(0, 10)
const money = (value) => Math.round((Number(value) || 0) * 100) / 100

// "+ Collect Payment" side drawer for a Delivery Partner (opened from their dashboard).
// Deliberately simple: search ANY customer with an outstanding balance -> enter the amount
// collected -> submit. No invoice-level allocation - the Delivery Partner only knows "the
// customer owes X, I collected Y". The result is a Collection ("Recorded"): the Accountant
// reconciles it, and the backend then creates the CustomerPayment and moves the balance.
// This drawer never changes a balance locally.
// `initialCustomer` (optional) - when this drawer is opened from a page that already knows
// the customer (e.g. Order Detail's "Record Payment"), pass { id, name, phone,
// outstandingBalance } to skip the search step and land straight on the payment form. The
// outstanding balance is still refreshed from the backend before the form is usable.
export default function CollectPaymentDrawer({ isOpen, onClose, onRecorded, partner, initialCustomer }) {
  const { showToast } = useToast()

  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)

  const [customer, setCustomer] = useState(null)
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false)

  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIso())

  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setQuery(''); setResults([]); setIsSearching(false); setSearchError(''); setSearched(false)
    setCustomer(null); setIsLoadingCustomer(false)
    setAmount(''); setPaymentMethod('cash'); setReference(''); setNotes('')
    setPaymentDate(todayIso()); setFormError(''); setIsSaving(false)
  }

  // Mount a beat before the slide-in and unmount a beat after the slide-out, matching the
  // existing Record Payment drawer transition.
  useEffect(() => {
    if (isOpen) {
      reset()
      setShouldRender(true)
      if (initialCustomer?.id) {
        selectCustomer(initialCustomer)
      }
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)))
      return () => cancelAnimationFrame(raf)
    }
    setIsVisible(false)
    const timeout = setTimeout(() => setShouldRender(false), TRANSITION_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Debounced customer search - outstanding customers only.
  useEffect(() => {
    if (customer) return undefined
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setSearched(false)
      setSearchError('')
      return undefined
    }
    let active = true
    setIsSearching(true)
    const handle = setTimeout(async () => {
      const result = await searchOutstandingCustomers(term)
      if (!active) return
      setIsSearching(false)
      setSearched(true)
      if (!result.success) {
        setResults([])
        setSearchError(result.error)
        return
      }
      setSearchError('')
      setResults(result.customers)
    }, 300)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [query, customer])

  const selectCustomer = async (picked) => {
    setCustomer(picked)
    setResults([])
    setQuery('')
    setFormError('')
    // Refresh the outstanding balance from the canonical customer endpoint (source of truth).
    setIsLoadingCustomer(true)
    const fresh = await getCustomerOutstanding(picked.id)
    setIsLoadingCustomer(false)
    if (fresh.success) setCustomer(fresh.customer)
  }

  const clearCustomer = () => {
    setCustomer(null)
    setFormError('')
  }

  const amountValue = money(amount)
  const outstanding = money(customer?.outstandingBalance)
  const remainingBalance = Math.max(money(outstanding - amountValue), 0)

  const canSubmit = Boolean(customer) && amountValue > 0 && !isSaving

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return
    setFormError('')

    if (!customer) {
      setFormError('Select a customer first.')
      return
    }
    if (!(amountValue > 0)) {
      setFormError('Enter the amount received.')
      return
    }

    setIsSaving(true)
    const result = await recordCustomerCollection({
      customerId: customer.id,
      amount: amountValue,
      paymentMethod,
      reference,
      notes,
      paymentDate,
      // Demo-only context (real backend reads the collector + their role from auth). No
      // allocation / invoice / order / delivery is sent — the Accountant allocates at
      // reconciliation. `collectorRole` is never hardcoded to "Delivery Partner" - it's
      // whoever `partner` actually is (a Delivery Partner from the dashboard, or an
      // Admin/Sales Officer recording it from Order Detail).
      deliveryPartnerId: partner?.id,
      deliveryPartnerName: partner?.name,
      collectorRole: partner?.role,
    })
    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    // Not "paid" / "completed" - the accountant still has to reconcile it. Shows who
    // recorded it (the current logged-in user) - there is no collector picker; the backend
    // derives the collector from auth, this is purely a confirmation of who's signed in.
    showToast({
      title: 'Collection recorded successfully',
      message: `${formatCurrency(amountValue)} recorded${partner?.name ? ` · Collected by ${partner.name}` : ''} · waiting for accountant reconciliation.`,
    })
    onRecorded?.(result.collection)
    onClose()
  }

  if (!shouldRender) return null

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
        className={`flex h-full w-full max-w-md flex-col bg-white shadow-(--shadow-popover) transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Fixed header */}
        <div className="flex shrink-0 items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Collect Payment</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Collect outstanding customer payment</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {formError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}

          {!customer ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Customer</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or phone"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>

              {isSearching && (
                <p className="flex items-center gap-2 px-1 text-xs text-neutral-400">
                  <Loader2 className="size-3.5 animate-spin" /> Searching…
                </p>
              )}
              {searchError && <p className="px-1 text-xs text-red-600">{searchError}</p>}
              {!isSearching && searched && !searchError && results.length === 0 && (
                <p className="px-1 text-xs text-neutral-400">
                  No customers with an outstanding balance match “{query.trim()}”.
                </p>
              )}

              <div className="space-y-1.5">
                {results.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectCustomer(row)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">{row.name}</span>
                      {row.phone && <span className="block truncate text-xs text-neutral-400">{row.phone}</span>}
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold text-amber-600">
                      {formatCurrency(row.outstandingBalance)}
                      <span className="block text-[0.62rem] font-normal text-neutral-400">outstanding</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Customer card */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <User className="size-3.5" /> Customer
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{customer.name}</p>
                  {customer.phone && <p className="truncate text-xs text-neutral-500">{customer.phone}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-neutral-400">Outstanding</p>
                  <p className="text-sm font-semibold text-amber-600">
                    {isLoadingCustomer ? '…' : formatCurrency(outstanding)}
                  </p>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="mt-1 text-xs font-medium text-primary-700 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Payment details */}
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Payment Details</p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Amount Received"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputClassName="text-lg font-semibold"
                />
                <Input
                  label="Payment Date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>

              <Select
                label="Payment Method"
                options={PAYMENT_METHODS}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              />

              <Input
                label="Reference Number (optional)"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="UPI / card / txn reference"
              />
              <Input
                label="Notes (optional)"
                as="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything the accountant should know"
              />

              {/* Summary — display only, backend values are updated after reconciliation */}
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Collection Amount</span>
                  <span className="font-medium text-neutral-900">{formatCurrency(amountValue)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-primary-100 pt-1.5">
                  <span className="font-semibold text-neutral-900">Remaining Outstanding</span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(remainingBalance)}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  The final balance is confirmed by the accounts team when they reconcile this collection.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Fixed footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} disabled={!canSubmit}>
            <Upload className="size-4" />
            Submit Collection
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
