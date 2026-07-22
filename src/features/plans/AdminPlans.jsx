import { useState } from 'react'
import { Check, CreditCard, Crown } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { plans } from '../../mockData/plans'
import { formatCurrency } from '../../utils/format'

const currentPlanId = 'basic'
const trialDaysLeft = 7

export default function AdminPlans() {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const currentPlan = plans.find((plan) => plan.id === currentPlanId)

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
                <h2 className="text-lg font-semibold text-neutral-900">{currentPlan?.name} Plan</h2>
                <Badge variant="primary" dot>Current plan</Badge>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {trialDaysLeft} days Free Trial left
              </p>
            </div>
          </div>
          <Button>
            Upgrade Plan
          </Button>
        </div>
      </Card>

      <Tabs value={billingCycle} onValueChange={setBillingCycle} className="flex justify-center sm:justify-start">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          const price = billingCycle === 'monthly' ? plan.price : plan.yearlyPrice
          const originalPrice = billingCycle === 'monthly' ? plan.originalPrice : plan.originalYearlyPrice
          const cycleLabel = billingCycle === 'monthly' ? 'month' : 'year'

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
                    <span className="ml-2 align-middle text-base font-medium text-neutral-400 line-through">
                      {formatCurrency(originalPrice)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">per {cycleLabel}</p>
                </div>
              </div>

              <ul className="flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-neutral-600">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={isCurrent ? 'secondary' : 'primary'} className="w-full" disabled={isCurrent}>
                {isCurrent ? 'Current Plan' : 'Choose Plan'}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
