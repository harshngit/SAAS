import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clipboard, CreditCard, Repeat, Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { ListOverview, ListSummary, ListStatCard, ListTableToolbar } from '../../components/ui/ListPresentation'
import { useToast } from '../../components/ui/toastContext'
import { getPaymentHistory } from '../../api/billing'
import { getCurrentOrganizationState } from '../../api/organizations'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'

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
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
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

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

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
        && isWithinDateRange(payment.paidAt || payment.createdAt, dateFrom, dateTo)
    })
  }, [billingCycle, payments, search, status, dateFrom, dateTo])

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
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Billing History</h1>
      </div>

      <ListOverview>
        <ListSummary className="grid-cols-1 md:grid-cols-3">
          <ListStatCard icon={CreditCard} label="Current Plan" value={currentPlanName} />
          <ListStatCard icon={Repeat} label="Billing Cycle" value={formatCycle(currentBillingCycle)} />
          <ListStatCard icon={CalendarClock} label="Valid Until / Plan Expiry" value={formatDateLabel(planExpiry)} />
        </ListSummary>
      </ListOverview>

      <Card className="overflow-hidden p-0">
        <ListTableToolbar
          title="Subscription Payments"
          subtitle="Online payments made for this organization's CRM subscription."
          search={search}
          onSearchChange={(event) => setSearch(event.target.value)}
          searchPlaceholder="Search plan or payment ID..."
          resultCount={isLoading || error ? undefined : filteredPayments.length}
          actions={(
            <ListFilterPanel
              title="Filter Payments"
              applied={{ status, billingCycle, datePreset, customFrom, customTo }}
              defaults={{ status: '', billingCycle: '', datePreset: 'all', customFrom: '', customTo: '' }}
              onApply={(next) => { setStatus(next.status); setBillingCycle(next.billingCycle); setDatePreset(next.datePreset); setCustomFrom(next.customFrom); setCustomTo(next.customTo) }}
            >
              {({ draft, set, errors }) => (
                <>
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                    <Select options={statusOptions} value={draft.status} onChange={(event) => set('status', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Billing cycle
                    <Select options={cycleOptions} value={draft.billingCycle} onChange={(event) => set('billingCycle', event.target.value)} />
                  </label>
                  <FilterDateRange label="Payment date" draft={draft} set={set} errors={errors} />
                </>
              )}
            </ListFilterPanel>
          )}
        />

        {isLoading ? (
          <div className="px-5 pb-5">
            <LoadingSpinner variant="table" minWidth="min-w-[52rem]" columns={["Date", "Plan", "Billing Cycle", "Amount", "Status", "Payment ID", "Action"]} label="Loading billing history..." />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : payments.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState icon={CreditCard} title="No billing payments yet." description="Your subscription payments will appear here after a plan payment is made." />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState icon={Search} title="No matching payments" description="Try changing your search or filters." />
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-neutral-100">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold text-neutral-400">
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
