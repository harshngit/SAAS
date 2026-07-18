export const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billingCycle: 'month',
    maxUsers: 2,
    maxOrders: 50,
    features: ['1 warehouse', 'Basic invoicing', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1999,
    billingCycle: 'month',
    maxUsers: 10,
    maxOrders: 2000,
    features: ['Multi-warehouse', 'GST invoicing', 'Priority support', 'Delivery tracking'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 4999,
    billingCycle: 'month',
    maxUsers: 50,
    maxOrders: null,
    features: ['Unlimited orders', 'Custom roles', 'Dedicated support', 'API access'],
  },
]

export const planPricing = plans.reduce((acc, plan) => {
  acc[plan.name] = plan.price
  return acc
}, {})
