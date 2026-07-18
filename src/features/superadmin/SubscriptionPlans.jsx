import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/format'

const initialPlans = [
  { id: 1, name: 'Free', price: 0, features: ['Up to 5 users', 'Basic inventory', 'Email support'], popular: false },
  { id: 2, name: 'Pro', price: 4999, features: ['Up to 20 users', 'Advanced inventory', 'Priority support', 'Reports'], popular: true },
  { id: 3, name: 'Enterprise', price: 9999, features: ['Unlimited users', 'Custom integrations', 'Dedicated manager', 'API access'], popular: false },
]

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState(initialPlans)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage subscription plans</p>
        </div>
        <Button icon={Plus}>
          Add Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <Card
            key={plan.id}
            className={`relative ${plan.popular ? 'border-primary-500 border-2' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </div>
            )}
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="text-3xl font-bold my-2">{formatCurrency(plan.price)}</p>
            <p className="text-neutral-500 mb-4">per month</p>
            <ul className="space-y-2 mb-4">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-primary-600">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={Edit}>
                Edit
              </Button>
              <Button variant="secondary" size="sm" icon={Trash2}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
