import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CreditCard, Crown, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { listActivePlans } from '../../api/plans'
import { getCurrentOrganizationState, requestPlanUpgrade } from '../../api/organizations'
import { getCurrentProfile } from '../../api/auth'
import { payForPlan } from './planPayment'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../theme/useTheme'
import { formatCurrency } from '../../utils/format'

function formatDateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getFeatureDescription = (feature) => {
  const normalizedFeature = feature.toLowerCase()

  if (normalizedFeature.includes('user')) {
    return normalizedFeature.includes('unlimited')
      ? 'Invite every team member without seat limits.'
      : 'Set up the right number of staff accounts for daily work.'
  }

  if (normalizedFeature.includes('order')) {
    return normalizedFeature.includes('unlimited')
      ? 'Keep processing orders as your business grows.'
      : 'Handle monthly order volume with clear plan limits.'
  }

  if (normalizedFeature.includes('dashboard')) {
    return 'Track the most important business activity from one place.'
  }

  if (normalizedFeature.includes('report')) {
    return 'Review performance, activity, and business trends faster.'
  }

  if (normalizedFeature.includes('gst') || normalizedFeature.includes('invoice')) {
    return 'Create cleaner billing records with tax-ready details.'
  }

  if (normalizedFeature.includes('support')) {
    return 'Get help faster when your team needs assistance.'
  }

  if (normalizedFeature.includes('integration')) {
    return 'Connect workflows with the tools your business depends on.'
  }

  if (normalizedFeature.includes('warehouse')) {
    return 'Manage inventory activity across multiple locations.'
  }

  if (normalizedFeature.includes('delivery')) {
    return 'Monitor delivery movement and customer fulfilment status.'
  }

  if (normalizedFeature.includes('analytics')) {
    return 'Turn operational data into clearer business decisions.'
  }

  return 'Included to support smoother day-to-day operations.'
}

export default function AdminPlans() {
  const navigate = useNavigate()
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [plans, setPlans] = useState([])
  const [organizationState, setOrganizationState] = useState(currentOrganization)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [requestingPlanId, setRequestingPlanId] = useState(null)
  const [requestedPlanId, setRequestedPlanId] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [requestError, setRequestError] = useState('')

  // Razorpay online payment - separate from the manual upgrade-request state above.
  const { showToast } = useToast()
  const { theme } = useTheme()
  const [payingPlanId, setPayingPlanId] = useState(null)
  const [payError, setPayError] = useState('')
  const [onlinePaymentUnavailable, setOnlinePaymentUnavailable] = useState(false)
  // Known only once an order has actually been created (the key_id only comes back from that
  // call) - stays visible for the rest of this page's session once discovered, since the
  // environment's key doesn't change between one payment attempt and the next.
  const [isTestModePayment, setIsTestModePayment] = useState(false)

  const plansGridRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setListError('')

      const [organizationResult, plansResult] = await Promise.all([
        getCurrentOrganizationState(),
        listActivePlans(),
      ])

      if (!isMounted) return

      setIsLoading(false)

      if (organizationResult.success) {
        setOrganizationState(organizationResult.organization)
        setRequestedPlanId(
          organizationResult.organization?.upgrade_status === 'pending'
            ? organizationResult.organization?.requested_plan_id || organizationResult.organization?.requested_plan?.id || null
            : null,
        )
        if (organizationResult.organization?.billing_cycle) {
          setBillingCycle(organizationResult.organization.billing_cycle)
        }
      }

      if (!plansResult.success) {
        setListError(plansResult.error)
        return
      }

      setPlans(plansResult.plans)

      if (!organizationResult.success) {
        setListError((current) => current || organizationResult.error)
      }
    }

    load()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentPlanId = organizationState?.plan_id || organizationState?.plan?.id
  const currentPlanName = organizationState?.plan?.name
  const trialDaysLeft = organizationState?.trial_days_left ?? organizationState?.trialDaysLeft
  const isOnTrial = organizationState?.status === 'trial' && typeof trialDaysLeft === 'number'

  const scrollToPlans = () => {
    plansGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleChoosePlan = (plan) => {
    setRequestError('')
    setSelectedPlan(plan)
  }

  const handleCloseConfirmUpgrade = () => {
    if (requestingPlanId) return
    setSelectedPlan(null)
  }

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return

    setRequestError('')
    const plan = selectedPlan
    setRequestingPlanId(plan.id)

    const result = await requestPlanUpgrade({ requestedPlanId: plan.id, billingCycle })

    setRequestingPlanId(null)

    if (!result.success) {
      setRequestError(result.error)
      return
    }

    setSelectedPlan(null)
    setRequestedPlanId(plan.id)

    const organizationResult = await getCurrentOrganizationState()
    if (organizationResult.success) {
      setOrganizationState(organizationResult.organization)
      setRequestedPlanId(
        organizationResult.organization?.upgrade_status === 'pending'
          ? organizationResult.organization?.requested_plan_id || organizationResult.organization?.requested_plan?.id || plan.id
          : plan.id,
      )
      if (organizationResult.organization?.billing_cycle) {
        setBillingCycle(organizationResult.organization.billing_cycle)
      }
    }
  }

  // Disabled while processing (via payingPlanId) so a double-click can't open two Razorpay
  // orders for the same plan.
  const handlePayForPlan = async (plan) => {
    if (payingPlanId) return

    setPayError('')
    setPayingPlanId(plan.id)

    const result = await payForPlan({
      plan,
      billingCycle,
      accentColor: theme?.primaryColor,
      onFailed: (message) => {
        setPayError(message)
        showToast({ title: 'Payment failed', message, variant: 'error' })
      },
      onOrderCreated: ({ isTestMode }) => setIsTestModePayment(isTestMode),
    })

    setPayingPlanId(null)

    if (result.cancelled) {
      showToast({ title: 'Payment cancelled', message: 'You can try again anytime.' })
      return
    }

    if (result.notConfigured) {
      setOnlinePaymentUnavailable(true)
      return
    }

    if (!result.success) {
      setPayError(result.error)
      showToast({ title: 'Payment failed', message: result.error, variant: 'error' })
      return
    }

    // verify's response is the full OrganizationOut - apply it immediately, then refresh the
    // auth store's copy (GET /auth/me) so the rest of the app picks up the new plan too.
    setOrganizationState(result.organization)
    setRequestedPlanId(null)
    getCurrentProfile()
    showToast({
      title: 'Plan activated',
      message: result.organization?.plan_expires_at
        ? `Valid till ${formatDateLabel(result.organization.plan_expires_at)}.`
        : 'Your plan has been activated.',
    })
  }

  return (
    <div className="space-y-8 pb-6">
      <Modal
        isOpen={Boolean(selectedPlan)}
        onClose={handleCloseConfirmUpgrade}
        title="Confirm Upgrade"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseConfirmUpgrade} disabled={Boolean(requestingPlanId)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpgrade} loading={Boolean(requestingPlanId)}>
              Confirm Upgrade
            </Button>
          </>
        }
      >
        {selectedPlan && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{selectedPlan.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {billingCycle === 'monthly' ? 'Monthly billing' : 'Yearly billing'}
                  </p>
                </div>
                <Badge variant="primary">
                  {formatCurrency(billingCycle === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly)}
                </Badge>
              </div>
            </div>
            <p className="text-sm leading-6 text-neutral-600">
              Your request will be sent to the Super Admin for approval.
            </p>
          </div>
        )}
      </Modal>

      <section className="rounded-2xl border border-neutral-100 bg-linear-to-br from-white via-white to-[#eef6eb] p-5 shadow-(--shadow-card)">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
              <Crown className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{currentPlanName || 'No active plan'}</h2>
                <Badge variant="primary" dot>Current plan</Badge>
              </div>
              {isOnTrial ? (
                <p className="mt-1.5 text-sm text-neutral-500">{trialDaysLeft} days Free Trial left</p>
              ) : (
                organizationState?.plan_expires_at && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
                    <span className="capitalize">{organizationState.billing_cycle || 'monthly'} billing</span>
                    <span>Valid till {formatDateLabel(organizationState.plan_expires_at)}</span>
                    {typeof organizationState.days_left === 'number' && (
                      <Badge variant={organizationState.days_left <= 7 ? 'warning' : 'neutral'}>
                        {organizationState.days_left} days left
                      </Badge>
                    )}
                  </p>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/billing-history')}>
              <CreditCard className="size-4" aria-hidden="true" />
              Manage Billing
            </Button>
            <Button size="sm" onClick={scrollToPlans}>Upgrade Plan</Button>
          </div>
        </div>
      </section>

      {onlinePaymentUnavailable && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Online payment isn&apos;t set up for this CRM yet. Use &quot;Request Upgrade&quot; below and a Super Admin will approve it manually.
        </div>
      )}

      {isTestModePayment && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Badge variant="warning">TEST MODE</Badge>
          Razorpay is in test mode for this checkout - no real money will be charged.
        </div>
      )}

      {payError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{payError}</div>
      )}

      {requestError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <Tabs value={billingCycle} onValueChange={setBillingCycle} className="flex justify-center">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>

      <div ref={plansGridRef}>
        {isLoading ? (
          <Card>
            <LoadingSpinner label="Loading plans…" />
          </Card>
        ) : plans.length === 0 ? (
          <Card>
            <EmptyState
              title={listError ? 'Unable to load plans' : 'No plans available'}
              description={listError || 'Check back soon for available subscription plans.'}
            />
          </Card>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-5 xl:grid-cols-[22.5rem_25rem_22.5rem] xl:justify-center">
            {plans.map((plan, index) => {
              const isCurrent = String(plan.id) === String(currentPlanId)
              const isFeatured = index === 1
              const isRequested = !isCurrent && String(requestedPlanId || '') === String(plan.id)
              const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
              const originalPrice = billingCycle === 'monthly' ? plan.original_price_monthly : plan.original_price_yearly
              const cycleLabel = billingCycle === 'monthly' ? 'month' : 'year'
              const isPaying = payingPlanId === plan.id

              return (
                <div
                  key={plan.id}
                  className={`group flex min-h-[39rem] rounded-2xl border shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-2 hover:shadow-(--shadow-card-hover) ${
                    isFeatured
                      ? 'xl:min-h-[43rem] border-primary-700 bg-[#063B00] ring-1 ring-primary-700 xl:shadow-[0_10px_22px_-12px_rgb(6_59_0/0.22),0_34px_70px_-40px_rgb(6_59_0/0.42)]'
                    : isCurrent
                        ? 'border-primary-300 bg-surface ring-2 ring-primary-100'
                        : 'border-neutral-100 bg-surface'
                  }`}
                >
                  <div className="flex w-full flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105 ${
                              isFeatured
                                ? 'bg-white/12 text-white ring-white/15'
                                : 'bg-primary-50 text-primary-700 ring-primary-100'
                            }`}
                          >
                            <Crown className="size-5" aria-hidden="true" />
                          </div>
                          <h3 className={`truncate text-xl font-semibold tracking-tight ${isFeatured ? 'text-white' : 'text-neutral-900'}`}>
                            {plan.name}
                          </h3>
                        </div>
                        <p className={`mt-4 text-sm leading-6 ${isFeatured ? 'text-white/70' : 'text-neutral-500'}`}>
                          {plan.features?.[0] || `per ${cycleLabel}`}
                        </p>
                      </div>
                      {isCurrent && <Badge variant="primary">Active</Badge>}
                      {isRequested && <Badge variant="warning">Requested</Badge>}
                    </div>

                    <ul className="mt-7 flex-1 space-y-3.5">
                      {(plan.features || []).map((feature) => (
                        <li
                          key={feature}
                          className={`flex items-start gap-3 rounded-2xl px-0 py-1 text-sm transition-colors duration-200 ${
                            isFeatured ? 'text-white/85 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition-transform duration-200 group-hover:scale-105 ${
                              isFeatured
                                ? 'bg-white/12 text-white ring-white/15'
                                : 'bg-green-50 text-green-600 ring-green-100'
                            }`}
                          >
                            <Check
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className={`block font-medium ${isFeatured ? 'text-white' : 'text-neutral-800'}`}>
                              {feature}
                            </span>
                            <span className={`mt-1 block text-xs leading-5 ${isFeatured ? 'text-white/62' : 'text-neutral-500'}`}>
                              {getFeatureDescription(feature)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className={`mt-8 border-t pt-6 ${isFeatured ? 'border-white/15' : 'border-neutral-100'}`}>
                      <div>
                        <p className={`text-4xl font-semibold tracking-tight ${isFeatured ? 'text-white' : 'text-neutral-900'}`}>
                          {formatCurrency(price)}
                          {originalPrice != null && (
                            <span className={`ml-2 align-middle text-base font-medium line-through ${isFeatured ? 'text-white/35' : 'text-neutral-400'}`}>
                              {formatCurrency(originalPrice)}
                            </span>
                          )}
                        </p>
                        <p className={`mt-1 text-xs ${isFeatured ? 'text-white/65' : 'text-neutral-500'}`}>
                          per {cycleLabel}
                        </p>
                      </div>

                      {!isCurrent && !onlinePaymentUnavailable && (
                        <Button
                          variant={isFeatured ? 'outline' : 'primary'}
                          className={`mt-5 w-full transition-transform duration-200 group-hover:scale-[1.01] ${
                            isFeatured
                              ? 'border-primary-200 bg-[#bdeaa5] text-primary-700 shadow-[0_10px_24px_-12px_rgb(6_59_0/0.35)] hover:border-primary-300 hover:bg-[#aee391] hover:text-primary-900'
                              : ''
                          }`}
                          disabled={Boolean(payingPlanId) && !isPaying}
                          loading={isPaying}
                          onClick={() => handlePayForPlan(plan)}
                        >
                          <Wallet className="size-4" aria-hidden="true" />
                          Pay {formatCurrency(price)} and activate
                        </Button>
                      )}

                      {isCurrent ? (
                        <Button
                          variant={isFeatured ? 'outline' : 'primary'}
                          className={`mt-5 w-full disabled:opacity-100 ${
                            isFeatured
                              ? 'border-primary-200 bg-[#bdeaa5] text-primary-700 hover:border-primary-200 hover:bg-[#bdeaa5]'
                              : ''
                          }`}
                          disabled
                        >
                          Current Plan
                        </Button>
                      ) : (
                        <button
                          type="button"
                          disabled={isRequested || Boolean(requestingPlanId) || Boolean(payingPlanId)}
                          onClick={() => handleChoosePlan(plan)}
                          className={`mt-3 w-full text-center text-xs font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline ${
                            isFeatured ? 'text-white/70 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'
                          } ${isRequested ? 'text-amber-600' : ''}`}
                        >
                          {isRequested ? 'Upgrade requested - awaiting approval' : 'Request upgrade (manual)'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

