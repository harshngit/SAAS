export const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    originalPrice: 499,
    yearlyPrice: 2199,
    originalYearlyPrice: 5988,
    billingCycle: 'month',
    maxUsers: 2,
    maxOrders: 50,
    features: ['1 warehouse', 'Basic invoicing', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    originalPrice: 999,
    yearlyPrice: 4199,
    originalYearlyPrice: 11988,
    billingCycle: 'month',
    maxUsers: 10,
    maxOrders: 2000,
    features: ['Multi-warehouse', 'GST invoicing', 'Priority support', 'Delivery tracking'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 599,
    originalPrice: 1499,
    yearlyPrice: 6199,
    originalYearlyPrice: 17988,
    billingCycle: 'month',
    maxUsers: 50,
    maxOrders: null,
    features: ['Unlimited orders', 'Custom roles', 'Dedicated support', 'API access'],
  },
]

export const planPricing = plans.reduce((acc, plan) => {
  acc[plan.name] = plan.price
  return acc
}, { Free: 199 })
