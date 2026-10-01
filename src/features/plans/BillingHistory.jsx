import { useEffect, useMemo, useState } from 'react'
import { Clipboard, CreditCard, Receipt, Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { getPaymentHistory } from '../../api/billing'
import { getCurrentOrganizationState } from '../../api/organizations'
import { formatCurrency } from '../../utils/format'

const PAYMENT_STATUS_VARIANT = { paid: 'success', failed: 'danger', created: 'warning' }

function formatDateLabel(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatStatus(value) {
  if (!value) return '-'
  if (value === 'created') return 'Initiated'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatCycle(value) {
  if (!value) return '-'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function BillingHistory() {
  const { showToast } = useToast()
  const [organization, setOrganization] = useState(null)
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [billingCycle, setBillingCycle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setIsLoading(true)
    setError('')
    const [organizationResult, paymentsResult] = await Promise.all([
      getCurrentOrganizationState(),
      getPaymentHistory(),
    ])

    if (organizationResult.success) setOrganization(organizationResult.organization)
    if (paymentsResult.success) {
      setPayments(paymentsResult.payments)
    } else {
      setError(paymentsResult.error)
    }
    if (!organizationResult.success && !paymentsResult.success) {
      setError(organizationResult.error || paymentsResult.error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const statusOptions = useMemo(() => [
    { value: '', label: 'All statuses' },
    ...[...new Set(payments.map((payment) => payment.status).filter(Boolean))].map((value) => ({
      value,
      label: formatStatus(value),
    })),
  ], [payments])

  const cycleOptions = useMemo(() => [
    { value: '', label: 'All billing cycles' },
    ...[...new Set(payments.map((payment) => payment.billingCycle).filter(Boolean))].map((value) => ({
      value,
      label: formatCycle(value),
    })),
  ], [payments])

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return payments.filter((payment) => {
      const matchesSearch = !query || [
        payment.planName,
        payment.razorpayPaymentId,
        payment.razorpayOrderId,
        payment.status,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesSearch
        && (!status || payment.status === status)
        && (!billingCycle || payment.billingCycle === billingCycle)
    })
  }, [billingCycle, payments, search, status])

  const copyPaymentId = async (paymentId) => {
    try {
      await navigator.clipboard.writeText(paymentId)
      showToast({ title: 'Payment ID copied', message: paymentId })
    } catch {
      showToast({ title: 'Unable to copy payment ID', message: 'Please copy it manually.', variant: 'error' })
    }
  }

  const currentPlanName = organization?.plan?.name || organization?.plan_name || 'No active plan'
  const currentBillingCycle = organization?.billing_cycle || '-'
  const planExpiry = organization?.plan_expires_at

  return (
    <div className="space-y-6 pb-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <Receipt className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Billing History</h1>
            <p className="mt-1 text-sm text-neutral-500">View payments made for your organization&apos;s CRM subscription.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-neutral-500">Current Plan</p>
          <p className="mt-2 text-lg font-semibold text-neutral-900">{currentPlanName}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-neutral-500">Billing Cycle</p>
          <p className="mt-2 text-lg font-semibold capitalize text-neutral-900">{formatCycle(currentBillingCycle)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-neutral-500">Valid Until / Plan Expiry</p>
          <p className="mt-2 text-lg font-semibold text-neutral-900">{formatDateLabel(planExpiry)}</p>
        </Card>
      </div>

      <Card title="Subscription Payments" subtitle="Online payments made for this organization&apos;s CRM subscription.">
        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <Input
            aria-label="Search billing payments"
            placeholder="Search plan or payment ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            inputClassName="pl-10"
          />
          <Select label="" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
          <Select label="" options={cycleOptions} value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)} />
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading billing history..." />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No billing payments yet." description="Your subscription payments will appear here after a plan payment is made." />
        ) : filteredPayments.length === 0 ? (
          <EmptyState icon={Search} title="No matching payments" description="Try changing your search or filters." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Plan</th>
                  <th className="px-3.5 py-2.5">Billing Cycle</th>
                  <th className="px-3.5 py-2.5 text-right">Amount</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Payment ID</th>
                  <th className="px-3.5 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3.5 py-2.5 text-neutral-600">{formatDateLabel(payment.paidAt || payment.createdAt)}</td>
                    <td className="px-3.5 py-2.5 text-neutral-800">{payment.planName || '-'}</td>
                    <td className="px-3.5 py-2.5 text-neutral-500">{formatCycle(payment.billingCycle)}</td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-neutral-900">{formatCurrency((payment.amountPaise || 0) / 100)}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant={PAYMENT_STATUS_VARIANT[payment.status] || 'neutral'} dot>
                        {formatStatus(payment.status)}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-neutral-500">{payment.razorpayPaymentId || '-'}</td>
                    <td className="px-3.5 py-2.5">
                      {payment.razorpayPaymentId ? (
                        <Button variant="ghost" size="sm" onClick={() => copyPaymentId(payment.razorpayPaymentId)}>
                          <Clipboard className="size-3.5" aria-hidden="true" />
                          Copy Payment ID
                        </Button>
                      ) : <span className="text-neutral-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
