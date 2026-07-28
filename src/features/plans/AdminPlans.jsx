import { useEffect, useRef, useState } from 'react'
import { Check, CreditCard, Crown } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { listActivePlans } from '../../api/plans'
import { requestPlanUpgrade } from '../../api/organizations'
import { getCurrentProfile } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'

export default function AdminPlans() {
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [plans, setPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [requestingPlanId, setRequestingPlanId] = useState(null)
  const [requestedPlanId, setRequestedPlanId] = useState(null)
  const [requestError, setRequestError] = useState('')

  const plansGridRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setListError('')

      const [profileResult, plansResult] = await Promise.all([getCurrentProfile(), listActivePlans()])

      if (!isMounted) return

      setIsLoading(false)

      if (!plansResult.success) {
        setListError(plansResult.error)
        return
      }

      setPlans(plansResult.plans)

      if (!profileResult.success) {
        setListError((current) => current || profileResult.error)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [])

  const currentPlanId = currentOrganization?.plan?.id
  const currentPlanName = currentOrganization?.plan?.name
  const trialDaysLeft = currentOrganization?.trial_days_left
  const isOnTrial = currentOrganization?.status === 'trial' && typeof trialDaysLeft === 'number'
  const hasPendingUpgrade = currentOrganization?.upgrade_status === 'pending'

  const scrollToPlans = () => {
    plansGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleChoosePlan = async (plan) => {
    setRequestError('')
    setRequestingPlanId(plan.id)

    const result = await requestPlanUpgrade({ requestedPlanId: plan.id, billingCycle })

    setRequestingPlanId(null)

    if (!result.success) {
      setRequestError(result.error)
      return
    }

    setRequestedPlanId(plan.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Plans</h1>
          <p className="mt-1 text-sm text-neutral-500">Review your subscription and compare available plans</p>
        </div>
        <Button variant="outline">
          <CreditCard className="size-4" aria-hidden="true" />
          Manage Billing
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Crown className="size-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">{currentPlanName || 'No active plan'}</h2>
                <Badge variant="primary" dot>Current plan</Badge>
                {hasPendingUpgrade && <Badge variant="warning">Upgrade requested</Badge>}
              </div>
              {isOnTrial && (
                <p className="mt-1 text-sm text-neutral-500">{trialDaysLeft} days Free Trial left</p>
              )}
            </div>
          </div>
          <Button onClick={scrollToPlans}>Upgrade Plan</Button>
        </div>
      </Card>

      {requestError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <Tabs value={billingCycle} onValueChange={setBillingCycle} className="flex justify-center sm:justify-start">
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId
              const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
              const originalPrice = billingCycle === 'monthly' ? plan.original_price_monthly : plan.original_price_yearly
              const cycleLabel = billingCycle === 'monthly' ? 'month' : 'year'
              const isRequesting = requestingPlanId === plan.id
              const isRequested = requestedPlanId === plan.id

              return (
                <Card
                  key={plan.id}
                  className={`h-full ${isCurrent ? 'border-primary-300 ring-2 ring-primary-100' : ''}`}
                  bodyClassName="flex h-full flex-col space-y-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
                        {isCurrent && <Badge variant="primary">Active</Badge>}
                      </div>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
                        {formatCurrency(price)}
                        {originalPrice != null && (
                          <span className="ml-2 align-middle text-base font-medium text-neutral-400 line-through">
                            {formatCurrency(originalPrice)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">per {cycleLabel}</p>
                    </div>
                  </div>

                  <ul className="flex-1 space-y-2">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-neutral-600">
                        <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent || isRequested ? 'secondary' : 'primary'}
                    className="w-full"
                    disabled={isCurrent || isRequested}
                    loading={isRequesting}
                    onClick={() => handleChoosePlan(plan)}
                  >
                    {isCurrent ? 'Current Plan' : isRequested ? 'Requested' : 'Choose Plan'}
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
